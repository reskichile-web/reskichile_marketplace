-- Tarifas temporales para un Ski Rack embalado por caja (10 x 10 x 20 cm,
-- 0,500 kg). Basadas en Starken Tarifa Simple Persona, domicilio, tamaño XS,
-- consultada el 2026-09-02 y redondeada con un margen operativo pequeño.
BEGIN;

WITH zone_data(name, region, amount_clp) AS (
  VALUES
    ('Starken hogar Arica y Parinacota', 'Arica y Parinacota', 7990),
    ('Starken hogar Tarapacá', 'Tarapacá', 7990),
    ('Starken hogar Antofagasta', 'Antofagasta', 7990),
    ('Starken hogar Atacama', 'Atacama', 6990),
    ('Starken hogar Coquimbo', 'Coquimbo', 6990),
    ('Starken hogar Valparaíso', 'Valparaíso', 6990),
    ('Starken hogar Metropolitana de Santiago', 'Metropolitana de Santiago', 6990),
    ('Starken hogar O''Higgins', 'Libertador General Bernardo O''Higgins', 6990),
    ('Starken hogar Maule', 'Maule', 6990),
    ('Starken hogar Ñuble', 'Ñuble', 6990),
    ('Starken hogar Biobío', 'Biobío', 6990),
    ('Starken hogar La Araucanía', 'La Araucanía', 6990),
    ('Starken hogar Los Ríos', 'Los Ríos', 6990),
    ('Starken hogar Los Lagos', 'Los Lagos', 6990),
    ('Starken hogar Aysén', 'Aysén del General Carlos Ibáñez del Campo', 9990),
    ('Starken hogar Magallanes', 'Magallanes y de la Antártica Chilena', 9990)
)
INSERT INTO public.shipping_zones (
  name, region, commune, delivery_method, priority, active
)
SELECT name, region, NULL, 'home', 50, TRUE
FROM zone_data
ON CONFLICT (name) DO UPDATE SET
  region = EXCLUDED.region,
  commune = NULL,
  delivery_method = 'home',
  priority = 50,
  active = TRUE,
  updated_at = NOW();

INSERT INTO public.shipping_zones (
  name, region, commune, delivery_method, priority, active
) VALUES
  ('Starken misma comuna Las Condes', 'Metropolitana de Santiago', 'Las Condes', 'home', 1, TRUE),
  ('Starken misma comuna Los Ángeles', 'Biobío', 'Los Ángeles', 'home', 1, TRUE)
ON CONFLICT (name) DO UPDATE SET
  region = EXCLUDED.region,
  commune = EXCLUDED.commune,
  delivery_method = 'home',
  priority = 1,
  active = TRUE,
  updated_at = NOW();

WITH rate_data(region, amount_clp) AS (
  VALUES
    ('Arica y Parinacota', 7990),
    ('Tarapacá', 7990),
    ('Antofagasta', 7990),
    ('Atacama', 6990),
    ('Coquimbo', 6990),
    ('Valparaíso', 6990),
    ('Metropolitana de Santiago', 6990),
    ('Libertador General Bernardo O''Higgins', 6990),
    ('Maule', 6990),
    ('Ñuble', 6990),
    ('Biobío', 6990),
    ('La Araucanía', 6990),
    ('Los Ríos', 6990),
    ('Los Lagos', 6990),
    ('Aysén del General Carlos Ibáñez del Campo', 9990),
    ('Magallanes y de la Antártica Chilena', 9990)
)
INSERT INTO public.shipping_rates (
  shipping_origin_code, zone_id, handling_class, service_code,
  amount_clp, min_delivery_days, max_delivery_days, valid_from,
  source_note, active
)
SELECT
  origin.code,
  zone.id,
  'standard',
  'starken_flat_xs',
  rate.amount_clp,
  NULL,
  NULL,
  '2026-09-02 00:00:00+00',
  'Starken Tarifa Simple Persona domicilio XS; tarifa cliente redondeada 2026-09-02',
  TRUE
FROM rate_data rate
JOIN public.shipping_zones zone
  ON zone.region = rate.region
  AND zone.commune IS NULL
  AND zone.delivery_method = 'home'
CROSS JOIN public.shipping_origins origin
WHERE origin.active = TRUE
ON CONFLICT (
  shipping_origin_code, zone_id, handling_class, service_code, valid_from
) DO UPDATE SET
  amount_clp = EXCLUDED.amount_clp,
  min_delivery_days = NULL,
  max_delivery_days = NULL,
  source_note = EXCLUDED.source_note,
  active = TRUE,
  updated_at = NOW();

WITH local_rate(origin_code, zone_name) AS (
  VALUES
    ('las_condes', 'Starken misma comuna Las Condes'),
    ('los_angeles', 'Starken misma comuna Los Ángeles')
)
INSERT INTO public.shipping_rates (
  shipping_origin_code, zone_id, handling_class, service_code,
  amount_clp, min_delivery_days, max_delivery_days, valid_from,
  source_note, active
)
SELECT
  local.origin_code,
  zone.id,
  'standard',
  'starken_flat_xs_local',
  4990,
  NULL,
  NULL,
  '2026-09-02 00:00:00+00',
  'Starken Tarifa Simple Persona domicilio XS misma ciudad; tarifa cliente redondeada 2026-09-02',
  TRUE
FROM local_rate local
JOIN public.shipping_zones zone ON zone.name = local.zone_name
ON CONFLICT (
  shipping_origin_code, zone_id, handling_class, service_code, valid_from
) DO UPDATE SET
  amount_clp = 4990,
  min_delivery_days = NULL,
  max_delivery_days = NULL,
  source_note = EXCLUDED.source_note,
  active = TRUE,
  updated_at = NOW();

COMMIT;
