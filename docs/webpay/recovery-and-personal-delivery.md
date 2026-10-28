# Recuperación de pagos y entrega personal

La conciliación debe resolver el resultado financiero y la reserva de inventario como una sola operación. Un retorno del navegador no acredita por sí solo un cobro ni su ausencia.

## Defectos corregidos

- Un retorno `special` quedaba indefinidamente en conciliación al recibir `INITIALIZED` de Webpay. Se consulta su estado inmediatamente y una respuesta correlacionada después de 30 minutos permite cerrar el intento como expirado. Se considera la fecha más reciente entre creación e inicio del commit.
- Un retorno contradictorio registrado como `special` podía heredar el fallback `aborted` o `expired` de la petición actual. Ahora conserva su incertidumbre hasta obtener evidencia del proveedor.
- Una consulta exitosa pero inconclusa reiniciaba los reintentos cada 30 segundos. Ahora aumenta el intervalo hasta 15 minutos. A las 24 horas o 100 revisiones se pausa la automatización y se genera una alerta única de revisión manual.
- Los candidatos no filtraban vencimiento, leases ni pausas antes del límite del lote. Ahora esos filtros se aplican antes de seleccionar el trabajo.
- Una respuesta de un trabajador anterior podía sobrescribir la decisión de un trabajador nuevo. La finalización y la programación de errores verifican el identificador de la reclamación vigente.
- La expiración sin evidencia no libera una reserva financiera. Un resultado desconocido, un fallo de red o una correlación incorrecta conserva el stock retenido. Una autorización válida siempre tiene prioridad sobre la antigüedad.

Las protecciones críticas también viven en PostgreSQL, además del servicio, para que los registros antiguos puedan recuperarse durante el despliegue. Las funciones nuevas no son ejecutables por usuarios anónimos o autenticados mediante PostgREST.

## Operación administrativa

El panel permite consultar nuevamente Webpay, incluso después de una pausa. La consulta usa el ambiente del intento original y nunca repite un commit.

Para recuperar una compra sin cobro Webpay, el administrador puede coordinar una entrega personal. La operación rechaza intentos pendientes o inciertos y cobros aprobados; no modifica el monto ni la autorización de ningún intento histórico. El costo de despacho pasa a cero y el nuevo total se calcula en la base. La reserva manual tiene un plazo explícito de siete días.

El pago recibido por transferencia o efectivo se registra por separado, con administrador, importe y referencia obligatorios. No se inventa una autorización Webpay. La base consume la reserva y descuenta el inventario una sola vez; repetir el mismo registro es idempotente. El panel permite preparar y entregar personalmente sin transportista ni tracking, una vez confirmado el pago.

El registro administrativo puede omitir notificaciones por defecto; la acción del panel informa y solicita su envío explícitamente. Ninguno de estos documentos o correos constituye una boleta tributaria del SII. La integración con un facturador es independiente.

## Verificación

`npm test`, `npm run typecheck`, `npm run build`, `npm run lint` y `npm run test:db`.

Las regresiones cubren retornos especiales y contradictorios, ausencia de evidencia, fallos de proveedor, leases obsoletos, correlaciones incorrectas, autorizaciones tardías, pausas y alertas únicas, permisos administrativos, importes inválidos, stock, notificaciones optativas y entrega personal sin seguimiento.
