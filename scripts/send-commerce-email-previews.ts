import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

async function main() {
  const recipient = process.env.COMMERCE_PREVIEW_RECIPIENT
  if (!recipient) throw new Error('COMMERCE_PREVIEW_RECIPIENT no configurado')

  const [{ sendEmail }, templates] = await Promise.all([
    import('../src/lib/email/send'),
    import('../src/lib/email/templates'),
  ])
  const previews = [
    templates.buildHomeOrderConfirmationEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-EJEMPLO-001',
      orderPublicId: '00000000-0000-4000-8000-000000000001',
      accessToken: 'a'.repeat(43),
      deliveryAddress: 'Apoquindo 1234, Depto. 502, Las Condes, Metropolitana de Santiago',
      subtotalClp: 50000,
      discountClp: 0,
      shippingClp: 3990,
      totalClp: 53990,
      items: [{ name: 'Ski Rack Madera · Talla M', quantity: 1, lineTotalClp: 50000 }],
    }),
    templates.buildPickupOrderConfirmationEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-EJEMPLO-002',
      orderPublicId: '00000000-0000-4000-8000-000000000002',
      accessToken: 'b'.repeat(43),
      subtotalClp: 50000,
      discountClp: 0,
      shippingClp: 0,
      totalClp: 50000,
      items: [{ name: 'Ski Rack Madera · Talla M', quantity: 1, lineTotalClp: 50000 }],
      pickupLabel: 'Retiro en Las Condes',
      pickupAddress: 'La Gloria 40',
      pickupHours: 'Lunes a viernes, de 9:00 a 19:00',
      pickupInstructions: 'Si necesitas coordinar otro horario, responde este correo.',
    }),
    templates.buildShipmentEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-EJEMPLO-001',
      carrier: 'Starken',
      trackingNumber: 'OT-EJEMPLO-123456',
      trackingUrl: 'https://www.starken.cl/seguimiento',
    }),
    templates.buildPickupReadyEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-EJEMPLO-002',
      pickupLabel: 'Retiro en Las Condes',
      pickupAddress: 'La Gloria 40',
      pickupHours: 'Lunes a viernes, de 9:00 a 19:00',
      pickupInstructions: 'Si necesitas coordinar otro horario, responde este correo.',
    }),
    templates.buildRefundConfirmationEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-EJEMPLO-001',
      amountClp: 53990,
    }),
    templates.buildInternalNotice('Nueva compra pagada · RC-EJEMPLO-001 · $53.990', [
      { label: 'Orden', value: 'RC-EJEMPLO-001' },
      { label: 'Total', value: '$53.990' },
      { label: 'Comprador', value: 'Sebastián · comprador@ejemplo.cl' },
      { label: 'Productos', value: '1× Ski Rack Madera · Talla M' },
      { label: 'Entrega', value: 'Domicilio' },
      { label: 'Destino', value: 'Las Condes, Metropolitana de Santiago' },
      { label: 'Panel', value: 'https://www.reskichile.cl/admin/pedidos' },
    ]),
  ]

  for (const preview of previews) {
    const result = await sendEmail({
      to: recipient,
      subject: `[PREVISUALIZACIÓN] ${preview.subject}`,
      html: preview.html,
      text: preview.text,
      replyTo: process.env.COMMERCE_ALERT_EMAIL || 'reskichile@gmail.com',
    })
    if (!result.ok) throw new Error(`No se pudo enviar: ${preview.subject}`)
  }

  process.stdout.write(`Se enviaron ${previews.length} previsualizaciones.\n`)
}

void main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Error inesperado'}\n`)
  process.exitCode = 1
})
