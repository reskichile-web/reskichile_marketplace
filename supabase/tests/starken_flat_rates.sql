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
    AND amount_clp = 4990
    AND active;
  IF v_local_rate_count <> 2 THEN
    RAISE EXCEPTION 'expected two local warehouse rates, got %', v_local_rate_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.shipping_rates rate
    JOIN public.shipping_zones zone ON zone.id = rate.zone_id
    WHERE rate.service_code = 'starken_flat_xs'
      AND rate.amount_clp NOT IN (6990, 7990, 9990)
  ) THEN
    RAISE EXCEPTION 'an unexpected Starken regional amount was configured';
  END IF;
END;
$$;

ROLLBACK;
