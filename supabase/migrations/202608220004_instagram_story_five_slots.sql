-- Expand the Instagram editorial calendar to five configurable slots per day.
-- Slot times live in data so future capacity changes do not require rewriting
-- the scheduling functions.

CREATE TABLE public.instagram_story_schedule_rules (
  iso_weekday SMALLINT NOT NULL CHECK (iso_weekday BETWEEN 1 AND 7),
  slot SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 24),
  local_time TIME WITHOUT TIME ZONE NOT NULL,
  PRIMARY KEY (iso_weekday, slot),
  UNIQUE (iso_weekday, local_time)
);

ALTER TABLE public.instagram_story_schedule_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.instagram_story_schedule_rules FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.instagram_story_schedule_rules TO service_role;

INSERT INTO public.instagram_story_schedule_rules (iso_weekday, slot, local_time) VALUES
  (1, 1, '19:30'), (1, 2, '19:45'), (1, 3, '20:00'), (1, 4, '20:15'), (1, 5, '20:30'),
  (2, 1, '19:30'), (2, 2, '19:45'), (2, 3, '20:00'), (2, 4, '20:15'), (2, 5, '20:30'),
  (3, 1, '19:00'), (3, 2, '19:15'), (3, 3, '19:30'), (3, 4, '19:45'), (3, 5, '20:00'),
  (4, 1, '18:00'), (4, 2, '18:15'), (4, 3, '18:30'), (4, 4, '18:45'), (4, 5, '19:00'),
  (5, 1, '17:30'), (5, 2, '17:45'), (5, 3, '18:00'), (5, 4, '18:15'), (5, 5, '18:30'),
  (6, 1, '18:30'), (6, 2, '18:45'), (6, 3, '19:00'), (6, 4, '19:15'), (6, 5, '19:30'),
  (7, 1, '19:00'), (7, 2, '19:15'), (7, 3, '19:30'), (7, 4, '19:45'), (7, 5, '20:00');

ALTER TABLE public.instagram_story_captures
  DROP CONSTRAINT instagram_story_schedule_slot_check,
  ADD CONSTRAINT instagram_story_schedule_slot_check
    CHECK (scheduled_slot IS NULL OR scheduled_slot BETWEEN 1 AND 24);

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
  v_local_time TIME WITHOUT TIME ZONE;
BEGIN
  SELECT rule.local_time INTO v_local_time
  FROM public.instagram_story_schedule_rules rule
  WHERE rule.iso_weekday = EXTRACT(ISODOW FROM p_local_date)::SMALLINT
    AND rule.slot = p_slot;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_STORY_SLOT';
  END IF;

  RETURN (p_local_date + v_local_time) AT TIME ZONE 'America/Santiago';
END;
$$;

-- Keep pending calendar rows aligned with the new five-slot timetable. Existing
-- products retain their date and relative slot, while their timestamp is moved
-- to the corresponding quarter-hour rule.
UPDATE public.instagram_story_captures capture
SET
  scheduled_for = public.instagram_story_slot_time(
    capture.scheduled_local_date,
    capture.scheduled_slot
  ),
  schedule_updated_at = NOW()
WHERE capture.scheduled_local_date IS NOT NULL
  AND capture.scheduled_slot IS NOT NULL
  AND capture.published_at IS NULL;

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

REVOKE ALL ON FUNCTION public.instagram_story_slot_time(DATE, SMALLINT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instagram_schedule_capture_next(UUID, DATE, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.instagram_story_slot_time(DATE, SMALLINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.instagram_schedule_capture_next(UUID, DATE, TEXT)
  TO service_role;
