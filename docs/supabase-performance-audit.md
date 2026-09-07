# Auditoría de rendimiento de Supabase

Última actualización: 2026-09-06 (America/Santiago)

## Objetivo

Identificar qué está agotando Disk IO y provocando `CONNECT_TIMEOUT`/consultas expiradas, reducir la carga sin perder analítica y recuperar una operación estable antes de ampliar infraestructura.

## Estado actual

- La aplicación puede responder HTML, pero algunas consultas a Supabase expiran.
- La consulta de métricas de visitantes únicos (`COUNT(DISTINCT visitor_id)`) llegó a expirar por `statement timeout`.
- Se midieron aproximadamente **6.840 pageviews en 7 días** desde `public.events`.
- No se pudo obtener el total de visitantes únicos por la saturación de la base.
- Panel Infrastructure (2026-09-07): CPU **100%**, memoria **88%**, Disk IO **100%**.
- Almacenamiento usado: aproximadamente **69.1 MB de base de datos**, **80 MB WAL** y **169.6 MB sistema** sobre un disco de 8 GB. El espacio no es el problema.
- No hay read replicas; agregarlas no resolvería la saturación de escrituras ni el tracking.
- La cola de Stories tenía productos publicados aún programados; ya fue limpiada y compactada.

## Hallazgos confirmados

### 1. Tracking público con lecturas innecesarias

Antes, cada beacon de `/api/track` hacía:

1. lectura de sesión Supabase Auth;
2. lectura de `users.is_admin`;
3. inserción en `events`.

Esto multiplicaba las operaciones por pageview. El tracking público ahora realiza un único insert. Las rutas `/admin` y `/api` ya se descartan antes de insertar.

Cambio: commit `13571cf`.

Nota: el tracking público deja `user_id` en `NULL`; la analítica de visitantes anónimos sigue funcionando mediante `visitor_id`.

### 2. Métricas sin índice específico

Las consultas agregan por `event_type`, rango de fecha y `visitor_id`. Se preparó el índice:

```sql
CREATE INDEX events_type_created_visitor_idx
  ON public.events (event_type, created_at DESC, visitor_id);
```

Migración pendiente: `202609060002_analytics_distinct_visitor_index.sql`.

Supabase no permitió aplicar esta migración durante el incidente (`connection timeout`). No reintentar repetidamente hasta que el proyecto acepte conexiones.

### 3. Consultas del catálogo

El catálogo carga metadata completa de productos aprobados para filtros y además carga una página de productos. Está cacheado 30 segundos, pero debe medirse el tamaño de la tabla y el costo real de cada consulta.

### 4. Crons

Hay múltiples ventanas de publicación de Stories configuradas durante el día. No son el principal sospechoso por volumen, pero deben auditarse para confirmar que no consultan o reintentan filas ya publicadas.

### 5. Consultas amplias que requieren revisión

La auditoría estática encontró varios `select('*')` en mensajes, perfil y detalle de producto. No necesariamente son el origen del incidente, pero aumentan payload y trabajo de serialización. Deben reemplazarse por listas explícitas en las rutas de mayor tráfico.

El panel de métricas lanza varias consultas en paralelo y, para el período histórico, puede consultar rangos muy grandes de `events`. Ese panel debe usar agregados diarios y límites estrictos para no competir con el tráfico público.

El chat usa Realtime solo dentro de `/mensajes`, lo que es correcto; aun así, cada mensaje entrante puede generar actualizaciones de entrega/lectura y debe medirse bajo carga.

## Hipótesis por prioridad

1. Consultas de métricas históricas escaneando muchos eventos.
2. Multiplicación de lecturas causada por el endpoint de tracking.
3. Consultas del catálogo/filtros sobre conjuntos completos.
4. Reintentos o tareas cron sobre capturas ya publicadas.
5. Saturación general de conexiones o Disk IO del proyecto.

## Lectura de Infrastructure

El panel confirma saturación de recursos de ejecución. La opción **Micro** aparece al mismo precio horario que **Nano** y ofrece 1 GB de memoria y CPU de 2 núcleos; es la primera medida de capacidad a evaluar si Supabase permite el cambio sin costo adicional. No conviene aumentar disco, IOPS ni throughput todavía: hay espacio de sobra y esas opciones pueden aumentar el cobro. Una read replica tampoco ataca el problema principal mientras el tracking y las consultas pesadas sigan golpeando al primario.

El cambio de Compute size es una operación de lifecycle y puede reiniciar el proyecto. Debe hacerse solo cuando el incidente de Supabase sobre operaciones de lifecycle esté resuelto y exista una ventana de baja actividad.

## Plan paso a paso

### Paso 1 — Línea base y recuperación (en curso)

- [x] Registrar el síntoma y el error exacto.
- [x] Medir pageviews recientes sin modificar datos.
- [x] Eliminar lecturas Auth innecesarias del tracking.
- [x] Aplicar el índice de eventos cuando Supabase vuelva a aceptar conexiones (migración `202609060002` aplicada el 2026-09-06).
- [ ] Confirmar que las consultas de 7/30/90 días terminan sin timeout.

### Paso 2 — Perfilado de consultas

- Revisar `pg_stat_statements` y logs de consultas lentas.
- Medir latencia y filas leídas por endpoint público.
- Identificar scans completos y consultas con `count` costoso.
- Revisar conexiones activas, esperas por IO y pool.

### Paso 3 — Analítica eficiente

- Mantener eventos crudos con retención definida.
- Crear agregados diarios de pageviews y visitantes.
- Usar esos agregados para el panel Admin.
- Mantener `events` para embudos y auditoría detallada, no para cada gráfico histórico.

### Paso 4 — Catálogo y API

- Medir `fetchCatalogMetadata` y `fetchCatalogProductPage`.
- Evitar cargar metadata completa cuando no sea necesaria.
- Revisar índices por `status`, `product_type`, `brand`, `condition`, `region` y precio.
- Verificar límites de imágenes relacionadas y paginación.

### Paso 5 — Jobs y crons

- Revisar frecuencia y duración de cada cron.
- Confirmar que publicaciones completadas no vuelven a ser elegibles.
- Aplicar límites y backoff a reintentos.
- Evitar tareas concurrentes sobre las mismas filas.

### Paso 6 — Protección operativa

- Alertas de latencia, conexiones, Disk IO y errores.
- Límites de costo para consultas Admin.
- Modo degradado para métricas cuando la base esté bajo presión.
- Procedimiento documentado de recuperación.

## Regla de seguridad

No borrar eventos, capturas ni publicaciones para “limpiar” Disk IO sin un respaldo y una medición previa. Primero se optimizan consultas, índices, retención y agregados.

## Próxima acción

Cuando Supabase esté operativo, ejecutar una sola vez:

```bash
supabase db push
```

Luego medir nuevamente las consultas de métricas y registrar tiempos antes de tocar el catálogo o los crons.

## Backlog técnico priorizado

### P0 — estabilidad

- Confirmar que Nano → Micro queda aplicado y registrar CPU/memoria/IO a 15, 60 y 240 minutos.
- Verificar que no hay capturas publicadas todavía programadas.
- Añadir timeout/circuit breaker a lecturas públicas críticas.

### P1 — reducir IO

- Reemplazar `select('*')` en rutas públicas y de chat.
- Cambiar métricas históricas a agregados diarios.
- Revisar consultas con `count: 'exact'` en cada carga.
- Auditar eventos duplicados por navegación o reintentos de beacon.

### P2 — escalar

- Paginar todas las listas Admin y de mensajes.
- Medir y optimizar consultas del catálogo con `EXPLAIN (ANALYZE, BUFFERS)`.
- Separar trabajos cron y limitar concurrencia.
- Incorporar pruebas de carga en staging.
