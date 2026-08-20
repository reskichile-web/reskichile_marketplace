-- Verifica que el contexto de anulación/timeout sobreviva a la conciliación.

BEGIN;

DO $$
DECLARE
  v_order_id UUID;
  v_attempt_id UUID;
  v_kind TEXT;
  v_claim JSONB;
  v_event_count INTEGER;
BEGIN
  INSERT INTO public.orders (
    order_number, buyer_email, buyer_name, buyer_phone, delivery_method,
    shipping_snapshot, subtotal_clp, discount_clp, shipping_clp, total_clp,
    idempotency_key, request_fingerprint, guest_access_hash, expires_at
  ) VALUES (
    'TEST-RETURN-0001', 'return-test@example.com', 'Return Test',
    '+56912345678', 'home',
    '{"region":"Región del Biobío","commune":"Los Ángeles"}'::JSONB,
    11990, 0, 3990, 15980,
    '81000000-0000-4000-8000-000000000001',
    repeat('c', 64), repeat('d', 64), NOW() + INTERVAL '15 minutes'
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.payment_attempts (
    order_id, environment, state, amount_clp, buy_order, session_id,
    transbank_token
  ) VALUES (
    v_order_id, 'integration', 'initialized', 15980,
    'TESTRETURN0001', 'TESTRETURNSESSION0001',
    'test_return_token_00000000000001'
  ) RETURNING id INTO v_attempt_id;

  v_kind := public.commerce_record_webpay_return_context(
    v_attempt_id, 'aborted', '82000000-0000-4000-8000-000000000001'
  );
  IF v_kind <> 'aborted' THEN
    RAISE EXCEPTION 'abort context was not recorded: %', v_kind;
  END IF;

  -- Replays are idempotent and do not create duplicate classification events.
  v_kind := public.commerce_record_webpay_return_context(
    v_attempt_id, 'aborted', '82000000-0000-4000-8000-000000000002'
  );
  SELECT COUNT(*)::INTEGER INTO v_event_count
  FROM public.payment_events
  WHERE payment_attempt_id = v_attempt_id
    AND event_type = 'webpay_return_classified';
  IF v_kind <> 'aborted' OR v_event_count <> 1 THEN
    RAISE EXCEPTION 'abort replay was not idempotent: kind %, events %',
      v_kind, v_event_count;
  END IF;

  v_claim := public.commerce_claim_webpay_status(
    'test_return_token_00000000000001',
    '82000000-0000-4000-8000-000000000003'
  );
  IF v_claim->>'action' <> 'status'
    OR v_claim->>'webpay_return_kind' <> 'aborted' THEN
    RAISE EXCEPTION 'claim lost abort context: %', v_claim;
  END IF;

  -- Contradictory browser returns fail closed as special.
  v_kind := public.commerce_record_webpay_return_context(
    v_attempt_id, 'timeout', '82000000-0000-4000-8000-000000000004'
  );
  IF v_kind <> 'special' THEN
    RAISE EXCEPTION 'conflicting returns did not fail closed: %', v_kind;
  END IF;
END;
$$;

ROLLBACK;
