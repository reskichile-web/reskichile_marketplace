BEGIN;
DO $$
DECLARE
  a JSONB;
  b JSONB;
  sent JSONB;
  v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::DATE;
  v_friday DATE;
  v_prepare_at TIMESTAMPTZ;
  v_scheduled_for TIMESTAMPTZ;
BEGIN
  -- Keep the lease ahead of the transaction clock so this test never expires.
  v_friday := v_today + (1 + ((11 - extract(isodow FROM v_today)::INTEGER) % 7));
  v_scheduled_for := (v_friday + TIME '20:00') AT TIME ZONE 'America/Santiago';
  v_prepare_at := v_scheduled_for - interval '1 hour';

  IF public.instagram_claim_catalog_batch(v_prepare_at - interval '1 minute') IS NOT NULL THEN RAISE EXCEPTION 'generated too early'; END IF;
  a := public.instagram_claim_catalog_batch(v_prepare_at);
  IF a IS NULL OR (a->>'scheduled_for')::timestamptz <> v_scheduled_for THEN RAISE EXCEPTION 'Friday schedule'; END IF;
  IF public.instagram_claim_catalog_batch(v_prepare_at + interval '1 minute') IS NOT NULL THEN RAISE EXCEPTION 'concurrent claim'; END IF;
  b := public.instagram_claim_catalog_batch(v_prepare_at + interval '6 minutes');
  IF b IS NULL OR b->>'lock_token' = a->>'lock_token' THEN RAISE EXCEPTION 'stale lease not replaced'; END IF;
  BEGIN
    PERFORM public.instagram_save_catalog_batch(v_friday, (a->>'lock_token')::uuid, 'ready', '[]', NOW(), 1);
    RAISE EXCEPTION 'old token accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'CATALOG_LEASE_LOST' THEN RAISE; END IF;
  END;
  PERFORM public.instagram_save_catalog_batch(v_friday, (b->>'lock_token')::uuid, 'ready', '[]', NOW(), 1, NULL, TRUE);
  IF public.instagram_claim_catalog_batch(v_prepare_at + interval '30 minutes') IS NOT NULL THEN RAISE EXCEPTION 'ready batch sent early'; END IF;
  b := public.instagram_claim_catalog_batch(v_scheduled_for);
  IF b IS NULL THEN RAISE EXCEPTION 'ready batch not claimed at publication time'; END IF;
  sent := '[{"position":0,"kind":"intro","products":[],"imageUrl":"https://storage.test/a.jpg","containerId":"c1","attemptedAt":"2026-09-11T23:00:00Z","publishedAt":null}]';
  PERFORM public.instagram_save_catalog_batch(v_friday, (b->>'lock_token')::uuid, 'publishing', sent, NOW(), 1);
  BEGIN
    PERFORM public.instagram_save_catalog_batch(v_friday, (b->>'lock_token')::uuid, 'publishing', jsonb_set(sent, '{0,containerId}', '"c2"'), NOW(), 1);
    RAISE EXCEPTION 'attempted container overwritten';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'CATALOG_SENT_SLIDE_IMMUTABLE' THEN RAISE; END IF;
  END;
  PERFORM public.instagram_save_catalog_batch(v_friday, (b->>'lock_token')::uuid, 'published', jsonb_set(sent, '{0,publishedAt}', '"2026-09-11T23:00:01Z"'), NOW(), 1, NULL, TRUE);
  IF public.instagram_claim_catalog_batch(v_scheduled_for + interval '15 minutes') IS NOT NULL THEN RAISE EXCEPTION 'published batch claimed twice'; END IF;
  b := public.instagram_claim_catalog_batch('2026-09-15 22:00:00+00');
  IF b IS NULL OR (b->>'scheduled_for')::timestamptz <> '2026-09-15 23:00:00+00' THEN RAISE EXCEPTION 'Tuesday summer schedule'; END IF;
  b := public.instagram_claim_catalog_batch('2027-07-13 23:00:00+00');
  IF b IS NULL OR (b->>'scheduled_for')::timestamptz <> '2027-07-14 00:00:00+00' THEN RAISE EXCEPTION 'Tuesday winter schedule'; END IF;
  IF public.instagram_claim_catalog_batch('2027-07-15 23:30:00+00') IS NOT NULL THEN RAISE EXCEPTION 'wrong weekday'; END IF;
  IF (SELECT status FROM public.instagram_catalog_batches WHERE local_date = '2027-07-14') <> 'failed' THEN RAISE EXCEPTION 'missed batch invisible'; END IF;
  INSERT INTO public.instagram_catalog_batches(local_date, scheduled_for, prepare_at, status, generated_at, slides)
  VALUES ('2027-07-16', '2027-07-17 00:00:00+00', '2027-07-16 23:00:00+00', 'retry', NOW(), sent);
  b := public.instagram_claim_catalog_batch('2027-07-17 21:30:00+00');
  IF b IS NULL OR b->>'local_date' <> '2027-07-16' THEN RAISE EXCEPTION 'late ambiguous send not reconciled'; END IF;
  IF public.instagram_claim_catalog_batch('2027-07-18 02:00:00+00') IS NOT NULL THEN RAISE EXCEPTION 'confirmation retried beyond recovery window'; END IF;
  IF has_function_privilege('anon', 'public.instagram_claim_catalog_batch(timestamptz)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.instagram_claim_catalog_batch(timestamptz)', 'EXECUTE')
    OR has_table_privilege('authenticated', 'public.instagram_catalog_batches', 'SELECT')
    OR has_table_privilege('anon', 'public.instagram_catalog_batches', 'SELECT')
  THEN RAISE EXCEPTION 'catalog queue exposed'; END IF;
  IF NOT has_function_privilege('service_role', 'public.instagram_claim_catalog_batch(timestamptz)', 'EXECUTE') THEN RAISE EXCEPTION 'service role cannot claim'; END IF;
  BEGIN
    PERFORM public.admin_instagram_catalog_batches('2026-09-10');
    RAISE EXCEPTION 'non-admin read allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
