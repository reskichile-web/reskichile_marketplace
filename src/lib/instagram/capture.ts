import 'server-only'

import { existsSync } from 'node:fs'
import chromium from '@sparticuz/chromium'
import puppeteer, { type Browser } from 'puppeteer-core'
import sharp from 'sharp'
import { getAppUrl } from '@/lib/env/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  INSTAGRAM_STORY_FORMAT,
  INSTAGRAM_STORY_HEIGHT,
  INSTAGRAM_STORY_WIDTH,
  type InstagramStoryCaptureResult,
  type InstagramStoryCaptureStatus,
} from './contracts'

const STORAGE_BUCKET = 'product-images'
const RENDER_TIMEOUT_MS = 45_000
const PUBLIC_URL_TIMEOUT_MS = 10_000
const LOCAL_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

interface CaptureRow {
  id: string
  status: InstagramStoryCaptureStatus
  jpeg_public_url: string | null
  updated_at: string
}

export interface GenerateStoryCaptureInput {
  captureId: string
  productId: string
  slug: string
  storagePath: string
  replaceExisting?: boolean
}

function resultFromRow(row: CaptureRow, error?: string): InstagramStoryCaptureResult {
  return {
    id: row.id,
    status: row.status,
    jpegPublicUrl: row.jpeg_public_url,
    updatedAt: row.updated_at,
    width: INSTAGRAM_STORY_WIDTH,
    height: INSTAGRAM_STORY_HEIGHT,
    format: INSTAGRAM_STORY_FORMAT,
    ...(error ? { error } : {}),
  }
}

export function captureResultFromDatabaseRow(row: CaptureRow): InstagramStoryCaptureResult {
  return resultFromRow(row)
}

export function sanitizeCaptureError(error: unknown): string {
  const fallback = 'No pudimos generar la Story'
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : fallback
  if (/[@/]sparticuz[/]|chromium|brotli files?/i.test(raw)) {
    return 'No pudimos iniciar el motor de render de la Story'
  }
  return raw
    .replace(/authorization\s*:\s*bearer\s+[^\s,;]+/gi, 'Authorization: Bearer [redacted]')
    .replace(/((?:access_token|token)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/https?:\/\/[^\s]+/gi, '[url]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500) || fallback
}

async function launchBrowser(): Promise<Browser> {
  const localExecutable = LOCAL_CHROME_PATHS.find(existsSync)
  const executablePath = localExecutable || await chromium.executablePath()
  const headless = localExecutable ? true : 'shell'
  const args = localExecutable
    ? puppeteer.defaultArgs({ headless: true })
    : puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' })

  return puppeteer.launch({
    args,
    defaultViewport: {
      width: INSTAGRAM_STORY_WIDTH,
      height: INSTAGRAM_STORY_HEIGHT,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: false,
    },
    executablePath,
    headless,
  })
}

export async function renderStoryJpeg(slug: string): Promise<Buffer> {
  let browser: Browser | null = null
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    page.setDefaultNavigationTimeout(RENDER_TIMEOUT_MS)
    page.setDefaultTimeout(RENDER_TIMEOUT_MS)

    const storyUrl = new URL(`/ig-post/${encodeURIComponent(slug)}`, getAppUrl())
    const response = await page.goto(storyUrl.toString(), { waitUntil: 'networkidle0' })
    if (!response?.ok()) {
      throw new Error(`La plantilla respondió HTTP ${response?.status() ?? 'desconocido'}`)
    }

    await page.waitForSelector('[data-testid="ig-product-post"] canvas[data-artwork-ready="true"]')
    await page.waitForSelector('[data-testid="ig-product-post"] canvas[data-rider-ready="true"]')
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
    })

    const png = Buffer.from(await page.screenshot({
      type: 'png',
      captureBeyondViewport: false,
      clip: {
        x: 0,
        y: 0,
        width: INSTAGRAM_STORY_WIDTH,
        height: INSTAGRAM_STORY_HEIGHT,
      },
    }))

    const jpeg = await sharp(png)
      .resize(INSTAGRAM_STORY_WIDTH, INSTAGRAM_STORY_HEIGHT, { fit: 'fill' })
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb')
      .withIccProfile('srgb')
      .jpeg({ quality: 91, chromaSubsampling: '4:4:4', mozjpeg: true })
      .toBuffer()

    const metadata = await sharp(jpeg).metadata()
    if (
      metadata.width !== INSTAGRAM_STORY_WIDTH ||
      metadata.height !== INSTAGRAM_STORY_HEIGHT ||
      metadata.format !== 'jpeg' ||
      metadata.space !== 'srgb'
    ) {
      throw new Error('El JPEG generado no cumple 1080×1920 sRGB')
    }

    return jpeg
  } finally {
    await browser?.close()
  }
}

async function verifyPublicJpeg(publicUrl: string): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PUBLIC_URL_TIMEOUT_MS)
  try {
    const response = await fetch(publicUrl, {
      method: 'HEAD',
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    })
    const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim()
    if (response.status !== 200 || contentType !== 'image/jpeg') {
      throw new Error(`El JPEG público respondió HTTP ${response.status} (${contentType || 'sin Content-Type'})`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function generateAndStoreStoryCapture(
  input: GenerateStoryCaptureInput,
): Promise<InstagramStoryCaptureResult> {
  const service = createServiceRoleClient()

  try {
    const jpeg = await renderStoryJpeg(input.slug)
    const storage = service.storage.from(STORAGE_BUCKET)

    if (input.replaceExisting) {
      const { error: removeError } = await storage.remove([input.storagePath])
      if (removeError) {
        throw new Error(`No se pudo eliminar el JPEG anterior: ${removeError.message}`)
      }
    }

    const { error: uploadError } = await storage
      .upload(input.storagePath, jpeg, {
        cacheControl: '0',
        contentType: 'image/jpeg',
        upsert: !input.replaceExisting,
      })
    if (uploadError) throw new Error(`No se pudo guardar el JPEG: ${uploadError.message}`)

    const { data: publicData } = storage.getPublicUrl(input.storagePath)
    const publicUrl = publicData.publicUrl
    await verifyPublicJpeg(publicUrl)

    const now = new Date().toISOString()
    const { data: row, error: updateError } = await service
      .from('instagram_story_captures')
      .update({
        status: 'ready',
        jpeg_public_url: publicUrl,
        generated_at: now,
        last_error: null,
      })
      .eq('id', input.captureId)
      .eq('product_id', input.productId)
      .eq('status', 'generating')
      .select('id, status, jpeg_public_url, updated_at')
      .maybeSingle()

    if (updateError || !row) {
      await storage.remove([input.storagePath])
      throw new Error(updateError?.message || 'La captura dejó de estar disponible')
    }

    return resultFromRow(row as CaptureRow)
  } catch (error) {
    const sanitized = sanitizeCaptureError(error)
    const { data: failedRow } = await service
      .from('instagram_story_captures')
      .update({ status: 'failed', last_error: sanitized, generated_at: null })
      .eq('id', input.captureId)
      .eq('product_id', input.productId)
      .eq('status', 'generating')
      .select('id, status, jpeg_public_url, updated_at')
      .maybeSingle()

    if (failedRow) return resultFromRow(failedRow as CaptureRow, sanitized)

    return {
      id: input.captureId,
      status: 'failed',
      jpegPublicUrl: null,
      updatedAt: new Date().toISOString(),
      width: INSTAGRAM_STORY_WIDTH,
      height: INSTAGRAM_STORY_HEIGHT,
      format: INSTAGRAM_STORY_FORMAT,
      error: sanitized,
    }
  }
}
