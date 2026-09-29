import { isValidElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), trackMetaAddToCart: vi.fn() }))

// Exercise the actual button handler without mounting a browser or sending
// analytics. Refs persist within each rendered element, including rapid taps.
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => [initial, vi.fn()],
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {},
}))
vi.mock('@/lib/track', () => ({ track: vi.fn() }))
vi.mock('@/lib/meta-pixel', () => ({
  trackMetaAddToCart: mocks.trackMetaAddToCart,
  trackMetaViewContent: vi.fn(),
}))
vi.mock('@/lib/ski-rack-cart', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/ski-rack-cart')>(),
  useSkiRackCart: () => ({ items: [], ready: true }),
}))
vi.mock('@/lib/use-rack-inventory', () => ({
  useRackInventory: () => ({
    inventory: {
      filamento: { active: true, priceClp: 7990, variants: [{ size: 'S', availableQuantity: 1 }] },
    },
    loading: false, error: false, refresh: mocks.refresh,
  }),
}))

import SkiRackProductDetail from '@/components/SkiRackProductDetail'
import { getSkiRackProduct } from '@/lib/ski-rack-products'

let storage: Map<string, string>
let opened: number
const key = 'reskichile:ski-rack-cart'
const latest = (availableQuantity: number) => ({
  filamento: { active: true, priceClp: 7990, variants: [{ size: 'S', availableQuantity }] },
})

function findAdd(node: ReactNode): (() => Promise<void>) | undefined {
  if (Array.isArray(node)) {
    for (const child of node) { const result = findAdd(child); if (result) return result }
  } else if (isValidElement<{ children?: ReactNode; onClick?: () => Promise<void> }>(node)) {
    if (node.type === 'button' && node.props.children === 'Agregar al carrito') return node.props.onClick
    return findAdd(node.props.children)
  }
}

function button() {
  const handler = findAdd(SkiRackProductDetail({ product: getSkiRackProduct('filamento')! }))
  expect(handler).toBeTypeOf('function')
  return handler!
}

beforeEach(() => {
  vi.clearAllMocks()
  storage = new Map()
  opened = 0
  const browser = Object.assign(new EventTarget(), {
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) },
  })
  browser.addEventListener('reskichile:ski-rack-cart-open', () => { opened += 1 })
  vi.stubGlobal('window', browser)
  mocks.refresh.mockResolvedValue(latest(1))
})
afterEach(() => vi.unstubAllGlobals())

describe('Product add button', () => {
  it('refreshes stock, adds one unit and opens the cart immediately', async () => {
    await button()()
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(JSON.parse(storage.get(key)!)).toEqual([{ slug: 'filamento', size: 'S', quantity: 1 }])
    expect(opened).toBe(1)
    expect(mocks.trackMetaAddToCart).toHaveBeenCalledWith(expect.objectContaining({ value: 7990 }))
  })

  it('prevents a double tap from submitting twice while stock is loading', async () => {
    let resolve!: (value: ReturnType<typeof latest>) => void
    mocks.refresh.mockReturnValue(new Promise(done => { resolve = done }))
    const click = button()
    const first = click()
    await click()
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(storage.get(key)).toBeUndefined()
    resolve(latest(1))
    await first
    expect(JSON.parse(storage.get(key)!)[0].quantity).toBe(1)
  })

  it('does not add or report a conversion when the latest stock is zero', async () => {
    mocks.refresh.mockResolvedValue(latest(0))
    await button()()
    expect(storage.get(key)).toBeUndefined()
    expect(mocks.trackMetaAddToCart).not.toHaveBeenCalled()
    expect(opened).toBe(0)
  })

  it('does not add when stock cannot be confirmed', async () => {
    mocks.refresh.mockResolvedValue(null)
    await button()()
    expect(storage.get(key)).toBeUndefined()
    expect(mocks.trackMetaAddToCart).not.toHaveBeenCalled()
  })

  it('includes items added since the button was rendered', async () => {
    const click = button()
    storage.set(key, JSON.stringify([{ slug: 'filamento', size: 'S', quantity: 1 }]))
    await click()
    expect(JSON.parse(storage.get(key)!)[0].quantity).toBe(1)
    expect(mocks.trackMetaAddToCart).not.toHaveBeenCalled()
  })
})
