-- ReskiChile Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- USERS (extends auth.users)
-- ============================================
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  -- Stored canonical: "+<country><local>" (e.g. "+56912345678"). Use the
  -- helpers in src/lib/phone.ts (normalizeStoredPhone, phoneToWhatsApp) at
  -- every boundary — never persist a raw input.
  phone TEXT,
  CONSTRAINT users_phone_canonical_format
    CHECK (phone IS NULL OR phone ~ '^\+[0-9]{8,15}$'),
  instagram TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  -- When TRUE, the WhatsApp CTA hides on this seller's product pages and
  -- /api/contact returns 403. Read from clients via the
  -- `is_seller_phone_hidden(uuid)` SECURITY DEFINER RPC, since RLS on this
  -- table doesn't expose cross-user fields.
  hide_phone BOOLEAN NOT NULL DEFAULT FALSE,
  -- Email notification preferences. Default TRUE; users can opt out from
  -- the publish form or their profile.
  notify_chat_email BOOLEAN NOT NULL DEFAULT TRUE,
  notify_reminders_email BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.is_seller_phone_hidden(p_seller uuid)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(hide_phone, FALSE) FROM public.users WHERE id = p_seller;
$$;
REVOKE ALL ON FUNCTION public.is_seller_phone_hidden(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_seller_phone_hidden(uuid) TO anon, authenticated;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================
-- PRODUCTS
-- ============================================
-- product_type: tipo de producto del formulario
-- brand, model: comunes a todos
-- condition: Nuevo (sellado), Nuevo, Usado - Como nuevo, Usado - Buen estado, Usado - Aceptable
-- seasons_used: temporadas de uso (texto libre, ej: "2", "3-4")
-- region, comuna: ubicación de despacho
-- attributes: JSONB con campos específicos por tipo de producto
-- ============================================
CREATE TABLE public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN (
    'esquis', 'snowboards', 'botas_esqui', 'botas_snowboard',
    'bastones', 'cascos', 'guantes', 'fijaciones',
    'parkas', 'pantalones', 'antiparras', 'mochilas',
    'bolsos', 'equipo_avalanchas', 'camaras_accion', 'otros'
  )),
  brand TEXT NOT NULL,
  model TEXT,
  condition TEXT NOT NULL CHECK (condition IN (
    'nuevo_sellado', 'nuevo', 'usado_como_nuevo', 'usado_buen_estado', 'usado_aceptable'
  )),
  seasons_used TEXT,
  description TEXT,
  price INTEGER NOT NULL CHECK (price > 0),
  region TEXT NOT NULL,
  comuna TEXT NOT NULL,
  attributes JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending', 'approved', 'rejected', 'sold', 'archived'
  )),
  rejection_reason TEXT,
  terms_accepted BOOLEAN DEFAULT FALSE,
  -- Inventory aging: days the product has been published. Incremented for
  -- 'approved' products by the pg_cron job 'increment-days-published'
  -- (daily, '0 4 * * *' UTC = medianoche Chile); freezes on sold/archived.
  days_published INTEGER NOT NULL DEFAULT 0,
  -- Sale metadata (set when a seller marks the product sold; cleared on undo).
  -- sale_price already existed; these capture how/when it sold for market refs.
  sale_price INTEGER,
  sold_at TIMESTAMPTZ,
  sold_channel TEXT,            -- 'reski' | 'otro_medio' | 'otro'
  sold_speed TEXT,             -- 'rapido' | 'normal' | 'baje_precio'
  -- Last "¿lo vendiste?" reminder timestamp (30-day cron; re-reminds >30d).
  sale_reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nightly inventory-aging tick (see days_published above)
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'increment-days-published',
  '0 4 * * *',
  $$UPDATE public.products SET days_published = days_published + 1 WHERE status = 'approved'$$
);

-- One-time tokens for emailed one-click actions (undo sale, confirm sale,
-- still-available). Service-role only (RLS on, no policies); single-use.
CREATE TABLE public.product_action_tokens (
  token TEXT PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('undo_sale', 'confirm_sold', 'still_available')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '45 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_action_tokens_product_idx ON public.product_action_tokens (product_id);
ALTER TABLE public.product_action_tokens ENABLE ROW LEVEL SECURITY;

-- ATTRIBUTES JSONB examples per product_type:
--
-- esquis: {
--   "largo_cm": 170,
--   "ancho_mm": 88,
--   "radio_giro_m": 16,
--   "incluye_fijaciones": true,
--   "fijaciones_marca": "Marker",
--   "fijaciones_modelo": "Griffon",
--   "fijaciones_tipo_conexion": "alpina",       -- alpina | de_pines | hibrida
--   "fijaciones_estado": "usado_buen_estado"
-- }
--
-- snowboards: {
--   "largo": "155",
--   "ancho": "25",
--   "camber": "camber_clasico",                  -- camber_clasico | camber_rocker | camber_plano
--   "incluye_fijaciones": true,
--   "fijaciones_marca": "Burton",
--   "fijaciones_modelo": "Custom",
--   "fijaciones_tipo_conexion": "alpina",
--   "fijaciones_estado": "nuevo"
-- }
--
-- botas_esqui: {
--   "flex": "100",
--   "talla_mondo": "26.5",
--   "talla_cm": "30.5",
--   "incluye_pines": false,                       -- bota randonnée (pines)
--   "genero": ["hombre"],                          -- array: hombre | mujer | junior
--   "color": "negro/rojo"
-- }
--
-- botas_snowboard: {
--   "talla_cm": "28",
--   "tipo_conexion_fijacion": "comun",            -- comun | step_on
--   "color": "negro",
--   "genero": ["hombre"]
-- }
--
-- bastones: {
--   "largo": "120",
--   "telescopicos": true
-- }
--
-- cascos: {
--   "color": "blanco",
--   "talla_cm": "56",
--   "talla": "M"                                  -- XS | S | M | L | XL
-- }
--
-- guantes: {
--   "talla": "L",                                 -- XS | S | M | L | XL
--   "genero": ["hombre"]
-- }
--
-- parkas: {
--   "tipo_aislacion": "pluma",                    -- pluma | termica | cortaviento
--   "genero": ["mujer"],
--   "talla": "M"                                  -- XS | S | M | L | XL | XXL
-- }
--
-- pantalones: {
--   "tipo_aislacion": "termica",
--   "genero": ["hombre"],
--   "talla": "L",                                 -- XS | S | M | L | XL | XXL
--   "talla_numero": "42"
-- }
--
-- antiparras: {
--   "lente_intercambiable": true,
--   "talla": "M"                                  -- XS | S | M | L | XL
-- }
--
-- mochilas: {
--   "capacidad_litros": "40",
--   "compartimiento_avalancha": true
-- }
--
-- bolsos: {
--   "capacidad_litros": "120",
--   "tiene_ruedas": true,
--   "largo": "80"
-- }
--
-- fijaciones: {
--   "tipo_conexion": "alpina"                     -- alpina | de_pines | hibrida
-- }
--
-- equipo_avalanchas: {
--   "tipo_equipo": "arva"                         -- arva | pala | sonda
-- }
--
-- camaras_accion: {
--   "tipo_grabacion": "360"                       -- 360 | normal
-- }
--
-- otros: {}  (solo usa campos comunes)

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved products" ON public.products
  FOR SELECT USING (status = 'approved');

CREATE POLICY "Sellers can view own products" ON public.products
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert products" ON public.products
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own products" ON public.products
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Admins can view all products" ON public.products
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can update any product" ON public.products
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================
-- PRODUCT IMAGES
-- ============================================
CREATE TABLE public.product_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view images of approved products" ON public.product_images
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND status = 'approved')
  );

CREATE POLICY "Sellers can view own product images" ON public.product_images
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND seller_id = auth.uid())
  );

CREATE POLICY "Sellers can insert product images" ON public.product_images
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND seller_id = auth.uid())
  );

CREATE POLICY "Sellers can delete own product images" ON public.product_images
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND seller_id = auth.uid())
  );

CREATE POLICY "Admins can view all product images" ON public.product_images
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STORAGE
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

CREATE POLICY "Anyone can view product images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own product images" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- CHAT: CONVERSATIONS + MESSAGES
-- ============================================
-- Buyer<->seller chat tied to a specific product. The unique key prevents
-- duplicate conversations for the same (product, buyer, seller) tuple.
CREATE TABLE public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, buyer_id, seller_id)
);

CREATE INDEX conversations_buyer_idx  ON public.conversations (buyer_id,  last_message_at DESC);
CREATE INDEX conversations_seller_idx ON public.conversations (seller_id, last_message_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

CREATE POLICY conversations_select_participant ON public.conversations
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY conversations_insert_buyer ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Messages: receipt state (delivered_at / read_at) is mutated by recipient.
-- The `guard_messages_update` trigger pins the UPDATE surface to those two
-- columns so the recipient can't rewrite the body or sender_id of past msgs.
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at DESC);
CREATE INDEX messages_delivered_idx    ON public.messages (conversation_id) WHERE delivered_at IS NULL;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

CREATE POLICY messages_select_participant ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

CREATE POLICY messages_insert_participant ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

CREATE POLICY messages_update_recipient_read ON public.messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
    AND sender_id <> auth.uid()
  )
  WITH CHECK (sender_id <> auth.uid());

-- Bump conversations.last_message_at whenever a new message lands.
CREATE OR REPLACE FUNCTION public.touch_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_touch_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_last_message();

-- Defense in depth on top of messages_update_recipient_read: only delivered_at
-- and read_at may change. The RLS policy is column-blind, so without this
-- trigger the recipient could rewrite body/sender/etc.
CREATE OR REPLACE FUNCTION public.guard_messages_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'messages: only delivered_at and read_at may be updated'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_guard_update_columns
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_messages_update();

-- Chat email notification dedupe/cooldown. One row per recipient/conversation
-- tracks the last automatic email sent, so a burst of messages does not turn
-- into one email per message.
CREATE TABLE public.chat_email_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (conversation_id, recipient_id)
);

CREATE INDEX chat_email_notifications_recipient_idx
  ON public.chat_email_notifications (recipient_id, last_sent_at DESC);

ALTER TABLE public.chat_email_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_email_notifications_admin_all ON public.chat_email_notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Aggregates "last message" + "unread count" per conversation in one round
-- trip — used by /mensajes and /perfil to avoid scanning every message body.
CREATE OR REPLACE FUNCTION public.conversations_overview()
RETURNS TABLE (
  id UUID,
  product_id UUID,
  buyer_id UUID,
  seller_id UUID,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  last_body TEXT,
  last_sender_id UUID,
  last_message_created_at TIMESTAMPTZ,
  last_delivered_at TIMESTAMPTZ,
  last_read_at TIMESTAMPTZ,
  unread_count INTEGER
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  user_convs AS (
    SELECT c.* FROM public.conversations c, me
    WHERE c.buyer_id = me.uid OR c.seller_id = me.uid
  ),
  last_msg AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id, m.body, m.sender_id, m.created_at, m.delivered_at, m.read_at
    FROM public.messages m
    WHERE m.conversation_id IN (SELECT id FROM user_convs)
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread AS (
    SELECT m.conversation_id, count(*)::int AS cnt
    FROM public.messages m, me
    WHERE m.conversation_id IN (SELECT id FROM user_convs)
      AND m.read_at IS NULL
      AND m.sender_id <> me.uid
    GROUP BY m.conversation_id
  )
  SELECT uc.id, uc.product_id, uc.buyer_id, uc.seller_id, uc.last_message_at, uc.created_at,
         lm.body, lm.sender_id, lm.created_at, lm.delivered_at, lm.read_at,
         coalesce(u.cnt, 0)
  FROM user_convs uc
  LEFT JOIN last_msg lm ON lm.conversation_id = uc.id
  LEFT JOIN unread   u  ON u.conversation_id  = uc.id
  ORDER BY uc.last_message_at DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.conversations_overview() FROM public;
REVOKE ALL ON FUNCTION public.conversations_overview() FROM anon;
GRANT EXECUTE ON FUNCTION public.conversations_overview() TO authenticated;

-- Realtime: stream INSERT/UPDATE/DELETE for participants of each conversation.
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================================
-- PASSWORD INVITES (invite links for imported/legacy users)
-- ============================================================
-- Created live before being mirrored here. Admin generates a slug via
-- /api/admin/invite-link; user opens /i/[slug] (opened_at) and sets a
-- password via /api/auth/redeem-invite (used_at + must_change_password off).
-- RLS enabled with NO policies on purpose: service-role access only.
CREATE TABLE public.password_invites (
  slug TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at TIMESTAMPTZ
);

ALTER TABLE public.password_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ANALYTICS EVENTS (internal observability)
-- ============================================================
-- First-party event tracking: pageviews, product views, landing clicks and
-- auth events. Inserts happen only via the service role from /api/track
-- (no INSERT policy on purpose); reads are admin-only, except the private
-- per-product counters exposed through product_view_counts().
CREATE TABLE public.events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL DEFAULT 'pageview'
    CHECK (event_type IN ('pageview','product_view','click','login','signup','invite_open')),
  event_name TEXT,                -- click target / invite slug / sub-kind
  path TEXT NOT NULL,
  category TEXT,                  -- product_type key(s); may be comma-separated from /catalogo
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  visitor_id UUID,                -- nullable: server-emitted events have no cookie
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  referrer TEXT,
  user_agent TEXT,
  country TEXT,
  city TEXT
);

CREATE INDEX events_created_at_idx ON public.events (created_at DESC);
CREATE INDEX events_type_created_idx ON public.events (event_type, created_at DESC);
CREATE INDEX events_product_idx ON public.events (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX events_category_idx ON public.events (category) WHERE category IS NOT NULL;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view events" ON public.events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Private per-product view counts: callable by any authenticated user but
-- only returns rows for products the caller owns (or everything for admins).
CREATE OR REPLACE FUNCTION public.product_view_counts(p_ids UUID[])
RETURNS TABLE(product_id UUID, views BIGINT)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT e.product_id, count(*)::bigint
  FROM public.events e
  JOIN public.products p ON p.id = e.product_id
  WHERE e.event_type = 'product_view'
    AND e.product_id = ANY(p_ids)
    AND (
      p.seller_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin)
    )
  GROUP BY e.product_id;
$$;
REVOKE ALL ON FUNCTION public.product_view_counts(UUID[]) FROM public;
REVOKE ALL ON FUNCTION public.product_view_counts(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.product_view_counts(UUID[]) TO authenticated;

-- Admin aggregates for /admin/metricas. SECURITY INVOKER: the admin-only
-- SELECT policy on events applies inside, so non-admins get zero rows.
CREATE OR REPLACE FUNCTION public.admin_daily_visits(p_days INT DEFAULT 30)
RETURNS TABLE(day DATE, visits BIGINT, uniques BIGINT)
LANGUAGE sql SECURITY INVOKER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT (e.created_at AT TIME ZONE 'America/Santiago')::date,
         count(*)::bigint,
         count(DISTINCT e.visitor_id)::bigint
  FROM public.events e
  WHERE e.event_type = 'pageview'
    AND e.created_at >= now() - make_interval(days => p_days)
  GROUP BY 1 ORDER BY 1;
$$;
REVOKE ALL ON FUNCTION public.admin_daily_visits(INT) FROM public;
REVOKE ALL ON FUNCTION public.admin_daily_visits(INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_daily_visits(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_category_views(p_days INT DEFAULT 30)
RETURNS TABLE(category TEXT, views BIGINT, catalog_views BIGINT, product_views BIGINT)
LANGUAGE sql SECURITY INVOKER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT trim(c),
         count(*)::bigint,
         (count(*) FILTER (WHERE e.event_type = 'pageview'))::bigint,
         (count(*) FILTER (WHERE e.event_type = 'product_view'))::bigint
  FROM public.events e,
       regexp_split_to_table(e.category, ',') AS c
  WHERE e.category IS NOT NULL
    AND e.event_type IN ('pageview','product_view')
    AND e.created_at >= now() - make_interval(days => p_days)
  GROUP BY 1 ORDER BY 2 DESC;
$$;
REVOKE ALL ON FUNCTION public.admin_category_views(INT) FROM public;
REVOKE ALL ON FUNCTION public.admin_category_views(INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_category_views(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_landing_clicks(p_days INT DEFAULT 30)
RETURNS TABLE(name TEXT, category TEXT, clicks BIGINT)
LANGUAGE sql SECURITY INVOKER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT e.event_name, e.category, count(*)::bigint
  FROM public.events e
  WHERE e.event_type = 'click'
    AND e.created_at >= now() - make_interval(days => p_days)
  GROUP BY 1, 2 ORDER BY 3 DESC;
$$;
REVOKE ALL ON FUNCTION public.admin_landing_clicks(INT) FROM public;
REVOKE ALL ON FUNCTION public.admin_landing_clicks(INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_landing_clicks(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_top_products(p_days INT DEFAULT 30, p_limit INT DEFAULT 10)
RETURNS TABLE(product_id UUID, brand TEXT, model TEXT, slug TEXT, views BIGINT)
LANGUAGE sql SECURITY INVOKER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.brand, p.model, p.slug, count(*)::bigint
  FROM public.events e
  JOIN public.products p ON p.id = e.product_id
  WHERE e.event_type = 'product_view'
    AND e.created_at >= now() - make_interval(days => p_days)
  GROUP BY p.id, p.brand, p.model, p.slug
  ORDER BY 5 DESC
  LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION public.admin_top_products(INT, INT) FROM public;
REVOKE ALL ON FUNCTION public.admin_top_products(INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_top_products(INT, INT) TO authenticated;

-- Last analytics event per user (used by /api/admin/users to sort by activity)
CREATE OR REPLACE FUNCTION public.admin_user_last_activity()
RETURNS TABLE(user_id UUID, last_activity TIMESTAMPTZ)
LANGUAGE sql SECURITY INVOKER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT e.user_id, max(e.created_at)
  FROM public.events e
  WHERE e.user_id IS NOT NULL
  GROUP BY e.user_id;
$$;
REVOKE ALL ON FUNCTION public.admin_user_last_activity() FROM public;
REVOKE ALL ON FUNCTION public.admin_user_last_activity() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_user_last_activity() TO authenticated;

CREATE INDEX IF NOT EXISTS events_user_idx ON public.events (user_id) WHERE user_id IS NOT NULL;

-- ============================================================
-- PRODUCT SEARCH (pg_trgm + unaccent)
-- ============================================================
-- products.search_text: normalized (lower+unaccent) concat of brand, model,
-- type synonyms (ES/EN), condition, description, attributes and location,
-- maintained by the products_search_text_sync trigger. Searched by the
-- search_products() RPC (SECURITY INVOKER — public sees approved only):
-- strict mode requires every query word to match (substring or trigram
-- fuzzy); relaxed mode (frontend fallback) accepts any word. Matches on
-- brand/model/type rank above description/attribute-only matches.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
ALTER TABLE public.products ADD COLUMN search_text TEXT;
CREATE INDEX products_search_trgm_idx ON public.products USING gin (search_text gin_trgm_ops);
-- Full definitions of product_type_synonyms(), products_search_text_sync()
-- and search_products(q, max_results, relaxed) live in the migrations
-- 'product_search' and 'search_products_primary_boost'.
