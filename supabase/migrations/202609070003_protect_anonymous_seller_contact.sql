-- Product RLS limits rows, not columns. Approved account-less listings were
-- therefore exposing anon_contact to anyone holding the public Supabase key.
-- Replace table-wide SELECT with an allowlist that deliberately omits it.
-- service_role retains its existing table access for the guarded contact API,
-- cron jobs and admin-only workflows.
REVOKE SELECT ON public.products FROM anon, authenticated;

DO $$
DECLARE
  v_public_columns TEXT;
BEGIN
  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
  INTO v_public_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'products'
    -- Intersect an explicit allowlist with the columns present in this
    -- environment. Newly added fields stay private until reviewed.
    AND column_name = ANY (ARRAY[
      'id', 'seller_id', 'product_type', 'brand', 'model', 'condition',
      'description', 'price', 'previous_price', 'region', 'comuna',
      'attributes', 'status', 'rejection_reason', 'terms_accepted',
      'days_published', 'sale_price', 'sold_at', 'sold_channel', 'sold_speed',
      'commerce_owned', 'shipping_origin_code', 'packaged_length_cm',
      'packaged_width_cm', 'packaged_height_cm', 'packaged_weight_kg',
      'created_at', 'updated_at', 'slug', 'sale_reminder_sent_at', 'search_text',
      'catalog_bumped_at'
    ]::TEXT[]);

  IF v_public_columns IS NULL THEN
    RAISE EXCEPTION 'public.products has no grantable columns';
  END IF;

  EXECUTE format(
    'GRANT SELECT (%s) ON public.products TO anon, authenticated',
    v_public_columns
  );
END
$$;
