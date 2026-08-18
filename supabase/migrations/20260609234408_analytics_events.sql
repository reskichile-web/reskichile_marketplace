-- Replace page_views (brand-new, ~2 rows) with a general analytics events table.
DROP TABLE public.page_views;

CREATE TABLE public.events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL DEFAULT 'pageview'
    CHECK (event_type IN ('pageview','product_view','click','login','signup','invite_open')),
  event_name TEXT,
  path TEXT NOT NULL,
  category TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  visitor_id UUID,
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
-- No INSERT policy on purpose: inserts only via service role from /api/track.

-- First-open timestamp for invite links (per-open detail lives in events).
ALTER TABLE public.password_invites ADD COLUMN opened_at TIMESTAMPTZ;

-- ============================================================
-- RPC: private per-product view counts (owner OR admin)
-- ============================================================
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

-- ============================================================
-- RPCs: admin aggregates (SECURITY INVOKER — admin-only RLS gates rows)
-- ============================================================
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
RETURNS TABLE(category TEXT, views BIGINT)
LANGUAGE sql SECURITY INVOKER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT trim(c), count(*)::bigint
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
GRANT EXECUTE ON FUNCTION public.admin_top_products(INT, INT) TO authenticated;;
