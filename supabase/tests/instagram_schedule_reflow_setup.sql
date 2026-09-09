-- Migration fixture: six pending captures in the old five-slot calendar.
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('97000000-0000-4000-8000-000000000001', 'reflow@example.com', '{}');

DO $$
DECLARE
  v_start DATE := (NOW() AT TIME ZONE 'America/Santiago')::DATE + 10;
  v_product UUID;
  v_date DATE;
  v_slot SMALLINT;
BEGIN
  WHILE EXTRACT(ISODOW FROM v_start) <> 5 LOOP v_start := v_start + 1; END LOOP;
  FOR i IN 1..6 LOOP
    v_product := ('98000000-0000-4000-8000-' || LPAD(i::TEXT, 12, '0'))::UUID;
    v_date := v_start + CASE WHEN i = 6 THEN 1 ELSE 0 END;
    v_slot := CASE WHEN i = 6 THEN 1 ELSE i END;
    INSERT INTO public.products (id, seller_id, product_type, brand, condition, price, region, comuna, status)
    VALUES (v_product, '97000000-0000-4000-8000-000000000001', 'esquis', 'Reflow', 'usado', 100000, 'Metropolitana', 'Las Condes', 'approved');
    INSERT INTO public.instagram_story_captures (
      product_id, status, generated_at, approved_at, jpeg_public_url, jpeg_storage_path,
      scheduled_local_date, scheduled_slot, scheduled_for, schedule_source
    ) VALUES (
      v_product, 'ready', NOW(), NOW(), 'https://example.invalid/reflow.jpg', '_instagram/products/' || v_product || '/story.jpg',
      v_date, v_slot, public.instagram_story_slot_time(v_date, v_slot), 'manual'
    );
  END LOOP;
END;
$$;
