BEGIN;

DO $$
DECLARE
  v_region_count INTEGER;
  v_region_rate_count INTEGER;
  v_local_rate_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_region_count
  FROM public.shipping_zones
  WHERE delivery_method = 'home'
    AND commune IS NULL
    AND active;
  IF v_region_count <> 16 THEN
    RAISE EXCEPTION 'expected 16 active Starken home regions, got %', v_region_count;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_region_rate_count
  FROM public.shipping_rates rate
  JOIN public.shipping_zones zone ON zone.id = rate.zone_id
  WHERE rate.service_code = 'starken_flat_xs'
    AND rate.active
    AND zone.active;
  IF v_region_rate_count <> 32 THEN
    RAISE EXCEPTION 'expected 32 active regional rates, got %', v_region_rate_count;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_local_rate_count
  FROM public.shipping_rates
  WHERE service_code = 'starken_flat_xs_local'
    AND amount_clp = 1990
    AND active;
  IF v_local_rate_count <> 2 THEN
    RAISE EXCEPTION 'expected two local warehouse rates, got %', v_local_rate_count;
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
    RAISE EXCEPTION 'an unexpected Starken regional amount was configured';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ski_rack_products
    WHERE slug = 'madera'
      AND price_clp = 17990
  ) THEN
    RAISE EXCEPTION 'expected Ski Rack Madera price to be 17990';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ski_rack_products
    WHERE slug = 'filamento'
      AND price_clp = 7990
  ) THEN
    RAISE EXCEPTION 'expected Ski Rack Filamento price to remain 7990';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.ski_rack_products
    WHERE slug IN ('madera', 'filamento')
      AND packaged_length_cm = 15
      AND packaged_width_cm = 10
      AND packaged_height_cm = 3
      AND packaged_weight_kg = 0.140
  ) <> 2 THEN
    RAISE EXCEPTION 'expected the conservative 15 x 10 x 3 cm, 140 g package profile';
  END IF;
END;
$$;

ROLLBACK;
