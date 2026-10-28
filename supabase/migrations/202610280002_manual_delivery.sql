-- Administrator-coordinated personal delivery and independently evidenced payment.
BEGIN;
ALTER TABLE public.orders DROP CONSTRAINT orders_delivery_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_method_check CHECK (delivery_method IN ('home', 'pickup', 'manual'));
ALTER TABLE public.orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'webpay'
  CHECK (payment_method IN ('webpay', 'manual_pending', 'cash', 'bank_transfer'));
ALTER TABLE public.orders ADD COLUMN manual_payment_reference TEXT;
ALTER TABLE public.orders ADD COLUMN manual_payment_recorded_by UUID REFERENCES public.users(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_manual_delivery_check CHECK (
  delivery_method <> 'manual' OR (shipping_clp = 0 AND shipping_carrier IS NULL AND tracking_number IS NULL AND tracking_url IS NULL)
);
ALTER TABLE public.orders ADD CONSTRAINT orders_manual_payment_check CHECK (
  payment_method = 'webpay' OR (delivery_method = 'manual' AND
    (payment_method = 'manual_pending' OR (manual_payment_recorded_by IS NOT NULL AND manual_payment_reference IS NOT NULL AND char_length(manual_payment_reference) BETWEEN 3 AND 200)))
);

CREATE OR REPLACE FUNCTION public.commerce_admin_set_manual_delivery(
  p_order_public_id UUID, p_admin_user_id UUID, p_note TEXT, p_correlation_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order public.orders%ROWTYPE; v_order_id UUID; v_item RECORD; v_available INTEGER;
BEGIN
  IF p_correlation_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_admin_user_id AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'delivery administrator is not authorized';
  END IF;
  IF char_length(BTRIM(COALESCE(p_note, ''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'delivery note required'; END IF;
  SELECT id INTO v_order_id FROM public.orders WHERE public_id = p_order_public_id;
  IF v_order_id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  PERFORM public.commerce_lock_order_payment_rows(v_order_id);
  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
  IF v_order.delivery_method = 'manual' THEN
    RETURN jsonb_build_object('public_id', v_order.public_id, 'total_clp', v_order.total_clp, 'reused', TRUE);
  END IF;
  -- Never rewrite an approved provider charge or a transaction still in flight.
  IF v_order.payment_status IN ('authorized', 'partially_refunded', 'refunded')
    OR v_order.fulfillment_status IN ('shipped', 'delivered')
    OR EXISTS (SELECT 1 FROM public.payment_attempts WHERE order_id = v_order.id
      AND state NOT IN ('rejected', 'aborted', 'expired', 'initialization_failed')) THEN
    RAISE EXCEPTION 'resolve provider payment before changing delivery';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order.id)
    OR EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order.id AND rack_inventory_id IS NULL) THEN
    RAISE EXCEPTION 'manual recovery requires rack inventory';
  END IF;
  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = v_order.id ORDER BY rack_inventory_id LOOP
    SELECT inventory.stock_on_hand - COALESCE((SELECT SUM(quantity) FROM public.inventory_reservations r
      WHERE r.rack_inventory_id = inventory.id AND r.order_id <> v_order.id
      AND r.state IN ('active', 'payment_processing', 'reconciliation_required')
      AND (r.state <> 'active' OR r.expires_at > NOW())), 0)
    INTO v_available FROM public.ski_rack_inventory inventory WHERE inventory.id = v_item.rack_inventory_id;
    IF v_available < v_item.quantity THEN RAISE EXCEPTION 'insufficient rack stock'; END IF;
    INSERT INTO public.inventory_reservations (order_id, rack_inventory_id, quantity, state, expires_at)
    VALUES (v_order.id, v_item.rack_inventory_id, v_item.quantity, 'active', NOW() + INTERVAL '7 days')
    ON CONFLICT (order_id, rack_inventory_id) WHERE rack_inventory_id IS NOT NULL DO UPDATE
      SET state = 'active', expires_at = NOW() + INTERVAL '7 days', consumed_at = NULL,
        released_at = NULL, release_reason = NULL, updated_at = NOW();
  END LOOP;
  UPDATE public.orders SET delivery_method = 'manual', shipping_clp = 0,
    total_clp = subtotal_clp - discount_clp, payment_method = 'manual_pending',
    payment_status = 'pending', paid_at = NULL, order_status = 'awaiting_payment', fulfillment_status = 'pending',
    shipping_carrier = NULL, tracking_number = NULL, tracking_url = NULL,
    shipping_snapshot = shipping_snapshot || jsonb_build_object('delivery_note', BTRIM(p_note)),
    expires_at = NOW() + INTERVAL '7 days', updated_at = NOW()
  WHERE id = v_order.id;
  INSERT INTO public.payment_events (order_id, event_type, actor, correlation_id, metadata)
  VALUES (v_order.id, 'manual_delivery_arranged', 'admin', p_correlation_id, jsonb_build_object(
    'admin_user_id', p_admin_user_id, 'previous_delivery_method', v_order.delivery_method,
    'previous_shipping_clp', v_order.shipping_clp, 'previous_total_clp', v_order.total_clp,
    'total_clp', v_order.subtotal_clp - v_order.discount_clp, 'reservation_days', 7));
  RETURN jsonb_build_object('public_id', v_order.public_id, 'total_clp', v_order.subtotal_clp - v_order.discount_clp, 'reused', FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_admin_record_manual_payment(
  p_order_public_id UUID, p_admin_user_id UUID, p_method TEXT, p_amount_clp INTEGER,
  p_reference TEXT, p_correlation_id UUID, p_notify_buyer BOOLEAN DEFAULT FALSE
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order public.orders%ROWTYPE; v_order_id UUID; v_item RECORD;
BEGIN
  IF p_correlation_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_admin_user_id AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'payment administrator is not authorized';
  END IF;
  IF p_method IS NULL OR p_method NOT IN ('cash', 'bank_transfer') OR p_amount_clp IS NULL
    OR char_length(BTRIM(COALESCE(p_reference, ''))) NOT BETWEEN 3 AND 200 THEN
    RAISE EXCEPTION 'manual payment evidence required';
  END IF;
  SELECT id INTO v_order_id FROM public.orders WHERE public_id = p_order_public_id;
  IF v_order_id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  PERFORM public.commerce_lock_order_payment_rows(v_order_id);
  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
  IF v_order.payment_method IN ('cash', 'bank_transfer') AND v_order.payment_status = 'authorized'
    AND p_method = v_order.payment_method AND p_amount_clp = v_order.total_clp
    AND BTRIM(p_reference) = v_order.manual_payment_reference THEN
    RETURN jsonb_build_object('public_id', v_order.public_id, 'reused', TRUE);
  END IF;
  IF v_order.delivery_method <> 'manual' OR v_order.payment_method <> 'manual_pending'
    OR v_order.payment_status <> 'pending' OR v_order.order_status <> 'awaiting_payment'
    OR p_amount_clp <> v_order.total_clp OR v_order.expires_at <= NOW()
    OR EXISTS (SELECT 1 FROM public.payment_attempts WHERE order_id = v_order.id
      AND state NOT IN ('rejected', 'aborted', 'expired', 'initialization_failed')) THEN
    RAISE EXCEPTION 'manual payment conflicts with order';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order.id) THEN RAISE EXCEPTION 'missing order items'; END IF;
  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = v_order.id ORDER BY rack_inventory_id LOOP
    IF v_item.rack_inventory_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.inventory_reservations
      WHERE order_id = v_order.id AND rack_inventory_id = v_item.rack_inventory_id AND quantity = v_item.quantity
      AND state = 'active' AND expires_at > NOW()) THEN RAISE EXCEPTION 'manual payment reservation unavailable'; END IF;
    UPDATE public.ski_rack_inventory SET stock_on_hand = stock_on_hand - v_item.quantity, updated_at = NOW()
    WHERE id = v_item.rack_inventory_id AND stock_on_hand >= v_item.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient rack stock'; END IF;
  END LOOP;
  UPDATE public.inventory_reservations SET state = 'consumed', consumed_at = NOW(), updated_at = NOW()
  WHERE order_id = v_order.id AND state = 'active';
  PERFORM set_config('reski.manual_payment_notifications', CASE WHEN p_notify_buyer THEN 'on' ELSE 'off' END, TRUE);
  UPDATE public.orders SET payment_status = 'authorized', payment_method = p_method,
    manual_payment_reference = BTRIM(p_reference), manual_payment_recorded_by = p_admin_user_id,
    paid_at = NOW(), order_status = 'paid', fulfillment_status = 'pending', updated_at = NOW() WHERE id = v_order.id;
  INSERT INTO public.payment_events (order_id, event_type, actor, correlation_id, metadata)
  VALUES (v_order.id, 'manual_payment_recorded', 'admin', p_correlation_id, jsonb_build_object(
    'admin_user_id', p_admin_user_id, 'method', p_method, 'amount_clp', p_amount_clp, 'reference', BTRIM(p_reference)));
  RETURN jsonb_build_object('public_id', v_order.public_id, 'reused', FALSE);
END;
$$;
REVOKE ALL ON FUNCTION public.commerce_admin_set_manual_delivery(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_admin_set_manual_delivery(UUID, UUID, TEXT, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.commerce_admin_record_manual_payment(UUID, UUID, TEXT, INTEGER, TEXT, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_admin_record_manual_payment(UUID, UUID, TEXT, INTEGER, TEXT, UUID, BOOLEAN) TO service_role;
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
    OR (v_order.fulfillment_status = 'preparing' AND v_order.delivery_method = 'manual' AND p_next_status = 'delivered')
    OR (v_order.fulfillment_status = 'ready_for_pickup' AND p_next_status IN ('delivered', 'cancelled'))
    OR (v_order.fulfillment_status = 'shipped' AND p_next_status = 'delivered')
  ) THEN RAISE EXCEPTION 'invalid fulfillment transition'; END IF;

  IF p_next_status <> 'cancelled' AND v_order.payment_status NOT IN ('authorized', 'partially_refunded') THEN
    RAISE EXCEPTION 'payment required before fulfillment';
  END IF;
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
    AND OLD.payment_status IS DISTINCT FROM 'authorized'
    AND (NEW.payment_method = 'webpay' OR current_setting('reski.manual_payment_notifications', TRUE) = 'on') THEN
    SELECT id INTO v_attempt_id
    FROM public.payment_attempts
    WHERE order_id = NEW.id AND (state = 'authorized' OR NEW.payment_method IN ('cash', 'bank_transfer'))
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
NOTIFY pgrst, 'reload schema';
COMMIT;
