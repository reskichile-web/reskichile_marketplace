import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CheckoutForm from '@/components/checkout/CheckoutForm'

const props = {
  items: [{
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Producto de prueba',
    priceClp: 10000,
    quantity: 1,
  }],
  kind: 'products' as const,
  enabled: true,
  sandbox: true,
}

describe('checkout form contracts', () => {
  it('keeps the visual checkout hierarchy and the real three-step flow', () => {
    const html = renderToStaticMarkup(<CheckoutForm {...props} />)

    expect(html).toContain('Checkout seguro')
    expect(html).toContain('aria-label="Ir al inicio de ReskiChile"')
    expect(html).toContain('aria-label="Progreso del checkout"')
    expect(html).toContain('Entrega')
    expect(html).toContain('Revisión')
    expect(html).toContain('Pago')
    expect(html).toContain('Resumen de compra')
    expect(html).toContain('Compra protegida')
    expect(html).toContain('Continuar a revisión')
  })

  it('uses the cart as the return destination for rack purchases', () => {
    const html = renderToStaticMarkup(
      <CheckoutForm
        {...props}
        kind="racks"
        items={[{ ...props.items[0], backHref: '/carrito', selectedSize: 'M' }]}
      />
    )

    expect(html).toContain('href="/carrito"')
    expect(html).toContain('Volver al carrito')
    expect(html).toContain('Talla M')
  })

  it('renders the real phone input as required with a separate country selector', () => {
    const html = renderToStaticMarkup(<CheckoutForm {...props} />)

    expect(html).toContain('id="checkout-phone"')
    expect(html).toMatch(/<input[^>]+id="checkout-phone"[^>]+type="tel"[^>]+required/)
    expect(html).toContain('aria-label="Código de país"')
    expect(html).toContain('autoComplete="tel-national"')
  })

  it('keeps manual sandbox fields while address validation is disabled', () => {
    const html = renderToStaticMarkup(
      <CheckoutForm {...props} addressValidationEnabled={false} />
    )

    expect(html).toContain('Calle')
    expect(html).toContain('Comuna')
    expect(html).not.toContain('checkout-address-search')
  })

  it('replaces free-form home fields with required autocomplete when enabled', () => {
    const html = renderToStaticMarkup(
      <CheckoutForm {...props} addressValidationEnabled />
    )

    expect(html).toContain('id="checkout-address-search"')
    expect(html).toMatch(/<input[^>]+id="checkout-address-search"[^>]+required/)
    expect(html).toContain('Busca tu dirección')
    expect(html).not.toContain('autoComplete="address-line1"')
  })
})
