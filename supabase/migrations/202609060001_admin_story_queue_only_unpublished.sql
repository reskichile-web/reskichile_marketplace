-- The admin story queue is a backlog of products that have never been
-- published. Keep publication history available separately, but do not show
-- already-published products as pending queue items after a reorder/regeneration.
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
        -- A product with any completed publication is history, never a
        -- pending queue item. The aggregate columns cover normal rows and the
        -- EXISTS check also protects against older/inconsistent captures.
        AND (
          capture.id IS NULL
          OR (
            COALESCE(capture.publication_count, 0) = 0
            AND capture.last_published_at IS NULL
            AND capture.published_at IS NULL
            AND NOT EXISTS (
              SELECT 1
              FROM public.instagram_story_publications AS publication
              WHERE publication.product_id = product.id
            )
          )
        )
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

REVOKE ALL ON FUNCTION public.admin_instagram_stories(DATE, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_instagram_stories(DATE, BOOLEAN) TO authenticated;
