-- ReskiChile commerce + Webpay Plus foundation.
-- Apply through the Supabase migration workflow, never by pasting fragments.
-- This migration creates server-only financial tables and atomic RPCs.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Existing products become sellable inventory only after an administrator
-- explicitly configures ownership, origin and (outside sandbox) package data.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS commerce_owned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shipping_origin_code TEXT,
  ADD COLUMN IF NOT EXISTS packaged_length_cm NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS packaged_width_cm NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS packaged_height_cm NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS packaged_weight_kg NUMERIC(8,3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_shipping_origin_code_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_shipping_origin_code_check
      CHECK (
        shipping_origin_code IS NULL
        OR shipping_origin_code IN ('los_angeles', 'las_condes')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_package_dimensions_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_package_dimensions_check
      CHECK (
        (packaged_length_cm IS NULL OR packaged_length_cm > 0)
        AND (packaged_width_cm IS NULL OR packaged_width_cm > 0)
        AND (packaged_height_cm IS NULL OR packaged_height_cm > 0)
        AND (packaged_weight_kg IS NULL OR packaged_weight_kg > 0)
      );
  END IF;
END
$$;

-- Browser roles may keep editing ordinary listing fields, but only trusted
-- server code may turn a listing into store-owned inventory or alter its
-- fulfillment profile.
CREATE OR REPLACE FUNCTION public.commerce_protect_product_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' AND (
      NEW.commerce_owned
      OR NEW.shipping_origin_code IS NOT NULL
      OR NEW.packaged_length_cm IS NOT NULL
      OR NEW.packaged_width_cm IS NOT NULL
      OR NEW.packaged_height_cm IS NOT NULL
      OR NEW.packaged_weight_kg IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'commerce fields require a trusted server operation';
    END IF;
    IF TG_OP = 'UPDATE' AND (
      NEW.commerce_owned IS DISTINCT FROM OLD.commerce_owned
      OR NEW.shipping_origin_code IS DISTINCT FROM OLD.shipping_origin_code
      OR NEW.packaged_length_cm IS DISTINCT FROM OLD.packaged_length_cm
      OR NEW.packaged_width_cm IS DISTINCT FROM OLD.packaged_width_cm
      OR NEW.packaged_height_cm IS DISTINCT FROM OLD.packaged_height_cm
      OR NEW.packaged_weight_kg IS DISTINCT FROM OLD.packaged_weight_kg
      OR (
        OLD.commerce_owned AND (
          NEW.seller_id IS DISTINCT FROM OLD.seller_id
          OR NEW.product_type IS DISTINCT FROM OLD.product_type
          OR NEW.brand IS DISTINCT FROM OLD.brand
          OR NEW.model IS DISTINCT FROM OLD.model
          OR NEW.price IS DISTINCT FROM OLD.price
          OR NEW.status IS DISTINCT FROM OLD.status
        )
      )
    ) THEN
      RAISE EXCEPTION 'commerce fields require a trusted server operation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_protect_commerce_fields ON public.products;
CREATE TRIGGER products_protect_commerce_fields
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.commerce_protect_product_fields();

-- The legacy profile policy permits owners to update their own row. Guard the
-- authorization bit at the database boundary so a buyer cannot promote itself.
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_protect_admin_role ON public.users;
CREATE TRIGGER users_protect_admin_role
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.commerce_protect_user_admin_role();

CREATE TABLE IF NOT EXISTS public.shipping_origins (
  code TEXT PRIMARY KEY CHECK (code IN ('los_angeles', 'las_condes')),
  display_name TEXT NOT NULL,
  region TEXT NOT NULL,
  commune TEXT NOT NULL,
  coverage_code TEXT,
  operational_address JSONB,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.shipping_origins (code, display_name, region, commune)
VALUES
  ('los_angeles', 'Los Ángeles', 'Región del Biobío', 'Los Ángeles'),
  ('las_condes', 'Las Condes', 'Región Metropolitana', 'Las Condes')
ON CONFLICT (code) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  region = EXCLUDED.region,
  commune = EXCLUDED.commune;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_shipping_origin_code_fkey'
      AND conrelid = 'public.products'::REGCLASS
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_shipping_origin_code_fkey
      FOREIGN KEY (shipping_origin_code)
      REFERENCES public.shipping_origins(code);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  order_number VARCHAR(24) NOT NULL UNIQUE,
  buyer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_email TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('home', 'pickup')),
  shipping_snapshot JSONB NOT NULL,
  order_status TEXT NOT NULL DEFAULT 'awaiting_payment'
    CHECK (order_status IN (
      'awaiting_payment', 'paid', 'cancelled', 'expired',
      'preparing', 'ready_for_pickup', 'shipped', 'completed'
    )),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN (
      'pending', 'authorized', 'rejected', 'aborted', 'expired',
      'reconciliation_required', 'partially_refunded', 'refunded'
    )),
  fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled'
    CHECK (fulfillment_status IN (
      'unfulfilled', 'pending', 'preparing', 'ready_for_pickup',
      'shipped', 'delivered', 'cancelled'
    )),
  currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency = 'CLP'),
  subtotal_clp INTEGER NOT NULL CHECK (subtotal_clp >= 0),
  discount_clp INTEGER NOT NULL DEFAULT 0 CHECK (discount_clp >= 0),
  shipping_clp INTEGER NOT NULL DEFAULT 0 CHECK (shipping_clp >= 0),
  total_clp INTEGER NOT NULL CHECK (total_clp > 0),
  idempotency_key UUID NOT NULL UNIQUE,
  request_fingerprint CHAR(64) NOT NULL,
  guest_access_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT orders_total_check
    CHECK (total_clp = subtotal_clp - discount_clp + shipping_clp),
  CONSTRAINT orders_buyer_email_length_check
    CHECK (char_length(buyer_email) BETWEEN 3 AND 254),
  CONSTRAINT orders_buyer_name_length_check
    CHECK (char_length(buyer_name) BETWEEN 2 AND 100),
  CONSTRAINT orders_buyer_phone_format_check
    CHECK (buyer_phone ~ '^\+[0-9]{8,15}$'),
  CONSTRAINT orders_fingerprint_format_check
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT orders_guest_hash_format_check
    CHECK (guest_access_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  sku TEXT,
  product_name TEXT NOT NULL,
  product_type TEXT NOT NULL,
  unit_price_clp INTEGER NOT NULL CHECK (unit_price_clp > 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity = 1),
  line_total_clp INTEGER NOT NULL CHECK (line_total_clp = unit_price_clp),
  shipping_origin_code TEXT NOT NULL REFERENCES public.shipping_origins(code),
  package_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity = 1),
  state TEXT NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'consumed', 'released', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  release_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, product_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_one_active_reservation_per_product
  ON public.inventory_reservations (product_id)
  WHERE state = 'active';

CREATE INDEX IF NOT EXISTS inventory_reservations_order_idx
  ON public.inventory_reservations (order_id);

CREATE INDEX IF NOT EXISTS inventory_reservations_expiry_idx
  ON public.inventory_reservations (expires_at)
  WHERE state = 'active';

CREATE TABLE IF NOT EXISTS public.shipping_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  source TEXT NOT NULL CHECK (source IN ('sandbox_fixed', 'table', 'chilexpress')),
  shipping_origin_code TEXT NOT NULL REFERENCES public.shipping_origins(code),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('home', 'pickup')),
  destination_region TEXT NOT NULL,
  destination_commune TEXT NOT NULL,
  provider_quote_id TEXT,
  service_code TEXT,
  rate_version TEXT,
  amount_clp INTEGER NOT NULL CHECK (amount_clp >= 0),
  package_snapshot JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL DEFAULT 'selected'
    CHECK (state IN ('selected', 'consumed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  region TEXT,
  commune TEXT,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('home', 'pickup')),
  priority INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_origin_code TEXT NOT NULL REFERENCES public.shipping_origins(code),
  zone_id UUID NOT NULL REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
  handling_class TEXT NOT NULL DEFAULT 'standard',
  service_code TEXT NOT NULL,
  amount_clp INTEGER NOT NULL CHECK (amount_clp >= 0),
  min_delivery_days INTEGER CHECK (min_delivery_days IS NULL OR min_delivery_days >= 0),
  max_delivery_days INTEGER CHECK (
    max_delivery_days IS NULL
    OR (
      max_delivery_days >= 0
      AND (min_delivery_days IS NULL OR max_delivery_days >= min_delivery_days)
    )
  ),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  source_note TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shipping_origin_code, zone_id, handling_class, service_code, valid_from)
);

CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('integration', 'production')),
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed', 'free_shipping')),
  value INTEGER NOT NULL CHECK (value > 0),
  max_discount_clp INTEGER CHECK (max_discount_clp IS NULL OR max_discount_clp > 0),
  min_subtotal_clp INTEGER NOT NULL DEFAULT 0 CHECK (min_subtotal_clp >= 0),
  global_limit INTEGER CHECK (global_limit IS NULL OR global_limit > 0),
  active BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (environment, code),
  CHECK (code = UPPER(BTRIM(code)))
);

INSERT INTO public.promotions (
  code,
  environment,
  discount_type,
  value,
  max_discount_clp,
  min_subtotal_clp,
  global_limit,
  active
)
VALUES ('WELCOME10', 'integration', 'percent', 10, 10000, 0, 100, TRUE)
ON CONFLICT (environment, code) DO UPDATE
SET
  discount_type = EXCLUDED.discount_type,
  value = EXCLUDED.value,
  max_discount_clp = EXCLUDED.max_discount_clp,
  min_subtotal_clp = EXCLUDED.min_subtotal_clp,
  global_limit = EXCLUDED.global_limit;

CREATE TABLE IF NOT EXISTS public.promotion_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  buyer_key TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'reserved'
    CHECK (state IN ('reserved', 'consumed', 'released')),
  discount_clp INTEGER NOT NULL CHECK (discount_clp >= 0),
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  UNIQUE (promotion_id, order_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS promotions_one_live_redemption_per_buyer
  ON public.promotion_redemptions (promotion_id, buyer_key)
  WHERE state IN ('reserved', 'consumed');

CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'webpay_plus' CHECK (provider = 'webpay_plus'),
  environment TEXT NOT NULL CHECK (environment IN ('integration', 'production')),
  state TEXT NOT NULL DEFAULT 'created'
    CHECK (state IN (
      'created', 'initialized', 'initialization_failed', 'processing',
      'authorized', 'rejected', 'aborted', 'expired',
      'reconciliation_required'
    )),
  amount_clp INTEGER NOT NULL CHECK (amount_clp > 0),
  currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency = 'CLP'),
  buy_order VARCHAR(26) NOT NULL UNIQUE,
  session_id VARCHAR(61) NOT NULL UNIQUE,
  transbank_token TEXT,
  webpay_url TEXT,
  tbk_status TEXT,
  response_code INTEGER,
  authorization_code TEXT,
  payment_type_code TEXT,
  installments_number INTEGER,
  card_last_four CHAR(4),
  transaction_date TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  authorized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_attempts_card_last_four_check
    CHECK (card_last_four IS NULL OR card_last_four ~ '^[0-9]{4}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_token_unique
  ON public.payment_attempts (transbank_token)
  WHERE transbank_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_one_authorized_per_order
  ON public.payment_attempts (order_id)
  WHERE state = 'authorized';

CREATE INDEX IF NOT EXISTS payment_attempts_order_idx
  ON public.payment_attempts (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_attempt_id UUID REFERENCES public.payment_attempts(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  actor TEXT NOT NULL DEFAULT 'system' CHECK (actor IN ('system', 'buyer', 'admin')),
  correlation_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_events_order_idx
  ON public.payment_events (order_id, created_at);

CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  payment_attempt_id UUID NOT NULL REFERENCES public.payment_attempts(id) ON DELETE RESTRICT,
  amount_clp INTEGER NOT NULL CHECK (amount_clp > 0),
  state TEXT NOT NULL DEFAULT 'requested'
    CHECK (state IN ('requested', 'processing', 'succeeded', 'failed', 'uncertain')),
  reason TEXT NOT NULL,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  idempotency_key UUID NOT NULL UNIQUE,
  provider_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.checkout_rate_limits (
  key_hash CHAR(64) NOT NULL,
  window_bucket BIGINT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key_hash, window_bucket)
);

-- All commerce and financial tables are server-only. No browser policy is
-- intentionally created. service_role bypasses RLS.
ALTER TABLE public.shipping_origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.shipping_origins FROM anon, authenticated;
REVOKE ALL ON public.orders FROM anon, authenticated;
REVOKE ALL ON public.order_items FROM anon, authenticated;
REVOKE ALL ON public.inventory_reservations FROM anon, authenticated;
REVOKE ALL ON public.shipping_quotes FROM anon, authenticated;
REVOKE ALL ON public.shipping_zones FROM anon, authenticated;
REVOKE ALL ON public.shipping_rates FROM anon, authenticated;
REVOKE ALL ON public.promotions FROM anon, authenticated;
REVOKE ALL ON public.promotion_redemptions FROM anon, authenticated;
REVOKE ALL ON public.payment_attempts FROM anon, authenticated;
REVOKE ALL ON public.payment_events FROM anon, authenticated;
REVOKE ALL ON public.refunds FROM anon, authenticated;
REVOKE ALL ON public.checkout_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.commerce_consume_rate_limit(
  p_key_hash TEXT,
  p_window_seconds INTEGER,
  p_limit INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bucket BIGINT;
  v_count INTEGER;
BEGIN
  IF p_key_hash !~ '^[0-9a-f]{64}$'
    OR p_window_seconds < 1
    OR p_window_seconds > 86400
    OR p_limit < 1
    OR p_limit > 1000 THEN
    RAISE EXCEPTION 'invalid rate limit input';
  END IF;

  v_bucket := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) / p_window_seconds);

  INSERT INTO public.checkout_rate_limits (
    key_hash,
    window_bucket,
    request_count,
    updated_at
  )
  VALUES (p_key_hash, v_bucket, 1, NOW())
  ON CONFLICT (key_hash, window_bucket)
  DO UPDATE SET
    request_count = public.checkout_rate_limits.request_count + 1,
    updated_at = NOW()
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_limit;
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
  v_product_count INTEGER;
  v_distinct_count INTEGER;
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
  v_expired_order_ids UUID[];
BEGIN
  IF p_product_ids IS NULL
    OR cardinality(p_product_ids) < 1
    OR cardinality(p_product_ids) > 10 THEN
    RAISE EXCEPTION 'cart must contain between 1 and 10 products';
  END IF;

  SELECT COUNT(DISTINCT product_id)
  INTO v_distinct_count
  FROM unnest(p_product_ids) AS u(product_id);

  IF v_distinct_count <> cardinality(p_product_ids) THEN
    RAISE EXCEPTION 'cart contains duplicate products';
  END IF;

  IF p_environment NOT IN ('integration', 'production')
    OR p_shipping_source NOT IN ('sandbox_fixed', 'table', 'chilexpress')
    OR p_delivery_method NOT IN ('home', 'pickup')
    OR p_shipping_amount_clp < 0
    OR p_reservation_minutes < 5
    OR p_reservation_minutes > 30 THEN
    RAISE EXCEPTION 'invalid checkout configuration';
  END IF;

  IF p_request_fingerprint !~ '^[0-9a-f]{64}$'
    OR p_guest_access_hash !~ '^[0-9a-f]{64}$'
    OR char_length(p_order_number) < 6
    OR char_length(p_order_number) > 24
    OR char_length(p_buy_order) < 6
    OR char_length(p_buy_order) > 26
    OR char_length(p_session_id) < 8
    OR char_length(p_session_id) > 61 THEN
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

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    SELECT *
    INTO v_attempt
    FROM public.payment_attempts
    WHERE order_id = v_order.id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_attempt.id IS NULL THEN
      RAISE EXCEPTION 'idempotent checkout has no payment attempt';
    END IF;

    IF v_order.request_fingerprint <> p_request_fingerprint THEN
      RAISE EXCEPTION 'idempotency key reused with different checkout';
    END IF;

    IF v_order.guest_access_hash <> p_guest_access_hash THEN
      RAISE EXCEPTION 'idempotency key reused without matching guest access';
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

  PERFORM p.id
  FROM public.products p
  WHERE p.id = ANY(p_product_ids)
  ORDER BY p.id
  FOR UPDATE;

  WITH expired AS (
    UPDATE public.inventory_reservations
    SET
      state = 'expired',
      released_at = NOW(),
      release_reason = 'reservation_expired',
      updated_at = NOW()
    WHERE product_id = ANY(p_product_ids)
      AND state = 'active'
      AND expires_at <= NOW()
    RETURNING order_id
  )
  SELECT ARRAY_AGG(DISTINCT order_id)
  INTO v_expired_order_ids
  FROM expired;

  IF v_expired_order_ids IS NOT NULL THEN
    UPDATE public.orders
    SET
      order_status = 'expired',
      payment_status = 'expired',
      fulfillment_status = 'cancelled',
      updated_at = NOW()
    WHERE id = ANY(v_expired_order_ids)
      AND order_status = 'awaiting_payment';

    UPDATE public.payment_attempts
    SET state = 'expired', updated_at = NOW()
    WHERE order_id = ANY(v_expired_order_ids)
      AND state IN ('created', 'initialized');

    UPDATE public.shipping_quotes
    SET state = 'expired'
    WHERE order_id = ANY(v_expired_order_ids)
      AND state = 'selected';

    UPDATE public.promotion_redemptions
    SET state = 'released', released_at = NOW()
    WHERE order_id = ANY(v_expired_order_ids)
      AND state = 'reserved';
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(DISTINCT p.shipping_origin_code)::INTEGER,
    MIN(p.shipping_origin_code),
    COALESCE(SUM(p.price), 0)::INTEGER
  INTO
    v_product_count,
    v_origin_count,
    v_origin_code,
    v_subtotal
  FROM public.products p
  WHERE p.id = ANY(p_product_ids)
    AND p.status = 'approved'
    AND p.commerce_owned = TRUE
    AND p.shipping_origin_code IS NOT NULL;

  IF v_product_count <> cardinality(p_product_ids) THEN
    RAISE EXCEPTION 'one or more products are unavailable';
  END IF;

  IF v_origin_count <> 1 OR v_origin_code IS NULL THEN
    RAISE EXCEPTION 'initial checkout requires products from one configured origin';
  END IF;

  IF NOT p_allow_incomplete_shipping AND EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = ANY(p_product_ids)
      AND (
        p.packaged_length_cm IS NULL
        OR p.packaged_width_cm IS NULL
        OR p.packaged_height_cm IS NULL
        OR p.packaged_weight_kg IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'package dimensions are required';
  END IF;

  v_coupon := NULLIF(UPPER(BTRIM(COALESCE(p_coupon_code, ''))), '');

  IF v_coupon IS NOT NULL THEN
    SELECT *
    INTO v_promotion
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

    SELECT COUNT(*)::INTEGER
    INTO v_redemption_count
    FROM public.promotion_redemptions
    WHERE promotion_id = v_promotion.id
      AND state IN ('reserved', 'consumed');

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
      v_discount := 0;
      p_shipping_amount_clp := 0;
    END IF;
  END IF;

  v_total := v_subtotal - v_discount + p_shipping_amount_clp;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'checkout total must be positive';
  END IF;

  v_expires_at := NOW() + make_interval(mins => p_reservation_minutes);

  INSERT INTO public.orders (
    order_number,
    buyer_user_id,
    buyer_email,
    buyer_name,
    buyer_phone,
    delivery_method,
    shipping_snapshot,
    subtotal_clp,
    discount_clp,
    shipping_clp,
    total_clp,
    idempotency_key,
    request_fingerprint,
    guest_access_hash,
    expires_at
  )
  VALUES (
    p_order_number,
    p_buyer_user_id,
    LOWER(BTRIM(p_buyer_email)),
    BTRIM(p_buyer_name),
    p_buyer_phone,
    p_delivery_method,
    jsonb_strip_nulls(jsonb_build_object(
      'region', BTRIM(p_shipping_region),
      'commune', BTRIM(p_shipping_commune),
      'street', NULLIF(BTRIM(COALESCE(p_shipping_street, '')), ''),
      'number', NULLIF(BTRIM(COALESCE(p_shipping_number, '')), ''),
      'extra', NULLIF(BTRIM(COALESCE(p_shipping_extra, '')), ''),
      'pickup_point_id', NULLIF(BTRIM(COALESCE(p_pickup_point_id, '')), '')
    )),
    v_subtotal,
    v_discount,
    p_shipping_amount_clp,
    v_total,
    p_idempotency_key,
    p_request_fingerprint,
    p_guest_access_hash,
    v_expires_at
  )
  RETURNING * INTO v_order;

  INSERT INTO public.order_items (
    order_id,
    product_id,
    product_name,
    product_type,
    unit_price_clp,
    quantity,
    line_total_clp,
    shipping_origin_code,
    package_snapshot
  )
  SELECT
    v_order.id,
    p.id,
    BTRIM(CONCAT_WS(' ', p.brand, p.model)),
    p.product_type,
    p.price,
    1,
    p.price,
    p.shipping_origin_code,
    jsonb_strip_nulls(jsonb_build_object(
      'length_cm', p.packaged_length_cm,
      'width_cm', p.packaged_width_cm,
      'height_cm', p.packaged_height_cm,
      'weight_kg', p.packaged_weight_kg
    ))
  FROM public.products p
  WHERE p.id = ANY(p_product_ids);

  INSERT INTO public.inventory_reservations (
    order_id,
    product_id,
    quantity,
    expires_at
  )
  SELECT v_order.id, p.id, 1, v_expires_at
  FROM public.products p
  WHERE p.id = ANY(p_product_ids);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', oi.product_id,
        'package', oi.package_snapshot
      )
      ORDER BY oi.product_id
    ),
    '[]'::JSONB
  )
  INTO v_package_snapshot
  FROM public.order_items oi
  WHERE oi.order_id = v_order.id;

  INSERT INTO public.shipping_quotes (
    order_id,
    source,
    shipping_origin_code,
    delivery_method,
    destination_region,
    destination_commune,
    service_code,
    rate_version,
    amount_clp,
    package_snapshot,
    expires_at
  )
  VALUES (
    v_order.id,
    p_shipping_source,
    v_origin_code,
    p_delivery_method,
    BTRIM(p_shipping_region),
    BTRIM(p_shipping_commune),
    CASE WHEN p_shipping_source = 'sandbox_fixed' THEN 'SANDBOX' ELSE NULL END,
    CASE WHEN p_shipping_source = 'sandbox_fixed' THEN 'integration-v1' ELSE NULL END,
    p_shipping_amount_clp,
    v_package_snapshot,
    v_expires_at
  );

  IF v_coupon IS NOT NULL THEN
    INSERT INTO public.promotion_redemptions (
      promotion_id,
      order_id,
      buyer_key,
      discount_clp
    )
    VALUES (
      v_promotion.id,
      v_order.id,
      LOWER(BTRIM(p_buyer_email)),
      v_discount
    );
  END IF;

  INSERT INTO public.payment_attempts (
    order_id,
    environment,
    amount_clp,
    buy_order,
    session_id
  )
  VALUES (
    v_order.id,
    p_environment,
    v_total,
    p_buy_order,
    p_session_id
  )
  RETURNING * INTO v_attempt;

  INSERT INTO public.payment_events (
    payment_attempt_id,
    order_id,
    event_type,
    to_state,
    actor,
    metadata
  )
  VALUES (
    v_attempt.id,
    v_order.id,
    'checkout_created',
    'created',
    'buyer',
    jsonb_build_object(
      'environment', p_environment,
      'product_count', cardinality(p_product_ids),
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

CREATE OR REPLACE FUNCTION public.commerce_store_webpay_initialization(
  p_attempt_id UUID,
  p_token TEXT,
  p_webpay_url TEXT,
  p_correlation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  IF char_length(p_token) NOT BETWEEN 10 AND 128
    OR char_length(p_webpay_url) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'invalid Webpay initialization';
  END IF;

  UPDATE public.payment_attempts
  SET
    state = 'initialized',
    transbank_token = p_token,
    webpay_url = p_webpay_url,
    updated_at = NOW()
  WHERE id = p_attempt_id
    AND state = 'created'
  RETURNING order_id INTO v_order_id;

  IF v_order_id IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.payment_events (
    payment_attempt_id,
    order_id,
    event_type,
    from_state,
    to_state,
    correlation_id
  )
  VALUES (
    p_attempt_id,
    v_order_id,
    'webpay_initialized',
    'created',
    'initialized',
    p_correlation_id
  );

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_fail_webpay_initialization(
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
BEGIN
  UPDATE public.payment_attempts
  SET
    state = 'initialization_failed',
    updated_at = NOW()
  WHERE id = p_attempt_id
    AND state = 'created'
  RETURNING order_id INTO v_order_id;

  IF v_order_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.orders
  SET
    order_status = 'cancelled',
    payment_status = 'rejected',
    updated_at = NOW()
  WHERE id = v_order_id
    AND order_status = 'awaiting_payment';

  UPDATE public.inventory_reservations
  SET
    state = 'released',
    released_at = NOW(),
    release_reason = 'initialization_failed',
    updated_at = NOW()
  WHERE order_id = v_order_id
    AND state = 'active';

  UPDATE public.promotion_redemptions
  SET
    state = 'released',
    released_at = NOW()
  WHERE order_id = v_order_id
    AND state = 'reserved';

  INSERT INTO public.payment_events (
    payment_attempt_id,
    order_id,
    event_type,
    from_state,
    to_state,
    correlation_id,
    metadata
  )
  VALUES (
    p_attempt_id,
    v_order_id,
    'webpay_initialization_failed',
    'created',
    'initialization_failed',
    p_correlation_id,
    jsonb_build_object('reason', LEFT(COALESCE(p_reason, 'unknown'), 120))
  );

  RETURN TRUE;
END;
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
  v_public_id UUID;
BEGIN
  UPDATE public.payment_attempts
  SET
    state = 'processing',
    processing_started_at = NOW(),
    updated_at = NOW()
  WHERE transbank_token = p_token
    AND state = 'initialized'
  RETURNING * INTO v_attempt;

  IF v_attempt.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT public_id
  INTO v_public_id
  FROM public.orders
  WHERE id = v_attempt.order_id;

  INSERT INTO public.payment_events (
    payment_attempt_id,
    order_id,
    event_type,
    from_state,
    to_state,
    correlation_id
  )
  VALUES (
    v_attempt.id,
    v_attempt.order_id,
    'webpay_processing_claimed',
    'initialized',
    'processing',
    p_correlation_id
  );

  RETURN jsonb_build_object(
    'attempt_id', v_attempt.id,
    'order_id', v_attempt.order_id,
    'public_id', v_public_id,
    'amount_clp', v_attempt.amount_clp,
    'buy_order', v_attempt.buy_order,
    'session_id', v_attempt.session_id,
    'state', v_attempt.state
  );
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
  v_from_state TEXT;
  v_item_count INTEGER;
  v_active_reservation_count INTEGER;
  v_effective_outcome TEXT;
BEGIN
  IF p_outcome NOT IN (
    'authorized', 'rejected', 'aborted', 'expired', 'reconciliation_required'
  ) THEN
    RAISE EXCEPTION 'invalid payment outcome';
  END IF;

  SELECT *
  INTO v_attempt
  FROM public.payment_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF v_attempt.id IS NULL THEN
    RAISE EXCEPTION 'payment attempt not found';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = v_attempt.order_id
  FOR UPDATE;

  IF v_attempt.state IN ('authorized', 'rejected', 'aborted', 'expired') THEN
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
    PERFORM id
    FROM public.inventory_reservations
    WHERE order_id = v_order.id
    ORDER BY id
    FOR UPDATE;

    SELECT COUNT(*)::INTEGER
    INTO v_item_count
    FROM public.order_items
    WHERE order_id = v_order.id;

    SELECT COUNT(*)::INTEGER
    INTO v_active_reservation_count
    FROM public.inventory_reservations
    WHERE order_id = v_order.id
      AND state = 'active';

    IF v_active_reservation_count <> v_item_count THEN
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
    authorized_at = CASE
      WHEN v_effective_outcome = 'authorized' THEN NOW()
      ELSE authorized_at
    END,
    updated_at = NOW()
  WHERE id = v_attempt.id;

  IF v_effective_outcome = 'authorized' THEN
    UPDATE public.inventory_reservations
    SET
      state = 'consumed',
      consumed_at = NOW(),
      updated_at = NOW()
    WHERE order_id = v_order.id
      AND state = 'active';

    UPDATE public.products p
    SET
      status = 'sold',
      sold_at = NOW(),
      sale_price = oi.unit_price_clp,
      sold_channel = 'reski',
      updated_at = NOW()
    FROM public.order_items oi
    WHERE oi.order_id = v_order.id
      AND oi.product_id = p.id;

    UPDATE public.orders
    SET
      order_status = 'paid',
      payment_status = 'authorized',
      fulfillment_status = 'pending',
      paid_at = NOW(),
      updated_at = NOW()
    WHERE id = v_order.id;

    UPDATE public.shipping_quotes
    SET state = 'consumed'
    WHERE order_id = v_order.id
      AND state = 'selected';

    UPDATE public.promotion_redemptions
    SET
      state = 'consumed',
      consumed_at = NOW()
    WHERE order_id = v_order.id
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
    WHERE id = v_order.id
      AND order_status = 'awaiting_payment';

    UPDATE public.inventory_reservations
    SET
      state = CASE
        WHEN v_effective_outcome = 'expired' THEN 'expired'
        ELSE 'released'
      END,
      released_at = NOW(),
      release_reason = v_effective_outcome,
      updated_at = NOW()
    WHERE order_id = v_order.id
      AND state = 'active';

    UPDATE public.shipping_quotes
    SET state = 'expired'
    WHERE order_id = v_order.id
      AND state = 'selected';

    UPDATE public.promotion_redemptions
    SET
      state = 'released',
      released_at = NOW()
    WHERE order_id = v_order.id
      AND state = 'reserved';
  ELSE
    UPDATE public.orders
    SET
      payment_status = 'reconciliation_required',
      updated_at = NOW()
    WHERE id = v_order.id;
  END IF;

  INSERT INTO public.payment_events (
    payment_attempt_id,
    order_id,
    event_type,
    from_state,
    to_state,
    correlation_id,
    metadata
  )
  VALUES (
    v_attempt.id,
    v_order.id,
    'webpay_finalized',
    v_from_state,
    v_effective_outcome,
    p_correlation_id,
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

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = v_attempt.order_id;

  RETURN jsonb_build_object(
    'public_id', v_order.public_id,
    'order_status', v_order.order_status,
    'payment_status', v_order.payment_status,
    'attempt_state', v_effective_outcome,
    'reused', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.commerce_consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_create_checkout(
  UUID[], UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  INTEGER, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_store_webpay_initialization(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_fail_webpay_initialization(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_claim_webpay_processing(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commerce_finalize_webpay(
  UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT,
  TIMESTAMPTZ, UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.commerce_consume_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_create_checkout(
  UUID[], UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  INTEGER, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN
) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_store_webpay_initialization(UUID, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_fail_webpay_initialization(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_claim_webpay_processing(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_finalize_webpay(
  UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT,
  TIMESTAMPTZ, UUID
) TO service_role;

COMMIT;
