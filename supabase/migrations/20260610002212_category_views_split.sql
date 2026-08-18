-- v2: split category views into catalog browsing vs product detail views
DROP FUNCTION public.admin_category_views(INT);

CREATE FUNCTION public.admin_category_views(p_days INT DEFAULT 30)
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
GRANT EXECUTE ON FUNCTION public.admin_category_views(INT) TO authenticated;;
