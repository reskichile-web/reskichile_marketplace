-- Publications and price reductions share one chronological catalogue queue.
-- A reduction moves a product to the front once, but does not pin discounted
-- products above listings published afterwards.
BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS catalog_bumped_at TIMESTAMPTZ;

-- `previous_price` became available in 202609040001, so that migration is the
-- earliest possible bump for legacy discounts whose exact reduction time was
-- not recorded. Ordinary products retain their original publication order.
UPDATE public.products
SET catalog_bumped_at = CASE
  WHEN previous_price IS NOT NULL AND previous_price > price
    THEN GREATEST(created_at, TIMESTAMPTZ '2026-09-04 00:01:00+00')
  ELSE created_at
END
WHERE catalog_bumped_at IS NULL;

ALTER TABLE public.products
  ALTER COLUMN catalog_bumped_at SET DEFAULT NOW(),
  ALTER COLUMN catalog_bumped_at SET NOT NULL;

COMMENT ON COLUMN public.products.catalog_bumped_at IS
  'Position in the recent catalogue queue; refreshed on publication or price reduction.';

CREATE OR REPLACE FUNCTION public.products_refresh_catalog_bump()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.catalog_bumped_at := COALESCE(NEW.created_at, clock_timestamp());
  ELSIF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    NEW.catalog_bumped_at := clock_timestamp();
  ELSIF NEW.price < OLD.price THEN
    NEW.catalog_bumped_at := clock_timestamp();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_refresh_catalog_bump ON public.products;
CREATE TRIGGER products_refresh_catalog_bump
BEFORE INSERT OR UPDATE OF price, status ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_refresh_catalog_bump();

CREATE INDEX IF NOT EXISTS products_catalog_bumped_idx
  ON public.products (catalog_bumped_at DESC, id)
  WHERE status = 'approved';

COMMIT;
