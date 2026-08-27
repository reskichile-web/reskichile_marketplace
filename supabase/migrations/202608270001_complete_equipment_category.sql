-- A complete ski/snowboard setup sold as one listing. Product-specific details
-- stay in the description; attributes intentionally remain general.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_product_type_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_product_type_check
  CHECK (product_type IN (
    'esquis', 'snowboards', 'botas_esqui', 'botas_snowboard',
    'bastones', 'cascos', 'guantes', 'fijaciones',
    'parkas', 'pantalones', 'antiparras', 'mochilas',
    'bolsos', 'equipo_avalanchas', 'camaras_accion',
    'equipos_completos', 'otros'
  ));
