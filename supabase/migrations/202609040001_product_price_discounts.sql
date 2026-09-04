-- Preserve the previous listing price when a seller lowers a price so the
-- catalogue can show a clear discount without conflating it with sale_price.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS previous_price INTEGER
  CHECK (previous_price IS NULL OR previous_price > price);

COMMENT ON COLUMN public.products.previous_price IS
  'Previous listing price shown as a discount reference when price was reduced.';
