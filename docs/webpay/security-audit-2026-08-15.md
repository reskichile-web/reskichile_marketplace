# Auditoría de seguridad de la integración

> Documento histórico. El estado operativo vigente está en
> `activation-readiness-2026-08-18.md`; las ocho migraciones ya fueron aplicadas.

Fecha original: 2026-08-15 · actualización: 2026-08-18
Alcance histórico: el remoto fue actualizado posteriormente; ver el documento
vigente enlazado arriba.

## Resultado ejecutivo

Los defectos críticos detectados en el primer diseño quedaron corregidos. Las
ocho migraciones están aplicadas en Supabase, pero esto **no habilita
producción**: faltan cron, sandbox completo, validación Transbank, tarifas y
configuración operativa de alertas.

| Riesgo | Antes | Corrección local | Estado remoto |
|---|---|---|---|
| caída entre `processing` y `commit` | podía quedar atascado o inducir otro commit | lease durable; `commit_started_at`; recuperación exclusivamente por `status` | aplicada |
| reserva vence durante pago | podía liberar/vender la misma pieza | estados `payment_processing` y `reconciliation_required`; índice único sobre todos los estados retenidos | aplicada |
| deadlock checkout/callback | orden de locks distinto | productos → reservas → orden → intento en todos los RPC sensibles | aplicada |
| campos sensibles de usuario | policy/grant amplio permitía tocar `is_admin` y podía exponer flags futuros como `keep` | allowlist cerrada por columna + trigger de admin + `user_role_events`; columnas nuevas se deniegan por defecto | aplicada |
| payload RPC incompatible | TypeScript esperaba `id` y SQL devolvía `attempt_id` | contrato alineado y prueba funcional completa | corregido local |
| dependencias altas | Next/PostCSS/Sharp y `xlsx` afectados | Next 16.3.1; `xlsx` retirado por lector acotado | `npm audit`: 0 |
| callback/body ambiguo | Content-Type por prefijo y parámetros duplicables | media type exacto, 4 KiB máximo y rechazo de duplicados | corregido local |
| redirección inesperada | host validado, ruta abierta | HTTPS + host por ambiente + puerto/ruta/query/hash cerrados | corregido local |
| kill switch bloquea recuperación | callback/resultado/cron heredaban validaciones de checkout y despacho | configuración separada: se detienen ventas nuevas sin impedir callback, resultado ni conciliación | corregido local |

## Pruebas ejecutadas

```text
TypeScript                  OK
ESLint                      OK (0 errores; 24 advertencias legado)
Next.js production build    OK
npm audit completo          0 vulnerabilidades
Migración foundation        OK en PostgreSQL temporal
Migración hardening         OK en PostgreSQL temporal
Ocho migraciones en CI      OK en PostgreSQL 16 aislado
Vitest                      10 pruebas OK

Prueba transaccional:
initialized → claim(commit) → claim duplicado(wait) → authorized
orden=paid · intento=authorized · reserva=consumed · producto=sold
authenticated UPDATE is_admin=false · UPDATE name=true
```

## Bloqueadores antes de la primera prueba Webpay

| Prioridad | Falta | Cierre esperado |
|---|---|---|
| cerrado | ocho migraciones aplicadas | `supabase migration list` alineado y RPC anónimos bloqueados |
| P0 | cargar stock real por talla/origen | `/admin/inventario`, partiendo en cero |
| P0 | programar jobs | Supabase Cron → reconciliación y outbox con secreto en Vault |
| P0 | ejecutar matriz sandbox | aprobado, rechazado, anulado, timeout, doble callback y caída simulada |

## Bloqueadores antes de producción

| Prioridad | Deuda/riesgo | Motivo |
|---|---|---|
| P0 | tarifas reales y embalaje | producción está bloqueada deliberadamente sin tabla aprobada y dimensiones |
| P0 | correo/alertas operativas | outbox implementado; falta proveedor/destino, cron y prueba de entrega |
| P0 | reembolsos administrativos | implementados y apagados; falta AAL2 real y matriz sandbox |
| P0 | validación técnica Transbank | faltan evidencia, aprobación y API Key Secret productiva |
| P1 | límite de reconciliación | definir cuándo dejar reintentos automáticos y abrir incidente manual |
| P1 | rate limit y proxy | confirmar que Vercel sobrescribe IP forwarding; purgar buckets antiguos |
| P1 | CSP completa | hoy protege framing/form action; falta desplegar una política de scripts probada |
| P1 | cobertura automatizada | CI cubre migraciones, RLS y contratos; falta prueba concurrente y E2E Webpay |
| P1 | privacidad/retención | definir acceso, retención y borrado de dirección/correo/teléfono |
| P1 | continuidad/backups | diferido por decisión; sigue siendo gate para dinero real |

## Deuda funcional visible

- El carrito Ski Rack usa `slug + talla + cantidad` en `localStorage` y ya se
  conecta al checkout server-side; permanece bloqueado si no hay stock/config.
- El inventario Ski Rack es independiente de publicaciones marketplace y admite
  cantidades de 1 a 10, limitadas por stock atómico por talla y origen.
- La página de resultado ya se refresca automáticamente durante estados
  pendientes; depende de que el job de reconciliación esté programado.

## Decisión de scheduler gratuito

Vercel Hobby solo permite cron una vez al día, insuficiente para retener stock y
resolver pagos inciertos. La opción preparada es Supabase Cron/`pg_cron` cada
minuto, que llama por POST al endpoint de Next.js con URL y secreto almacenados
en Vault. Los leases de base hacen que ejecuciones duplicadas sean seguras.
