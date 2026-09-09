-- Three editorial blocks/day. On catalog days two daytime product slots and
-- one reserved catalog sequence. This reservation does NOT enable catalog sending.
BEGIN;

SELECT pg_advisory_xact_lock(748321905117);
SELECT pg_advisory_xact_lock(748321905118);
LOCK TABLE public.instagram_story_captures IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.instagram_story_captures
    WHERE status IN ('generating', 'publishing') AND scheduled_for IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'STORY_SCHEDULE_BUSY: retry after active work finishes';
  END IF;
END;
$$;

CREATE TABLE public.instagram_catalog_schedule_rules (
  iso_weekday SMALLINT PRIMARY KEY CHECK (iso_weekday IN (3, 5, 7)),
  local_time TIME WITHOUT TIME ZONE NOT NULL,
  editorial_slot SMALLINT NOT NULL DEFAULT 3 CHECK (editorial_slot = 3),
  effective_from DATE NOT NULL DEFAULT '2026-09-10'
);
ALTER TABLE public.instagram_catalog_schedule_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.instagram_catalog_schedule_rules FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.instagram_catalog_schedule_rules TO service_role;
INSERT INTO public.instagram_catalog_schedule_rules (iso_weekday, local_time) VALUES
  (3, '19:30'), (5, '20:00'), (7, '20:00');

-- These rules are exclusively assignable product slots. Keeping catalog
-- reservations separate makes both automatic assignment and manual moves reject
-- the reserved third slot using the existing instagram_story_slot_time RPC.
DELETE FROM public.instagram_story_schedule_rules;
INSERT INTO public.instagram_story_schedule_rules (iso_weekday, slot, local_time) VALUES
  (1, 1, '19:30'), (1, 2, '19:45'), (1, 3, '20:00'),
  (2, 1, '19:30'), (2, 2, '19:45'), (2, 3, '20:00'),
  (3, 1, '11:30'), (3, 2, '12:30'),
  (4, 1, '18:00'), (4, 2, '18:15'), (4, 3, '18:30'),
  (5, 1, '11:30'), (5, 2, '12:30'),
  (6, 1, '18:30'), (6, 2, '18:45'), (6, 3, '19:00'),
  (7, 1, '11:30'), (7, 2, '12:30');

-- Successful publication clears its reusable capture's schedule. The history
-- must ALSO occupy that slot, or "add to cron" could refill a consumed slot.
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
      ) AND NOT EXISTS (
        SELECT 1 FROM public.instagram_story_publications publication
        WHERE publication.scheduled_local_date = v_date + v_offset
          AND publication.scheduled_slot = v_slot
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
  ) OR EXISTS (
    SELECT 1 FROM public.instagram_story_publications publication
    WHERE publication.scheduled_local_date = p_local_date
      AND publication.scheduled_slot = p_slot
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



-- Preserve all completed history. Reflow only unpublished placements, in their
-- existing order, never before their original date or the new effective date.
CREATE TEMP TABLE instagram_schedule_reflow ON COMMIT DROP AS
SELECT id, scheduled_for, scheduled_local_date, schedule_source
FROM public.instagram_story_captures
WHERE scheduled_for IS NOT NULL AND published_at IS NULL AND media_id IS NULL;

UPDATE public.instagram_story_captures
SET scheduled_local_date = NULL, scheduled_slot = NULL, scheduled_for = NULL,
    schedule_source = NULL, schedule_updated_at = NOW(), container_id = NULL
WHERE id IN (SELECT id FROM instagram_schedule_reflow);

DO $$
DECLARE
  v_row RECORD;
BEGIN
  FOR v_row IN SELECT * FROM instagram_schedule_reflow ORDER BY scheduled_for, id LOOP
    IF EXISTS (
      SELECT 1 FROM public.instagram_story_captures
      WHERE id = v_row.id AND status IN ('ready', 'retry')
        AND jpeg_public_url IS NOT NULL AND generated_at IS NOT NULL
    ) THEN
      PERFORM public.instagram_schedule_capture_next(
        v_row.id,
        GREATEST(v_row.scheduled_local_date, DATE '2026-09-10',
          (NOW() AT TIME ZONE 'America/Santiago')::DATE),
        COALESCE(v_row.schedule_source, 'automatic')
      );
    END IF;
  END LOOP;
END;
$$;
COMMIT;
