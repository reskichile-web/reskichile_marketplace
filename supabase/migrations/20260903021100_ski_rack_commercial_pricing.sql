-- Precio comercial del Ski Rack Madera y despacho subsidiado por zona para
-- ambos modelos. El Ski Rack Filamento conserva su precio de $7.990.
-- Las órdenes existentes conservan los montos guardados en sus snapshots.
BEGIN;

UPDATE public.ski_rack_products
SET
  price_clp = 17990,
  updated_at = NOW()
WHERE slug = 'madera';

UPDATE public.shipping_rates rate
SET
  amount_clp = CASE
    WHEN zone.region IN (
      'Arica y Parinacota',
      'Tarapacá',
      'Antofagasta'
    ) THEN 4490
    WHEN zone.region IN (
      'Aysén del General Carlos Ibáñez del Campo',
      'Magallanes y de la Antártica Chilena'
    ) THEN 5990
    ELSE 3490
  END,
  source_note = 'Tarifa comercial ReskiChile subsidiada por zona; aprobada 2026-09-02',
  updated_at = NOW()
FROM public.shipping_zones zone
WHERE rate.zone_id = zone.id
  AND rate.service_code = 'starken_flat_xs'
  AND rate.active = TRUE;

UPDATE public.shipping_rates
SET
  amount_clp = 1990,
  source_note = 'Tarifa comercial ReskiChile subsidiada para despacho en la misma comuna; aprobada 2026-09-02',
  updated_at = NOW()
WHERE service_code = 'starken_flat_xs_local'
  AND active = TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.ski_rack_products
    WHERE slug = 'madera'
      AND price_clp = 17990
  ) THEN
    RAISE EXCEPTION 'Ski Rack Madera commercial price was not applied';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ski_rack_products
    WHERE slug = 'filamento'
      AND price_clp = 7990
  ) THEN
    RAISE EXCEPTION 'Ski Rack Filamento price must remain 7990';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.shipping_rates
    WHERE service_code = 'starken_flat_xs_local'
      AND amount_clp = 1990
      AND active
  ) <> 2 THEN
    RAISE EXCEPTION 'local commercial shipping rates were not applied';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.shipping_rates rate
    JOIN public.shipping_zones zone ON zone.id = rate.zone_id
    WHERE rate.service_code = 'starken_flat_xs'
      AND rate.active
      AND rate.amount_clp <> CASE
        WHEN zone.region IN (
          'Arica y Parinacota',
          'Tarapacá',
          'Antofagasta'
        ) THEN 4490
        WHEN zone.region IN (
          'Aysén del General Carlos Ibáñez del Campo',
          'Magallanes y de la Antártica Chilena'
        ) THEN 5990
        ELSE 3490
      END
  ) THEN
    RAISE EXCEPTION 'regional commercial shipping rates were not applied';
  END IF;
END;
$$;

COMMIT;
