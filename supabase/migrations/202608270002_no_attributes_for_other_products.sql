-- "Otros" is deliberately an unstructured fallback category. Keep its
-- product information in brand/model/description and reject attribute drift.
UPDATE public.products
SET attributes = '{}'::JSONB
WHERE product_type = 'otros'
  AND COALESCE(attributes, '{}'::JSONB) <> '{}'::JSONB;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_otros_without_attributes;

ALTER TABLE public.products
  ADD CONSTRAINT products_otros_without_attributes
  CHECK (
    product_type <> 'otros'
    OR COALESCE(attributes, '{}'::JSONB) = '{}'::JSONB
  );
