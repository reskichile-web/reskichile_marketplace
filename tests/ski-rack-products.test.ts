import { describe, expect, it } from 'vitest'
import {
  SKI_RACK_SIZES,
  getSkiRackGalleryForSize,
  getSkiRackProduct,
  getSkiRackSizeImage,
} from '@/lib/ski-rack-products'

describe('ski rack product images', () => {
  it.each([
    ['madera', 'S', '/images/reski-rack-product.png'],
    ['madera', 'M', '/images/ski-rack-madera-m.jpg'],
    ['madera', 'L', '/images/ski-rack-madera-l.jpg'],
    ['filamento', 'S', '/images/reski-rack-filament.png'],
    ['filamento', 'M', '/images/ski-rack-filamento-m.jpg'],
    ['filamento', 'L', '/images/ski-rack-filamento-l.jpg'],
  ] as const)('maps %s size %s to its product image', (slug, size, expectedUrl) => {
    const product = getSkiRackProduct(slug)

    expect(product).toBeDefined()
    expect(getSkiRackSizeImage(product!, size).url).toBe(expectedUrl)
    expect(getSkiRackGalleryForSize(product!, size)[0].url).toBe(expectedUrl)
  })

  it('shares the two detail photos between all wood sizes', () => {
    const product = getSkiRackProduct('madera')
    expect(product).toBeDefined()

    for (const size of SKI_RACK_SIZES) {
      const urls = getSkiRackGalleryForSize(product!, size).map(image => image.url)
      expect(urls).toContain('/images/ski-rack-madera-common-1.jpg')
      expect(urls).toContain('/images/ski-rack-madera-common-2.jpg')
      expect(urls).not.toContain('/images/ski-rack-main.jpg')
      expect(urls).not.toContain('/images/ski-rack-installed-backpack.jpg')
      expect(urls).not.toContain('/images/ski-rack-installed-room.jpg')
    }
  })

  it('shows only the selected size photo for filament racks', () => {
    const product = getSkiRackProduct('filamento')
    expect(product).toBeDefined()

    for (const size of SKI_RACK_SIZES) {
      expect(getSkiRackGalleryForSize(product!, size)).toEqual([
        getSkiRackSizeImage(product!, size),
      ])
    }
  })
})
