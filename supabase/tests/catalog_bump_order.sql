BEGIN;

DO $$
DECLARE
  v_seller_id UUID := '97000000-0000-4000-8000-000000000000';
  v_discounted_id UUID := '97000000-0000-4000-8000-000000000001';
  v_new_id UUID := '97000000-0000-4000-8000-000000000002';
  v_discount_bump TIMESTAMPTZ;
  v_new_bump TIMESTAMPTZ;
  v_after_edit TIMESTAMPTZ;
BEGIN
  INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES (v_seller_id, 'catalog-bump@example.com', NOW());

  INSERT INTO public.products (
    id, seller_id, product_type, brand, model, condition, description, price,
    region, comuna, attributes, status, terms_accepted, created_at
  ) VALUES (
    v_discounted_id, v_seller_id, 'esquis', 'Test', 'Discounted', 'nuevo', NULL,
    100000, 'Metropolitana', 'Santiago', '{}'::JSONB, 'approved', TRUE,
    '2026-01-01 12:00:00+00'
  );

  UPDATE public.products
  SET price = 90000, previous_price = 100000
  WHERE id = v_discounted_id;

  SELECT catalog_bumped_at INTO v_discount_bump
  FROM public.products WHERE id = v_discounted_id;

  PERFORM pg_sleep(0.002);

  INSERT INTO public.products (
    id, seller_id, product_type, brand, model, condition, description, price,
    region, comuna, attributes, status, terms_accepted, created_at
  ) VALUES (
    v_new_id, v_seller_id, 'esquis', 'Test', 'New listing', 'nuevo', NULL,
    110000, 'Metropolitana', 'Santiago', '{}'::JSONB, 'approved', TRUE,
    clock_timestamp()
  );

  SELECT catalog_bumped_at INTO v_new_bump
  FROM public.products WHERE id = v_new_id;

  IF v_new_bump <= v_discount_bump THEN
    RAISE EXCEPTION 'a newer publication must displace an earlier price reduction';
  END IF;

  UPDATE public.products SET model = 'Discounted edited' WHERE id = v_discounted_id;
  SELECT catalog_bumped_at INTO v_after_edit
  FROM public.products WHERE id = v_discounted_id;

  IF v_after_edit IS DISTINCT FROM v_discount_bump THEN
    RAISE EXCEPTION 'ordinary edits must not bump catalogue position';
  END IF;

  PERFORM pg_sleep(0.002);

  UPDATE public.products
  SET price = 80000, previous_price = 90000
  WHERE id = v_discounted_id;

  SELECT catalog_bumped_at INTO v_after_edit
  FROM public.products WHERE id = v_discounted_id;

  IF v_after_edit <= v_new_bump THEN
    RAISE EXCEPTION 'a later price reduction must return the product to the queue head';
  END IF;
END;
$$;

ROLLBACK;
