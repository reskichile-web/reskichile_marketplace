-- Regression coverage for strict phone input, normalized address persistence,
-- and idempotent retries. Always runs against the isolated migration DB.

BEGIN;

DO $$
DECLARE
  v_result JSONB;
  v_snapshot JSONB := '{
    "country_code":"CL",
    "region":"Metropolitana de Santiago",
    "commune":"Las Condes",
    "street":"Avenida Apoquindo",
    "number":"3000",
    "extra":null,
    "formatted_address":null,
    "provider":"manual",
    "provider_place_id":null,
    "validation_status":"unverified",
    "validated_at":null,
    "pickup_point_id":null
  }'::JSONB;
  v_rejected BOOLEAN := FALSE;
  v_stored JSONB;
BEGIN
  UPDATE public.ski_rack_inventory inventory
  SET stock_on_hand = 5
  FROM public.ski_rack_products product
  WHERE product.id = inventory.rack_product_id
    AND product.slug = 'madera'
    AND inventory.size = 'S'
    AND inventory.shipping_origin_code = 'los_angeles';

  BEGIN
    PERFORM public.commerce_create_rack_checkout(
      '[{"slug":"madera","size":"S","quantity":1}]'::JSONB,
      NULL, 'buyer@example.com', 'Buyer Test', '+56 9 1234 5678',
      'home', 'Metropolitana de Santiago', 'Las Condes',
      'Avenida Apoquindo', '3000', NULL, NULL, 3990, 'sandbox_fixed',
      'los_angeles', NULL, 'integration',
      '81000000-0000-4000-8000-000000000001', repeat('a', 64),
      'TEST-ADDR-BAD', 'TESTADDRBAD', 'TESTSESSIONBAD', repeat('b', 64),
      15, TRUE, v_snapshot
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := SQLERRM LIKE '%invalid buyer or destination%';
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'checkout RPC accepted a noncanonical phone';
  END IF;

  v_result := public.commerce_create_rack_checkout(
    '[{"slug":"madera","size":"S","quantity":1}]'::JSONB,
    NULL, 'buyer@example.com', 'Buyer Test', '+56912345678',
    'home', 'Metropolitana de Santiago', 'Las Condes',
    'Avenida Apoquindo', '3000', NULL, NULL, 3990, 'sandbox_fixed',
    'los_angeles', NULL, 'integration',
    '81000000-0000-4000-8000-000000000002', repeat('c', 64),
    'TEST-ADDR-OK', 'TESTADDROK', 'TESTSESSIONOK', repeat('d', 64),
    15, TRUE, v_snapshot
  );
  IF COALESCE((v_result->>'reused')::BOOLEAN, TRUE) THEN
    RAISE EXCEPTION 'new address checkout was unexpectedly reused';
  END IF;

  SELECT shipping_snapshot INTO v_stored
  FROM public.orders WHERE id = (v_result->>'order_id')::UUID;
  IF v_stored <> jsonb_strip_nulls(v_snapshot)
    OR v_stored->>'country_code' <> 'CL'
    OR v_stored->>'provider' <> 'manual' THEN
    RAISE EXCEPTION 'normalized shipping snapshot was not persisted: %', v_stored;
  END IF;

  v_result := public.commerce_create_rack_checkout(
    '[{"slug":"madera","size":"S","quantity":1}]'::JSONB,
    NULL, 'buyer@example.com', 'Buyer Test', '+56912345678',
    'home', 'Metropolitana de Santiago', 'Las Condes',
    'Avenida Apoquindo', '3000', NULL, NULL, 3990, 'sandbox_fixed',
    'los_angeles', NULL, 'integration',
    '81000000-0000-4000-8000-000000000002', repeat('c', 64),
    'IGNORED-RETRY', 'IGNOREDRETRY', 'IGNOREDSESSION', repeat('d', 64),
    15, TRUE, v_snapshot
  );
  IF COALESCE((v_result->>'reused')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'matching address retry was not reused';
  END IF;

  v_rejected := FALSE;
  BEGIN
    PERFORM public.commerce_create_rack_checkout(
      '[{"slug":"madera","size":"S","quantity":1}]'::JSONB,
      NULL, 'buyer@example.com', 'Buyer Test', '+56912345678',
      'home', 'Metropolitana de Santiago', 'Las Condes',
      'Avenida Apoquindo', '3001', NULL, NULL, 3990, 'sandbox_fixed',
      'los_angeles', NULL, 'integration',
      '81000000-0000-4000-8000-000000000002', repeat('c', 64),
      'IGNORED-CHANGE', 'IGNOREDCHANGE', 'IGNOREDCHANGE', repeat('d', 64),
      15, TRUE, jsonb_set(v_snapshot, '{number}', '"3001"')
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := SQLERRM LIKE '%shipping snapshot%';
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'idempotent retry substituted the shipping snapshot';
  END IF;

  v_rejected := FALSE;
  BEGIN
    PERFORM public.commerce_validate_shipping_snapshot(
      v_snapshot, 'home', 'production',
      'Metropolitana de Santiago', 'Las Condes'
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := SQLERRM LIKE '%must be confirmed%';
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'production accepted an unverified home address';
  END IF;
END;
$$;

ROLLBACK;
