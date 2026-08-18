-- Full product search: trigram similarity + accent-insensitive substring
-- match over every searchable facet of a product (brand, model, type with
-- Spanish/English synonyms, condition, description, attributes, location).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.products ADD COLUMN search_text TEXT;

-- Type synonyms so "ski", "tabla", "chaqueta" or "gopro" also hit.
CREATE OR REPLACE FUNCTION public.product_type_synonyms(p_type TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_type
    WHEN 'esquis' THEN 'esquis esqui ski skis'
    WHEN 'snowboards' THEN 'snowboard snowboards tabla'
    WHEN 'botas_esqui' THEN 'botas de esqui bota ski boots'
    WHEN 'botas_snowboard' THEN 'botas de snowboard bota boots'
    WHEN 'bastones' THEN 'bastones baston poles'
    WHEN 'cascos' THEN 'casco cascos helmet'
    WHEN 'guantes' THEN 'guantes guante gloves'
    WHEN 'fijaciones' THEN 'fijaciones fijacion bindings'
    WHEN 'parkas' THEN 'parka parkas chaqueta jacket'
    WHEN 'pantalones' THEN 'pantalon pantalones pants'
    WHEN 'antiparras' THEN 'antiparras lentes goggles'
    WHEN 'mochilas' THEN 'mochila mochilas backpack'
    WHEN 'bolsos' THEN 'bolso bolsos bag'
    WHEN 'equipo_avalanchas' THEN 'avalancha arva pala sonda equipo de avalanchas'
    WHEN 'camaras_accion' THEN 'camara camaras de accion gopro'
    ELSE coalesce(p_type, '')
  END;
$$;

CREATE OR REPLACE FUNCTION public.products_search_text_sync()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.search_text := lower(unaccent(concat_ws(' ',
    NEW.brand,
    NEW.model,
    public.product_type_synonyms(NEW.product_type),
    replace(coalesce(NEW.condition, ''), '_', ' '),
    NEW.description,
    NEW.region,
    NEW.comuna,
    (SELECT string_agg(replace(key, '_', ' ') || ' ' || value, ' ')
     FROM jsonb_each_text(coalesce(NEW.attributes, '{}'::jsonb))
     WHERE value NOT IN ('true', 'false', ''))
  )));
  RETURN NEW;
END $$;

CREATE TRIGGER products_search_text_sync
  BEFORE INSERT OR UPDATE OF brand, model, product_type, condition, description, region, comuna, attributes
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_search_text_sync();

-- Backfill existing rows (touch a synced column to fire the trigger)
UPDATE public.products SET brand = brand;

CREATE INDEX products_search_trgm_idx ON public.products USING gin (search_text gin_trgm_ops);

-- The search RPC. SECURITY INVOKER: products RLS applies inside, so anon
-- callers only ever see approved listings.
--   strict (default): every word of the query must match (substring or fuzzy)
--   relaxed: any word may match — the frontend falls back to this so the
--   user always sees something close.
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
  SELECT p.id, p.slug, p.brand, p.model, p.product_type,
         p.condition, p.price, p.region, p.attributes,
         (SELECT pi.url FROM public.product_images pi
           WHERE pi.product_id = p.id ORDER BY pi."order" LIMIT 1),
         (
           (CASE WHEN p.search_text LIKE '%' || nq || '%' THEN 2.0 ELSE 0 END) +
           (SELECT coalesce(sum(
              CASE WHEN p.search_text LIKE '%' || t || '%' THEN 1.0
                   ELSE word_similarity(t, p.search_text) END), 0)
            FROM unnest(toks) t) / greatest(array_length(toks, 1), 1)
         )::real
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
  ORDER BY 11 DESC, p.created_at DESC
  LIMIT max_results;
END $$;

REVOKE ALL ON FUNCTION public.search_products(TEXT, INT, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.search_products(TEXT, INT, BOOLEAN) TO anon, authenticated;;
