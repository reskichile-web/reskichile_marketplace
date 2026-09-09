import { describe, expect, it } from 'vitest'
import { renderCatalogIntroHtml, CATALOG_INTRO_COPY } from '../scripts/lib/ig-catalog-intro.mjs'

describe('Minimal catalog intro', () => {
  it('uses the catalog palette and three-line copy without header or footer', () => {
    const html = renderCatalogIntroHtml({ logo: 'data:image/svg+xml;base64,logo', font: 'data:font/woff2;base64,font' })
    for (const line of CATALOG_INTRO_COPY) expect(html).toContain(line)
    expect(html).toContain('#fafbfc')
    expect(html).toContain('#2674bf')
    expect(html).toContain('width:1080px;height:1920px')
    expect(html).not.toMatch(/<header|<footer|reskichile\.cl|novedades|recién llegados/i)
    expect(html).not.toContain('<script')
  })
  it('uses Regular Montserrat for both opening lines and Bold for the blue ending', () => {
    const html = renderCatalogIntroHtml({ logo: 'logo', font: 'font' })
    expect(html).toContain('font-family:Montserrat')
    expect(html).toContain('font-weight:100 900')
    for (const weight of [400, 700]) expect(html).toContain(`font-weight:${weight}`)
    expect(html).not.toContain('font-weight:600')
    expect(html).toContain('font-synthesis:none')
  })
  it('places one small arrow away from the central composition', () => {
    const html = renderCatalogIntroHtml({ logo: 'logo', font: 'font' })
    expect(html).toContain('</div><svg class="next-arrow"')
    expect(html).toContain('top:1570px;width:52px;height:28px')
    expect(html).toContain('left:50%;transform:translateX(-50%)')
    expect(html.match(/<svg/g)).toHaveLength(1)
  })
  it('escapes asset attributes instead of interpreting markup', () => {
    const html = renderCatalogIntroHtml({ logo: '" onerror="alert(1)', font: "' malicious" })
    expect(html).toContain('&quot; onerror=&quot;alert(1)')
    expect(html).toContain('&#39; malicious')
    expect(html).not.toContain('src="" onerror=')
  })
})
