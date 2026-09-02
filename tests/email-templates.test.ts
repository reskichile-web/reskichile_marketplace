import { describe, expect, it } from 'vitest'
import {
  buildOrderConfirmationEmail,
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

  it('includes secure order access and the minimal buyer status cadence', () => {
    const confirmation = buildOrderConfirmationEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-123',
      orderPublicId: '4d9bd7dc-1877-4cf6-9c9e-cc8a41cad19f',
      accessToken: 'a'.repeat(43),
      deliveryMethod: 'home',
      destinationRegion: 'Metropolitana de Santiago',
      destinationCommune: 'Las Condes',
      subtotalClp: 50000,
      discountClp: 0,
      shippingClp: 3990,
      totalClp: 53990,
      items: [{ name: 'Ski Rack', quantity: 1, lineTotalClp: 50000 }],
    })
    expect(confirmation.subject).toBe('Compra confirmada · RC-123')
    expect(confirmation.html).toContain('&amp;acceso=')
    expect(confirmation.text).toContain('&acceso=')

    const shipment = buildShipmentEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-123',
      carrier: 'Starken',
      trackingNumber: 'OT-123',
      trackingUrl: 'https://www.starken.cl/seguimiento',
    })
    expect(shipment.subject).toBe('Tu pedido fue despachado · RC-123')
    expect(shipment.text).toContain('OT-123')

    const pickup = buildPickupReadyEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-124',
      pickupLabel: 'Retiro en Las Condes',
      pickupAddress: 'Las Condes, Región Metropolitana',
      pickupInstructions: 'Te contactaremos para coordinar la dirección y el momento exactos.',
    })
    expect(pickup.subject).toBe('Tu pedido está listo para retirar · RC-124')
    expect(pickup.text).toContain('Retiro en Las Condes')
  })
})
