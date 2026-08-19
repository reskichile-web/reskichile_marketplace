-- Persist only the normalized checkout address snapshot. The existing checkout
-- routines remain unchanged; new overloads wrap them atomically so previously
-- deployed callers and historical migrations are not rewritten.

BEGIN;

CREATE OR REPLACE FUNCTION public.commerce_validate_shipping_snapshot(
  p_snapshot JSONB,
  p_delivery_method TEXT,
  p_environment TEXT,
  p_shipping_region TEXT,
  p_shipping_commune TEXT
)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'shipping snapshot must be an object';
  END IF;

  IF p_snapshot - ARRAY[
    'country_code', 'region', 'commune', 'street', 'number', 'extra',
    'formatted_address', 'provider', 'provider_place_id',
    'validation_status', 'validated_at', 'pickup_point_id'
  ] <> '{}'::JSONB THEN
    RAISE EXCEPTION 'shipping snapshot contains unsupported fields';
  END IF;

  IF p_snapshot->>'country_code' <> 'CL'
    OR p_snapshot->>'region' <> BTRIM(p_shipping_region)
    OR p_snapshot->>'commune' <> BTRIM(p_shipping_commune)
    OR char_length(p_snapshot->>'region') NOT BETWEEN 2 AND 100
    OR char_length(p_snapshot->>'commune') NOT BETWEEN 2 AND 100
    OR char_length(COALESCE(p_snapshot->>'extra', '')) > 160 THEN
    RAISE EXCEPTION 'shipping snapshot destination is invalid';
  END IF;

  v_status := p_snapshot->>'validation_status';
  IF p_delivery_method = 'home' THEN
    IF char_length(COALESCE(p_snapshot->>'street', '')) NOT BETWEEN 2 AND 120
      OR char_length(COALESCE(p_snapshot->>'number', '')) NOT BETWEEN 1 AND 20 THEN
      RAISE EXCEPTION 'shipping snapshot requires street and number';
    END IF;

    IF v_status = 'confirmed' THEN
      IF p_snapshot->>'provider' <> 'google'
        OR char_length(COALESCE(p_snapshot->>'formatted_address', '')) NOT BETWEEN 5 AND 240
        OR COALESCE(p_snapshot->>'provider_place_id', '') !~ '^[A-Za-z0-9_-]{8,255}$'
        OR COALESCE(p_snapshot->>'validated_at', '')
          !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}' THEN
        RAISE EXCEPTION 'confirmed shipping snapshot is invalid';
      END IF;
    ELSIF NOT (
      p_environment = 'integration'
      AND v_status = 'unverified'
      AND p_snapshot->>'provider' = 'manual'
    ) THEN
      RAISE EXCEPTION 'home address must be confirmed';
    END IF;
  ELSIF p_delivery_method = 'pickup' THEN
    IF v_status <> 'not_required'
      OR p_snapshot->>'provider' <> 'manual'
      OR char_length(COALESCE(p_snapshot->>'pickup_point_id', '')) NOT BETWEEN 2 AND 120 THEN
      RAISE EXCEPTION 'pickup shipping snapshot is invalid';
    END IF;
  ELSE
    RAISE EXCEPTION 'shipping snapshot delivery method is invalid';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_create_checkout(
  p_product_ids UUID[],
  p_buyer_user_id UUID,
  p_buyer_email TEXT,
  p_buyer_name TEXT,
  p_buyer_phone TEXT,
  p_delivery_method TEXT,
  p_shipping_region TEXT,
  p_shipping_commune TEXT,
  p_shipping_street TEXT,
  p_shipping_number TEXT,
  p_shipping_extra TEXT,
  p_pickup_point_id TEXT,
  p_shipping_amount_clp INTEGER,
  p_shipping_source TEXT,
  p_coupon_code TEXT,
  p_environment TEXT,
  p_idempotency_key UUID,
  p_request_fingerprint TEXT,
  p_order_number TEXT,
  p_buy_order TEXT,
  p_session_id TEXT,
  p_guest_access_hash TEXT,
  p_reservation_minutes INTEGER,
  p_allow_incomplete_shipping BOOLEAN,
  p_shipping_snapshot JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_order_id UUID;
  v_existing JSONB;
  v_snapshot JSONB := jsonb_strip_nulls(p_shipping_snapshot);
BEGIN
  PERFORM public.commerce_validate_shipping_snapshot(
    p_shipping_snapshot, p_delivery_method, p_environment,
    p_shipping_region, p_shipping_commune
  );

  v_result := public.commerce_create_checkout(
    p_product_ids, p_buyer_user_id, p_buyer_email, p_buyer_name,
    p_buyer_phone, p_delivery_method, p_shipping_region, p_shipping_commune,
    p_shipping_street, p_shipping_number, p_shipping_extra, p_pickup_point_id,
    p_shipping_amount_clp, p_shipping_source, p_coupon_code, p_environment,
    p_idempotency_key, p_request_fingerprint, p_order_number, p_buy_order,
    p_session_id, p_guest_access_hash, p_reservation_minutes,
    p_allow_incomplete_shipping
  );
  v_order_id := (v_result->>'order_id')::UUID;

  IF COALESCE((v_result->>'reused')::BOOLEAN, FALSE) THEN
    SELECT shipping_snapshot INTO v_existing
    FROM public.orders WHERE id = v_order_id;
    IF v_existing <> v_snapshot THEN
      RAISE EXCEPTION 'idempotency key reused with different shipping snapshot';
    END IF;
  ELSE
    UPDATE public.orders
    SET shipping_snapshot = v_snapshot
    WHERE id = v_order_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'checkout order was not persisted';
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_create_rack_checkout(
  p_items JSONB,
  p_buyer_user_id UUID,
  p_buyer_email TEXT,
  p_buyer_name TEXT,
  p_buyer_phone TEXT,
  p_delivery_method TEXT,
  p_shipping_region TEXT,
  p_shipping_commune TEXT,
  p_shipping_street TEXT,
  p_shipping_number TEXT,
  p_shipping_extra TEXT,
  p_pickup_point_id TEXT,
  p_shipping_amount_clp INTEGER,
  p_shipping_source TEXT,
  p_shipping_origin_code TEXT,
  p_coupon_code TEXT,
  p_environment TEXT,
  p_idempotency_key UUID,
  p_request_fingerprint TEXT,
  p_order_number TEXT,
  p_buy_order TEXT,
  p_session_id TEXT,
  p_guest_access_hash TEXT,
  p_reservation_minutes INTEGER,
  p_allow_incomplete_shipping BOOLEAN,
  p_shipping_snapshot JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_order_id UUID;
  v_existing JSONB;
  v_snapshot JSONB := jsonb_strip_nulls(p_shipping_snapshot);
BEGIN
  PERFORM public.commerce_validate_shipping_snapshot(
    p_shipping_snapshot, p_delivery_method, p_environment,
    p_shipping_region, p_shipping_commune
  );

  v_result := public.commerce_create_rack_checkout(
    p_items, p_buyer_user_id, p_buyer_email, p_buyer_name, p_buyer_phone,
    p_delivery_method, p_shipping_region, p_shipping_commune,
    p_shipping_street, p_shipping_number, p_shipping_extra, p_pickup_point_id,
    p_shipping_amount_clp, p_shipping_source, p_shipping_origin_code,
    p_coupon_code, p_environment, p_idempotency_key, p_request_fingerprint,
    p_order_number, p_buy_order, p_session_id, p_guest_access_hash,
    p_reservation_minutes, p_allow_incomplete_shipping
  );
  v_order_id := (v_result->>'order_id')::UUID;

  IF COALESCE((v_result->>'reused')::BOOLEAN, FALSE) THEN
    SELECT shipping_snapshot INTO v_existing
    FROM public.orders WHERE id = v_order_id;
    IF v_existing <> v_snapshot THEN
      RAISE EXCEPTION 'idempotency conflict: shipping snapshot changed';
    END IF;
  ELSE
    UPDATE public.orders
    SET shipping_snapshot = v_snapshot
    WHERE id = v_order_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'rack checkout order was not persisted';
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.commerce_validate_shipping_snapshot(
  JSONB, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_validate_shipping_snapshot(
  JSONB, TEXT, TEXT, TEXT, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.commerce_create_checkout(
  UUID[], UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  INTEGER, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER,
  BOOLEAN, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_create_checkout(
  UUID[], UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  INTEGER, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER,
  BOOLEAN, JSONB
) TO service_role;

REVOKE ALL ON FUNCTION public.commerce_create_rack_checkout(
  JSONB, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER,
  BOOLEAN, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_create_rack_checkout(
  JSONB, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER,
  BOOLEAN, JSONB
) TO service_role;

COMMIT;
