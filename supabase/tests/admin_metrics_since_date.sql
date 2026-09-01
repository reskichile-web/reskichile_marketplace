BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('aa000000-0000-4000-8000-000000000001', 'metrics-seller@example.com', '{}');

UPDATE public.users
SET name = 'Metrics Seller', is_admin = TRUE
WHERE id = 'aa000000-0000-4000-8000-000000000001';

INSERT INTO public.products (
  id, seller_id, product_type, brand, model, condition, price, region, comuna, status
) VALUES (
  'ab000000-0000-4000-8000-000000000001',
  'aa000000-0000-4000-8000-000000000001',
  'esquis', 'Test', 'Metrics', 'usado', 100000, 'Metropolitana', 'Las Condes', 'approved'
);

-- 03:59:59Z is still August 30 in Chile; 04:00Z is local midnight.
INSERT INTO public.events (
  event_type, path, category, visitor_id, product_id, created_at
) VALUES
  ('pageview', '/catalogo', 'esquis', 'ac000000-0000-4000-8000-000000000001', NULL, '2026-08-31T03:59:59Z'),
  ('pageview', '/catalogo', 'esquis', 'ac000000-0000-4000-8000-000000000002', NULL, '2026-08-31T04:00:00Z'),
  ('product_view', '/producto/test', 'esquis', 'ac000000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000000000001', '2026-08-31T04:01:00Z');

DO $$
BEGIN
  IF (SELECT coalesce(sum(visits), 0) FROM public.admin_daily_visits_since('2026-08-31')) <> 1 THEN
    RAISE EXCEPTION 'daily visits did not start at Chilean midnight';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.admin_category_views_since('2026-08-31')
    WHERE category = 'esquis' AND views = 2 AND catalog_views = 1 AND product_views = 1
  ) THEN
    RAISE EXCEPTION 'category views did not respect the selected date';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.admin_top_products_since('2026-08-31', 10)
    WHERE product_id = 'ab000000-0000-4000-8000-000000000001' AND views = 1
  ) THEN
    RAISE EXCEPTION 'top products did not respect the selected date';
  END IF;

  IF has_function_privilege('anon', 'public.admin_daily_visits_since(date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anonymous role can execute custom metrics';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.admin_daily_visits_since(date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role cannot execute custom metrics';
  END IF;
END
$$;

ROLLBACK;
