-- Seller-driven "mark as sold" flow: sale metadata + 30-day reminder anchor.
ALTER TABLE public.products ADD COLUMN sold_at TIMESTAMPTZ;
ALTER TABLE public.products ADD COLUMN sold_channel TEXT;   -- 'reski' | 'otro_medio' | 'otro'
ALTER TABLE public.products ADD COLUMN sold_speed TEXT;     -- 'rapido' | 'normal' | 'baje_precio'
-- When the last "¿lo vendiste?" reminder was sent. NULL = never. The cron
-- re-reminds when this is older than 30 days and the product is still live.
ALTER TABLE public.products ADD COLUMN sale_reminder_sent_at TIMESTAMPTZ;

-- One-time tokens for emailed one-click actions (undo a sale, confirm a sale
-- or report "still available" from the 30-day reminder). Mirrors
-- password_invites: service-role only (RLS on, no policies); single-use.
CREATE TABLE public.product_action_tokens (
  token TEXT PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('undo_sale', 'confirm_sold', 'still_available')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '45 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_action_tokens_product_idx ON public.product_action_tokens (product_id);
ALTER TABLE public.product_action_tokens ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (server routes) touches this.;
