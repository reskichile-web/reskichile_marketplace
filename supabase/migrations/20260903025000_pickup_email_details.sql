-- Los detalles operativos sólo los lee el backend con service role. La API
-- pública de checkout continúa mostrando las referencias generales guardadas
-- en pickup_address y no expone operational_address ni pickup_hours.
BEGIN;

UPDATE public.shipping_origins
SET
  operational_address = jsonb_build_object(
    'formatted_address', 'La Gloria 40',
    'street', 'La Gloria',
    'number', '40'
  ),
  pickup_hours = 'Lunes a viernes, de 9:00 a 19:00',
  pickup_instructions = 'Si necesitas coordinar otro horario, responde este correo.',
  updated_at = NOW()
WHERE code = 'las_condes';

UPDATE public.shipping_origins
SET
  operational_address = NULL,
  pickup_hours = NULL,
  pickup_instructions = 'Te contactaremos para confirmar la ubicación y el horario.',
  updated_at = NOW()
WHERE code = 'los_angeles';

COMMIT;
