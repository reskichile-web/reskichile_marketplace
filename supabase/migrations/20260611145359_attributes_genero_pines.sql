-- 1) sexo (string) → genero (array de slugs, mismo modelo que esquís).
--    Unisex se mapea a hombre+mujer.
UPDATE public.products
SET attributes = (attributes - 'sexo') || jsonb_build_object('genero',
  CASE lower(attributes->>'sexo')
    WHEN 'hombre' THEN '["hombre"]'::jsonb
    WHEN 'mujer'  THEN '["mujer"]'::jsonb
    ELSE '["hombre","mujer"]'::jsonb
  END)
WHERE attributes ? 'sexo';

-- 2) botas_esqui: tipo_conexion_fijacion → incluye_pines (boolean).
--    Randonnée = pines; Alpina = sin pines.
UPDATE public.products
SET attributes = (attributes - 'tipo_conexion_fijacion') ||
  jsonb_build_object('incluye_pines',
    lower(attributes->>'tipo_conexion_fijacion') LIKE 'randon%')
WHERE product_type = 'botas_esqui' AND attributes ? 'tipo_conexion_fijacion';;
