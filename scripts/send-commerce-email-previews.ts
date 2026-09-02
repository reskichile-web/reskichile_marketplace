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
    templates.buildOrderConfirmationEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-EJEMPLO-001',
      orderPublicId: '00000000-0000-4000-8000-000000000001',
      accessToken: 'a'.repeat(43),
      deliveryMethod: 'home' as const,
      destinationRegion: 'Metropolitana de Santiago',
      destinationCommune: 'Las Condes',
      subtotalClp: 50000,
      discountClp: 0,
      shippingClp: 3990,
      totalClp: 53990,
      items: [{ name: 'Ski Rack Madera · Talla M', quantity: 1, lineTotalClp: 50000 }],
    }),
    templates.buildShipmentEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-EJEMPLO-001',
      carrier: 'Chilexpress',
      trackingNumber: 'OT-EJEMPLO-123456',
      trackingUrl: 'https://www.chilexpress.cl/seguimiento',
    }),
    templates.buildPickupReadyEmail({
      buyerName: 'Sebastián',
      orderNumber: 'RC-EJEMPLO-002',
      pickupLabel: 'Retiro en Las Condes',
      pickupAddress: 'Las Condes, Región Metropolitana',
      pickupInstructions: 'Te contactaremos para coordinar la dirección y el momento exactos del retiro.',
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
