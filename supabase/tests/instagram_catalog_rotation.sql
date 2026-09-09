BEGIN;
DO $$
DECLARE
  v_ids UUID[] := ARRAY['99000000-0000-4000-8000-000000000001', '99000000-0000-4000-8000-000000000002']::UUID[];
  v_first TIMESTAMPTZ;
  v_retry TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  -- An empty history is legitimate only after a successful database read.
  SELECT count(*) INTO v_count FROM public.instagram_catalog_last_appearances(v_ids);
  IF v_count <> 0 THEN RAISE EXCEPTION 'unexpected initial history'; END IF;

  SELECT public.instagram_record_catalog_publication('catalog-test-1', 'catalog-media-1', v_ids) INTO v_first;
  -- Simulate an earlier confirmation to make a timestamp-reset bug observable.
  UPDATE public.instagram_catalog_publications SET published_at = NOW() - INTERVAL '3 days'
  WHERE container_id = 'catalog-test-1';
  SELECT public.instagram_record_catalog_publication('catalog-test-1', 'catalog-media-1', v_ids) INTO v_retry;
  IF v_retry <> v_first - INTERVAL '3 days' THEN RAISE EXCEPTION 'retry reset cooldown'; END IF;
  SELECT count(*) INTO v_count FROM public.instagram_catalog_publications WHERE container_id = 'catalog-test-1';
  IF v_count <> 1 THEN RAISE EXCEPTION 'duplicated confirmation'; END IF;

  SELECT count(*) INTO v_count FROM public.instagram_catalog_last_appearances(v_ids)
  WHERE last_published_at = v_retry;
  IF v_count <> 2 THEN RAISE EXCEPTION 'not all products on the sheet were recorded'; END IF;
  SELECT count(*) INTO v_count FROM public.instagram_catalog_last_appearances(v_ids, NOW() - INTERVAL '4 days');
  IF v_count <> 0 THEN RAISE EXCEPTION 'history ignored snapshot bound'; END IF;

  PERFORM public.instagram_record_catalog_publication('catalog-test-2', 'catalog-media-2', ARRAY[v_ids[1]]);
  SELECT count(*) INTO v_count FROM public.instagram_catalog_last_appearances(v_ids)
  WHERE product_id = v_ids[1] AND last_published_at = NOW();
  IF v_count <> 1 THEN RAISE EXCEPTION 'did not use latest confirmed sheet'; END IF;

  BEGIN
    PERFORM public.instagram_record_catalog_publication('catalog-test-1', 'catalog-media-1', ARRAY[v_ids[1]]);
    RAISE EXCEPTION 'conflicting retry accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.instagram_record_catalog_publication('bad-duplicate', NULL, ARRAY[v_ids[1], v_ids[1]]);
    RAISE EXCEPTION 'duplicate product accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.instagram_record_catalog_publication('bad-empty', NULL, ARRAY[]::UUID[]);
    RAISE EXCEPTION 'empty intro accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.instagram_record_catalog_publication('bad-null', NULL, ARRAY[NULL]::UUID[]);
    RAISE EXCEPTION 'null product accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END;
$$;

SELECT 1 / CASE WHEN
  NOT has_table_privilege('anon', 'public.instagram_catalog_publications', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.instagram_catalog_publications', 'INSERT')
  AND NOT has_function_privilege('authenticated', 'public.instagram_record_catalog_publication(text,text,uuid[])', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.instagram_catalog_last_appearances(uuid[],timestamptz)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.instagram_record_catalog_publication(text,text,uuid[])', 'EXECUTE')
  THEN 1 ELSE 0 END;
ROLLBACK;
