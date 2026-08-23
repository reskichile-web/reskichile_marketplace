import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProductBrowser from '@/components/ProductBrowser'

describe('desktop catalog filters', () => {
  it('renders full-height accordion sections without nested scrolling', () => {
    const html = renderToStaticMarkup(<ProductBrowser products={[]} />)

    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('max-h-44')
    expect(html).not.toContain('max-h-[calc(100vh-100px)]')
    expect(html).not.toContain('sticky top-16 space-y-4')
  })
})
