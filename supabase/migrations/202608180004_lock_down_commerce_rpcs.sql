-- Emergency hardening: Supabase projects may grant EXECUTE on newly-created
-- functions directly to anon and authenticated. Revoking only from PUBLIC is
-- therefore insufficient for SECURITY DEFINER commerce routines.

BEGIN;

DO $$
DECLARE
  target_function REGPROCEDURE;
BEGIN
  FOR target_function IN
    SELECT procedure.oid::REGPROCEDURE
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname LIKE 'commerce\_%' ESCAPE '\'
  LOOP
    EXECUTE FORMAT(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      target_function
    );
    EXECUTE FORMAT(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      target_function
    );
  END LOOP;
END
$$;

-- Make future functions private by default. Public/authenticated RPCs must be
-- granted deliberately in their own reviewed migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

COMMIT;
