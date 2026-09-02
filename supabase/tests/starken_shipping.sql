BEGIN;

DO $$
DECLARE
  v_constraint TEXT;
  v_generic_definition TEXT;
  v_rack_definition TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid)
  INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.shipping_quotes'::regclass
    AND conname = 'shipping_quotes_source_check';

  IF v_constraint NOT LIKE '%starken%' THEN
    RAISE EXCEPTION 'shipping quote source constraint does not accept Starken';
  END IF;

  SELECT pg_get_functiondef(
    'public.commerce_create_checkout(uuid[],uuid,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,uuid,text,text,text,text,text,integer,boolean)'::regprocedure
  ) INTO v_generic_definition;
  SELECT pg_get_functiondef(
    'public.commerce_create_rack_checkout(jsonb,uuid,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,uuid,text,text,text,text,text,integer,boolean)'::regprocedure
  ) INTO v_rack_definition;

  IF v_generic_definition NOT LIKE '%''starken''%'
    OR v_rack_definition NOT LIKE '%''starken''%' THEN
    RAISE EXCEPTION 'checkout source guards do not accept Starken';
  END IF;
END;
$$;

ROLLBACK;
