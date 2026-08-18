# Runbook Webpay Plus: sandbox, validación y producción

Estado: código listo; falta aplicar migraciones y ejecutar contra Webpay
Última revisión: 2026-08-18

## 1. Objetivo

Probar el ciclo completo de una compra realista sin dinero real:

1. construir una orden desde catálogo y stock del servidor;
2. reservar inventario;
3. crear la transacción con el SDK oficial;
4. pagar, rechazar, anular o dejar vencer en Webpay;
5. confirmar o consultar desde backend;
6. validar orden, monto y sesión;
7. consumir o liberar stock correctamente;
8. reconciliar estados ambiguos;
9. reunir evidencia para la validación de Transbank.

Sandbox no prueba por sí solo seguridad, concurrencia, caídas ni operación. La
matriz de este documento completa esa cobertura.

## 2. Ruta correcta en Transbank

Para la aplicación Next.js se debe elegir:

**Desarrollar soluciones para pagos en línea / integración mediante SDK o API.**

La opción **integrar un e-commerce rápido y fácil** corresponde a plugins para
plataformas compatibles como WooCommerce, PrestaShop y Magento. No existe un
plugin oficial equivalente para instalar directamente en este proyecto Next.js.

No se necesita API Key Secret productiva para desarrollar en sandbox. Tampoco
se debe enviar aún la validación: el formulario se completa cuando el flujo y
las evidencias estén listos.

## 3. Prerrequisitos locales

- reglas de carro, stock, checkout y despacho confirmadas;
- mock retirado y PAYMENTS_ENABLED=false por defecto;
- Node 20.19.5 y Next.js 16.3.1;
- `npm audit --omit=dev` sin vulnerabilidades;
- Supabase local o proyecto sandbox separado de producción;
- migraciones de órdenes, reservas y pagos aplicadas en sandbox;
- correo de comprador invitado controlado para pruebas;
- productos de prueba claramente identificados;
- túnel HTTPS solo si se requiere probar desde un entorno remoto;
- reloj del sistema sincronizado.

No usar el código de comercio ni la API Key Secret productivos en local,
Preview, CI o tests.

## 4. Instalación del SDK

Instalación oficial:

~~~bash
npm install transbank-sdk
~~~

Reglas:

- fijar la versión realmente aprobada en package-lock.json;
- revisar release notes, Node requerido y vulnerabilidades transitivas;
- importar el SDK solo desde código server-only;
- encapsularlo detrás de una interfaz propia;
- no importar el adaptador desde Client Components;
- no crear un endpoint genérico que acepte método, URL o monto arbitrarios.

Configuración conceptual de integración:

~~~ts
new WebpayPlus.Transaction(
  IntegrationCommerceCodes.WEBPAY_PLUS,
  IntegrationApiKeys.WEBPAY,
  Environment.Integration,
)
~~~

Usar las constantes del SDK evita copiar la API key pública compartida de
sandbox al repositorio. Confirmar la firma exacta contra la versión instalada:
los ejemplos cambian entre versiones.

Referencias:

- [Cómo comenzar usando un SDK](https://www.transbankdevelopers.cl/documentacion/como_empezar#b-usando-un-sdk)
- [Repositorio oficial del SDK Node.js](https://github.com/TransbankDevelopers/transbank-sdk-nodejs)
- [Ejemplo oficial Webpay Plus Node.js](https://proyecto-ejemplo-node.transbankdevelopers.cl/webpay-plus)

## 5. Ambientes y endpoints

| Ambiente | Host Webpay documentado | Credenciales |
|---|---|---|
| Integración | https://webpay3gint.transbank.cl | constantes públicas del SDK |
| Producción | https://webpay3g.transbank.cl | código de comercio + API Key Secret |

La aplicación no debe construir endpoints desde input del usuario. El ambiente
se selecciona con una variable cerrada y la URL devuelta por create se valida
contra una allowlist de hosts.

Ejemplo de configuración local:

~~~dotenv
APP_URL=http://localhost:4173
PAYMENTS_ENABLED=false
TRANSBANK_ENVIRONMENT=integration
ORDER_CURRENCY=CLP
~~~

Las variables productivas permanecen vacías localmente. PAYMENTS_ENABLED se
activa solo en un entorno controlado cuando las migraciones y tests estén listos.

## 6. Datos públicos de prueba de Transbank

Código de comercio de integración Webpay Plus:

~~~text
597055555532
~~~

Tarjetas aprobadas:

| Tipo | Número | CVV | Resultado |
|---|---|---:|---|
| VISA | 4051 8856 0044 6623 | 123 | aprobada |
| AMEX | 3700 0000 0002 032 | 1234 | aprobada |
| Redcompra | 4051 8842 3993 7763 | no aplica según formulario | aprobada |
| Redcompra | 4511 3466 6003 7060 | no aplica según formulario | aprobada |
| Prepago VISA | 4051 8860 0005 6590 | 123 | aprobada |

Tarjetas rechazadas:

| Tipo | Número | CVV | Resultado |
|---|---|---:|---|
| Mastercard | 5186 0595 5959 0568 | 123 | rechazada |
| Redcompra | 5186 0085 4123 3829 | no aplica según formulario | rechazada |
| Prepago Mastercard | 5186 1741 1062 9480 | 123 | rechazada |

Usar una fecha de vencimiento futura. Para la simulación bancaria documentada:

~~~text
RUT: 11.111.111-1
Clave: 123
~~~

Son datos públicos de integración, nunca datos reales de clientes.

Fuente: [credenciales y tarjetas de integración](https://www.transbankdevelopers.cl/documentacion/como_empezar).

## 7. Prueba manual base

### Preparación

1. Crear un producto sandbox vendible con precio conocido.
2. Confirmar stock inicial y que el navegador no pueda editarlo.
3. Abrir logs redactados con un correlation_id por request.
4. Confirmar que ninguna credencial aparezca en consola, HTML o bundle.

### Inicio

1. Iniciar checkout con product_id y quantity únicamente.
2. Confirmar en PostgreSQL:
   - order y order_items con precio snapshot;
   - cálculo total correcto;
   - reserva activa;
   - payment_attempt created;
   - buy_order y session_id únicos.
3. Confirmar que create usa el total de la orden.
4. Confirmar que el token se persiste antes de responder.
5. Verificar POST a la URL oficial de Webpay, sin iframe.

### Aprobación

1. Pagar con una tarjeta aprobada.
2. El backend recibe token_ws.
3. Ejecuta commit una sola vez.
4. Valida status AUTHORIZED, response_code 0, amount, buy_order y session_id.
5. En una transacción:
   - payment_attempt pasa a authorized;
   - order pasa a paid;
   - reserva pasa a consumed;
   - stock queda confirmado/descontado;
   - se crea el evento financiero append-only.
6. La página de resultado relee la orden por public_id.
7. Refrescar la página no repite commit, stock, email ni preparación.

La autorización encola en la misma transacción una confirmación al comprador y
un aviso operativo. El worker usa lease e idempotencia de proveedor; comprobar
que refresh/callback duplicado no creen ni envíen una segunda operación.

### Rechazo

1. Pagar con tarjeta rechazada.
2. Confirmar que la orden no queda paid.
3. No ejecutar fulfillment.
4. Liberar o mantener la reserva solo según la política de reintento definida.
5. Permitir un nuevo intento sin duplicar la orden ni autorizar dos pagos.

### Anulación

1. Volver desde Webpay sin completar.
2. Clasificar TBK_TOKEN + orden + sesión.
3. Consultar status cuando corresponda; no ejecutar commit como retorno normal.
4. Registrar aborted únicamente con evidencia suficiente.
5. Liberar reserva idempotentemente.

### Timeout

1. Dejar expirar el formulario.
2. Clasificar sesión + orden sin token_ws.
3. No ejecutar commit.
4. Pasar por la reconciliación diseñada.
5. Liberar reserva solo después de descartar autorización.

Tiempos oficiales a considerar:

- token: aproximadamente 5 minutos;
- formulario de integración: aproximadamente 10 minutos;
- formulario productivo: aproximadamente 4 minutos;
- status: disponible hasta 7 días desde la creación.

## 8. Matriz obligatoria

| ID | Escenario | Resultado esperado |
|---|---|---|
| SB-01 | Compra aprobada | un pago, orden paid, reserva consumida, un fulfillment |
| SB-02 | Tarjeta rechazada | no paid, sin fulfillment |
| SB-03 | Usuario anula | estado verificado, reserva liberable |
| SB-04 | Formulario expira | reconciliación, sin falso rechazo |
| SB-05 | Doble clic en pagar | una orden/intención idempotente |
| SB-06 | Dos pestañas misma orden | máximo un intento activo equivalente |
| SB-07 | Callback simultáneo | un commit efectivo y una finalización |
| SB-08 | Refresh/back varias veces | ningún efecto duplicado |
| SB-09 | Alterar precio en DevTools | servidor ignora y recalcula |
| SB-10 | Alterar cantidad | constraint/stock rechaza o recalcula |
| SB-11 | Alterar despacho/descuento | total server-side permanece correcto |
| SB-12 | Cambiar product_id | autorización y stock se vuelven a validar |
| SB-13 | Dos compradores, última unidad | solo uno reserva/compra |
| SB-14 | Token aleatorio o sobredimensionado | 4xx sin llamar a Transbank |
| SB-15 | Orden/token de otro usuario | sin filtración ni mutación |
| SB-16 | Callback especial con ambos tokens | reconciliación, no autorización ciega |
| SB-17 | Timeout de red en create | no redirigir sin token persistido |
| SB-18 | Timeout de red en commit | uncertain, luego status; nunca rejected automático |
| SB-19 | Supabase cae antes de create | sin llamada a Transbank ni reserva fantasma |
| SB-20 | Supabase cae tras commit | reconciliación recupera autorización |
| SB-21 | Reserva vence durante processing | job no sobrevende ni libera ciegamente |
| SB-22 | Reintento tras rechazo | nuevo intento, misma orden si sigue válida |
| SB-23 | Reembolso total sandbox | un refund auditado e idempotente |
| SB-24 | Reembolso duplicado | segunda solicitud no duplica monto |
| SB-25 | Usuario normal llama admin refund | 403, sin llamada externa |
| SB-26 | Secretos en errores/logs/build | ningún secreto ni token completo |
| SB-27 | Rate limit | bloquea abuso sin corromper estado |
| SB-28 | Restaurar backup a entorno aislado | RTO/RPO registrados y datos coherentes |
| SB-29 | Quote de despacho vencido | orden exige recotizar antes de Webpay |
| SB-30 | Cambiar dirección tras cotizar | quote anterior queda inválido |
| SB-31 | Producto sin perfil de embalaje | checkout se bloquea sin cobrar |
| SB-32 | Cupón agotado en dos checkouts | límite atómico; no sobregiro |
| SB-33 | Invitado consulta otra orden | sin PII ni acceso al detalle |
| SB-34 | Producto desde Los Ángeles | tarifa usa ese origen |
| SB-35 | Producto desde Las Condes | tarifa usa ese origen |
| SB-36 | Carrito futuro con ambos orígenes | dos quotes, total suma ambos |
| SB-37 | Cambio de origen tras reserva | operación rechazada |
| SB-38 | Retiro en punto/sucursal | guarda punto válido, no dirección innecesaria |
| SB-39 | WELCOME10 en sandbox | 10%, tope 10.000, sin afectar despacho |

Cada caso debe tener test automatizado cuando sea posible. Las pruebas manuales
se guardan con fecha, build, ambiente, resultado y correlation_id, sin secretos
ni datos de tarjeta reales.

Primera tanda ejecutable tras instalar la base y los dos jobs cron: SB-01 a
SB-27, SB-31 a SB-35 y SB-37 a SB-39. SB-28 sigue diferido y SB-36 pertenece al
carrito multi-origen futuro. Para SB-23 a SB-25 activar `REFUNDS_ENABLED` solo
en sandbox, usar una cuenta administrativa con AAL2 y volver a desactivarlo al
terminar.

## 9. Evidencia para Transbank

Preparar:

- URL estable y dominio canónico;
- logo de 130 x 59 px según la guía de validación;
- descripción del flujo;
- capturas de inicio, Webpay, aprobación, rechazo y comprobante;
- buy_order, monto CLP, fecha y código de autorización de pruebas;
- manejo de anulación, timeout y error;
- HTTPS y retorno a dominio propio;
- versión del SDK;
- datos del comercio solicitados por el formulario;
- contacto técnico y comercial.

No poner API keys, cookies, service role, token completo ni datos personales en
capturas o archivos de evidencia.

## 10. Paso a validación técnica

Cuando todos los gates estén aprobados:

1. Ingresar a la ruta de desarrolladores de Transbank.
2. Elegir validación para solución propia mediante SDK/API, no plugin.
3. Completar los datos del código de comercio ya afiliado.
4. Adjuntar la evidencia requerida.
5. Corregir observaciones sin habilitar producción.
6. Esperar aprobación.

El acceso al contenido público de Transbank Developers no es una credencial de
pago. Si el formulario pide registrar una cuenta, se crea con correo controlado
por ReskiChile, MFA si está disponible y acceso documentado.

## 11. Recepción de credenciales productivas

Después de aprobación Transbank entrega o habilita la API Key Secret.

Procedimiento:

1. El administrador la obtiene desde el canal/portal oficial.
2. No la pega en chat ni la envía por correo.
3. La carga directamente en Vercel, solo ambiente Production.
4. Configura también el código de comercio productivo.
5. Verifica que Preview siga usando integración.
6. Redespliega y confirma mediante una prueba de configuración sin imprimirla.
7. Registra propietario, fecha y rotación; nunca el valor.

Si una clave se expone, detener pagos, rotarla con Transbank, desplegar el nuevo
secreto y revisar logs y transacciones.

## 12. Compra real de validación

La documentación oficial indica una transacción real por CLP 50 después de
configurar producción:

1. PAYMENTS_ENABLED sigue restringido a responsables de validación.
2. Crear producto/orden técnica de CLP 50 de acuerdo con Transbank.
3. Pagar con una tarjeta real propia autorizada.
4. Verificar commit, monto, orden y comprobante.
5. Conciliar en el portal administrativo.
6. Ejecutar la anulación/devolución indicada por Transbank.
7. Confirmar el resultado en portal, base y auditoría.
8. Conservar evidencia redactada.

No usar la tienda pública ni clientes reales para esta validación.

## 13. Activación gradual

1. Confirmar Vercel Pro, Supabase Pro, backups, alertas y restore drill.
2. Activar para responsables internos.
3. Ejecutar compra de bajo monto.
4. Observar creación, retorno, conciliación y fulfillment.
5. Abrir a un porcentaje pequeño o ventana controlada.
6. Revisar diariamente diferencias, rechazos, latencia y reservas.
7. Ampliar solo sin incidentes.

Rollback operativo:

- cambiar PAYMENTS_ENABLED=false;
- conservar callbacks y reconciliación activos para pagos ya iniciados;
- no borrar órdenes, intentos ni eventos;
- mostrar mantenimiento sin aceptar nuevos checkouts.
