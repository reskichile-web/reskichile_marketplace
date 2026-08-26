-- Admin screens used to fetch and assemble whole tables in the browser before
-- showing a single page. Keep each initial screen to one indexed database call.

CREATE INDEX IF NOT EXISTS events_user_created_idx
  ON public.events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_pageview_created_idx
  ON public.events (created_at DESC)
  WHERE event_type = 'pageview';

CREATE INDEX IF NOT EXISTS products_status_created_idx
  ON public.products (status, created_at DESC, id);

CREATE INDEX IF NOT EXISTS product_images_product_order_idx
  ON public.product_images (product_id, "order");

CREATE INDEX IF NOT EXISTS messages_created_idx
  ON public.messages (created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_dashboard_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;

  v_today_start := date_trunc(
    'day', timezone('America/Santiago', now())
  ) AT TIME ZONE 'America/Santiago';

  RETURN (
    WITH product_stats AS (
      SELECT
        count(*)::BIGINT AS total,
        count(*) FILTER (WHERE status = 'pending')::BIGINT AS pending,
        count(*) FILTER (WHERE status = 'approved')::BIGINT AS approved,
        count(*) FILTER (WHERE status = 'sold')::BIGINT AS sold
      FROM public.products
    ),
    pending_rows AS (
      SELECT
        product.id,
        product.product_type,
        product.brand,
        product.model,
        product.price,
        product.created_at,
        CASE WHEN seller.id IS NULL THEN NULL ELSE jsonb_build_object(
          'name', seller.name,
          'email', seller.email
        ) END AS seller,
        CASE WHEN image.url IS NULL THEN '[]'::JSONB ELSE jsonb_build_array(
          jsonb_build_object('url', image.url, 'order', image."order")
        ) END AS images
      FROM public.products AS product
      LEFT JOIN public.users AS seller ON seller.id = product.seller_id
      LEFT JOIN LATERAL (
        SELECT product_image.url, product_image."order"
        FROM public.product_images AS product_image
        WHERE product_image.product_id = product.id
        ORDER BY product_image."order"
        LIMIT 1
      ) AS image ON TRUE
      WHERE product.status = 'pending'
      ORDER BY product.created_at ASC, product.id ASC
      LIMIT 12
    ),
    pending_json AS (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', row.id,
        'product_type', row.product_type,
        'brand', row.brand,
        'model', row.model,
        'price', row.price,
        'created_at', row.created_at,
        'users', row.seller,
        'product_images', row.images
      ) ORDER BY row.created_at, row.id), '[]'::JSONB) AS value
      FROM pending_rows AS row
    ),
    recent_candidates AS (
      SELECT
        event.id,
        event.path,
        event.created_at,
        event.country,
        event.city,
        event.visitor_id,
        event.user_id
      FROM public.events AS event
      WHERE event.event_type = 'pageview'
      ORDER BY event.created_at DESC
      LIMIT 250
    ),
    recent_ranked AS (
      SELECT
        candidate.*,
        row_number() OVER (
          PARTITION BY coalesce(candidate.visitor_id::TEXT, 'event:' || candidate.id::TEXT)
          ORDER BY candidate.created_at DESC
        ) AS visitor_rank
      FROM recent_candidates AS candidate
    ),
    recent_rows AS (
      SELECT
        ranked.id,
        ranked.path,
        ranked.created_at,
        ranked.country,
        ranked.city,
        ranked.visitor_id,
        CASE WHEN visitor.id IS NULL THEN NULL ELSE jsonb_build_object(
          'name', visitor.name
        ) END AS visitor
      FROM recent_ranked AS ranked
      LEFT JOIN public.users AS visitor ON visitor.id = ranked.user_id
      WHERE ranked.visitor_rank = 1
      ORDER BY ranked.created_at DESC
      LIMIT 25
    ),
    recent_visits_json AS (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', row.id,
        'path', row.path,
        'created_at', row.created_at,
        'country', row.country,
        'city', row.city,
        'visitor_id', row.visitor_id,
        'users', row.visitor
      ) ORDER BY row.created_at DESC), '[]'::JSONB) AS value
      FROM recent_rows AS row
    ),
    today_stats AS (
      SELECT
        count(*)::BIGINT AS visits,
        count(DISTINCT visitor_id)::BIGINT AS uniques
      FROM public.events
      WHERE event_type = 'pageview'
        AND created_at >= v_today_start
    ),
    message_rows AS (
      SELECT
        message.id,
        message.body,
        message.created_at,
        message.conversation_id,
        message.read_at,
        CASE WHEN sender.id IS NULL THEN NULL ELSE jsonb_build_object(
          'name', sender.name
        ) END AS sender,
        CASE WHEN conversation.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id', conversation.id,
          'products', CASE WHEN product.id IS NULL THEN NULL ELSE jsonb_build_object(
            'brand', product.brand,
            'model', product.model
          ) END
        ) END AS conversation
      FROM public.messages AS message
      LEFT JOIN public.users AS sender ON sender.id = message.sender_id
      LEFT JOIN public.conversations AS conversation ON conversation.id = message.conversation_id
      LEFT JOIN public.products AS product ON product.id = conversation.product_id
      ORDER BY message.created_at DESC
      LIMIT 20
    ),
    messages_json AS (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', row.id,
        'body', row.body,
        'created_at', row.created_at,
        'conversation_id', row.conversation_id,
        'read_at', row.read_at,
        'sender', row.sender,
        'conversations', row.conversation
      ) ORDER BY row.created_at DESC), '[]'::JSONB) AS value
      FROM message_rows AS row
    ),
    whatsapp_rows AS (
      SELECT
        event.id,
        event.created_at,
        CASE WHEN visitor.id IS NULL THEN NULL ELSE jsonb_build_object(
          'name', visitor.name,
          'email', visitor.email
        ) END AS visitor,
        CASE WHEN product.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id', product.id,
          'brand', product.brand,
          'model', product.model,
          'slug', product.slug
        ) END AS product
      FROM public.events AS event
      LEFT JOIN public.users AS visitor ON visitor.id = event.user_id
      LEFT JOIN public.products AS product ON product.id = event.product_id
      WHERE event.event_type = 'click'
        AND event.event_name = 'whatsapp_contact'
      ORDER BY event.created_at DESC
      LIMIT 20
    ),
    whatsapp_json AS (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', row.id,
        'created_at', row.created_at,
        'users', row.visitor,
        'products', row.product
      ) ORDER BY row.created_at DESC), '[]'::JSONB) AS value
      FROM whatsapp_rows AS row
    )
    SELECT jsonb_build_object(
      'stats', jsonb_build_object(
        'total', product_stats.total,
        'pending', product_stats.pending,
        'approved', product_stats.approved,
        'sold', product_stats.sold,
        'visitsToday', today_stats.visits,
        'uniquesToday', today_stats.uniques
      ),
      'pending', pending_json.value,
      'visits', recent_visits_json.value,
      'recentMessages', messages_json.value,
      'recentWhatsappClicks', whatsapp_json.value
    )
    FROM product_stats, pending_json, recent_visits_json, today_stats, messages_json, whatsapp_json
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_users_page(
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 30,
  p_status TEXT DEFAULT 'all',
  p_search TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offset INTEGER := least(greatest(coalesce(p_offset, 0), 0), 100000);
  v_limit INTEGER := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_status TEXT := coalesce(nullif(btrim(p_status), ''), 'all');
  v_search TEXT := lower(coalesce(btrim(p_search), ''));
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH base AS (
      SELECT
        profile.id,
        profile.email,
        profile.name,
        profile.phone,
        profile.instagram,
        profile.is_admin,
        profile.must_change_password,
        profile.keep,
        profile.created_at,
        profile.avatar_url,
        auth_user.email_confirmed_at,
        greatest(activity.last_activity, auth_user.last_sign_in_at) AS last_activity,
        CASE
          WHEN profile.keep IS FALSE THEN 'inactive'
          WHEN profile.must_change_password THEN 'pending_access'
          ELSE 'active'
        END AS access_status
      FROM public.users AS profile
      LEFT JOIN auth.users AS auth_user ON auth_user.id = profile.id
      LEFT JOIN LATERAL (
        SELECT event.created_at AS last_activity
        FROM public.events AS event
        WHERE event.user_id = profile.id
        ORDER BY event.created_at DESC
        LIMIT 1
      ) AS activity ON TRUE
    ),
    stats AS (
      SELECT
        count(*)::BIGINT AS total,
        count(*) FILTER (WHERE access_status = 'active')::BIGINT AS active,
        count(*) FILTER (WHERE access_status = 'pending_access')::BIGINT AS pending_access,
        count(*) FILTER (WHERE access_status = 'inactive')::BIGINT AS inactive
      FROM base
    ),
    filtered AS (
      SELECT *
      FROM base
      WHERE (v_status = 'all' OR access_status = v_status)
        AND (
          v_search = ''
          OR lower(concat_ws(' ', email, name, phone)) LIKE '%' || v_search || '%'
        )
    ),
    page_rows AS (
      SELECT *
      FROM filtered
      ORDER BY
        CASE WHEN lower(email) IN ('sebastian.derpsch@gmail.com', 'reskichile@gmail.com') THEN 1 ELSE 0 END,
        last_activity DESC NULLS LAST,
        created_at DESC,
        id
      OFFSET v_offset
      LIMIT v_limit
    ),
    enriched_rows AS (
      SELECT
        page.*,
        coalesce(product_count.value, 0)::BIGINT AS product_count
      FROM page_rows AS page
      LEFT JOIN LATERAL (
        SELECT count(*)::BIGINT AS value
        FROM public.products AS product
        WHERE product.seller_id = page.id
      ) AS product_count ON TRUE
    ),
    rows_json AS (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', row.id,
        'email', row.email,
        'name', row.name,
        'phone', row.phone,
        'instagram', row.instagram,
        'is_admin', row.is_admin,
        'must_change_password', row.must_change_password,
        'keep', row.keep,
        'created_at', row.created_at,
        'avatar_url', row.avatar_url,
        'product_count', row.product_count,
        'email_confirmed_at', row.email_confirmed_at,
        'email_deliverable', NULL,
        'last_activity', row.last_activity
      ) ORDER BY
        CASE WHEN lower(row.email) IN ('sebastian.derpsch@gmail.com', 'reskichile@gmail.com') THEN 1 ELSE 0 END,
        row.last_activity DESC NULLS LAST,
        row.created_at DESC,
        row.id
      ), '[]'::JSONB) AS value
      FROM enriched_rows AS row
    )
    SELECT jsonb_build_object(
      'users', rows_json.value,
      'stats', jsonb_build_object(
        'total', stats.total,
        'active', stats.active,
        'pendingAccess', stats.pending_access,
        'inactive', stats.inactive
      ),
      'currentUserId', auth.uid(),
      'totalCount', (SELECT count(*)::BIGINT FROM filtered)
    )
    FROM stats, rows_json
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_products_page(
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 30,
  p_status TEXT DEFAULT 'all',
  p_brand TEXT DEFAULT '',
  p_product_type TEXT DEFAULT '',
  p_search TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offset INTEGER := least(greatest(coalesce(p_offset, 0), 0), 100000);
  v_limit INTEGER := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_status TEXT := coalesce(nullif(btrim(p_status), ''), 'all');
  v_brand TEXT := coalesce(btrim(p_brand), '');
  v_product_type TEXT := coalesce(btrim(p_product_type), '');
  v_search TEXT := lower(coalesce(btrim(p_search), ''));
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH base AS (
      SELECT
        product.id,
        product.slug,
        product.product_type,
        product.brand,
        product.model,
        product.price,
        product.sale_price,
        product.status,
        product.created_at,
        product.days_published,
        product.sale_reminder_sent_at,
        product.seller_id,
        product.anon_contact,
        seller.id AS user_id,
        seller.name AS user_name,
        seller.email AS user_email
      FROM public.products AS product
      LEFT JOIN public.users AS seller ON seller.id = product.seller_id
    ),
    filtered AS (
      SELECT *
      FROM base
      WHERE (v_status = 'all' OR status = v_status)
        AND (v_brand = '' OR brand = v_brand)
        AND (v_product_type = '' OR product_type = v_product_type)
        AND (
          v_search = ''
          OR lower(concat_ws(' ', brand, model, user_name, user_email)) LIKE '%' || v_search || '%'
        )
    ),
    page_rows AS (
      SELECT *
      FROM filtered
      ORDER BY created_at DESC, id
      OFFSET v_offset
      LIMIT v_limit
    ),
    enriched_rows AS (
      SELECT
        page.*,
        image.url AS image_url,
        image."order" AS image_order,
        coalesce(views.value, 0)::BIGINT AS view_count
      FROM page_rows AS page
      LEFT JOIN LATERAL (
        SELECT product_image.url, product_image."order"
        FROM public.product_images AS product_image
        WHERE product_image.product_id = page.id
        ORDER BY product_image."order"
        LIMIT 1
      ) AS image ON TRUE
      LEFT JOIN LATERAL (
        SELECT count(*)::BIGINT AS value
        FROM public.events AS event
        WHERE event.product_id = page.id
          AND event.event_type = 'product_view'
      ) AS views ON TRUE
    ),
    status_groups AS (
      SELECT status, count(*)::BIGINT AS value
      FROM public.products
      GROUP BY status
    ),
    facets AS (
      SELECT
        jsonb_build_object('all', (SELECT count(*)::BIGINT FROM public.products))
          || coalesce(jsonb_object_agg(status, value), '{}'::JSONB) AS status_counts,
        coalesce(
          (SELECT to_jsonb(array_agg(brand ORDER BY brand))
           FROM (SELECT DISTINCT brand FROM public.products WHERE brand IS NOT NULL) AS brands),
          '[]'::JSONB
        ) AS brands
      FROM status_groups
    ),
    rows_json AS (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', row.id,
        'slug', row.slug,
        'product_type', row.product_type,
        'brand', row.brand,
        'model', row.model,
        'price', row.price,
        'sale_price', row.sale_price,
        'status', row.status,
        'created_at', row.created_at,
        'days_published', row.days_published,
        'sale_reminder_sent_at', row.sale_reminder_sent_at,
        'seller_id', row.seller_id,
        'anon_contact', row.anon_contact,
        'users', CASE WHEN row.user_id IS NULL THEN NULL ELSE jsonb_build_object(
          'name', row.user_name,
          'email', row.user_email
        ) END,
        'product_images', CASE WHEN row.image_url IS NULL THEN '[]'::JSONB ELSE jsonb_build_array(
          jsonb_build_object('url', row.image_url, 'order', row.image_order)
        ) END,
        'details_loaded', FALSE,
        'view_count', row.view_count
      ) ORDER BY row.created_at DESC, row.id), '[]'::JSONB) AS value
      FROM enriched_rows AS row
    )
    SELECT jsonb_build_object(
      'products', rows_json.value,
      'viewCounts', coalesce((
        SELECT jsonb_object_agg(row.id::TEXT, row.view_count)
        FROM enriched_rows AS row
      ), '{}'::JSONB),
      'facets', jsonb_build_object(
        'statusCounts', facets.status_counts,
        'brands', facets.brands
      ),
      'totalCount', (SELECT count(*)::BIGINT FROM filtered)
    )
    FROM rows_json, facets
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_instagram_stories(
  p_history_start DATE,
  p_include_uncaptured BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH product_rows AS (
      SELECT
        product.id,
        product.brand,
        product.model,
        product.slug,
        product.product_type,
        product.price,
        image.url AS image_url,
        capture.id AS capture_id,
        capture.status AS capture_status,
        capture.jpeg_public_url,
        capture.approved_at,
        capture.generated_at,
        capture.updated_at,
        capture.scheduled_local_date,
        capture.scheduled_slot,
        capture.scheduled_for,
        capture.schedule_source,
        capture.container_id,
        capture.media_id,
        capture.published_at,
        capture.publication_count,
        capture.last_published_at,
        capture.attempts,
        capture.last_error
      FROM public.products AS product
      LEFT JOIN public.instagram_story_captures AS capture ON capture.product_id = product.id
      LEFT JOIN LATERAL (
        SELECT product_image.url
        FROM public.product_images AS product_image
        WHERE product_image.product_id = product.id
        ORDER BY product_image."order"
        LIMIT 1
      ) AS image ON TRUE
      WHERE product.status = 'approved'
        AND (p_include_uncaptured OR capture.id IS NOT NULL)
      ORDER BY product.created_at DESC, product.id
    ),
    products_json AS (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', row.id,
        'title', concat_ws(' ', row.brand, row.model),
        'slug', coalesce(row.slug, row.id::TEXT),
        'productType', row.product_type,
        'price', row.price,
        'imageUrl', row.image_url,
        'capture', CASE WHEN row.capture_id IS NULL THEN NULL ELSE jsonb_build_object(
          'id', row.capture_id,
          'productId', row.id,
          'status', row.capture_status,
          'jpegPublicUrl', row.jpeg_public_url,
          'approvedAt', row.approved_at,
          'generatedAt', row.generated_at,
          'updatedAt', row.updated_at,
          'scheduledLocalDate', row.scheduled_local_date,
          'scheduledSlot', row.scheduled_slot,
          'scheduledFor', row.scheduled_for,
          'scheduleSource', row.schedule_source,
          'containerId', row.container_id,
          'mediaId', row.media_id,
          'publishedAt', row.published_at,
          'publicationCount', row.publication_count,
          'lastPublishedAt', row.last_published_at,
          'attempts', row.attempts,
          'lastError', row.last_error
        ) END
      ) ORDER BY row.id), '[]'::JSONB) AS value
      FROM product_rows AS row
    ),
    publication_rows AS (
      SELECT
        publication.id,
        publication.capture_id,
        publication.product_id,
        publication.container_id,
        publication.media_id,
        publication.published_at,
        publication.recovered,
        publication.scheduled_local_date,
        publication.scheduled_slot,
        publication.scheduled_for,
        publication.schedule_source,
        product.brand,
        product.model,
        product.slug,
        product.product_type,
        image.url AS image_url
      FROM public.instagram_story_publications AS publication
      JOIN public.products AS product ON product.id = publication.product_id
      LEFT JOIN LATERAL (
        SELECT product_image.url
        FROM public.product_images AS product_image
        WHERE product_image.product_id = product.id
        ORDER BY product_image."order"
        LIMIT 1
      ) AS image ON TRUE
      WHERE publication.scheduled_local_date IS NOT NULL
        AND publication.scheduled_local_date >= p_history_start
      ORDER BY publication.scheduled_local_date DESC, publication.scheduled_slot DESC
    ),
    publications_json AS (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', row.id,
        'captureId', row.capture_id,
        'productId', row.product_id,
        'title', concat_ws(' ', row.brand, row.model),
        'slug', coalesce(row.slug, row.product_id::TEXT),
        'productType', row.product_type,
        'imageUrl', row.image_url,
        'containerId', row.container_id,
        'mediaId', row.media_id,
        'publishedAt', row.published_at,
        'recovered', row.recovered,
        'scheduledLocalDate', row.scheduled_local_date,
        'scheduledSlot', row.scheduled_slot,
        'scheduledFor', row.scheduled_for,
        'scheduleSource', row.schedule_source
      ) ORDER BY row.scheduled_local_date DESC, row.scheduled_slot DESC), '[]'::JSONB) AS value
      FROM publication_rows AS row
    )
    SELECT jsonb_build_object(
      'products', products_json.value,
      'publications', publications_json.value
    )
    FROM products_json, publications_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_snapshot() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_users_page(INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_products_page(INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_instagram_stories(DATE, BOOLEAN) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_users_page(INTEGER, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_products_page(INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_instagram_stories(DATE, BOOLEAN) TO authenticated;
