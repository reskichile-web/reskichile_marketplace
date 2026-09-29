-- One persisted selection shared by the storefront and Meta's catalog feed.
BEGIN;

CREATE TABLE public.trending_products (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  position INTEGER NOT NULL UNIQUE CHECK (position BETWEEN 1 AND 40),
  refreshed_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.trending_products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trending_products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.trending_products TO anon, authenticated, service_role;
CREATE POLICY "Read available trending products" ON public.trending_products
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'approved'
  ));

CREATE INDEX events_trending_activity_idx
  ON public.events (created_at, product_id)
  WHERE event_type = 'product_view'
    OR (event_type = 'click' AND event_name IN ('whatsapp_contact', 'chat_contact'));

CREATE FUNCTION public.refresh_trending_products()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_now TIMESTAMPTZ;
BEGIN
  -- Concurrent approvals cannot interleave their snapshot replacements.
  PERFORM pg_advisory_xact_lock(20260929, 40);
  v_now := clock_timestamp();
  DELETE FROM public.trending_products;
  INSERT INTO public.trending_products (product_id, position, refreshed_at)
  WITH eligible AS MATERIALIZED (
    SELECT p.id, p.created_at
    FROM public.products p
    WHERE p.status = 'approved' AND p.price > 0
      AND nullif(btrim(p.slug), '') IS NOT NULL
      AND nullif(btrim(p.brand), '') IS NOT NULL
      AND p.condition IN ('nuevo', 'nuevo_sellado', 'usado_como_nuevo', 'usado_buen_estado', 'usado_aceptable')
      AND EXISTS (SELECT 1 FROM public.product_images i
        WHERE i.product_id = p.id AND btrim(i.url) ~* '^https?://[^/[:space:]]+')
  ), activity AS (
    SELECT e.product_id,
      count(DISTINCT (coalesce(e.user_id::TEXT, e.visitor_id::TEXT, e.id::TEXT),
        (e.created_at AT TIME ZONE 'UTC')::DATE))
        FILTER (WHERE e.event_type = 'product_view') AS views,
      count(DISTINCT coalesce(e.user_id::TEXT, e.visitor_id::TEXT, e.id::TEXT))
        FILTER (WHERE e.event_type = 'click'
          AND e.event_name IN ('whatsapp_contact', 'chat_contact')) AS contacts
    FROM public.events e JOIN eligible p ON p.id = e.product_id
    WHERE e.created_at >= v_now - interval '30 days' AND e.created_at <= v_now
      AND (e.event_type = 'product_view'
        OR (e.event_type = 'click' AND e.event_name IN ('whatsapp_contact', 'chat_contact')))
    GROUP BY e.product_id
  ), signals AS (
    SELECT p.*, ln(1 + coalesce(a.contacts, 0)) AS contacts,
      ln(1 + coalesce(a.views, 0)) AS views,
      power(0.5::NUMERIC, greatest(0, extract(epoch FROM (v_now - coalesce(p.created_at, v_now)))) / 1209600) AS novelty
    FROM eligible p LEFT JOIN activity a ON a.product_id = p.id
  ), scored AS (
    SELECT *,
      0.45 * contacts / greatest(1, max(contacts) OVER ())
      + 0.30 * views / greatest(1, max(views) OVER ())
      + 0.25 * novelty AS score
    FROM signals
  )
  SELECT id, row_number() OVER (ORDER BY score DESC, created_at DESC NULLS LAST, id)::INTEGER, v_now
  FROM scored ORDER BY score DESC, created_at DESC NULLS LAST, id LIMIT 40;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_trending_products() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_trending_products() TO service_role;

-- Statement triggers handle bulk imports once. Draft uploads and analytics
-- writes never recalculate the selection. Publication is the main trigger;
-- removals and eligibility edits also refresh it to keep 40 available items.
CREATE FUNCTION public.products_refresh_trending()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v_refresh BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS (SELECT 1 FROM new_products WHERE status = 'approved') INTO v_refresh;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT EXISTS (SELECT 1 FROM old_products WHERE status = 'approved') INTO v_refresh;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM new_products n JOIN old_products o USING (id)
      WHERE (n.status = 'approved' OR o.status = 'approved') AND (
        n.status IS DISTINCT FROM o.status OR n.slug IS DISTINCT FROM o.slug
        OR n.brand IS DISTINCT FROM o.brand OR n.condition IS DISTINCT FROM o.condition
        OR (n.price > 0) IS DISTINCT FROM (o.price > 0)
      )
    ) INTO v_refresh;
  END IF;
  IF v_refresh THEN PERFORM public.refresh_trending_products(); END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.products_refresh_trending() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER products_trending_insert AFTER INSERT ON public.products
  REFERENCING NEW TABLE AS new_products FOR EACH STATEMENT
  EXECUTE FUNCTION public.products_refresh_trending();
CREATE TRIGGER products_trending_update AFTER UPDATE ON public.products
  REFERENCING OLD TABLE AS old_products NEW TABLE AS new_products FOR EACH STATEMENT
  EXECUTE FUNCTION public.products_refresh_trending();
CREATE TRIGGER products_trending_delete AFTER DELETE ON public.products
  REFERENCING OLD TABLE AS old_products FOR EACH STATEMENT
  EXECUTE FUNCTION public.products_refresh_trending();

CREATE FUNCTION public.product_images_refresh_trending()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v_refresh BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM changed_images i JOIN public.products p ON p.id = i.product_id
    WHERE p.status = 'approved') INTO v_refresh;
  IF TG_OP = 'UPDATE' THEN
    v_refresh := v_refresh OR EXISTS (SELECT 1 FROM old_images i JOIN public.products p ON p.id = i.product_id
      WHERE p.status = 'approved');
  END IF;
  IF v_refresh THEN PERFORM public.refresh_trending_products(); END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.product_images_refresh_trending() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER product_images_trending_insert AFTER INSERT ON public.product_images
  REFERENCING NEW TABLE AS changed_images FOR EACH STATEMENT
  EXECUTE FUNCTION public.product_images_refresh_trending();
CREATE TRIGGER product_images_trending_update AFTER UPDATE ON public.product_images
  REFERENCING OLD TABLE AS old_images NEW TABLE AS changed_images FOR EACH STATEMENT
  EXECUTE FUNCTION public.product_images_refresh_trending();
CREATE TRIGGER product_images_trending_delete AFTER DELETE ON public.product_images
  REFERENCING OLD TABLE AS changed_images FOR EACH STATEMENT
  EXECUTE FUNCTION public.product_images_refresh_trending();

-- Take the ranking lock before DELETE acquires product/FK row locks. Otherwise
-- a concurrent approval rebuilding membership could deadlock with the cascade.
CREATE FUNCTION public.products_lock_trending_removal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(20260929, 40);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.products_lock_trending_removal() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER products_trending_before_delete BEFORE DELETE ON public.products
  FOR EACH STATEMENT EXECUTE FUNCTION public.products_lock_trending_removal();

SELECT public.refresh_trending_products();
COMMIT;
