-- Resolve the authenticated admin header in one database round trip. The
-- previous layout called GoTrue and then public.users serially on every RSC
-- navigation before the page query could even start.

CREATE OR REPLACE FUNCTION public.admin_viewer()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.users%ROWTYPE;
BEGIN
  SELECT profile.*
  INTO v_profile
  FROM public.users AS profile
  WHERE profile.id = auth.uid()
    AND profile.is_admin = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'userId', v_profile.id,
    'email', v_profile.email,
    'userName', v_profile.name,
    'avatarUrl', v_profile.avatar_url
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_viewer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_viewer() TO authenticated;
