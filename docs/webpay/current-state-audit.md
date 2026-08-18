# Auditoría histórica del mock reemplazado

Fecha: 2026-08-14
Conclusión: el flujo descrito aquí fue retirado del workspace el 2026-08-14 y
no debe restaurarse ni reutilizarse.

Este archivo documenta por qué el código anterior se trató como mock descartable.
No es una validación exhaustiva de toda la aplicación ni una autorización para
producción.

## 1. Inventario encontrado y retirado

- src/lib/transbank.ts
  - construye Webpay Plus con credenciales públicas de integración;
  - expone solo create y commit;
  - no tiene configuración productiva, status, refund, timeouts ni redacción.
- src/app/api/payment/create/route.ts
  - cobra una tarifa fija de publicación;
  - exige que el producto pertenezca al vendedor y esté draft;
  - crea una fila payments y devuelve URL/token.
- src/app/api/payment/confirm/route.ts
  - acepta GET y POST;
  - recibe payment_id desde la URL;
  - ejecuta commit y cambia el producto a pending.
- src/app/pago/resultado/page.tsx
  - muestra aprobado/rechazado/cancelado según un query param.
- package.json / package-lock.json
  - ya incluyen transbank-sdk 6.1.1.

No se encontró la definición de la tabla payments en supabase/schema.sql. La
auditoría remota read-only del 2026-08-18 confirmó que `public.payments` tampoco
existe en el proyecto desplegado y que no hay datos de comercio/Webpay que
limpiar.

## 2. Hallazgos críticos del flujo existente

### Correlación insegura

payment_id proviene de una query controlada por el navegador. El backend confirma
token_ws y luego actualiza la fila indicada por payment_id sin comprobar que el
token, buy_order, session_id, usuario y monto pertenezcan juntos. Una combinación
maliciosa podría confirmar un token y mutar otra orden.

Además, una solicitud sin token puede marcar como rejected cualquier payment_id
alcanzable porque la ruta usa service role.

### Confirmación incompleta

Solo comprueba response_code igual a cero. No exige simultáneamente:

- status AUTHORIZED;
- amount igual al esperado;
- buy_order igual a la orden local;
- session_id igual a la sesión local;
- token almacenado en la misma fila.

### No hay atomicidad

Actualizar payments y después products son operaciones independientes. Una puede
tener éxito y la otra fallar. Tampoco hay locks, compare-and-set, idempotencia ni
protección contra callbacks simultáneos.

### Caso de negocio incorrecto

El flujo cobra PUBLICATION_FEE_CLP, asocia el pago al vendedor y mueve el
producto de draft a pending. Eso corresponde al mock de publicación y no a la
compra tradicional confirmada.

### Estados de retorno incompletos

La ausencia de token se interpreta como cancelación/rechazo. No diferencia de
forma segura los cuatro retornos documentados por Transbank: normal, timeout,
anulación y especial.

### Total y URL

- el monto es una variable fija con fallback 5000, no una orden calculada;
- la return_url deriva del origin del request en vez de APP_URL canónica;
- no existe reserva de inventario;
- no existe snapshot de precios;
- no existe una clave de idempotencia.

### Persistencia y errores

- no se comprueba si guardar el token falló antes de responder;
- se guarda transbank_response completo sin una allowlist de campos;
- errores externos pueden llegar sin redacción a console.error;
- un error de transporte en commit termina en error sin reconciliación;
- no existen alertas ni job de recuperación.

### Interfaz engañable

La pantalla final confía en status del query string. Cualquiera puede abrir
status=approved y ver “Pago exitoso” aunque no exista una orden pagada. La
interfaz no causa por sí sola una autorización, pero es peligrosa para soporte,
usuarios y evidencia.

## 3. Hallazgos del esquema actual

products conserva semántica de marketplace:

- seller_id y perfiles de vendedor;
- publicación/moderación;
- estado sold gestionado por el vendedor;
- contacto directo entre comprador y vendedor;
- policies que permiten al dueño actualizar su fila sin proteger columnas.

Para una tienda dueña del inventario, precio y stock no pueden quedar bajo
escritura del cliente. El nuevo modelo se diseña como órdenes e inventario; no se
añaden unas pocas columnas de pago al flujo de publicación.

La revisión remota confirmó drift de policies/funciones y la columna heredada
`seasons_used`; las migraciones versionadas incluyen el hardening y su retiro.

## 4. Alcance y estado del retiro en Fase 1

Retirado del workspace:

- src/lib/transbank.ts;
- src/app/api/payment/create/route.ts;
- src/app/api/payment/confirm/route.ts;
- src/app/pago/resultado/page.tsx;
- referencias de código a PUBLICATION_FEE_CLP;

Pendiente de limpiar después del despliegue, sin tocar la base:

- PUBLICATION_FEE_CLP de variables de entorno antiguas;
- botones o enlaces que invoquen el flujo, si aparecen en otra rama/entorno.

transbank-sdk se conservó porque es la biblioteca oficial seleccionada. Su
configuración anterior fue retirada y reemplazada por un adaptador server-only.

## 5. Método seguro de retiro

1. Exportar únicamente estructura/metadatos necesarios del proyecto remoto.
2. Identificar si payments contiene datos reales; no borrarla a ciegas.
3. Poner PAYMENTS_ENABLED=false.
4. Retirar endpoints y pantalla del mock.
5. Crear una migración de retiro separada y reversible cuando sea razonable.
6. Ejecutar rg para comprobar que no queden referencias.
7. Ejecutar typecheck, tests y build.
8. Verificar desde Preview que no existe ruta parcialmente activa.
9. Conservar esta auditoría como registro; no conservar secretos o dumps.

No se borrará ninguna tabla remota hasta confirmar contenido, backups y
propiedad de los datos.

## 6. Supabase: investigación diferida

Por instrucción del propietario:

- Supabase permanece en Free durante preparación y sandbox;
- no se investigarán ahora las caídas reportadas;
- no se solicitarán logs, métricas ni accesos para ese propósito;
- no se aplicarán workarounds de foros.

El código revisado usa supabase-js / PostgREST por HTTPS y no se encontró Prisma,
pg, Drizzle ni una conexión PostgreSQL directa. No se modificará pooling.

La revisión de continuidad, límites, backups y restauración permanece como gate
previo a pagos productivos. Diferirla permite avanzar con datos de prueba, pero
no constituye una aprobación de disponibilidad para dinero real.
