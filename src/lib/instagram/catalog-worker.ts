import 'server-only'
import { randomUUID } from 'node:crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { sanitizeCaptureError } from './capture'
import { renderCatalogJpeg } from './catalog-render'
import { catalogProductFingerprint, readCatalogProducts, selectCatalogProducts } from './catalog-selection'
import { recordConfirmedCatalogSheet } from './catalog-publications'
import { createInstagramMetaClient, type InstagramMetaClient } from './meta-client'
import type { InstagramPublishingConfig } from './publishing-config'
import type { CatalogBatch, CatalogProduct, CatalogSlide } from './catalog-contracts'

export interface CatalogWorkerDependencies {
  claim(): Promise<CatalogBatch | null>
  save(batch: CatalogBatch, release: boolean): Promise<void>
  select(): Promise<CatalogProduct[]>
  read(): Promise<CatalogProduct[]>
  render(products: CatalogProduct[], position: number): Promise<Buffer>
  upload(jpeg: Buffer, date: string, position: number): Promise<string>
  meta: InstagramMetaClient
  record(slide: CatalogSlide): Promise<string | null>
  now(): Date
  wait(): Promise<void>
}

function productionDependencies(config: InstagramPublishingConfig): CatalogWorkerDependencies {
  const client = createServiceRoleClient()
  const meta = createInstagramMetaClient(config)
  return {
    async claim() {
      const { data, error } = await client.rpc('instagram_claim_catalog_batch')
      if (error) throw new Error('No se pudo adquirir la tanda de catálogo; comprobar migraciones')
      return data as CatalogBatch | null
    },
    async save(batch, release) {
      const { data, error } = await client.rpc('instagram_save_catalog_batch', {
        p_date: batch.local_date, p_token: batch.lock_token, p_status: batch.status,
        p_slides: batch.slides, p_generated_at: batch.generated_at,
        p_generation_attempts: batch.generation_attempts, p_error: batch.last_error, p_release: release,
      })
      if (error || data !== true) throw new Error('No se pudo guardar la tanda o se perdió su bloqueo')
    },
    select: selectCatalogProducts, read: readCatalogProducts, render: renderCatalogJpeg,
    async upload(jpeg, date, position) {
      const path = `instagram-catalog/${date}/${randomUUID()}/${position}.jpg`
      const { error } = await client.storage.from('product-images').upload(path, jpeg, {
        contentType: 'image/jpeg', cacheControl: '86400', upsert: false,
      })
      if (error) throw new Error('No se pudo guardar la imagen del catálogo')
      const { data } = client.storage.from('product-images').getPublicUrl(path)
      const response = await fetch(data.publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(10_000), cache: 'no-store' })
      if (!response.ok) throw new Error('La imagen generada aún no está disponible públicamente')
      return data.publicUrl
    },
    meta,
    async record(slide) {
      const result = await recordConfirmedCatalogSheet({
        containerId: slide.containerId!, mediaId: slide.mediaId, productIds: slide.products.map(p => p.id),
      }, { metaClient: meta, repository: client })
      return result.publishedAt
    },
    now: () => new Date(), wait: () => new Promise(resolve => setTimeout(resolve, 1000)),
  }
}

/** Claims are fenced in SQL; every externally visible operation has a persisted
 * checkpoint. An uncertain send is reconciled, never blindly sent again. */
export async function runCatalogWorker(config: InstagramPublishingConfig, supplied?: CatalogWorkerDependencies) {
  if (!config.enabled) return { state: 'disabled' }
  const deps = supplied || productionDependencies(config)
  const claimed = await deps.claim()
  if (!claimed) return { state: 'idle' }
  const batch: CatalogBatch = claimed
  const deadline = deps.now().getTime() + 250_000
  const checkBudget = () => {
    if (deps.now().getTime() > deadline) throw new Error('Continuará en la siguiente ejecución del cron')
  }
  const save = (release = false) => deps.save(batch, release)
  async function finish(status: CatalogBatch['status'], error: string | null = null) {
    batch.status = status
    batch.last_error = error
    await save(true)
    return { state: status, localDate: batch.local_date }
  }
  async function image(products: CatalogProduct[], position: number) {
    checkBudget()
    return deps.upload(await deps.render(products, position), batch.local_date, position)
  }
  async function containerStatus(slide: CatalogSlide) {
    checkBudget()
    return (await deps.meta.getContainerStatus(slide.containerId!)).statusCode
  }
  async function confirm(slide: CatalogSlide) {
    const publishedAt = slide.kind === 'products' ? await deps.record(slide) : deps.now().toISOString()
    if (!publishedAt) throw new Error('Meta aún no confirmó la publicación de la lámina')
    slide.publishedAt = publishedAt
    await save()
  }

  try {
    // Reconcile persisted, possibly successful sends BEFORE any inventory edits.
    for (const slide of batch.slides) {
      if (!slide.attemptedAt || slide.publishedAt) continue
      const status = await containerStatus(slide)
      if (status === 'PUBLISHED') await confirm(slide)
      else if (status === 'ERROR' || status === 'EXPIRED') return finish('failed', 'Meta no confirmó un envío intentado. Revisar antes de reenviar.')
      else return finish('retry', 'Esperando confirmación de Meta; no se repetirá el envío.')
    }
    if (batch.slides.length && batch.slides.every(slide => slide.publishedAt)) return finish('published')
    // Late claims may only reconcile existing attempts, never generate/send an
    // old catalog. SQL allows a 24-hour reconciliation grace for lost responses.
    if (deps.now().getTime() > Date.parse(batch.scheduled_for) + 3_600_000) return finish('failed', 'Terminó la ventana de publicación.')

    if (!batch.generated_at) {
      if (batch.generation_attempts >= 4) return finish('failed', 'No se pudo generar la tanda tras cuatro intentos.')
      batch.status = 'generating'
      batch.generation_attempts++
      batch.last_error = null
      await save()
      const products = (await deps.select()).slice(0, 18)
      if (!products.length) return finish('skipped', 'No hay productos aprobados disponibles; no se enviará la intro.')
      batch.slides = []
      const groups = [[], products.slice(0, 9), ...(products.length > 9 ? [products.slice(9, 18)] : [])]
      for (const [position, selected] of groups.entries()) {
        batch.slides.push({ position, kind: position === 0 ? 'intro' : 'products', products: selected,
          imageUrl: await image(selected, position), containerId: null, mediaId: null, attemptedAt: null, publishedAt: null })
        await save()
      }
      batch.generated_at = deps.now().toISOString()
      batch.status = 'ready'
      await save()
    }
    if (deps.now().getTime() < Date.parse(batch.scheduled_for)) return finish('ready')
    if (deps.now().getTime() > Date.parse(batch.scheduled_for) + 3_600_000) return finish('failed', 'Terminó la ventana de publicación.')

    // Rebuild only unattempted product sheets that changed. Keep every other
    // sheet's IDs reserved, including already-published sheets, to avoid repeats.
    async function refreshSlides() {
      const active = new Map((await deps.read()).map(product => [product.id, product]))
      const used = new Set(batch.slides.flatMap(slide => slide.products.map(p => p.id)))
      let replacements: CatalogProduct[] | null = null
      for (const slide of batch.slides) {
        if (slide.kind === 'intro' || slide.attemptedAt) continue
        const current: CatalogProduct[] = []
        for (const old of slide.products) {
          const existing = active.get(old.id)
          if (existing) current.push(existing)
          else {
            replacements ??= await deps.select()
            const replacement = replacements.find(p => !used.has(p.id) && active.has(p.id))
            if (replacement) { current.push(active.get(replacement.id)!); used.add(replacement.id) }
          }
        }
        if (!current.length) throw new Error('No quedan productos para una lámina; tanda detenida sin enviar una imagen vacía.')
        if (JSON.stringify(current.map(catalogProductFingerprint)) === JSON.stringify(slide.products.map(catalogProductFingerprint))) continue
        slide.imageUrl = await image(current, slide.position)
        slide.products = current
        slide.containerId = null
        slide.mediaId = null
        batch.generated_at = deps.now().toISOString()
        await save()
      }
    }
    await refreshSlides()
    const remaining = batch.slides.filter(slide => !slide.publishedAt)
    const usage = await deps.meta.getPublishingLimit()
    if (usage + remaining.length > config.publishingQuota) throw new Error('Meta no tiene cupo para la tanda completa; se reintentará.')
    batch.status = 'publishing'
    batch.last_error = null
    await save()

    // All containers must be ready before the intro is sent.
    async function prepareContainers() {
      for (const slide of batch.slides) {
        if (slide.publishedAt) continue
        checkBudget()
        if (!slide.containerId) {
          slide.containerId = await deps.meta.createStoryContainer(slide.imageUrl)
          await save()
        }
        let status = await containerStatus(slide)
        for (let poll = 0; status === 'IN_PROGRESS' && poll < 8; poll++) {
          await deps.wait()
          status = await containerStatus(slide)
        }
        if (status === 'ERROR' || status === 'EXPIRED') {
          slide.containerId = null
          await save()
          throw new Error('Meta rechazó una imagen; se reintentará antes de continuar la tanda.')
        }
        if (status !== 'FINISHED') throw new Error('Meta aún está preparando las imágenes de la tanda.')
      }
    }
    await prepareContainers()
    for (const slide of batch.slides) {
      if (slide.publishedAt) continue
      checkBudget()
      // A listing may be sold while Meta processes the containers.
      await refreshSlides()
      await prepareContainers()
      if (deps.now().getTime() > Date.parse(batch.scheduled_for) + 3_600_000) throw new Error('Terminó la ventana de publicación.')
      slide.attemptedAt = deps.now().toISOString()
      await save() // MUST precede the POST, including timeouts/uncertain responses.
      slide.mediaId = await deps.meta.publishContainer(slide.containerId!)
      await save()
      let status = await containerStatus(slide)
      for (let poll = 0; status !== 'PUBLISHED' && poll < 8; poll++) {
        await deps.wait()
        status = await containerStatus(slide)
      }
      if (status !== 'PUBLISHED') throw new Error('Esperando confirmación de Meta; la siguiente lámina queda pendiente.')
      await confirm(slide)
    }
    return finish('published')
  } catch (error) {
    return finish(!batch.generated_at && batch.generation_attempts >= 4 ? 'failed' : 'retry', sanitizeCaptureError(error))
  }
}
