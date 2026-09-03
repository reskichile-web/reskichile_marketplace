import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import CheckoutResultCard from '@/components/checkout/CheckoutResultCard'
import type { GuestOrderResult } from '@/lib/commerce/order-service'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const order: GuestOrderResult = {
  publicId: '10000000-0000-4000-8000-000000000001',
  orderNumber: 'RC-260819-91D2C397',
  buyer: {
    name: 'Cliente de prueba',
    email: 'cliente@example.com',
    phone: '+56964880714',
  },
  delivery: {
    method: 'home',
    region: 'Metropolitana de Santiago',
    commune: 'Providencia',
    street: 'Avenida Los Leones',
    number: '1234',
    extra: 'Depto. 502',
    formattedAddress: null,
    pickupPointId: null,
  },
  orderStatus: 'paid',
  paymentStatus: 'authorized',
  fulfillmentStatus: 'pending',
  subtotalClp: 11990,
  discountClp: 0,
  shippingClp: 3990,
  totalClp: 15980,
  createdAt: '2026-08-19T20:00:00.000Z',
  paidAt: '2026-08-19T20:01:00.000Z',
  containsRackItems: false,
  items: [{ name: 'Ski Rack Madera · Talla M', priceClp: 11990 }],
}

describe('checkout result', () => {
  it('shows the confirmed order status, timeline and protected delivery details', () => {
    const html = renderToStaticMarkup(<CheckoutResultCard order={order} />)

    expect(html).toContain('RC-260819-91D2C397')
    expect(html).toContain('aria-label="Copiar número de orden"')
    expect(html).toContain('Tu orden fue confirmada')
    expect(html).toContain('Te avisaremos por correo cuando preparemos tu pedido y cuando vaya en camino.')
    expect(html).toContain('aria-label="Estado del pedido"')
    expect(html).toContain('Confirmada')
    expect(html).toContain('Preparación')
    expect(html).toContain('En camino')
    expect(html).toContain('Detalle de entrega')
    expect(html).toContain('Comprobante de compra')
    expect(html).toContain('Webpay · Confirmado')
    expect(html).toContain('Volver a la tienda')
    expect(html).toContain('Cliente de prueba')
    expect(html).toContain('Avenida Los Leones 1234')
    expect(html).toContain('Providencia, Metropolitana de Santiago')
    expect(html).not.toContain('Ahora comenzaremos a preparar el despacho')
  })

  it('shows a friendly pickup label without carrying a home reference', () => {
    const html = renderToStaticMarkup(
      <CheckoutResultCard order={{
        ...order,
        delivery: {
          ...order.delivery,
          method: 'pickup',
          street: null,
          number: null,
          extra: 'Esta referencia no corresponde a un retiro',
          pickupPointId: 'las_condes',
        },
      }} />
    )

    expect(html).toContain('Detalle del retiro')
    expect(html).toContain('Retiro en Las Condes')
    expect(html).toContain('Lista para retirar')
    expect(html).toContain('Te contactaremos por correo para coordinar el horario y el punto exacto de retiro.')
    expect(html).not.toContain('Esta referencia no corresponde a un retiro')
    expect(html).not.toContain('>las_condes<')
  })

  it.each([
    ['rejected', 'Pago rechazado'],
    ['aborted', 'Pago cancelado'],
    ['expired', 'Sesión expirada'],
    ['reconciliation_required', 'Estamos verificando tu pago'],
  ])('shows a compact result without private order details for %s', (paymentStatus, title) => {
    const html = renderToStaticMarkup(
      <CheckoutResultCard order={{
        ...order,
        orderStatus: 'awaiting_payment',
        paymentStatus,
        fulfillmentStatus: 'unfulfilled',
        paidAt: null,
      }} />
    )

    expect(html).toContain(title)
    expect(html).toContain(order.orderNumber)
    expect(html).not.toContain('Detalle de entrega')
    expect(html).not.toContain(order.buyer.name)
    expect(html).not.toContain(order.buyer.email)
    expect(html).not.toContain(order.buyer.phone)
    expect(html).not.toContain(order.delivery.street)
    expect(html).not.toContain(order.items[0].name)
    expect(html).not.toContain('$15.980')
    expect(html).not.toContain('aria-label="Estado del pedido"')

    if (paymentStatus === 'reconciliation_required') {
      expect(html).not.toContain('Volver al carrito')
    } else {
      expect(html).toContain('Volver al carrito')
    }
  })

  it.each([
    ['refunded', 'Pago devuelto'],
    ['partially_refunded', 'Reembolso parcial procesado'],
  ])('shows a completed refund state for %s', (paymentStatus, title) => {
    const html = renderToStaticMarkup(
      <CheckoutResultCard order={{
        ...order,
        paymentStatus,
        fulfillmentStatus: 'cancelled',
      }} />
    )

    expect(html).toContain(title)
    expect(html).toContain('Volver a la tienda')
    expect(html).not.toContain('Pago en proceso')
    expect(html).not.toContain(order.buyer.email)
  })
})
