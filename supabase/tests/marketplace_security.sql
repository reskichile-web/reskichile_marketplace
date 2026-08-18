-- RLS behavior smoke test. Run after all migrations in an isolated database.

BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('81000000-0000-4000-8000-000000000001', 'seller@example.com', '{"name":"Seller"}'),
  ('81000000-0000-4000-8000-000000000002', 'other@example.com', '{"name":"Other"}'),
  ('81000000-0000-4000-8000-000000000003', 'admin@example.com', '{"name":"Admin"}');

UPDATE public.users
SET is_admin = TRUE
WHERE id = '81000000-0000-4000-8000-000000000003';

INSERT INTO public.products (
  id, seller_id, product_type, brand, condition, price, region, comuna, status
) VALUES
  (
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    'otros', 'Visible', 'nuevo', 10000, 'RM', 'Las Condes', 'approved'
  ),
  (
    '82000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000001',
    'otros', 'Draft', 'nuevo', 10000, 'RM', 'Las Condes', 'draft'
  );

INSERT INTO public.product_images (product_id, url) VALUES
  ('82000000-0000-4000-8000-000000000001', 'https://example.invalid/visible.jpg'),
  ('82000000-0000-4000-8000-000000000002', 'https://example.invalid/draft.jpg');

SELECT set_config('request.jwt.claim.role', 'anon', FALSE);
SET SESSION AUTHORIZATION anon;
SELECT 1 / CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END
FROM public.products;
SELECT 1 / CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END
FROM public.product_images;
RESET SESSION AUTHORIZATION;

SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', FALSE);
SELECT set_config('request.jwt.claim.role', 'authenticated', FALSE);
SET SESSION AUTHORIZATION authenticated;
SELECT 1 / CASE WHEN COUNT(*) = 2 THEN 1 ELSE 0 END
FROM public.products;
SELECT 1 / CASE WHEN COUNT(*) = 2 THEN 1 ELSE 0 END
FROM public.product_images;
SELECT 1 / CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END
FROM public.users;
RESET SESSION AUTHORIZATION;

SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', FALSE);
SELECT set_config('request.jwt.claim.role', 'authenticated', FALSE);
SET SESSION AUTHORIZATION authenticated;
SELECT 1 / CASE WHEN COUNT(*) = 2 THEN 1 ELSE 0 END
FROM public.products;
SELECT 1 / CASE WHEN COUNT(*) = 3 THEN 1 ELSE 0 END
FROM public.users;
RESET SESSION AUTHORIZATION;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN ('handle_new_user', 'is_admin')
      AND procedure.proconfig IS NULL
  ) THEN
    RAISE EXCEPTION 'security definer function has a mutable search_path';
  END IF;
END
$$;

ROLLBACK;
