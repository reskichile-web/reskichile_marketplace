import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MetaWindow {
  fbq?: { queue: unknown[][] }
  location: { pathname: string }
}

function metaQueue(): unknown[][] {
  return (globalThis.window as unknown as MetaWindow).fbq?.queue ?? []
}

describe('Meta Pixel product events', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T15:00:00Z'))

    vi.stubGlobal('window', {
      location: { pathname: '/producto/producto-de-prueba' },
    })
    vi.stubGlobal('document', {
      cookie: '',
      getElementById: vi.fn(() => null),
      createElement: vi.fn(() => ({})),
      head: { appendChild: vi.fn() },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('waits for consent and sends PageView before one ViewContent', async () => {
    const {
      loadMetaPixel,
      trackMetaPageView,
      trackMetaViewContent,
    } = await import('@/lib/meta-pixel')

    const product = {
      contentId: 'product-123',
      contentName: 'K2 Reckoner 102',
      category: 'Esquís',
      value: 329990,
    }

    trackMetaViewContent(product)
    expect(metaQueue()).toEqual([])

    loadMetaPixel()
    trackMetaPageView('/producto/producto-de-prueba')
    trackMetaViewContent(product)

    const trackedEvents = metaQueue().filter((entry) => entry[0] === 'track')
    expect(trackedEvents).toEqual([
      ['track', 'PageView'],
      [
        'track',
        'ViewContent',
        {
          content_ids: ['product-123'],
          content_name: 'K2 Reckoner 102',
          content_category: 'Esquís',
          content_type: 'product',
          value: 329990,
          currency: 'CLP',
        },
      ],
    ])
  })

  it('does not flush a product event on a different page', async () => {
    const {
      loadMetaPixel,
      trackMetaPageView,
      trackMetaViewContent,
    } = await import('@/lib/meta-pixel')

    trackMetaViewContent({
      contentId: 'product-123',
      contentName: 'K2 Reckoner 102',
      category: 'Esquís',
      value: 329990,
    })

    loadMetaPixel()
    trackMetaPageView('/')

    expect(metaQueue().filter((entry) => entry[1] === 'ViewContent')).toEqual([])
  })
})
