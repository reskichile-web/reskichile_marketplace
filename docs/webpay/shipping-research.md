# Investigación de cálculo de despachos para ReskiChile

Estado: Starken seleccionado como courier oficial; integración de cotización preparada
Última revisión: 2026-09-02

## 1. Decisiones de negocio recibidas

- El modelo soportará carrito, aunque al comienzo solo habrá un producto.
- Cada unidad vendida corresponde a un par de soportes.
- ReskiChile es dueño, cobra y despacha el inventario.
- Cualquier persona puede comprar sin crear una cuenta.
- Correo y dirección de envío son obligatorios.
- Habrá descuentos/cupones.
- Vercel y Supabase continúan gratis durante desarrollo y sandbox.
- Cada producto sale desde Los Ángeles o Las Condes.
- Se ofrecerá cobertura nacional.
- Se ofrecerá entrega a domicilio y a sucursal/punto.
- La caja terminada mide 15 × 10 × 3 cm.
- Peso medido: talla S 115 ± 5 g y talla L 135 ± 5 g.
- Para cotización se usa conservadoramente el máximo de la talla L: 140 g.

## 2. Cómo calculan despacho otros e-commerce

Los patrones más comunes son:

1. Tarifa plana por zona, pedido o clase de producto.
2. Envío gratis por ubicación, monto mínimo o cupón.
3. Retiro local.
4. Tabla de tarifas según zona, peso, volumen o tipo de producto.
5. Cotización dinámica server-to-server con un courier o agregador.

WooCommerce incluye tarifa plana, envío gratis y retiro como opciones base, y
permite que extensiones agreguen otros métodos. Es una referencia útil del
modelo, aunque ReskiChile no use WooCommerce.

Fuente: [opciones de despacho de WooCommerce](https://woocommerce.com/documentation/woocommerce/shipping/core-shipping-options/).

## 3. Variables reales de una cotización

Para cotizar correctamente se necesita:

- comuna/código de cobertura de origen;
- comuna/código de cobertura de destino;
- dirección validable si se ofrece entrega a domicilio;
- largo, ancho y alto del paquete ya embalado;
- peso físico;
- valor declarado cuando lo solicite el courier;
- nivel de servicio: estándar, prioritario, mismo día u otro;
- entrega a domicilio o sucursal/punto;
- número de piezas físicas.

Decisión ReskiChile: cada unidad comprada viaja en una caja terminada separada.
En la tabla propia, `amount_clp` es por caja y el total se multiplica por el
número de unidades. La futura API del courier debe recibir todas las piezas y
su respuesta reemplazará esa multiplicación cuando el contrato lo indique.

El tamaño del producto sin embalar no basta. Hay que medir la caja o envoltorio
final, incluyendo protecciones.

Algunos operadores cobran por el mayor entre peso físico y peso volumétrico.
Shipit, por ejemplo, documenta largo × ancho × alto en centímetros dividido por
4000. Ese divisor no debe aplicarse universalmente: cada proveedor y contrato
puede usar reglas diferentes.

Fuente: [términos de tarificación de Shipit](https://www.shipit.cl/terminos-y-condiciones-shipit).

## 4. Alternativas evaluadas

### A. Tabla propia de tarifas por zona

Funcionamiento:

- ReskiChile obtiene cotizaciones reales para paquetes representativos;
- agrupa comunas/coberturas en zonas;
- fija un valor por zona y perfil de paquete;
- versiona y revisa la tabla periódicamente.

Ventajas:

- no depende de una API durante checkout;
- implementación pequeña;
- fácil de probar;
- compatible con bajo volumen;
- puede operar manualmente con distintos couriers.

Riesgos:

- ReskiChile absorbe diferencias si la tabla queda desactualizada;
- regiones extremas y productos sobredimensionados requieren reglas propias;
- una sola tarifa nacional puede perder dinero o resultar injusta.

Uso recomendado: MVP y sandbox, siempre con perfiles de embalaje medidos y
margen operativo explícito. No inventar valores aproximados sin cotizaciones.

### B. API directa de Chilexpress

Chilexpress ofrece APIs para:

- consultar cobertura;
- validar direcciones;
- cotizar según dimensiones y coberturas;
- generar órdenes de transporte y etiquetas;
- consultar seguimiento.

El portal indica que el uso de las APIs no tiene costo y que se paga el
transporte. Permite registrar una cuenta y obtener una key de pruebas. La
generación productiva de órdenes puede requerir una TCC y habilitación de
servicios.

Consideraciones para productos largos:

- Chilexpress documenta Encomiendas Grandes cuando alguna dimensión supera
  70 cm o el peso supera 15 kg;
- la API rechaza medidas superiores a 200 cm o peso mayor a 100 kg;
- se debe verificar el embalaje real del “par” antes de elegir este courier.

Ventajas:

- tarifa y cobertura más cercanas a la operación real;
- un solo proveedor y contrato;
- API de pruebas y herramientas de etiqueta/seguimiento.

Riesgos:

- dependencia del courier durante checkout;
- credenciales y nueva integración server-side;
- debe existir una tarifa fallback aprobada o el checkout se detiene;
- una cotización no reemplaza la posterior creación y conciliación del envío.

Fuentes:

- [Portal Chilexpress Developers](https://developers.wschilexpress.com/)
- [FAQ de APIs y límites de piezas](https://developers.wschilexpress.com/faq)

### C. Starken

Starken documenta integraciones API REST/SOAP para cotización, emisión de la
orden de flete, etiquetas, seguimiento y prueba de entrega. Su cotizador recibe
origen, destino, peso y dimensiones; puede devolver alternativas a domicilio o
sucursal. Esto existe y es aplicable a un e-commerce propio.

No es una API pública anónima: para cobrar el despacho junto con la compra se
requiere la modalidad comercial correspondiente. La documentación de plugins
indica que el token se solicita iniciando sesión en Starken Pro y que una Cuenta
Corriente permite envío pagado online. También exige probar en sandbox y usar
medidas/peso reales, porque Starken los verifica y puede corregir el precio.

Fuentes oficiales:

- [Integraciones Starken](https://starken.cl/integraciones)
- [API de cotización Starken](https://developers.starken.cl/cotizaTusEnvios)
- [Requisitos y token de plugins Starken](https://developers.starken.cl/plugins)
- [Cuenta empresa Starken](https://starken.cl/empresas)

Conclusión: es el primer candidato para una prueba de API personalizada, pero
faltan cuenta/habilitación, token y especificación técnica entregada al cliente.

### D. Blue Express

Blue Express promociona integraciones sin apertura, mantención ni mínimo de
envíos. El precio público “desde $3.100” no es una tarifa nacional: corresponde
específicamente a un envío a Punto Blue Express dentro de la misma ciudad.
Su página actual dirige el segmento de 1 a 500 envíos mensuales a plugins para
Shopify, WooCommerce y Bsale; la integración API personalizada aparece en el
segmento de más de 500 envíos mensuales.

Como ReskiChile usa Next.js y parte con bajo volumen, no se considera la primera
integración dinámica. Sus tarifas públicas sí pueden servir para comparar y
construir la tabla inicial o para generar envíos manuales.

La cuenta empresa/e-commerce requiere inicio de actividades en el SII y opera
con facturación mensual a 30 días. La modalidad persona natural es manual y no
incluye integración con tiendas online.

Fuentes oficiales:

- [Integraciones e-commerce de Blue Express](https://www.blue.cl/empresas/soluciones-ecommerce)
- [Tipos de cuenta Blue Express](https://ecommerce.blue.cl/auth/register)

### E. Agregador Shipit

Shipit ofrece una API con cotizador por dimensiones y destino, múltiples
couriers, órdenes, seguimiento, cobertura y webhooks.

Ventajas:

- una integración para varios couriers;
- comparación de precio/plazo;
- soporte operativo, etiquetas y seguimiento.

Costos/condiciones observados:

- el plan Inicia anuncia primer mes gratis y luego 0,5 UF mensual;
- el multicourier forma parte del plan Despega, anunciado en 1,5 UF + IVA;
- además se paga cada envío;
- sus términos reconocen posibles diferencias entre la cotización del carrito y
  el valor final.

Esto agrega costo y un proveedor adicional, por lo que no calza con mantener
todo gratuito durante la preparación. Puede reevaluarse al aumentar volumen.

Fuentes:

- [API de Shipit](https://developers.shipit.cl/reference/comienza-con-nuestra-api)
- [Planes de Shipit](https://www.shipit.cl/precios)
- [Condiciones de tarificación](https://www.shipit.cl/terminos-y-condiciones-shipit)

## 5. Recomendación por etapas

### Etapa inicial: tabla server-side y selección multi-origen

Usar tarifa por zona y perfil de paquete:

- permite terminar el checkout y sandbox de Webpay sin contratar logística;
- no agrega una dependencia externa al retorno de pago;
- funciona bien con el volumen inicial;
- luego puede reemplazarse por una API sin cambiar el modelo de orden.

La tabla no vive en el frontend. Debe almacenarse/versionarse en PostgreSQL y
ser editable solo por administrador.

Como existen dos orígenes, la tarifa se identifica por:

- origin_id;
- zona/código de destino;
- modalidad domicilio o punto;
- perfil del paquete;
- servicio.

El inventario se representa por `(producto, talla, origen)`. Para una compra, el
servidor considera solamente orígenes capaces de completar todo el carrito. De
esos orígenes elige la menor tarifa aprobada; usa plazo máximo como desempate.
La distancia geográfica puede ser el último desempate, pero nunca reemplaza la
cotización: una bodega más cercana puede ser más cara o no tener cobertura.

Si ninguna ubicación puede completar el carrito, una versión futura podrá
dividirlo en dos envíos. La primera versión lo rechaza para no ocultar un doble
costo al comprador.

### Etapa siguiente: prueba API Starken

1. crear/habilitar cuenta Starken Pro o Cuenta Corriente;
2. solicitar acceso de integración para un e-commerce Next.js propio;
3. recibir token, endpoints y documentación de sandbox;
4. cotizar desde Los Ángeles y Las Condes con el mismo paquete;
5. comparar costo/plazo y persistir la opción exacta elegida;
6. integrar emisión, etiqueta y tracking sólo después del pago autorizado;
7. mantener tabla aprobada como fallback, sin inventar precios.

Decisión del 2026-09-01: Starken será el courier predeterminado. La cotización
oficial usa el token de Starken Pro y selecciona únicamente despacho NORMAL a
domicilio pagado con Cuenta Corriente. Las alternativas "por pagar" no se
ofrecen en checkout porque el comprador ya debe conocer y pagar el total.

Como puente de lanzamiento puede usarse `SHIPPING_RATE_SOURCE=table`. Starken
publica su modelo Tarifa Simple por zonas y tamaños, por lo que una tarifa fija
sí es viable para el Ski Rack estandarizado, pero los montos deben copiarse o
validarse contra tarifas vigentes antes de activar pagos.

### Tabla temporal aprobada para lanzamiento

Consulta oficial realizada el 2026-09-02 en Tarifa Simple, modalidad Persona,
entrega a domicilio, tamaño XS. Starken define XS como 0 a 850 g y muestra como
referencia un paquete de 20 × 10 × 10 cm. El perfil registrado para el Ski Rack
es menor: 15 × 10 × 3 cm y 0,140 kg por unidad embalada. Se usa el peso máximo
de la talla L para cubrir todas las tallas con un único perfil conservador.

| Zona Starken | Tarifa pública | Tarifa ReskiChile por caja |
| --- | ---: | ---: |
| Misma ciudad | $4.500 | $4.990 |
| Extremo norte (Arica a Antofagasta) | $7.660 | $7.990 |
| Centro/sur (Atacama a Los Lagos) | $6.490 | $6.990 |
| Extremo austral (Aysén y Magallanes) | $9.670 | $9.990 |

La tarifa de misma ciudad se aplica conservadoramente sólo cuando el destino
es la misma comuna de la bodega: Las Condes o Los Ángeles. Las demás comunas
usan su zona regional. Retiro coordinado en cualquiera de las dos bodegas
permanece en $0.

Los valores están redondeados al siguiente precio comercial y dejan entre
$320 y $500 para absorber variaciones menores. No se agrega IVA por separado:
el comprador ve un precio final. La tabla se cobra por caja, es decir, una vez
por cada unidad del carrito.

Este modelo sigue el patrón habitual de e-commerce para un catálogo pequeño y
un paquete estandarizado: retiro gratis más tarifa plana por zona y clase de
producto. La tarifa debe revisarse antes de activar pagos y luego al menos una
vez al mes, o inmediatamente si Starken cambia sus precios.

Fuentes:

- [Tarifa Simple de Starken](https://www.starken.cl/tarifa-simple)
- [Tarifa plana por zona y clase en WooCommerce](https://woocommerce.com/document/flat-rate-shipping/)

Si el producto, la caja o sus protecciones cambian y el paquete supera 850 g,
esta tabla no puede usarse y debe recalcularse con la categoría siguiente.

Blue Express se prueba después si confirma acceso API para el volumen real de
ReskiChile. Sus plugins publicados no se pueden instalar directamente en Next.js.

### Etapa posterior: Chilexpress

Cuando exista volumen y embalaje estandarizado:

1. crear cuenta en Chilexpress Developers;
2. obtener key de pruebas;
3. integrar cobertura y cotizador en sandbox;
4. comparar cotización API con cobros reales;
5. solicitar credenciales/TCC productivas;
6. integrar creación de OT, etiqueta y seguimiento;
7. conservar temporalmente la tabla como fallback controlado.

Shipit se reevaluará si el beneficio multicourier compensa su mensualidad.

## 6. Datos mínimos del checkout invitado

Para identificar, contactar y despachar:

- nombre completo del destinatario;
- correo;
- teléfono;
- región;
- comuna;
- calle;
- número;
- departamento/casa/oficina, opcional;
- indicaciones de entrega, opcional y con límite de longitud;
- código postal, solo si el courier seleccionado lo necesita.

Para retiro en sucursal/punto, la ubicación seleccionada reemplaza la dirección
de destino del envío. No se pedirá una dirección residencial adicional si el
courier no la necesita; esto respeta minimización de datos.

No pedir RUT por defecto. Solo se agrega si existe una necesidad legal,
tributaria o contractual documentada.

Seguridad y privacidad:

- validar y normalizar en backend;
- limitar largos y caracteres;
- no incluir dirección en logs;
- cifrar o restringir fuertemente la PII;
- definir retención;
- no permitir que conocer el public_id revele la dirección;
- verificar el correo mediante confirmación de compra y mecanismo seguro de
  consulta, sin exigir cuenta.

## 7. Modelo de datos de despacho

### shipping_origins

Dos registros iniciales:

- Los Ángeles, Región del Biobío;
- Las Condes, Región Metropolitana.

Cada uno contiene comuna/código de cobertura y la dirección operativa necesaria
para cotizar/generar el envío. La dirección completa es server-only.

Cada fila de inventario tiene un `shipping_origin_code`. El origen elegido se
congela en `order_items` y `shipping_quotes` al reservar; no se puede cambiar
durante el pago.

### shipping_profiles

Asociado a cada producto:

- packaged_length_cm;
- packaged_width_cm;
- packaged_height_cm;
- packaged_weight_kg;
- parcel_count: uno por cada unidad comprada;
- handling_class: standard, long, fragile u otra;
- updated_at y updated_by.

Un producto no puede habilitarse para venta sin perfil de embalaje completo.

### shipping_zones

- nombre;
- lista de códigos de región/comuna/cobertura;
- prioridad;
- estado activo;
- versión.

No usar texto libre de comuna como única clave.

### shipping_rates

- zone_id;
- shipping_profile/class;
- método/servicio;
- amount_clp;
- vigencia desde/hasta;
- días estimados mínimos/máximos;
- fuente y fecha de la cotización;
- activo.

### shipping_quotes

Instantánea asignada al checkout:

- order_id;
- source: table, chilexpress o shipit;
- shipping_origin_id;
- rate_version/provider_quote_id;
- service_code;
- destination coverage code;
- amount_clp;
- estimated_days;
- package snapshot;
- expires_at;
- status selected, consumed o expired.

No guardar respuestas completas del proveedor sin necesidad.

## 8. Flujo seguro de cotización

1. El cliente mantiene un carrito de producto, talla y cantidad.
2. Ingresa dirección.
3. El backend normaliza región/comuna y verifica cobertura.
4. Relee productos, disponibilidad y shipping_profiles.
5. Descarta cada origen que no pueda completar todas las unidades.
6. Construye el mismo snapshot de paquete para cada origen candidato.
7. Cotiza Los Ángeles y Las Condes desde tabla o API.
8. Elige menor costo, luego menor plazo; distancia sólo desempata.
9. Persiste el shipping_quote exacto con origen, monto y vencimiento.
10. El cliente selecciona IDs opacos; nunca envía shipping_clp aceptado.
11. Al crear la orden, el backend vuelve a validar quotes, dirección, carrito y
   vigencia.
12. El total Webpay incluye el shipping_clp persistido.

Si no existe tarifa:

- no cobrar un monto incompleto;
- no usar cero silenciosamente;
- mostrar que la comuna/producto requiere revisión;
- permitir que administración agregue una tarifa antes de reanudar.

## 9. Carrito con inventario por tallas

Aunque hoy haya un solo producto, el modelo usa order_items múltiples.

Reglas:

- cada combinación producto/talla aparece una sola vez por carrito;
- la cantidad queda limitada por el stock libre en un mismo origen;
- las reservas son por fila `(producto, talla, origen)`;
- agregar un producto reservado por otro comprador falla de forma clara;
- el despacho se calcula desde los paquetes del carrito, no multiplicando
  ciegamente una tarifa;
- la primera versión puede limitar el carrito a un ítem mediante configuración,
  sin romper el schema futuro.
- un carrito futuro con ambos orígenes genera dos despachos separados.

## 10. Descuentos y envío gratis

Los cupones se calculan exclusivamente en backend.

Configuración inicial propuesta para sandbox:

- código de prueba WELCOME10;
- 10% sobre productos;
- tope de CLP 10.000;
- no descuenta despacho;
- un uso por correo normalizado;
- máximo global de 100 usos;
- no combinable;
- deshabilitado en producción hasta que administración defina vigencia.

Datos mínimos:

- código normalizado y almacenado de forma segura;
- tipo: monto, porcentaje o envío gratis;
- valor y máximo;
- vigencia;
- mínimo de compra;
- productos/categorías/zona aplicables;
- límite global y por correo/usuario;
- contador/reserva atómica de uso;
- combinabilidad;
- estado activo.

Orden de cálculo sugerido:

1. subtotal de productos;
2. descuento de productos;
3. costo de despacho;
4. descuento de despacho/envío gratis;
5. total final CLP.

La orden guarda el snapshot de cada ajuste. Un cupón no puede producir total
negativo, superar el subtotal aplicable ni reutilizarse por carreras
concurrentes.

## 11. Pruebas necesarias

- comuna con tarifa y sin tarifa;
- dirección incompleta o código de comuna manipulado;
- producto sin medidas;
- pieza larga/sobredimensionada;
- quote vencido;
- tarifa modificada después de crear quote;
- cliente cambia shipping_clp en DevTools;
- dos direcciones con el mismo quote_id;
- carrito cambia después de cotizar;
- caída de API con y sin fallback aprobado;
- cupón vencido, inexistente, agotado y concurrente;
- envío gratis por cupón;
- dos productos o tallas con perfiles distintos;
- monto Webpay igual a productos - descuentos + despacho.

## 12. Información pendiente del propietario

Para construir la tabla inicial:

1. repetir la medición si cambia el producto, la caja o sus protecciones;
2. dirección operativa de origen en Los Ángeles y Las Condes, compartida por un
   canal seguro solo cuando se configure el transportista;
3. plazo comercial que se mostrará al cliente;
4. quién llevará físicamente cada paquete al courier o si se necesita retiro.

No compartir direcciones privadas ni credenciales en documentación pública.

## 13. Aclaración sobre el valor $3.990

`$3.990` no provino de Blue Express, Starken ni de una cotización real. Era un
valor fijo ficticio usado únicamente para probar el flujo Webpay en sandbox.
Se eliminó como valor predeterminado: si se decide usar `sandbox_fixed`, ahora
debe configurarse deliberadamente y sólo se admite como dato de prueba. El modo
normal usa `SHIPPING_RATE_SOURCE=table` y exige tarifas aprobadas por origen.
