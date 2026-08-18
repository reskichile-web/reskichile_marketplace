# Auditoría de inventario Ski Rack

Fecha: 2026-08-17
Alcance: catálogo, carrito, checkout, reservas, Webpay y administración.

## Configuración acordada

- paquete unitario: 10 × 10 × 20 cm;
- embalaje: una caja terminada por cada unidad comprada;
- peso físico provisional: 0,5 kg;
- Los Ángeles: 5 unidades de cada producto y talla;
- Las Condes: 5 unidades de cada producto y talla.

El peso debe volver a medirse con producto, caja y protecciones antes de usar
tarifas productivas. Starken y otros transportistas pueden corregir el cobro al
verificar el paquete.

## Flujo conectado

```text
ski_rack_products
        │ precio + paquete
        ▼
ski_rack_inventory (producto + talla + origen + stock)
        │
        ├── API pública: capacidad máxima despachable desde una ubicación
        ├── Admin: stock y reservas separados por origen
        └── Checkout: filtra orígenes que pueden completar todo el carrito
                         │
                         ▼
                 shipping_rates / courier
                         │ origen elegido
                         ▼
             inventory_reservations + order_items
                         │
                 Webpay AUTHORIZED
                         │
                         ▼
              descuenta stock + registra ajuste
```

## Controles verificados

- precio, stock, origen y total se releen server-side;
- el navegador no envía un monto de despacho aceptable por el servidor;
- la RPC bloquea las filas de inventario antes de validar y reservar;
- administración no puede bajar el stock por debajo de reservas retenidas;
- rechazo, aborto y expiración liberan la reserva sin descontar stock;
- autorización Webpay descuenta una sola vez y deja ajuste `webpay_sale`;
- la reserva debe coincidir con producto/variante y cantidad de `order_items`;
- el origen congelado en la orden debe coincidir con el origen del inventario;
- una promoción de envío gratis valida primero la tarifa base real;
- la tarifa de tabla se interpreta por caja y se multiplica por las unidades;
- el precio visible proviene de la misma lectura de inventario que PostgreSQL;
- tablas y RPC sensibles quedan limitadas a `service_role`.

## Hallazgos corregidos

1. El catálogo sumaba el stock de las dos bodegas. Con 5 + 5 podía anunciar 10,
   aunque checkout exige que un solo origen complete la compra. Ahora publica
   el máximo disponible en una ubicación: 5.
2. `free_shipping` enviaba cero a la validación de la tarifa base y podía ser
   rechazado. Ahora checkout conserva tarifa base y cobro final por separado.
3. Catálogo/carrito tenían un precio estático duplicado. Ahora usan el precio
   server-side expuesto por disponibilidad, con el estático sólo como fallback
   visual mientras carga.
4. Las ventas descontaban stock sin entrada en el historial de ajustes. Ahora
   registran el cambio con motivo `webpay_sale`.
5. Finalización contaba reservas, pero no comprobaba igualdad de cantidades.
   Ahora exige correspondencia exacta antes de consumir stock.
6. Faltaba definir el embalaje de compras múltiples. Se confirmó una caja por
   unidad; cotización y validación SQL multiplican la tarifa unitaria por cajas.

## Bloqueos antes de producción

- aplicar y verificar las migraciones en Supabase remoto;
- cargar tarifas reales o conectar el sandbox de Starken/otro courier;
- probar concurrencia real en PostgreSQL: dos compradores, último stock,
  expiración, rechazo, autorización y reconciliación;
- medir el peso físico definitivo;
- probar ambos orígenes con órdenes sandbox independientes.
