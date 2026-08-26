-- Persist the required signup phone in the same transaction that creates the
-- public profile. Client-side writes made before email/OTP confirmation run as
-- anon and can be rejected by RLS, so they must not be the only copy.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_phone TEXT := NULLIF(BTRIM(NEW.raw_user_meta_data->>'phone'), '');
BEGIN
  -- User metadata is client supplied. Only copy the canonical E.164-shaped
  -- value accepted by public.users; malformed/missing metadata remains NULL
  -- for admin-created and legacy accounts.
  IF v_phone IS NOT NULL AND v_phone !~ '^\+[0-9]{8,15}$' THEN
    v_phone := NULL;
  END IF;

  INSERT INTO public.users (id, email, name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(BTRIM(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    v_phone
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
