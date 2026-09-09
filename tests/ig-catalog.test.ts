import { describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { fetchProducts, orderProducts, prepareProductImage, productCopy, escapeHtml } from '../scripts/lib/ig-catalog.mjs'

describe('Instagram catalog export', () => {
  it('reads only approved products without private seller fields', async () => {
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.order.mockReturnValue(query)
    query.range.mockResolvedValue({ data: [], error: null })
    await fetchProducts({ from: vi.fn(() => query) })
    expect(query.eq).toHaveBeenCalledWith('status', 'approved')
    expect(query.range).toHaveBeenCalledWith(0, 499)
    expect(query.select.mock.calls[0][0]).not.toMatch(/seller|contact|phone|users/)
  })

  it('mixes the full catalog without losing or duplicating items when categories run out', () => {
    const products = Array.from({ length: 31 }, (_, i) => ({
      id: String(i), status: 'approved', product_type: i < 18 ? 'esquis' : i < 20 ? 'snowboards' : 'cascos',
    }))
    products.push({ id: 'sold', status: 'sold', product_type: 'esquis' })
    products.push({ id: 'paused', status: 'draft', product_type: 'esquis' })
    const ordered = orderProducts(products)
    expect(ordered.slice(0, 5).map(p => p.id)).toEqual(['0', '1', '2', '18', '19'])
    expect(ordered).toHaveLength(31)
    expect(new Set(ordered.map(p => p.id)).size).toBe(31)
    expect(ordered.some(p => p.status !== 'approved')).toBe(false)
    expect(orderProducts(products, 'recent').map(p => p.id)).toEqual(products.slice(0, 31).map(p => p.id))
  })

  it('reflects new prices and uses the region when the commune is missing', () => {
    const product = { brand: 'K2', model: 'Reckoner', product_type: 'esquis', condition: 'usado_como_nuevo',
      price: 500000, region: 'Ñuble', comuna: '', attributes: { largo_cm: 170, ancho_mm: 102 } }
    expect(productCopy(product)).toMatchObject({ price: '$500.000', location: 'Ñuble', detail: '170 cm · 102 mm · Como nuevo' })
    expect(productCopy({ ...product, price: 420000 }).price).toBe('$420.000')
    expect(productCopy({ ...product, region: 'Por confirmar' }).location).toBe('Ubicación por confirmar')
  })

  it('removes studio margins but preserves enclosed white parts of the real product', async () => {
    const source = Buffer.from('<svg width="100" height="100"><rect width="100" height="100" fill="white"/><rect x="25" y="25" width="50" height="50" fill="black"/><rect x="30" y="30" width="40" height="40" fill="white"/></svg>')
    const { png } = await prepareProductImage(await sharp(source).png().toBuffer())
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
    expect(info.width).toBeLessThan(100)
    expect(info.channels).toBe(4)
    expect(data[3]).toBe(0)
    const center = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4
    expect([...data.subarray(center, center + 4)]).toEqual([255, 255, 255, 255])
  })

  it('fails on an empty image and escapes product text in the standalone HTML', async () => {
    const blank = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'white' } }).png().toBuffer()
    await expect(prepareProductImage(blank)).rejects.toThrow('vacía')
    expect(escapeHtml('<img src="x"> &')).toBe('&lt;img src=&quot;x&quot;&gt; &amp;')
  })
})
