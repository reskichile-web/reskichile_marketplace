import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AttributeFieldsEditor from '@/components/AttributeFieldsEditor'
import { PRODUCT_ATTRIBUTES } from '@/lib/constants'
import { getBrandLogoUrl } from '@/lib/brand-logos'
import { getBrandSuggestions } from '@/lib/brand-suggestions'

describe('binding brand dropdowns', () => {
  it('deduplicates binding suggestions while preserving their order', () => {
    const suggestions = getBrandSuggestions('', 'fijaciones')

    expect(suggestions.slice(0, 3)).toEqual(['Marker', 'Look', 'Tyrolia'])
    expect(new Set(suggestions).size).toBe(suggestions.length)
    expect(suggestions.filter(brand => brand === 'Salomon')).toHaveLength(1)
    expect(suggestions.filter(brand => brand === 'Head')).toHaveLength(1)
  })

  it('uses the logo-enabled brand input for included bindings', () => {
    const html = renderToStaticMarkup(
      <AttributeFieldsEditor
        fields={PRODUCT_ATTRIBUTES.esquis}
        values={{ incluye_fijaciones: true, fijaciones_marca: 'Marker' }}
        onChange={() => {}}
      />,
    )

    expect(getBrandLogoUrl('Marker')).toBe('/brand-logos/marker.png')
    expect(html).toContain('Marca de las fijaciones')
    expect(html).toContain('src="/brand-logos/marker.png"')
  })

  it.each([
    ['Blizzard', 'blizzard'],
    ['Stockli', 'stockli'],
    ['Majesty', 'majesty'],
    ['Kastle', 'kastle'],
    ['Fritschi', 'fritschi'],
    ['Elan', 'elan'],
    ['PeakPerformance', 'peak-performance'],
    ['Flylow', 'flylow'],
  ])('resolves the curated %s logo', (brand, slug) => {
    expect(getBrandLogoUrl(brand)).toBe(`/brand-logos/${slug}.png`)
  })

  it('suggests the newly curated product brands in their categories', () => {
    expect(getBrandSuggestions('', 'esquis')).toContain('Majesty')
    expect(getBrandSuggestions('', 'parkas')).toContain('Flylow')
  })

  it('uses the square Oakley avatar with its wordmark', () => {
    expect(getBrandLogoUrl('Oakley')).toBe('/brand-logos/oakley.png')
  })

  it('resolves the Dragon logo', () => {
    expect(getBrandLogoUrl('Dragon')).toBe('/brand-logos/dragon.png')
  })
})
