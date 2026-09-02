-- Entrega productiva: puntos de retiro confiables, tracking y correos
-- transaccionales disparados por cambios de estado. Las llamadas externas
-- siguen ocurriendo exclusivamente en el worker HTTP del outbox.

BEGIN;

-- Datos públicos mínimos de los puntos de retiro. No se publica una dirección
-- particular hasta que el comercio la configure explícitamente.
ALTER TABLE public.shipping_origins
  ADD COLUMN IF NOT EXISTS pickup_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pickup_label TEXT,
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS pickup_hours TEXT,
  ADD COLUMN IF NOT EXISTS pickup_instructions TEXT;

ALTER TABLE public.shipping_origins
  DROP CONSTRAINT IF EXISTS shipping_origins_pickup_label_length_check,
  DROP CONSTRAINT IF EXISTS shipping_origins_pickup_address_length_check,
  DROP CONSTRAINT IF EXISTS shipping_origins_pickup_hours_length_check,
  DROP CONSTRAINT IF EXISTS shipping_origins_pickup_instructions_length_check;

ALTER TABLE public.shipping_origins
  ADD CONSTRAINT shipping_origins_pickup_label_length_check
    CHECK (pickup_label IS NULL OR char_length(BTRIM(pickup_label)) BETWEEN 2 AND 100),
  ADD CONSTRAINT shipping_origins_pickup_address_length_check
    CHECK (pickup_address IS NULL OR char_length(BTRIM(pickup_address)) BETWEEN 2 AND 200),
  ADD CONSTRAINT shipping_origins_pickup_hours_length_check
    CHECK (pickup_hours IS NULL OR char_length(BTRIM(pickup_hours)) BETWEEN 2 AND 200),
  ADD CONSTRAINT shipping_origins_pickup_instructions_length_check
    CHECK (pickup_instructions IS NULL OR char_length(BTRIM(pickup_instructions)) BETWEEN 2 AND 300);

UPDATE public.shipping_origins
SET
  region = CASE code
    WHEN 'las_condes' THEN 'Metropolitana de Santiago'
    ELSE 'Región del Biobío'
  END,
  commune = CASE code
    WHEN 'las_condes' THEN 'Las Condes'
    ELSE 'Los Ángeles'
  END,
  pickup_enabled = TRUE,
  pickup_label = CASE code
    WHEN 'las_condes' THEN 'Retiro en Las Condes'
    ELSE 'Retiro en Los Ángeles'
  END,
  pickup_address = CASE code
    WHEN 'las_condes' THEN 'Las Condes, Región Metropolitana'
    ELSE 'Los Ángeles, Región del Biobío'
  END,
  pickup_hours = 'Horario coordinado después de la compra',
  pickup_instructions = 'Te contactaremos para coordinar la dirección y el horario exactos.',
  updated_at = NOW()
WHERE code IN ('las_condes', 'los_angeles');

-- Retiro sin costo, pero únicamente desde la misma bodega que tiene stock.
INSERT INTO public.shipping_zones (
  id, name, region, commune, delivery_method, priority, active
) VALUES
  ('b1000000-0000-4000-8000-000000000001', 'Retiro Las Condes',
   'Metropolitana de Santiago', 'Las Condes', 'pickup', 1, TRUE),
  ('b1000000-0000-4000-8000-000000000002', 'Retiro Los Ángeles',
   'Región del Biobío', 'Los Ángeles', 'pickup', 1, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  region = EXCLUDED.region,
  commune = EXCLUDED.commune,
  delivery_method = EXCLUDED.delivery_method,
  priority = EXCLUDED.priority,
  active = TRUE,
  updated_at = NOW();

INSERT INTO public.shipping_rates (
  id, shipping_origin_code, zone_id, handling_class, service_code,
  amount_clp, min_delivery_days, max_delivery_days, valid_from,
  source_note, active
) VALUES
  ('b2000000-0000-4000-8000-000000000001', 'las_condes',
   'b1000000-0000-4000-8000-000000000001', 'standard', 'pickup',
   0, 0, 0, '2026-09-01 00:00:00+00', 'Retiro coordinado por ReSkiChile', TRUE),
  ('b2000000-0000-4000-8000-000000000002', 'los_angeles',
   'b1000000-0000-4000-8000-000000000002', 'standard', 'pickup',
   0, 0, 0, '2026-09-01 00:00:00+00', 'Retiro coordinado por ReSkiChile', TRUE)
ON CONFLICT (id) DO UPDATE SET
  amount_clp = 0,
  active = TRUE,
  updated_at = NOW();

-- Evidencia de despacho visible para el equipo y usada por el correo al comprador.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_carrier TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_for_pickup_at TIMESTAMPTZ;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_shipping_carrier_length_check,
  DROP CONSTRAINT IF EXISTS orders_tracking_number_length_check,
  DROP CONSTRAINT IF EXISTS orders_tracking_url_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_shipping_carrier_length_check
    CHECK (shipping_carrier IS NULL OR char_length(BTRIM(shipping_carrier)) BETWEEN 2 AND 80),
  ADD CONSTRAINT orders_tracking_number_length_check
    CHECK (tracking_number IS NULL OR char_length(BTRIM(tracking_number)) BETWEEN 2 AND 120),
  ADD CONSTRAINT orders_tracking_url_check
    CHECK (tracking_url IS NULL OR (
      char_length(tracking_url) <= 500 AND tracking_url ~ '^https://'
    ));

-- Ampliar tipos del outbox sin perder filas existentes.
ALTER TABLE public.commerce_outbox
  DROP CONSTRAINT IF EXISTS commerce_outbox_kind_check;
ALTER TABLE public.commerce_outbox
  ADD CONSTRAINT commerce_outbox_kind_check CHECK (kind IN (
    'order_confirmation', 'fulfillment_notice',
    'shipment_notice', 'pickup_ready_notice', 'refund_confirmation',
    'payment_alert', 'refund_alert'
  ));

CREATE OR REPLACE FUNCTION public.commerce_enqueue_delivery_notice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt_id UUID;
  v_kind TEXT;
BEGIN
  IF NEW.fulfillment_status IS NOT DISTINCT FROM OLD.fulfillment_status THEN
    RETURN NEW;
  END IF;

  v_kind := CASE
    WHEN NEW.fulfillment_status = 'shipped' AND NEW.delivery_method = 'home'
      THEN 'shipment_notice'
    WHEN NEW.fulfillment_status = 'ready_for_pickup' AND NEW.delivery_method = 'pickup'
      THEN 'pickup_ready_notice'
    ELSE NULL
  END;
  IF v_kind IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_attempt_id
  FROM public.payment_attempts
  WHERE order_id = NEW.id AND state = 'authorized'
  ORDER BY authorized_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_attempt_id IS NOT NULL THEN
    INSERT INTO public.commerce_outbox (
      kind, order_id, payment_attempt_id, dedupe_key
    ) VALUES (
      v_kind, NEW.id, v_attempt_id,
      CASE v_kind
        WHEN 'shipment_notice' THEN 'shipment-notice/' || NEW.id::TEXT
        ELSE 'pickup-ready-notice/' || NEW.id::TEXT
      END
    ) ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_enqueue_delivery_notice ON public.orders;
CREATE TRIGGER orders_enqueue_delivery_notice
AFTER UPDATE OF fulfillment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.commerce_enqueue_delivery_notice();

CREATE OR REPLACE FUNCTION public.commerce_enqueue_refund_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.state = 'succeeded' AND OLD.state IS DISTINCT FROM 'succeeded' THEN
    INSERT INTO public.commerce_outbox (
      kind, order_id, payment_attempt_id, refund_id, dedupe_key
    ) VALUES (
      'refund_confirmation', NEW.order_id, NEW.payment_attempt_id, NEW.id,
      'refund-confirmation/' || NEW.id::TEXT
    ) ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refunds_enqueue_confirmation ON public.refunds;
CREATE TRIGGER refunds_enqueue_confirmation
AFTER UPDATE OF state ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.commerce_enqueue_refund_confirmation();

-- Una orden a domicilio solo puede marcarse enviada junto con tracking.
CREATE OR REPLACE FUNCTION public.commerce_admin_mark_shipped(
  p_order_public_id UUID,
  p_admin_user_id UUID,
  p_carrier TEXT,
  p_tracking_number TEXT,
  p_tracking_url TEXT,
  p_correlation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_admin_user_id AND is_admin = TRUE
  ) THEN RAISE EXCEPTION 'fulfillment administrator is not authorized'; END IF;

  IF char_length(BTRIM(COALESCE(p_carrier, ''))) NOT BETWEEN 2 AND 80
    OR char_length(BTRIM(COALESCE(p_tracking_number, ''))) NOT BETWEEN 2 AND 120
    OR (p_tracking_url IS NOT NULL AND (
      char_length(p_tracking_url) > 500 OR p_tracking_url !~ '^https://'
    )) THEN
    RAISE EXCEPTION 'invalid tracking information';
  END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE public_id = p_order_public_id FOR UPDATE;

  IF v_order.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF v_order.delivery_method <> 'home'
    OR v_order.fulfillment_status <> 'preparing'
    OR v_order.payment_status NOT IN ('authorized', 'partially_refunded') THEN
    RAISE EXCEPTION 'invalid fulfillment transition';
  END IF;

  UPDATE public.orders SET
    fulfillment_status = 'shipped', order_status = 'shipped',
    shipping_carrier = BTRIM(p_carrier),
    tracking_number = BTRIM(p_tracking_number),
    tracking_url = NULLIF(BTRIM(COALESCE(p_tracking_url, '')), ''),
    shipped_at = NOW(), updated_at = NOW()
  WHERE id = v_order.id;

  INSERT INTO public.payment_events (
    order_id, event_type, from_state, to_state, actor, correlation_id,
    metadata
  ) VALUES (
    v_order.id, 'fulfillment_status_changed', v_order.fulfillment_status,
    'shipped', 'admin', p_correlation_id,
    jsonb_build_object('carrier', BTRIM(p_carrier), 'has_tracking_url', p_tracking_url IS NOT NULL)
  );

  RETURN jsonb_build_object(
    'public_id', v_order.public_id,
    'fulfillment_status', 'shipped', 'order_status', 'shipped'
  );
END;
$$;

-- Las demás transiciones mantienen la RPC existente. "shipped" queda
-- reservado a commerce_admin_mark_shipped para que nunca falte el tracking.
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
  ) THEN RAISE EXCEPTION 'fulfillment administrator is not authorized'; END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE public_id = p_order_public_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;

  IF NOT (
    (v_order.fulfillment_status = 'pending' AND p_next_status IN ('preparing', 'cancelled'))
    OR (v_order.fulfillment_status = 'preparing' AND p_next_status IN ('ready_for_pickup', 'cancelled'))
    OR (v_order.fulfillment_status = 'ready_for_pickup' AND p_next_status IN ('delivered', 'cancelled'))
    OR (v_order.fulfillment_status = 'shipped' AND p_next_status = 'delivered')
  ) THEN RAISE EXCEPTION 'invalid fulfillment transition'; END IF;

  IF p_next_status = 'ready_for_pickup' AND v_order.delivery_method <> 'pickup' THEN
    RAISE EXCEPTION 'invalid fulfillment transition';
  END IF;
  IF p_next_status = 'cancelled'
    AND v_order.payment_status NOT IN ('refunded', 'rejected', 'aborted', 'expired') THEN
    RAISE EXCEPTION 'paid order must be refunded before cancellation';
  END IF;

  v_order_status := CASE p_next_status
    WHEN 'preparing' THEN 'preparing'
    WHEN 'ready_for_pickup' THEN 'ready_for_pickup'
    WHEN 'delivered' THEN 'completed'
    WHEN 'cancelled' THEN 'cancelled'
  END;

  UPDATE public.orders SET
    fulfillment_status = p_next_status,
    order_status = v_order_status,
    ready_for_pickup_at = CASE
      WHEN p_next_status = 'ready_for_pickup' THEN NOW()
      ELSE ready_for_pickup_at
    END,
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

-- El cron productivo jamás debe reclamar correos de Integration (ni viceversa).
CREATE OR REPLACE FUNCTION public.commerce_claim_outbox(
  p_limit INTEGER,
  p_correlation_id UUID,
  p_environment TEXT
)
RETURNS TABLE (
  outbox_id UUID, outbox_kind TEXT, dedupe_key TEXT,
  order_public_id UUID, order_number TEXT, buyer_email TEXT, buyer_name TEXT,
  delivery_method TEXT, destination_region TEXT, destination_commune TEXT,
  subtotal_clp INTEGER, discount_clp INTEGER, shipping_clp INTEGER,
  total_clp INTEGER, payment_state TEXT, payment_error_code TEXT,
  refund_amount_clp INTEGER, refund_state TEXT, refund_reason TEXT, items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 20 OR p_correlation_id IS NULL
    OR p_environment NOT IN ('integration', 'production') THEN
    RAISE EXCEPTION 'invalid outbox claim';
  END IF;

  UPDATE public.commerce_outbox outbox SET
    state = 'uncertain', lease_until = NULL,
    last_error_code = 'delivery_lease_expired_after_idempotency_window',
    updated_at = NOW()
  FROM public.payment_attempts attempt
  WHERE outbox.payment_attempt_id = attempt.id
    AND attempt.environment = p_environment
    AND outbox.state = 'processing' AND outbox.lease_until <= NOW()
    AND outbox.updated_at <= NOW() - INTERVAL '23 hours';

  RETURN QUERY
  WITH candidate AS (
    SELECT outbox.id
    FROM public.commerce_outbox outbox
    JOIN public.payment_attempts attempt ON attempt.id = outbox.payment_attempt_id
    WHERE attempt.environment = p_environment AND (
      (outbox.state IN ('pending', 'retry') AND outbox.available_at <= NOW())
      OR (outbox.state = 'processing' AND outbox.lease_until <= NOW()
          AND outbox.updated_at > NOW() - INTERVAL '23 hours')
    )
    ORDER BY outbox.available_at, outbox.created_at
    FOR UPDATE OF outbox SKIP LOCKED LIMIT p_limit
  ), claimed AS (
    UPDATE public.commerce_outbox outbox SET
      state = 'processing', attempt_count = outbox.attempt_count + 1,
      lease_until = NOW() + INTERVAL '10 minutes',
      correlation_id = p_correlation_id, updated_at = NOW()
    FROM candidate WHERE outbox.id = candidate.id RETURNING outbox.*
  )
  SELECT claimed.id, claimed.kind, claimed.dedupe_key,
    orders.public_id, orders.order_number::TEXT, orders.buyer_email,
    orders.buyer_name, orders.delivery_method,
    orders.shipping_snapshot->>'region', orders.shipping_snapshot->>'commune',
    orders.subtotal_clp, orders.discount_clp, orders.shipping_clp,
    orders.total_clp, attempt.state, attempt.last_error_code,
    refund.amount_clp, refund.state, refund.reason,
    COALESCE(lines.items, '[]'::JSONB)
  FROM claimed
  JOIN public.orders orders ON orders.id = claimed.order_id
  JOIN public.payment_attempts attempt ON attempt.id = claimed.payment_attempt_id
  LEFT JOIN public.refunds refund ON refund.id = claimed.refund_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'name', item.product_name, 'quantity', item.quantity,
      'unit_price_clp', item.unit_price_clp,
      'line_total_clp', item.line_total_clp, 'sku', item.sku
    ) ORDER BY item.created_at, item.id) AS items
    FROM public.order_items item WHERE item.order_id = orders.id
  ) lines ON TRUE
  ORDER BY claimed.available_at, claimed.created_at;
END;
$$;

-- La RPC genérica ya acepta chilexpress. La variante de Ski Rack nació antes
-- con una lista más estrecha; ampliamos únicamente esa validación, conservando
-- todo el cuerpo transaccional y sus invariantes de inventario.
DO $$
DECLARE
  v_definition TEXT;
  v_updated TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.commerce_create_rack_checkout(jsonb,uuid,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,uuid,text,text,text,text,text,integer,boolean)'::regprocedure
  ) INTO v_definition;
  v_updated := replace(
    v_definition,
    'p_shipping_source NOT IN (''sandbox_fixed'', ''table'')',
    'p_shipping_source NOT IN (''sandbox_fixed'', ''table'', ''chilexpress'')'
  );
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'rack checkout shipping source guard was not found';
  END IF;
  EXECUTE v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.commerce_enqueue_delivery_notice() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_enqueue_refund_confirmation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_admin_mark_shipped(UUID, UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_claim_outbox(INTEGER, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commerce_admin_mark_shipped(UUID, UUID, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_claim_outbox(INTEGER, UUID, TEXT) TO service_role;

COMMIT;
