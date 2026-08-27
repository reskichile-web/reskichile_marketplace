export const PRODUCT_TYPES: Record<string, string> = {
  esquis: 'Esquís',
  snowboards: 'Snowboards',
  botas_esqui: 'Botas de Esquí',
  botas_snowboard: 'Botas de Snowboard',
  bastones: 'Bastones',
  cascos: 'Cascos',
  guantes: 'Guantes',
  fijaciones: 'Fijaciones',
  parkas: 'Parkas',
  pantalones: 'Pantalones',
  antiparras: 'Antiparras',
  mochilas: 'Mochilas',
  bolsos: 'Bolsos',
  equipo_avalanchas: 'Equipo de Avalanchas',
  camaras_accion: 'Cámaras de Acción',
  equipos_completos: 'Equipos completos',
  otros: 'Otros',
}

export const CONDITIONS: Record<string, string> = {
  nuevo_sellado: 'Nuevo (sellado)',
  nuevo: 'Nuevo',
  usado_como_nuevo: 'Usado - Como nuevo',
  usado_buen_estado: 'Usado - Buen estado',
  usado_aceptable: 'Usado - Aceptable',
}

export const PRODUCT_STATUSES: Record<string, string> = {
  draft: 'Borrador',
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  missing_photos: 'Faltan fotos',
  sold: 'Vendido',
  archived: 'Archivado',
}

export const VIEW_COUNT_VISIBILITY_THRESHOLD = 50

export const REGIONS: string[] = [
  'Arica y Parinacota',
  'Tarapacá',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaíso',
  'Metropolitana',
  "O'Higgins",
  'Maule',
  'Ñuble',
  'Bío-Bío',
  'La Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén',
  'Magallanes',
]

export const TALLAS_ROPA = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
export const TALLAS_ACCESORIOS = ['XS', 'S', 'M', 'L', 'XL']
export const SEXOS = ['Hombre', 'Mujer', 'Unisex']

export const TIPO_AISLACION = ['Pluma', 'Térmica', 'Cortaviento']
export const CAMBER_TYPES = ['Camber clasico', 'Camber rocker', 'Camber plano']
export const TIPO_CONEXION_SKI = ['Alpina (Normal)', 'De pines', 'Híbrida']
export const TIPO_CONEXION_BOTAS_ESQUI = ['Alpina (Normal)', 'Randonnée']
export const TIPO_CONEXION_BOTAS_SNOWBOARD = ['Común', 'Step On']
export const TIPO_EQUIPO_AVALANCHAS = ['Arva', 'Pala', 'Sonda']
export const TIPO_GRABACION = ['360', 'Normal']
export const DEPORTES_EQUIPO_COMPLETO = ['Esquí', 'Snowboard']

// Las botas se publican y filtran por la misma banda Mondo. Muchas marcas
// comparten carcasa entre la talla entera y la media talla, por eso el valor
// canónico es, por ejemplo, "27/27.5" en vez de texto libre.
export const MONDO_SIZE_BANDS = Array.from({ length: 16 }, (_, index) => {
  const size = 18 + index
  return `${size}/${size}.5`
})

// Los flex comerciales se expresan en pasos de 5 o 10. El catálogo solo
// mostrará los valores que realmente tengan productos disponibles.
export const SKI_BOOT_FLEX_OPTIONS = Array.from(
  { length: ((150 - 40) / 5) + 1 },
  (_, index) => String(40 + index * 5),
)

export const ITEMS_PER_PAGE = 12

// "Mark as sold" flow — all optional. Stored on products.sold_channel /
// products.sold_speed. Labels reused in the modal, emails and admin.
export const SOLD_CHANNELS: { value: string; label: string }[] = [
  { value: 'reski', label: 'Por ReSkiChile' },
  { value: 'otro_medio', label: 'Por otro medio (Yapo, IG, conocido)' },
  { value: 'otro', label: 'Otro' },
]
export const SOLD_SPEEDS: { value: string; label: string }[] = [
  { value: 'rapido', label: 'Se vendió rápido' },
  { value: 'normal', label: 'Tomó su tiempo' },
  { value: 'baje_precio', label: 'Tuve que bajar el precio' },
]
export const SOLD_CHANNEL_LABELS: Record<string, string> =
  Object.fromEntries(SOLD_CHANNELS.map(c => [c.value, c.label]))
export const SOLD_SPEED_LABELS: Record<string, string> =
  Object.fromEntries(SOLD_SPEEDS.map(s => [s.value, s.label]))

// Definición de qué campos específicos tiene cada tipo de producto
export interface AttributeField {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'button-select' | 'boolean' | 'multiselect'
  required: boolean
  options?: string[]
  /** multiselect: stored values are slugs (value), shown as label */
  choices?: { value: string; label: string }[]
  placeholder?: string
  /** Short tooltip shown next to the label via a tiny info icon */
  info?: string
}

// Género multi-selección — mismo modelo que esquís (arrays de slugs en
// attributes.genero, compatible con el filtro del catálogo).
export const GENERO_CHOICES: { value: string; label: string }[] = [
  { value: 'hombre', label: 'Hombre' },
  { value: 'mujer', label: 'Mujer' },
  { value: 'unisex', label: 'Unisex' },
  { value: 'junior', label: 'Junior' },
]

export const TIPO_ESQUI_CHOICES: { value: string; label: string }[] = [
  { value: 'race', label: 'Race' },
  { value: 'pista', label: 'Pista' },
  { value: 'all_mountain', label: 'All mountain' },
  { value: 'freeride', label: 'Freeride' },
  { value: 'powder', label: 'Powder' },
  { value: 'freestyle', label: 'Freestyle' },
  { value: 'touring', label: 'Randoné' },
]

export const NIVEL_EQUIPO_CHOICES: { value: string; label: string }[] = [
  { value: 'principiante', label: 'Principiante' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
]

const GENERO_FIELD: AttributeField = {
  key: 'genero', label: 'Género', type: 'multiselect', required: false, choices: GENERO_CHOICES,
}

// Human-readable attribute value: booleans → Sí/No, multiselect arrays →
// labels joined. Use everywhere an attribute value is displayed.
export function formatAttributeValue(field: AttributeField | undefined, value: unknown): string {
  if (value === true) return 'Sí'
  if (value === false) return 'No'
  if (Array.isArray(value)) {
    return value
      .map(v => field?.choices?.find(c => c.value === v)?.label ?? String(v).replace(/_/g, ' '))
      .join(', ')
  }
  return String(value)
}

export const PRODUCT_ATTRIBUTES: Record<string, AttributeField[]> = {
  esquis: [
    { key: 'tipo', label: 'Tipo', type: 'multiselect', required: false, choices: TIPO_ESQUI_CHOICES },
    GENERO_FIELD,
    { key: 'largo_cm', label: 'Largo (cm)', type: 'number', required: false, placeholder: 'Ej: 170' },
    { key: 'ancho_mm', label: 'Ancho (mm)', type: 'number', required: false, placeholder: 'Ej: 88' },
    { key: 'radio_giro_m', label: 'Radio de giro (m)', type: 'number', required: false, placeholder: 'Ej: 16' },
    { key: 'incluye_fijaciones', label: 'Incluye fijaciones', type: 'boolean', required: false },
    { key: 'fijaciones_marca', label: 'Marca de las fijaciones', type: 'text', required: false },
    { key: 'fijaciones_modelo', label: 'Modelo de las fijaciones', type: 'text', required: false },
    { key: 'fijaciones_tipo_conexion', label: 'Tipo de conexión fijaciones', type: 'select', required: false, options: TIPO_CONEXION_SKI },
    { key: 'fijaciones_estado', label: 'Estado de las fijaciones', type: 'select', required: false, options: Object.values(CONDITIONS) },
  ],
  snowboards: [
    GENERO_FIELD,
    { key: 'largo', label: 'Largo del snowboard', type: 'text', required: true, placeholder: 'Ej: 155' },
    { key: 'ancho', label: 'Ancho del snowboard', type: 'text', required: false, placeholder: 'Ej: 25' },
    { key: 'camber', label: 'Camber', type: 'select', required: false, options: CAMBER_TYPES },
    { key: 'incluye_fijaciones', label: 'Incluye fijaciones', type: 'boolean', required: true },
    { key: 'fijaciones_marca', label: 'Marca de las fijaciones', type: 'text', required: false },
    { key: 'fijaciones_modelo', label: 'Modelo de las fijaciones', type: 'text', required: false },
    { key: 'fijaciones_tipo_conexion', label: 'Tipo de conexión fijaciones', type: 'select', required: false, options: TIPO_CONEXION_SKI },
    { key: 'fijaciones_estado', label: 'Estado de las fijaciones', type: 'select', required: false, options: Object.values(CONDITIONS) },
  ],
  botas_esqui: [
    { key: 'talla_mondo', label: 'Talla Mondo', type: 'button-select', required: true, options: MONDO_SIZE_BANDS },
    { key: 'flex', label: 'Flex', type: 'button-select', required: true, options: SKI_BOOT_FLEX_OPTIONS },
    GENERO_FIELD,
    { key: 'incluye_pines', label: '¿Incluye pines?', type: 'boolean', required: false, info: 'Conexión para fijaciones de pines de randonée.' },
    { key: 'boa', label: 'Sistema BOA', type: 'boolean', required: true },
    { key: 'largo_suela_mm', label: 'Largo de bota (mm)', type: 'number', required: false, placeholder: 'Ej: 315', info: 'Largo exterior grabado en la bota; no es la talla del pie.' },
    { key: 'color', label: 'Color', type: 'text', required: false },
  ],
  botas_snowboard: [
    { key: 'talla_mondo', label: 'Talla Mondo', type: 'button-select', required: true, options: MONDO_SIZE_BANDS },
    { key: 'tipo_conexion_fijacion', label: 'Tipo de conexión a la fijación', type: 'select', required: true, options: TIPO_CONEXION_BOTAS_SNOWBOARD },
    { key: 'boa', label: 'Sistema BOA', type: 'boolean', required: true },
    { key: 'largo_suela_mm', label: 'Largo de bota (mm)', type: 'number', required: false, placeholder: 'Ej: 310', info: 'Largo exterior de la bota en milímetros; no es la talla del pie.' },
    { key: 'color', label: 'Color', type: 'text', required: false },
    GENERO_FIELD,
  ],
  bastones: [
    GENERO_FIELD,
    { key: 'largo', label: 'Largo', type: 'text', required: true, placeholder: 'Ej: 120' },
    { key: 'telescopicos', label: 'Bastones telescópicos', type: 'boolean', required: false },
  ],
  cascos: [
    GENERO_FIELD,
    { key: 'color', label: 'Color', type: 'text', required: true },
    { key: 'talla_cm', label: 'Talla en cm', type: 'text', required: false, placeholder: 'Ej: 56' },
    { key: 'talla', label: 'Talla', type: 'select', required: false, options: TALLAS_ACCESORIOS },
  ],
  guantes: [
    { key: 'talla', label: 'Talla', type: 'select', required: false, options: TALLAS_ACCESORIOS },
    GENERO_FIELD,
  ],
  fijaciones: [
    GENERO_FIELD,
    { key: 'tipo_conexion', label: 'Tipo de conexión', type: 'select', required: true, options: TIPO_CONEXION_SKI },
  ],
  parkas: [
    { key: 'tipo_aislacion', label: 'Tipo de aislación', type: 'select', required: true, options: TIPO_AISLACION },
    GENERO_FIELD,
    { key: 'talla', label: 'Talla', type: 'select', required: true, options: TALLAS_ROPA },
  ],
  pantalones: [
    { key: 'tipo_aislacion', label: 'Tipo de aislación', type: 'select', required: true, options: TIPO_AISLACION },
    GENERO_FIELD,
    { key: 'talla', label: 'Talla', type: 'select', required: false, options: TALLAS_ROPA },
    { key: 'talla_numero', label: 'Talla (Número)', type: 'text', required: false, placeholder: 'Ej: 42' },
  ],
  antiparras: [
    GENERO_FIELD,
    { key: 'lente_intercambiable', label: 'Lente intercambiable', type: 'boolean', required: true },
    { key: 'talla', label: 'Talla', type: 'select', required: false, options: TALLAS_ACCESORIOS },
  ],
  mochilas: [
    GENERO_FIELD,
    { key: 'capacidad_litros', label: 'Capacidad (Litros)', type: 'text', required: true, placeholder: 'Ej: 40' },
  ],
  bolsos: [
    GENERO_FIELD,
    { key: 'capacidad_litros', label: 'Capacidad (Litros)', type: 'text', required: true, placeholder: 'Ej: 120' },
    { key: 'tiene_ruedas', label: 'Tiene ruedas', type: 'boolean', required: true },
    { key: 'largo', label: 'Largo', type: 'text', required: false },
  ],
  equipo_avalanchas: [
    { key: 'tipo_equipo', label: 'Tipo de equipo', type: 'select', required: true, options: TIPO_EQUIPO_AVALANCHAS },
  ],
  camaras_accion: [
    GENERO_FIELD,
    { key: 'tipo_grabacion', label: 'Tipo de grabación', type: 'select', required: true, options: TIPO_GRABACION },
  ],
  // Packs are described as a whole in their title and description. Their
  // individual components vary too much for stable structured attributes.
  equipos_completos: [],
  // "Otros" is intentionally unstructured: its name and description carry
  // the product information, without category-specific attributes.
  otros: [],
}
