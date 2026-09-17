-- Cobra una sola tarifa por el paquete consolidado y selecciona la categoría
-- Tarifa Simple usando el mayor peso entre físico y volumétrico (cm³ / 4000).
BEGIN;

ALTER TABLE public.shipping_rates
  ADD COLUMN IF NOT EXISTS package_tier TEXT;

ALTER TABLE public.shipping_rates
  DROP CONSTRAINT IF EXISTS shipping_rates_package_tier_check;
ALTER TABLE public.shipping_rates
  ADD CONSTRAINT shipping_rates_package_tier_check
  CHECK (package_tier IS NULL OR package_tier IN ('xs', 's', 'm', 'l'));

UPDATE public.shipping_rates
SET package_tier = 'xs', updated_at = NOW()
WHERE service_code IN ('starken_flat_xs', 'starken_flat_xs_local');

CREATE OR REPLACE FUNCTION public.commerce_starken_package_tier(
  p_physical_weight_kg NUMERIC,
  p_volume_cm3 NUMERIC
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_physical_weight_kg IS NULL OR p_physical_weight_kg <= 0
      OR p_volume_cm3 IS NULL OR p_volume_cm3 <= 0 THEN NULL
    WHEN GREATEST(p_physical_weight_kg, p_volume_cm3 / 4000.0) <= 0.85 THEN 'xs'
    WHEN GREATEST(p_physical_weight_kg, p_volume_cm3 / 4000.0) <= 3 THEN 's'
    WHEN GREATEST(p_physical_weight_kg, p_volume_cm3 / 4000.0) <= 6 THEN 'm'
    WHEN GREATEST(p_physical_weight_kg, p_volume_cm3 / 4000.0) <= 10 THEN 'l'
    ELSE NULL
  END
$$;

REVOKE ALL ON FUNCTION public.commerce_starken_package_tier(NUMERIC, NUMERIC)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_starken_package_tier(NUMERIC, NUMERIC)
TO service_role;

-- Valores Persona a domicilio publicados por Starken el 2026-09-17.
-- XS conserva la tarifa comercial subsidiada que ya ve el comprador.
WITH tier_data(
  package_tier, service_code,
  north_clp, center_south_clp, austral_clp
) AS (
  VALUES
    ('s', 'starken_flat_s', 13540, 8830, 14190),
    ('m', 'starken_flat_m', 21370, 12020, 21930),
    ('l', 'starken_flat_l', 26320, 14670, 28390)
)
INSERT INTO public.shipping_rates (
  shipping_origin_code, zone_id, handling_class, service_code, package_tier,
  amount_clp, min_delivery_days, max_delivery_days, valid_from,
  source_note, active
)
SELECT
  xs.shipping_origin_code,
  xs.zone_id,
  'standard',
  tier.service_code,
  tier.package_tier,
  CASE
    WHEN zone.region IN (
      'Arica y Parinacota', 'Tarapacá', 'Antofagasta'
    ) THEN tier.north_clp
    WHEN zone.region IN (
      'Aysén del General Carlos Ibáñez del Campo',
      'Magallanes y de la Antártica Chilena'
    ) THEN tier.austral_clp
    ELSE tier.center_south_clp
  END,
  NULL,
  NULL,
  '2026-09-17 00:00:00+00',
  'Starken Tarifa Simple Persona domicilio; tabla oficial 2026-09-17',
  TRUE
FROM public.shipping_rates xs
JOIN public.shipping_zones zone ON zone.id = xs.zone_id
CROSS JOIN tier_data tier
WHERE xs.service_code = 'starken_flat_xs'
  AND xs.active = TRUE
ON CONFLICT (
  shipping_origin_code, zone_id, handling_class, service_code, valid_from
) DO UPDATE SET
  package_tier = EXCLUDED.package_tier,
  amount_clp = EXCLUDED.amount_clp,
  min_delivery_days = EXCLUDED.min_delivery_days,
  max_delivery_days = EXCLUDED.max_delivery_days,
  source_note = EXCLUDED.source_note,
  active = TRUE,
  updated_at = NOW();

WITH tier_data(package_tier, service_code, amount_clp) AS (
  VALUES
    ('s', 'starken_flat_s_local', 6090),
    ('m', 'starken_flat_m_local', 6920),
    ('l', 'starken_flat_l_local', 7630)
)
INSERT INTO public.shipping_rates (
  shipping_origin_code, zone_id, handling_class, service_code, package_tier,
  amount_clp, min_delivery_days, max_delivery_days, valid_from,
  source_note, active
)
SELECT
  xs.shipping_origin_code,
  xs.zone_id,
  'standard',
  tier.service_code,
  tier.package_tier,
  tier.amount_clp,
  NULL,
  NULL,
  '2026-09-17 00:00:00+00',
  'Starken Tarifa Simple Persona domicilio misma ciudad; tabla oficial 2026-09-17',
  TRUE
FROM public.shipping_rates xs
CROSS JOIN tier_data tier
WHERE xs.service_code = 'starken_flat_xs_local'
  AND xs.active = TRUE
ON CONFLICT (
  shipping_origin_code, zone_id, handling_class, service_code, valid_from
) DO UPDATE SET
  package_tier = EXCLUDED.package_tier,
  amount_clp = EXCLUDED.amount_clp,
  min_delivery_days = EXCLUDED.min_delivery_days,
  max_delivery_days = EXCLUDED.max_delivery_days,
  source_note = EXCLUDED.source_note,
  active = TRUE,
  updated_at = NOW();

-- La función transaccional vuelve a validar el monto contra la categoría del
-- paquete. Así un error de aplicación no puede reintroducir el cobro por unidad.
DO $migration$
DECLARE
  v_definition TEXT;
  v_updated TEXT;
  v_old_fragment TEXT := $old$
      -- Cada unidad viaja en su propia caja; shipping_rates.amount_clp es el
      -- valor por caja y el checkout persiste el total de todas las cajas.
      AND rate.amount_clp::BIGINT * v_unit_count
        = p_shipping_amount_clp::BIGINT
$old$;
  v_new_fragment TEXT := $new$
      -- Una tarifa por el paquete consolidado completo.
      AND rate.amount_clp::BIGINT = p_shipping_amount_clp::BIGINT
      AND (
        (p_delivery_method = 'pickup' AND rate.package_tier IS NULL)
        OR (
          p_delivery_method = 'home'
          AND rate.package_tier = (
            WITH requested AS (
              SELECT * FROM jsonb_to_recordset(p_items)
                AS item(slug TEXT, size TEXT, quantity INTEGER)
            )
            SELECT public.commerce_starken_package_tier(
              SUM(product.packaged_weight_kg * requested.quantity),
              SUM(
                product.packaged_length_cm * product.packaged_width_cm *
                product.packaged_height_cm * requested.quantity
              )
            )
            FROM requested
            JOIN public.ski_rack_products product
              ON product.slug = requested.slug
          )
        )
      )
$new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.commerce_create_rack_checkout(jsonb,uuid,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,uuid,text,text,text,text,text,integer,boolean)'::regprocedure
  ) INTO v_definition;

  v_updated := replace(v_definition, v_old_fragment, v_new_fragment);
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'rack checkout per-unit shipping validation was not found';
  END IF;
  EXECUTE v_updated;
END;
$migration$;

COMMIT;
