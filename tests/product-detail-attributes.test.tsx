import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProductGallery from '@/components/ProductGallery'
import {
  orderMainProductAttributes,
  shouldDisplayMainAttribute,
} from '@/components/ProductDetailClient'
import { PRODUCT_ATTRIBUTES } from '@/lib/constants'

describe('product detail attributes', () => {
  const skiBootFields = PRODUCT_ATTRIBUTES.botas_esqui

  it('places BOA beside pins and moves gender to the following row', () => {
    const keys = orderMainProductAttributes('botas_esqui', skiBootFields).map(field => field.key)

    expect(keys.slice(0, 5)).toEqual([
      'talla_mondo',
      'flex',
      'boa',
      'incluye_pines',
      'genero',
    ])
  })

  it('shows BOA only when its value is true', () => {
    const boa = skiBootFields.find(field => field.key === 'boa')!

    expect(shouldDisplayMainAttribute(boa, true)).toBe(true)
    expect(shouldDisplayMainAttribute(boa, false)).toBe(false)
    expect(shouldDisplayMainAttribute(boa, undefined)).toBe(false)
  })

  it('hides the telescopic-poles attribute when its value is false', () => {
    const telescopic = PRODUCT_ATTRIBUTES.bastones.find(field => field.key === 'telescopicos')!

    expect(shouldDisplayMainAttribute(telescopic, true)).toBe(true)
    expect(shouldDisplayMainAttribute(telescopic, false)).toBe(false)
    expect(shouldDisplayMainAttribute(telescopic, undefined)).toBe(false)
  })

  it('renders product thumbnails without the metered Next image optimizer', () => {
    const url = 'https://storage.example/product.jpg'
    const html = renderToStaticMarkup(
      <ProductGallery images={[{ url, order: 0 }]} title="Producto" />,
    )

    expect(html).toContain(url)
    expect(html).not.toContain('/_next/image')
  })
})
