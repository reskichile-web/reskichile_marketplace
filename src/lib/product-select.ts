// Explicit product projections are security-sensitive. `anon_contact` contains
// the phone for account-less sellers and must only be read with service_role
// after the contact endpoint has applied its abuse controls.
export const PRODUCT_WITH_IMAGES_SELECT =
  'id, seller_id, product_type, brand, model, condition, description, price, previous_price, region, comuna, attributes, status, rejection_reason, terms_accepted, days_published, sale_price, sold_at, sold_channel, sold_speed, commerce_owned, shipping_origin_code, packaged_length_cm, packaged_width_cm, packaged_height_cm, packaged_weight_kg, created_at, updated_at, slug, product_images(*)' as const

export const PRODUCT_WITH_EDIT_IMAGES_SELECT =
  'id, seller_id, product_type, brand, model, condition, description, price, previous_price, region, comuna, attributes, status, rejection_reason, terms_accepted, days_published, sale_price, sold_at, sold_channel, sold_speed, commerce_owned, shipping_origin_code, packaged_length_cm, packaged_width_cm, packaged_height_cm, packaged_weight_kg, created_at, updated_at, slug, product_images(id, url, order)' as const
