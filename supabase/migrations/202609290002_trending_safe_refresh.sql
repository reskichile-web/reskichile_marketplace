BEGIN;

-- PostgREST sessions load safeupdate, which rejects DELETE without a WHERE
-- clause, even inside this SECURITY DEFINER function. Keep its protection and
-- explicitly target the ranking's valid positions when replacing membership.
CREATE OR REPLACE FUNCTION public.refresh_trending_products()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_now TIMESTAMPTZ;
BEGIN
  PERFORM pg_advisory_xact_lock(20260929, 40);
  v_now := clock_timestamp();
  DELETE FROM public.trending_products WHERE position BETWEEN 1 AND 40;
  INSERT INTO public.trending_products (product_id, position, refreshed_at)
  WITH eligible AS MATERIALIZED (
    SELECT p.id, p.created_at
    FROM public.products p
    WHERE p.status = 'approved' AND p.price > 0
      AND nullif(btrim(p.slug), '') IS NOT NULL
      AND nullif(btrim(p.brand), '') IS NOT NULL
      AND p.condition IN ('nuevo', 'nuevo_sellado', 'usado_como_nuevo', 'usado_buen_estado', 'usado_aceptable')
      AND EXISTS (SELECT 1 FROM public.product_images i
        WHERE i.product_id = p.id AND btrim(i.url) ~* '^https?://[^/[:space:]]+')
  ), activity AS (
    SELECT e.product_id,
      count(DISTINCT (coalesce(e.user_id::TEXT, e.visitor_id::TEXT, e.id::TEXT),
        (e.created_at AT TIME ZONE 'UTC')::DATE))
        FILTER (WHERE e.event_type = 'product_view') AS views,
      count(DISTINCT coalesce(e.user_id::TEXT, e.visitor_id::TEXT, e.id::TEXT))
        FILTER (WHERE e.event_type = 'click'
          AND e.event_name IN ('whatsapp_contact', 'chat_contact')) AS contacts
    FROM public.events e JOIN eligible p ON p.id = e.product_id
    WHERE e.created_at >= v_now - interval '30 days' AND e.created_at <= v_now
      AND (e.event_type = 'product_view'
        OR (e.event_type = 'click' AND e.event_name IN ('whatsapp_contact', 'chat_contact')))
    GROUP BY e.product_id
  ), signals AS (
    SELECT p.*, ln(1 + coalesce(a.contacts, 0)) AS contacts,
      ln(1 + coalesce(a.views, 0)) AS views,
      power(0.5::NUMERIC, greatest(0, extract(epoch FROM (v_now - coalesce(p.created_at, v_now)))) / 1209600) AS novelty
    FROM eligible p LEFT JOIN activity a ON a.product_id = p.id
  ), scored AS (
    SELECT *,
      0.45 * contacts / greatest(1, max(contacts) OVER ())
      + 0.30 * views / greatest(1, max(views) OVER ())
      + 0.25 * novelty AS score
    FROM signals
  )
  SELECT id, row_number() OVER (ORDER BY score DESC, created_at DESC NULLS LAST, id)::INTEGER, v_now
  FROM scored ORDER BY score DESC, created_at DESC NULLS LAST, id LIMIT 40;
END;
$$;

COMMIT;
