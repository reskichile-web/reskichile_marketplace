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

    expect(html).toContain('<span class="text-gray-950">RC-260819-91D2C397</span>')
    expect(html).toContain('aria-label="Copiar número de orden"')
    expect(html).toContain('font-black text-brand-400">Pago confirmado')
    expect(html).toContain('Te informaremos por correo sobre el estado de tu pedido.')
    expect(html).toContain('aria-label="Estado del pedido"')
    expect(html).toContain('Orden creada')
    expect(html).toContain('Despacho')
    expect(html).toContain('Envío')
    expect(html).toContain('Datos de envío')
    expect(html).toContain('Cliente de prueba')
    expect(html).toContain('Avenida Los Leones 1234')
    expect(html).toContain('Providencia, Metropolitana de Santiago')
    expect(html).not.toContain('Ahora comenzaremos a preparar el despacho')
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
    expect(html).not.toContain('Datos de envío')
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
})
