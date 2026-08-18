
-- Sales history table for analytics
-- Snapshot of product + seller data at time of recording
CREATE TABLE public.sales_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Product reference (nullable — product may be deleted later)
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,

  -- Product snapshot (preserved even if product is deleted)
  product_type TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT,
  condition TEXT NOT NULL,
  seasons_used TEXT,
  region TEXT NOT NULL,
  comuna TEXT,
  attributes JSONB,

  -- Pricing
  listing_price INTEGER NOT NULL,        -- precio original de publicacion
  sale_price INTEGER,                     -- precio real de venta (si se registro)
  price_difference INTEGER GENERATED ALWAYS AS (listing_price - COALESCE(sale_price, listing_price)) STORED,

  -- Status tracking
  status TEXT NOT NULL,                   -- status at time of snapshot
  listed_at TIMESTAMPTZ,                  -- cuando se publico
  recorded_at TIMESTAMPTZ DEFAULT NOW(),  -- cuando se registro en historial

  -- Seller snapshot (preserved even if user is deleted)
  seller_id UUID,
  seller_name TEXT,
  seller_email TEXT,
  seller_phone TEXT,
  seller_region TEXT,

  -- Contact tracking
  contact_user_checked BOOLEAN DEFAULT FALSE,
  contact_product_checked BOOLEAN DEFAULT FALSE
);

-- Index for common analytics queries
CREATE INDEX idx_sales_history_product_type ON public.sales_history(product_type);
CREATE INDEX idx_sales_history_status ON public.sales_history(status);
CREATE INDEX idx_sales_history_brand ON public.sales_history(brand);
CREATE INDEX idx_sales_history_listed_at ON public.sales_history(listed_at);

-- RLS — admin only
ALTER TABLE public.sales_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sales history" ON public.sales_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );
;
