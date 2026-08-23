-- Incremental installation for installations that applied the Story calendar
-- migration before regeneration was introduced.

CREATE OR REPLACE FUNCTION public.instagram_begin_capture_regeneration(
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
  v_scheduled_local_date DATE;
  v_scheduled_slot SMALLINT;
  v_scheduled_for TIMESTAMPTZ;
  v_schedule_source TEXT;
  v_schedule_updated_at TIMESTAMPTZ;
BEGIN
  PERFORM pg_advisory_xact_lock(748321905117);
  PERFORM pg_advisory_xact_lock(748321905118);

  SELECT product.status INTO v_product_status
  FROM public.products product
  WHERE product.id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'PRODUCT_NOT_FOUND';
  END IF;
  IF v_product_status <> 'approved' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCT_NOT_APPROVED';
  END IF;

  SELECT capture.* INTO v_capture
  FROM public.instagram_story_captures capture
  WHERE capture.product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_capture.status NOT IN ('ready', 'retry', 'failed')
    OR v_capture.generated_at IS NULL
    OR v_capture.jpeg_public_url IS NULL
    OR v_capture.published_at IS NOT NULL
    OR v_capture.media_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CAPTURE_NOT_REGENERATABLE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.instagram_story_captures active_capture
    WHERE active_capture.status = 'generating'
      AND active_capture.id <> v_capture.id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CAPTURE_GENERATION_BUSY';
  END IF;

  v_scheduled_local_date := v_capture.scheduled_local_date;
  v_scheduled_slot := v_capture.scheduled_slot;
  v_scheduled_for := v_capture.scheduled_for;
  v_schedule_source := v_capture.schedule_source;
  v_schedule_updated_at := v_capture.schedule_updated_at;

  UPDATE public.instagram_story_captures
  SET
    status = 'generating',
    generated_at = NULL,
    container_id = NULL,
    attempts = 0,
    last_error = NULL
  WHERE id = v_capture.id
  RETURNING * INTO v_capture;

  UPDATE public.instagram_story_captures
  SET
    scheduled_local_date = v_scheduled_local_date,
    scheduled_slot = v_scheduled_slot,
    scheduled_for = v_scheduled_for,
    schedule_source = v_schedule_source,
    schedule_updated_at = v_schedule_updated_at
  WHERE id = v_capture.id
  RETURNING * INTO v_capture;

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

REVOKE ALL ON FUNCTION public.instagram_begin_capture_regeneration(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.instagram_begin_capture_regeneration(UUID)
  TO service_role;
