-- Complete-equipment packs are intentionally unstructured, just like "Otros".
-- Their varying components belong in the listing title and description.
UPDATE public.products
SET attributes = '{}'::JSONB
WHERE product_type = 'equipos_completos'
  AND COALESCE(attributes, '{}'::JSONB) <> '{}'::JSONB;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_otros_without_attributes;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_unstructured_categories_without_attributes;

ALTER TABLE public.products
  ADD CONSTRAINT products_unstructured_categories_without_attributes
  CHECK (
    product_type NOT IN ('otros', 'equipos_completos')
    OR COALESCE(attributes, '{}'::JSONB) = '{}'::JSONB
  );
