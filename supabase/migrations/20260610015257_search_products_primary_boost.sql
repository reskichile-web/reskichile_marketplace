-- Rank refinement: matches on brand/model/type (primary fields) outrank
-- matches that only hit the description/attributes.
CREATE OR REPLACE FUNCTION public.search_products(q TEXT, max_results INT DEFAULT 8, relaxed BOOLEAN DEFAULT FALSE)
RETURNS TABLE(
  id UUID, slug TEXT, brand TEXT, model TEXT, product_type TEXT,
  condition TEXT, price INTEGER, region TEXT, attributes JSONB,
  image_url TEXT, rank REAL
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  nq TEXT := lower(unaccent(trim(q)));
  toks TEXT[];
BEGIN
  IF nq IS NULL OR length(nq) < 2 THEN RETURN; END IF;
  toks := regexp_split_to_array(nq, '\s+');

  RETURN QUERY
  WITH candidates AS (
    SELECT p.*,
           lower(unaccent(concat_ws(' ', p.brand, p.model,
             public.product_type_synonyms(p.product_type)))) AS primary_text
    FROM public.products p
    WHERE p.status = 'approved'
      AND p.search_text IS NOT NULL
      AND (
        CASE WHEN relaxed THEN
          EXISTS (SELECT 1 FROM unnest(toks) t
                  WHERE p.search_text LIKE '%' || t || '%'
                     OR word_similarity(t, p.search_text) > 0.3)
        ELSE
          NOT EXISTS (SELECT 1 FROM unnest(toks) t
                      WHERE NOT (p.search_text LIKE '%' || t || '%'
                              OR word_similarity(t, p.search_text) > 0.35))
        END
      )
  )
  SELECT c.id, c.slug, c.brand, c.model, c.product_type,
         c.condition, c.price, c.region, c.attributes,
         (SELECT pi.url FROM public.product_images pi
           WHERE pi.product_id = c.id ORDER BY pi."order" LIMIT 1),
         (
           (CASE WHEN c.search_text LIKE '%' || nq || '%' THEN 2.0 ELSE 0 END) +
           (CASE WHEN c.primary_text LIKE '%' || nq || '%' THEN 2.0 ELSE 0 END) +
           (SELECT coalesce(sum(
              CASE WHEN c.primary_text LIKE '%' || t || '%' THEN 2.0
                   WHEN c.search_text LIKE '%' || t || '%' THEN 1.0
                   ELSE word_similarity(t, c.search_text) END), 0)
            FROM unnest(toks) t) / greatest(array_length(toks, 1), 1)
         )::real
  FROM candidates c
  ORDER BY 11 DESC, c.created_at DESC
  LIMIT max_results;
END $$;

REVOKE ALL ON FUNCTION public.search_products(TEXT, INT, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.search_products(TEXT, INT, BOOLEAN) TO anon, authenticated;;
