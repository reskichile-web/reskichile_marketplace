-- Sectores públicos y copy de coordinación para retiro en tienda. La dirección
-- exacta continúa entregándose de forma privada después de completar la compra.
BEGIN;

UPDATE public.shipping_origins
SET
  pickup_address = CASE code
    WHEN 'las_condes' THEN 'Sector Escuela Militar, Apoquindo'
    WHEN 'los_angeles' THEN 'Sector O''Higgins'
    ELSE pickup_address
  END,
  updated_at = NOW()
WHERE code IN ('las_condes', 'los_angeles');

COMMIT;
