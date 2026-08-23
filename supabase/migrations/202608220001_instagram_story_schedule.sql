-- Editorial calendar for Instagram Stories.
-- Three deterministic Chile-time slots per day, with one capture per slot.

ALTER TABLE public.instagram_story_captures
  ADD COLUMN scheduled_local_date DATE,
  ADD COLUMN scheduled_slot SMALLINT,
  ADD COLUMN scheduled_for TIMESTAMPTZ,
  ADD COLUMN schedule_source TEXT,
  ADD COLUMN schedule_updated_at TIMESTAMPTZ;

ALTER TABLE public.instagram_story_captures
  ADD CONSTRAINT instagram_story_schedule_slot_check
    CHECK (scheduled_slot IS NULL OR scheduled_slot BETWEEN 1 AND 3),
  ADD CONSTRAINT instagram_story_schedule_source_check
    CHECK (schedule_source IS NULL OR schedule_source IN ('automatic', 'manual')),
  ADD CONSTRAINT instagram_story_schedule_complete_check
    CHECK (
      (scheduled_local_date IS NULL AND scheduled_slot IS NULL AND scheduled_for IS NULL AND schedule_source IS NULL)
      OR
      (scheduled_local_date IS NOT NULL AND scheduled_slot IS NOT NULL AND scheduled_for IS NOT NULL AND schedule_source IS NOT NULL)
    );

CREATE UNIQUE INDEX instagram_story_schedule_slot_unique_idx
  ON public.instagram_story_captures (scheduled_local_date, scheduled_slot)
  WHERE scheduled_local_date IS NOT NULL;

CREATE INDEX instagram_story_due_queue_idx
  ON public.instagram_story_captures (scheduled_for ASC)
  WHERE status IN ('ready', 'retry')
    AND published_at IS NULL
    AND scheduled_for IS NOT NULL;

-- Any true render restart invalidates the previous publication placement.
-- The existing trigger already calls this function on every update.
CREATE OR REPLACE FUNCTION public.instagram_touch_story_capture()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'generating' AND OLD.status IS DISTINCT FROM 'generating' THEN
    NEW.scheduled_local_date = NULL;
    NEW.scheduled_slot = NULL;
    NEW.scheduled_for = NULL;
    NEW.schedule_source = NULL;
    NEW.schedule_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.instagram_story_slot_time(
  p_local_date DATE,
  p_slot SMALLINT
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_iso_day INTEGER;
  v_base_minutes INTEGER;
  v_minutes INTEGER;
BEGIN
  IF p_slot NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_STORY_SLOT';
  END IF;

  v_iso_day := EXTRACT(ISODOW FROM p_local_date)::INTEGER;
  v_base_minutes := CASE v_iso_day
    WHEN 1 THEN 19 * 60 + 30 -- Monday
    WHEN 2 THEN 19 * 60 + 30 -- Tuesday
    WHEN 3 THEN 19 * 60      -- Wednesday
    WHEN 4 THEN 18 * 60      -- Thursday
    WHEN 5 THEN 17 * 60 + 30 -- Friday
    WHEN 6 THEN 18 * 60 + 30 -- Saturday
    WHEN 7 THEN 19 * 60      -- Sunday
  END;
  v_minutes := v_base_minutes + ((p_slot - 1) * 30);

  RETURN make_timestamptz(
    EXTRACT(YEAR FROM p_local_date)::INTEGER,
    EXTRACT(MONTH FROM p_local_date)::INTEGER,
    EXTRACT(DAY FROM p_local_date)::INTEGER,
    v_minutes / 60,
    v_minutes % 60,
    0,
    'America/Santiago'
  );
END;
$$;

-- Regenerates an existing prepared Story without losing its editorial slot.
-- Both advisory locks prevent another renderer or scheduler from observing
-- the brief generating transition.
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

  -- The shared generating trigger clears old placements for normal retries.
  -- Restore this one inside the same locked transaction for regeneration.
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

CREATE OR REPLACE FUNCTION public.instagram_schedule_capture_next(
  p_capture_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_source TEXT DEFAULT 'automatic'
)
RETURNS TABLE (
  scheduled_local_date DATE,
  scheduled_slot SMALLINT,
  scheduled_for TIMESTAMPTZ,
  schedule_source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capture public.instagram_story_captures%ROWTYPE;
  v_today DATE := (NOW() AT TIME ZONE 'America/Santiago')::DATE;
  v_date DATE;
  v_offset INTEGER;
  v_slot SMALLINT;
  v_time TIMESTAMPTZ;
BEGIN
  PERFORM pg_advisory_xact_lock(748321905118);

  IF p_source NOT IN ('automatic', 'manual') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_SCHEDULE_SOURCE';
  END IF;

  SELECT capture.* INTO v_capture
  FROM public.instagram_story_captures capture
  WHERE capture.id = p_capture_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'CAPTURE_NOT_FOUND';
  END IF;

  IF v_capture.jpeg_public_url IS NULL OR v_capture.generated_at IS NULL
    OR v_capture.status NOT IN ('ready', 'retry') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CAPTURE_NOT_SCHEDULABLE';
  END IF;

  IF v_capture.scheduled_for IS NOT NULL THEN
    RETURN QUERY SELECT
      v_capture.scheduled_local_date,
      v_capture.scheduled_slot,
      v_capture.scheduled_for,
      v_capture.schedule_source;
    RETURN;
  END IF;

  v_date := GREATEST(COALESCE(p_start_date, v_today + 1), v_today);

  FOR v_offset IN 0..365 LOOP
    FOR v_slot IN 1..3 LOOP
      v_time := public.instagram_story_slot_time(v_date + v_offset, v_slot::SMALLINT);
      IF v_time <= NOW() THEN
        CONTINUE;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.instagram_story_captures occupied
        WHERE occupied.scheduled_local_date = v_date + v_offset
          AND occupied.scheduled_slot = v_slot
      ) THEN
        UPDATE public.instagram_story_captures
        SET
          scheduled_local_date = v_date + v_offset,
          scheduled_slot = v_slot,
          scheduled_for = v_time,
          schedule_source = p_source,
          schedule_updated_at = NOW()
        WHERE id = p_capture_id
        RETURNING
          instagram_story_captures.scheduled_local_date,
          instagram_story_captures.scheduled_slot,
          instagram_story_captures.scheduled_for,
          instagram_story_captures.schedule_source
        INTO
          scheduled_local_date,
          scheduled_slot,
          scheduled_for,
          schedule_source;
        RETURN NEXT;
        RETURN;
      END IF;
    END LOOP;
  END LOOP;

  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NO_STORY_SLOT_AVAILABLE';
END;
$$;

CREATE OR REPLACE FUNCTION public.instagram_move_capture_schedule(
  p_capture_id UUID,
  p_local_date DATE,
  p_slot SMALLINT
)
RETURNS TABLE (
  scheduled_local_date DATE,
  scheduled_slot SMALLINT,
  scheduled_for TIMESTAMPTZ,
  schedule_source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capture public.instagram_story_captures%ROWTYPE;
  v_time TIMESTAMPTZ;
BEGIN
  PERFORM pg_advisory_xact_lock(748321905118);
  v_time := public.instagram_story_slot_time(p_local_date, p_slot);

  IF v_time <= NOW() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'STORY_SLOT_IN_PAST';
  END IF;

  SELECT capture.* INTO v_capture
  FROM public.instagram_story_captures capture
  WHERE capture.id = p_capture_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'CAPTURE_NOT_FOUND';
  END IF;

  IF v_capture.status NOT IN ('ready', 'retry') OR v_capture.jpeg_public_url IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CAPTURE_NOT_SCHEDULABLE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.instagram_story_captures occupied
    WHERE occupied.scheduled_local_date = p_local_date
      AND occupied.scheduled_slot = p_slot
      AND occupied.id <> p_capture_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'STORY_SLOT_OCCUPIED';
  END IF;

  UPDATE public.instagram_story_captures
  SET
    scheduled_local_date = p_local_date,
    scheduled_slot = p_slot,
    scheduled_for = v_time,
    schedule_source = 'manual',
    schedule_updated_at = NOW()
  WHERE id = p_capture_id
  RETURNING
    instagram_story_captures.scheduled_local_date,
    instagram_story_captures.scheduled_slot,
    instagram_story_captures.scheduled_for,
    instagram_story_captures.schedule_source
  INTO
    scheduled_local_date,
    scheduled_slot,
    scheduled_for,
    schedule_source;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.instagram_unschedule_capture(
  p_capture_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(748321905118);
  UPDATE public.instagram_story_captures
  SET
    scheduled_local_date = NULL,
    scheduled_slot = NULL,
    scheduled_for = NULL,
    schedule_source = NULL,
    schedule_updated_at = NOW()
  WHERE id = p_capture_id
    AND status IN ('ready', 'retry');
END;
$$;

CREATE OR REPLACE FUNCTION public.instagram_reset_failed_story_publication(
  p_capture_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(748321905118);

  UPDATE public.instagram_story_captures capture
  SET
    status = 'retry',
    attempts = 0,
    container_id = NULL,
    last_error = NULL,
    scheduled_local_date = NULL,
    scheduled_slot = NULL,
    scheduled_for = NULL,
    schedule_source = NULL,
    schedule_updated_at = NOW()
  FROM public.products product
  WHERE capture.id = p_capture_id
    AND capture.product_id = product.id
    AND product.status = 'approved'
    AND capture.status = 'failed'
    AND capture.generated_at IS NOT NULL
    AND capture.jpeg_public_url IS NOT NULL
    AND capture.published_at IS NULL
    AND capture.media_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CAPTURE_NOT_RESETTABLE';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.instagram_reschedule_expired_captures(
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capture_id UUID;
  v_count INTEGER := 0;
  v_tomorrow DATE := (p_now AT TIME ZONE 'America/Santiago')::DATE + 1;
BEGIN
  PERFORM pg_advisory_xact_lock(748321905118);

  FOR v_capture_id IN
    SELECT capture.id
    FROM public.instagram_story_captures capture
    WHERE capture.status IN ('ready', 'retry')
      AND capture.published_at IS NULL
      AND capture.scheduled_for IS NOT NULL
      AND capture.scheduled_for + INTERVAL '59 minutes' < p_now
    ORDER BY capture.scheduled_for ASC
    FOR UPDATE
  LOOP
    UPDATE public.instagram_story_captures
    SET
      scheduled_local_date = NULL,
      scheduled_slot = NULL,
      scheduled_for = NULL,
      schedule_source = NULL,
      schedule_updated_at = p_now,
      container_id = NULL,
      last_error = 'Ventana vencida; captura reasignada al próximo cupo'
    WHERE id = v_capture_id;

    PERFORM public.instagram_schedule_capture_next(v_capture_id, v_tomorrow, 'automatic');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.instagram_reschedule_capture_next(
  p_capture_id UUID,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  scheduled_local_date DATE,
  scheduled_slot SMALLINT,
  scheduled_for TIMESTAMPTZ,
  schedule_source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tomorrow DATE := (p_now AT TIME ZONE 'America/Santiago')::DATE + 1;
BEGIN
  PERFORM pg_advisory_xact_lock(748321905118);

  UPDATE public.instagram_story_captures
  SET
    status = CASE WHEN status = 'publishing' THEN 'retry' ELSE status END,
    scheduled_local_date = NULL,
    scheduled_slot = NULL,
    scheduled_for = NULL,
    schedule_source = NULL,
    schedule_updated_at = p_now,
    container_id = NULL,
    last_error = 'Ventana vencida; captura reasignada al próximo cupo'
  WHERE id = p_capture_id
    AND status IN ('ready', 'retry', 'publishing')
    AND published_at IS NULL
    AND media_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CAPTURE_NOT_RESCHEDULABLE';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.instagram_schedule_capture_next(p_capture_id, v_tomorrow, 'automatic');
END;
$$;

REVOKE ALL ON FUNCTION public.instagram_story_slot_time(DATE, SMALLINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instagram_begin_capture_regeneration(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instagram_schedule_capture_next(UUID, DATE, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instagram_move_capture_schedule(UUID, DATE, SMALLINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instagram_unschedule_capture(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instagram_reset_failed_story_publication(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instagram_reschedule_expired_captures(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instagram_reschedule_capture_next(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.instagram_story_slot_time(DATE, SMALLINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.instagram_begin_capture_regeneration(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.instagram_schedule_capture_next(UUID, DATE, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.instagram_move_capture_schedule(UUID, DATE, SMALLINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.instagram_unschedule_capture(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.instagram_reset_failed_story_publication(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.instagram_reschedule_expired_captures(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.instagram_reschedule_capture_next(UUID, TIMESTAMPTZ) TO service_role;

-- Existing prepared captures enter the next available slots. Failed renders
-- remain visible as unscheduled work in the admin view.
DO $$
DECLARE
  v_capture_id UUID;
BEGIN
  FOR v_capture_id IN
    SELECT id
    FROM public.instagram_story_captures
    WHERE status IN ('ready', 'retry')
      AND jpeg_public_url IS NOT NULL
      AND scheduled_for IS NULL
    ORDER BY approved_at ASC
  LOOP
    PERFORM public.instagram_schedule_capture_next(v_capture_id, NULL, 'automatic');
  END LOOP;
END;
$$;
