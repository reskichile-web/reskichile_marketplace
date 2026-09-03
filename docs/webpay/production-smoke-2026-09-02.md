# Webpay Plus: smoke test productivo sin compra

Fecha: 2026-09-02

Commit desplegado: `955431d`

Resultado: aprobado; compra y reversa productivas completadas en seguimiento

## Límite de seguridad

Durante esta verificación no se llamó a `/api/checkout/create`, no se creó una
transacción Webpay y no se envió al navegador de pago. Los contadores remotos se
mantuvieron en 9 órdenes y 9 intentos antes y después de todas las pruebas.

El checkout productivo permaneció habilitado por decisión del propietario.

## Compra productiva controlada y reversa

El seguimiento del mismo día completó la validación económica con una compra
intencional de CLP 50, sin usar productos ni inventario comercial:

- orden `RC-260903-0F2DE604`;
- producto técnico ocultable `Prueba Webpay $50` y retiro sin costo;
- intento en ambiente `production`, autorizado con `response_code=0`;
- retorno correcto a ReskiChile y comprobante de pago confirmado;
- devolución completa aceptada por Transbank como `REVERSED`;
- reembolso persistido en estado `succeeded` por CLP 50;
- estado final de la orden: pago `refunded`, orden y fulfillment `cancelled`;
- producto técnico nuevamente `archived`.

No se guardaron en este documento datos de tarjeta, token Webpay, llaves ni
datos personales del comprador.

## Base de datos y despliegue

- El historial de migraciones local y remoto quedó reconciliado.
- Se aplicaron `20260903021000_pickup_sector_copy.sql` y
  `20260903021100_ski_rack_commercial_pricing.sql` al proyecto remoto.
- Ski Rack Madera quedó en $17.990.
- Ski Rack Filamento conservó $7.990.
- Las tarifas activas quedaron en $1.990 local, $3.490 centro/sur, $4.490
  norte, $5.990 austral y $0 para retiro.
- `main` fue desplegado y el catálogo público mostró $17.990 y $7.990.
- La CI de GitHub terminó correctamente: secretos, audit, lint, tipos, Vitest,
  migraciones y build.

## Recorrido productivo sin compra

Se ejecutó en `https://www.reskichile.cl` el recorrido permitido:

```text
autocomplete -> validación de dirección -> cotización
```

Resultados:

| Caso | Producto | Subtotal | Despacho | Total |
| --- | --- | ---: | ---: | ---: |
| Misma comuna | Madera | $17.990 | $1.990 | $19.980 |
| Centro/sur | Madera | $17.990 | $3.490 | $21.480 |
| Norte | Filamento | $7.990 | $4.490 | $12.480 |
| Austral | Filamento | $7.990 | $5.990 | $13.980 |
| Retiro | Filamento | $7.990 | $0 | $7.990 |

Todas las cotizaciones usaron `shippingSource=table`. Google rechazó con
`ADDRESS_NOT_CONFIRMED` direcciones que no pudo confirmar y aceptó solamente
direcciones con calle, número, comuna y región normalizados.

## Controles negativos

| Prueba | Resultado |
| --- | --- |
| Precio y despacho falsos en el body | ignorados; backend recalculó $17.990 + $3.490 |
| Dirección modificada después de validarla | `422 ADDRESS_CHANGED` |
| Cantidad fuera de rango | `422 VALIDATION_ERROR` |
| Variante sin stock | `409 PRODUCT_UNAVAILABLE` |
| `Origin` ajeno | `403 INVALID_ORIGIN` |

La cotización de dos unidades confirmó el comportamiento vigente por caja:
$35.980 de subtotal + $6.980 de despacho. Cambiarlo a una tarifa consolidada
requiere una decisión comercial y validar el embalaje conjunto.

## Workers y Transbank

- Conciliación con secreto incorrecto: `401`.
- Conciliación con secreto productivo: `200`, sin candidatos pendientes.
- Outbox con secreto incorrecto: `401`.
- Outbox con secreto productivo: `200`, sin mensajes pendientes.
- Una consulta `status` productiva con un token deliberadamente inexistente
  llegó a Transbank y fue rechazada con `422 Invalid value for parameter:
  token`. La operación fue de lectura y no creó una transacción.

## Pendientes que sí requieren una acción posterior

1. Confirmar visualmente en Supabase que `reski-payment-reconciliation` y
   `reski-commerce-outbox` estén activos cada minuto y revisar ejecuciones
   recientes. Los endpoints y sus secretos ya fueron validados.
2. Decidir si pedidos de varias unidades mantienen despacho por caja o usan un
   paquete consolidado medido.
3. Confirmar que la validación técnica de Transbank esté formalmente aprobada y
   archivar su evidencia.
4. Completar la evidencia de concurrencia, callback duplicado, recuperación de
   una respuesta incierta y refund en la matriz del runbook.
