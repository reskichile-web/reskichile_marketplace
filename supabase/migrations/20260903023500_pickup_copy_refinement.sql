-- Corrige la referencia pública de Los Ángeles: O'Higgins es una calle, no un
-- sector. La dirección exacta se mantiene privada hasta coordinar el retiro.
BEGIN;

UPDATE public.shipping_origins
SET
  pickup_address = 'Calle O''Higgins',
  updated_at = NOW()
WHERE code = 'los_angeles';

COMMIT;
