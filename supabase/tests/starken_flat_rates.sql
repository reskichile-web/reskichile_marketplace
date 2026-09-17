BEGIN;

DO $$
DECLARE
  v_region_count INTEGER;
  v_region_rate_count INTEGER;
  v_local_rate_count INTEGER;
  v_definition TEXT;
  v_result JSONB;
  v_quote_amount INTEGER;
  v_per_unit_total_rejected BOOLEAN := FALSE;
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

  IF EXISTS (
    SELECT 1
    FROM public.shipping_rates
    WHERE service_code LIKE 'starken_flat_%'
      AND active
      AND package_tier IS NULL
  ) THEN
    RAISE EXCEPTION 'an active Starken flat rate has no package tier';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.shipping_rates rate
    JOIN public.shipping_zones zone ON zone.id = rate.zone_id
    WHERE rate.service_code = 'starken_flat_s'
      AND rate.package_tier = 's'
      AND rate.active
      AND zone.commune IS NULL
  ) <> 32 THEN
    RAISE EXCEPTION 'expected 32 active regional Starken S rates';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.shipping_rates rate
    JOIN public.shipping_zones zone ON zone.id = rate.zone_id
    WHERE rate.service_code = 'starken_flat_s'
      AND rate.active
      AND rate.amount_clp <> CASE
        WHEN zone.region IN (
          'Arica y Parinacota', 'Tarapacá', 'Antofagasta'
        ) THEN 13540
        WHEN zone.region IN (
          'Aysén del General Carlos Ibáñez del Campo',
          'Magallanes y de la Antártica Chilena'
        ) THEN 14190
        ELSE 8830
      END
  ) THEN
    RAISE EXCEPTION 'an unexpected Starken S amount was configured';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.shipping_rates
    WHERE service_code = 'starken_flat_s_local'
      AND package_tier = 's'
      AND amount_clp = 6090
      AND active
  ) <> 2 THEN
    RAISE EXCEPTION 'expected two same-city Starken S rates';
  END IF;

  IF public.commerce_starken_package_tier(0.700, 2250) <> 'xs'
    OR public.commerce_starken_package_tier(0.980, 3150) <> 's'
    OR public.commerce_starken_package_tier(1.000, 24000) <> 'm'
    OR public.commerce_starken_package_tier(12.000, 54000) IS NOT NULL THEN
    RAISE EXCEPTION 'Starken package tier calculation is invalid';
  END IF;

  SELECT pg_get_functiondef(
    'public.commerce_create_rack_checkout(jsonb,uuid,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,uuid,text,text,text,text,text,integer,boolean)'::regprocedure
  ) INTO v_definition;
  IF v_definition LIKE '%rate.amount_clp::BIGINT * v_unit_count%'
    OR v_definition NOT LIKE '%commerce_starken_package_tier%'
    OR v_definition NOT LIKE '%rate.amount_clp::BIGINT = p_shipping_amount_clp::BIGINT%' THEN
    RAISE EXCEPTION 'rack checkout still validates shipping per unit';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ski_rack_products
    WHERE slug = 'madera'
      AND price_clp = 15990
  ) THEN
    RAISE EXCEPTION 'expected Ski Rack Madera price to be 15990';
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

  UPDATE public.ski_rack_inventory inventory
  SET stock_on_hand = 10
  FROM public.ski_rack_products product
  WHERE inventory.rack_product_id = product.id
    AND product.slug = 'filamento'
    AND inventory.size = 'M'
    AND inventory.shipping_origin_code = 'las_condes';

  BEGIN
    PERFORM public.commerce_create_rack_checkout(
      p_items => '[{"slug":"filamento","size":"M","quantity":5}]'::JSONB,
      p_buyer_user_id => NULL,
      p_buyer_email => 'shipping-test@example.cl',
      p_buyer_name => 'Shipping Test',
      p_buyer_phone => '+56912345678',
      p_delivery_method => 'home',
      p_shipping_region => 'Metropolitana de Santiago',
      p_shipping_commune => 'Providencia',
      p_shipping_street => 'Avenida Providencia',
      p_shipping_number => '1234',
      p_shipping_extra => NULL,
      p_pickup_point_id => NULL,
      p_shipping_amount_clp => 17450,
      p_shipping_source => 'table',
      p_shipping_origin_code => 'las_condes',
      p_coupon_code => NULL,
      p_environment => 'integration',
      p_idempotency_key => '17100000-0000-4000-8000-000000000001'::UUID,
      p_request_fingerprint => repeat('a', 64),
      p_order_number => 'RC-SHIPPING-BAD',
      p_buy_order => 'RCSHIPPINGBAD',
      p_session_id => 'shipping-bad-session',
      p_guest_access_hash => repeat('b', 64),
      p_reservation_minutes => 15,
      p_allow_incomplete_shipping => FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'shipping rate is invalid or expired' THEN
      v_per_unit_total_rejected := TRUE;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_per_unit_total_rejected THEN
    RAISE EXCEPTION 'rack checkout accepted a five-times shipping amount';
  END IF;

  v_result := public.commerce_create_rack_checkout(
    p_items => '[{"slug":"filamento","size":"M","quantity":5}]'::JSONB,
    p_buyer_user_id => NULL,
    p_buyer_email => 'shipping-test@example.cl',
    p_buyer_name => 'Shipping Test',
    p_buyer_phone => '+56912345678',
    p_delivery_method => 'home',
    p_shipping_region => 'Metropolitana de Santiago',
    p_shipping_commune => 'Providencia',
    p_shipping_street => 'Avenida Providencia',
    p_shipping_number => '1234',
    p_shipping_extra => NULL,
    p_pickup_point_id => NULL,
    p_shipping_amount_clp => 3490,
    p_shipping_source => 'table',
    p_shipping_origin_code => 'las_condes',
    p_coupon_code => NULL,
    p_environment => 'integration',
    p_idempotency_key => '17100000-0000-4000-8000-000000000002'::UUID,
    p_request_fingerprint => repeat('c', 64),
    p_order_number => 'RC-SHIPPING-GOOD',
    p_buy_order => 'RCSHIPPINGGOOD',
    p_session_id => 'shipping-good-session',
    p_guest_access_hash => repeat('d', 64),
    p_reservation_minutes => 15,
    p_allow_incomplete_shipping => FALSE
  );

  SELECT amount_clp INTO v_quote_amount
  FROM public.shipping_quotes
  WHERE order_id = (v_result->>'order_id')::UUID;
  IF (v_result->>'total_clp')::INTEGER <> 43440 OR v_quote_amount <> 3490 THEN
    RAISE EXCEPTION 'five-unit consolidated checkout did not charge one XS rate';
  END IF;
END;
$$;

ROLLBACK;
