
-- When sale_price is set on a product, upsert into sales_history
CREATE OR REPLACE FUNCTION public.sync_sale_to_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when sale_price changes from NULL to a value
  IF NEW.sale_price IS NOT NULL AND (OLD.sale_price IS NULL OR OLD.sale_price != NEW.sale_price) THEN
    -- Also mark as sold if not already
    IF NEW.status != 'sold' THEN
      NEW.status := 'sold';
    END IF;

    -- Upsert into sales_history
    INSERT INTO public.sales_history (
      product_id, product_type, brand, model, condition, seasons_used,
      region, comuna, attributes,
      listing_price, sale_price, status, listed_at,
      seller_id, seller_name, seller_email, seller_phone, seller_region,
      contact_user_checked, contact_product_checked
    )
    SELECT
      NEW.id, NEW.product_type, NEW.brand, NEW.model, NEW.condition, NEW.seasons_used,
      NEW.region, NEW.comuna, NEW.attributes,
      NEW.price, NEW.sale_price, 'sold', NEW.created_at,
      NEW.seller_id, u.name, u.email, u.phone, NEW.region,
      NEW.contact_user_checked, NEW.contact_product_checked
    FROM public.users u WHERE u.id = NEW.seller_id
    ON CONFLICT (product_id) WHERE product_id IS NOT NULL
    DO UPDATE SET
      sale_price = EXCLUDED.sale_price,
      status = 'sold',
      recorded_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create unique index on product_id for the upsert conflict target
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_history_product_id
  ON public.sales_history(product_id) WHERE product_id IS NOT NULL;

CREATE TRIGGER on_product_sale_price_set
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_sale_to_history();
;
