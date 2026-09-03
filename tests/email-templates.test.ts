import { describe, expect, it } from 'vitest'
import {
  buildHomeOrderConfirmationEmail,
  buildPickupOrderConfirmationEmail,
  buildPickupReadyEmail,
  buildReviewEmail,
  buildShipmentEmail,
} from '@/lib/email/templates'

describe('email template links', () => {
  it('always sends marketplace review links to the public site', () => {
    const email = buildReviewEmail('Matías', 'Rossignol', 'Hero Athlete FIS GS')

    expect(email.html).toContain('https://www.reskichile.cl/mis-productos')
    expect(email.text).toContain('https://www.reskichile.cl/mis-productos')
    expect(email.html).not.toContain('.vercel.app')
    expect(email.text).not.toContain('.vercel.app')
  })

  it('builds a dispatch confirmation with its own delivery flow', () => {
    const confirmation = buildHomeOrderConfirmationEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-123',
      orderPublicId: '4d9bd7dc-1877-4cf6-9c9e-cc8a41cad19f',
      accessToken: 'a'.repeat(43),
      deliveryAddress: 'Apoquindo 1234, Depto. 502, Las Condes, Metropolitana de Santiago',
      subtotalClp: 50000,
      discountClp: 0,
      shippingClp: 3990,
      totalClp: 53990,
      items: [{ name: 'Ski Rack', quantity: 1, lineTotalClp: 50000 }],
    })
    expect(confirmation.subject).toBe('Compra confirmada para despacho · RC-123')
    expect(confirmation.html).toContain('&amp;acceso=')
    expect(confirmation.text).toContain('&acceso=')
    expect(confirmation.text).toContain('Apoquindo 1234, Depto. 502')
    expect(confirmation.text).toContain('transportista y el número de seguimiento')
    expect(confirmation.text).not.toContain('Punto de retiro')

    const shipment = buildShipmentEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-123',
      carrier: 'Starken',
      trackingNumber: 'OT-123',
      trackingUrl: 'https://www.starken.cl/seguimiento',
    })
    expect(shipment.subject).toBe('Tu pedido fue despachado · RC-123')
    expect(shipment.text).toContain('OT-123')
  })

  it('keeps the order summary and exact Las Condes pickup details together', () => {
    const confirmation = buildPickupOrderConfirmationEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-124',
      orderPublicId: '4d9bd7dc-1877-4cf6-9c9e-cc8a41cad19f',
      accessToken: 'b'.repeat(43),
      subtotalClp: 50000,
      discountClp: 0,
      shippingClp: 0,
      totalClp: 50000,
      items: [{ name: 'Ski Rack', quantity: 1, lineTotalClp: 50000 }],
      pickupLabel: 'Retiro en Las Condes',
      pickupAddress: 'La Gloria 40',
      pickupHours: 'Lunes a viernes, de 9:00 a 19:00',
      pickupInstructions: 'Si necesitas coordinar otro horario, responde este correo.',
    })

    expect(confirmation.subject).toBe('Compra confirmada para retiro · RC-124')
    expect(confirmation.text).toContain('Ski Rack × 1: $50.000')
    expect(confirmation.text).toContain('Retiro en Las Condes')
    expect(confirmation.text).toContain('La Gloria 40')
    expect(confirmation.text).toContain('Lunes a viernes, de 9:00 a 19:00')
    expect(confirmation.text).not.toContain('las_condes')

    const pickup = buildPickupReadyEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-124',
      pickupLabel: 'Retiro en Las Condes',
      pickupAddress: 'La Gloria 40',
      pickupHours: 'Lunes a viernes, de 9:00 a 19:00',
      pickupInstructions: 'Si necesitas coordinar otro horario, responde este correo.',
    })
    expect(pickup.subject).toBe('Tu pedido está listo para retirar · RC-124')
    expect(pickup.text).toContain('La Gloria 40')
  })

  it('does not invent pickup details for Los Ángeles', () => {
    const confirmation = buildPickupOrderConfirmationEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-125',
      orderPublicId: '4d9bd7dc-1877-4cf6-9c9e-cc8a41cad19f',
      accessToken: 'c'.repeat(43),
      subtotalClp: 50000,
      discountClp: 0,
      shippingClp: 0,
      totalClp: 50000,
      items: [{ name: 'Ski Rack', quantity: 1, lineTotalClp: 50000 }],
      pickupLabel: 'Retiro en Los Ángeles',
      pickupAddress: null,
      pickupHours: null,
      pickupInstructions: 'Te contactaremos para confirmar la ubicación y el horario.',
    })

    expect(confirmation.text.match(/Por confirmar/g)).toHaveLength(2)
    expect(confirmation.text).not.toContain("Calle O'Higgins")
  })
})
