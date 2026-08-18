-- Per-seller switch: when true, the WhatsApp CTA disappears from their
-- product pages and the /api/contact endpoint refuses to hand out the number.
-- Default false to preserve existing behaviour.
ALTER TABLE public.users
  ADD COLUMN hide_phone BOOLEAN NOT NULL DEFAULT FALSE;

-- Buyers (anon or authenticated) need to know this flag to decide whether
-- to render the WhatsApp button on a product page, but RLS on `users` is
-- locked down to "own profile" + "shared conversations". A SECURITY DEFINER
-- RPC narrows the surface to just this one boolean — no name/email/phone
-- leak.
CREATE OR REPLACE FUNCTION public.is_seller_phone_hidden(p_seller uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(hide_phone, FALSE) FROM public.users WHERE id = p_seller;
$$;

REVOKE ALL ON FUNCTION public.is_seller_phone_hidden(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_seller_phone_hidden(uuid) TO anon, authenticated;
;
