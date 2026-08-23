BEGIN;

CREATE TABLE public.feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL CHECK (
    char_length(btrim(message)) BETWEEN 2 AND 1000
  ),
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  page_path TEXT CHECK (
    page_path IS NULL
    OR (left(page_path, 1) = '/' AND char_length(page_path) <= 500)
  ),
  rating_token_hash TEXT NOT NULL UNIQUE CHECK (
    rating_token_hash ~ '^[0-9a-f]{64}$'
  ),
  rated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX feedback_comments_created_at_idx
  ON public.feedback_comments (created_at DESC);

CREATE INDEX feedback_comments_user_id_idx
  ON public.feedback_comments (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;

-- Feedback is written through the public API and read through the admin API.
-- Both endpoints use the service role; browsers never receive table access.
REVOKE ALL ON public.feedback_comments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_comments TO service_role;

CREATE OR REPLACE FUNCTION public.feedback_touch_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.feedback_touch_comment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feedback_touch_comment() TO service_role;

CREATE TRIGGER feedback_comments_touch_updated_at
BEFORE UPDATE ON public.feedback_comments
FOR EACH ROW EXECUTE FUNCTION public.feedback_touch_comment();

COMMIT;
