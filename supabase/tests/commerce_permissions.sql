-- Permission regression test. Supabase's direct default grants are reproduced
-- by bootstrap.sql, so revoking only from PUBLIC will fail this test.

DO $$
DECLARE
  exposed_function REGPROCEDURE;
BEGIN
  SELECT procedure.oid::REGPROCEDURE
  INTO exposed_function
  FROM pg_proc procedure
  JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname LIKE 'commerce\_%' ESCAPE '\'
    AND (
      has_function_privilege('anon', procedure.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    )
  ORDER BY procedure.oid
  LIMIT 1;

  IF exposed_function IS NOT NULL THEN
    RAISE EXCEPTION 'commerce RPC remains exposed: %', exposed_function;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN (
        'commerce_create_rack_checkout',
        'commerce_finalize_webpay'
      )
      AND NOT has_function_privilege('service_role', procedure.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'service_role lost a required commerce grant';
  END IF;
END
$$;
