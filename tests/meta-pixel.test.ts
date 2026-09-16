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

    const storage = new Map<string, string>()
    vi.stubGlobal('window', {
      location: { pathname: '/producto/producto-de-prueba' },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
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

  it('sends Contact only with consent and deduplicates each contact channel', async () => {
    const { loadMetaPixel, trackMetaContact, trackMetaPageView } = await import('@/lib/meta-pixel')
    const product = {
      contentId: 'product-123',
      contentName: 'K2 Reckoner 102',
      category: 'Esquís',
      value: 329990,
    }

    trackMetaContact(product)
    expect(metaQueue()).toEqual([])

    loadMetaPixel()
    trackMetaPageView('/producto/producto-de-prueba')
    trackMetaContact(product)
    trackMetaContact(product)
    trackMetaContact(product, 'internal_chat')
    trackMetaContact(product, 'internal_chat')

    expect(metaQueue().filter((entry) => entry[1] === 'Contact')).toEqual([
      [
        'track',
        'Contact',
        {
          content_ids: ['product-123'],
          content_name: 'K2 Reckoner 102',
          content_category: 'Esquís',
          content_type: 'product',
          value: 329990,
          currency: 'CLP',
          contact_method: 'whatsapp',
        },
      ],
      [
        'track',
        'Contact',
        {
          content_ids: ['product-123'],
          content_name: 'K2 Reckoner 102',
          content_category: 'Esquís',
          content_type: 'product',
          value: 329990,
          currency: 'CLP',
          contact_method: 'internal_chat',
        },
      ],
    ])
  })

  it('queues rack commerce events until consent and PageView are ready', async () => {
    const {
      loadMetaPixel,
      trackMetaAddToCart,
      trackMetaInitiateCheckout,
      trackMetaPageView,
    } = await import('@/lib/meta-pixel')
    const item = {
      contentId: 'ski-rack:madera',
      contentName: 'Ski Rack Madera · Talla M',
      category: 'ski_rack',
      value: 15990,
      quantity: 1,
    }

    trackMetaAddToCart({ items: [item], value: 15990 })
    trackMetaInitiateCheckout({ items: [item], value: 15990 })
    expect(metaQueue()).toEqual([])

    loadMetaPixel()
    trackMetaPageView('/producto/producto-de-prueba')

    expect(metaQueue().filter((entry) => ['AddToCart', 'InitiateCheckout'].includes(String(entry[1])))).toEqual([
      [
        'track',
        'AddToCart',
        {
          content_ids: ['ski-rack:madera'],
          content_name: 'Ski Rack Madera · Talla M',
          content_category: 'ski_rack',
          content_type: 'product',
          contents: [{ id: 'ski-rack:madera', quantity: 1, item_price: 15990 }],
          num_items: 1,
          value: 15990,
          currency: 'CLP',
        },
      ],
      [
        'track',
        'InitiateCheckout',
        {
          content_ids: ['ski-rack:madera'],
          content_name: 'Ski Rack Madera · Talla M',
          content_category: 'ski_rack',
          content_type: 'product',
          contents: [{ id: 'ski-rack:madera', quantity: 1, item_price: 15990 }],
          num_items: 1,
          value: 15990,
          currency: 'CLP',
        },
      ],
    ])
  })

  it('sends one Purchase for an authorized order and persists its deduplication key', async () => {
    const {
      loadMetaPixel,
      trackMetaPageView,
      trackMetaPurchase,
    } = await import('@/lib/meta-pixel')
    const browserWindow = globalThis.window as unknown as MetaWindow & {
      location: { pathname: string }
    }
    browserWindow.location.pathname = '/checkout/resultado'

    loadMetaPixel()
    trackMetaPageView('/checkout/resultado')
    const purchase = {
      orderId: '10000000-0000-4000-8000-000000000001',
      value: 19480,
      items: [{
        contentId: 'ski-rack:madera',
        contentName: 'Ski Rack Madera · Talla M',
        category: 'ski_rack',
        value: 15990,
        quantity: 1,
      }],
    }

    trackMetaPurchase(purchase)
    vi.advanceTimersByTime(2000)
    trackMetaPurchase(purchase)

    expect(metaQueue().filter((entry) => entry[1] === 'Purchase')).toEqual([
      [
        'track',
        'Purchase',
        {
          content_ids: ['ski-rack:madera'],
          content_name: 'Ski Rack Madera · Talla M',
          content_category: 'ski_rack',
          content_type: 'product',
          contents: [{ id: 'ski-rack:madera', quantity: 1, item_price: 15990 }],
          num_items: 1,
          value: 19480,
          currency: 'CLP',
        },
        { eventID: 'purchase:10000000-0000-4000-8000-000000000001' },
      ],
    ])
  })
})
