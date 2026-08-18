-- Operacion posterior al pago: outbox durable, fulfillment y reembolsos.
-- Ninguna llamada externa ocurre dentro de PostgreSQL. Las RPC solo reclaman
-- trabajo, persisten evidencia allowlisted y sostienen las invariantes.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Outbox durable para correos, preparacion y alertas financieras.
-- ---------------------------------------------------------------------------

CREATE TABLE public.commerce_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN (
    'order_confirmation', 'fulfillment_notice',
    'payment_alert', 'refund_alert'
  )),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  payment_attempt_id UUID REFERENCES public.payment_attempts(id) ON DELETE RESTRICT,
  refund_id UUID REFERENCES public.refunds(id) ON DELETE RESTRICT,
  dedupe_key TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN (
    'pending', 'processing', 'retry', 'delivered', 'dead_letter', 'uncertain'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_until TIMESTAMPTZ,
  correlation_id UUID,
  provider_message_id TEXT,
  last_error_code TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (char_length(dedupe_key) BETWEEN 8 AND 160),
  CHECK (last_error_code IS NULL OR char_length(last_error_code) <= 120),
  CHECK (provider_message_id IS NULL OR char_length(provider_message_id) <= 120)
);

CREATE INDEX commerce_outbox_due_idx
  ON public.commerce_outbox (available_at, created_at)
  WHERE state IN ('pending', 'retry', 'processing');

ALTER TABLE public.commerce_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commerce_outbox FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.commerce_enqueue_order_operations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt_id UUID;
BEGIN
  IF NEW.payment_status = 'authorized'
    AND OLD.payment_status IS DISTINCT FROM 'authorized' THEN
    SELECT id INTO v_attempt_id
    FROM public.payment_attempts
    WHERE order_id = NEW.id AND state = 'authorized'
    ORDER BY authorized_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    INSERT INTO public.commerce_outbox (
      kind, order_id, payment_attempt_id, dedupe_key
    ) VALUES
      (
        'order_confirmation', NEW.id, v_attempt_id,
        'order-confirmation/' || NEW.id::TEXT
      ),
      (
        'fulfillment_notice', NEW.id, v_attempt_id,
        'fulfillment-notice/' || NEW.id::TEXT
      )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_enqueue_paid_operations
AFTER UPDATE OF payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.commerce_enqueue_order_operations();

CREATE OR REPLACE FUNCTION public.commerce_enqueue_payment_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.state = 'reconciliation_required'
    AND OLD.state IS DISTINCT FROM 'reconciliation_required' THEN
    INSERT INTO public.commerce_outbox (
      kind, order_id, payment_attempt_id, dedupe_key
    ) VALUES (
      'payment_alert', NEW.order_id, NEW.id,
      'payment-alert/' || NEW.id::TEXT
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_attempts_enqueue_alert
AFTER UPDATE OF state ON public.payment_attempts
FOR EACH ROW EXECUTE FUNCTION public.commerce_enqueue_payment_alert();

-- Orders already authorized before this migration still receive one task of
-- each kind. The unique dedupe key makes the backfill safe to repeat.
INSERT INTO public.commerce_outbox (
  kind, order_id, payment_attempt_id, dedupe_key
)
SELECT kind.value, orders.id, attempt.id,
       kind.prefix || orders.id::TEXT
FROM public.orders orders
JOIN public.payment_attempts attempt
  ON attempt.order_id = orders.id AND attempt.state = 'authorized'
CROSS JOIN (VALUES
  ('order_confirmation', 'order-confirmation/'),
  ('fulfillment_notice', 'fulfillment-notice/')
) AS kind(value, prefix)
WHERE orders.payment_status = 'authorized'
ON CONFLICT (dedupe_key) DO NOTHING;

INSERT INTO public.commerce_outbox (
  kind, order_id, payment_attempt_id, dedupe_key
)
SELECT 'payment_alert', attempt.order_id, attempt.id,
       'payment-alert/' || attempt.id::TEXT
FROM public.payment_attempts attempt
WHERE attempt.state = 'reconciliation_required'
ON CONFLICT (dedupe_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.commerce_claim_outbox(
  p_limit INTEGER,
  p_correlation_id UUID
)
RETURNS TABLE (
  outbox_id UUID,
  outbox_kind TEXT,
  dedupe_key TEXT,
  order_public_id UUID,
  order_number TEXT,
  buyer_email TEXT,
  buyer_name TEXT,
  delivery_method TEXT,
  destination_region TEXT,
  destination_commune TEXT,
  subtotal_clp INTEGER,
  discount_clp INTEGER,
  shipping_clp INTEGER,
  total_clp INTEGER,
  payment_state TEXT,
  payment_error_code TEXT,
  refund_amount_clp INTEGER,
  refund_state TEXT,
  refund_reason TEXT,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 20 OR p_correlation_id IS NULL THEN
    RAISE EXCEPTION 'invalid outbox claim';
  END IF;

  -- A Resend idempotency key is retained for 24 hours. An ambiguous worker
  -- lease may therefore be reclaimed only inside a conservative 23-hour
  -- window. Older ambiguous sends are held for manual review, never duplicated.
  UPDATE public.commerce_outbox
  SET
    state = 'uncertain',
    lease_until = NULL,
    last_error_code = 'delivery_lease_expired_after_idempotency_window',
    updated_at = NOW()
  WHERE state = 'processing'
    AND lease_until <= NOW()
    AND updated_at <= NOW() - INTERVAL '23 hours';

  RETURN QUERY
  WITH candidate AS (
    SELECT outbox.id
    FROM public.commerce_outbox outbox
    WHERE (
      (
        outbox.state IN ('pending', 'retry')
        AND outbox.available_at <= NOW()
      )
      OR (
        outbox.state = 'processing'
        AND outbox.lease_until <= NOW()
        AND outbox.updated_at > NOW() - INTERVAL '23 hours'
      )
    )
    ORDER BY outbox.available_at, outbox.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE public.commerce_outbox outbox
    SET
      state = 'processing',
      attempt_count = outbox.attempt_count + 1,
      lease_until = NOW() + INTERVAL '10 minutes',
      correlation_id = p_correlation_id,
      updated_at = NOW()
    FROM candidate
    WHERE outbox.id = candidate.id
    RETURNING outbox.*
  )
  SELECT
    claimed.id,
    claimed.kind,
    claimed.dedupe_key,
    orders.public_id,
    orders.order_number::TEXT,
    orders.buyer_email,
    orders.buyer_name,
    orders.delivery_method,
    orders.shipping_snapshot->>'region',
    orders.shipping_snapshot->>'commune',
    orders.subtotal_clp,
    orders.discount_clp,
    orders.shipping_clp,
    orders.total_clp,
    attempt.state,
    attempt.last_error_code,
    refund.amount_clp,
    refund.state,
    refund.reason,
    COALESCE(lines.items, '[]'::JSONB)
  FROM claimed
  JOIN public.orders orders ON orders.id = claimed.order_id
  LEFT JOIN public.payment_attempts attempt
    ON attempt.id = claimed.payment_attempt_id
  LEFT JOIN public.refunds refund ON refund.id = claimed.refund_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'name', item.product_name,
      'quantity', item.quantity,
      'unit_price_clp', item.unit_price_clp,
      'line_total_clp', item.line_total_clp,
      'sku', item.sku
    ) ORDER BY item.created_at, item.id) AS items
    FROM public.order_items item
    WHERE item.order_id = orders.id
  ) lines ON TRUE
  ORDER BY claimed.available_at, claimed.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_complete_outbox(
  p_outbox_id UUID,
  p_correlation_id UUID,
  p_provider_message_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.commerce_outbox
  SET
    state = 'delivered',
    provider_message_id = LEFT(NULLIF(p_provider_message_id, ''), 120),
    lease_until = NULL,
    last_error_code = NULL,
    correlation_id = p_correlation_id,
    delivered_at = COALESCE(delivered_at, NOW()),
    updated_at = NOW()
  WHERE id = p_outbox_id
    AND state = 'processing'
    AND correlation_id = p_correlation_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_fail_outbox(
  p_outbox_id UUID,
  p_correlation_id UUID,
  p_error_code TEXT,
  p_retryable BOOLEAN,
  p_uncertain BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt_count INTEGER;
  v_state TEXT;
  v_delay_seconds INTEGER;
BEGIN
  SELECT attempt_count INTO v_attempt_count
  FROM public.commerce_outbox
  WHERE id = p_outbox_id
    AND state = 'processing'
    AND correlation_id = p_correlation_id
  FOR UPDATE;

  IF v_attempt_count IS NULL THEN
    RETURN 'ignored';
  END IF;

  v_delay_seconds := LEAST(1800, 30 * POWER(2, LEAST(v_attempt_count - 1, 6)))::INTEGER;
  v_state := CASE
    WHEN p_uncertain THEN 'uncertain'
    WHEN p_retryable AND v_attempt_count < 8 THEN 'retry'
    ELSE 'dead_letter'
  END;

  UPDATE public.commerce_outbox
  SET
    state = v_state,
    available_at = CASE
      WHEN v_state = 'retry' THEN NOW() + make_interval(secs => v_delay_seconds)
      ELSE available_at
    END,
    lease_until = NULL,
    last_error_code = LEFT(COALESCE(NULLIF(p_error_code, ''), 'delivery_failed'), 120),
    updated_at = NOW()
  WHERE id = p_outbox_id;

  RETURN v_state;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Solicitud y finalizacion atomica de reembolsos.
-- ---------------------------------------------------------------------------

ALTER TABLE public.refunds
  ADD COLUMN processing_started_at TIMESTAMPTZ,
  ADD COLUMN terminal_at TIMESTAMPTZ,
  ADD COLUMN correlation_id UUID,
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN provider_type TEXT,
  ADD COLUMN authorization_code TEXT,
  ADD COLUMN authorization_date TIMESTAMPTZ,
  ADD COLUMN balance_clp INTEGER,
  ADD COLUMN nullified_amount_clp INTEGER,
  ADD COLUMN response_code INTEGER,
  ADD COLUMN last_error_code TEXT;

ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_attempt_count_check CHECK (attempt_count >= 0),
  ADD CONSTRAINT refunds_reason_length_check
    CHECK (char_length(BTRIM(reason)) BETWEEN 5 AND 500),
  ADD CONSTRAINT refunds_provider_type_check
    CHECK (provider_type IS NULL OR provider_type IN ('REVERSED', 'NULLIFIED')),
  ADD CONSTRAINT refunds_balance_check
    CHECK (balance_clp IS NULL OR balance_clp >= 0),
  ADD CONSTRAINT refunds_nullified_amount_check
    CHECK (nullified_amount_clp IS NULL OR nullified_amount_clp > 0),
  ADD CONSTRAINT refunds_last_error_length_check
    CHECK (last_error_code IS NULL OR char_length(last_error_code) <= 120);

CREATE UNIQUE INDEX refunds_one_live_per_payment
  ON public.refunds (payment_attempt_id)
  WHERE state IN ('requested', 'processing', 'uncertain');

CREATE INDEX refunds_order_created_idx
  ON public.refunds (order_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.commerce_request_refund(
  p_order_public_id UUID,
  p_admin_user_id UUID,
  p_amount_clp INTEGER,
  p_reason TEXT,
  p_idempotency_key UUID,
  p_correlation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_attempt public.payment_attempts%ROWTYPE;
  v_refund public.refunds%ROWTYPE;
  v_succeeded INTEGER;
BEGIN
  IF p_order_public_id IS NULL OR p_admin_user_id IS NULL
    OR p_idempotency_key IS NULL OR p_correlation_id IS NULL
    OR p_amount_clp IS NULL OR p_amount_clp <= 0
    OR char_length(BTRIM(COALESCE(p_reason, ''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'invalid refund request';
  END IF;

  -- Serialize equal idempotency keys before checking/inserting. Without this,
  -- two simultaneous HTTP retries could both miss the row before one waits on
  -- the order lock, causing the safe retry to surface as a conflicting refund.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_idempotency_key::TEXT, 0)
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_admin_user_id AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'refund administrator is not authorized';
  END IF;

  SELECT * INTO v_refund
  FROM public.refunds
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_refund.admin_user_id IS DISTINCT FROM p_admin_user_id
      OR v_refund.amount_clp IS DISTINCT FROM p_amount_clp
      OR BTRIM(v_refund.reason) IS DISTINCT FROM BTRIM(p_reason) THEN
      RAISE EXCEPTION 'refund idempotency conflict';
    END IF;

    RETURN jsonb_build_object(
      'refund_id', v_refund.id,
      'state', v_refund.state,
      'reused', TRUE
    );
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE public_id = p_order_public_id
  FOR UPDATE;

  IF v_order.id IS NULL
    OR v_order.payment_status NOT IN ('authorized', 'partially_refunded') THEN
    RAISE EXCEPTION 'order is not refundable';
  END IF;

  SELECT * INTO v_attempt
  FROM public.payment_attempts
  WHERE order_id = v_order.id AND state = 'authorized'
  ORDER BY authorized_at DESC NULLS LAST, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_attempt.id IS NULL OR v_attempt.transbank_token IS NULL THEN
    RAISE EXCEPTION 'authorized payment was not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.refunds
    WHERE payment_attempt_id = v_attempt.id
      AND state IN ('requested', 'processing', 'uncertain')
  ) THEN
    RAISE EXCEPTION 'another refund requires resolution';
  END IF;

  SELECT COALESCE(SUM(amount_clp), 0)::INTEGER INTO v_succeeded
  FROM public.refunds
  WHERE payment_attempt_id = v_attempt.id AND state = 'succeeded';

  IF p_amount_clp > v_attempt.amount_clp - v_succeeded THEN
    RAISE EXCEPTION 'refund exceeds refundable balance';
  END IF;

  INSERT INTO public.refunds (
    order_id, payment_attempt_id, amount_clp, reason, admin_user_id,
    idempotency_key, correlation_id
  ) VALUES (
    v_order.id, v_attempt.id, p_amount_clp, BTRIM(p_reason), p_admin_user_id,
    p_idempotency_key, p_correlation_id
  )
  RETURNING * INTO v_refund;

  INSERT INTO public.payment_events (
    payment_attempt_id, order_id, event_type, from_state, to_state,
    actor, correlation_id, metadata
  ) VALUES (
    v_attempt.id, v_order.id, 'refund_requested', NULL, 'requested',
    'admin', p_correlation_id,
    jsonb_build_object('refund_id', v_refund.id, 'amount_clp', p_amount_clp)
  );

  RETURN jsonb_build_object(
    'refund_id', v_refund.id,
    'state', v_refund.state,
    'reused', FALSE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_claim_refund(
  p_refund_id UUID,
  p_correlation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_refund public.refunds%ROWTYPE;
  v_attempt public.payment_attempts%ROWTYPE;
BEGIN
  SELECT * INTO v_refund
  FROM public.refunds
  WHERE id = p_refund_id
  FOR UPDATE;

  IF v_refund.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_attempt
  FROM public.payment_attempts
  WHERE id = v_refund.payment_attempt_id
  FOR UPDATE;

  IF v_refund.state <> 'requested' THEN
    RETURN jsonb_build_object(
      'action', CASE WHEN v_refund.state = 'processing' THEN 'wait' ELSE 'terminal' END,
      'refund_id', v_refund.id,
      'state', v_refund.state
    );
  END IF;

  IF v_attempt.state <> 'authorized' OR v_attempt.transbank_token IS NULL THEN
    RAISE EXCEPTION 'payment is not refundable';
  END IF;

  UPDATE public.refunds
  SET
    state = 'processing',
    processing_started_at = NOW(),
    correlation_id = p_correlation_id,
    attempt_count = attempt_count + 1,
    updated_at = NOW()
  WHERE id = v_refund.id
  RETURNING * INTO v_refund;

  INSERT INTO public.payment_events (
    payment_attempt_id, order_id, event_type, from_state, to_state,
    actor, correlation_id, metadata
  ) VALUES (
    v_attempt.id, v_refund.order_id, 'refund_claimed', 'requested', 'processing',
    'admin', p_correlation_id,
    jsonb_build_object('refund_id', v_refund.id, 'amount_clp', v_refund.amount_clp)
  );

  RETURN jsonb_build_object(
    'action', 'refund',
    'refund_id', v_refund.id,
    'order_id', v_refund.order_id,
    'payment_attempt_id', v_attempt.id,
    'environment', v_attempt.environment,
    'token', v_attempt.transbank_token,
    'amount_clp', v_refund.amount_clp,
    'state', v_refund.state
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_finalize_refund(
  p_refund_id UUID,
  p_correlation_id UUID,
  p_outcome TEXT,
  p_provider_type TEXT,
  p_response_code INTEGER,
  p_authorization_code TEXT,
  p_authorization_date TIMESTAMPTZ,
  p_balance_clp INTEGER,
  p_nullified_amount_clp INTEGER,
  p_error_code TEXT,
  p_provider_response JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_refund public.refunds%ROWTYPE;
  v_attempt public.payment_attempts%ROWTYPE;
  v_effective_outcome TEXT;
  v_succeeded INTEGER;
  v_payment_status TEXT;
BEGIN
  IF p_outcome NOT IN ('succeeded', 'failed', 'uncertain') THEN
    RAISE EXCEPTION 'invalid refund outcome';
  END IF;

  SELECT * INTO v_refund
  FROM public.refunds
  WHERE id = p_refund_id
  FOR UPDATE;

  IF v_refund.id IS NULL THEN
    RAISE EXCEPTION 'refund not found';
  END IF;

  SELECT * INTO v_attempt
  FROM public.payment_attempts
  WHERE id = v_refund.payment_attempt_id
  FOR UPDATE;

  IF v_refund.state IN ('succeeded', 'failed', 'uncertain') THEN
    RETURN jsonb_build_object(
      'refund_id', v_refund.id,
      'state', v_refund.state,
      'reused', TRUE
    );
  END IF;

  IF v_refund.state <> 'processing' THEN
    RAISE EXCEPTION 'refund was not claimed';
  END IF;

  v_effective_outcome := p_outcome;
  IF p_outcome = 'succeeded' AND NOT (
    (
      p_provider_type = 'REVERSED'
      AND v_refund.amount_clp = v_attempt.amount_clp
    )
    OR (
      p_provider_type = 'NULLIFIED'
      AND p_response_code = 0
      AND p_nullified_amount_clp = v_refund.amount_clp
      AND p_balance_clp IS NOT NULL
      AND p_balance_clp >= 0
    )
  ) THEN
    v_effective_outcome := 'uncertain';
  END IF;

  UPDATE public.refunds
  SET
    state = v_effective_outcome,
    provider_type = CASE
      WHEN p_provider_type IN ('REVERSED', 'NULLIFIED') THEN p_provider_type
      ELSE NULL
    END,
    response_code = p_response_code,
    authorization_code = LEFT(p_authorization_code, 64),
    authorization_date = p_authorization_date,
    balance_clp = p_balance_clp,
    nullified_amount_clp = p_nullified_amount_clp,
    provider_response = COALESCE(p_provider_response, '{}'::JSONB),
    last_error_code = LEFT(NULLIF(p_error_code, ''), 120),
    terminal_at = CASE
      WHEN v_effective_outcome IN ('succeeded', 'failed') THEN NOW()
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE id = v_refund.id;

  IF v_effective_outcome = 'succeeded' THEN
    SELECT COALESCE(SUM(amount_clp), 0)::INTEGER INTO v_succeeded
    FROM public.refunds
    WHERE payment_attempt_id = v_attempt.id AND state = 'succeeded';

    v_payment_status := CASE
      WHEN v_succeeded = v_attempt.amount_clp THEN 'refunded'
      ELSE 'partially_refunded'
    END;

    UPDATE public.orders
    SET payment_status = v_payment_status, updated_at = NOW()
    WHERE id = v_refund.order_id;
  ELSIF v_effective_outcome = 'uncertain' THEN
    INSERT INTO public.commerce_outbox (
      kind, order_id, payment_attempt_id, refund_id, dedupe_key
    ) VALUES (
      'refund_alert', v_refund.order_id, v_attempt.id, v_refund.id,
      'refund-alert/' || v_refund.id::TEXT
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  INSERT INTO public.payment_events (
    payment_attempt_id, order_id, event_type, from_state, to_state,
    actor, correlation_id, metadata
  ) VALUES (
    v_attempt.id, v_refund.order_id, 'refund_finalized', v_refund.state,
    v_effective_outcome, 'admin', p_correlation_id,
    jsonb_build_object(
      'refund_id', v_refund.id,
      'amount_clp', v_refund.amount_clp,
      'provider_type', p_provider_type,
      'response_code', p_response_code
    )
  );

  RETURN jsonb_build_object(
    'refund_id', v_refund.id,
    'state', v_effective_outcome,
    'payment_status', v_payment_status,
    'reused', FALSE
  );
END;
$$;

-- Fulfillment is a separate operational transition. A refund never restocks
-- automatically and a fulfillment transition never changes payment truth.
CREATE OR REPLACE FUNCTION public.commerce_admin_update_fulfillment(
  p_order_public_id UUID,
  p_admin_user_id UUID,
  p_next_status TEXT,
  p_correlation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_order_status TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_admin_user_id AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'fulfillment administrator is not authorized';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE public_id = p_order_public_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF NOT (
    (v_order.fulfillment_status = 'pending' AND p_next_status IN ('preparing', 'cancelled'))
    OR (v_order.fulfillment_status = 'preparing' AND p_next_status IN ('ready_for_pickup', 'shipped', 'cancelled'))
    OR (v_order.fulfillment_status = 'ready_for_pickup' AND p_next_status IN ('delivered', 'cancelled'))
    OR (v_order.fulfillment_status = 'shipped' AND p_next_status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'invalid fulfillment transition';
  END IF;

  IF p_next_status = 'cancelled'
    AND v_order.payment_status NOT IN ('refunded', 'rejected', 'aborted', 'expired') THEN
    RAISE EXCEPTION 'paid order must be refunded before cancellation';
  END IF;

  v_order_status := CASE p_next_status
    WHEN 'preparing' THEN 'preparing'
    WHEN 'ready_for_pickup' THEN 'ready_for_pickup'
    WHEN 'shipped' THEN 'shipped'
    WHEN 'delivered' THEN 'completed'
    WHEN 'cancelled' THEN 'cancelled'
  END;

  UPDATE public.orders
  SET
    fulfillment_status = p_next_status,
    order_status = v_order_status,
    updated_at = NOW()
  WHERE id = v_order.id;

  INSERT INTO public.payment_events (
    order_id, event_type, from_state, to_state, actor, correlation_id
  ) VALUES (
    v_order.id, 'fulfillment_status_changed', v_order.fulfillment_status,
    p_next_status, 'admin', p_correlation_id
  );

  RETURN jsonb_build_object(
    'public_id', v_order.public_id,
    'fulfillment_status', p_next_status,
    'order_status', v_order_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.commerce_enqueue_order_operations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_enqueue_payment_alert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_claim_outbox(INTEGER, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_complete_outbox(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_fail_outbox(UUID, UUID, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_request_refund(UUID, UUID, INTEGER, TEXT, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_claim_refund(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_finalize_refund(
  UUID, UUID, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ, INTEGER, INTEGER,
  TEXT, JSONB
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_admin_update_fulfillment(UUID, UUID, TEXT, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.commerce_claim_outbox(INTEGER, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_complete_outbox(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_fail_outbox(UUID, UUID, TEXT, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_request_refund(UUID, UUID, INTEGER, TEXT, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_claim_refund(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_finalize_refund(
  UUID, UUID, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ, INTEGER, INTEGER,
  TEXT, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_admin_update_fulfillment(UUID, UUID, TEXT, UUID) TO service_role;

COMMIT;
