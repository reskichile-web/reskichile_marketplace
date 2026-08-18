# Instalación controlada: Supabase + Webpay sandbox

Estado: código local validado; Supabase remoto auditado sin escrituras
Última revisión: 2026-08-18

## Tablero de instalación

| Paso | Estado | Gate |
|---|---|---|
| MCP Supabase limitado al proyecto y read-only | conectado y auditado | mantener read-only; aplicar por CLI revisable |
| migraciones SQL locales | seis validadas en PostgreSQL 16 | falta aplicar al remoto |
| fixes críticos de pago/stock/admin | implementados | falta aplicar remoto |
| Next.js/dependencias | listo | build OK; audit producción 0 |
| inventario Ski Rack | implementado local | falta aplicar migración y cargar stock inicial en admin |
| reconciliación/outbox | código listo | falta Vault + Supabase Cron + correo de alertas |
| Webpay integración | código sandbox listo | ejecutar matriz real de Transbank |
| producción | bloqueada | despacho real, alertas, Transbank, credenciales e infraestructura |

## 1. MCP de Supabase

Configuración versionada del proyecto:

```text
.codex/config.toml
└─ project_ref=kdehuccekavwhhuvvogf
   read_only=true
   features=database,debugging,docs
```

No contiene secretos. El OAuth se guarda fuera del repositorio.

Acción del propietario:

```bash
cd /Users/sebaderpsch/reskichile
codex mcp login supabase
```

Autorizar en el navegador y luego cerrar/reabrir Codex o iniciar una sesión
nueva. Verificación:

```bash
codex mcp list
```

Debe mostrar `supabase`, el project ref correcto, `read_only=true` y una sesión
OAuth activa. La auditoría read-only se completó el 2026-08-18.

## 2. Dominio canónico

`APP_URL` es el único origen público que la aplicación reconoce como propio:

```text
APP_URL=https://www.reskichile.cl
        └──────── origen canónico ────────┘

return_url = APP_URL + /api/payments/webpay/return
cookie     = host del APP_URL
Origin     = debe coincidir exactamente con APP_URL
metadata   = usa APP_URL como base
```

Debe contener solo `https://host`, sin path, query ni fragmento. El 2026-08-17
se verificó que Vercel responde `307` desde `https://reskichile.cl` hacia
`https://www.reskichile.cl/` y que `www` responde `200`; por tanto, la variante
con `www` es el dominio canónico vigente. Preview de Vercel y `localhost` nunca
son el dominio productivo.

Para sandbox local:

```dotenv
APP_URL=http://localhost:4173
```

Para un sandbox remoto se usará un host HTTPS estable separado o un acceso de
prueba protegido; no se activará checkout sandbox públicamente en el dominio
productivo.

## 3. Auditoría remota de solo lectura

Auditoría completada por MCP el 2026-08-18, sin escrituras:

1. el remoto no tiene tablas ni migraciones de comercio/Webpay;
2. no existe una tabla antigua `public.payments`;
3. `products` todavía contiene `seasons_used` y no contiene campos de comercio;
4. `pg_cron`, Vault y `pgcrypto` están disponibles; `pg_net` no está instalado;
5. Security Advisor marcó `search_path` mutable en `handle_new_user` e
   `is_admin`; Database Linter marcó policies redundantes y cuatro FK sin índice;
6. `202608180002_marketplace_security_hardening.sql` corrige esos hallazgos de
   código/esquema sin cambiar la visibilidad funcional esperada.

El MCP permanece read-only durante esta fase. Las migraciones se aplican luego
por CLI con un diff revisable, no mediante escrituras improvisadas del agente.

## 4. Aplicar migraciones

Orden obligatorio:

```text
supabase/migrations/202608140001_commerce_webpay_foundation.sql
                            │
                            ▼
supabase/migrations/202608150001_commerce_payment_hardening.sql
                            │
                            ▼
supabase/migrations/202608170001_remove_seasons_used.sql
                            │
                            ▼
supabase/migrations/202608170002_ski_rack_inventory.sql
                            │
                            ▼
supabase/migrations/202608180001_commerce_operations.sql
                            │
                            ▼
supabase/migrations/202608180002_marketplace_security_hardening.sql
```

Las seis se ejecutan desde cero en PostgreSQL 16 mediante `npm run test:db`.
La prueba funcional confirma compra de dos racks, descuento único de stock,
outbox durable, reembolso idempotente sin reposición automática y RLS para
anónimo, vendedor y administrador.

`202608170001_remove_seasons_used.sql` elimina una columna existente. Antes del
push, exportar cualquier valor que deba conservarse y revisar explícitamente:

```sql
SELECT COUNT(*) AS rows_with_seasons_used
FROM public.products
WHERE seasons_used IS NOT NULL;
```

Solo después de la auditoría remota:

```bash
supabase link --project-ref kdehuccekavwhhuvvogf
supabase migration list
supabase db push --dry-run
supabase db push
```

No pegar fragmentos aislados en SQL Editor. Si el dry-run muestra objetos con
igual nombre y otra semántica, detenerse y crear una migración de compatibilidad.

## 5. Preparar inventario de prueba

El carrito Ski Rack usa `slug + talla + cantidad`. El stock se administra por
producto y talla:

```text
ski_rack_products
       │
       └── ski_rack_inventory
              ├── talla
              ├── origen físico
              ├── stock_on_hand
              ├── reservas activas
              └── disponible = físico - reservado
```

La migración crea S, M y L para `los_angeles` y `las_condes`, siempre con stock
inicial cero para impedir ventas accidentales. El administrador carga el
inventario físico real en `/admin/inventario` antes de habilitar pagos. Checkout
elige una ubicación que pueda completar todo el carrito; en producción compara
las tarifas persistidas de esas ubicaciones.

Referencia de paquete todavía pendiente de validar para Ski Rack:

```text
largo embalado        10 cm
ancho embalado        10 cm
alto embalado         20 cm
peso volumétrico      0,5 kg (informado)
peso físico embalado  0,5 kg provisional
```

La migración no guarda esas medidas como definitivas. `packaged_weight_kg`
almacenará el peso físico real; el peso volumétrico se calcula según el divisor
del transportista. En producción el checkout seguirá bloqueado mientras falte
el perfil de despacho validado.

## 6. Variables server-side

Configuración mínima de integración:

```dotenv
APP_URL=http://localhost:4173
PAYMENTS_ENABLED=false
TRANSBANK_ENVIRONMENT=integration
TRANSBANK_TIMEOUT_MS=8000
INVENTORY_RESERVATION_MINUTES=15
ALLOW_INCOMPLETE_SHIPPING_IN_SANDBOX=true
CHECKOUT_RATE_LIMIT_SECRET=<aleatorio, 32+ caracteres>
RECONCILIATION_JOB_SECRET=<otro aleatorio, 32+ caracteres>
ADMIN_ACTION_RATE_LIMIT_SECRET=<tercer aleatorio, 32+ caracteres>
REFUNDS_ENABLED=false
REFUNDS_REQUIRE_AAL2=true
REFUND_RECENT_SESSION_MINUTES=30
COMMERCE_ALERT_EMAIL=<correo operativo controlado>
SHIPPING_RATE_SOURCE=table
```

`table` exige tarifas aprobadas por origen y comuna/región. Para una prueba
aislada puede usarse `SHIPPING_RATE_SOURCE=sandbox_fixed` junto con un
`SANDBOX_SHIPPING_CLP` explícito; ese valor es ficticio y nunca se admite como
tarifa productiva.

Mantener las variables Supabase existentes. Los secretos deben ser distintos y
nunca usar prefijo `NEXT_PUBLIC_`. En integración no se configuran
`TRANSBANK_COMMERCE_CODE` ni `TRANSBANK_API_KEY_SECRET`: el SDK oficial aporta
las credenciales públicas del sandbox.

### Guía segura para los secretos

Para la primera prueba local, generar tres valores distintos en Terminal:

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

Guardarlos como `CHECKOUT_RATE_LIMIT_SECRET`, `RECONCILIATION_JOB_SECRET` y
`ADMIN_ACTION_RATE_LIMIT_SECRET` en `.env.local`. No pegarlos en chat,
documentación, capturas ni variables `NEXT_PUBLIC_*`. Después de guardarlos,
reiniciar `npm run dev`.

Cuando exista un despliegue sandbox estable:

1. agregar los tres nombres en Vercel → Project → Settings → Environment Variables;
2. usar valores diferentes entre sandbox y producción;
3. guardar el mismo `RECONCILIATION_JOB_SECRET` del despliegue sandbox en
   Supabase Vault para el cron;
4. verificar primero HTTP `401` con un secreto incorrecto y luego HTTP `200`
   con el correcto, sin registrar el header Authorization;
5. rotar los valores afectados si alguna vez aparecen en chat, logs o una captura.

No generar todavía las credenciales productivas de Transbank ni activar
`PAYMENTS_ENABLED=true`.

## 7. Instalar reconciliación gratuita

Vercel Hobby solo permite cron diario; no sirve para resolver un pago incierto
ni despachar el outbox en minutos. Se usarán dos jobs de Supabase Cron:

```text
pg_cron ──cada minuto──> pg_net POST ──Bearer──>
https://DOMINIO/api/cron/payments/reconcile
                                    │
                                    ├─ expira reservas seguras
                                    ├─ consulta status Transbank
                                    └─ finaliza o programa reintento

pg_cron ──cada minuto──> /api/cron/commerce/outbox
                                    ├─ confirmación al comprador
                                    ├─ aviso de preparación
                                    └─ alertas financieras
```

Procedimiento:

1. desplegar el endpoint en un host HTTPS estable;
2. poner el mismo `RECONCILIATION_JOB_SECRET` en Vercel y Supabase Vault;
3. revisar y ejecutar `supabase-cron-install.example.sql`;
4. invocar ambos endpoints una vez y exigir HTTP 200;
5. revisar `cron.job_run_details` y `net._http_response`;
6. crear alerta si el job deja de correr o devuelve 401/5xx.

Los jobs duplicados no repiten `commit`: cada intento usa un lease y, después de
haber iniciado commit, toda recuperación es por `Transaction.status`.

## 8. Primera prueba sandbox

Con migraciones, UUID, env y cron listos:

1. mantener `PAYMENTS_ENABLED=false` durante la inspección;
2. probar quote y rechazo de producto no vendible;
3. activar `PAYMENTS_ENABLED=true` solo en el entorno de prueba;
4. ejecutar aprobación, rechazo, anulación y timeout;
5. repetir callback/doble clic y simular corte posterior a commit;
6. comprobar estados en `orders`, `payment_attempts`,
   `inventory_reservations`, `products` y `payment_events`;
7. verificar que la página se actualice sola durante conciliación;
8. volver a `PAYMENTS_ENABLED=false` al terminar.

La tarjeta se ingresa únicamente en Webpay. No capturar PAN/CVV en screenshots,
logs, analytics ni formularios propios.

`PAYMENTS_ENABLED=false` detiene cotizaciones y ventas nuevas, pero no desactiva
el callback, la página de resultado ni la conciliación. Esos tres caminos usan
configuración independiente para poder cerrar de forma segura una transacción
que ya alcanzó a comenzar en Transbank.

## Datos que debe entregar/confirmar el propietario

- Supabase MCP: OAuth conectado;
- dominio canónico confirmado: `https://www.reskichile.cl`;
- cargar stock inicial por talla en Los Ángeles y Las Condes;
- confirmar con una medición final el peso provisional de 0,5 kg;
- solicitar a Starken acceso/token de integración para e-commerce propio;
- confirmar con Blue Express si habilita API para el volumen inicial;
- cargar tarifas reales en tabla o decidir una cifra explícita sólo para sandbox;
- indicar si cargará personalmente los secretos en Vercel/Vault (recomendado).

No hace falta todavía la API Key Secret productiva.
