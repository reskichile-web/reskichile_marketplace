-- Inventario por variante para Ski Racks.
-- Las unidades se reservan al crear el checkout y se descuentan únicamente
-- cuando Webpay queda autorizado dentro de commerce_finalize_webpay().

BEGIN;

CREATE TABLE public.ski_rack_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,50}$'),
  name TEXT NOT NULL,
  material TEXT NOT NULL,
  price_clp INTEGER NOT NULL CHECK (price_clp > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  packaged_length_cm NUMERIC(8,2),
  packaged_width_cm NUMERIC(8,2),
  packaged_height_cm NUMERIC(8,2),
  packaged_weight_kg NUMERIC(8,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (packaged_length_cm IS NULL OR packaged_length_cm > 0)
    AND (packaged_width_cm IS NULL OR packaged_width_cm > 0)
    AND (packaged_height_cm IS NULL OR packaged_height_cm > 0)
    AND (packaged_weight_kg IS NULL OR packaged_weight_kg > 0)
  )
);

CREATE TABLE public.ski_rack_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rack_product_id UUID NOT NULL REFERENCES public.ski_rack_products(id) ON DELETE RESTRICT,
  size TEXT NOT NULL CHECK (size IN ('S', 'M', 'L')),
  shipping_origin_code TEXT NOT NULL REFERENCES public.shipping_origins(code),
  stock_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rack_product_id, size, shipping_origin_code)
);

CREATE TABLE public.ski_rack_inventory_adjustments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inventory_id UUID NOT NULL REFERENCES public.ski_rack_inventory(id) ON DELETE RESTRICT,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT 'admin_set',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.ski_rack_products (
  slug, name, material, price_clp,
  packaged_length_cm, packaged_width_cm, packaged_height_cm,
  packaged_weight_kg
) VALUES
  ('madera', 'Ski Rack Madera', 'Madera natural', 11990, 10, 10, 20, 0.5),
  ('filamento', 'Ski Rack Filamento', 'Filamento', 7990, 10, 10, 20, 0.5)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  material = EXCLUDED.material,
  price_clp = EXCLUDED.price_clp,
  packaged_length_cm = EXCLUDED.packaged_length_cm,
  packaged_width_cm = EXCLUDED.packaged_width_cm,
  packaged_height_cm = EXCLUDED.packaged_height_cm,
  packaged_weight_kg = EXCLUDED.packaged_weight_kg,
  updated_at = NOW();

INSERT INTO public.ski_rack_inventory (
  rack_product_id, size, shipping_origin_code, stock_on_hand
)
SELECT product.id, sizes.size, origin.code, 5
FROM public.ski_rack_products product
CROSS JOIN (VALUES ('S'), ('M'), ('L')) AS sizes(size)
CROSS JOIN public.shipping_origins origin
WHERE origin.active = TRUE
ON CONFLICT (rack_product_id, size, shipping_origin_code) DO NOTHING;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS rack_inventory_id UUID
    REFERENCES public.ski_rack_inventory(id) ON DELETE RESTRICT;
ALTER TABLE public.order_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_quantity_check;
-- PostgreSQL named the original inline CHECK
-- `CHECK (line_total_clp = unit_price_clp)` as order_items_check.
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_check;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_line_total_clp_check;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_inventory_source_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_quantity_check CHECK (quantity > 0 AND quantity <= 10),
  ADD CONSTRAINT order_items_line_total_clp_check
    CHECK (line_total_clp = unit_price_clp * quantity),
  ADD CONSTRAINT order_items_inventory_source_check CHECK (
    (product_id IS NOT NULL AND rack_inventory_id IS NULL)
    OR (product_id IS NULL AND rack_inventory_id IS NOT NULL)
  );
CREATE UNIQUE INDEX order_items_order_rack_variant_unique
  ON public.order_items (order_id, rack_inventory_id)
  WHERE rack_inventory_id IS NOT NULL;

ALTER TABLE public.inventory_reservations
  ADD COLUMN IF NOT EXISTS rack_inventory_id UUID
    REFERENCES public.ski_rack_inventory(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_reservations ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.inventory_reservations
  DROP CONSTRAINT IF EXISTS inventory_reservations_quantity_check;
ALTER TABLE public.inventory_reservations
  DROP CONSTRAINT IF EXISTS inventory_reservations_inventory_source_check;
ALTER TABLE public.inventory_reservations
  ADD CONSTRAINT inventory_reservations_quantity_check
    CHECK (quantity > 0 AND quantity <= 10),
  ADD CONSTRAINT inventory_reservations_inventory_source_check CHECK (
    (product_id IS NOT NULL AND rack_inventory_id IS NULL)
    OR (product_id IS NULL AND rack_inventory_id IS NOT NULL)
  );
CREATE UNIQUE INDEX inventory_reservations_order_rack_variant_unique
  ON public.inventory_reservations (order_id, rack_inventory_id)
  WHERE rack_inventory_id IS NOT NULL;
CREATE INDEX inventory_reservations_rack_variant_state_idx
  ON public.inventory_reservations (rack_inventory_id, state, expires_at)
  WHERE rack_inventory_id IS NOT NULL;

ALTER TABLE public.ski_rack_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ski_rack_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ski_rack_inventory_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ski_rack_products FROM anon, authenticated;
REVOKE ALL ON public.ski_rack_inventory FROM anon, authenticated;
REVOKE ALL ON public.ski_rack_inventory_adjustments FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.commerce_rack_availability()
RETURNS TABLE (
  inventory_id UUID,
  product_slug TEXT,
  product_name TEXT,
  material TEXT,
  price_clp INTEGER,
  active BOOLEAN,
  size TEXT,
  stock_on_hand INTEGER,
  reserved_quantity INTEGER,
  available_quantity INTEGER,
  shipping_origin_code TEXT,
  packaged_length_cm NUMERIC,
  packaged_width_cm NUMERIC,
  packaged_height_cm NUMERIC,
  packaged_weight_kg NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    inventory.id,
    product.slug,
    product.name,
    product.material,
    product.price_clp,
    product.active,
    inventory.size,
    inventory.stock_on_hand,
    COALESCE(held.quantity, 0)::INTEGER,
    GREATEST(inventory.stock_on_hand - COALESCE(held.quantity, 0), 0)::INTEGER,
    inventory.shipping_origin_code,
    product.packaged_length_cm,
    product.packaged_width_cm,
    product.packaged_height_cm,
    product.packaged_weight_kg
  FROM public.ski_rack_inventory inventory
  JOIN public.ski_rack_products product ON product.id = inventory.rack_product_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(reservation.quantity), 0)::INTEGER AS quantity
    FROM public.inventory_reservations reservation
    WHERE reservation.rack_inventory_id = inventory.id
      AND reservation.state IN (
        'active', 'payment_processing', 'reconciliation_required'
      )
      AND (
        reservation.state <> 'active'
        OR reservation.expires_at > NOW()
      )
  ) held ON TRUE
  ORDER BY product.name, inventory.shipping_origin_code,
    CASE inventory.size WHEN 'S' THEN 1 WHEN 'M' THEN 2 ELSE 3 END;
$$;

REVOKE ALL ON FUNCTION public.commerce_rack_availability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commerce_rack_availability() TO service_role;

CREATE OR REPLACE FUNCTION public.commerce_admin_set_rack_inventory(
  p_admin_user_id UUID,
  p_items JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item RECORD;
  v_inventory public.ski_rack_inventory%ROWTYPE;
  v_reserved INTEGER;
  v_updated INTEGER := 0;
BEGIN
  IF p_items IS NULL
    OR jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) < 1
    OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'invalid inventory payload';
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items)
      AS item(inventory_id UUID, stock_on_hand INTEGER)
  LOOP
    IF v_item.inventory_id IS NULL
      OR v_item.stock_on_hand IS NULL
      OR v_item.stock_on_hand < 0
      OR v_item.stock_on_hand > 100000 THEN
      RAISE EXCEPTION 'invalid inventory quantity';
    END IF;

    SELECT * INTO v_inventory
    FROM public.ski_rack_inventory
    WHERE id = v_item.inventory_id
    FOR UPDATE;

    IF v_inventory.id IS NULL THEN
      RAISE EXCEPTION 'rack inventory variant not found';
    END IF;

    SELECT COALESCE(SUM(quantity), 0)::INTEGER INTO v_reserved
    FROM public.inventory_reservations
    WHERE rack_inventory_id = v_inventory.id
      AND state IN ('active', 'payment_processing', 'reconciliation_required')
      AND (state <> 'active' OR expires_at > NOW());

    IF v_item.stock_on_hand < v_reserved THEN
      RAISE EXCEPTION 'stock cannot be set below active reservations';
    END IF;

    IF v_inventory.stock_on_hand IS DISTINCT FROM v_item.stock_on_hand THEN
      INSERT INTO public.ski_rack_inventory_adjustments (
        inventory_id, admin_user_id, previous_stock, new_stock
      ) VALUES (
        v_inventory.id, p_admin_user_id, v_inventory.stock_on_hand,
        v_item.stock_on_hand
      );

      UPDATE public.ski_rack_inventory
      SET stock_on_hand = v_item.stock_on_hand, updated_at = NOW()
      WHERE id = v_inventory.id;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.commerce_admin_set_rack_inventory(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commerce_admin_set_rack_inventory(UUID, JSONB) TO service_role;

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
  p_allow_incomplete_shipping BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_attempt public.payment_attempts%ROWTYPE;
  v_line_count INTEGER;
  v_distinct_count INTEGER;
  v_unit_count INTEGER;
  v_matched_count INTEGER;
  v_origin_count INTEGER;
  v_origin_code TEXT;
  v_subtotal INTEGER;
  v_discount INTEGER := 0;
  v_total INTEGER;
  v_expires_at TIMESTAMPTZ;
  v_coupon TEXT;
  v_promotion public.promotions%ROWTYPE;
  v_redemption_count INTEGER;
  v_package_snapshot JSONB;
  v_shipping_rate_id UUID;
  v_shipping_service_code TEXT;
BEGIN
  IF p_items IS NULL
    OR jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) < 1
    OR jsonb_array_length(p_items) > 10 THEN
    RAISE EXCEPTION 'cart must contain between 1 and 10 rack variants';
  END IF;

  WITH requested AS (
    SELECT * FROM jsonb_to_recordset(p_items)
      AS item(slug TEXT, size TEXT, quantity INTEGER)
  )
  SELECT COUNT(*)::INTEGER,
         COUNT(DISTINCT slug || ':' || size)::INTEGER,
         COALESCE(SUM(quantity), 0)::INTEGER
  INTO v_line_count, v_distinct_count, v_unit_count
  FROM requested;

  IF v_line_count <> v_distinct_count
    OR v_unit_count < 1
    OR v_unit_count > 20
    OR EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_items)
        AS item(slug TEXT, size TEXT, quantity INTEGER)
      WHERE slug !~ '^[a-z0-9-]{2,50}$'
        OR size NOT IN ('S', 'M', 'L')
        OR quantity < 1 OR quantity > 10
    ) THEN
    RAISE EXCEPTION 'invalid rack cart';
  END IF;

  IF p_environment NOT IN ('integration', 'production')
    OR p_shipping_source NOT IN ('sandbox_fixed', 'table')
    OR p_shipping_origin_code NOT IN ('los_angeles', 'las_condes')
    OR p_delivery_method NOT IN ('home', 'pickup')
    OR p_shipping_amount_clp < 0
    OR p_reservation_minutes < 5
    OR p_reservation_minutes > 30 THEN
    RAISE EXCEPTION 'invalid checkout configuration';
  END IF;
  IF p_shipping_source = 'sandbox_fixed' AND p_environment <> 'integration' THEN
    RAISE EXCEPTION 'sandbox shipping is forbidden outside integration';
  END IF;

  IF p_request_fingerprint !~ '^[0-9a-f]{64}$'
    OR p_guest_access_hash !~ '^[0-9a-f]{64}$'
    OR char_length(p_order_number) NOT BETWEEN 6 AND 24
    OR char_length(p_buy_order) NOT BETWEEN 6 AND 26
    OR char_length(p_session_id) NOT BETWEEN 8 AND 61 THEN
    RAISE EXCEPTION 'invalid checkout identifiers';
  END IF;

  IF char_length(BTRIM(p_buyer_name)) NOT BETWEEN 2 AND 100
    OR char_length(BTRIM(p_buyer_email)) NOT BETWEEN 3 AND 254
    OR p_buyer_phone !~ '^\+[0-9]{8,15}$'
    OR char_length(BTRIM(p_shipping_region)) NOT BETWEEN 2 AND 100
    OR char_length(BTRIM(p_shipping_commune)) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'invalid buyer or destination';
  END IF;

  IF p_delivery_method = 'home' AND (
    char_length(BTRIM(COALESCE(p_shipping_street, ''))) NOT BETWEEN 2 AND 120
    OR char_length(BTRIM(COALESCE(p_shipping_number, ''))) NOT BETWEEN 1 AND 20
  ) THEN
    RAISE EXCEPTION 'home delivery requires street and number';
  END IF;

  IF p_delivery_method = 'pickup'
    AND char_length(BTRIM(COALESCE(p_pickup_point_id, ''))) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'pickup delivery requires a point';
  END IF;

  IF p_shipping_source = 'table' THEN
    SELECT rate.id, rate.service_code
    INTO v_shipping_rate_id, v_shipping_service_code
    FROM public.shipping_rates rate
    JOIN public.shipping_zones zone ON zone.id = rate.zone_id
    WHERE rate.shipping_origin_code = p_shipping_origin_code
      AND rate.handling_class = 'standard'
      -- Cada unidad viaja en su propia caja; shipping_rates.amount_clp es el
      -- valor por caja y el checkout persiste el total de todas las cajas.
      AND rate.amount_clp::BIGINT * v_unit_count
        = p_shipping_amount_clp::BIGINT
      AND rate.active = TRUE
      AND rate.valid_from <= NOW()
      AND (rate.valid_until IS NULL OR rate.valid_until > NOW())
      AND zone.active = TRUE
      AND zone.delivery_method = p_delivery_method
      AND (
        zone.region IS NULL
        OR LOWER(BTRIM(zone.region)) = LOWER(BTRIM(p_shipping_region))
      )
      AND (
        zone.commune IS NULL
        OR LOWER(BTRIM(zone.commune)) = LOWER(BTRIM(p_shipping_commune))
      )
    ORDER BY
      CASE WHEN zone.commune IS NOT NULL THEN 2
           WHEN zone.region IS NOT NULL THEN 1 ELSE 0 END DESC,
      zone.priority,
      rate.max_delivery_days NULLS LAST,
      rate.service_code
    LIMIT 1;

    IF v_shipping_rate_id IS NULL THEN
      RAISE EXCEPTION 'shipping rate is invalid or expired';
    END IF;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    SELECT * INTO v_attempt
    FROM public.payment_attempts
    WHERE order_id = v_order.id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_attempt.id IS NULL
      OR v_order.request_fingerprint <> p_request_fingerprint
      OR v_order.guest_access_hash <> p_guest_access_hash THEN
      RAISE EXCEPTION 'idempotency conflict';
    END IF;

    RETURN jsonb_build_object(
      'reused', TRUE,
      'order_id', v_order.id,
      'public_id', v_order.public_id,
      'order_number', v_order.order_number,
      'total_clp', v_order.total_clp,
      'attempt_id', v_attempt.id,
      'attempt_state', v_attempt.state,
      'buy_order', v_attempt.buy_order,
      'session_id', v_attempt.session_id,
      'token', v_attempt.transbank_token,
      'webpay_url', v_attempt.webpay_url
    );
  END IF;

  PERFORM inventory.id
  FROM public.ski_rack_inventory inventory
  JOIN public.ski_rack_products product ON product.id = inventory.rack_product_id
  JOIN jsonb_to_recordset(p_items) AS item(slug TEXT, size TEXT, quantity INTEGER)
    ON item.slug = product.slug AND item.size = inventory.size
  WHERE inventory.shipping_origin_code = p_shipping_origin_code
  ORDER BY inventory.id
  FOR UPDATE OF inventory;

  WITH requested AS (
    SELECT * FROM jsonb_to_recordset(p_items)
      AS item(slug TEXT, size TEXT, quantity INTEGER)
  ), matched AS (
    SELECT product.*, inventory.id AS inventory_id, inventory.size,
           inventory.shipping_origin_code, inventory.stock_on_hand,
           requested.quantity
    FROM requested
    JOIN public.ski_rack_products product ON product.slug = requested.slug
    JOIN public.ski_rack_inventory inventory
      ON inventory.rack_product_id = product.id AND inventory.size = requested.size
    WHERE product.active = TRUE
      AND inventory.shipping_origin_code = p_shipping_origin_code
  )
  SELECT COUNT(*)::INTEGER,
         COUNT(DISTINCT shipping_origin_code)::INTEGER,
         MIN(shipping_origin_code),
         COALESCE(SUM(price_clp * quantity), 0)::INTEGER
  INTO v_matched_count, v_origin_count, v_origin_code, v_subtotal
  FROM matched;

  IF v_matched_count <> v_line_count THEN
    RAISE EXCEPTION 'one or more rack variants are unavailable';
  END IF;
  IF v_origin_count <> 1
    OR v_origin_code IS NULL
    OR v_origin_code <> p_shipping_origin_code THEN
    RAISE EXCEPTION 'rack origin is unavailable';
  END IF;

  IF EXISTS (
    WITH requested AS (
      SELECT * FROM jsonb_to_recordset(p_items)
        AS item(slug TEXT, size TEXT, quantity INTEGER)
    )
    SELECT 1
    FROM requested
    JOIN public.ski_rack_products product ON product.slug = requested.slug
    JOIN public.ski_rack_inventory inventory
      ON inventory.rack_product_id = product.id AND inventory.size = requested.size
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(reservation.quantity), 0)::INTEGER AS quantity
      FROM public.inventory_reservations reservation
      WHERE reservation.rack_inventory_id = inventory.id
        AND reservation.state IN ('active', 'payment_processing', 'reconciliation_required')
        AND (reservation.state <> 'active' OR reservation.expires_at > NOW())
    ) held ON TRUE
    WHERE inventory.shipping_origin_code = p_shipping_origin_code
      AND inventory.stock_on_hand - held.quantity < requested.quantity
  ) THEN
    RAISE EXCEPTION 'insufficient rack stock';
  END IF;

  IF NOT p_allow_incomplete_shipping AND EXISTS (
    WITH requested AS (
      SELECT * FROM jsonb_to_recordset(p_items)
        AS item(slug TEXT, size TEXT, quantity INTEGER)
    )
    SELECT 1 FROM requested
    JOIN public.ski_rack_products product ON product.slug = requested.slug
    WHERE product.packaged_length_cm IS NULL
      OR product.packaged_width_cm IS NULL
      OR product.packaged_height_cm IS NULL
      OR product.packaged_weight_kg IS NULL
  ) THEN
    RAISE EXCEPTION 'package dimensions are required';
  END IF;

  v_coupon := NULLIF(UPPER(BTRIM(COALESCE(p_coupon_code, ''))), '');
  IF v_coupon IS NOT NULL THEN
    SELECT * INTO v_promotion
    FROM public.promotions
    WHERE environment = p_environment
      AND code = v_coupon
      AND active = TRUE
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at > NOW())
    FOR UPDATE;

    IF NOT FOUND OR v_subtotal < v_promotion.min_subtotal_clp THEN
      RAISE EXCEPTION 'coupon is invalid or unavailable';
    END IF;

    SELECT COUNT(*)::INTEGER INTO v_redemption_count
    FROM public.promotion_redemptions
    WHERE promotion_id = v_promotion.id AND state IN ('reserved', 'consumed');

    IF v_promotion.global_limit IS NOT NULL
      AND v_redemption_count >= v_promotion.global_limit THEN
      RAISE EXCEPTION 'coupon usage limit reached';
    END IF;

    IF v_promotion.discount_type = 'percent' THEN
      v_discount := FLOOR(v_subtotal * v_promotion.value / 100.0)::INTEGER;
      IF v_promotion.max_discount_clp IS NOT NULL THEN
        v_discount := LEAST(v_discount, v_promotion.max_discount_clp);
      END IF;
    ELSIF v_promotion.discount_type = 'fixed' THEN
      v_discount := LEAST(v_promotion.value, v_subtotal);
    ELSIF v_promotion.discount_type = 'free_shipping' THEN
      p_shipping_amount_clp := 0;
    END IF;
  END IF;

  v_total := v_subtotal - v_discount + p_shipping_amount_clp;
  IF v_total <= 0 THEN RAISE EXCEPTION 'checkout total must be positive'; END IF;
  v_expires_at := NOW() + make_interval(mins => p_reservation_minutes);

  INSERT INTO public.orders (
    order_number, buyer_user_id, buyer_email, buyer_name, buyer_phone,
    delivery_method, shipping_snapshot, subtotal_clp, discount_clp,
    shipping_clp, total_clp, idempotency_key, request_fingerprint,
    guest_access_hash, expires_at
  ) VALUES (
    p_order_number, p_buyer_user_id, LOWER(BTRIM(p_buyer_email)),
    BTRIM(p_buyer_name), p_buyer_phone, p_delivery_method,
    jsonb_strip_nulls(jsonb_build_object(
      'region', BTRIM(p_shipping_region),
      'commune', BTRIM(p_shipping_commune),
      'street', NULLIF(BTRIM(COALESCE(p_shipping_street, '')), ''),
      'number', NULLIF(BTRIM(COALESCE(p_shipping_number, '')), ''),
      'extra', NULLIF(BTRIM(COALESCE(p_shipping_extra, '')), ''),
      'pickup_point_id', NULLIF(BTRIM(COALESCE(p_pickup_point_id, '')), '')
    )),
    v_subtotal, v_discount, p_shipping_amount_clp, v_total,
    p_idempotency_key, p_request_fingerprint, p_guest_access_hash, v_expires_at
  ) RETURNING * INTO v_order;

  INSERT INTO public.order_items (
    order_id, product_id, rack_inventory_id, sku, product_name, product_type,
    unit_price_clp, quantity, line_total_clp, shipping_origin_code,
    package_snapshot
  )
  SELECT
    v_order.id, NULL, inventory.id,
    UPPER('RACK-' || product.slug || '-' || inventory.size),
    product.name || ' · Talla ' || inventory.size,
    'ski_rack', product.price_clp, requested.quantity,
    product.price_clp * requested.quantity, inventory.shipping_origin_code,
    jsonb_strip_nulls(jsonb_build_object(
      'length_cm', product.packaged_length_cm,
      'width_cm', product.packaged_width_cm,
      'height_cm', product.packaged_height_cm,
      'weight_kg', product.packaged_weight_kg,
      'rack_slug', product.slug,
      'size', inventory.size
    ))
  FROM jsonb_to_recordset(p_items)
    AS requested(slug TEXT, size TEXT, quantity INTEGER)
  JOIN public.ski_rack_products product ON product.slug = requested.slug
  JOIN public.ski_rack_inventory inventory
    ON inventory.rack_product_id = product.id AND inventory.size = requested.size
    AND inventory.shipping_origin_code = p_shipping_origin_code;

  INSERT INTO public.inventory_reservations (
    order_id, product_id, rack_inventory_id, quantity, expires_at
  )
  SELECT v_order.id, NULL, inventory.id, requested.quantity, v_expires_at
  FROM jsonb_to_recordset(p_items)
    AS requested(slug TEXT, size TEXT, quantity INTEGER)
  JOIN public.ski_rack_products product ON product.slug = requested.slug
  JOIN public.ski_rack_inventory inventory
    ON inventory.rack_product_id = product.id AND inventory.size = requested.size
    AND inventory.shipping_origin_code = p_shipping_origin_code;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'rack_inventory_id', item.rack_inventory_id,
    'quantity', item.quantity,
    'package', item.package_snapshot
  ) ORDER BY item.rack_inventory_id), '[]'::JSONB)
  INTO v_package_snapshot
  FROM public.order_items item WHERE item.order_id = v_order.id;

  INSERT INTO public.shipping_quotes (
    order_id, source, shipping_origin_code, delivery_method,
    destination_region, destination_commune, service_code, rate_version,
    amount_clp, package_snapshot, expires_at
  ) VALUES (
    v_order.id, p_shipping_source, v_origin_code, p_delivery_method,
    BTRIM(p_shipping_region), BTRIM(p_shipping_commune),
    CASE
      WHEN p_shipping_source = 'sandbox_fixed' THEN 'SANDBOX'
      ELSE v_shipping_service_code
    END,
    CASE
      WHEN p_shipping_source = 'sandbox_fixed' THEN 'integration-explicit-v1'
      ELSE 'shipping-rate:' || v_shipping_rate_id::TEXT
    END,
    p_shipping_amount_clp, v_package_snapshot, v_expires_at
  );

  IF v_coupon IS NOT NULL THEN
    INSERT INTO public.promotion_redemptions (
      promotion_id, order_id, buyer_key, discount_clp
    ) VALUES (
      v_promotion.id, v_order.id, LOWER(BTRIM(p_buyer_email)), v_discount
    );
  END IF;

  INSERT INTO public.payment_attempts (
    order_id, environment, amount_clp, buy_order, session_id
  ) VALUES (
    v_order.id, p_environment, v_total, p_buy_order, p_session_id
  ) RETURNING * INTO v_attempt;

  INSERT INTO public.payment_events (
    payment_attempt_id, order_id, event_type, to_state, actor, metadata
  ) VALUES (
    v_attempt.id, v_order.id, 'checkout_created', 'created', 'buyer',
    jsonb_build_object(
      'environment', p_environment,
      'rack_variant_count', v_line_count,
      'unit_count', v_unit_count,
      'shipping_source', p_shipping_source
    )
  );

  RETURN jsonb_build_object(
    'reused', FALSE,
    'order_id', v_order.id,
    'public_id', v_order.public_id,
    'order_number', v_order.order_number,
    'total_clp', v_order.total_clp,
    'attempt_id', v_attempt.id,
    'attempt_state', v_attempt.state,
    'buy_order', v_attempt.buy_order,
    'session_id', v_attempt.session_id,
    'token', NULL,
    'webpay_url', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.commerce_create_rack_checkout(
  JSONB, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commerce_create_rack_checkout(
  JSONB, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN
) TO service_role;

-- Todos los procesos de pago toman bloqueos en el mismo orden. Las variantes
-- de rack se bloquean antes que sus reservas para evitar sobreventa entre el
-- checkout, el callback de Webpay, el reconciliador y el editor de inventario.
CREATE OR REPLACE FUNCTION public.commerce_lock_order_payment_rows(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM product.id
  FROM public.order_items item
  JOIN public.products product ON product.id = item.product_id
  WHERE item.order_id = p_order_id
  ORDER BY product.id
  FOR UPDATE OF product;

  PERFORM inventory.id
  FROM public.order_items item
  JOIN public.ski_rack_inventory inventory
    ON inventory.id = item.rack_inventory_id
  WHERE item.order_id = p_order_id
  ORDER BY inventory.id
  FOR UPDATE OF inventory;

  PERFORM reservation.id
  FROM public.inventory_reservations reservation
  WHERE reservation.order_id = p_order_id
  ORDER BY COALESCE(
    reservation.product_id::TEXT,
    reservation.rack_inventory_id::TEXT
  )
  FOR UPDATE;

  PERFORM orders.id
  FROM public.orders orders
  WHERE orders.id = p_order_id
  FOR UPDATE;
END;
$$;

-- Webpay autorizado consume la reserva y descuenta las unidades del rack. Un
-- rechazo, aborto o expiración solo libera la reserva; nunca toca stock físico.
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

REVOKE ALL ON FUNCTION public.commerce_lock_order_payment_rows(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_finalize_webpay(
  UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT,
  TIMESTAMPTZ, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commerce_finalize_webpay(
  UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT,
  TIMESTAMPTZ, UUID
) TO service_role;

COMMIT;
