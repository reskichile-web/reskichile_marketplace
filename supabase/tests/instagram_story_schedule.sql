-- Three-slot Instagram editorial calendar. This test only exercises local
-- database state; it never contacts Meta or publishes media.

BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('93000000-0000-4000-8000-000000000001', 'schedule-seller@example.com', '{}');

INSERT INTO public.products (
  id, seller_id, product_type, brand, condition, price, region, comuna, status
) VALUES
  ('94000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', 'esquis', 'Slot One', 'usado', 100000, 'Metropolitana', 'Las Condes', 'approved'),
  ('94000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000001', 'esquis', 'Slot Two', 'usado', 110000, 'Metropolitana', 'Las Condes', 'approved'),
  ('94000000-0000-4000-8000-000000000003', '93000000-0000-4000-8000-000000000001', 'esquis', 'Slot Three', 'usado', 120000, 'Metropolitana', 'Las Condes', 'approved'),
  ('94000000-0000-4000-8000-000000000004', '93000000-0000-4000-8000-000000000001', 'esquis', 'Next Day', 'usado', 130000, 'Metropolitana', 'Las Condes', 'approved');

INSERT INTO public.instagram_story_captures (
  product_id, jpeg_storage_path, jpeg_public_url, approved_at, generated_at, status
)
SELECT
  product.id,
  '_instagram/products/' || product.id::TEXT || '/story.jpg',
  'https://example.invalid/' || product.id::TEXT || '.jpg',
  NOW() - INTERVAL '1 day',
  NOW(),
  'ready'
FROM public.products product
WHERE product.id::TEXT LIKE '94000000-0000-4000-8000-00000000000%';

CREATE TEMP TABLE scheduled_results AS
SELECT capture.product_id, schedule.*
FROM public.instagram_story_captures capture
CROSS JOIN LATERAL public.instagram_schedule_capture_next(
  capture.id,
  ((NOW() AT TIME ZONE 'America/Santiago')::DATE + 10),
  'manual'
) schedule
WHERE capture.product_id::TEXT LIKE '94000000-0000-4000-8000-00000000000%'
ORDER BY capture.product_id;

SELECT 1 / CASE WHEN COUNT(*) = 4 THEN 1 ELSE 0 END
FROM scheduled_results;

SELECT 1 / CASE WHEN COUNT(*) = 3 THEN 1 ELSE 0 END
FROM scheduled_results
WHERE scheduled_local_date = ((NOW() AT TIME ZONE 'America/Santiago')::DATE + 10);

SELECT 1 / CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END
FROM scheduled_results
WHERE scheduled_local_date = ((NOW() AT TIME ZONE 'America/Santiago')::DATE + 11)
  AND scheduled_slot = 1;

SELECT 1 / CASE WHEN COUNT(DISTINCT (scheduled_local_date, scheduled_slot)) = 4 THEN 1 ELSE 0 END
FROM scheduled_results;

CREATE TEMP TABLE regeneration AS
SELECT * FROM public.instagram_begin_capture_regeneration(
  '94000000-0000-4000-8000-000000000002'
);

SELECT 1 / CASE WHEN regeneration.should_render AND regeneration.capture_status = 'generating'
  THEN 1 ELSE 0 END
FROM regeneration;

SELECT 1 / CASE WHEN capture.scheduled_local_date = scheduled.scheduled_local_date
  AND capture.scheduled_slot = scheduled.scheduled_slot
  AND capture.scheduled_for = scheduled.scheduled_for
  THEN 1 ELSE 0 END
FROM public.instagram_story_captures capture
JOIN scheduled_results scheduled ON scheduled.product_id = capture.product_id
WHERE capture.product_id = '94000000-0000-4000-8000-000000000002';

UPDATE public.instagram_story_captures
SET status = 'ready', generated_at = NOW()
WHERE product_id = '94000000-0000-4000-8000-000000000002';

DO $$
DECLARE
  v_capture UUID;
BEGIN
  SELECT id INTO v_capture
  FROM public.instagram_story_captures
  WHERE product_id = '94000000-0000-4000-8000-000000000004';

  BEGIN
    PERFORM public.instagram_move_capture_schedule(
      v_capture,
      ((NOW() AT TIME ZONE 'America/Santiago')::DATE + 10),
      1::SMALLINT
    );
    RAISE EXCEPTION 'occupied slot was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END;
$$;

SELECT 1 / CASE WHEN
  NOT has_function_privilege('anon', 'public.instagram_schedule_capture_next(uuid,date,text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.instagram_schedule_capture_next(uuid,date,text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.instagram_schedule_capture_next(uuid,date,text)', 'EXECUTE')
  THEN 1 ELSE 0 END;

UPDATE public.instagram_story_captures
SET status = 'failed', attempts = 3, last_error = 'meta failed'
WHERE product_id = '94000000-0000-4000-8000-000000000001';

SELECT public.instagram_reset_failed_story_publication(
  (SELECT id FROM public.instagram_story_captures WHERE product_id = '94000000-0000-4000-8000-000000000001')
);

SELECT 1 / CASE WHEN status = 'retry' AND attempts = 0 AND scheduled_for IS NULL
  THEN 1 ELSE 0 END
FROM public.instagram_story_captures
WHERE product_id = '94000000-0000-4000-8000-000000000001';

ROLLBACK;
