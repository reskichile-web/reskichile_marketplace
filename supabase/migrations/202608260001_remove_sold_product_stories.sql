-- A sold marketplace product behaves like a deleted product for Instagram:
-- release its future calendar slot, remove its reusable capture and immutable
-- publication history, and enqueue every JPEG path for deletion through the
-- Storage API. The queue keeps physical cleanup retryable and idempotent.

CREATE TABLE public.instagram_story_cleanup_queue (
  product_id UUID PRIMARY KEY,
  storage_paths TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (COALESCE(array_length(storage_paths, 1), 0) > 0)
);

ALTER TABLE public.instagram_story_cleanup_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.instagram_story_cleanup_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.instagram_story_cleanup_queue TO service_role;

CREATE OR REPLACE FUNCTION public.instagram_remove_story_when_product_sold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paths TEXT[];
BEGIN
  IF NEW.status IS DISTINCT FROM 'sold' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Serialize against schedule/move RPCs so the released slot is immediately
  -- reusable and cannot be reassigned to this capture mid-transition.
  PERFORM pg_advisory_xact_lock(748321905118);

  SELECT ARRAY(
    SELECT DISTINCT path
    FROM unnest(ARRAY[
      '_instagram/products/' || NEW.id::TEXT || '/story.jpg',
      (
        SELECT capture.jpeg_storage_path
        FROM public.instagram_story_captures capture
        WHERE capture.product_id = NEW.id
      )
    ]) AS path
    WHERE path IS NOT NULL AND path <> ''
    ORDER BY path
  ) INTO v_paths;

  INSERT INTO public.instagram_story_cleanup_queue (
    product_id,
    storage_paths,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_paths,
    NOW(),
    NOW()
  )
  ON CONFLICT (product_id) DO UPDATE
  SET
    storage_paths = (
      SELECT ARRAY_AGG(DISTINCT path ORDER BY path)
      FROM unnest(
        instagram_story_cleanup_queue.storage_paths || EXCLUDED.storage_paths
      ) AS path
    ),
    updated_at = NOW();

  -- instagram_story_publications references captures with ON DELETE CASCADE,
  -- matching the cleanup semantics of deleting the product itself.
  DELETE FROM public.instagram_story_captures
  WHERE product_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_remove_instagram_story_when_sold ON public.products;
CREATE TRIGGER products_remove_instagram_story_when_sold
AFTER UPDATE OF status ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.instagram_remove_story_when_product_sold();

REVOKE ALL ON FUNCTION public.instagram_remove_story_when_product_sold()
  FROM PUBLIC, anon, authenticated;

-- Repair any sold product that was still occupying a calendar slot before
-- this rule existed, while preserving the path for the Storage worker.
INSERT INTO public.instagram_story_cleanup_queue (
  product_id,
  storage_paths,
  created_at,
  updated_at
)
SELECT
  capture.product_id,
  ARRAY(
    SELECT DISTINCT path
    FROM unnest(ARRAY[
      '_instagram/products/' || capture.product_id::TEXT || '/story.jpg',
      capture.jpeg_storage_path
    ]) AS path
    WHERE path IS NOT NULL AND path <> ''
    ORDER BY path
  ),
  NOW(),
  NOW()
FROM public.instagram_story_captures capture
JOIN public.products product ON product.id = capture.product_id
WHERE product.status = 'sold'
ON CONFLICT (product_id) DO UPDATE
SET
  storage_paths = (
    SELECT ARRAY_AGG(DISTINCT path ORDER BY path)
    FROM unnest(
      instagram_story_cleanup_queue.storage_paths || EXCLUDED.storage_paths
    ) AS path
  ),
  updated_at = NOW();

DELETE FROM public.instagram_story_captures capture
USING public.products product
WHERE capture.product_id = product.id
  AND product.status = 'sold';
