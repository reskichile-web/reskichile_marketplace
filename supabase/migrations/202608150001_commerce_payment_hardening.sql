-- Hardening for the ReskiChile commerce/Webpay foundation.
-- This migration deliberately keeps all payment mutations behind service_role
-- RPCs and makes provider ambiguity recoverable without repeating commit.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Protect the administrator bit at both the privilege and trigger layers.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_role_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  old_is_admin BOOLEAN,
  new_is_admin BOOLEAN NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  database_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_role_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_role_events FROM anon, authenticated;
GRANT SELECT, INSERT ON public.user_role_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.user_role_events_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.commerce_protect_user_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' AND COALESCE(NEW.is_admin, FALSE) THEN
      RAISE EXCEPTION 'administrator role requires a trusted server operation';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'administrator role requires a trusted server operation';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    INSERT INTO public.user_role_events (
      user_id,
      old_is_admin,
      new_is_admin,
      changed_by,
      database_role
    )
    VALUES (
      NEW.id,
      OLD.is_admin,
      COALESCE(NEW.is_admin, FALSE),
      auth.uid(),
      CURRENT_USER
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_protect_admin_role ON public.users;
CREATE TRIGGER users_protect_admin_role
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.commerce_protect_user_admin_role();

-- A table-level UPDATE grant overrides column revokes. Replace it with a
-- closed allowlist of self-service profile fields. New columns stay denied by
-- default, which prevents future operational/authorization flags from becoming
-- client-writable accidentally.
REVOKE UPDATE ON public.users FROM anon, authenticated;

DO $$
DECLARE
  v_columns TEXT;
BEGIN
  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
  INTO v_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = ANY (ARRAY[
      'email',
      'name',
      'phone',
      'instagram',
      'hide_phone',
      'notify_chat_email',
      'notify_reminders_email',
      'avatar_url',
      'must_change_password'
    ]::TEXT[]);

  IF v_columns IS NOT NULL THEN
    EXECUTE format(
      'GRANT UPDATE (%s) ON public.users TO authenticated',
      v_columns
    );
  END IF;
END
$$;

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. Durable leases and inventory fencing for provider calls.
-- ---------------------------------------------------------------------------

ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS processing_lease_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_correlation_id UUID,
  ADD COLUMN IF NOT EXISTS commit_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_status_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_reconcile_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reconcile_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_code TEXT,
  ADD COLUMN IF NOT EXISTS terminal_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_attempts_reconcile_count_check'
      AND conrelid = 'public.payment_attempts'::REGCLASS
  ) THEN
    ALTER TABLE public.payment_attempts
      ADD CONSTRAINT payment_attempts_reconcile_count_check
      CHECK (reconcile_count >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_attempts_last_error_length_check'
      AND conrelid = 'public.payment_attempts'::REGCLASS
  ) THEN
    ALTER TABLE public.payment_attempts
      ADD CONSTRAINT payment_attempts_last_error_length_check
      CHECK (last_error_code IS NULL OR char_length(last_error_code) <= 120);
  END IF;
END
$$;

ALTER TABLE public.inventory_reservations
  DROP CONSTRAINT IF EXISTS inventory_reservations_state_check;
ALTER TABLE public.inventory_reservations
  ADD CONSTRAINT inventory_reservations_state_check
  CHECK (state IN (
    'active', 'payment_processing', 'reconciliation_required',
    'consumed', 'released', 'expired'
  ));

DROP INDEX IF EXISTS public.inventory_one_active_reservation_per_product;
CREATE UNIQUE INDEX inventory_one_held_reservation_per_product
  ON public.inventory_reservations (product_id)
  WHERE state IN ('active', 'payment_processing', 'reconciliation_required');

DROP INDEX IF EXISTS public.inventory_reservations_expiry_idx;
CREATE INDEX inventory_reservations_expiry_idx
  ON public.inventory_reservations (expires_at)
  WHERE state = 'active';

CREATE INDEX IF NOT EXISTS payment_attempts_reconciliation_due_idx
  ON public.payment_attempts (next_reconcile_at, created_at)
  WHERE state IN ('processing', 'reconciliation_required');

-- Lock product rows before reservations, orders and payment attempts. Checkout,
-- callback, reconciliation and expiration all use this same order.
CREATE OR REPLACE FUNCTION public.commerce_lock_order_payment_rows(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM p.id
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id
  ORDER BY p.id
  FOR UPDATE OF p;

  PERFORM ir.id
  FROM public.inventory_reservations ir
  WHERE ir.order_id = p_order_id
  ORDER BY ir.product_id
  FOR UPDATE;

  PERFORM o.id
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;
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
    'public_id', o.public_id,
    'environment', p_attempt.environment,
    'amount_clp', p_attempt.amount_clp,
    'buy_order', p_attempt.buy_order,
    'session_id', p_attempt.session_id,
    'token', p_attempt.transbank_token,
    'state', p_attempt.state
  )
  FROM public.orders o
  WHERE o.id = p_attempt.order_id;
$$;

-- Normal token_ws return. Only initialized may claim the one commit action.
-- Any abandoned processing lease is recovered through status, never commit.
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

-- Abort, timeout, special returns and background recovery consult status only.
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

  RETURN TRUE;
END;
$$;

-- Finalize provider evidence and business state in one transaction. Locks are
-- acquired before the payment row so checkout and callback cannot deadlock by
-- taking product/payment locks in opposite order.
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

  IF v_effective_outcome = 'authorized' THEN
    SELECT COUNT(*)::INTEGER INTO v_item_count
    FROM public.order_items
    WHERE order_id = v_order_id;

    SELECT COUNT(*)::INTEGER INTO v_held_count
    FROM public.inventory_reservations
    WHERE order_id = v_order_id
      AND state IN (
        'active', 'payment_processing', 'reconciliation_required'
      );

    SELECT COUNT(*)::INTEGER INTO v_sellable_count
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = v_order_id
      AND p.commerce_owned = TRUE
      AND p.status = 'approved';

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
    last_error_code = NULL,
    next_reconcile_at = CASE
      WHEN v_effective_outcome = 'reconciliation_required'
        THEN NOW() + INTERVAL '30 seconds'
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
    UPDATE public.inventory_reservations
    SET
      state = 'consumed',
      consumed_at = NOW(),
      updated_at = NOW()
    WHERE order_id = v_order_id
      AND state IN ('active', 'payment_processing', 'reconciliation_required');

    UPDATE public.products p
    SET
      status = 'sold',
      sold_at = NOW(),
      sale_price = oi.unit_price_clp,
      sold_channel = 'reski',
      updated_at = NOW()
    FROM public.order_items oi
    WHERE oi.order_id = v_order_id
      AND oi.product_id = p.id;

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

-- Expiration is a scheduled operation, not a side effect of a new buyer's
-- checkout. It releases only initialized/no-commit reservations and rechecks
-- all state after acquiring the common lock order.
CREATE OR REPLACE FUNCTION public.commerce_expire_checkout_reservations(
  p_limit INTEGER DEFAULT 100
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id UUID;
  v_released INTEGER;
  v_total_released INTEGER := 0;
BEGIN
  IF p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'invalid expiration batch limit';
  END IF;

  FOR v_order_id IN
    SELECT ir.order_id
    FROM public.inventory_reservations ir
    WHERE ir.state = 'active'
      AND ir.expires_at <= NOW()
      AND NOT EXISTS (
        SELECT 1
        FROM public.payment_attempts pa
        WHERE pa.order_id = ir.order_id
          AND (
            pa.commit_started_at IS NOT NULL
            OR pa.state IN ('processing', 'reconciliation_required', 'authorized')
          )
      )
    GROUP BY ir.order_id
    ORDER BY MIN(ir.expires_at), ir.order_id
    LIMIT p_limit
  LOOP
    PERFORM public.commerce_lock_order_payment_rows(v_order_id);

    IF EXISTS (
      SELECT 1
      FROM public.payment_attempts pa
      WHERE pa.order_id = v_order_id
        AND (
          pa.commit_started_at IS NOT NULL
          OR pa.state IN ('processing', 'reconciliation_required', 'authorized')
        )
    ) THEN
      CONTINUE;
    END IF;

    UPDATE public.inventory_reservations
    SET
      state = 'expired',
      released_at = NOW(),
      release_reason = 'reservation_expired',
      updated_at = NOW()
    WHERE order_id = v_order_id
      AND state = 'active'
      AND expires_at <= NOW();

    GET DIAGNOSTICS v_released = ROW_COUNT;
    IF v_released = 0 THEN
      CONTINUE;
    END IF;

    v_total_released := v_total_released + v_released;

    UPDATE public.orders
    SET
      order_status = 'expired',
      payment_status = 'expired',
      fulfillment_status = 'cancelled',
      updated_at = NOW()
    WHERE id = v_order_id
      AND order_status = 'awaiting_payment';

    UPDATE public.payment_attempts
    SET state = 'expired', terminal_at = NOW(), updated_at = NOW()
    WHERE order_id = v_order_id
      AND state IN ('created', 'initialized')
      AND commit_started_at IS NULL;

    UPDATE public.shipping_quotes
    SET state = 'expired'
    WHERE order_id = v_order_id
      AND state = 'selected';

    UPDATE public.promotion_redemptions
    SET state = 'released', released_at = COALESCE(released_at, NOW())
    WHERE order_id = v_order_id
      AND state = 'reserved';

    INSERT INTO public.payment_events (
      payment_attempt_id, order_id, event_type, from_state, to_state, metadata
    )
    SELECT
      pa.id, v_order_id, 'checkout_reservation_expired', pa.state, 'expired',
      jsonb_build_object('released_reservations', v_released)
    FROM public.payment_attempts pa
    WHERE pa.order_id = v_order_id
    ORDER BY pa.created_at DESC
    LIMIT 1;
  END LOOP;

  RETURN v_total_released;
END;
$$;

REVOKE ALL ON FUNCTION public.commerce_lock_order_payment_rows(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_payment_claim_payload(public.payment_attempts, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_protect_user_admin_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_claim_webpay_processing(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_claim_webpay_status(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_claim_webpay_reconciliation(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_mark_webpay_reconciliation(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_finalize_webpay(
  UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT,
  TIMESTAMPTZ, UUID
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_expire_checkout_reservations(INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.commerce_claim_webpay_processing(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_claim_webpay_status(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_claim_webpay_reconciliation(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_mark_webpay_reconciliation(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_finalize_webpay(
  UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT,
  TIMESTAMPTZ, UUID
) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_expire_checkout_reservations(INTEGER) TO service_role;

COMMIT;
