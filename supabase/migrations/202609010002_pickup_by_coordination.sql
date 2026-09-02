-- Los puntos corresponden a bodegas, no a tiendas con atención continua.
-- La ubicación y el momento exactos se coordinan después de la compra.
BEGIN;

UPDATE public.shipping_origins
SET
  pickup_hours = NULL,
  pickup_instructions = 'Te contactaremos para coordinar la dirección y el momento exactos del retiro.',
  updated_at = NOW()
WHERE code IN ('las_condes', 'los_angeles');

COMMIT;
