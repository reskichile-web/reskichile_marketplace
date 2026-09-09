import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CatalogBatchPreview, CatalogBatchState, CatalogBatchDetails } from '@/components/admin/InstagramCatalogBatch'
import type { InstagramAdminCatalogBatch } from '@/lib/instagram/catalog-contracts'

const ready: InstagramAdminCatalogBatch = {
  localDate: '2026-09-11', scheduledFor: '2026-09-11T23:00:00Z', prepareAt: '2026-09-11T22:00:00Z',
  generatedAt: '2026-09-11T22:01:00Z', status: 'ready', generationAttempts: 1, lastError: null,
  slides: [{ position: 0, kind: 'intro', imageUrl: 'https://storage.test/intro.jpg', publishedAt: null },
    { position: 1, kind: 'products', imageUrl: 'https://storage.test/products.jpg', publishedAt: null }],
}
describe('Admin catalog generation visibility', () => {
  it.each([
    ['ready', 'Generada correctamente'], ['generating', 'Generando'], ['published', 'Publicada'],
    ['publishing', 'Publicando'], ['failed', 'Error de publicación'], ['skipped', 'Sin productos'],
  ] as const)('shows %s as %s', (status, label) => {
    expect(renderToStaticMarkup(<CatalogBatchState batch={{ ...ready, status }} available enabled overdue />)).toContain(label)
  })
  it('distinguishes a generation error from a send error', () => {
    expect(renderToStaticMarkup(<CatalogBatchState batch={{ ...ready, generatedAt: null, status: 'retry' }} available enabled overdue />)).toContain('Error de generación')
  })
  it('shows missing cron runs instead of pretending they succeeded', () => {
    expect(renderToStaticMarkup(<CatalogBatchState available enabled overdue />)).toContain('No generada')
    expect(renderToStaticMarkup(<CatalogBatchState available enabled overdue={false} />)).toContain('Pendiente de generación')
  })
  it('distinguishes disabled automation and unapplied migrations', () => {
    expect(renderToStaticMarkup(<CatalogBatchState available enabled={false} overdue />)).toContain('Automatización desactivada')
    expect(renderToStaticMarkup(<CatalogBatchState available={false} enabled overdue />)).toContain('Falta activar base de datos')
  })
  it('links real generated images and shows the generation time', () => {
    const html = renderToStaticMarkup(<><CatalogBatchPreview batch={ready} /><CatalogBatchState batch={ready} available enabled overdue /><CatalogBatchDetails batch={ready} time="20:00" /></>)
    expect(html).toContain('Ver intro del catálogo')
    expect(html).toContain('Ver lámina 1 del catálogo')
    expect(html).toContain('https://storage.test/products.jpg')
    expect(html).toContain('19:01')
    expect(html).toContain('Generación 19:00')
    expect(html).toContain('0/2 historias publicadas')
  })
})
