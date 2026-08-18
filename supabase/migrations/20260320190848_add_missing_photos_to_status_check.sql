
ALTER TABLE public.products DROP CONSTRAINT products_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_status_check
  CHECK (status = ANY (ARRAY['draft', 'pending', 'approved', 'rejected', 'missing_photos', 'sold', 'archived']));
;
