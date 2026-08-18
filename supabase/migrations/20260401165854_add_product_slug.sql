
-- Add slug column to products
ALTER TABLE public.products ADD COLUMN slug TEXT;

-- Create unique index on slug
CREATE UNIQUE INDEX idx_products_slug ON public.products(slug) WHERE slug IS NOT NULL;

-- Backfill existing products with slugs
UPDATE public.products SET slug =
  lower(
    regexp_replace(
      regexp_replace(
        translate(
          brand || COALESCE('-' || model, '') || '-' || left(id::text, 8),
          'áéíóúñÁÉÍÓÚÑ ',
          'aeiounAEIOUN-'
        ),
        '[^a-zA-Z0-9-]', '', 'g'
      ),
      '-+', '-', 'g'
    )
  );
;
