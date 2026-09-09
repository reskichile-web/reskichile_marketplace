BEGIN;

DROP FUNCTION public.admin_products_page(INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT);

CREATE FUNCTION public.admin_products_page(
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 30,
  p_status TEXT DEFAULT 'all',
  p_brand TEXT DEFAULT '',
  p_product_type TEXT DEFAULT '',
  p_search TEXT DEFAULT '',
  p_time_sort TEXT DEFAULT ''
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
  v_time_sort TEXT := CASE
    WHEN lower(coalesce(btrim(p_time_sort), '')) IN ('asc', 'desc')
      THEN lower(btrim(p_time_sort))
    ELSE ''
  END;
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
      SELECT
        filtered.*,
        row_number() OVER (
          ORDER BY
            CASE WHEN v_time_sort = 'asc' THEN days_published END ASC,
            CASE WHEN v_time_sort = 'desc' THEN days_published END DESC,
            CASE WHEN v_time_sort = 'desc' THEN created_at END ASC,
            created_at DESC,
            id
        ) AS sort_position
      FROM filtered
      ORDER BY sort_position
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
      ) ORDER BY row.sort_position), '[]'::JSONB) AS value
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

REVOKE ALL ON FUNCTION public.admin_products_page(INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_products_page(INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
