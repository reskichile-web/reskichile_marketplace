-- Bounded, evidence-based Webpay recovery. No provider calls in PostgreSQL.
BEGIN;
ALTER TABLE public.payment_attempts ADD COLUMN reconciliation_paused_at TIMESTAMPTZ;
UPDATE public.payment_attempts SET next_reconcile_at = NOW()
WHERE state IN ('processing', 'reconciliation_required') AND next_reconcile_at IS NULL;
CREATE INDEX payment_attempts_automatic_recovery_due_idx
ON public.payment_attempts (environment, next_reconcile_at)
WHERE state IN ('processing', 'reconciliation_required') AND reconciliation_paused_at IS NULL;

CREATE OR REPLACE FUNCTION public.commerce_pause_exhausted_webpay(p_attempt_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_attempt public.payment_attempts%ROWTYPE;
BEGIN
  SELECT * INTO v_attempt FROM public.payment_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF v_attempt.state = 'reconciliation_required' AND v_attempt.reconciliation_paused_at IS NULL
    AND (v_attempt.reconcile_count >= 100 OR v_attempt.created_at <= NOW() - INTERVAL '24 hours') THEN
    UPDATE public.payment_attempts SET reconciliation_paused_at = NOW(), next_reconcile_at = NULL,
      last_error_code = 'manual_review_required', updated_at = NOW() WHERE id = p_attempt_id;
    INSERT INTO public.commerce_outbox (kind, order_id, payment_attempt_id, dedupe_key)
    VALUES ('payment_alert', v_attempt.order_id, v_attempt.id, 'payment-manual-review/' || v_attempt.id::TEXT)
    ON CONFLICT (dedupe_key) DO NOTHING;
    INSERT INTO public.payment_events (payment_attempt_id, order_id, event_type, from_state, to_state, metadata)
    VALUES (v_attempt.id, v_attempt.order_id, 'webpay_manual_review_required', v_attempt.state,
      v_attempt.state, jsonb_build_object('reconcile_count', v_attempt.reconcile_count));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_admin_resume_webpay_reconciliation(
  p_order_public_id UUID, p_admin_user_id UUID, p_correlation_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order_id UUID; v_attempt public.payment_attempts%ROWTYPE;
BEGIN
  IF p_correlation_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = p_admin_user_id AND is_admin = TRUE
  ) THEN RAISE EXCEPTION 'payment administrator is not authorized'; END IF;
  SELECT id INTO v_order_id FROM public.orders WHERE public_id = p_order_public_id;
  IF v_order_id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  PERFORM public.commerce_lock_order_payment_rows(v_order_id);
  SELECT * INTO v_attempt FROM public.payment_attempts WHERE order_id = v_order_id
    AND state IN ('processing', 'reconciliation_required') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF v_attempt.id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.payment_attempts SET reconciliation_paused_at = NULL, next_reconcile_at = NOW()
    WHERE id = v_attempt.id;
  INSERT INTO public.payment_events (payment_attempt_id, order_id, event_type, actor, correlation_id, metadata)
  VALUES (v_attempt.id, v_order_id, 'webpay_admin_review_requested', 'admin', p_correlation_id,
    jsonb_build_object('admin_user_id', p_admin_user_id));
  RETURN public.commerce_claim_webpay_reconciliation(v_attempt.id, p_correlation_id);
END;
$$;
CREATE OR REPLACE FUNCTION public.commerce_payment_claim_payload(
  p_attempt public.payment_attempts,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'action', p_action,
    'id', p_attempt.id,
    'order_id', p_attempt.order_id,
    'public_id', orders.public_id,
    'environment', p_attempt.environment,
    'amount_clp', p_attempt.amount_clp,
    'buy_order', p_attempt.buy_order,
    'session_id', p_attempt.session_id,
    'token', p_attempt.transbank_token,
    'state', p_attempt.state,
    'webpay_return_kind', p_attempt.webpay_return_kind,
    'created_at', p_attempt.created_at,
    'commit_started_at', p_attempt.commit_started_at
  )
  FROM public.orders orders
  WHERE orders.id = p_attempt.order_id;
$$;

CREATE OR REPLACE FUNCTION public.commerce_claim_webpay_processing(
  p_token TEXT,
  p_correlation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt public.payment_attempts%ROWTYPE;
  v_order_id UUID;
  v_held_count INTEGER;
  v_item_count INTEGER;
  v_from_state TEXT;
BEGIN
  SELECT order_id INTO v_order_id
  FROM public.payment_attempts
  WHERE transbank_token = p_token;

  IF v_order_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.commerce_lock_order_payment_rows(v_order_id);

  SELECT * INTO v_attempt
  FROM public.payment_attempts
  WHERE transbank_token = p_token
  FOR UPDATE;

  IF v_attempt.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_attempt.state IN (
    'authorized', 'rejected', 'aborted', 'expired', 'initialization_failed'
  ) THEN
    RETURN public.commerce_payment_claim_payload(v_attempt, 'terminal');
  END IF;

  IF v_attempt.reconciliation_paused_at IS NOT NULL THEN
    RETURN public.commerce_payment_claim_payload(v_attempt, 'wait');
  END IF;

  IF v_attempt.processing_lease_until IS NOT NULL
    AND v_attempt.processing_lease_until > NOW() THEN
    RETURN public.commerce_payment_claim_payload(v_attempt, 'wait');
  END IF;

  v_from_state := v_attempt.state;

  IF v_attempt.state = 'initialized' AND v_attempt.commit_started_at IS NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_item_count
    FROM public.order_items
    WHERE order_id = v_order_id;

    SELECT COUNT(*)::INTEGER INTO v_held_count
    FROM public.inventory_reservations
    WHERE order_id = v_order_id
      AND state = 'active';

    IF v_item_count > 0 AND v_held_count = v_item_count THEN
      UPDATE public.inventory_reservations
      SET
        state = 'payment_processing',
        expires_at = GREATEST(expires_at, NOW() + INTERVAL '15 minutes'),
        updated_at = NOW()
      WHERE order_id = v_order_id
        AND state = 'active';

      UPDATE public.payment_attempts
      SET
        state = 'processing',
        processing_started_at = COALESCE(processing_started_at, NOW()),
        processing_lease_until = NOW() + INTERVAL '2 minutes',
        processing_correlation_id = p_correlation_id,
        commit_started_at = NOW(),
        next_reconcile_at = NOW() + INTERVAL '2 minutes',
        updated_at = NOW()
      WHERE id = v_attempt.id
      RETURNING * INTO v_attempt;

      INSERT INTO public.payment_events (
        payment_attempt_id, order_id, event_type, from_state, to_state,
        correlation_id, metadata
      ) VALUES (
        v_attempt.id, v_order_id, 'webpay_commit_claimed', v_from_state,
        'processing', p_correlation_id, jsonb_build_object('lease_seconds', 120)
      );

      RETURN public.commerce_payment_claim_payload(v_attempt, 'commit');
    END IF;
  END IF;

  UPDATE public.inventory_reservations
  SET
    state = 'reconciliation_required',
    expires_at = GREATEST(expires_at, NOW() + INTERVAL '15 minutes'),
    updated_at = NOW()
  WHERE order_id = v_order_id
    AND state IN ('active', 'payment_processing');

  UPDATE public.payment_attempts
  SET
    state = 'reconciliation_required',
    processing_lease_until = NOW() + INTERVAL '2 minutes',
    processing_correlation_id = p_correlation_id,
    last_status_checked_at = NOW(),
    next_reconcile_at = NOW(),
    reconcile_count = reconcile_count + 1,
    updated_at = NOW()
  WHERE id = v_attempt.id
  RETURNING * INTO v_attempt;

  INSERT INTO public.payment_events (
    payment_attempt_id, order_id, event_type, from_state, to_state,
    correlation_id
  ) VALUES (
    v_attempt.id, v_order_id, 'webpay_status_claimed', v_from_state,
    'reconciliation_required', p_correlation_id
  );

  RETURN public.commerce_payment_claim_payload(v_attempt, 'status');
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_claim_webpay_status(
  p_token TEXT,
  p_correlation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt public.payment_attempts%ROWTYPE;
  v_order_id UUID;
  v_from_state TEXT;
BEGIN
  SELECT order_id INTO v_order_id
  FROM public.payment_attempts
  WHERE transbank_token = p_token;

  IF v_order_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.commerce_lock_order_payment_rows(v_order_id);

  SELECT * INTO v_attempt
  FROM public.payment_attempts
  WHERE transbank_token = p_token
  FOR UPDATE;

  IF v_attempt.state IN (
    'authorized', 'rejected', 'aborted', 'expired', 'initialization_failed'
  ) THEN
    RETURN public.commerce_payment_claim_payload(v_attempt, 'terminal');
  END IF;

  IF v_attempt.reconciliation_paused_at IS NOT NULL THEN
    RETURN public.commerce_payment_claim_payload(v_attempt, 'wait');
  END IF;

  IF v_attempt.processing_lease_until IS NOT NULL
    AND v_attempt.processing_lease_until > NOW() THEN
    RETURN public.commerce_payment_claim_payload(v_attempt, 'wait');
  END IF;

  v_from_state := v_attempt.state;

  UPDATE public.inventory_reservations
  SET
    state = 'reconciliation_required',
    expires_at = GREATEST(expires_at, NOW() + INTERVAL '15 minutes'),
    updated_at = NOW()
  WHERE order_id = v_order_id
    AND state IN ('active', 'payment_processing');

  UPDATE public.payment_attempts
  SET
    state = 'reconciliation_required',
    processing_lease_until = NOW() + INTERVAL '2 minutes',
    processing_correlation_id = p_correlation_id,
    last_status_checked_at = NOW(),
    next_reconcile_at = NOW(),
    reconcile_count = reconcile_count + 1,
    updated_at = NOW()
  WHERE id = v_attempt.id
  RETURNING * INTO v_attempt;

  INSERT INTO public.payment_events (
    payment_attempt_id, order_id, event_type, from_state, to_state,
    correlation_id
  ) VALUES (
    v_attempt.id, v_order_id, 'webpay_status_claimed', v_from_state,
    'reconciliation_required', p_correlation_id
  );

  RETURN public.commerce_payment_claim_payload(v_attempt, 'status');
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_claim_webpay_reconciliation(
  p_attempt_id UUID,
  p_correlation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token TEXT;
BEGIN
  SELECT transbank_token INTO v_token
  FROM public.payment_attempts
  WHERE id = p_attempt_id
    AND state IN ('processing', 'reconciliation_required')
    AND reconciliation_paused_at IS NULL
    AND (
      processing_lease_until IS NULL
      OR processing_lease_until <= NOW()
    )
    AND (
      next_reconcile_at IS NULL
      OR next_reconcile_at <= NOW()
    );

  IF v_token IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN public.commerce_claim_webpay_status(v_token, p_correlation_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_mark_webpay_reconciliation(
  p_attempt_id UUID,
  p_correlation_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id UUID;
  v_from_state TEXT;
  v_reconcile_count INTEGER;
  v_delay_seconds INTEGER;
BEGIN
  SELECT order_id INTO v_order_id
  FROM public.payment_attempts
  WHERE id = p_attempt_id;

  IF v_order_id IS NULL THEN
    RETURN FALSE;
  END IF;

  PERFORM public.commerce_lock_order_payment_rows(v_order_id);

  SELECT state, reconcile_count
  INTO v_from_state, v_reconcile_count
  FROM public.payment_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF v_from_state IN (
    'authorized', 'rejected', 'aborted', 'expired', 'initialization_failed'
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (SELECT 1 FROM public.payment_attempts WHERE id = p_attempt_id
    AND processing_correlation_id IS NOT NULL
    AND processing_correlation_id IS DISTINCT FROM p_correlation_id) THEN
    RETURN FALSE;
  END IF;

  v_delay_seconds := LEAST(900, (15 * POWER(2, LEAST(v_reconcile_count, 6)))::INTEGER);

  UPDATE public.inventory_reservations
  SET
    state = 'reconciliation_required',
    expires_at = GREATEST(expires_at, NOW() + INTERVAL '15 minutes'),
    updated_at = NOW()
  WHERE order_id = v_order_id
    AND state IN ('active', 'payment_processing');

  UPDATE public.orders
  SET payment_status = 'reconciliation_required', updated_at = NOW()
  WHERE id = v_order_id
    AND order_status = 'awaiting_payment';

  UPDATE public.payment_attempts
  SET
    state = 'reconciliation_required',
    processing_lease_until = NULL,
    processing_correlation_id = NULL,
    next_reconcile_at = NOW() + make_interval(secs => v_delay_seconds),
    last_error_code = LEFT(COALESCE(p_reason, 'unknown'), 120),
    updated_at = NOW()
  WHERE id = p_attempt_id;

  INSERT INTO public.payment_events (
    payment_attempt_id, order_id, event_type, from_state, to_state,
    correlation_id, metadata
  ) VALUES (
    p_attempt_id, v_order_id, 'webpay_reconciliation_scheduled', v_from_state,
    'reconciliation_required', p_correlation_id,
    jsonb_build_object(
      'reason', LEFT(COALESCE(p_reason, 'unknown'), 120),
      'retry_in_seconds', v_delay_seconds
    )
  );

  PERFORM public.commerce_pause_exhausted_webpay(p_attempt_id);
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_finalize_webpay(
  p_attempt_id UUID,
  p_outcome TEXT,
  p_amount_clp INTEGER,
  p_buy_order TEXT,
  p_session_id TEXT,
  p_tbk_status TEXT,
  p_response_code INTEGER,
  p_authorization_code TEXT,
  p_payment_type_code TEXT,
  p_installments_number INTEGER,
  p_card_last_four TEXT,
  p_transaction_date TIMESTAMPTZ,
  p_correlation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt public.payment_attempts%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_order_id UUID;
  v_from_state TEXT;
  v_item_count INTEGER;
  v_held_count INTEGER;
  v_sellable_count INTEGER;
  v_effective_outcome TEXT;
BEGIN
  IF p_outcome NOT IN (
    'authorized', 'rejected', 'aborted', 'expired', 'reconciliation_required'
  ) THEN
    RAISE EXCEPTION 'invalid payment outcome';
  END IF;

  SELECT order_id INTO v_order_id
  FROM public.payment_attempts
  WHERE id = p_attempt_id;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'payment attempt not found';
  END IF;

  PERFORM public.commerce_lock_order_payment_rows(v_order_id);

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_order_id;

  SELECT * INTO v_attempt
  FROM public.payment_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF v_attempt.state IN (
    'authorized', 'rejected', 'aborted', 'expired', 'initialization_failed'
  ) THEN
    RETURN jsonb_build_object(
      'public_id', v_order.public_id,
      'order_status', v_order.order_status,
      'payment_status', v_order.payment_status,
      'attempt_state', v_attempt.state,
      'reused', TRUE
    );
  END IF;

  IF v_attempt.processing_correlation_id IS NOT NULL
    AND v_attempt.processing_correlation_id IS DISTINCT FROM p_correlation_id THEN
    RAISE EXCEPTION 'stale payment processing claim';
  END IF;

  v_from_state := v_attempt.state;
  v_effective_outcome := p_outcome;

  IF p_amount_clp IS NOT NULL AND p_amount_clp <> v_attempt.amount_clp THEN
    v_effective_outcome := 'reconciliation_required';
  END IF;
  IF p_buy_order IS NOT NULL AND p_buy_order <> v_attempt.buy_order THEN
    v_effective_outcome := 'reconciliation_required';
  END IF;
  IF p_session_id IS NOT NULL AND p_session_id <> v_attempt.session_id THEN
    v_effective_outcome := 'reconciliation_required';
  END IF;

  IF v_effective_outcome = 'authorized' AND (
    p_tbk_status IS DISTINCT FROM 'AUTHORIZED'
    OR p_response_code IS DISTINCT FROM 0
    OR p_amount_clp IS NULL
    OR p_buy_order IS NULL
    OR p_session_id IS NULL
  ) THEN
    v_effective_outcome := 'reconciliation_required';
  END IF;

  -- Time alone never releases a financial hold. Require a fresh provider
  -- INITIALIZED response with all three correlation values, after a generous
  -- payment/confirmation grace period. This also repairs legacy special loops.
  IF v_effective_outcome IN ('rejected', 'aborted', 'expired') AND (
    p_amount_clp IS NULL OR p_buy_order IS NULL OR p_session_id IS NULL
    OR p_tbk_status IS NULL
  ) THEN
    v_effective_outcome := 'reconciliation_required';
  END IF;

  IF v_effective_outcome = 'rejected'
    AND p_tbk_status NOT IN ('FAILED', 'REVERSED', 'NULLIFIED') THEN
    v_effective_outcome := 'reconciliation_required';
  END IF;
  IF v_effective_outcome IN ('aborted', 'expired') AND (
    p_tbk_status IS DISTINCT FROM 'INITIALIZED'
    OR p_authorization_code IS NOT NULL OR p_response_code IS NOT NULL
  ) THEN
    v_effective_outcome := 'reconciliation_required';
  END IF;
  IF v_effective_outcome = 'aborted'
    AND v_attempt.webpay_return_kind IS DISTINCT FROM 'aborted' THEN
    v_effective_outcome := 'reconciliation_required';
  END IF;
  IF v_effective_outcome = 'expired'
    AND v_attempt.webpay_return_kind IS DISTINCT FROM 'timeout'
    AND GREATEST(v_attempt.created_at,
      COALESCE(v_attempt.commit_started_at, v_attempt.created_at)) > NOW() - INTERVAL '30 minutes' THEN
    v_effective_outcome := 'reconciliation_required';
  END IF;

  IF v_effective_outcome = 'reconciliation_required'
    AND p_tbk_status = 'INITIALIZED'
    AND p_authorization_code IS NULL AND p_response_code IS NULL
    AND p_amount_clp = v_attempt.amount_clp
    AND p_buy_order = v_attempt.buy_order
    AND p_session_id = v_attempt.session_id
    AND GREATEST(v_attempt.created_at,
      COALESCE(v_attempt.commit_started_at, v_attempt.created_at)) <= NOW() - INTERVAL '30 minutes' THEN
    v_effective_outcome := 'expired';
  END IF;

  IF v_effective_outcome = 'authorized' THEN
    SELECT COUNT(*)::INTEGER INTO v_item_count
    FROM public.order_items
    WHERE order_id = v_order_id;

    SELECT COUNT(*)::INTEGER INTO v_held_count
    FROM public.order_items item
    JOIN public.inventory_reservations reservation
      ON reservation.order_id = item.order_id
      AND reservation.product_id IS NOT DISTINCT FROM item.product_id
      AND reservation.rack_inventory_id IS NOT DISTINCT FROM item.rack_inventory_id
      AND reservation.quantity = item.quantity
    WHERE item.order_id = v_order_id
      AND reservation.state IN (
        'active', 'payment_processing', 'reconciliation_required'
      );

    SELECT COUNT(*)::INTEGER INTO v_sellable_count
    FROM public.order_items item
    LEFT JOIN public.products product ON product.id = item.product_id
    LEFT JOIN public.ski_rack_inventory inventory
      ON inventory.id = item.rack_inventory_id
    LEFT JOIN public.ski_rack_products rack
      ON rack.id = inventory.rack_product_id
    WHERE item.order_id = v_order_id
      AND (
        (
          item.product_id IS NOT NULL
          AND product.commerce_owned = TRUE
          AND product.status = 'approved'
        )
        OR (
          item.rack_inventory_id IS NOT NULL
          AND rack.active = TRUE
          AND item.shipping_origin_code = inventory.shipping_origin_code
          AND inventory.stock_on_hand >= item.quantity
        )
      );

    IF v_item_count < 1
      OR v_held_count <> v_item_count
      OR v_sellable_count <> v_item_count THEN
      v_effective_outcome := 'reconciliation_required';
    END IF;
  END IF;

  UPDATE public.payment_attempts
  SET
    state = v_effective_outcome,
    tbk_status = LEFT(p_tbk_status, 40),
    response_code = p_response_code,
    authorization_code = LEFT(p_authorization_code, 64),
    payment_type_code = LEFT(p_payment_type_code, 8),
    installments_number = p_installments_number,
    card_last_four = p_card_last_four,
    transaction_date = p_transaction_date,
    processing_lease_until = NULL,
    processing_correlation_id = NULL,
    last_error_code = CASE WHEN v_effective_outcome = 'reconciliation_required' THEN 'provider_result_unresolved' ELSE NULL END,
    reconciliation_paused_at = NULL,
    next_reconcile_at = CASE
      WHEN v_effective_outcome = 'reconciliation_required'
        THEN NOW() + make_interval(secs => LEAST(900, (15 * POWER(2, LEAST(v_attempt.reconcile_count, 6)))::INTEGER))
      ELSE NULL
    END,
    authorized_at = CASE
      WHEN v_effective_outcome = 'authorized' THEN NOW()
      ELSE authorized_at
    END,
    terminal_at = CASE
      WHEN v_effective_outcome IN ('authorized', 'rejected', 'aborted', 'expired')
        THEN COALESCE(terminal_at, NOW())
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE id = v_attempt.id;

  IF v_effective_outcome = 'authorized' THEN
    WITH sold AS (
      SELECT item.rack_inventory_id AS inventory_id,
             SUM(item.quantity)::INTEGER AS quantity
      FROM public.order_items item
      WHERE item.order_id = v_order_id
        AND item.rack_inventory_id IS NOT NULL
      GROUP BY item.rack_inventory_id
    )
    INSERT INTO public.ski_rack_inventory_adjustments (
      inventory_id, admin_user_id, previous_stock, new_stock, reason
    )
    SELECT inventory.id, NULL, inventory.stock_on_hand,
           inventory.stock_on_hand - sold.quantity, 'webpay_sale'
    FROM sold
    JOIN public.ski_rack_inventory inventory ON inventory.id = sold.inventory_id;

    WITH sold AS (
      SELECT item.rack_inventory_id AS inventory_id,
             SUM(item.quantity)::INTEGER AS quantity
      FROM public.order_items item
      WHERE item.order_id = v_order_id
        AND item.rack_inventory_id IS NOT NULL
      GROUP BY item.rack_inventory_id
    )
    UPDATE public.ski_rack_inventory inventory
    SET
      stock_on_hand = inventory.stock_on_hand - sold.quantity,
      updated_at = NOW()
    FROM sold
    WHERE inventory.id = sold.inventory_id;

    UPDATE public.inventory_reservations
    SET
      state = 'consumed',
      consumed_at = NOW(),
      updated_at = NOW()
    WHERE order_id = v_order_id
      AND state IN ('active', 'payment_processing', 'reconciliation_required');

    UPDATE public.products product
    SET
      status = 'sold',
      sold_at = NOW(),
      sale_price = item.unit_price_clp,
      sold_channel = 'reski',
      updated_at = NOW()
    FROM public.order_items item
    WHERE item.order_id = v_order_id
      AND item.product_id = product.id;

    UPDATE public.orders
    SET
      order_status = 'paid',
      payment_status = 'authorized',
      fulfillment_status = 'pending',
      paid_at = COALESCE(paid_at, NOW()),
      updated_at = NOW()
    WHERE id = v_order_id;

    UPDATE public.shipping_quotes
    SET state = 'consumed'
    WHERE order_id = v_order_id
      AND state = 'selected';

    UPDATE public.promotion_redemptions
    SET state = 'consumed', consumed_at = COALESCE(consumed_at, NOW())
    WHERE order_id = v_order_id
      AND state = 'reserved';
  ELSIF v_effective_outcome IN ('rejected', 'aborted', 'expired') THEN
    UPDATE public.orders
    SET
      order_status = CASE
        WHEN v_effective_outcome = 'expired' THEN 'expired'
        ELSE 'cancelled'
      END,
      payment_status = v_effective_outcome,
      fulfillment_status = 'cancelled',
      updated_at = NOW()
    WHERE id = v_order_id
      AND order_status = 'awaiting_payment';

    UPDATE public.inventory_reservations
    SET
      state = CASE
        WHEN v_effective_outcome = 'expired' THEN 'expired'
        ELSE 'released'
      END,
      released_at = COALESCE(released_at, NOW()),
      release_reason = v_effective_outcome,
      updated_at = NOW()
    WHERE order_id = v_order_id
      AND state IN ('active', 'payment_processing', 'reconciliation_required');

    UPDATE public.shipping_quotes
    SET state = 'expired'
    WHERE order_id = v_order_id
      AND state = 'selected';

    UPDATE public.promotion_redemptions
    SET state = 'released', released_at = COALESCE(released_at, NOW())
    WHERE order_id = v_order_id
      AND state = 'reserved';
  ELSE
    UPDATE public.orders
    SET payment_status = 'reconciliation_required', updated_at = NOW()
    WHERE id = v_order_id
      AND order_status = 'awaiting_payment';

    UPDATE public.inventory_reservations
    SET
      state = 'reconciliation_required',
      expires_at = GREATEST(expires_at, NOW() + INTERVAL '15 minutes'),
      updated_at = NOW()
    WHERE order_id = v_order_id
      AND state IN ('active', 'payment_processing');
  END IF;

  IF v_effective_outcome = 'reconciliation_required' THEN
    PERFORM public.commerce_pause_exhausted_webpay(v_attempt.id);
  END IF;

  INSERT INTO public.payment_events (
    payment_attempt_id, order_id, event_type, from_state, to_state,
    correlation_id, metadata
  ) VALUES (
    v_attempt.id, v_order_id, 'webpay_finalized', v_from_state,
    v_effective_outcome, p_correlation_id,
    jsonb_build_object(
      'tbk_status', p_tbk_status,
      'response_code', p_response_code,
      'correlation_valid',
      (
        (p_amount_clp IS NULL OR p_amount_clp = v_attempt.amount_clp)
        AND (p_buy_order IS NULL OR p_buy_order = v_attempt.buy_order)
        AND (p_session_id IS NULL OR p_session_id = v_attempt.session_id)
      )
    )
  );

  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'public_id', v_order.public_id,
    'order_status', v_order.order_status,
    'payment_status', v_order.payment_status,
    'attempt_state', v_effective_outcome,
    'reused', FALSE
  );
END;
$$;
REVOKE ALL ON FUNCTION public.commerce_pause_exhausted_webpay(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.commerce_admin_resume_webpay_reconciliation(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_admin_resume_webpay_reconciliation(UUID, UUID, UUID) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
