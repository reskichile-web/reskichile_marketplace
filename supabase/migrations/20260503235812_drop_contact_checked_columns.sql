
CREATE OR REPLACE FUNCTION public.sync_sale_to_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sale_price IS NOT NULL AND (OLD.sale_price IS NULL OR OLD.sale_price != NEW.sale_price) THEN
    IF NEW.status != 'sold' THEN
      NEW.status := 'sold';
    END IF;

    INSERT INTO public.sales_history (
      product_id, product_type, brand, model, condition, seasons_used,
      region, comuna, attributes,
      listing_price, sale_price, status, listed_at,
      seller_id, seller_name, seller_email, seller_phone, seller_region
    )
    SELECT
      NEW.id, NEW.product_type, NEW.brand, NEW.model, NEW.condition, NEW.seasons_used,
      NEW.region, NEW.comuna, NEW.attributes,
      NEW.price, NEW.sale_price, 'sold', NEW.created_at,
      NEW.seller_id, u.name, u.email, u.phone, NEW.region
    FROM public.users u WHERE u.id = NEW.seller_id
    ON CONFLICT (product_id) WHERE product_id IS NOT NULL
    DO UPDATE SET
      sale_price = EXCLUDED.sale_price,
      status = 'sold',
      recorded_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.products DROP COLUMN IF EXISTS contact_user_checked;
ALTER TABLE public.products DROP COLUMN IF EXISTS contact_product_checked;
ALTER TABLE public.sales_history DROP COLUMN IF EXISTS contact_user_checked;
ALTER TABLE public.sales_history DROP COLUMN IF EXISTS contact_product_checked;
;
