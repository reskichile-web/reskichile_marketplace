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
  it('renders the checkout as Datos, Envío and Pago without a review step', () => {
    const html = renderToStaticMarkup(<CheckoutForm {...props} />)

    expect(html).toContain('Checkout seguro')
    expect(html).toContain('aria-label="Ir al inicio de ReskiChile"')
    expect(html).toContain('aria-label="Progreso del checkout"')
    expect(html).toContain('Datos')
    expect(html).toContain('Envío')
    expect(html).toContain('Pago')
    expect(html).toContain('Medios de pago')
    expect(html).toContain('src="/webpay-plus-logo.svg"')
    expect(html).toContain('alt="Webpay Plus"')
    expect(html).toContain('Resumen de compra')
    expect(html).toContain('Continuar al envío')
    expect(html).not.toContain('Revisión')
    expect(html).not.toContain('Compra online')
    expect(html).not.toContain('Compra protegida')
    expect(html).not.toContain('Despacho nacional')
    expect(html).not.toContain('Cupón')
    expect(html).not.toContain('Pagar con Webpay')
    expect(html).not.toContain('Serás redirigido a Transbank')
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
    expect(html).toContain('aria-label="Volver al carrito"')
    expect(html).toContain('Finalizar compra')
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
