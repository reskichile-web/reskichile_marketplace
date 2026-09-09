# Carrusel de catálogo 9:16

Genera PNG de **1080 × 1920**, con nueve productos por hoja. Usa las imágenes
principales oficiales del catálogo, logo y tipografía locales, sombras de apoyo
y una franja de la fotografía de montaña ya utilizada por ReskiChile.
No requiere generación de imágenes con IA ni iniciar Next.js.

## Intro minimalista

```bash
npm run ig:intro
```

Exporta una intro independiente de **1080 × 1920**: logo azul marino, texto
«Lo destacado de la semana está aquí.», con una flecha mínima, centrada y separada
abajo. Usa el fondo del catálogo y Montserrat variable: Regular (400)
para las dos primeras líneas y Bold (700) para «está aquí.» en azul. Sin header, footer ni cifras
que dependan del inventario.
Solo necesita dependencias instaladas y Chrome local; no consulta Supabase.
Guarda HTML autocontenido, PNG, JPEG y manifiesto en una carpeta nueva de
`outputs/ig-intro-*`. No publica ni modifica el historial de rotación.
El diseño está en `scripts/lib/ig-catalog-intro.mjs` y el exportador en
`scripts/render-ig-intro.mjs`.

## Ejecutar

```bash
# Una sola hoja de ejemplo (comportamiento predeterminado).
npm run ig:catalog

# Tanda de 18 productos con mayor puntaje combinado.
npm run ig:catalog -- --pages 2

# Una hoja específica.
npm run ig:catalog -- --page 2

# Exportación completa, cuando se necesite.
npm run ig:catalog -- --all

# Mantener exactamente el orden cronológico del catálogo.
npm run ig:catalog -- --order recent

# Comparar cuatro tratamientos artísticos del cierre, con los mismos productos.
npm run ig:catalog -- --footer all

# Exportar con uno de los cierres propuestos.
npm run ig:catalog -- --footer firma
```

Requiere dependencias instaladas, Chrome local y `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. El modo predeterminado `trending` también requiere
`SUPABASE_SERVICE_ROLE_KEY` para consultar analítica privada desde el proceso local.
La clave y los identificadores de visitantes nunca se exportan. Carga las variables del proyecto con `@next/env`
(modo producción; las variables del proceso tienen prioridad). Usa **acceso
anónimo de solo lectura** para los productos; las vistas se consultan por separado.
Los modos `--order recent` y `--order mixed` no necesitan acceso a analítica. `CHROME_PATH` permite
seleccionar otro Chrome.

Cada ejecución consulta de nuevo Supabase, incluyendo solo `status = approved`.
Los productos nuevos, los precios y los cambios a vendido o pausado se reflejan
en la siguiente ejecución. Una imagen PNG ya exportada no cambia automáticamente.
El script no se programa solo ni publica en Instagram.

Con `--order mixed`, intercala tres esquís, tres snowboards y tres productos de otras
categorías por ciclo, manteniendo dentro de cada grupo la prioridad del catálogo
(publicaciones y rebajas recientes). Cuando se termina un grupo sigue con los
demás, sin omisiones ni duplicados. La numeración de productos/hojas puede cambiar
entre ejecuciones. No incluye el inventario separado de Ski Rack.

## Selección predeterminada: novedad + popularidad

El puntaje se calcula nuevamente en cada corrida:

```text
N = 2 ^ (-antigüedad_en_días / 7)
P = ln(1 + vistas_únicas_7d) / ln(1 + máximo_vistas_únicas_7d)
puntaje = 100 × (0,50 × N + 0,50 × P)
```

La antigüedad usa `created_at`, no `catalog_bumped_at`: una rebaja o reactivación
no rejuvenece artificialmente el aviso. Una semana de antigüedad da N=0,5; dos
semanas N=0,25. Las vistas son visitantes distintos por producto en una ventana
móvil de siete días; las recargas y visitas repetidas del mismo navegador cuentan
una vez por producto en esa ventana. Si ningún producto tiene vistas, P=0 para
todos. Los eventos sin `visitor_id` se omiten y se informa su cantidad.

El máximo se calcula solo entre productos aprobados. Se cuentan visitas pagadas
y no pagadas: esta fórmula mide interés observado, no popularidad orgánica pura.
Los identificadores por navegador y la cobertura del tracking son aproximaciones,
no personas verificadas. Un error de consulta cancela el ranking, no fabrica ceros.

Se ordena de mayor a menor puntaje y se toman los primeros 9 o 18 según las hojas
solicitadas, aplicando primero la rotación descrita abajo.
**50/50 son pesos, no una cuota de mitad nuevos y mitad populares.**
No hay cuotas por categoría.
Los empates se resuelven por vistas, fecha de creación e ID. El helper está en
`scripts/lib/ig-catalog-ranking.mjs`; sus constantes son el único punto de ajuste.

El manifiesto guarda configuración, instante de evaluación, ventana de vistas,
puntajes y componentes de todos los candidatos para poder auditar la selección.

### Rotación de 14 días

El selector primero considera artículos que nunca aparecieron en el catálogo o
cuya última aparición confirmada fue hace al menos 14 días. Entre ellos conserva
el orden del puntaje. Si no alcanzan para completar la tanda, agrega artículos
recientes empezando por la aparición más antigua; empata por puntaje. Nunca
duplica un producto dentro de la tanda y excluye vendidos/pausados.

El historial corresponde exclusivamente a las láminas del catálogo, no a Stories
individuales. Se guarda por lámina en `instagram_catalog_publications`: el
publicador de tandas llama a `recordConfirmedCatalogSheet` con los IDs exactos que
aparecen en esa lámina, luego de enviarla. El helper consulta Meta y solo registra
si el container está `PUBLISHED`; `FINISHED` no cuenta como publicado. Una intro
sin productos no crea apariciones. Si falla la segunda lámina, solo descansa la
primera. Reintentar la confirmación no reinicia la fecha ni duplica registros.
`published_at` conserva la primera confirmación registrada, no el momento del
render; una recuperación tardía inicia el descanso conservadoramente al confirmarse.

Requiere la migración `202609090004_instagram_catalog_rotation.sql`, todavía
pendiente de despliegue junto al calendario. El renderer solo lee el historial;
generar/exportar no modifica apariciones. Si falta la migración o falla la consulta,
el modo normal se detiene en vez de asumir falsamente que nadie ha aparecido.
Para revisar el diseño antes de instalarla se permite explícitamente:

```bash
npm run ig:catalog -- --pages 2 --preview-no-history
```

Ese boceto guarda `previewOnly: true` y `history: ignored-preview` en el manifiesto
y no debe enviarse; el callback de confirmación rechaza recibos de preview.
Al integrar el publicador hay que propagar este indicador y validar la selección
contra el historial actualizado antes de enviar. El envío automático, la reserva
concurrente de tandas y su conexión al callback siguen pendientes de integración.

## Archivos de salida

Se crea una carpeta nueva `outputs/ig-catalog-<fecha>/`, ignorada por git:

- `catalogo-01.png`: lámina lista para revisar o subir.
- `catalogo-01.html`: versión autónoma con fuentes e imágenes incrustadas y
  enlaces a cada producto. Se puede abrir sin servidor ni conexión.
- `manifest.json`: fecha de consulta, IDs de todo el catálogo y datos, fotos de
  origen y enlaces de cada producto exportado.

`--output outputs/mi-catalogo` permite definir otra carpeta. Si ya existe, el
comando se detiene para conservar exportaciones anteriores. `--pages N` limita
la cantidad de hojas, a partir de `--page` (1 por defecto).

## Composición y límites

La plantilla vive en `scripts/lib/ig-catalog.mjs`. Cada ficha muestra un avatar de
marca a la izquierda del nombre (marca + modelo, una línea de ancho fijo con
puntos suspensivos), precio CLP grande en negrita y comuna (región como respaldo).
Los avatares usan `public/brand-logos/`; si falta el logo se muestran las iniciales
de la marca. Las medidas, estado y descripción no aparecen en la ficha; los datos
consultados se conservan en el manifiesto. Nunca inventa una ubicación.

Se recortan márgenes claros de las imágenes y se hace transparente el blanco casi
puro conectado a sus bordes, conservando las zonas blancas encerradas dentro del
producto. Las sombras se calculan a partir de las proporciones de cada imagen.
Este tratamiento está pensado para las fotos de estudio ya procesadas: **no es
un eliminador semántico de fondos**. Fotos con fondos complejos pueden conservar
su fondo; las superficies blancas conectadas al exterior pueden necesitar un
recorte maestro transparente. No se reconstruyen productos ni se sustituyen por
fotos de otro modelo. Siempre se respeta la imagen principal de la publicación.

La montaña usa la fotografía local `public/images/_ (1).jpeg`. El helper
`scripts/lib/ig-catalog-mountain.mjs` sigue el borde fotografiado de las cumbres
y vuelve transparente el cielo. El borde es definido, sin banda difuminada;
la textura conserva una opacidad de 62 % y saturación reducida.
El eslogan y la dirección web se muestran pequeños sobre las montañas al borde
inferior, con la foto aclarada para mantener legibilidad. Las fichas usan fotos
más pequeñas y separaciones amplias entre filas y columnas.
Las filas de accesorios se compensan verticalmente según la altura visible de
sus fotos para evitar que su espacio superior parezca mayor. Montañas y cierre D
bajan juntos 42 px, manteniendo el texto sobre la misma zona de nieve.
Las fotos están ampliadas aproximadamente un 12 % respecto del boceto anterior
y la grilla comienza 20 px más abajo, conservando la separación entre filas.
No hay fecha ni numeración visibles. El logo de ReskiChile se reduce y se colorea azul
marino apagado `#30465E` solo en la exportación; el SVG original permanece intacto. Se reutiliza
la tipografía local.

## Variantes del cierre

`--footer` acepta `original`, `cursiva`, `editorial`, `firma`,
`espaciada` (predeterminado, opción D elegida) y `all`. Las cuatro alternativas
aclaran localmente la nieve en el centro siguiendo la pendiente y conservan las
cumbres. La D usa el eslogan en mayúsculas espaciadas y la URL azul; ambos textos
están ligeramente ampliados y más abajo sobre la nieve. Las demás alternativas
usan la URL pequeña en gris. `cursiva` utiliza Montserrat italic local; `editorial` y `firma`
usan Georgia del sistema, con Times New Roman/serif como respaldo. Sus PNG son
fijos; al abrir el HTML en otro sistema puede cambiar esa tipografía serif.

`--footer all` compara una sola hoja (seleccionable con `--page`), descarga las
fotos una vez y produce cuatro PNG completos, cuatro HTML, `comparativa-cierres.png`
y `comparativa-laminas.png`. Los datos de cada versión quedan en el manifiesto.
Los nombres de variantes se dibujan solo en las comparativas, no en las láminas.

El render espera fuentes e imágenes, ajusta textos largos y comprueba que no haya
desbordes antes de exportar. Una foto ausente, un precio inválido o un texto que no
cabe detienen el comando: no se omite silenciosamente un producto. Si hay un fallo,
pueden quedar archivos parciales en esa carpeta; solo una exportación que termina
con `manifest.json` está completa. Revisar visualmente antes de publicar.

Validación de las reglas de catálogo y procesamiento de imágenes:

```bash
npm test -- tests/ig-catalog.test.ts
```
