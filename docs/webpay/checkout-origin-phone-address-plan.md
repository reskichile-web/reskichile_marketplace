# Plan de implementación: origen canónico, teléfono y dirección validada

Fecha: 2026-08-19
Estado: implementación local completada; activación y E2E de Preview pendientes
Ámbito inicial: `webpay-sandbox` / Vercel Preview

## 0. Estado de ejecución (2026-08-19)

La implementación se realizó en el orden del plan y quedó protegida por tests:

- [x] Fase 0 local: evidencia de que Vercel Authentication intercepta ambos
      hostnames antes de Next.js y observabilidad normalizada del mismatch.
- [ ] Fase 0 desplegada: falta capturar el `Origin` real de `quote` y revisar
      variables/logs en el equipo Vercel propietario, al que la CLI local no
      tiene acceso.
- [x] Fase 1: redirección GET desde el deployment individual al branch alias,
      POST fail-closed, Origin único y bypass sólo en el retorno Integration
      Preview.
- [x] Fase 2: `PhoneInput` en checkout y validación común cliente/servidor con
      `libphonenumber-js`; persistencia E.164 y defensa SQL.
- [x] Fases 3–4 en código: Google Places/Address Validation server-side,
      feature flag apagado por defecto, tokens opacos, rate limits, timeout y
      circuit breaker.
- [x] Fase 5: migración append-only para ambos RPC y snapshot normalizado e
      inmutable frente a reintentos idempotentes.
- [ ] Activación Google Cloud: proyecto, billing, APIs, cuotas, alertas y
      secretos separados de Preview/Production siguen siendo tareas del
      propietario.
- [ ] Validación E2E: falta desplegar, aplicar la migración y completar una
      transacción Webpay Integration que vuelva al mismo hostname con cookie.

Comandos de regresión verificados:

```text
npm test              77 pruebas
npm run test:db       migraciones + seguridad + checkout de dirección
npm run typecheck     sin errores
npm run lint          sin errores; conserva warnings históricos
npm run build         build de producción correcto
npm run secrets:check sin hallazgos
```

Variables adicionales implementadas:

```dotenv
VERCEL_AUTOMATION_BYPASS_SECRET=<sólo Preview protegido>
ADDRESS_PROVIDER_TIMEOUT_MS=5000
```

## 1. Objetivo

Resolver el bloqueo `INVALID_ORIGIN` del checkout sin relajar Production y
preparar un formulario de compra apto para e-commerce con:

1. un único origen canónico y compatible con el Preview protegido de Vercel;
2. teléfono con código de país, formato visible y validación en cliente,
   servidor y base de datos;
3. direcciones chilenas autocompletadas y validadas contra un proveedor real;
4. datos normalizados que posteriormente puedan utilizar Blue Express,
   Starken u otro courier.

Este trabajo no cambia la lógica de autorización de Webpay, no activa
Production y no configura todavía Cron, Vault, Resend, refunds ni despacho
productivo.

## 2. Hallazgos actuales

### 2.1 Origen del checkout

`assertTrustedCheckoutRequest()` obtiene `request.headers.get('origin')` y
exige igualdad literal con `config.appUrl.origin`. La solicitud se rechaza con
HTTP 403 y `INVALID_ORIGIN` cuando el header falta o difiere.

No existe una validación de `Host` independiente. El frontend usa rutas
relativas, por lo que el navegador envía como `Origin` el origen de la URL que
está abierta.

Orígenes relevantes observados:

```text
Canónico de la rama:
https://reskichileweb-git-webpay-sandbox-reskichile-webs-projects.vercel.app

Deployment individual actual:
https://reskichile-m2ft847df-reskichile-webs-projects.vercel.app
```

Que el branch alias también haya fallado obliga a obtener evidencia del header
real y de la configuración efectiva en runtime antes de cambiar el allowlist.
No se permitirá globalmente `*.vercel.app` ni se confiará en un `Host` enviado
por el cliente.

### 2.2 Teléfono

El checkout usa actualmente un `<input type="tel">` libre. El servidor
normaliza números de 8 a 15 dígitos en formato internacional, pero no verifica
estrictamente la longitud/regla correspondiente al país declarado.

Ya existe `PhoneInput`, que separa código de país y número local, formatea el
valor y contiene reglas por país. Debe adaptarse y reutilizarse en checkout.

Formato canónico de persistencia:

```text
+<código de país><número nacional>

Ejemplo Chile:
+56912345678
```

### 2.3 Dirección

Hoy sólo región se selecciona desde una lista. Comuna, calle y número son texto
libre y el backend sólo verifica longitud. Una cadena válida no demuestra que
la dirección exista ni que sea entregable.

La tabla `orders` conserva la dirección dentro de `shipping_snapshot` JSONB.
Esto permite añadir un snapshot normalizado sin reescribir órdenes históricas,
pero las funciones RPC de creación de checkout necesitarán una migración
append-only para recibir y validar los nuevos campos.

## 3. Decisiones de arquitectura propuestas

### 3.1 Origen canónico

- `APP_URL` continúa siendo la única URL canónica para links, cookies y retorno
  de Webpay.
- Production acepta exclusivamente `APP_URL.origin`.
- En Integration Preview no se aceptarán sufijos abiertos como
  `*.vercel.app` ni valores derivados de headers del request.
- Las variables Vercel `VERCEL_URL` y `VERCEL_BRANCH_URL` sólo podrán usarse
  como evidencia del deployment o para redirigir hacia `APP_URL`; nunca para
  ampliar silenciosamente Production.
- El navegador debe iniciar y terminar el checkout en el mismo hostname para
  conservar la cookie `__Host-reski_order_access` al volver de Webpay.

Solución preferida: corregir configuración/navegación para que todo el checkout
ocurra en el branch alias. Si una URL individual llega al sitio, redirigir las
páginas GET hacia `APP_URL` antes de comenzar el checkout. No se debe permitir
crear una orden en el hostname individual y retornar desde Webpay al branch
alias porque la cookie host-only no cruzará entre ambos dominios.

### 3.2 Teléfono

- Selector explícito de código de país más campo de número nacional.
- Valor enviado y persistido siempre en E.164.
- Misma validación semántica en cliente y servidor.
- La base de datos conserva su defensa de formato; el servidor aplica reglas
  más estrictas antes de invocar la RPC.
- Para Chile se mantiene inicialmente la regla de móvil: nueve dígitos y
  comienzo en `9`.

### 3.3 Dirección

Proveedor recomendado: **Google Places Autocomplete (New) + Address Validation
API**, restringido a Chile (`CL`). Google documenta cobertura de Address
Validation para Chile y un flujo específico de autocomplete para checkout que
termina con Address Validation.

El autocompletado no equivale por sí solo a entregabilidad. La integración del
courier seguirá siendo la autoridad final para cobertura y tarifa.

Flujo propuesto:

```text
Comprador escribe dirección
           |
           v
API propia de autocomplete (sólo CL, rate limit)
           |
           v
Google Places devuelve sugerencias
           |
           v
Comprador selecciona una sugerencia
           |
           v
API propia valida/normaliza con Google Address Validation
           |
           v
Token opaco y temporal de dirección validada
           |
           v
quote/create verifican token + hash de dirección
           |
           v
orders.shipping_snapshot conserva snapshot mínimo
```

Las credenciales del web service serán exclusivamente server-side. El cliente
no recibirá una API key secreta ni podrá convertir nuestros endpoints en un
proxy arbitrario.

## 4. Fases de implementación

### Fase 0 — Diagnóstico reproducible de `INVALID_ORIGIN` (bloqueante)

Objetivo: obtener el valor efectivo sin adivinar ni exponer cookies, tokens o
secretos.

Tareas:

- [ ] Reproducir `/api/checkout/quote` desde branch alias, deployment URL y
      Shareable Link.
- [ ] Capturar en DevTools el header `Origin` de la request fallida.
- [ ] Añadir temporalmente observabilidad sólo en Integration Preview con:
      `origin`, `host`, `x-forwarded-host`, `APP_URL.origin`,
      `VERCEL_BRANCH_URL` y `VERCEL_URL` normalizados.
- [ ] No registrar query strings, cookies, authorization headers, payload de
      compra ni secretos de Vercel.
- [ ] Confirmar que `APP_URL` está aplicada a Preview y específicamente a
      `webpay-sandbox`, no a Production.
- [ ] Confirmar que el deployment se creó después del último cambio de
      variables.
- [ ] Eliminar o reducir la observabilidad temporal una vez identificado el
      mismatch.

Criterio de salida:

- Existe una evidencia de la forma `origin recibido != origin permitido`, o se
  identifica que el header llega ausente.

### Fase 1 — Corrección canónica de Origin/Host

Tareas:

- [ ] Centralizar la resolución de origen confiable en una función server-only.
- [ ] Mantener `APP_URL` como origen permitido en todos los entornos.
- [ ] En Production, probar que cualquier otro origen obtiene HTTP 403.
- [ ] En Integration Preview, redirigir navegación GET desde la URL individual
      hacia `APP_URL` antes de mostrar carrito/checkout.
- [ ] No redirigir endpoints POST; éstos deben continuar fallando cerrado si
      el navegador no llegó desde el origen canónico.
- [ ] Preservar sólo parámetros funcionales conocidos al redirigir. Nunca
      copiar parámetros de bypass/share hacia logs, analytics o links internos.
- [ ] Verificar el comportamiento de Vercel Authentication y Shareable Link en
      el branch alias.
- [ ] Añadir respuesta diferenciada en sandbox para orientar al usuario a la
      URL canónica sin revelar configuración interna.

Pruebas mínimas:

- [ ] Branch alias + Preview + Integration: quote y create atraviesan Origin.
- [ ] Deployment individual: GET redirige al branch alias antes del checkout.
- [ ] Origin externo forjado: HTTP 403.
- [ ] Header Origin ausente: HTTP 403.
- [ ] Production: sólo `https://www.reskichile.cl` o el `APP_URL` productivo
      explícito es aceptado.
- [ ] No se acepta `https://otro-proyecto.vercel.app`.
- [ ] Cookie de acceso está disponible después del retorno de Webpay.
- [ ] `return_url` conserva únicamente el automation bypass en Integration
      Preview y jamás en Production.

Criterio de salida:

- Una compra Integration completa sale y vuelve por el mismo hostname
  canónico, sin ampliar el origen permitido de Production.

### Fase 2 — Teléfono con código y validación estricta

Tareas UI:

- [ ] Reutilizar `PhoneInput` en `CheckoutForm`.
- [ ] Hacer que `required` se aplique también al elemento `<input>` real.
- [ ] Mostrar código de país separado y número nacional formateado.
- [ ] Mostrar el error antes de cotizar, sin depender sólo del navegador.
- [ ] Mantener atributos `type="tel"`, `inputMode="tel"` y autocomplete
      apropiado.

Tareas backend:

- [ ] Crear una única función `parseAndValidatePhone` usada por checkout.
- [ ] Aceptar sólo países soportados por el selector o adoptar una librería
      especializada como `libphonenumber-js`.
- [ ] Rechazar números con longitud válida genérica pero inválidos para el país.
- [ ] Normalizar antes de calcular el fingerprint de idempotencia.
- [ ] Persistir exclusivamente E.164.
- [ ] Mantener el CHECK SQL `^\\+[0-9]{8,15}$` como defensa adicional.

Pruebas mínimas:

- [ ] `+56 9 1234 5678` se guarda como `+56912345678`.
- [ ] Chile sin `9`, incompleto, con dígitos extra o letras: rechazado.
- [ ] Código y longitud de cada país soportado: casos válidos e inválidos.
- [ ] Pegar un número con espacios/guiones no duplica el código de país.
- [ ] Payload manipulado que omite el código: rechazado por backend.
- [ ] DB rechaza cualquier formato no canónico que alcance la RPC.

Criterio de salida:

- Ninguna orden puede almacenarse con un teléfono no canónico o inconsistente
  con el país seleccionado.

### Fase 3 — Preparación segura de Google Maps Platform

Insumos externos requeridos del propietario:

- [ ] Crear o seleccionar un proyecto de Google Cloud.
- [ ] Habilitar billing y definir presupuesto, alertas y cuotas duras.
- [ ] Habilitar únicamente Places API (New) y Address Validation API.
- [ ] Crear credencial exclusiva para este proyecto y cargarla directamente en
      Vercel, nunca en chat o Git.
- [ ] Definir el comportamiento si el proveedor está caído: fail-closed para
      domicilio o fallback manual marcado para revisión.

Variables propuestas, sólo server-side:

```dotenv
ADDRESS_VALIDATION_ENABLED=false
ADDRESS_PROVIDER=google
GOOGLE_MAPS_SERVER_API_KEY=<secreto en Vercel>
ADDRESS_VALIDATION_SIGNING_SECRET=<secreto aleatorio distinto>
```

Controles:

- [ ] Restricción de la credencial a las APIs utilizadas.
- [ ] Cuotas diarias y por minuto coherentes con el volumen inicial.
- [ ] Alertas de gasto.
- [ ] Timeouts y circuit breaker; ningún retry ilimitado.
- [ ] Separar credenciales Preview/Production.
- [ ] No usar prefijo `NEXT_PUBLIC_` para credenciales del web service.

### Fase 4 — Autocomplete y validación de dirección

Endpoints propuestos:

```text
POST /api/checkout/address/autocomplete
POST /api/checkout/address/validate
```

Autocomplete:

- [ ] Input mínimo de 3 y máximo de 120 caracteres.
- [ ] Sólo `includedRegionCodes: ["cl"]`, idioma `es-CL` y tipos de dirección.
- [ ] Session token UUID nuevo por intento de dirección.
- [ ] Debounce en cliente y límite de resultados.
- [ ] Rate limit por IP hasheada y sesión.
- [ ] Field mask mínimo; no devolver la respuesta completa del proveedor.
- [ ] No registrar el texto completo de la dirección.

Validación:

- [ ] La selección se resuelve server-side con el mismo session token.
- [ ] Enviar `regionCode: CL` a Address Validation.
- [ ] Exigir granularidad y verdict suficientes para domicilio.
- [ ] Extraer región, comuna, ruta/calle, número y coordenadas normalizadas.
- [ ] Si falta número, pedirlo y revalidar.
- [ ] No aceptar comuna escrita libremente si contradice la respuesta validada.
- [ ] Generar un token firmado, opaco, con expiración corta, hash de los campos
      y contexto del checkout.
- [ ] `quote` y `create` verifican firma, expiración y hash. Nunca confiar en un
      booleano `validated` enviado por el navegador.

UX propuesta:

- Un solo campo “Busca tu dirección”.
- Al seleccionar, mostrar resumen editable: calle, número, comuna y región.
- Departamento/oficina/referencia permanece separado y no se envía como parte
  de la búsqueda pública.
- Mostrar confirmación explícita antes de pagar.
- Permitir corrección sin reutilizar un token de validación anterior.

### Fase 5 — Persistencia y RPC

No guardar la respuesta completa de Google. Guardar sólo el snapshot mínimo
necesario para cumplir la compra y preparar el despacho, sujeto a revisión de
los términos del proveedor.

Snapshot propuesto:

```json
{
  "country_code": "CL",
  "region": "Metropolitana de Santiago",
  "commune": "Las Condes",
  "street": "Avenida Apoquindo",
  "number": "3000",
  "extra": "Depto. 42",
  "formatted_address": "...",
  "provider": "google",
  "provider_place_id": "...",
  "validation_status": "confirmed",
  "validated_at": "..."
}
```

Tareas:

- [ ] Crear migración nueva; no editar migraciones ya aplicadas.
- [ ] Actualizar ambas RPC de creación de checkout (productos y racks).
- [ ] Validar server-side el token antes de llamar a Supabase.
- [ ] Incluir el hash de dirección validada en el request fingerprint.
- [ ] Asegurar que reintentos idempotentes no puedan sustituir la dirección.
- [ ] Mantener snapshots históricos inmutables.
- [ ] No exponer dirección ni coordenadas mediante RLS/API pública.
- [ ] Mostrar datos únicamente al comprador autorizado y administradores.

### Fase 6 — Integración futura con courier

- [ ] Mapear región/comuna normalizadas a códigos internos de shipping zones.
- [ ] Consultar cobertura del courier con la dirección validada.
- [ ] Calcular tarifa usando bodega seleccionada, paquetes separados, peso y
      dimensiones.
- [ ] Tratar la respuesta del courier como autoridad de entregabilidad.
- [ ] Guardar carrier, servicio, tarifa y plazo como snapshot de la orden.
- [ ] No activar shipping productivo hasta completar pruebas sandbox del
      courier elegido.

## 5. Orden recomendado de entrega

```text
P0  Evidencia y corrección de Origin
    -> desbloquea primera transacción Webpay Integration

P1  Teléfono estricto
    -> evita datos de contacto inutilizables

P2  Google Cloud + autocomplete/validación
    -> reduce direcciones inexistentes o incompletas

P3  Persistencia normalizada + courier
    -> habilita tarifa y cobertura productivas
```

La validación oficial de Transbank no debe depender de terminar Google Maps o
la integración del courier. Para probar Webpay Integration puede usarse una
dirección controlada en sandbox; Origin sí es bloqueante.

## 6. Gate de seguridad antes de Production

- [ ] Production mantiene un único Origin permitido.
- [ ] No existen wildcards de Vercel en allowlists.
- [ ] Bypass de Vercel sólo aparece en el retorno Integration Preview.
- [ ] Teléfono se valida en cliente, servidor y DB.
- [ ] Dirección de domicilio requiere validación server-side vigente.
- [ ] API keys restringidas, separadas y fuera del cliente/repositorio.
- [ ] Rate limits, timeouts, cuotas y alertas probados.
- [ ] Logs no contienen dirección completa, teléfono, cookies, tokens ni keys.
- [ ] RLS y endpoints impiden leer datos personales de otra orden.
- [ ] E2E cubre pago autorizado, rechazado, abortado y retorno sin cookie.
- [ ] Existe fallback operativo para caída del proveedor de direcciones sin
      crear cobros con destino ambiguo.

## 7. Evidencia y documentación oficial

- Vercel, URLs de branch y deployment:
  https://vercel.com/docs/deployments/generated-urls
- Vercel, variables `VERCEL_URL` y `VERCEL_BRANCH_URL`:
  https://vercel.com/docs/environment-variables/system-environment-variables
- Google Places Autocomplete (New):
  https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
- Google Address Validation, cobertura de Chile:
  https://developers.google.com/maps/documentation/address-validation/coverage
- Google, sesiones de autocomplete para checkout:
  https://developers.google.com/maps/documentation/places/web-service/session-pricing
- Google Maps Platform, seguridad de credenciales:
  https://developers.google.com/maps/api-security-best-practices
- Nominatim público, política que prohíbe autocomplete desde cliente:
  https://operations.osmfoundation.org/policies/nominatim/

## 8. Decisiones aplicadas y pendientes del propietario

Para poder avanzar sin activar infraestructura externa se aplicaron estos
defaults conservadores:

1. El checkout conserva los ocho países que ya ofrecía `PhoneInput`, declara
   el país en el payload y valida el número contra ese país. Chile exige móvil
   `+569`.
2. Cuando `ADDRESS_VALIDATION_ENABLED=true`, un domicilio que Google no
   confirma bloquea `quote` y `create`. Con la flag apagada se conserva el
   formulario manual únicamente para Integration; Production no puede
   habilitar pagos nuevos con la flag apagada.
3. No se creó ni modificó un proyecto Google Cloud. Billing, restricciones,
   cuotas y alertas requieren autorización y acceso del propietario.
4. El courier objetivo continúa pendiente; la fase 6 no fue implementada.
