-- Pickup, tracking and environment-scoped outbox smoke test.
BEGIN;

DO $$
DECLARE
  v_admin UUID := 'd1000000-0000-4000-8000-000000000001';
  v_home_order UUID;
  v_home_public UUID;
  v_pickup_order UUID;
  v_pickup_public UUID;
  v_prod_order UUID;
  v_prod_attempt UUID;
  v_count INTEGER;
  v_result JSONB;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (v_admin, 'delivery-admin@example.com', '{"name":"Delivery Admin"}');
  UPDATE public.users SET is_admin = TRUE WHERE id = v_admin;

  IF (SELECT COUNT(*) FROM public.shipping_origins WHERE pickup_enabled) <> 2
    OR (SELECT COUNT(*) FROM public.shipping_rates WHERE service_code = 'pickup' AND amount_clp = 0 AND active) <> 2 THEN
    RAISE EXCEPTION 'the two free pickup points are not configured';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.shipping_origins
    WHERE code = 'las_condes'
      AND operational_address->>'formatted_address' = 'La Gloria 40'
      AND pickup_hours = 'Lunes a viernes, de 9:00 a 19:00'
      AND pickup_address = 'Sector Escuela Militar, Apoquindo'
  ) THEN RAISE EXCEPTION 'Las Condes private pickup details are not configured'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.shipping_origins
    WHERE code = 'los_angeles'
      AND operational_address IS NULL
      AND pickup_hours IS NULL
  ) THEN RAISE EXCEPTION 'Los Angeles pickup details must remain pending'; END IF;

  INSERT INTO public.orders (
    order_number, buyer_email, buyer_name, buyer_phone, delivery_method,
    shipping_snapshot, order_status, payment_status, fulfillment_status,
    subtotal_clp, discount_clp, shipping_clp, total_clp, idempotency_key,
    request_fingerprint, guest_access_hash, expires_at
  ) VALUES (
    'TEST-DELIVERY-HOME', 'home@example.com', 'Home Buyer', '+56911111111',
    'home', '{"region":"Metropolitana de Santiago","commune":"Las Condes","street":"Apoquindo","number":"1"}',
    'preparing', 'authorized', 'preparing', 50000, 0, 3990, 53990,
    'd2000000-0000-4000-8000-000000000001', repeat('a', 64), repeat('b', 64),
    NOW() + INTERVAL '1 day'
  ) RETURNING id, public_id INTO v_home_order, v_home_public;
  INSERT INTO public.payment_attempts (
    order_id, environment, state, amount_clp, buy_order, session_id,
    transbank_token, authorized_at
  ) VALUES (
    v_home_order, 'integration', 'authorized', 53990, 'TESTDELIVERYHOME',
    'TESTDELIVERYHOMESESSION', 'test_delivery_home_token_00000001', NOW()
  );

  BEGIN
    PERFORM public.commerce_admin_update_fulfillment(
      v_home_public, v_admin, 'shipped', gen_random_uuid()
    );
    RAISE EXCEPTION 'generic fulfillment unexpectedly allowed shipped without tracking';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'generic fulfillment unexpectedly allowed shipped without tracking' THEN RAISE; END IF;
  END;

  v_result := public.commerce_admin_mark_shipped(
    v_home_public, v_admin, 'Starken', 'OT-TEST-1',
    'https://www.starken.cl/seguimiento', gen_random_uuid()
  );
  IF v_result->>'fulfillment_status' <> 'shipped' THEN
    RAISE EXCEPTION 'home order was not marked shipped';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.commerce_outbox
    WHERE order_id = v_home_order AND kind = 'shipment_notice'
  ) THEN RAISE EXCEPTION 'shipment email was not enqueued'; END IF;

  INSERT INTO public.orders (
    order_number, buyer_email, buyer_name, buyer_phone, delivery_method,
    shipping_snapshot, order_status, payment_status, fulfillment_status,
    subtotal_clp, discount_clp, shipping_clp, total_clp, idempotency_key,
    request_fingerprint, guest_access_hash, expires_at
  ) VALUES (
    'TEST-DELIVERY-PICKUP', 'pickup@example.com', 'Pickup Buyer', '+56922222222',
    'pickup', '{"region":"Región del Biobío","commune":"Los Ángeles","pickup_point_id":"los_angeles"}',
    'preparing', 'authorized', 'preparing', 50000, 0, 0, 50000,
    'd2000000-0000-4000-8000-000000000002', repeat('c', 64), repeat('d', 64),
    NOW() + INTERVAL '1 day'
  ) RETURNING id, public_id INTO v_pickup_order, v_pickup_public;
  INSERT INTO public.payment_attempts (
    order_id, environment, state, amount_clp, buy_order, session_id,
    transbank_token, authorized_at
  ) VALUES (
    v_pickup_order, 'integration', 'authorized', 50000, 'TESTDELIVERYPICKUP',
    'TESTDELIVERYPICKUPSESSION', 'test_delivery_pickup_token_00001', NOW()
  );

  v_result := public.commerce_admin_update_fulfillment(
    v_pickup_public, v_admin, 'ready_for_pickup', gen_random_uuid()
  );
  IF v_result->>'fulfillment_status' <> 'ready_for_pickup'
    OR NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = v_pickup_order AND ready_for_pickup_at IS NOT NULL
    ) THEN RAISE EXCEPTION 'pickup order was not marked ready'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.commerce_outbox
    WHERE order_id = v_pickup_order AND kind = 'pickup_ready_notice'
  ) THEN RAISE EXCEPTION 'pickup email was not enqueued'; END IF;

  INSERT INTO public.orders (
    order_number, buyer_email, buyer_name, buyer_phone, delivery_method,
    shipping_snapshot, subtotal_clp, discount_clp, shipping_clp, total_clp,
    idempotency_key, request_fingerprint, guest_access_hash, expires_at
  ) VALUES (
    'TEST-DELIVERY-PROD', 'prod@example.com', 'Prod Buyer', '+56933333333',
    'pickup', '{"region":"Región del Biobío","commune":"Los Ángeles","pickup_point_id":"los_angeles"}',
    50000, 0, 0, 50000, 'd2000000-0000-4000-8000-000000000003',
    repeat('e', 64), repeat('f', 64), NOW() + INTERVAL '1 day'
  ) RETURNING id INTO v_prod_order;
  INSERT INTO public.payment_attempts (
    order_id, environment, state, amount_clp, buy_order, session_id
  ) VALUES (
    v_prod_order, 'production', 'reconciliation_required', 50000,
    'TESTDELIVERYPROD', 'TESTDELIVERYPRODSESSION'
  ) RETURNING id INTO v_prod_attempt;
  INSERT INTO public.commerce_outbox (
    kind, order_id, payment_attempt_id, dedupe_key
  ) VALUES ('payment_alert', v_prod_order, v_prod_attempt, 'delivery-prod-alert/test');

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.commerce_claim_outbox(10, gen_random_uuid(), 'integration');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'integration claim should contain two delivery emails, got %', v_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.commerce_outbox
    WHERE order_id = v_prod_order AND state = 'processing'
  ) THEN RAISE EXCEPTION 'integration worker claimed a production email'; END IF;
END;
$$;

ROLLBACK;
