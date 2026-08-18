
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sale_price integer,
  ADD COLUMN IF NOT EXISTS contact_user_checked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_product_checked boolean DEFAULT false;
;
