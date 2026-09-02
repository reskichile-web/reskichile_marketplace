-- Functional smoke test. Run only against an isolated database after all
-- commerce migrations. The surrounding transaction always rolls back.

BEGIN;

DO $$
DECLARE
  v_admin UUID := '10000000-0000-4000-8000-000000000001';
  v_buyer UUID := '10000000-0000-4000-8000-000000000002';
  v_order_id UUID;
  v_public_id UUID;
  v_attempt_id UUID;
  v_inventory_id UUID;
  v_refund_id UUID;
  v_claim JSONB;
  v_result JSONB;
  v_count INTEGER;
  v_stock INTEGER;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (v_admin, 'admin-test@example.com', '{"name":"Admin Test"}'),
    (v_buyer, 'buyer-test@example.com', '{"name":"Buyer Test"}');
  UPDATE public.users
  SET name = 'Admin Test', is_admin = TRUE
  WHERE id = v_admin;

  SELECT inventory.id INTO v_inventory_id
  FROM public.ski_rack_inventory inventory
  JOIN public.ski_rack_products product ON product.id = inventory.rack_product_id
  WHERE product.slug = 'madera'
    AND inventory.size = 'S'
    AND inventory.shipping_origin_code = 'los_angeles';

  -- Production starts at zero until an administrator reconciles physical
  -- inventory. This isolated test explicitly provisions five units.
  UPDATE public.ski_rack_inventory
  SET stock_on_hand = 5
  WHERE id = v_inventory_id;

  INSERT INTO public.orders (
    order_number, buyer_user_id, buyer_email, buyer_name, buyer_phone,
    delivery_method, shipping_snapshot, subtotal_clp, discount_clp,
    shipping_clp, total_clp, idempotency_key, request_fingerprint,
    guest_access_hash, expires_at
  ) VALUES (
    'TEST-OPS-0001', v_buyer, 'buyer-test@example.com', 'Buyer Test',
    '+56912345678', 'home',
    '{"region":"Región del Biobío","commune":"Los Ángeles"}'::JSONB,
    23980, 0, 0, 23980, '20000000-0000-4000-8000-000000000001',
    repeat('a', 64), repeat('b', 64), NOW() + INTERVAL '15 minutes'
  ) RETURNING id, public_id INTO v_order_id, v_public_id;

  INSERT INTO public.order_items (
    order_id, rack_inventory_id, sku, product_name, product_type,
    unit_price_clp, quantity, line_total_clp, shipping_origin_code,
    package_snapshot
  ) VALUES (
    v_order_id, v_inventory_id, 'RACK-MADERA-S', 'Ski Rack Madera · Talla S',
    'ski_rack', 11990, 2, 23980, 'los_angeles',
    '{"length_cm":10,"width_cm":10,"height_cm":20,"weight_kg":0.5}'::JSONB
  );

  INSERT INTO public.inventory_reservations (
    order_id, rack_inventory_id, quantity, state, expires_at
  ) VALUES (
    v_order_id, v_inventory_id, 2, 'payment_processing',
    NOW() + INTERVAL '15 minutes'
  );

  INSERT INTO public.payment_attempts (
    order_id, environment, state, amount_clp, buy_order, session_id,
    transbank_token, commit_started_at
  ) VALUES (
    v_order_id, 'integration', 'processing', 23980, 'TESTOPS0001',
    'TESTSESSION0001', 'test_token_00000000000000000001', NOW()
  ) RETURNING id INTO v_attempt_id;

  v_result := public.commerce_finalize_webpay(
    v_attempt_id, 'authorized', 23980, 'TESTOPS0001', 'TESTSESSION0001',
    'AUTHORIZED', 0, 'ABC123', 'VN', 0, '1234', NOW(),
    '30000000-0000-4000-8000-000000000001'
  );
  IF v_result->>'attempt_state' <> 'authorized' THEN
    RAISE EXCEPTION 'authorization did not finalize: %', v_result;
  END IF;

  SELECT stock_on_hand INTO v_stock
  FROM public.ski_rack_inventory WHERE id = v_inventory_id;
  IF v_stock <> 3 THEN
    RAISE EXCEPTION 'rack stock was not decremented exactly once: %', v_stock;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.commerce_outbox
  WHERE order_id = v_order_id
    AND kind IN ('order_confirmation', 'fulfillment_notice');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'paid order did not enqueue two operations: %', v_count;
  END IF;

  v_result := public.commerce_request_refund(
    v_public_id, v_admin, 23980, 'Cancelación solicitada por prueba',
    '40000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001'
  );
  v_refund_id := (v_result->>'refund_id')::UUID;
  v_claim := public.commerce_claim_refund(
    v_refund_id, '50000000-0000-4000-8000-000000000001'
  );
  IF v_claim->>'action' <> 'refund' THEN
    RAISE EXCEPTION 'refund was not claimed: %', v_claim;
  END IF;

  v_result := public.commerce_finalize_refund(
    v_refund_id, '50000000-0000-4000-8000-000000000001', 'succeeded',
    'NULLIFIED', 0, 'RF1234', NOW(), 0, 23980, NULL,
    '{"type":"NULLIFIED","response_code":0,"balance":0,"nullified_amount":23980}'::JSONB
  );
  IF v_result->>'state' <> 'succeeded'
    OR v_result->>'payment_status' <> 'refunded' THEN
    RAISE EXCEPTION 'refund did not finalize: %', v_result;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.commerce_outbox
    WHERE refund_id = v_refund_id AND kind = 'refund_confirmation'
  ) THEN
    RAISE EXCEPTION 'successful refund did not enqueue buyer confirmation';
  END IF;

  v_result := public.commerce_request_refund(
    v_public_id, v_admin, 23980, 'Cancelación solicitada por prueba',
    '40000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002'
  );
  IF COALESCE((v_result->>'reused')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'refund idempotency did not reuse the original row';
  END IF;

  v_result := public.commerce_admin_update_fulfillment(
    v_public_id, v_admin, 'cancelled',
    '60000000-0000-4000-8000-000000000001'
  );
  IF v_result->>'fulfillment_status' <> 'cancelled' THEN
    RAISE EXCEPTION 'refunded fulfillment was not cancellable';
  END IF;

  SELECT stock_on_hand INTO v_stock
  FROM public.ski_rack_inventory WHERE id = v_inventory_id;
  IF v_stock <> 3 THEN
    RAISE EXCEPTION 'refund incorrectly restocked inventory: %', v_stock;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.commerce_claim_outbox(
    10, '70000000-0000-4000-8000-000000000001', 'integration'
  );
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'outbox claim count is invalid: %', v_count;
  END IF;

  PERFORM public.commerce_complete_outbox(
    id, '70000000-0000-4000-8000-000000000001', 'provider-test-id'
  )
  FROM public.commerce_outbox
  WHERE order_id = v_order_id AND kind = 'order_confirmation';

  PERFORM public.commerce_fail_outbox(
    id, '70000000-0000-4000-8000-000000000001',
    'resend_http_429', TRUE, FALSE
  )
  FROM public.commerce_outbox
  WHERE order_id = v_order_id AND kind = 'fulfillment_notice';

  IF NOT EXISTS (
    SELECT 1 FROM public.commerce_outbox
    WHERE order_id = v_order_id AND kind = 'order_confirmation'
      AND state = 'delivered'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.commerce_outbox
    WHERE order_id = v_order_id AND kind = 'fulfillment_notice'
      AND state = 'retry'
  ) THEN
    RAISE EXCEPTION 'outbox completion/retry transitions failed';
  END IF;
END;
$$;

ROLLBACK;
