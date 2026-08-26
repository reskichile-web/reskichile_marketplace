-- Persist the last non-direct campaign touch alongside first-party analytics.
-- Existing rows remain valid and keep NULL attribution fields.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS attribution_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS events_utm_campaign_created_idx
  ON public.events (utm_campaign, created_at DESC)
  WHERE utm_campaign IS NOT NULL;

COMMENT ON COLUMN public.events.attribution_at IS
  'Time the current browser last arrived with explicit UTM campaign parameters.';
