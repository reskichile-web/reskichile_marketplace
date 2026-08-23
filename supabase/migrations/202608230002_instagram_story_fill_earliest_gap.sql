-- Manual “add to cron” actions fill the earliest future gap, including today.
-- Automatic approval keeps its original rule of starting tomorrow.

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

  v_date := GREATEST(
    COALESCE(
      p_start_date,
      CASE WHEN p_source = 'manual' THEN v_today ELSE v_today + 1 END
    ),
    v_today
  );

  FOR v_offset IN 0..365 LOOP
    FOR v_slot IN
      SELECT rule.slot
      FROM public.instagram_story_schedule_rules rule
      WHERE rule.iso_weekday = EXTRACT(ISODOW FROM (v_date + v_offset))::SMALLINT
      ORDER BY rule.slot
    LOOP
      v_time := public.instagram_story_slot_time(v_date + v_offset, v_slot);
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

REVOKE ALL ON FUNCTION public.instagram_schedule_capture_next(UUID, DATE, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.instagram_schedule_capture_next(UUID, DATE, TEXT)
  TO service_role;
