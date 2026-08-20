-- Conserva el tipo de retorno no normal de Webpay para que una consulta de
-- estado transitoriamente fallida pueda resolverse después sin perder si el
-- comprador anuló o si la sesión expiró.

BEGIN;

ALTER TABLE public.payment_attempts
  ADD COLUMN webpay_return_kind TEXT,
  ADD COLUMN webpay_return_received_at TIMESTAMPTZ;

ALTER TABLE public.payment_attempts
  ADD CONSTRAINT payment_attempts_webpay_return_kind_check
  CHECK (webpay_return_kind IN ('aborted', 'timeout', 'special'));

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
    'webpay_return_kind', p_attempt.webpay_return_kind
  )
  FROM public.orders orders
  WHERE orders.id = p_attempt.order_id;
$$;

CREATE OR REPLACE FUNCTION public.commerce_record_webpay_return_context(
  p_attempt_id UUID,
  p_return_kind TEXT,
  p_correlation_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id UUID;
  v_existing_kind TEXT;
  v_effective_kind TEXT;
  v_state TEXT;
BEGIN
  IF p_attempt_id IS NULL
    OR p_correlation_id IS NULL
    OR p_return_kind NOT IN ('aborted', 'timeout', 'special') THEN
    RAISE EXCEPTION 'invalid webpay return context';
  END IF;

  SELECT order_id INTO v_order_id
  FROM public.payment_attempts
  WHERE id = p_attempt_id;

  IF v_order_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.commerce_lock_order_payment_rows(v_order_id);

  SELECT webpay_return_kind, state
  INTO v_existing_kind, v_state
  FROM public.payment_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  v_effective_kind := CASE
    WHEN v_existing_kind IS NULL THEN p_return_kind
    WHEN v_existing_kind = p_return_kind THEN v_existing_kind
    ELSE 'special'
  END;

  UPDATE public.payment_attempts
  SET
    webpay_return_kind = v_effective_kind,
    webpay_return_received_at = COALESCE(webpay_return_received_at, NOW()),
    updated_at = NOW()
  WHERE id = p_attempt_id;

  IF v_existing_kind IS DISTINCT FROM v_effective_kind THEN
    INSERT INTO public.payment_events (
      payment_attempt_id, order_id, event_type, from_state, to_state,
      correlation_id, metadata
    ) VALUES (
      p_attempt_id, v_order_id, 'webpay_return_classified', v_state, v_state,
      p_correlation_id,
      jsonb_build_object(
        'received_kind', p_return_kind,
        'effective_kind', v_effective_kind
      )
    );
  END IF;

  RETURN v_effective_kind;
END;
$$;

REVOKE ALL ON FUNCTION public.commerce_payment_claim_payload(
  public.payment_attempts, TEXT
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commerce_record_webpay_return_context(
  UUID, TEXT, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_record_webpay_return_context(
  UUID, TEXT, UUID
) TO service_role;

COMMENT ON COLUMN public.payment_attempts.webpay_return_kind IS
  'Retorno no normal correlacionado: aborted, timeout o special.';
COMMENT ON FUNCTION public.commerce_record_webpay_return_context(UUID, TEXT, UUID) IS
  'Registra de forma idempotente el contexto del retorno Webpay sin aceptar secretos desde el navegador.';

COMMIT;
