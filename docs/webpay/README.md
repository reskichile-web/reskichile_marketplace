# Integración Webpay Plus — plan maestro

Estado: implementación sandbox local completa; falta instalación remota
Última revisión: 2026-08-18
Responsables: ReskiChile (negocio y operación) + implementación técnica

## 1. Objetivo y alcance

Este documento es la fuente de verdad para reemplazar completamente el mock de
pagos por una integración nueva de Webpay Plus normal para un e-commerce
tradicional.

El cliente compra productos del inventario de ReskiChile. El pago no publica
productos ni transfiere dinero a vendedores externos. El diseño debe proteger la
orden, el precio, el stock y el despacho aunque el navegador sea manipulado.

El mock de cobro por publicación ya fue retirado del código local. Existe una
nueva base de checkout tradicional, todavía sin aplicar al proyecto remoto y
con PAYMENTS_ENABLED=false. No debe considerarse desplegada ni productiva hasta
completar la instalación y las pruebas indicadas en el runbook.

Documentos asociados:

- [Auditoría del mock y nota sobre Supabase](./current-state-audit.md)
- [Auditoría de seguridad actual](./security-audit-2026-08-15.md)
- [Mapa visual de producto, orden y pago](./database-map.md)
- [Mapa HTML horizontal del esquema completo y flujo Webpay](./schema-visual.html)
- [Arquitectura técnica](./architecture.md)
- [Investigación y diseño de despachos](./shipping-research.md)
- [Auditoría del inventario por talla y origen](./inventory-audit-2026-08-17.md)
- [Runbook de sandbox, validación y credenciales](./sandbox-runbook.md)
- [Checklist de seguridad y salida](./security-checklist.md)
- [Variables de entorno de ejemplo](./env.example)
- [Instalación y estado de implementación](./installation.md)
- [Smoke test productivo sin compra del 2026-09-02](./production-smoke-2026-09-02.md)

## Estado de las fases

| Fase | Estado al 2026-08-18 |
|---|---|
| Retiro del mock | Completo en el workspace; falta verificar tras despliegue |
| Dominio SQL | Ocho migraciones aplicadas; pruebas RLS/transaccionales pasan en PostgreSQL 16 aislado |
| SDK/rutas sandbox | Implementado; falta deploy controlado y prueba Webpay real de sandbox |
| Checkout invitado | Implementado para carrito/tallas; despacho por tabla o prueba explícita |
| Conciliación | Endpoint/leases implementados; falta instalar Supabase Cron |
| Refunds/fulfillment | Backend, outbox y panel implementados; falta probarlos contra Webpay sandbox y configurar alertas/correo |
| Validación Transbank/producción | Pendiente y deshabilitada |

## 2. Decisiones confirmadas y pendientes

| Tema | Decisión o estado |
|---|---|
| Producto Transbank | Webpay Plus normal |
| Tipo de comercio | E-commerce tradicional |
| Objeto del cobro | Compra de productos del inventario de ReskiChile |
| Dominio canónico | `https://www.reskichile.cl`; el apex redirige 307 hacia `www` |
| Hosting actual | Vercel Hobby |
| Base de datos actual | Supabase Free, con episodios de inestabilidad |
| Código de comercio productivo | Disponible |
| Afiliación comercial | Aprobada |
| Portal administrativo Transbank | Disponible |
| API Key Secret productiva | Aún no disponible |
| Validación técnica | Aún no realizada |
| Conciliación | A cargo del propietario de ReskiChile |
| Reembolsos | A cargo de un administrador |
| Carrito | Modelo para varios ítems; lanzamiento inicial con un producto |
| Inventario | Activo por producto, talla y origen; validar conteo físico antes de probar |
| Propiedad | ReskiChile es dueño, cobra y despacha el inventario |
| Checkout | Invitado; no requiere crear cuenta |
| Datos comprador | Correo y datos mínimos necesarios para el despacho |
| Descuentos/cupones | Sí, calculados solo en backend |
| Orígenes de despacho | Los Ángeles y Las Condes; checkout elige entre ubicaciones con stock |
| Cobertura | Nacional, sujeta a cobertura real del transportista |
| Modalidades | Domicilio y sucursal/punto de retiro |
| Dimensiones/peso | 15 × 10 × 3 cm; cotización conservadora con 140 g (talla L + tolerancia) |
| Despacho | Selector server-side listo para tabla; APIs de courier pendientes |
| Infraestructura durante preparación | Vercel Hobby y Supabase Free |

Las medidas físicas ya fueron incorporadas. La tabla temporal usa tarifas
públicas; las credenciales reales del transportista siguen pendientes.

## 3. SDK oficial versus integración “rápida y fácil”

La portada de Transbank presenta dos rutas:

1. “Desarrollar soluciones para pagos en línea”: API REST o SDK para una
   aplicación propia.
2. “Integrar un e-commerce rápido y fácil”: plugins para plataformas de
   e-commerce compatibles.

La segunda alternativa no es un plugin universal. La documentación oficial
publica plugins para plataformas como WooCommerce, PrestaShop y Magento. Este
repositorio es una aplicación Next.js propia, por lo que ese plugin no se puede
instalar aquí.

Recomendación: mantener Next.js y usar el SDK oficial de Node.js. Es la ruta
oficial más pequeña para esta arquitectura: ReskiChile crea y confirma la
transacción desde su backend, mientras la captura de tarjeta y autenticación
ocurre en la página alojada por Webpay. ReskiChile no toca PAN ni CVV.

Cambiar a WooCommerce solo para usar un plugin sería una reimplementación del
sitio, catálogo, usuarios, stock y operación. Solo corresponde si se decide
reemplazar la plataforma completa, no como ajuste de seguridad.

Referencias:

- [Opciones para comenzar](https://transbankdevelopers.com/)
- [Plugins oficiales](https://www.transbankdevelopers.cl/plugin)
- [SDK oficial para Node.js](https://github.com/TransbankDevelopers/transbank-sdk-nodejs)
- [Ejemplo oficial Node.js](https://proyecto-ejemplo-node.transbankdevelopers.cl/webpay-plus)

## 4. Fuente de autoridad

El navegador nunca establece precio, total, stock ni estado de pago. Solo envía
la intención de comprar productos identificados.

Antes de iniciar Webpay, el backend debe:

- releer productos, precio vigente y stock desde PostgreSQL;
- validar que estén vendibles;
- calcular subtotal, descuento, despacho y total;
- crear una instantánea inmutable de las líneas de la orden;
- reservar stock de forma atómica;
- generar una orden e intento de pago únicos;
- guardar todo antes de redirigir.

El retorno del navegador tampoco prueba un pago. La autorización se acepta solo
después de consultar a Transbank y comprobar conjuntamente:

- response_code igual a 0;
- status igual a AUTHORIZED;
- amount idéntico al total CLP almacenado;
- buy_order y session_id idénticos a los locales;
- token asociado al mismo intento;
- orden e inventario todavía compatibles con la finalización.

La autorización, el consumo de la reserva y el cambio de la orden a pagada se
ejecutan en una sola transacción PostgreSQL. El fulfillment se dispara una vez
desde el estado persistido, nunca desde parámetros del navegador.

Referencias oficiales:

- [Cómo empezar: ambientes, credenciales, seguridad y producción](https://www.transbankdevelopers.cl/documentacion/como_empezar)
- [Flujo Webpay Plus](https://www.transbankdevelopers.cl/documentacion/webpay-plus)
- [Referencia API Webpay Plus](https://www.transbankdevelopers.cl/referencia/webpay)

## 5. Plataformas actuales: condición para producción

### Vercel

Vercel documenta Hobby para uso personal y no comercial. Una tienda productiva
debe usar un plan que permita uso comercial; actualmente Pro parte en USD 20 al
mes. Pro también amplía observabilidad y controles WAF.

### Supabase

Por decisión del propietario, Supabase Free se mantiene durante desarrollo y no
se investigarán ahora sus caídas. Esto no bloquea el sandbox con datos de
prueba.

Antes de abrir pagos a clientes se deberá reevaluar continuidad y backups:
Supabase Free puede pausar proyectos inactivos, no incluye backups descargables
administrados y usa recursos compartidos. La recomendación productiva continúa
siendo al menos Supabase Pro, backups diarios, restauración probada y una copia
lógica cifrada fuera del proyecto. Esa revisión queda diferida, no eliminada.

Base estimada actual antes de impuestos y consumos extra: Vercel Pro USD 20/mes
+ Supabase Pro USD 25/mes = aproximadamente USD 45/mes. PITR de Supabase puede
evaluarse después; no es requisito inicial si existen backups diarios y una
copia externa restaurable.

Referencias:

- [Vercel Hobby y uso permitido](https://vercel.com/docs/plans/hobby)
- [Precios de Vercel](https://vercel.com/pricing)
- [Precios de Supabase](https://supabase.com/pricing)
- [Checklist de producción de Supabase](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Backups de Supabase](https://supabase.com/docs/guides/platform/backups)

## 6. Fases de ejecución

### Fase 0 — cerrar reglas de negocio

Entregables:

- medir embalaje del primer producto;
- construir una tabla inicial de tarifas con cotizaciones reales;
- definir impuestos y cancelaciones;
- definir estados operativos de la orden.

Gate: el modelo de orden e inventario ya no tiene decisiones estructurales
pendientes.

### Fase 1 — retirar el mock sin abrir pagos

Alcance:

- inventariar rutas, helpers, componentes y datos del mock;
- eliminar sus rutas y comportamiento;
- mantener PAYMENTS_ENABLED=false;
- dejar botones de pago ocultos o claramente deshabilitados;
- comprobar que ningún endpoint parcial acepte pagos.

Gate: el proyecto compila y ya no simula autorizaciones.

### Fase 2 — estabilizar y actualizar la plataforma

Alcance:

- mantener Next.js en una versión soportada y sin advisories productivos;
- actualizar y auditar dependencias;
- fijar Node LTS y builds reproducibles;
- configurar CI con typecheck, lint, pruebas, build, escaneo de secretos y
  dependencias;
- exigir MFA a Vercel, Supabase, Transbank, correo y repositorio;
- mantener las capas gratuitas para desarrollo/sandbox y planificar el cambio
  antes de producción comercial.

Baseline local al 2026-08-18: Next.js 16.3.1, Node 20 fijado,
`npm audit --omit=dev` con 0 vulnerabilidades y build de producción correcto. La
librería `xlsx` sin parche se reemplazó por un lector limitado a 10 MB, 5.000
filas y 250 columnas. CI ejecuta secretos, audit, lint, tipos, Vitest, las ocho
migraciones sobre PostgreSQL 16 y build.

Gate: plataforma estable, soportada, respaldada y sin vulnerabilidades críticas
o altas sin mitigación aprobada.

### Fase 3 — dominio de comercio en PostgreSQL

Alcance:

- crear migraciones versionadas para órdenes, líneas, reservas, intentos de
  pago, cotizaciones de despacho, promociones, eventos y reembolsos;
- separar estado de orden, pago, stock y fulfillment;
- hacer inmutables los snapshots de precio y total después de iniciar pago;
- impedir escrituras de precio, stock y estados sensibles desde el cliente;
- habilitar RLS y revocar acceso directo a tablas de pago;
- crear operaciones atómicas e idempotentes;
- probar concurrencia: dos compradores para la última unidad.

Gate: la base rechaza manipulación de precio, sobreventa, doble cobro y doble
fulfillment aunque el cliente sea hostil.

### Fase 4 — adaptador Webpay y sandbox

Alcance:

- instalar transbank-sdk en el backend;
- aislar create, commit, status y refund en un módulo server-only;
- usar las constantes oficiales de integración en sandbox;
- validar return_url y el host devuelto por Transbank;
- redactar tokens y credenciales de logs;
- implementar los cuatro retornos documentados;
- ejecutar la matriz completa del runbook.

Gate: evidencia repetible de sandbox, incluidos rechazo, cancelación, timeout,
concurrencia y manipulación.

### Fase 5 — checkout, reserva e idempotencia

Alcance:

- validar identidad según la decisión de checkout;
- releer catálogo y calcular todo en backend;
- reservar stock atómicamente con vencimiento;
- evitar doble inicio por reintento o doble clic;
- persistir el token antes de responder;
- redirigir por POST a Webpay, sin iframe;
- aplicar protección CSRF/origen y rate limiting.

Gate: no se puede alterar un total, comprar stock inexistente ni crear varios
intentos activos equivalentes.

### Fase 6 — confirmación y fulfillment

Alcance:

- confirmar server-to-server con commit o consultar status según el retorno;
- validar todos los campos contra la orden;
- finalizar pago, orden y reserva atómicamente;
- mostrar un comprobante consultado desde la base;
- enviar correos y activar preparación solo una vez;
- crear reconciliación automática de estados inciertos.

Gate: callbacks duplicados, fuera de orden o interrumpidos producen el mismo
resultado correcto.

### Fase 7 — operación, reembolsos y observabilidad

Alcance:

- panel administrativo con MFA y mínimo privilegio;
- refund solo desde backend, con motivo y auditoría;
- alertas por errores, pagos inciertos, diferencias y stock bloqueado;
- conciliación diaria por el responsable;
- runbooks de caída de Supabase, Transbank, Vercel y correo;
- restore drill y respuesta a incidentes.

Gate: se puede operar y recuperar la tienda sin editar filas manualmente.

### Fase 8 — validación Transbank y producción

Alcance:

- reunir evidencia exigida por Transbank;
- completar el formulario para integración propia SDK/API;
- recibir y cargar la API Key Secret directamente en Vercel Production;
- nunca copiar el secreto al repositorio, chat, capturas o tickets;
- ejecutar compra real de validación por CLP 50 según instrucción oficial;
- verificar devolución/anulación si corresponde;
- activar pagos gradualmente y monitorear.

Gate: aprobación técnica, credenciales productivas, infraestructura Pro, backups,
alertas y checklist firmado.

## 7. Credenciales: situación y siguiente paso

Tener código de comercio y afiliación aprobada, pero no API Key Secret, es
coherente con no haber pasado todavía la validación técnica. Según Transbank, la
credencial productiva se habilita después de aprobar esa validación.

Por ahora:

- no se necesita una API Key Secret para el sandbox;
- se usan las credenciales de integración provistas por el SDK oficial;
- no se debe inventar, reutilizar ni solicitar por chat una clave productiva;
- se prepara y prueba la integración;
- luego se elige en Transbank la ruta de “desarrollar soluciones para pagos en
  línea” / integración SDK o API;
- después de la aprobación, el administrador carga la clave directamente como
  secreto de Vercel Production.

No es necesario enviar ahora el formulario de validación: primero debe existir
un flujo sandbox estable y evidencia completa.

## 8. Criterios de no salida

No se habilitan pagos reales si ocurre cualquiera de estos puntos:

- no se ha realizado la revisión de continuidad diferida de Supabase;
- Vercel continúa en Hobby para el sitio comercial;
- Supabase continúa en Free sin estrategia restaurable;
- faltan backups probados;
- Next.js o dependencias críticas están fuera de soporte;
- el cliente puede escribir precio, stock o estado;
- no existe reserva atómica de inventario;
- no se probaron callbacks duplicados y estados inciertos;
- no está programada la conciliación o no existen alertas;
- credenciales se exponen en variables públicas o logs;
- Transbank no ha aprobado técnicamente la integración.

## 9. Definición de terminado

La integración termina cuando:

- el mock desapareció;
- todas las reglas comerciales viven en backend/base;
- el sandbox pasa la matriz completa;
- la plataforma es estable y respaldada;
- Transbank aprueba y entrega credenciales;
- una compra real de validación se concilia correctamente;
- una devolución de prueba queda auditada;
- pagos productivos se activan gradualmente con monitoreo;
- documentación y runbooks reflejan el código realmente desplegado.
