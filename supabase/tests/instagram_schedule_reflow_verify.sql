DO $$
DECLARE
  v_start DATE := (NOW() AT TIME ZONE 'America/Santiago')::DATE + 10;
  v_row RECORD;
  v_index INTEGER := 0;
BEGIN
  WHILE EXTRACT(ISODOW FROM v_start) <> 5 LOOP v_start := v_start + 1; END LOOP;
  FOR v_row IN SELECT * FROM public.instagram_story_captures
    WHERE product_id::TEXT LIKE '98000000-0000-4000-8000-%' ORDER BY product_id
  LOOP
    v_index := v_index + 1;
    IF v_row.scheduled_local_date <> v_start + (CASE WHEN v_index <= 2 THEN 0 WHEN v_index <= 5 THEN 1 ELSE 2 END)
      OR v_row.scheduled_slot <> (CASE WHEN v_index <= 2 THEN v_index WHEN v_index <= 5 THEN v_index - 2 ELSE 1 END)
      OR v_row.scheduled_for <> public.instagram_story_slot_time(v_row.scheduled_local_date, v_row.scheduled_slot)
      OR v_row.schedule_source <> 'manual' OR v_row.status <> 'ready'
      OR v_row.jpeg_public_url <> 'https://example.invalid/reflow.jpg'
    THEN RAISE EXCEPTION 'migration failed to preserve/reflow capture %', v_index; END IF;
  END LOOP;
  IF v_index <> 6 THEN RAISE EXCEPTION 'migration lost a pending capture'; END IF;
END;
$$;
DELETE FROM public.products WHERE seller_id = '97000000-0000-4000-8000-000000000001';
DELETE FROM auth.users WHERE id = '97000000-0000-4000-8000-000000000001';
