-- “Temporadas de uso” fue retirado de todos los flujos del producto.
-- Esta eliminación es intencional e irreversible: descarta los valores históricos.
ALTER TABLE public.products
  DROP COLUMN IF EXISTS seasons_used;
