-- One deterministic Instagram Story capture per marketplace product.
-- Publishing is intentionally not implemented in this migration; a later
-- worker/cron can consume rows whose status is ready or retry.

CREATE TABLE public.instagram_story_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL UNIQUE
    REFERENCES public.products(id) ON DELETE CASCADE,
  jpeg_storage_path TEXT NOT NULL,
  jpeg_public_url TEXT,
  approved_at TIMESTAMPTZ NOT NULL,
  generated_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'generating' CHECK (
    status IN ('generating', 'ready', 'publishing', 'published', 'retry', 'failed')
  ),
  container_id TEXT,
  media_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX instagram_story_single_generator_idx
  ON public.instagram_story_captures ((status))
  WHERE status = 'generating';

CREATE UNIQUE INDEX instagram_story_container_unique_idx
  ON public.instagram_story_captures (container_id)
  WHERE container_id IS NOT NULL;

CREATE UNIQUE INDEX instagram_story_media_unique_idx
  ON public.instagram_story_captures (media_id)
  WHERE media_id IS NOT NULL;

CREATE INDEX instagram_story_publish_queue_idx
  ON public.instagram_story_captures (approved_at ASC)
  WHERE status IN ('ready', 'retry') AND published_at IS NULL;

ALTER TABLE public.instagram_story_captures ENABLE ROW LEVEL SECURITY;

-- No client policies: captures are managed only through authenticated admin
-- endpoints that use the service-role client.

CREATE OR REPLACE FUNCTION public.instagram_touch_story_capture()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER instagram_story_captures_touch_updated_at
BEFORE UPDATE ON public.instagram_story_captures
FOR EACH ROW EXECUTE FUNCTION public.instagram_touch_story_capture();

-- Atomically approves a product and claims the single global render slot.
-- Repeated approval of a ready capture returns that row without changing it,
-- generating again, or signalling another approval transition.
CREATE OR REPLACE FUNCTION public.instagram_begin_approval_capture(
  p_product_id UUID
)
RETURNS TABLE (
  capture_id UUID,
  capture_status TEXT,
  transitioned BOOLEAN,
  should_render BOOLEAN,
  jpeg_storage_path TEXT,
  jpeg_public_url TEXT,
  approved_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  last_error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_status TEXT;
  v_capture public.instagram_story_captures%ROWTYPE;
  v_transitioned BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Serializes approval/retry claims, including requests from separate tabs.
  PERFORM pg_advisory_xact_lock(748321905117);

  SELECT p.status
  INTO v_product_status
  FROM public.products p
  WHERE p.id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'PRODUCT_NOT_FOUND';
  END IF;

  IF v_product_status NOT IN (
    'draft', 'pending', 'rejected', 'missing_photos', 'approved'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCT_NOT_APPROVABLE';
  END IF;

  SELECT capture.*
  INTO v_capture
  FROM public.instagram_story_captures capture
  WHERE capture.product_id = p_product_id
  FOR UPDATE;

  IF v_product_status = 'approved' AND v_capture.id IS NOT NULL THEN
    RETURN QUERY SELECT
      v_capture.id,
      v_capture.status,
      FALSE,
      FALSE,
      v_capture.jpeg_storage_path,
      v_capture.jpeg_public_url,
      v_capture.approved_at,
      v_capture.generated_at,
      v_capture.updated_at,
      v_capture.last_error;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.instagram_story_captures active_capture
    WHERE active_capture.status = 'generating'
      AND active_capture.product_id <> p_product_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CAPTURE_GENERATION_BUSY';
  END IF;

  IF v_product_status <> 'approved' THEN
    UPDATE public.products
    SET status = 'approved', rejection_reason = NULL
    WHERE id = p_product_id;
    v_transitioned := TRUE;
  END IF;

  IF v_capture.id IS NULL THEN
    INSERT INTO public.instagram_story_captures (
      product_id,
      jpeg_storage_path,
      approved_at,
      status
    ) VALUES (
      p_product_id,
      '_instagram/products/' || p_product_id::TEXT || '/story.jpg',
      v_now,
      'generating'
    )
    RETURNING * INTO v_capture;
  ELSE
    UPDATE public.instagram_story_captures
    SET
      status = 'generating',
      approved_at = v_now,
      generated_at = NULL,
      jpeg_public_url = NULL,
      container_id = NULL,
      media_id = NULL,
      attempts = 0,
      last_error = NULL,
      published_at = NULL
    WHERE id = v_capture.id
    RETURNING * INTO v_capture;
  END IF;

  RETURN QUERY SELECT
    v_capture.id,
    v_capture.status,
    v_transitioned,
    TRUE,
    v_capture.jpeg_storage_path,
    v_capture.jpeg_public_url,
    v_capture.approved_at,
    v_capture.generated_at,
    v_capture.updated_at,
    v_capture.last_error;
END;
$$;

-- Claims the same deterministic capture for a render-only retry. It never
-- changes product status and never creates a second row or storage path.
CREATE OR REPLACE FUNCTION public.instagram_begin_capture_retry(
  p_product_id UUID
)
RETURNS TABLE (
  capture_id UUID,
  capture_status TEXT,
  should_render BOOLEAN,
  jpeg_storage_path TEXT,
  jpeg_public_url TEXT,
  approved_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  last_error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_status TEXT;
  v_capture public.instagram_story_captures%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(748321905117);

  SELECT p.status
  INTO v_product_status
  FROM public.products p
  WHERE p.id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'PRODUCT_NOT_FOUND';
  END IF;

  IF v_product_status <> 'approved' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCT_NOT_APPROVED';
  END IF;

  SELECT capture.*
  INTO v_capture
  FROM public.instagram_story_captures capture
  WHERE capture.product_id = p_product_id
  FOR UPDATE;

  IF v_capture.id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.instagram_story_captures WHERE status = 'generating'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CAPTURE_GENERATION_BUSY';
    END IF;

    INSERT INTO public.instagram_story_captures (
      product_id,
      jpeg_storage_path,
      approved_at,
      status
    ) VALUES (
      p_product_id,
      '_instagram/products/' || p_product_id::TEXT || '/story.jpg',
      NOW(),
      'generating'
    )
    RETURNING * INTO v_capture;
  ELSIF v_capture.status = 'ready' THEN
    RETURN QUERY SELECT
      v_capture.id,
      v_capture.status,
      FALSE,
      v_capture.jpeg_storage_path,
      v_capture.jpeg_public_url,
      v_capture.approved_at,
      v_capture.generated_at,
      v_capture.updated_at,
      v_capture.last_error;
    RETURN;
  ELSIF v_capture.status IN ('generating', 'publishing', 'published') THEN
    RETURN QUERY SELECT
      v_capture.id,
      v_capture.status,
      FALSE,
      v_capture.jpeg_storage_path,
      v_capture.jpeg_public_url,
      v_capture.approved_at,
      v_capture.generated_at,
      v_capture.updated_at,
      v_capture.last_error;
    RETURN;
  ELSIF v_capture.generated_at IS NOT NULL THEN
    -- A generated capture that failed later belongs to publishing recovery,
    -- not to the render retry button.
    RETURN QUERY SELECT
      v_capture.id,
      v_capture.status,
      FALSE,
      v_capture.jpeg_storage_path,
      v_capture.jpeg_public_url,
      v_capture.approved_at,
      v_capture.generated_at,
      v_capture.updated_at,
      v_capture.last_error;
    RETURN;
  ELSE
    IF EXISTS (
      SELECT 1
      FROM public.instagram_story_captures active_capture
      WHERE active_capture.status = 'generating'
        AND active_capture.product_id <> p_product_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CAPTURE_GENERATION_BUSY';
    END IF;

    UPDATE public.instagram_story_captures
    SET status = 'generating', last_error = NULL
    WHERE id = v_capture.id
    RETURNING * INTO v_capture;
  END IF;

  RETURN QUERY SELECT
    v_capture.id,
    v_capture.status,
    TRUE,
    v_capture.jpeg_storage_path,
    v_capture.jpeg_public_url,
    v_capture.approved_at,
    v_capture.generated_at,
    v_capture.updated_at,
    v_capture.last_error;
END;
$$;

REVOKE ALL ON TABLE public.instagram_story_captures FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.instagram_story_captures TO service_role;

REVOKE ALL ON FUNCTION public.instagram_touch_story_capture() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instagram_begin_approval_capture(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instagram_begin_capture_retry(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.instagram_begin_approval_capture(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.instagram_begin_capture_retry(UUID) TO service_role;
