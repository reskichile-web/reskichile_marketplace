-- Starken pasa a ser el courier oficial de ReSkiChile. Conservamos
-- chilexpress en la restricción para no invalidar cotizaciones históricas.
BEGIN;

ALTER TABLE public.shipping_quotes
  DROP CONSTRAINT IF EXISTS shipping_quotes_source_check;

ALTER TABLE public.shipping_quotes
  ADD CONSTRAINT shipping_quotes_source_check
  CHECK (source IN ('sandbox_fixed', 'table', 'chilexpress', 'starken'));

DO $$
DECLARE
  v_definition TEXT;
  v_updated TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.commerce_create_checkout(uuid[],uuid,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,uuid,text,text,text,text,text,integer,boolean)'::regprocedure
  ) INTO v_definition;
  v_updated := replace(
    v_definition,
    'p_shipping_source NOT IN (''sandbox_fixed'', ''table'', ''chilexpress'')',
    'p_shipping_source NOT IN (''sandbox_fixed'', ''table'', ''chilexpress'', ''starken'')'
  );
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'generic checkout shipping source guard was not found';
  END IF;
  EXECUTE v_updated;

  SELECT pg_get_functiondef(
    'public.commerce_create_rack_checkout(jsonb,uuid,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,uuid,text,text,text,text,text,integer,boolean)'::regprocedure
  ) INTO v_definition;
  v_updated := replace(
    v_definition,
    'p_shipping_source NOT IN (''sandbox_fixed'', ''table'', ''chilexpress'')',
    'p_shipping_source NOT IN (''sandbox_fixed'', ''table'', ''chilexpress'', ''starken'')'
  );
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'rack checkout shipping source guard was not found';
  END IF;
  EXECUTE v_updated;
END;
$$;

COMMIT;
