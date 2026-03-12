export type ProductType =
  | 'esquis' | 'snowboards' | 'botas_esqui' | 'botas_snowboard'
  | 'bastones' | 'cascos' | 'guantes' | 'fijaciones'
  | 'parkas' | 'pantalones' | 'antiparras' | 'mochilas'
  | 'bolsos' | 'equipo_avalanchas' | 'camaras_accion' | 'otros'

export type Condition = 'nuevo_sellado' | 'nuevo' | 'usado_como_nuevo' | 'usado_buen_estado' | 'usado_aceptable'
export type ProductStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'sold' | 'archived'

export interface User {
  id: string
  email: string
  name: string | null
  phone: string | null
  instagram: string | null
  is_admin: boolean
  created_at: string
}

export interface Product {
  id: string
  seller_id: string
  product_type: ProductType
  brand: string
  model: string | null
  condition: Condition
  seasons_used: string | null
  description: string | null
  price: number
  region: string
  comuna: string
  attributes: Record<string, unknown>
  status: ProductStatus
  rejection_reason: string | null
  terms_accepted: boolean
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  url: string
  order: number
  created_at: string
}

export interface ProductWithImages extends Product {
  product_images: ProductImage[]
  users?: Pick<User, 'name'>
}
