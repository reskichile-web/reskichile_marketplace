-- Sold products must behave like deleted products for the Instagram calendar,
-- while preserving a retryable request to remove the physical JPEG.

BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('95000000-0000-4000-8000-000000000001', 'sold-story-seller@example.com', '{}');

INSERT INTO public.products (
  id, seller_id, product_type, brand, condition, price, region, comuna, status
) VALUES (
  '96000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000001',
  'esquis',
  'Scheduled Story',
  'usado',
  350000,
  'Metropolitana',
  'Las Condes',
  'pending'
);

SELECT * FROM public.instagram_begin_approval_capture(
  '96000000-0000-4000-8000-000000000001'
);

UPDATE public.instagram_story_captures
SET
  status = 'ready',
  generated_at = NOW(),
  jpeg_public_url = 'https://example.invalid/sold-story.jpg'
WHERE product_id = '96000000-0000-4000-8000-000000000001';

CREATE TEMP TABLE released_slot AS
SELECT * FROM public.instagram_schedule_capture_next(
  (
    SELECT id FROM public.instagram_story_captures
    WHERE product_id = '96000000-0000-4000-8000-000000000001'
  ),
  ((NOW() AT TIME ZONE 'America/Santiago')::DATE + 10),
  'manual'
);

INSERT INTO public.instagram_story_publications (
  capture_id,
  product_id,
  container_id,
  published_at,
  scheduled_local_date,
  scheduled_slot,
  scheduled_for,
  schedule_source
)
SELECT
  capture.id,
  capture.product_id,
  'sold-story-container',
  NOW(),
  slot.scheduled_local_date,
  slot.scheduled_slot,
  slot.scheduled_for,
  slot.schedule_source
FROM public.instagram_story_captures capture
CROSS JOIN released_slot slot
WHERE capture.product_id = '96000000-0000-4000-8000-000000000001';

UPDATE public.products
SET status = 'sold', sold_at = NOW()
WHERE id = '96000000-0000-4000-8000-000000000001';

SELECT 1 / CASE WHEN NOT EXISTS (
  SELECT 1 FROM public.instagram_story_captures
  WHERE product_id = '96000000-0000-4000-8000-000000000001'
) THEN 1 ELSE 0 END;

SELECT 1 / CASE WHEN NOT EXISTS (
  SELECT 1 FROM public.instagram_story_publications
  WHERE product_id = '96000000-0000-4000-8000-000000000001'
) THEN 1 ELSE 0 END;

SELECT 1 / CASE WHEN storage_paths @> ARRAY[
  '_instagram/products/96000000-0000-4000-8000-000000000001/story.jpg'
]::TEXT[] THEN 1 ELSE 0 END
FROM public.instagram_story_cleanup_queue
WHERE product_id = '96000000-0000-4000-8000-000000000001';

SELECT 1 / CASE WHEN
  NOT has_table_privilege('anon', 'public.instagram_story_cleanup_queue', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.instagram_story_cleanup_queue', 'SELECT')
  AND has_table_privilege('service_role', 'public.instagram_story_cleanup_queue', 'DELETE')
THEN 1 ELSE 0 END;

-- The exact former slot is immediately reusable by another approved product.
INSERT INTO public.products (
  id, seller_id, product_type, brand, condition, price, region, comuna, status
) VALUES (
  '96000000-0000-4000-8000-000000000002',
  '95000000-0000-4000-8000-000000000001',
  'antiparras',
  'Replacement Story',
  'usado',
  90000,
  'Metropolitana',
  'Las Condes',
  'pending'
);

SELECT * FROM public.instagram_begin_approval_capture(
  '96000000-0000-4000-8000-000000000002'
);

UPDATE public.instagram_story_captures
SET
  status = 'ready',
  generated_at = NOW(),
  jpeg_public_url = 'https://example.invalid/replacement-story.jpg'
WHERE product_id = '96000000-0000-4000-8000-000000000002';

CREATE TEMP TABLE replacement_slot AS
SELECT moved.*
FROM released_slot released
CROSS JOIN LATERAL public.instagram_move_capture_schedule(
  (
    SELECT id FROM public.instagram_story_captures
    WHERE product_id = '96000000-0000-4000-8000-000000000002'
  ),
  released.scheduled_local_date,
  released.scheduled_slot
) moved;

SELECT 1 / CASE WHEN replacement.scheduled_local_date = released.scheduled_local_date
  AND replacement.scheduled_slot = released.scheduled_slot
THEN 1 ELSE 0 END
FROM replacement_slot replacement
CROSS JOIN released_slot released;

ROLLBACK;
