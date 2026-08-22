-- Deterministic Instagram Story capture state machine. This test never calls
-- Meta and never uploads or publishes media.

BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('91000000-0000-4000-8000-000000000001', 'story-seller@example.com', '{}');

INSERT INTO public.products (
  id, seller_id, product_type, brand, condition, price, region, comuna, status
) VALUES (
  '92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  'esquis',
  'Story Test',
  'usado',
  250000,
  'Metropolitana',
  'Las Condes',
  'pending'
);

CREATE TEMP TABLE first_claim AS
SELECT * FROM public.instagram_begin_approval_capture(
  '92000000-0000-4000-8000-000000000001'
);

SELECT 1 / CASE WHEN transitioned AND should_render THEN 1 ELSE 0 END
FROM first_claim;

SELECT 1 / CASE WHEN capture_status = 'generating' THEN 1 ELSE 0 END
FROM first_claim;

SELECT 1 / CASE WHEN jpeg_storage_path =
  '_instagram/products/92000000-0000-4000-8000-000000000001/story.jpg'
  THEN 1 ELSE 0 END
FROM first_claim;

SELECT 1 / CASE WHEN status = 'approved' THEN 1 ELSE 0 END
FROM public.products
WHERE id = '92000000-0000-4000-8000-000000000001';

UPDATE public.instagram_story_captures
SET status = 'failed', last_error = 'render failed'
WHERE product_id = '92000000-0000-4000-8000-000000000001';

CREATE TEMP TABLE retry_claim AS
SELECT * FROM public.instagram_begin_capture_retry(
  '92000000-0000-4000-8000-000000000001'
);

SELECT 1 / CASE WHEN retry.should_render THEN 1 ELSE 0 END
FROM retry_claim retry;

SELECT 1 / CASE WHEN retry.capture_id = first.capture_id THEN 1 ELSE 0 END
FROM retry_claim retry CROSS JOIN first_claim first;

SELECT 1 / CASE WHEN retry.jpeg_storage_path = first.jpeg_storage_path THEN 1 ELSE 0 END
FROM retry_claim retry CROSS JOIN first_claim first;

UPDATE public.instagram_story_captures
SET
  status = 'ready',
  generated_at = NOW(),
  jpeg_public_url = 'https://example.invalid/story.jpg'
WHERE product_id = '92000000-0000-4000-8000-000000000001';

CREATE TEMP TABLE repeated_claim AS
SELECT * FROM public.instagram_begin_approval_capture(
  '92000000-0000-4000-8000-000000000001'
);

SELECT 1 / CASE WHEN NOT transitioned AND NOT should_render THEN 1 ELSE 0 END
FROM repeated_claim;

SELECT 1 / CASE WHEN capture_status = 'ready' THEN 1 ELSE 0 END
FROM repeated_claim;

SELECT 1 / CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END
FROM public.instagram_story_captures
WHERE product_id = '92000000-0000-4000-8000-000000000001';

SELECT 1 / CASE WHEN NOT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'instagram_story_captures'
    AND column_name = 'scheduled_at'
) THEN 1 ELSE 0 END;

SELECT 1 / CASE WHEN
  NOT has_table_privilege('anon', 'public.instagram_story_captures', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.instagram_story_captures', 'SELECT')
  THEN 1 ELSE 0 END;

DELETE FROM public.products
WHERE id = '92000000-0000-4000-8000-000000000001';

SELECT 1 / CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END
FROM public.instagram_story_captures
WHERE product_id = '92000000-0000-4000-8000-000000000001';

ROLLBACK;
