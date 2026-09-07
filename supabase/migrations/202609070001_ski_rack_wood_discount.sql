-- Precio promocional del Ski Rack Madera. Las órdenes existentes conservan
-- el precio guardado en sus snapshots; los nuevos checkouts usan $15.990.
BEGIN;

UPDATE public.ski_rack_products
SET
  price_clp = 15990,
  updated_at = NOW()
WHERE slug = 'madera';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.ski_rack_products
    WHERE slug = 'madera'
      AND price_clp = 15990
  ) THEN
    RAISE EXCEPTION 'Ski Rack Madera promotional price was not applied';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ski_rack_products
    WHERE slug = 'filamento'
      AND price_clp = 7990
  ) THEN
    RAISE EXCEPTION 'Ski Rack Filamento price must remain 7990';
  END IF;
END;
$$;

COMMIT;
