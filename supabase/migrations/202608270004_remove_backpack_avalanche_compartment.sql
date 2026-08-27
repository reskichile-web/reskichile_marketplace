-- Whether a backpack has an avalanche-equipment compartment is no longer a
-- marketplace attribute. Keep capacity and every other backpack field intact.
UPDATE public.products
SET attributes = COALESCE(attributes, '{}'::JSONB) - 'compartimiento_avalancha'
WHERE product_type = 'mochilas'
  AND COALESCE(attributes, '{}'::JSONB) ? 'compartimiento_avalancha';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_backpacks_without_avalanche_compartment_attribute;

ALTER TABLE public.products
  ADD CONSTRAINT products_backpacks_without_avalanche_compartment_attribute
  CHECK (
    product_type <> 'mochilas'
    OR NOT (COALESCE(attributes, '{}'::JSONB) ? 'compartimiento_avalancha')
  );
