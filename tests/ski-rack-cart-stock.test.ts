import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addSkiRackCartItem, reconcileSkiRackCart, remainingRackCartQuantity, setSkiRackCartQuantity,
} from '@/lib/ski-rack-cart'
import { fetchRackInventory, type RackInventoryBySlug } from '@/lib/rack-inventory'

const mocks = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('@/lib/track', () => ({ track: mocks.track }))

const key = 'reskichile:ski-rack-cart'
let storage: Map<string, string>
const read = () => JSON.parse(storage.get(key) ?? '[]')

const inventory: RackInventoryBySlug = {
  madera: {
    slug: 'madera', name: 'Ski Rack Madera', material: 'Madera', priceClp: 15990, active: true,
    variants: [{ inventoryId: '', size: 'M', originCode: null, stockOnHand: 5, reservedQuantity: 0, availableQuantity: 5 }],
  },
  filamento: {
    slug: 'filamento', name: 'Ski Rack Filamento', material: 'Filamento', priceClp: 7990, active: true,
    variants: [{ inventoryId: '', size: 'M', originCode: null, stockOnHand: 1, reservedQuantity: 0, availableQuantity: 1 }],
  },
}

beforeEach(() => {
  storage = new Map()
  mocks.track.mockClear()
  const browser = Object.assign(new EventTarget(), {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, value: string) => storage.set(k, value),
    },
  })
  vi.stubGlobal('window', browser)
})
afterEach(() => vi.unstubAllGlobals())

describe('Rack stock at cart mutation', () => {
  it('never turns repeated additions into more than the one available unit', () => {
    const results = Array.from({ length: 5 }, () => addSkiRackCartItem('filamento', 'M', 1, 1))
    expect(results).toEqual([1, 0, 0, 0, 0])
    expect(read()).toEqual([{ slug: 'filamento', size: 'M', quantity: 1 }])
    expect(mocks.track).toHaveBeenCalledTimes(1)
  })

  it('adds only the remaining stock and reports the actual amount for analytics', () => {
    expect(addSkiRackCartItem('madera', 'M', 3, 5)).toBe(3)
    expect(addSkiRackCartItem('madera', 'M', 3, 5)).toBe(2)
    expect(read()[0].quantity).toBe(5)
    expect(mocks.track).toHaveBeenLastCalledWith(expect.objectContaining({
      category: 'slug=madera;size=M;qty=2;cartQty=5',
    }))
  })

  it('rejects zero stock, unknown products, invalid sizes and unknown availability', () => {
    for (const available of [0, -1, NaN, Infinity, undefined as never]) {
      expect(addSkiRackCartItem('madera', 'M', 1, available)).toBe(0)
    }
    expect(addSkiRackCartItem('missing', 'M', 1, 5)).toBe(0)
    expect(addSkiRackCartItem('madera', 'XL' as never, 1, 5)).toBe(0)
    expect(addSkiRackCartItem('madera', 'M', -1, 5)).toBe(0)
    expect(read()).toEqual([])
  })

  it('counts duplicate persisted lines together and still respects the limit', () => {
    storage.set(key, JSON.stringify([
      { slug: 'madera', size: 'M', quantity: 2 }, { slug: 'madera', size: 'M', quantity: 2 },
    ]))
    expect(addSkiRackCartItem('madera', 'M', 3, 5)).toBe(1)
    expect(read()).toEqual([{ slug: 'madera', size: 'M', quantity: 5 }])
  })

  it('keeps the ten-unit order limit even when more stock exists', () => {
    expect(addSkiRackCartItem('madera', 'M', 8, 50)).toBe(8)
    expect(addSkiRackCartItem('madera', 'M', 8, 50)).toBe(2)
    expect(read()[0].quantity).toBe(10)
  })

  it('protects quantity changes in both cart interfaces', () => {
    addSkiRackCartItem('madera', 'M', 2, 5)
    setSkiRackCartQuantity('madera', 'M', 9, 5)
    expect(read()[0].quantity).toBe(5)
    setSkiRackCartQuantity('madera', 'M', 2, 5)
    expect(read()[0].quantity).toBe(2)
    setSkiRackCartQuantity('madera', 'M', 4, NaN)
    expect(read()[0].quantity).toBe(2)
  })

  it('subtracts what is already in the cart from the product quantity picker', () => {
    expect(remainingRackCartQuantity([{ slug: 'madera', size: 'M', quantity: 4 }], 'madera', 'M', 5)).toBe(1)
    expect(remainingRackCartQuantity([{ slug: 'filamento', size: 'M', quantity: 1 }], 'filamento', 'M', 1)).toBe(0)
  })
})

describe('Repair existing carts', () => {
  it('reduces excess stock and removes sold-out items while retaining valid purchases', () => {
    storage.set(key, JSON.stringify([
      { slug: 'madera', size: 'M', quantity: 2 },
      { slug: 'filamento', size: 'M', quantity: 4 },
      { slug: 'madera', size: 'L', quantity: 1 },
    ]))
    expect(reconcileSkiRackCart(inventory)).toEqual([
      { slug: 'filamento', size: 'M', previousQuantity: 4, quantity: 1 },
      { slug: 'madera', size: 'L', previousQuantity: 1, quantity: 0 },
    ])
    expect(read()).toEqual([
      { slug: 'madera', size: 'M', quantity: 2 }, { slug: 'filamento', size: 'M', quantity: 1 },
    ])
    expect(reconcileSkiRackCart(inventory)).toEqual([])
  })

  it('does not keep inventory from an inactive product', () => {
    addSkiRackCartItem('madera', 'M', 1, 5)
    reconcileSkiRackCart({ madera: { ...inventory.madera, active: false } })
    expect(read()).toEqual([])
  })

  it('fails stock reads without erasing the saved cart or treating errors as sold out', async () => {
    addSkiRackCartItem('madera', 'M', 2, 5)
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchRackInventory()).rejects.toThrow()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    await expect(fetchRackInventory()).rejects.toThrow()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ products: [{ ...inventory.madera, variants: [{ availableQuantity: '5' }] }] }) })
    await expect(fetchRackInventory()).rejects.toThrow()
    expect(read()).toEqual([{ slug: 'madera', size: 'M', quantity: 2 }])
  })

  it('fetches current availability without reusing a cached response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ products: Object.values(inventory) }) })
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchRackInventory()).toEqual(inventory)
    expect(fetchMock).toHaveBeenCalledWith('/api/racks/inventory', { cache: 'no-store', credentials: 'same-origin' })
  })
})
