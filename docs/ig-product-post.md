# Publicación automatizada de producto para Instagram

La plantilla genera una pieza vertical de 1080 × 1920 px directamente desde un producto aprobado de ReskiChile. El encuadre, la jerarquía, el fondo y el deportista permanecen fijos; la categoría, el nombre, el precio, las características y la fotografía vienen del producto.

## Assets maestros V1

- `public/ig-assets/story-mountain-background-v1.png`: fondo vertical de montaña, andariveles y nieve con zonas de aire reservadas para producto y copy.
- `public/ig-assets/story-skier-rider-white-v1.png`: rider fotorealista de chaqueta azul sobre blanco puro, integrado por mezcla multiplicada.

Estos assets se generaron una vez como dirección de arte de marca. No se vuelven a generar al crear cada publicación.

## Rutas

- `/ig-post`: elige al azar un producto aprobado que tenga una imagen principal PNG y redirige a su pieza.
- `/ig-post/[slug]`: genera una pieza estable para el producto indicado.

Las rutas no muestran el header ni el footer del marketplace y no se indexan.

## Exportar a PNG

Un solo comando inicia temporalmente la aplicación si es necesario, renderiza la publicación y vuelve a cerrar el servidor que inició:

```bash
npm run ig:render -- --slug lippi-citizen-warm-b-dry-hoody-jacket-96a60887 --output outputs/ig-lippi.png
```

Para dejar que el sistema elija un producto al azar, omitir `--slug`:

```bash
npm run ig:render -- --output outputs/ig-producto-aleatorio.png
```

El render usa Chrome en modo headless y produce siempre un PNG de 1080 × 1920 px. Si ya existe un servidor en `http://localhost:4173`, lo reutiliza y no lo detiene. Se puede apuntar a otro entorno con `--base-url`.

## Reglas de composición

- Los productos largos (`esquis`, `snowboards`, `bastones`) usan el encuadre vertical izquierdo.
- Los demás tipos usan el encuadre compacto izquierdo.
- Los datos destacados se obtienen desde `attributes` según el tipo de producto.
- El título ocupa una posición fija independiente del producto. Se mide con la tipografía ya cargada: usa una línea grande cuando cabe o hasta dos líneas balanceadas, con el mayor tamaño posible, para títulos largos.
- Las fotografías procesadas del catálogo se analizan en el navegador: el sistema recorta automáticamente el espacio blanco del PNG y escala el contenido útil para ocupar toda su zona, sin ajustes manuales por producto.
- Los esquís, snowboards y bastones se anclan al borde inferior de su zona para entrar ligeramente detrás del rider.
- Los productos compactos se centran verticalmente respecto del bloque completo de precio y atributos usando solo su contenido visible, no el lienzo original del PNG. El resultado se limita con un buffer mínimo bajo el título y una zona máxima de solapamiento con el rider.
- Las composiciones largas que contienen varios elementos distribuidos —por ejemplo esquís, fijaciones y pieles dentro de una misma imagen— también se centran verticalmente. Solo los productos largos realmente estrechos conservan el anclaje inferior.
- Cuando un producto compacto y horizontal deja demasiado aire sobre sí mismo, el título baja automáticamente hasta recuperar una separación visual constante, sin alterar el espacio reservado para el logo.
- Si el contenido detectado es alto y estrecho —por ejemplo, solo un par de esquís— el layout libera el espacio vacío de la fotografía, desplaza el producto a la izquierda y amplía la ficha técnica en la zona recuperada.
- Cuando un producto tiene solo dos datos técnicos, el precio y esos atributos crecen automáticamente para equilibrar la composición.
- Cada atributo combina una etiqueta técnica pequeña con un valor protagonista; las etiquetas se asignan según el tipo de producto.
- El rider se recorta a transparencia en el navegador y se compone realmente por encima del producto, conservando el spray de nieve útil sin dejar pasar el producto por el cuerpo.
- Todas las categorías utilizan el mismo esquiador azul para mantener consistencia de marca.
- El producto ocupa una zona segura de 600 px con 50 px de margen izquierdo; la ficha comienza después de un buffer mínimo de 40 px y termina al menos 50 px antes del borde derecho.
- El precio se mide con la tipografía cargada y reduce su tamaño únicamente cuando excede el ancho seguro de su columna.
