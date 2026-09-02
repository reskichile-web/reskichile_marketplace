-- Perfil conservador de una caja terminada. Se usa la talla L en su extremo
-- superior (135 g + 5 g) para cotizar cualquier talla del Ski Rack.
BEGIN;

UPDATE public.ski_rack_products
SET
  packaged_length_cm = 15,
  packaged_width_cm = 10,
  packaged_height_cm = 3,
  packaged_weight_kg = 0.140,
  updated_at = NOW()
WHERE slug IN ('madera', 'filamento');

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.ski_rack_products
    WHERE slug IN ('madera', 'filamento')
      AND packaged_length_cm = 15
      AND packaged_width_cm = 10
      AND packaged_height_cm = 3
      AND packaged_weight_kg = 0.140
  ) <> 2 THEN
    RAISE EXCEPTION 'Ski Rack package profile was not applied to both products';
  END IF;
END;
$$;

COMMIT;
