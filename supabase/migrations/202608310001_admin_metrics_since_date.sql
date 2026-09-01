-- Exact calendar-date ranges for the custom filter in /admin/metricas.
-- DATE is interpreted at midnight in Chile so DST is handled by PostgreSQL.

CREATE OR REPLACE FUNCTION public.admin_daily_visits_since(p_since DATE)
RETURNS TABLE(day DATE, visits BIGINT, uniques BIGINT)
LANGUAGE sql SECURITY INVOKER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT (e.created_at AT TIME ZONE 'America/Santiago')::date,
         count(*)::bigint,
         count(DISTINCT e.visitor_id)::bigint
  FROM public.events e
  WHERE e.event_type = 'pageview'
    AND e.created_at >= (p_since::timestamp AT TIME ZONE 'America/Santiago')
  GROUP BY 1 ORDER BY 1;
$$;
REVOKE ALL ON FUNCTION public.admin_daily_visits_since(DATE) FROM public;
REVOKE ALL ON FUNCTION public.admin_daily_visits_since(DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_daily_visits_since(DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_category_views_since(p_since DATE)
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
    AND e.created_at >= (p_since::timestamp AT TIME ZONE 'America/Santiago')
  GROUP BY 1 ORDER BY 2 DESC;
$$;
REVOKE ALL ON FUNCTION public.admin_category_views_since(DATE) FROM public;
REVOKE ALL ON FUNCTION public.admin_category_views_since(DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_category_views_since(DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_top_products_since(
  p_since DATE,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(product_id UUID, brand TEXT, model TEXT, slug TEXT, views BIGINT)
LANGUAGE sql SECURITY INVOKER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.brand, p.model, p.slug, count(*)::bigint
  FROM public.events e
  JOIN public.products p ON p.id = e.product_id
  WHERE e.event_type = 'product_view'
    AND e.created_at >= (p_since::timestamp AT TIME ZONE 'America/Santiago')
  GROUP BY p.id, p.brand, p.model, p.slug
  ORDER BY 5 DESC
  LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION public.admin_top_products_since(DATE, INT) FROM public;
REVOKE ALL ON FUNCTION public.admin_top_products_since(DATE, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_top_products_since(DATE, INT) TO authenticated;
