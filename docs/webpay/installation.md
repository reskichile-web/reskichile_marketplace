# Instalación controlada: Supabase + Webpay sandbox

Estado: ocho migraciones de comercio aplicadas; sandbox bloqueado hasta configurar secretos
Última revisión: 2026-08-18

## Tablero de instalación

| Paso | Estado | Gate |
|---|---|---|
| MCP Supabase | conectado y auditado | conservar acceso mínimo |
| migraciones SQL de comercio | ocho aplicadas y reproducibles | ninguna pendiente al 2026-08-18 |
| RPC de pago/stock/admin | `anon` y `authenticated` revocados | regresión SQL obligatoria en CI |
| Next.js/dependencias | listo | repetir build, audit y pruebas antes del deploy |
| inventario Ski Rack | activo por talla y bodega | verificar conteo físico antes de cada prueba |
| reconciliación/outbox | implementado | falta cargar dos secretos distintos e instalar Cron/Vault |
| Webpay integración | código sandbox listo | falta deploy controlado y matriz real de Transbank |
| producción | cerrada por configuración | tarifas reales, validación Transbank y credenciales productivas |

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

## 3. Auditoría remota

Las ocho migraciones de comercio están aplicadas al proyecto
`kdehuccekavwhhuvvogf`. La auditoría del 2026-08-18 detectó que PostgreSQL había
otorgado `EXECUTE` directamente a `anon` y `authenticated` sobre funciones
`SECURITY DEFINER`, aunque se había revocado `PUBLIC`. La migración
`202608180004_lock_down_commerce_rpcs.sql` corrigió el remoto inmediatamente:

- todas las funciones `public.commerce_*` quedan revocadas para `PUBLIC`,
  `anon` y `authenticated`;
- solo `service_role` recibe `EXECUTE`;
- los privilegios por defecto impiden que una función futura vuelva a abrirse;
- una prueba SQL falla si reaparece cualquier permiso directo;
- los probes anónimos sensibles responden `401` y el servicio interno conserva
  acceso;
- no había órdenes, pagos, reembolsos ni reservas que indicaran explotación.

`supabase db lint --linked --schema public` terminó sin errores de esquema.

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
                            │
                            ▼
supabase/migrations/202608180003_zero_unverified_ski_rack_inventory.sql
                            │
                            ▼
supabase/migrations/202608180004_lock_down_commerce_rpcs.sql
```

Las ocho se ejecutan desde cero en PostgreSQL 16 mediante `npm run test:db`.
La prueba funcional confirma compra de dos racks, descuento único de stock,
outbox durable, reembolso idempotente sin reposición automática y RLS para
anónimo, vendedor y administrador.

Para verificar que local y remoto sigan alineados:

```bash
supabase link --project-ref kdehuccekavwhhuvvogf
supabase migration list
supabase db push --dry-run
supabase db push
```

El dry-run debe indicar que no hay migraciones pendientes. No pegar fragmentos
aislados en SQL Editor ni volver a ejecutar manualmente las migraciones.

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

El inventario existe por `producto + talla + bodega`. Una bodega con stock cero
no participa; si solo Las Condes puede completar el carrito, toda esa compra se
asigna a Las Condes, independiente de la distancia. El administrador ajusta el
conteo físico en `/admin/inventario`. Checkout elige una sola ubicación que
pueda completar el carrito y, en producción, exige una tarifa persistida para
esa ubicación y destino.

Perfil de paquete actualmente configurado para Ski Rack:

```text
largo embalado        15 cm
ancho embalado        10 cm
alto embalado          3 cm
peso talla S          115 ± 5 g
peso talla L          135 ± 5 g
peso usado al cotizar 140 g (máximo conservador de talla L)
```

## 6. Variables server-side

Configuración mínima de integración:

```dotenv
APP_URL=http://localhost:4173
PAYMENTS_ENABLED=false
TRANSBANK_ENVIRONMENT=integration
TRANSBANK_TIMEOUT_MS=8000
INVENTORY_RESERVATION_MINUTES=15
ALLOW_INCOMPLETE_SHIPPING_IN_SANDBOX=false
SANDBOX_BUYER_EMAIL_ALLOWLIST=<correo controlado por el propietario>
CHECKOUT_RATE_LIMIT_SECRET=<aleatorio, 32+ caracteres>
SHIPPING_RATE_SOURCE=sandbox_fixed
SANDBOX_SHIPPING_CLP=3990
ADDRESS_VALIDATION_ENABLED=false
ADDRESS_PROVIDER=google
ADDRESS_PROVIDER_TIMEOUT_MS=5000
```

En un Preview protegido que vaya a crear transacciones, Vercel debe inyectar
además `VERCEL_AUTOMATION_BYPASS_SECRET`. La aplicación falla cerrado si
`PAYMENTS_ENABLED=true`, `TRANSBANK_ENVIRONMENT=integration` y
`VERCEL_ENV=preview`, pero el secreto no existe o mide menos de 32 caracteres.
El bypass se incorpora únicamente al `return_url` y nunca a Production.

Para activar la validación de domicilio se requieren, sólo en el servidor:

```dotenv
ADDRESS_VALIDATION_ENABLED=true
GOOGLE_MAPS_SERVER_API_KEY=<llave restringida>
ADDRESS_VALIDATION_SIGNING_SECRET=<otro aleatorio, 32+ caracteres>
```

`table` exige tarifas aprobadas por origen y comuna/región. Para una prueba
aislada puede usarse `SHIPPING_RATE_SOURCE=sandbox_fixed` junto con un
`SANDBOX_SHIPPING_CLP` explícito; ese valor es ficticio y nunca se admite como
tarifa productiva.

Mantener las variables Supabase existentes. Los secretos deben ser distintos y
nunca usar prefijo `NEXT_PUBLIC_`. En integración no se configuran
`TRANSBANK_COMMERCE_CODE` ni `TRANSBANK_API_KEY_SECRET`: el SDK oficial aporta
las credenciales públicas del sandbox.

`RECONCILIATION_JOB_SECRET`, `OUTBOX_JOB_SECRET`, Resend, refunds y sus jobs no
son requisito para crear la primera transacción Integration. Permanecen
pospuestos hasta validar el flujo Webpay básico.

### Guía segura para los secretos

Para la primera prueba, generar `CHECKOUT_RATE_LIMIT_SECRET` en Terminal. Si se
habilita dirección validada, generar un segundo valor distinto:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Guardarlos como `CHECKOUT_RATE_LIMIT_SECRET` y, cuando corresponda,
`ADDRESS_VALIDATION_SIGNING_SECRET`. No pegarlos en chat, documentación,
capturas ni variables `NEXT_PUBLIC_*`. Después de guardarlos, reiniciar
`npm run dev`.

Cuando exista un despliegue sandbox estable:

1. agregar los cuatro nombres en Vercel → Project → Settings → Environment Variables;
2. usar valores diferentes entre sandbox y producción;
3. guardar el mismo `RECONCILIATION_JOB_SECRET` del despliegue sandbox en
   Supabase Vault para el job de conciliación y `OUTBOX_JOB_SECRET` para el job
   de outbox;
4. verificar primero HTTP `401` con un secreto incorrecto y luego HTTP `200`
   con el correcto, sin registrar el header Authorization;
5. rotar los valores afectados si alguna vez aparecen en chat, logs o una captura.

En un sandbox desplegado, `SANDBOX_BUYER_EMAIL_ALLOWLIST` es obligatoria y puede
contener hasta 20 correos separados por coma. Esto impide que visitantes reales
creen transacciones de integración mientras se prueba el dominio público.

## 7. Instalar reconciliación gratuita

Vercel Hobby solo permite cron diario; no sirve para resolver un pago incierto
ni despachar el outbox en minutos. Se usarán dos jobs de Supabase Cron:

```text
pg_cron ──cada 2 min──> pg_net POST ──Bearer──>
https://DOMINIO/api/cron/payments/reconcile
                                    │
                                    ├─ expira reservas seguras
                                    ├─ consulta status Transbank
                                    └─ finaliza o programa reintento

pg_cron ──cada 5 min──> /api/cron/commerce/outbox
                                    ├─ confirmación al comprador
                                    ├─ aviso de preparación
                                    └─ alertas financieras
```

Procedimiento:

1. desplegar el endpoint en un host HTTPS estable;
2. poner `RECONCILIATION_JOB_SECRET` y `OUTBOX_JOB_SECRET` en Vercel y sus
   equivalentes separados en Supabase Vault;
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
- repetir la medición si cambia el producto, la caja o sus protecciones;
- solicitar a Starken acceso/token de integración para e-commerce propio;
- confirmar con Blue Express si habilita API para el volumen inicial;
- cargar tarifas reales en tabla o decidir una cifra explícita sólo para sandbox;
- indicar si cargará personalmente los secretos en Vercel/Vault (recomendado).

No hace falta todavía la API Key Secret productiva.
