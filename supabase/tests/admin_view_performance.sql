BEGIN;

INSERT INTO auth.users (
  id, email, email_confirmed_at, last_sign_in_at, raw_user_meta_data
) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'admin@example.com', now(), now(), '{}'),
  ('a1000000-0000-4000-8000-000000000002', 'seller@example.com', now(), now(), '{}');

UPDATE public.users
SET
  name = CASE id
    WHEN 'a1000000-0000-4000-8000-000000000001' THEN 'Admin'
    ELSE 'Seller'
  END,
  phone = CASE id
    WHEN 'a1000000-0000-4000-8000-000000000001' THEN '+56911111111'
    ELSE '+56922222222'
  END,
  is_admin = id = 'a1000000-0000-4000-8000-000000000001',
  must_change_password = id = 'a1000000-0000-4000-8000-000000000002',
  keep = CASE WHEN id = 'a1000000-0000-4000-8000-000000000002' THEN TRUE ELSE NULL END
WHERE id IN (
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002'
);

INSERT INTO public.products (
  id, seller_id, product_type, brand, model, condition, description,
  price, region, comuna, attributes, status, slug
) VALUES
  (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    'esquis', 'Atomic', 'Test', 'usado_buen_estado', 'Test product',
    100000, 'Metropolitana', 'Providencia', '{}', 'approved', 'atomic-test'
  ),
  (
    'a2000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000002',
    'esquis', 'Head', 'Pending', 'usado_buen_estado', 'Pending product',
    90000, 'Metropolitana', 'Providencia', '{}', 'pending', 'head-pending'
  );

INSERT INTO public.product_images (product_id, url, "order") VALUES
  ('a2000000-0000-4000-8000-000000000001', 'https://example.com/first.jpg', 0),
  ('a2000000-0000-4000-8000-000000000001', 'https://example.com/second.jpg', 1),
  ('a2000000-0000-4000-8000-000000000002', 'https://example.com/pending.jpg', 0);

INSERT INTO public.events (
  event_type, path, product_id, user_id, visitor_id, country, city
) VALUES
  ('pageview', '/catalogo', NULL, 'a1000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001', 'Chile', 'Santiago'),
  ('product_view', '/producto/atomic-test', 'a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001', 'Chile', 'Santiago');

SELECT set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', TRUE);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  dashboard JSONB := public.admin_dashboard_snapshot();
  viewer JSONB := public.admin_viewer();
  users_page JSONB := public.admin_users_page(0, 1, 'all', '');
  products_page JSONB := public.admin_products_page(0, 30, 'all', '', '', '');
  instagram_page JSONB := public.admin_instagram_stories(current_date, TRUE);
BEGIN
  IF viewer->>'email' <> 'admin@example.com'
    OR viewer->>'userName' <> 'Admin' THEN
    RAISE EXCEPTION 'admin viewer returned unexpected data: %', viewer;
  END IF;

  IF (dashboard #>> '{stats,total}')::INTEGER <> 2
    OR jsonb_array_length(dashboard->'pending') <> 1
    OR jsonb_array_length(dashboard->'visits') <> 1 THEN
    RAISE EXCEPTION 'dashboard snapshot returned unexpected data: %', dashboard;
  END IF;

  IF (users_page->>'totalCount')::INTEGER <> 2
    OR jsonb_array_length(users_page->'users') <> 1
    OR (users_page #>> '{stats,pendingAccess}')::INTEGER <> 1 THEN
    RAISE EXCEPTION 'users page returned unexpected data: %', users_page;
  END IF;

  IF (products_page->>'totalCount')::INTEGER <> 2
    OR jsonb_array_length(products_page->'products') <> 2
    OR jsonb_array_length(products_page #> '{products,0,product_images}') <> 1
    OR (products_page #>> '{viewCounts,a2000000-0000-4000-8000-000000000001}')::INTEGER <> 1 THEN
    RAISE EXCEPTION 'products page returned unexpected data: %', products_page;
  END IF;

  IF jsonb_array_length(instagram_page->'products') <> 1 THEN
    RAISE EXCEPTION 'instagram page returned unexpected data: %', instagram_page;
  END IF;
END;
$$;

RESET ROLE;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.admin_dashboard_snapshot()', 'EXECUTE')
    OR has_function_privilege('anon', 'public.admin_viewer()', 'EXECUTE')
    OR has_function_privilege('anon', 'public.admin_users_page(integer,integer,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.admin_products_page(integer,integer,text,text,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.admin_instagram_stories(date,boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anonymous role can execute an admin view function';
  END IF;
END;
$$;

ROLLBACK;
