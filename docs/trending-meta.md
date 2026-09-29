# Trending de ReskiChile

Trending es una colección dinámica transversal a los tipos de producto. La web
(`/catalogo?collection=trending`) y Meta comparten la selección persistida en
`public.trending_products`. No modifica el tipo original (esquís, botas, etc.).

## Selección

- Hasta 40 productos aprobados, con precio, marca, slug y foto utilizables.
- 45% contactos efectivos (WhatsApp o chat), 30% vistas y 25% novedad.
- Actividad de los últimos 30 días. Vistas: una por persona y día UTC. Contactos:
  una persona por producto en la ventana, unificando WhatsApp y chat. Para eventos
  históricos sin usuario/visitante se cuenta el evento individual.
- Contactos y vistas usan `ln(1 + cantidad)`, normalizado por el máximo del catálogo
  elegible (denominador mínimo 1). Esto reduce el dominio de un producto viral.
- Novedad: `0.5 ^ (días desde created_at / 14)`. Las rebajas o reediciones no
  rejuvenecen un anuncio. Empates: fecha de creación descendente y UUID ascendente.
- El gatillante principal es la publicación: inserción aprobada o cambio a
  `approved`. Subir un borrador o acumular vistas no recalcula la selección.
- Ventas, pausas, eliminaciones y cambios de fotos/elegibilidad también recalculan
  para retirar anuncios no disponibles y completar los cupos. Con menos de 40
  elegibles se muestran solamente los existentes.

El recálculo es transaccional y serializado entre publicaciones concurrentes.
Los eventos privados y sus contadores no se exponen al cliente ni a Meta.

## Meta: configuración inicial, una sola vez

El feed completo existente sigue en:
`https://www.reskichile.cl/api/meta/catalog`

La nueva columna `custom_label_3` vale `trending` en los seleccionados y `standard`
en los demás. El valor explícito `standard` permite sacar a los antiguos miembros
del conjunto en la siguiente importación. Se mantienen los IDs del Pixel y las
etiquetas 0–2 (tipo, condición y región).

1. Aplicar la migración `202609290001_trending_products.sql` y desplegar el código.
2. En Commerce Manager, verificar que el origen de datos use el feed anterior con
   importaciones automáticas, preferentemente cada hora, y eliminación de artículos
   ausentes para retirar vendidos/archivados.
3. Actualizar el origen una vez para que Meta reconozca `custom_label_3`.
4. Crear un **conjunto de productos** llamado **Trending**, con condición
   **custom_label_3 es igual a trending**. No seleccionar productos manualmente.
5. Elegir ese conjunto en los anuncios de catálogo que deban mostrar Trending.

El ranking y el feed cambian al publicar. Meta incorpora los cambios cuando
importa y procesa el feed; el feed no fuerza una importación instantánea en Meta.
Las campañas existentes solo cambian si se les asigna este conjunto.

Referencia de campos admitidos: [SDK oficial de Meta, ProductItem](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/productitem.py).
Conjuntos y feeds: [SDK oficial de Meta, ProductCatalog](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/productcatalog.py).

## Verificación

`npm run test:db` verifica ranking, gatillantes, reemplazos, borradores y permisos.
`npm test -- tests/trending.test.ts tests/meta-catalog.test.ts` verifica paginación,
filtros y etiquetas. Un fallo al consultar la selección hace que el feed responda
503, para que Meta conserve el último catálogo importado correctamente.
