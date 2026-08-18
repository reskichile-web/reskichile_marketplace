# Webpay Plus: preparación final de sandbox y producción

Fecha de corte: 2026-08-18

## Resultado de la auditoría

El flujo de pago ya no es un mock. La aplicación crea la orden y la reserva en
PostgreSQL, calcula monto, descuento y despacho en backend, inicia Webpay con el
SDK oficial, confirma el token server-side y finaliza pago, stock y outbox en
operaciones idempotentes.

El hallazgo crítico de esta revisión fue un permiso directo de Supabase sobre
funciones `SECURITY DEFINER`: revocar `PUBLIC` no había revocado los grants que
Supabase asignó a `anon` y `authenticated`. La migración
`202608180004_lock_down_commerce_rpcs.sql` ya está aplicada al remoto. Los RPC
`commerce_*` sensibles ahora son exclusivos de `service_role`, existe una prueba
de regresión y los probes anónimos devuelven `401`.

También se corrigió:

- el bloqueo artificial que impedía todo checkout productivo; producción ahora
  abre solo si existen credenciales y una tarifa real coincidente;
- una allowlist obligatoria de correos para un sandbox desplegado;
- secretos separados para conciliación y outbox;
- respuesta controlada si falta la configuración de conciliación;
- CSP más restrictiva y eliminación del header `X-Powered-By`.

## Estado de los gates

| Gate | Estado |
|---|---|
| Base y migraciones remotas | listo |
| RPC sensibles cerrados al navegador | listo |
| Stock por producto, talla y bodega | listo; requiere conteo físico vigente |
| Credenciales sandbox | listas en el SDK; no se solicitan en el portal |
| Sandbox desplegado | pendiente de variables y deploy |
| Cron de conciliación/outbox | pendiente de secretos y Vault |
| Matriz E2E Webpay | pendiente |
| Validación técnica Transbank | pendiente de evidencia sandbox |
| API Key Secret productiva | Transbank la entrega tras aprobar validación |
| Tarifas productivas | pendiente; no hay tarifas activas |
| Pagos reales | deben permanecer apagados |

## Variables para el sandbox desplegado

Cargar directamente en Vercel, sin copiar valores al chat. Usar el ambiente del
deployment donde se hará la prueba:

```dotenv
APP_URL=https://HOST-HTTPS-ESTABLE
PAYMENTS_ENABLED=false
TRANSBANK_ENVIRONMENT=integration
TRANSBANK_TIMEOUT_MS=8000
SHIPPING_RATE_SOURCE=sandbox_fixed
SANDBOX_SHIPPING_CLP=3990
ALLOW_INCOMPLETE_SHIPPING_IN_SANDBOX=false
SANDBOX_BUYER_EMAIL_ALLOWLIST=TU_CORREO_CONTROLADO
INVENTORY_RESERVATION_MINUTES=15
CHECKOUT_RATE_LIMIT_SECRET=<secreto 1>
RECONCILIATION_JOB_SECRET=<secreto 2>
OUTBOX_JOB_SECRET=<secreto 3>
ADMIN_ACTION_RATE_LIMIT_SECRET=<secreto 4>
REFUNDS_ENABLED=false
REFUNDS_REQUIRE_AAL2=true
COMMERCE_ALERT_EMAIL=<correo operativo>
RESEND_API_KEY=<secreto del proveedor>
EMAIL_FROM=ReSkiChile <noreply@reskichile.cl>
```

Generar cada secreto por separado con `openssl rand -hex 32`. No configurar
`TRANSBANK_COMMERCE_CODE` ni `TRANSBANK_API_KEY_SECRET` en integración: la
versión instalada del SDK oficial usa las credenciales públicas del sandbox.

Después del primer deploy, verificar con `PAYMENTS_ENABLED=false` que quote y
create respondan `503 PAYMENTS_DISABLED`. Solo entonces cambiarlo a `true` para
los correos autorizados. Cualquier otro correo debe recibir `403` antes de leer
stock o crear una transacción.

## Supabase Cron y Vault

Crear dos secretos distintos en Vault:

```text
reski_payment_reconciliation_secret = RECONCILIATION_JOB_SECRET
reski_commerce_outbox_secret         = OUTBOX_JOB_SECRET
```

Usar las URLs HTTPS del mismo deployment y ejecutar, después de revisar los
cuatro `CHANGE_ME`, `docs/webpay/supabase-cron-install.example.sql`. Primero
probar que un bearer incorrecto responde `401`; luego comprobar `200` con cada
secreto correcto y revisar `cron.job_run_details` y `net._http_response` sin
mostrar headers.

## Lo que debes hacer en Transbank

### Ahora, para sandbox

No necesitas generar ni copiar credenciales desde el portal. Confirma solamente
en Portal de Clientes que Webpay Plus está contratado y anota el código de
comercio productivo en un gestor seguro; no lo pongas todavía en Vercel sandbox.
La integración usa Webpay Plus normal mediante SDK/API, no el flujo de plugins.

Ejecuta y conserva evidencia de aprobación, rechazo, anulación, timeout, doble
callback, refresh, monto manipulado y dos compradores sobre la última unidad.
Las tarjetas y credenciales bancarias de prueba están en el runbook y en la
documentación oficial; nunca uses tarjetas reales en integración.

### Cuando pase la matriz sandbox

1. Prepara el logo de la tienda en GIF o PNG de 130 × 59 px.
2. Abre `https://www.transbankdevelopers.cl/documentacion/como_empezar`.
3. Ve a “El proceso de validación”.
4. Elige el formulario de Webpay Plus con SDK/API, no el de plugin. Al
   2026-08-18 el enlace oficial apunta a
   `https://form.typeform.com/to/ibXdg6Av`.
5. Ingresa el código de comercio productivo y la evidencia solicitada, sin API
   keys, cookies, service role ni tokens completos.
6. Espera la revisión. Si hay observaciones, corrígelas y reenvía evidencia.

Transbank indica que la validación es requisito para producción. Tras aprobar,
entrega la API Key Secret según sus instrucciones oficiales; esa llave funciona
como contraseña del comercio y no se comparte.

### Producción

1. Carga en Vercel Production, nunca en Preview ni en el chat:
   `TRANSBANK_COMMERCE_CODE`, `TRANSBANK_API_KEY_SECRET` y
   `TRANSBANK_ENVIRONMENT=production`.
2. Cambia `SHIPPING_RATE_SOURCE=table` y carga tarifas reales activas. El modo
   `sandbox_fixed` es rechazado por configuración productiva.
3. Conserva `PAYMENTS_ENABLED=false`, despliega y valida configuración, jobs,
   correo, stock, MFA administrativa y monitoreo.
4. Activa únicamente para la prueba controlada indicada por Transbank.
5. La documentación oficial exige una compra real de CLP 50 para finalizar la
   puesta en producción. Verifica la misma operación en Portal Transbank, orden,
   intento de pago, evento y stock.
6. Recién después abre ventas gradualmente. Si hay una diferencia, vuelve
   `PAYMENTS_ENABLED=false`; callback y conciliación deben continuar activos.

## Bloqueadores actuales para cobrar dinero real

- falta desplegar estos fixes;
- falta elegir el correo autorizado para sandbox y cargar cuatro secretos;
- falta instalar/verificar los dos jobs de Supabase Cron;
- falta ejecutar y documentar la matriz E2E;
- falta enviar y aprobar la validación Transbank;
- falta recibir/cargar la API Key Secret productiva;
- faltan tarifas reales de despacho en la base.

No corresponde activar producción antes de cerrar esos siete puntos.
