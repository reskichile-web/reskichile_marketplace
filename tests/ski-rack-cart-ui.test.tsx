import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SkiRackCartLink from '@/components/SkiRackCartLink'

describe('Ski Rack cart entry point', () => {
  it('opens a dialog instead of navigating directly to the full cart page', () => {
    const html = renderToStaticMarkup(<SkiRackCartLink showWhenEmpty />)

    expect(html).toContain('<button')
    expect(html).toContain('aria-label="Abrir carrito"')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('aria-controls="ski-rack-cart-drawer"')
    expect(html).not.toContain('href="/carrito"')
  })
})
