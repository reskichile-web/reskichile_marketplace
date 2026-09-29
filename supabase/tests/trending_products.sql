BEGIN;

DO $$
DECLARE
  v_seller UUID := '92900000-0000-4000-8000-000000000000';
  v_new UUID := '92900000-0000-4000-8000-000000000099';
  v_views UUID;
  v_contacts UUID;
  v_stamp TIMESTAMPTZ;
BEGIN
  -- Isolate the ranking from fixtures installed by previous migrations.
  UPDATE public.products SET status = 'archived' WHERE status = 'approved';
  INSERT INTO auth.users (id, email) VALUES (v_seller, 'trending@example.com');
  INSERT INTO public.products (
    id, seller_id, slug, product_type, brand, condition, price, region, comuna, status, created_at
  ) SELECT ('92900000-0000-4000-8000-' || lpad(n::TEXT, 12, '0'))::UUID,
    v_seller, 'trending-' || n, 'esquis', 'Test', 'nuevo', 100000,
    'Metropolitana', 'Santiago', 'pending', NOW() - interval '20 days'
  FROM generate_series(1, 45) n;
  INSERT INTO public.product_images (product_id, url)
    SELECT id, 'https://example.com/' || id || '.jpg' FROM public.products WHERE seller_id = v_seller;

  IF EXISTS (SELECT 1 FROM public.trending_products) THEN
    RAISE EXCEPTION 'pending products must not enter Trending';
  END IF;
  UPDATE public.products SET status = 'approved' WHERE seller_id = v_seller;
  IF (SELECT count(*) FROM public.trending_products) <> 40 THEN
    RAISE EXCEPTION 'publication must generate exactly 40 products';
  END IF;
  IF (SELECT count(DISTINCT refreshed_at) FROM public.trending_products) <> 1 THEN
    RAISE EXCEPTION 'bulk approval must create one atomic snapshot';
  END IF;

  v_views := '92900000-0000-4000-8000-000000000044';
  v_contacts := '92900000-0000-4000-8000-000000000045';
  SELECT min(refreshed_at) INTO v_stamp FROM public.trending_products;
  INSERT INTO public.events (product_id, event_type, path)
    SELECT v_views, 'product_view', '/producto/test' FROM generate_series(1, 100);
  INSERT INTO public.events (product_id, event_type, event_name, path)
    SELECT v_contacts, 'click', 'whatsapp_contact', '/producto/test' FROM generate_series(1, 5);
  IF (SELECT min(refreshed_at) FROM public.trending_products) <> v_stamp THEN
    RAISE EXCEPTION 'views and contacts must not themselves refresh the snapshot';
  END IF;
  UPDATE public.products SET model = 'Edited', price = 90000 WHERE id = v_views;
  IF (SELECT min(refreshed_at) FROM public.trending_products) <> v_stamp THEN
    RAISE EXCEPTION 'ordinary edits and discounts must not rerank Trending';
  END IF;

  INSERT INTO public.products (
    id, seller_id, slug, product_type, brand, condition, price, region, comuna, status
  ) VALUES (v_new, v_seller, 'trending-new', 'esquis', 'Test', 'nuevo', 100000,
    'Metropolitana', 'Santiago', 'pending');
  INSERT INTO public.product_images (product_id, url) VALUES (v_new, 'https://example.com/new.jpg');
  UPDATE public.products SET status = 'approved' WHERE id = v_new;
  IF (SELECT position FROM public.trending_products WHERE product_id = v_contacts) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'contacts should outrank views with otherwise equal signals';
  END IF;
  IF (SELECT position FROM public.trending_products WHERE product_id = v_views) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'recent views must contribute to ranking';
  END IF;
  IF (SELECT position FROM public.trending_products WHERE product_id = v_new) IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'novelty must allow products without engagement to enter';
  END IF;

  UPDATE public.products SET status = 'sold' WHERE id = v_contacts;
  IF EXISTS (SELECT 1 FROM public.trending_products WHERE product_id = v_contacts)
    OR (SELECT count(*) FROM public.trending_products) <> 40 THEN
    RAISE EXCEPTION 'sold items must leave and be replaced';
  END IF;
  DELETE FROM public.product_images WHERE product_id = v_views;
  IF EXISTS (SELECT 1 FROM public.trending_products WHERE product_id = v_views)
    OR (SELECT count(*) FROM public.trending_products) <> 40 THEN
    RAISE EXCEPTION 'products without images must leave and be replaced';
  END IF;
  DELETE FROM public.products WHERE id = v_new;
  IF EXISTS (SELECT 1 FROM public.trending_products WHERE product_id = v_new)
    OR (SELECT count(*) FROM public.trending_products) <> 40 THEN
    RAISE EXCEPTION 'deleted products must leave and be replaced';
  END IF;
  UPDATE public.products SET status = 'archived'
    WHERE seller_id = v_seller AND id::TEXT > '92900000-0000-4000-8000-000000000005';
  IF (SELECT count(*) FROM public.trending_products) <> 5 THEN
    RAISE EXCEPTION 'small catalog must include only available products';
  END IF;

  -- Old contacts and uncompleted contact intents must not influence Trending.
  INSERT INTO public.events (product_id, event_type, event_name, path, created_at)
    SELECT '92900000-0000-4000-8000-000000000005', 'click', 'whatsapp_contact', '/test', NOW() - interval '31 days'
    FROM generate_series(1, 100);
  INSERT INTO public.events (product_id, event_type, event_name, path)
    SELECT '92900000-0000-4000-8000-000000000005', 'click', 'contact_intent_whatsapp', '/test'
    FROM generate_series(1, 100);
  PERFORM public.refresh_trending_products();
  IF (SELECT position FROM public.trending_products WHERE product_id = '92900000-0000-4000-8000-000000000005') <> 5 THEN
    RAISE EXCEPTION 'old contacts and contact intents must be ignored';
  END IF;

  INSERT INTO public.events (product_id, event_type, visitor_id, path)
    SELECT '92900000-0000-4000-8000-000000000005', 'product_view',
      '92900000-0000-4000-8000-000000000100', '/test' FROM generate_series(1, 100);
  INSERT INTO public.events (product_id, event_type, visitor_id, path) VALUES
    ('92900000-0000-4000-8000-000000000004', 'product_view', '92900000-0000-4000-8000-000000000100', '/test'),
    ('92900000-0000-4000-8000-000000000004', 'product_view', '92900000-0000-4000-8000-000000000101', '/test');
  PERFORM public.refresh_trending_products();
  IF (SELECT position FROM public.trending_products WHERE product_id = '92900000-0000-4000-8000-000000000004') <> 1 THEN
    RAISE EXCEPTION 'two visitors must outrank 100 repeated views from one visitor';
  END IF;

  INSERT INTO public.events (product_id, event_type, event_name, visitor_id, path)
    SELECT '92900000-0000-4000-8000-000000000003', 'click',
      CASE WHEN n % 2 = 0 THEN 'whatsapp_contact' ELSE 'chat_contact' END,
      '92900000-0000-4000-8000-000000000100', '/test' FROM generate_series(1, 100) n;
  INSERT INTO public.events (product_id, event_type, event_name, visitor_id, path) VALUES
    ('92900000-0000-4000-8000-000000000002', 'click', 'whatsapp_contact', '92900000-0000-4000-8000-000000000100', '/test'),
    ('92900000-0000-4000-8000-000000000002', 'click', 'whatsapp_contact', '92900000-0000-4000-8000-000000000101', '/test');
  PERFORM public.refresh_trending_products();
  IF (SELECT position FROM public.trending_products WHERE product_id = '92900000-0000-4000-8000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'contact repeats across channels must count once per visitor';
  END IF;
END;
$$;

SET LOCAL ROLE anon;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.trending_products) <> 5 THEN
    RAISE EXCEPTION 'anonymous clients must read approved membership';
  END IF;
  IF has_table_privilege('anon', 'public.trending_products', 'INSERT, UPDATE, DELETE')
    OR has_function_privilege('anon', 'public.refresh_trending_products()', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.refresh_trending_products()', 'EXECUTE') THEN
    RAISE EXCEPTION 'public clients must never alter ranking';
  END IF;
END;
$$;
RESET ROLE;

ROLLBACK;
