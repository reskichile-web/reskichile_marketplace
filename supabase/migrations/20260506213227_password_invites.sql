
CREATE TABLE public.password_invites (
  slug TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX password_invites_user_id_idx ON public.password_invites(user_id);

ALTER TABLE public.password_invites ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role can access (which bypasses RLS).
;
