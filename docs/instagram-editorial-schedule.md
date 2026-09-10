# Calendario editorial desde el 10 de septiembre de 2026

Hora local `America/Santiago`. Máximo tres bloques editoriales por día. Una tanda
de catálogo (intro y una o dos láminas) cuenta como un bloque, no como una imagen.

| Día | Historias individuales | Reserva de catálogo |
| --- | --- | --- |
| Lunes | 19:30, 19:45, 20:00 | — |
| Martes | 11:30, 12:30 | 20:00 |
| Miércoles | 19:30, 19:45, 20:00 | — |
| Jueves | 18:00, 18:15, 18:30 | — |
| Viernes | 11:30, 12:30 | 20:00 |
| Sábado | 18:30, 18:45, 19:00 | — |
| Domingo | 19:30, 19:45, 20:00 | — |

## Estado y alcance

Las reservas nocturnas no se pueden ocupar con historias individuales. El
generador de servidor y el publicador de tandas están implementados, con ranking
50% novedad y 50% vistas únicas de siete días y rotación de 14 días (ver
`ig-catalog.md`). **Desplegado en producción el 9 de septiembre de 2026 mediante
la integración GitHub → Vercel (`reskichile-webs-projects/reskichile_web`). Las
migraciones 003, 004 y 005 ya están aplicadas.**
La tabla `instagram_catalog_schedule_rules` conserva esos horarios para esa
integración. Los cupos asignables viven en `instagram_story_schedule_rules`.

Verificación de activación: el endpoint autenticado del catálogo respondió
HTTP 200 con `state: idle` fuera de su ventana; sin autenticación responde 401.
Se conservaron las 74 publicaciones históricas y las seis capturas pendientes.
La primera tanda prevista es viernes 11/09: preparar 19:00, publicar 20:00. Desde
el 10/09 las tandas quedan fijadas en martes y viernes, los dos días más
separados del calendario semanal.
No se enviaron historias de prueba. El minuto efectivo depende del plan Vercel,
como se detalla abajo; no se pudo consultar el plan con la cuenta CLI disponible.

## Generación automática y visibilidad

| Día | Generar | Publicar |
| --- | --- | --- |
| Martes | 19:00 | 20:00 |
| Viernes | 19:00 | 20:00 |

`/api/cron/instagram-catalog/[tick]` usa el mismo `CRON_SECRET` que las historias
individuales. La tanda está habilitada por configuración versionada únicamente
en Vercel Production; `INSTAGRAM_CATALOG_ENABLED=false` permite apagarla.
También requiere `INSTAGRAM_PUBLISHING_ENABLED=true`, las credenciales Meta y
Supabase existentes. Los despliegues preview no procesan tandas. Una ejecución
local requiere opt-in explícito con `INSTAGRAM_CATALOG_ENABLED=true`.

La función SQL crea una única tanda por fecha al llegar la hora de preparación.
Un bloqueo con token y vencimiento impide trabajos simultáneos; cuatro intentos
de generación como máximo. Renderiza JPEG 1080×1920 con las plantillas aprobadas
y guarda las imágenes en `product-images/instagram-catalog/`. No necesita un
computador encendido. Con hasta nueve productos genera intro + una lámina; con
diez o más, intro + dos, hasta 18 artículos distintos. Sin inventario no envía intro.

Antes del envío vuelve a comprobar los productos: reemplaza vendidos/pausados,
actualiza precios y regenera solo láminas afectadas todavía no enviadas. Todos
los contenedores deben estar preparados antes de enviar la intro. Cada POST
queda precedido por un checkpoint persistido; una respuesta incierta se consulta
en Meta, no se reenvía ciegamente. El historial de rotación registra solo las
láminas confirmadas, incluso si otra parte de la tanda falla. No inicia envíos
nuevos fuera de la ventana de una hora posterior al horario de publicación.
Durante 24 horas puede recuperar confirmaciones de envíos ya intentados, sin
iniciar nuevas publicaciones fuera de la ventana.

El cronograma del admin muestra pendiente, generando, generada correctamente,
error de generación/publicación y publicada; incluye miniaturas ampliables,
hora de generación, intentos y contador de historias confirmadas. Se actualiza
cada 30 segundos mientras la pestaña esté visible. Una migración ausente o la
automatización desactivada se muestran explícitamente, nunca como éxito.

## Activación coordinada

1. Verificar que el proyecto/equipo Vercel corresponde al dominio activo.
2. Desplegar el código y comprobar los archivos del renderizador en el paquete
   de las funciones. La cola falla cerrada si aún no existen las migraciones.
3. Aplicar las migraciones 003–005, comprobando que ninguna captura esté activa
   durante el cambio de cupos. La migración 003 aborta si detecta ese conflicto.
4. Verificar que Production no tenga el interruptor de apagado en `false` y
   comprobar cron, credenciales, permisos y el cronograma administrativo.
5. Comprobar la primera tanda en su horario, sin disparar publicaciones de prueba
   fuera de la programación.

No aplicar el nuevo calendario SQL contra una versión antigua de la aplicación
ni desplegar en un proyecto ajeno para sortear problemas de acceso.

Los límites se aplican al calendario del cron, no a publicaciones externas desde
Instagram ni al botón explícito de publicación manual inmediata.

Las capturas pendientes se reasignan en orden, nunca antes de su fecha original
ni del inicio de este calendario. No se borran productos, imágenes o publicaciones
completadas. El historial anterior conserva sus cinco cupos originales. Un cupo
ya publicado queda consumido, aunque su captura vuelva al estado reutilizable.

## Cron y cambio de hora

Los disparadores Vercel usan UTC. `vercel.json` cubre las horas diurnas y
nocturnas para UTC−3 y UTC−4. Los ticks del catálogo cubren 21:30–01:00 UTC cada
15 minutos, incluyendo preparación, publicación y recuperación. Cada ruta tiene
una invocación diaria; SQL selecciona los días y horas efectivos en Santiago.
Esos disparadores no equivalen a publicaciones: la cola SQL decide qué
cupo corresponde en Santiago. Se mantiene la precisión del proveedor; en Hobby
la invocación puede retrasarse dentro de la hora. No se garantiza el minuto real.
Para precisión por minuto se necesita un plan compatible (Pro), no simplemente
crear más cron jobs. No cambiar el plan ni contratar servicios sin aprobación.
Referencia: https://vercel.com/docs/cron-jobs/usage-and-pricing.

Las pruebas comparan SQL con TypeScript, comprueban cobertura UTC, capacidad,
reserva de catálogo, horarios de invierno/verano, cupos consumidos y el historial.
