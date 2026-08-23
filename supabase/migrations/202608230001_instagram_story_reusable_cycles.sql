-- Separate the reusable Story asset from each completed Meta publication.
-- A capture returns to ready after every successful send, while this table
-- preserves an immutable audit trail and the capture remains schedulable.

CREATE TABLE public.instagram_story_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id UUID NOT NULL
    REFERENCES public.instagram_story_captures(id) ON DELETE CASCADE,
  product_id UUID NOT NULL
    REFERENCES public.products(id) ON DELETE CASCADE,
  container_id TEXT NOT NULL UNIQUE,
  media_id TEXT UNIQUE,
  published_at TIMESTAMPTZ NOT NULL,
  recovered BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_local_date DATE,
  scheduled_slot SMALLINT,
  scheduled_for TIMESTAMPTZ,
  schedule_source TEXT CHECK (
    schedule_source IS NULL OR schedule_source IN ('automatic', 'manual')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX instagram_story_publications_capture_idx
  ON public.instagram_story_publications (capture_id, published_at DESC);

CREATE INDEX instagram_story_publications_product_idx
  ON public.instagram_story_publications (product_id, published_at DESC);

ALTER TABLE public.instagram_story_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.instagram_story_publications FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.instagram_story_publications TO service_role;

ALTER TABLE public.instagram_story_captures
  ADD COLUMN publication_count INTEGER NOT NULL DEFAULT 0
    CHECK (publication_count >= 0),
  ADD COLUMN last_published_at TIMESTAMPTZ;

-- Preserve any publication completed by the terminal-state implementation.
INSERT INTO public.instagram_story_publications (
  capture_id,
  product_id,
  container_id,
  media_id,
  published_at,
  recovered,
  scheduled_local_date,
  scheduled_slot,
  scheduled_for,
  schedule_source
)
SELECT
  capture.id,
  capture.product_id,
  capture.container_id,
  capture.media_id,
  capture.published_at,
  capture.media_id IS NULL,
  capture.scheduled_local_date,
  capture.scheduled_slot,
  capture.scheduled_for,
  capture.schedule_source
FROM public.instagram_story_captures capture
WHERE capture.status = 'published'
  AND capture.container_id IS NOT NULL
  AND capture.published_at IS NOT NULL
ON CONFLICT (container_id) DO NOTHING;

UPDATE public.instagram_story_captures capture
SET
  publication_count = capture.publication_count
    + CASE WHEN capture.published_at IS NULL THEN 0 ELSE 1 END,
  last_published_at = COALESCE(capture.published_at, capture.last_published_at),
  status = CASE
    WHEN capture.generated_at IS NOT NULL AND capture.jpeg_public_url IS NOT NULL
      THEN 'ready'
    ELSE 'failed'
  END,
  container_id = NULL,
  media_id = NULL,
  published_at = NULL,
  attempts = 0,
  last_error = NULL,
  scheduled_local_date = NULL,
  scheduled_slot = NULL,
  scheduled_for = NULL,
  schedule_source = NULL,
  schedule_updated_at = NOW()
WHERE capture.status = 'published';

CREATE OR REPLACE FUNCTION public.instagram_complete_story_publication(
  p_capture_id UUID,
  p_container_id TEXT,
  p_media_id TEXT DEFAULT NULL,
  p_published_at TIMESTAMPTZ DEFAULT NOW(),
  p_recovered BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capture public.instagram_story_captures%ROWTYPE;
  v_publication_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(748321905119);

  SELECT publication.id INTO v_publication_id
  FROM public.instagram_story_publications publication
  WHERE publication.capture_id = p_capture_id
    AND publication.container_id = p_container_id;

  IF FOUND THEN
    RETURN v_publication_id;
  END IF;

  SELECT capture.* INTO v_capture
  FROM public.instagram_story_captures capture
  WHERE capture.id = p_capture_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'CAPTURE_NOT_FOUND';
  END IF;

  IF v_capture.status <> 'publishing'
    OR v_capture.container_id IS DISTINCT FROM p_container_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CAPTURE_NOT_COMPLETABLE';
  END IF;

  IF NOT p_recovered AND p_media_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MEDIA_ID_REQUIRED';
  END IF;

  INSERT INTO public.instagram_story_publications (
    capture_id,
    product_id,
    container_id,
    media_id,
    published_at,
    recovered,
    scheduled_local_date,
    scheduled_slot,
    scheduled_for,
    schedule_source
  ) VALUES (
    v_capture.id,
    v_capture.product_id,
    p_container_id,
    p_media_id,
    p_published_at,
    p_recovered,
    v_capture.scheduled_local_date,
    v_capture.scheduled_slot,
    v_capture.scheduled_for,
    v_capture.schedule_source
  )
  RETURNING id INTO v_publication_id;

  UPDATE public.instagram_story_captures
  SET
    status = 'ready',
    container_id = NULL,
    media_id = NULL,
    published_at = NULL,
    attempts = 0,
    last_error = NULL,
    scheduled_local_date = NULL,
    scheduled_slot = NULL,
    scheduled_for = NULL,
    schedule_source = NULL,
    schedule_updated_at = p_published_at,
    publication_count = publication_count + 1,
    last_published_at = p_published_at
  WHERE id = v_capture.id;

  RETURN v_publication_id;
END;
$$;

REVOKE ALL ON FUNCTION public.instagram_complete_story_publication(
  UUID, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.instagram_complete_story_publication(
  UUID, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN
) TO service_role;
