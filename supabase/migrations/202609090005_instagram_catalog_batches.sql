BEGIN;
CREATE TABLE public.instagram_catalog_batches (
  local_date DATE PRIMARY KEY,
  scheduled_for TIMESTAMPTZ NOT NULL,
  prepare_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','generating','ready','publishing','retry','failed','published','skipped')),
  generated_at TIMESTAMPTZ,
  generation_attempts INTEGER NOT NULL DEFAULT 0 CHECK (generation_attempts >= 0),
  slides JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(slides) = 'array' AND jsonb_array_length(slides) <= 3),
  last_error TEXT,
  lock_token UUID,
  locked_until TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.instagram_catalog_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.instagram_catalog_batches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.instagram_catalog_batches TO service_role;

-- SQL is the clock and the concurrency authority. One leased worker/date;
-- lease is longer than the function's 300-second hard maximum.
CREATE FUNCTION public.instagram_claim_catalog_batch(p_now TIMESTAMPTZ DEFAULT NOW())
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_date DATE := (p_now AT TIME ZONE 'America/Santiago')::DATE;
  v_time TIMESTAMPTZ; v_batch public.instagram_catalog_batches%ROWTYPE;
BEGIN
  SELECT (v_date + r.local_time) AT TIME ZONE 'America/Santiago' INTO v_time
  FROM public.instagram_catalog_schedule_rules r
  WHERE r.iso_weekday = extract(isodow FROM v_date) AND v_date >= r.effective_from;
  IF v_time IS NOT NULL AND p_now >= v_time - interval '1 hour' THEN
    INSERT INTO public.instagram_catalog_batches(local_date, scheduled_for, prepare_at)
    VALUES (v_date, v_time, v_time - interval '1 hour') ON CONFLICT DO NOTHING;
  END IF;
  -- Never publish yesterday's stale catalog. Preserve evidence for the admin.
  UPDATE public.instagram_catalog_batches SET status = 'failed',
    last_error = 'La ventana de publicación terminó; revisar la tanda.', updated_at = p_now
  WHERE status NOT IN ('published','failed','skipped')
    AND scheduled_for + interval '1 hour' < p_now
    AND (scheduled_for + interval '24 hours' < p_now OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(slides) s
      WHERE s->>'attemptedAt' IS NOT NULL AND s->>'publishedAt' IS NULL
    ))
    AND (locked_until IS NULL OR locked_until <= p_now);
  SELECT * INTO v_batch FROM public.instagram_catalog_batches
  WHERE status NOT IN ('published','failed','skipped') AND prepare_at <= p_now
    AND ((local_date = v_date AND p_now <= scheduled_for + interval '1 hour')
      OR (scheduled_for <= p_now AND p_now <= scheduled_for + interval '24 hours' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(slides) s
        WHERE s->>'attemptedAt' IS NOT NULL AND s->>'publishedAt' IS NULL
      )))
    AND (status <> 'ready' OR scheduled_for <= p_now)
    AND (next_attempt_at IS NULL OR next_attempt_at <= p_now)
    AND (locked_until IS NULL OR locked_until <= p_now)
  ORDER BY (local_date = v_date) DESC, local_date DESC
  LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.instagram_catalog_batches SET lock_token = gen_random_uuid(),
    locked_until = p_now + interval '330 seconds', updated_at = p_now
  WHERE local_date = v_batch.local_date RETURNING * INTO v_batch;
  RETURN to_jsonb(v_batch);
END; $$;

CREATE FUNCTION public.instagram_save_catalog_batch(
  p_date DATE, p_token UUID, p_status TEXT, p_slides JSONB,
  p_generated_at TIMESTAMPTZ, p_generation_attempts INTEGER,
  p_error TEXT DEFAULT NULL, p_release BOOLEAN DEFAULT FALSE
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_old public.instagram_catalog_batches%ROWTYPE; v_slide JSONB; v_new JSONB;
BEGIN
  SELECT * INTO v_old FROM public.instagram_catalog_batches
  WHERE local_date = p_date AND lock_token = p_token AND locked_until > NOW() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CATALOG_LEASE_LOST'; END IF;
  -- Once a send was attempted its payload/container is immutable, even if the
  -- response was lost. A resumed worker must reconcile, never generate a new send.
  FOR v_slide IN SELECT value FROM jsonb_array_elements(v_old.slides) LOOP
    IF v_slide->>'attemptedAt' IS NOT NULL THEN
      SELECT value INTO v_new FROM jsonb_array_elements(p_slides)
      WHERE value->>'position' = v_slide->>'position';
      IF v_new IS NULL OR v_new->'products' IS DISTINCT FROM v_slide->'products'
        OR v_new->'containerId' IS DISTINCT FROM v_slide->'containerId'
        OR v_new->'imageUrl' IS DISTINCT FROM v_slide->'imageUrl'
        OR v_new->'attemptedAt' IS DISTINCT FROM v_slide->'attemptedAt'
        OR (v_slide->>'publishedAt' IS NOT NULL AND v_new->'publishedAt' IS DISTINCT FROM v_slide->'publishedAt')
      THEN RAISE EXCEPTION 'CATALOG_SENT_SLIDE_IMMUTABLE'; END IF;
    END IF;
  END LOOP;
  UPDATE public.instagram_catalog_batches SET status = p_status, slides = p_slides,
    generated_at = p_generated_at, generation_attempts = p_generation_attempts,
    last_error = left(p_error, 500), updated_at = NOW(),
    next_attempt_at = CASE WHEN p_release AND p_status = 'retry' THEN NOW() + interval '2 minutes' ELSE NULL END,
    lock_token = CASE WHEN p_release THEN NULL ELSE lock_token END,
    locked_until = CASE WHEN p_release THEN NULL ELSE NOW() + interval '330 seconds' END
  WHERE local_date = p_date;
  RETURN TRUE;
END; $$;

CREATE FUNCTION public.admin_instagram_catalog_batches(p_history_start DATE DEFAULT CURRENT_DATE)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.admin_viewer();
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
    'localDate', b.local_date, 'scheduledFor', b.scheduled_for, 'prepareAt', b.prepare_at,
    'status', b.status, 'generatedAt', b.generated_at, 'lastError', b.last_error,
    'generationAttempts', b.generation_attempts,
    'slides', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'position', s->'position', 'kind', s->'kind', 'imageUrl', s->'imageUrl', 'publishedAt', s->'publishedAt'
    ) ORDER BY (s->>'position')::integer), '[]') FROM jsonb_array_elements(b.slides) s)
  ) ORDER BY b.local_date) FROM public.instagram_catalog_batches b
  WHERE b.local_date >= p_history_start), '[]');
END; $$;

REVOKE ALL ON FUNCTION public.instagram_claim_catalog_batch(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instagram_save_catalog_batch(DATE,UUID,TEXT,JSONB,TIMESTAMPTZ,INTEGER,TEXT,BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_instagram_catalog_batches(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.instagram_claim_catalog_batch(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.instagram_save_catalog_batch(DATE,UUID,TEXT,JSONB,TIMESTAMPTZ,INTEGER,TEXT,BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_instagram_catalog_batches(DATE) TO authenticated;
COMMIT;
