-- A row represents one confirmed product sheet, not a rendered export or intro.
BEGIN;
CREATE TABLE public.instagram_catalog_publications (
  container_id TEXT PRIMARY KEY CHECK (length(btrim(container_id)) BETWEEN 1 AND 100),
  media_id TEXT UNIQUE CHECK (media_id IS NULL OR length(btrim(media_id)) BETWEEN 1 AND 100),
  product_ids UUID[] NOT NULL CHECK (cardinality(product_ids) BETWEEN 1 AND 9),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX instagram_catalog_publications_products_idx
  ON public.instagram_catalog_publications USING gin (product_ids);
ALTER TABLE public.instagram_catalog_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.instagram_catalog_publications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.instagram_catalog_publications TO service_role;

-- Trusted server callback only, after verifying PUBLISHED with Meta. Retries
-- reuse the same row and original confirmation time; they never reset cooldown.
CREATE FUNCTION public.instagram_record_catalog_publication(
  p_container_id TEXT, p_media_id TEXT, p_product_ids UUID[]
)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_publication public.instagram_catalog_publications%ROWTYPE;
BEGIN
  IF p_product_ids IS NULL OR cardinality(p_product_ids) NOT BETWEEN 1 AND 9
    OR EXISTS (SELECT 1 FROM unnest(p_product_ids) AS product_id WHERE product_id IS NULL)
    OR (SELECT count(DISTINCT product_id) FROM unnest(p_product_ids) AS product_id) <> cardinality(p_product_ids)
  THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_CATALOG_PRODUCTS'; END IF;

  INSERT INTO public.instagram_catalog_publications (container_id, media_id, product_ids)
  VALUES (p_container_id, p_media_id, p_product_ids)
  ON CONFLICT (container_id) DO NOTHING;

  SELECT * INTO STRICT v_publication FROM public.instagram_catalog_publications
  WHERE container_id = p_container_id;
  IF NOT (v_publication.product_ids @> p_product_ids AND v_publication.product_ids <@ p_product_ids)
    OR (p_media_id IS NOT NULL AND v_publication.media_id IS NOT NULL AND p_media_id <> v_publication.media_id)
  THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATALOG_PUBLICATION_CONFLICT'; END IF;
  RETURN v_publication.published_at;
END;
$$;

CREATE FUNCTION public.instagram_catalog_last_appearances(
  p_product_ids UUID[], p_until TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (product_id UUID, last_published_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT item.product_id, max(publication.published_at)
  FROM public.instagram_catalog_publications publication
  CROSS JOIN LATERAL unnest(publication.product_ids) AS item(product_id)
  WHERE publication.product_ids && p_product_ids
    AND item.product_id = ANY(p_product_ids) AND publication.published_at <= p_until
  GROUP BY item.product_id;
$$;

REVOKE ALL ON FUNCTION public.instagram_record_catalog_publication(TEXT, TEXT, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instagram_catalog_last_appearances(UUID[], TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.instagram_record_catalog_publication(TEXT, TEXT, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.instagram_catalog_last_appearances(UUID[], TIMESTAMPTZ) TO service_role;
COMMIT;
