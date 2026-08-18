-- Last analytics event (login, signup, pageview, click, product_view) per user.
CREATE OR REPLACE FUNCTION public.admin_user_last_activity()
RETURNS TABLE(user_id UUID, last_activity TIMESTAMPTZ)
LANGUAGE sql SECURITY INVOKER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT e.user_id, max(e.created_at)
  FROM public.events e
  WHERE e.user_id IS NOT NULL
  GROUP BY e.user_id;
$$;
REVOKE ALL ON FUNCTION public.admin_user_last_activity() FROM public;
REVOKE ALL ON FUNCTION public.admin_user_last_activity() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_user_last_activity() TO authenticated;

-- Covering index for the group-by (and the FK advisor warning)
CREATE INDEX IF NOT EXISTS events_user_idx ON public.events (user_id) WHERE user_id IS NOT NULL;;
