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

export const ITEMS_PER_PAGE = 12

// Definición de qué campos específicos tiene cada tipo de producto
export interface AttributeField {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean'
  required: boolean
  options?: string[]
  placeholder?: string
}

export const PRODUCT_ATTRIBUTES: Record<string, AttributeField[]> = {
  esquis: [
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
    { key: 'flex', label: 'Flex', type: 'text', required: true, placeholder: 'Ej: 100' },
    { key: 'talla_mondo', label: 'Talla (Mondo)', type: 'text', required: false, placeholder: 'Ej: 26.5' },
    { key: 'talla_cm', label: 'Talla en cm', type: 'text', required: true, placeholder: 'Ej: 30.5' },
    { key: 'tipo_conexion_fijacion', label: 'Tipo de conexión a la fijación', type: 'select', required: true, options: TIPO_CONEXION_BOTAS_ESQUI },
    { key: 'sexo', label: 'Sexo', type: 'select', required: true, options: SEXOS },
    { key: 'color', label: 'Color', type: 'text', required: false },
  ],
  botas_snowboard: [
    { key: 'talla_cm', label: 'Talla en cm', type: 'text', required: true, placeholder: 'Ej: 28' },
    { key: 'tipo_conexion_fijacion', label: 'Tipo de conexión a la fijación', type: 'select', required: true, options: TIPO_CONEXION_BOTAS_SNOWBOARD },
    { key: 'color', label: 'Color', type: 'text', required: false },
    { key: 'sexo', label: 'Sexo', type: 'select', required: true, options: SEXOS },
  ],
  bastones: [
    { key: 'largo', label: 'Largo', type: 'text', required: true, placeholder: 'Ej: 120' },
    { key: 'telescopicos', label: 'Bastones telescópicos', type: 'boolean', required: false },
  ],
  cascos: [
    { key: 'color', label: 'Color', type: 'text', required: true },
    { key: 'talla_cm', label: 'Talla en cm', type: 'text', required: false, placeholder: 'Ej: 56' },
    { key: 'talla', label: 'Talla', type: 'select', required: false, options: TALLAS_ACCESORIOS },
  ],
  guantes: [
    { key: 'talla', label: 'Talla', type: 'select', required: false, options: TALLAS_ACCESORIOS },
    { key: 'sexo', label: 'Sexo', type: 'select', required: true, options: SEXOS },
  ],
  fijaciones: [
    { key: 'tipo_conexion', label: 'Tipo de conexión', type: 'select', required: true, options: TIPO_CONEXION_SKI },
  ],
  parkas: [
    { key: 'tipo_aislacion', label: 'Tipo de aislación', type: 'select', required: true, options: TIPO_AISLACION },
    { key: 'sexo', label: 'Sexo', type: 'select', required: true, options: SEXOS },
    { key: 'talla', label: 'Talla', type: 'select', required: true, options: TALLAS_ROPA },
  ],
  pantalones: [
    { key: 'tipo_aislacion', label: 'Tipo de aislación', type: 'select', required: true, options: TIPO_AISLACION },
    { key: 'sexo', label: 'Sexo', type: 'select', required: true, options: SEXOS },
    { key: 'talla', label: 'Talla', type: 'select', required: false, options: TALLAS_ROPA },
    { key: 'talla_numero', label: 'Talla (Número)', type: 'text', required: false, placeholder: 'Ej: 42' },
  ],
  antiparras: [
    { key: 'lente_intercambiable', label: 'Lente intercambiable', type: 'boolean', required: true },
    { key: 'talla', label: 'Talla', type: 'select', required: false, options: TALLAS_ACCESORIOS },
  ],
  mochilas: [
    { key: 'capacidad_litros', label: 'Capacidad (Litros)', type: 'text', required: true, placeholder: 'Ej: 40' },
    { key: 'compartimiento_avalancha', label: 'Compartimiento para equipo de avalancha', type: 'boolean', required: true },
  ],
  bolsos: [
    { key: 'capacidad_litros', label: 'Capacidad (Litros)', type: 'text', required: true, placeholder: 'Ej: 120' },
    { key: 'tiene_ruedas', label: 'Tiene ruedas', type: 'boolean', required: true },
    { key: 'largo', label: 'Largo', type: 'text', required: false },
  ],
  equipo_avalanchas: [
    { key: 'tipo_equipo', label: 'Tipo de equipo', type: 'select', required: true, options: TIPO_EQUIPO_AVALANCHAS },
  ],
  camaras_accion: [
    { key: 'tipo_grabacion', label: 'Tipo de grabación', type: 'select', required: true, options: TIPO_GRABACION },
  ],
  otros: [],
}
