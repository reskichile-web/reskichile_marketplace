export interface Conversation {
  id: string
  product_id: string | null
  buyer_id: string
  seller_id: string
  last_message_at: string
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  delivered_at: string | null
  read_at: string | null
  created_at: string
  // client-only flags
  pending?: boolean
  failed?: boolean
}

export interface ConversationListItem extends Conversation {
  product?: {
    id: string
    brand: string | null
    model: string | null
    slug: string | null
    product_type: string
    price: number
    image_url?: string | null
  } | null
  other_user?: {
    id: string
    name: string | null
    avatar_url: string | null
  } | null
  last_message?: {
    body: string
    created_at: string
    sender_id: string
  } | null
  unread_count: number
}
