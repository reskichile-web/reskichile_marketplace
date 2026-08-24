-- Five-slot Instagram editorial calendar. This test only exercises local
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
  ('94000000-0000-4000-8000-000000000004', '93000000-0000-4000-8000-000000000001', 'esquis', 'Slot Four', 'usado', 130000, 'Metropolitana', 'Las Condes', 'approved'),
  ('94000000-0000-4000-8000-000000000005', '93000000-0000-4000-8000-000000000001', 'esquis', 'Slot Five', 'usado', 140000, 'Metropolitana', 'Las Condes', 'approved'),
  ('94000000-0000-4000-8000-000000000006', '93000000-0000-4000-8000-000000000001', 'esquis', 'Next Day', 'usado', 150000, 'Metropolitana', 'Las Condes', 'approved');

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

SELECT 1 / CASE WHEN COUNT(*) = 6 THEN 1 ELSE 0 END
FROM scheduled_results;

SELECT 1 / CASE WHEN COUNT(*) = 5 THEN 1 ELSE 0 END
FROM scheduled_results
WHERE scheduled_local_date = ((NOW() AT TIME ZONE 'America/Santiago')::DATE + 10);

SELECT 1 / CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END
FROM scheduled_results
WHERE scheduled_local_date = ((NOW() AT TIME ZONE 'America/Santiago')::DATE + 11)
  AND scheduled_slot = 1;

SELECT 1 / CASE WHEN COUNT(DISTINCT (scheduled_local_date, scheduled_slot)) = 6 THEN 1 ELSE 0 END
FROM scheduled_results;

-- "Add to cron" starts today and always fills the earliest future slot.
-- Keep the expected slot independent from the time at which this test runs.
SELECT public.instagram_unschedule_capture(
  (SELECT id FROM public.instagram_story_captures
   WHERE product_id = '94000000-0000-4000-8000-000000000003')
);

CREATE TEMP TABLE expected_manual_earliest AS
WITH candidates AS (
  SELECT
    ((NOW() AT TIME ZONE 'America/Santiago')::DATE + day_offset)::DATE AS local_date,
    rule.slot,
    public.instagram_story_slot_time(
      ((NOW() AT TIME ZONE 'America/Santiago')::DATE + day_offset)::DATE,
      rule.slot
    ) AS scheduled_for
  FROM generate_series(0, 365) AS day_offset
  JOIN public.instagram_story_schedule_rules rule
    ON rule.iso_weekday = EXTRACT(
      ISODOW FROM ((NOW() AT TIME ZONE 'America/Santiago')::DATE + day_offset)
    )::SMALLINT
  WHERE public.instagram_story_slot_time(
      ((NOW() AT TIME ZONE 'America/Santiago')::DATE + day_offset)::DATE,
      rule.slot
    ) > NOW()
    AND NOT EXISTS (
      SELECT 1
      FROM public.instagram_story_captures occupied
      WHERE occupied.scheduled_local_date =
        ((NOW() AT TIME ZONE 'America/Santiago')::DATE + day_offset)::DATE
        AND occupied.scheduled_slot = rule.slot
    )
  ORDER BY scheduled_for
  LIMIT 1
)
SELECT * FROM candidates;

CREATE TEMP TABLE manual_earliest AS
SELECT * FROM public.instagram_schedule_capture_next(
  (SELECT id FROM public.instagram_story_captures
   WHERE product_id = '94000000-0000-4000-8000-000000000003'),
  NULL,
  'manual'
);

SELECT 1 / CASE WHEN manual.scheduled_local_date = expected.local_date
  AND manual.scheduled_slot = expected.slot
  AND manual.scheduled_for = expected.scheduled_for
  THEN 1 ELSE 0 END
FROM manual_earliest manual
CROSS JOIN expected_manual_earliest expected;

-- Automatic approval intentionally keeps starting on the following day.
SELECT public.instagram_unschedule_capture(
  (SELECT id FROM public.instagram_story_captures
   WHERE product_id = '94000000-0000-4000-8000-000000000003')
);

CREATE TEMP TABLE automatic_earliest AS
SELECT * FROM public.instagram_schedule_capture_next(
  (SELECT id FROM public.instagram_story_captures
   WHERE product_id = '94000000-0000-4000-8000-000000000003'),
  NULL,
  'automatic'
);

SELECT 1 / CASE WHEN scheduled_local_date =
    ((NOW() AT TIME ZONE 'America/Santiago')::DATE + 1)
  AND scheduled_slot = 1
  THEN 1 ELSE 0 END
FROM automatic_earliest;

-- A hole in the middle of an existing day is preferred over extending the
-- queue. Restoring product three to its original position also keeps the
-- remaining assertions in this test unchanged.
SELECT public.instagram_unschedule_capture(
  (SELECT id FROM public.instagram_story_captures
   WHERE product_id = '94000000-0000-4000-8000-000000000003')
);

CREATE TEMP TABLE internal_gap AS
SELECT * FROM public.instagram_schedule_capture_next(
  (SELECT id FROM public.instagram_story_captures
   WHERE product_id = '94000000-0000-4000-8000-000000000003'),
  ((NOW() AT TIME ZONE 'America/Santiago')::DATE + 10),
  'manual'
);

SELECT 1 / CASE WHEN scheduled_local_date =
    ((NOW() AT TIME ZONE 'America/Santiago')::DATE + 10)
  AND scheduled_slot = 3
  THEN 1 ELSE 0 END
FROM internal_gap;

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
  WHERE product_id = '94000000-0000-4000-8000-000000000006';

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

-- A successful publication records an event and returns the same capture to
-- ready, so it can be scheduled and published again indefinitely.
SELECT * FROM public.instagram_schedule_capture_next(
  (SELECT id FROM public.instagram_story_captures WHERE product_id = '94000000-0000-4000-8000-000000000001'),
  ((NOW() AT TIME ZONE 'America/Santiago')::DATE + 20),
  'manual'
);

UPDATE public.instagram_story_captures
SET status = 'publishing', container_id = 'cycle-container-1'
WHERE product_id = '94000000-0000-4000-8000-000000000001';

SELECT public.instagram_complete_story_publication(
  (SELECT id FROM public.instagram_story_captures WHERE product_id = '94000000-0000-4000-8000-000000000001'),
  'cycle-container-1',
  'cycle-media-1',
  NOW(),
  FALSE
);

SELECT 1 / CASE WHEN status = 'ready'
  AND publication_count = 1
  AND last_published_at IS NOT NULL
  AND scheduled_for IS NULL
  AND container_id IS NULL
  AND media_id IS NULL
  AND published_at IS NULL
  THEN 1 ELSE 0 END
FROM public.instagram_story_captures
WHERE product_id = '94000000-0000-4000-8000-000000000001';

SELECT * FROM public.instagram_schedule_capture_next(
  (SELECT id FROM public.instagram_story_captures WHERE product_id = '94000000-0000-4000-8000-000000000001'),
  ((NOW() AT TIME ZONE 'America/Santiago')::DATE + 21),
  'manual'
);

UPDATE public.instagram_story_captures
SET status = 'publishing', container_id = 'cycle-container-2'
WHERE product_id = '94000000-0000-4000-8000-000000000001';

SELECT public.instagram_complete_story_publication(
  (SELECT id FROM public.instagram_story_captures WHERE product_id = '94000000-0000-4000-8000-000000000001'),
  'cycle-container-2',
  'cycle-media-2',
  NOW(),
  FALSE
);

-- Repeating completion for the same Meta container is idempotent.
SELECT public.instagram_complete_story_publication(
  (SELECT id FROM public.instagram_story_captures WHERE product_id = '94000000-0000-4000-8000-000000000001'),
  'cycle-container-2',
  'cycle-media-2',
  NOW(),
  FALSE
);

SELECT 1 / CASE WHEN publication_count = 2 AND status = 'ready'
  THEN 1 ELSE 0 END
FROM public.instagram_story_captures
WHERE product_id = '94000000-0000-4000-8000-000000000001';

SELECT 1 / CASE WHEN COUNT(*) = 2 THEN 1 ELSE 0 END
FROM public.instagram_story_publications
WHERE product_id = '94000000-0000-4000-8000-000000000001';

SELECT 1 / CASE WHEN EXISTS (
  SELECT 1
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'instagram_story_publications'
    AND indexname = 'instagram_story_publications_schedule_idx'
) THEN 1 ELSE 0 END;

SELECT 1 / CASE WHEN
  NOT has_table_privilege('anon', 'public.instagram_story_publications', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.instagram_story_publications', 'SELECT')
  AND has_function_privilege(
    'service_role',
    'public.instagram_complete_story_publication(uuid,text,text,timestamptz,boolean)',
    'EXECUTE'
  )
  THEN 1 ELSE 0 END;

ROLLBACK;
