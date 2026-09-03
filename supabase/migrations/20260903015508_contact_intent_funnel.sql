-- Contact-intent funnel: impression -> intent -> contact, by campaign and by
-- product. Intent events are stored as event_type='click' with event_name
-- 'contact_intent_whatsapp' / 'contact_intent_chat' and are emitted BEFORE the
-- login gate, so an anonymous click that bounced off /auth/login is finally
-- distinguishable from no click at all (user_id IS NULL marks those).

CREATE INDEX IF NOT EXISTS events_contact_intent_created_idx
  ON public.events (created_at DESC)
  WHERE event_type = 'click' AND event_name LIKE 'contact_intent_%';

-- Both RPCs are SECURITY INVOKER: the admin-only SELECT policy on events
-- applies inside, so a non-admin caller simply gets zero rows.
CREATE OR REPLACE FUNCTION public.admin_contact_funnel(p_since TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE(
  campaign TEXT,
  content TEXT,
  source TEXT,
  medium TEXT,
  pageviews BIGINT,
  product_views BIGINT,
  visitors BIGINT,
  intents BIGINT,
  intent_visitors BIGINT,
  anonymous_intents BIGINT,
  whatsapp_intents BIGINT,
  chat_intents BIGINT,
  contacts BIGINT
)
LANGUAGE sql SECURITY INVOKER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    e.utm_campaign,
    e.utm_content,
    e.utm_source,
    e.utm_medium,
    (count(*) FILTER (WHERE e.event_type = 'pageview'))::BIGINT,
    (count(*) FILTER (WHERE e.event_type = 'product_view'))::BIGINT,
    (count(DISTINCT e.visitor_id) FILTER (WHERE e.event_type = 'product_view'))::BIGINT,
    (count(*) FILTER (WHERE e.event_name LIKE 'contact_intent_%'))::BIGINT,
    (count(DISTINCT e.visitor_id) FILTER (WHERE e.event_name LIKE 'contact_intent_%'))::BIGINT,
    (count(*) FILTER (WHERE e.event_name LIKE 'contact_intent_%' AND e.user_id IS NULL))::BIGINT,
    (count(*) FILTER (WHERE e.event_name = 'contact_intent_whatsapp'))::BIGINT,
    (count(*) FILTER (WHERE e.event_name = 'contact_intent_chat'))::BIGINT,
    (count(*) FILTER (WHERE e.event_name IN ('whatsapp_contact','chat_contact')))::BIGINT
  FROM public.events e
  WHERE (p_since IS NULL OR e.created_at >= p_since)
    AND (
      e.event_type IN ('pageview','product_view')
      OR (
        e.event_type = 'click'
        AND (
          e.event_name LIKE 'contact_intent_%'
          OR e.event_name IN ('whatsapp_contact','chat_contact')
        )
      )
    )
  GROUP BY e.utm_campaign, e.utm_content, e.utm_source, e.utm_medium
  ORDER BY 6 DESC, 5 DESC;
$$;
REVOKE ALL ON FUNCTION public.admin_contact_funnel(TIMESTAMPTZ) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_contact_funnel(TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_product_funnel(
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 15
)
RETURNS TABLE(
  product_id UUID,
  brand TEXT,
  model TEXT,
  slug TEXT,
  price INTEGER,
  product_views BIGINT,
  visitors BIGINT,
  intents BIGINT,
  anonymous_intents BIGINT,
  contacts BIGINT
)
LANGUAGE sql SECURITY INVOKER STABLE
SET search_path = public, pg_temp
AS $$
  WITH funnel AS (
    SELECT
      e.product_id AS pid,
      (count(*) FILTER (WHERE e.event_type = 'product_view'))::BIGINT AS product_views,
      (count(DISTINCT e.visitor_id) FILTER (WHERE e.event_type = 'product_view'))::BIGINT AS visitors,
      (count(*) FILTER (WHERE e.event_name LIKE 'contact_intent_%'))::BIGINT AS intents,
      (count(*) FILTER (WHERE e.event_name LIKE 'contact_intent_%' AND e.user_id IS NULL))::BIGINT AS anonymous_intents,
      (count(*) FILTER (WHERE e.event_name IN ('whatsapp_contact','chat_contact')))::BIGINT AS contacts
    FROM public.events e
    WHERE e.product_id IS NOT NULL
      AND (p_since IS NULL OR e.created_at >= p_since)
      AND (
        e.event_type = 'product_view'
        OR (
          e.event_type = 'click'
          AND (
            e.event_name LIKE 'contact_intent_%'
            OR e.event_name IN ('whatsapp_contact','chat_contact')
          )
        )
      )
    GROUP BY e.product_id
  )
  SELECT
    p.id, p.brand, p.model, p.slug, p.price,
    f.product_views, f.visitors, f.intents, f.anonymous_intents, f.contacts
  FROM funnel f
  JOIN public.products p ON p.id = f.pid
  ORDER BY f.product_views DESC, f.intents DESC
  LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION public.admin_product_funnel(TIMESTAMPTZ, INT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_product_funnel(TIMESTAMPTZ, INT) TO authenticated;;
