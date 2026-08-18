# Arquitectura técnica de órdenes y Webpay Plus

Estado: foundation y hardening implementados localmente; no aplicados remoto
Última revisión: 2026-08-18

Vista rápida: [mapa visual de la base y del flujo](./database-map.md).

## 1. Principios

1. El navegador es hostil: puede mentir sobre producto, cantidad, precio,
   descuento, despacho, identidad y resultado.
2. Transbank es autoridad financiera; PostgreSQL es autoridad de la orden y el
   inventario.
3. Un retorno del navegador es una señal para verificar, no una confirmación.
4. Toda operación externa puede repetirse, demorarse o responder de forma
   ambigua.
5. Orden, pago, inventario y fulfillment tienen estados separados.
6. Un pago autorizado y una entrega deben producir efectos exactamente una vez.
7. La indisponibilidad no puede convertirse en pérdida silenciosa de una venta.

## 2. Límites de confianza

### Navegador

Puede:

- enviar identificadores de producto y cantidad solicitada;
- proporcionar datos de contacto y despacho validados;
- ser redirigido a Webpay;
- mostrar un resultado obtenido nuevamente desde el backend.

No puede:

- enviar un precio o total aceptado como verdadero;
- reservar o descontar stock directamente;
- marcar una orden como pagada;
- elegir qué fila actualiza un callback;
- solicitar un reembolso financiero directamente;
- recibir claves, service role o tokens completos.

### Backend Next.js

Es responsable de:

- autenticación y autorización;
- validación de input, origen e idempotencia;
- cálculo de precios y despacho;
- coordinación de inventario y órdenes;
- comunicación server-to-server con Transbank;
- redacción de logs;
- emisión de respuestas y comprobantes mínimos.

### Transbank

Es autoridad sobre creación, autorización, rechazo, estado y reversa de la
transacción Webpay. Los datos solo se aceptan tras correlacionarlos con la orden
local.

### Supabase/PostgreSQL

Es autoridad sobre catálogo vendible, precio vigente, reservas, órdenes,
intentos de pago, fulfillment y auditoría. Sus constraints deben sostener la
integridad aunque existan requests concurrentes o un backend defectuoso.

## 3. Componentes implementados

~~~text
src/
  app/
    api/checkout/create/route.ts
    api/checkout/quote/route.ts
    api/racks/inventory/route.ts
    api/admin/inventory/route.ts
    api/payments/webpay/return/route.ts
    api/cron/payments/reconcile/route.ts
    checkout/resultado/page.tsx
    admin/inventario/page.tsx
  lib/
    env/server.ts
    commerce/
      checkout-service.ts
      checkout-validation.ts
      order-service.ts
    payments/
      webpay-client.ts
      payment-service.ts
      return-parser.ts
  proxy.ts

supabase/
  migrations/
    202608140001_commerce_webpay_foundation.sql
    202608150001_commerce_payment_hardening.sql
    202608170002_ski_rack_inventory.sql
~~~

Las rutas finales pueden variar. Las responsabilidades y los límites no.

## 4. Modelo de datos

### 4.1 orders

Una fila representa el compromiso comercial con el comprador.

Campos mínimos:

| Campo | Regla |
|---|---|
| id | UUID interno |
| public_id | UUID o identificador aleatorio único para URL; no secuencial |
| order_number | identificador corto único para soporte y conciliación |
| buyer_user_id | nullable; enlazar si ya inició sesión, nunca exigir cuenta |
| buyer_email | snapshot normalizado |
| buyer_name / phone | solo los datos necesarios para fulfillment |
| order_status | máquina de estados controlada |
| payment_status | resumen derivado; no reemplaza payment_attempts |
| fulfillment_status | máquina separada |
| currency | CLP |
| subtotal_clp | entero no negativo |
| discount_clp | entero no negativo |
| shipping_clp | entero no negativo |
| total_clp | subtotal - descuento + despacho |
| shipping_snapshot | JSON validado o columnas; cifrar/minimizar PII |
| expires_at | término de reserva/checkout |
| paid_at | solo por finalización atómica |
| created_at / updated_at | timestamps del servidor |

Después de crear el intento Webpay, los importes y líneas quedan inmutables.
Cambios posteriores crean una orden o versión nueva.

### 4.2 order_items

Instantánea del producto vendido, no una vista dinámica del catálogo.

Campos mínimos:

- order_id;
- product_id y/o variant_id;
- sku;
- nombre y descripción corta al comprar;
- unit_price_clp;
- quantity;
- line_total_clp;
- atributos necesarios para preparar el pedido.

El comprobante histórico debe seguir correcto aunque después cambien nombre,
foto o precio del producto.

### 4.3 inventory_reservations

Relaciona una orden con unidades apartadas durante el paso por Webpay:

- order_id, product_id/variant_id y quantity;
- estado active, payment_processing, reconciliation_required, consumed,
  released o expired;
- expires_at, consumed_at y released_at;
- motivo y timestamps.

Los productos del marketplace continúan siendo piezas únicas de stock 1. Una
restricción única parcial sobre `product_id` con cualquier estado retenido evita
que dos compradores aparten la misma pieza.

Los Ski Racks usan `rack_inventory_id` y cantidad. El stock físico vive en
`ski_rack_inventory` por producto, talla S/M/L y origen Los Ángeles/Las Condes;
la disponibilidad resta reservas activas, pagos en proceso y casos en
reconciliación. Webpay autorizado consume la reserva y descuenta unidades.
Rechazo, aborto o expiración solo liberan la reserva.

### 4.4 shipping_origins y shipping_profiles

shipping_origins contiene Los Ángeles y Las Condes. Para los Ski Racks, cada
fila de inventario referencia un origen; un mismo producto/talla puede existir
en ambos. La dirección operativa completa es server-only.

shipping_profiles contiene largo, ancho, alto y peso del producto ya embalado.
Un producto sin perfil completo no puede pasar a vendible.

Checkout descarta orígenes sin stock suficiente y cotiza los restantes. Elige
menor costo y luego menor plazo. La primera versión exige que una ubicación
complete todo el carrito; no divide silenciosamente una compra en dos envíos.

### 4.5 shipping_quotes

Cotización inmutable y con vencimiento:

- order_id;
- source table o proveedor;
- rate_version/provider_quote_id;
- coverage/service code;
- amount_clp;
- package snapshot;
- días estimados;
- expires_at y estado.

El navegador selecciona un quote_id opaco; nunca establece shipping_clp.
Detalles, alternativas y proveedores están en
[la investigación de despachos](./shipping-research.md).

### 4.6 promotions y discount_redemptions

Una promoción define vigencia, tipo, valor/máximo, productos, zonas, monto
mínimo, combinabilidad y límites globales/por comprador. La aplicación busca el
cupón por un digest del código normalizado y no lo registra en logs.

El uso se reserva atómicamente al crear la orden, se consume al pagar y se libera
al expirar/cancelar. La orden guarda el ajuste aplicado; cambios posteriores en
la promoción no alteran el total.

### 4.7 payment_attempts

Una orden puede tener más de un intento por rechazo, expiración o reintento,
pero como máximo un pago autorizado vigente.

| Campo | Regla |
|---|---|
| id | UUID interno |
| order_id | FK inmutable |
| provider | webpay_plus |
| state | máquina de estados |
| amount_clp / currency | copia del total de orden |
| buy_order | único, máximo y caracteres según Transbank |
| session_id | único |
| transbank_token | único cuando existe |
| response_code / tbk_status | respuesta normalizada |
| authorization_code | solo si fue autorizado |
| payment_type_code | tipo de pago |
| installments_number | si corresponde |
| card_last_four | solo cuatro dígitos |
| transaction_date / authorized_at | fechas relevantes |
| processing_started_at | lease para exclusión y recuperación |
| processing_lease_until | vencimiento recuperable del worker |
| commit_started_at | fence irreversible: después solo se consulta status |
| next_reconcile_at / reconcile_count | backoff del job |
| last_error_code | razón redactada, sin credenciales ni PII |
| terminal_at | cierre financiero local |
| created_at / updated_at | timestamps del servidor |

No almacenar PAN, CVV, fecha de vencimiento, credenciales bancarias, cookies ni
una copia indiscriminada de la respuesta.

### 4.8 payment_events

Registro append-only:

- payment_attempt_id;
- event_type, from_state y to_state;
- correlation_id;
- actor system, user o admin;
- metadata estrictamente permitida y redactada;
- timestamp del servidor.

Una corrección genera un evento nuevo; no se reescribe la historia.

### 4.9 refunds

Registro separado por cada reversa o devolución:

- payment_attempt_id y order_id;
- amount_clp;
- estado requested, processing, succeeded, failed o uncertain;
- motivo controlado más comentario;
- admin_user_id;
- identificador/respuesta mínima de Transbank;
- idempotency_key;
- timestamps y eventos.

No se marca una devolución exitosa hasta confirmación server-to-server.

## 5. Máquinas de estado

### Orden

~~~text
draft
  -> awaiting_payment
  -> paid
  -> cancelled
  -> expired

paid
  -> preparing
  -> ready_for_pickup / shipped
  -> completed
~~~

Una devolución no debe borrar la historia de fulfillment; se refleja en estado
financiero y refunds. Si el negocio quiere order_status igual a refunded, será
una proyección, no el único dato.

### Intento de pago

~~~text
created
  -> initialized
  -> initialization_failed

initialized
  -> processing
  -> aborted
  -> expired
  -> reconciliation_required

processing
  -> authorized
  -> rejected
  -> reconciliation_required

reconciliation_required
  -> authorized
  -> rejected
  -> aborted
  -> expired
~~~

Reglas:

- authorized nunca se degrada por un callback posterior;
- un timeout de red no equivale a rejected;
- callbacks repetidos terminan en el mismo estado;
- solo una finalización consume inventario;
- una acción administrativa requiere MFA, motivo y auditoría.

## 6. Constraints y permisos

Como mínimo:

- UNIQUE para public_id, order_number, buy_order y session_id;
- UNIQUE parcial para transbank_token no nulo;
- máximo un intento authorized por orden, salvo modelar explícitamente una
  devolución total seguida de otro cobro;
- CHECK de enteros CLP y ecuación del total;
- CHECK de quantity mayor que cero;
- CHECK de currency igual a CLP;
- largos y formatos compatibles con Transbank;
- FK y restricciones que impidan items huérfanos;
- máquina de estados validada en función o trigger;
- finalización y reserva mediante funciones transaccionales.

RLS:

- anon y authenticated no reciben INSERT/UPDATE/DELETE directo sobre órdenes,
  reservas, intentos, eventos o refunds;
- el comprador solo puede leer la proyección mínima de sus órdenes si se usa
  cuenta;
- un invitado accede por un mecanismo server-side con identificador aleatorio,
  nunca por una policy pública amplia;
- service role vive solo en backend;
- funciones SECURITY DEFINER fijan search_path, revocan PUBLIC y reciben
  permisos mínimos.

Para invitados, public_id permite mostrar únicamente estado y número de orden
sin PII. El detalle y seguimiento requieren un token aleatorio enviado al correo
del comprador; se almacena solo su hash, vence, puede rotarse y no aparece en
logs.

## 7. Corrección del catálogo actual

El esquema actual fue pensado como marketplace: products contiene seller_id y
estados draft, pending, approved, rejected, sold y archived; además, las
políticas permiten al vendedor modificar su fila sin protección de columnas.
Eso no es una base segura para una tienda dueña del inventario.

Si ReskiChile es dueño de todo el stock:

1. migrar catálogo e inventario a semántica de comercio;
2. separar publicación/moderación de disponibilidad comercial;
3. restringir precio, costo, stock, SKU y estados a operaciones administrativas
   server-side;
4. exponer al cliente solo lectura de productos activos;
5. retirar seller_id del flujo de venta o documentar que es solo procedencia
   interna, no beneficiario del pago;
6. impedir que products.sold sea la única fuente de stock;
7. probar RLS con usuarios anónimo, cliente y admin.

Si existen terceros dueños de productos o receptores económicos, el alcance deja
de ser e-commerce propio y debe rediseñarse antes de implementar. No se asumirá
marketplace silenciosamente.

## 8. Creación segura de checkout

Secuencia:

1. Verificar feature flag, método, Content-Type, tamaño y rate limit.
2. Validar Origin/Host contra APP_URL y aplicar CSRF cuando corresponda.
3. Crear checkout invitado; si existe sesión, enlazarla sin volverla requisito.
4. Validar body con allowlist: product_id/variant_id y quantity; ignorar precios.
5. Dentro de una transacción:
   - bloquear filas de inventario;
   - releer estado y precio;
   - calcular subtotal, descuentos permitidos, despacho y total;
   - crear order y order_items;
   - crear reservas con expires_at;
   - crear payment_attempt con buy_order y session_id únicos;
   - registrar evento.
6. Ejecutar Transaction.create con total, orden, sesión y return_url fija.
7. Validar que la URL devuelta use HTTPS y host oficial del ambiente.
8. Guardar token y estado initialized antes de responder al navegador.
9. Responder solo URL y token necesarios para el POST a Webpay.

Idempotencia:

- el cliente envía una clave aleatoria por intención;
- la base la vincula a comprador y contenido normalizado del carro;
- repetir la misma request devuelve la misma orden;
- una clave igual con contenido distinto se rechaza;
- un doble clic no crea dos reservas ni dos intentos.

Si Transbank crea el token y luego falla la persistencia local, no se redirige.
Se registra una incidencia sin asumir autorización.

## 9. Retorno Webpay

La documentación describe:

| Caso | Parámetros | Tratamiento |
|---|---|---|
| Normal | token_ws | buscar por token, reclamar procesamiento y ejecutar commit |
| Timeout | TBK_ID_SESION + TBK_ORDEN_COMPRA | no ejecutar commit; correlacionar y reconciliar |
| Anulación | TBK_TOKEN + sesión + orden | consultar status; no asumir rechazo por la URL |
| Especial | token_ws + TBK_TOKEN + sesión + orden | no confiar; reconciliación controlada |

Retorno normal:

1. Validar formato y tamaño de token_ws.
2. Buscar intento por token; nunca por un order_id libre en query.
3. Adquirir lease con update condicional initialized a processing.
4. Si otro proceso ya actúa, leer su resultado; no duplicar commit/fulfillment.
5. Ejecutar Transaction.commit una vez.
6. Verificar response_code, status, amount, buy_order y session_id.
7. Dentro de una transacción:
   - marcar intento authorized;
   - marcar orden paid;
   - consumir reservas;
   - descontar/confirmar stock;
   - insertar eventos y un outbox de fulfillment.
8. Redirigir a una URL propia con public_id no sensible.

Si commit falla por transporte o devuelve un resultado ambiguo:

- no marcar rejected;
- pasar a reconciliation_required;
- consultar status con backoff acotado;
- alertar si supera el SLA.

## 10. Reserva, expiración y sobreventa

El token Webpay dura aproximadamente cinco minutos. La reserva inicial será de
quince minutos para cubrir creación, formulario y una holgura controlada; se
validará en sandbox antes de fijarla para producción.

El job de expiración:

- usa hora del servidor;
- bloquea la reserva antes de soltarla;
- no libera si el intento está processing sin antes consultar;
- registra evento;
- es idempotente;
- puede ejecutarse varias veces sin duplicar efectos.

Carrera crítica:

1. A reserva la última unidad.
2. B intenta reservar y recibe stock no disponible.
3. A paga y consume la reserva, o vence y la libera.

Nunca se confía en una lectura seguida de un update sin lock/condición atómica.

## 11. Fulfillment durable e idempotente — implementado localmente

La transacción que autoriza inserta un evento en una tabla outbox. Un worker:

- reclama el evento con lease;
- envía correo o crea tarea de preparación;
- guarda resultado;
- reintenta de forma segura;
- no cambia la verdad financiera.

La página de retorno no despacha directamente. Si el usuario cierra la ventana,
el pedido sigue su curso.

La implementación usa `commerce_outbox`, claves estables de idempotencia para
el proveedor de correo y un estado `uncertain` cuando ya no es seguro repetir
una solicitud. El mismo worker entrega confirmaciones, avisos operativos y
alertas financieras.

## 12. Reembolsos — implementados localmente, apagados por defecto

Ruta administrativa:

1. exigir sesión reciente, rol admin y MFA;
2. proteger contra CSRF y rate limiting;
3. mostrar pago, monto ya devuelto y estado de fulfillment;
4. exigir monto válido, motivo y confirmación explícita;
5. crear refund requested con clave idempotente;
6. llamar Transaction.refund desde backend;
7. persistir resultado y evento;
8. alertar estados inciertos;
9. reflejar inventario solo según una decisión operativa separada.

Reembolsar no repone automáticamente stock: un producto enviado, dañado o
devuelto físicamente requiere inspección.

## 13. Reconciliación y disponibilidad

El endpoint periódico implementado:

- buscar processing atascados y reconciliation_required;
- consultar Transbank dentro de la ventana oficial disponible;
- validar nuevamente montos y correlación;
- finalizar mediante la misma función idempotente;
- alertar diferencias;
- liberar reservas solo con resultado suficientemente cierto.

Falta instalar su llamada cada minuto mediante Supabase Cron/Vault y agregar
alertas/SLA. Vercel Hobby no se usará como scheduler porque limita cron a una
ejecución diaria.

Supabase:

- mantener supabase-js/PostgREST mientras cubra el caso de uso;
- si se introduce conexión PostgreSQL directa, elegir explícitamente el pooler
  apropiado para serverless y medir conexiones;
- mantener transacciones breves;
- medir conexiones, CPU, I/O y queries lentas;
- indexar columnas usadas por RLS;
- probar caída durante create y durante commit;
- tener backup y restauración verificados.

Vercel:

- evitar depender solo de logs efímeros;
- enviar logs estructurados y alertas a un destino durable;
- establecer timeouts explícitos;
- no asumir que una función continuará tras responder.

## 14. Secretos y datos sensibles

Secretos:

- TRANSBANK_COMMERCE_CODE y TRANSBANK_API_KEY_SECRET solo en backend;
- SUPABASE_SERVICE_ROLE_KEY solo en backend;
- credenciales diferentes para Preview y Production;
- variables públicas nunca contienen secretos;
- acceso humano con MFA y mínimo privilegio;
- rotación al sospechar exposición.

Logs:

- no registrar API key, cookies, Authorization, PAN, CVV ni token completo;
- usar correlation_id, order_number y sufijo mínimo de token;
- mantener PII fuera de errores y trazas;
- no incluir shipping_snapshot en logs generales.

La integración redirigida reduce el alcance PCI porque la tarjeta se ingresa en
Webpay, pero no elimina obligaciones de seguridad del sitio, accesos, scripts y
proveedores.

## 15. Decisiones cerradas y datos pendientes

Confirmado:

- carrito Ski Rack preparado para varios ítems y cantidades de 1 a 10;
- publicaciones marketplace siguen como piezas únicas; Ski Rack usa inventario
  agregado por producto, talla y origen;
- checkout invitado, con enlace opcional a una sesión existente;
- ReskiChile es dueño y realiza fulfillment;
- cupones y descuentos calculados server-side.
- orígenes Los Ángeles y Las Condes, asignados por producto;
- cobertura nacional;
- entrega a domicilio y a sucursal/punto.

Pendiente:

- dimensiones y peso del producto embalado;
- impuestos/documento tributario y política de cancelación.

Las migraciones pueden diseñarse con las decisiones confirmadas; la tabla de
despacho se completa al recibir los datos del embalaje.
