-- Hallazgos de Security Advisor y Database Linter observados el 2026-08-18.
-- Conserva la semantica del marketplace, pero limita roles, fija search_path,
-- elimina policies duplicadas y evita recalcular auth.uid() por cada fila.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(BTRIM(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid()) AND is_admin = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Users ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can update any user" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "View product sellers" ON public.users;
DROP POLICY IF EXISTS "View users from shared conversations" ON public.users;

CREATE POLICY users_select_authenticated ON public.users
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.products product
      WHERE product.seller_id = users.id
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations conversation
      WHERE (
        conversation.buyer_id = (SELECT auth.uid())
        AND conversation.seller_id = users.id
      ) OR (
        conversation.seller_id = (SELECT auth.uid())
        AND conversation.buyer_id = users.id
      )
    )
  );

CREATE POLICY users_insert_self ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY users_update_self_or_admin ON public.users
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (id = (SELECT auth.uid()) OR public.is_admin());

-- Products ------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can delete any product" ON public.products;
DROP POLICY IF EXISTS "Admins can update any product" ON public.products;
DROP POLICY IF EXISTS "Admins can view all products" ON public.products;
DROP POLICY IF EXISTS "Anyone can view approved products" ON public.products;
DROP POLICY IF EXISTS "Owners can update own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can delete own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can insert products" ON public.products;
DROP POLICY IF EXISTS "Sellers can update own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can view own products" ON public.products;
DROP POLICY IF EXISTS "productos aprobados publicos" ON public.products;

CREATE POLICY products_select_anon ON public.products
  FOR SELECT TO anon
  USING (status = 'approved');

CREATE POLICY products_select_authenticated ON public.products
  FOR SELECT TO authenticated
  USING (
    status = 'approved'
    OR seller_id = (SELECT auth.uid())
    OR public.is_admin()
  );

CREATE POLICY products_insert_authenticated ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    seller_id = (SELECT auth.uid())
    OR public.is_admin()
  );

CREATE POLICY products_update_authenticated ON public.products
  FOR UPDATE TO authenticated
  USING (seller_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (seller_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY products_delete_authenticated ON public.products
  FOR DELETE TO authenticated
  USING (seller_id = (SELECT auth.uid()) OR public.is_admin());

-- Product images ------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can delete any product image" ON public.product_images;
DROP POLICY IF EXISTS "Admins can insert product images" ON public.product_images;
DROP POLICY IF EXISTS "Admins can update product images" ON public.product_images;
DROP POLICY IF EXISTS "Admins can view all product images" ON public.product_images;
DROP POLICY IF EXISTS "Anyone can view images of approved products" ON public.product_images;
DROP POLICY IF EXISTS "Sellers can delete own product images" ON public.product_images;
DROP POLICY IF EXISTS "Sellers can insert product images" ON public.product_images;
DROP POLICY IF EXISTS "Sellers can update own product images" ON public.product_images;
DROP POLICY IF EXISTS "Sellers can view own product images" ON public.product_images;

CREATE POLICY product_images_select_anon ON public.product_images
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.products product
    WHERE product.id = product_images.product_id
      AND product.status = 'approved'
  ));

CREATE POLICY product_images_select_authenticated ON public.product_images
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products product
    WHERE product.id = product_images.product_id
      AND (
        product.status = 'approved'
        OR product.seller_id = (SELECT auth.uid())
        OR public.is_admin()
      )
  ));

CREATE POLICY product_images_insert_authenticated ON public.product_images
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products product
    WHERE product.id = product_images.product_id
      AND (
        product.seller_id = (SELECT auth.uid())
        OR public.is_admin()
      )
  ));

CREATE POLICY product_images_update_authenticated ON public.product_images
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products product
    WHERE product.id = product_images.product_id
      AND (
        product.seller_id = (SELECT auth.uid())
        OR public.is_admin()
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products product
    WHERE product.id = product_images.product_id
      AND (
        product.seller_id = (SELECT auth.uid())
        OR public.is_admin()
      )
  ));

CREATE POLICY product_images_delete_authenticated ON public.product_images
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products product
    WHERE product.id = product_images.product_id
      AND (
        product.seller_id = (SELECT auth.uid())
        OR public.is_admin()
      )
  ));

-- Chat and analytics policies: same authorization, stable init plan. --------

DROP POLICY IF EXISTS conversations_select_participant ON public.conversations;
DROP POLICY IF EXISTS conversations_insert_buyer ON public.conversations;
CREATE POLICY conversations_select_participant ON public.conversations
  FOR SELECT TO authenticated
  USING (
    buyer_id = (SELECT auth.uid())
    OR seller_id = (SELECT auth.uid())
  );
CREATE POLICY conversations_insert_buyer ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (buyer_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS messages_select_participant ON public.messages;
DROP POLICY IF EXISTS messages_insert_participant ON public.messages;
DROP POLICY IF EXISTS messages_update_recipient_read ON public.messages;
CREATE POLICY messages_select_participant ON public.messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations conversation
    WHERE conversation.id = messages.conversation_id
      AND (
        conversation.buyer_id = (SELECT auth.uid())
        OR conversation.seller_id = (SELECT auth.uid())
      )
  ));
CREATE POLICY messages_insert_participant ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.conversations conversation
      WHERE conversation.id = messages.conversation_id
        AND (
          conversation.buyer_id = (SELECT auth.uid())
          OR conversation.seller_id = (SELECT auth.uid())
        )
    )
  );
CREATE POLICY messages_update_recipient_read ON public.messages
  FOR UPDATE TO authenticated
  USING (
    sender_id <> (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.conversations conversation
      WHERE conversation.id = messages.conversation_id
        AND (
          conversation.buyer_id = (SELECT auth.uid())
          OR conversation.seller_id = (SELECT auth.uid())
        )
    )
  )
  WITH CHECK (sender_id <> (SELECT auth.uid()));

DROP POLICY IF EXISTS chat_email_notifications_admin_all
  ON public.chat_email_notifications;
CREATE POLICY chat_email_notifications_admin_all
  ON public.chat_email_notifications
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view events" ON public.events;
CREATE POLICY events_select_admin ON public.events
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Cover the four foreign keys identified by Database Linter.
CREATE INDEX IF NOT EXISTS chat_email_notifications_last_message_idx
  ON public.chat_email_notifications (last_message_id)
  WHERE last_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_sender_idx
  ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS product_images_product_idx
  ON public.product_images (product_id);
CREATE INDEX IF NOT EXISTS products_seller_idx
  ON public.products (seller_id)
  WHERE seller_id IS NOT NULL;

COMMIT;
