-- Normaliza las botas existentes al modelo usado por formulario y catálogo:
--   talla_mondo: banda canónica (ej. 27/27.5)
--   flex: un único múltiplo de 5
--   largo_suela_mm: BSL, solo cuando el dato anterior era inequívoco
--   boa: booleano
-- Los antiguos talla_cm se eliminan: mezclaban Mondo, US, BSL y ancho de horma.

with normalized (
  id,
  talla_mondo,
  flex,
  boa,
  genero,
  largo_suela_mm
) as (
  values
    ('a9afb9ed-b589-4889-9bc2-5c57ffcea5b0'::uuid, '28/28.5', '120', false, null::jsonb, null::text),
    ('770ed0ea-378d-429d-9455-18e57429b0fe'::uuid, '28/28.5', '120', false, null::jsonb, null::text),
    ('7fd153c7-7750-414c-9819-7f49bd9d9831'::uuid, '27/27.5', '130', false, null::jsonb, null::text),
    ('9f9744be-523b-4605-b350-3360bdb669f7'::uuid, '18/18.5', null, false, null::jsonb, null::text),
    ('e0ae32a0-10b5-4013-9eb4-973dd35e91db'::uuid, '23/23.5', '105', false, null::jsonb, null::text),
    ('d2033eff-3703-4f53-b00c-d84ec0a29b63'::uuid, '22/22.5', '95', false, null::jsonb, null::text),
    ('0038b177-be0e-4e03-aa1e-81507a19318b'::uuid, '28/28.5', '80', false, null::jsonb, '326'),
    ('3da155bf-12dc-47d4-8614-bae1853148c6'::uuid, '27/27.5', '135', false, null::jsonb, null::text),
    ('1f6d8124-c990-4107-9054-5c734e40286f'::uuid, '22/22.5', '100', false, null::jsonb, null::text),
    ('d66e9ed7-454d-40c1-b811-def64c74bf99'::uuid, '22/22.5', '80', false, null::jsonb, '266'),
    ('8bd72786-ec03-4b76-a5c2-1ee4092b316b'::uuid, '26/26.5', '120', false, null::jsonb, null::text),
    ('d9f0ec99-5eb9-4658-9956-60158980826e'::uuid, '27/27.5', '110', false, null::jsonb, null::text),
    ('d1cd7a4a-9a65-43d8-ae47-90eee57f76ce'::uuid, '24/24.5', '80', false, null::jsonb, null::text),
    ('4b1bf290-e837-4b60-bae0-e656910408f7'::uuid, '27/27.5', '120', true, null::jsonb, null::text),
    ('4125c4cb-e274-46a2-a526-c9b9d5c12e1a'::uuid, '25/25.5', null, false, '["unisex"]'::jsonb, null::text),
    ('d5685ae4-d820-4760-9e4c-4da7f80d84aa'::uuid, '27/27.5', '100', false, null::jsonb, null::text),
    ('bb5d7afe-3332-4941-9df1-cfc58aaf4146'::uuid, '26/26.5', '90', false, null::jsonb, null::text),
    ('ff57e1d5-e9ec-4a9c-b4a6-f4c836b1b219'::uuid, '26/26.5', null, false, null::jsonb, null::text),
    ('6e018c1b-a006-4610-a0b2-f4c8db9f02fc'::uuid, '26/26.5', '45', false, null::jsonb, null::text),
    ('df72283f-4373-44fa-aa2b-28289e9646da'::uuid, '28/28.5', '130', false, null::jsonb, null::text),
    ('ea119a01-cfe3-4616-aa6b-25cd5480f981'::uuid, '27/27.5', '110', false, null::jsonb, null::text),
    ('adebc1c7-3319-4bda-bc88-1297081fa45c'::uuid, '25/25.5', '60', false, '["unisex"]'::jsonb, null::text),
    ('8788fc04-40f4-4fc3-9bd2-85bca3dd260a'::uuid, '23/23.5', '75', false, null::jsonb, null::text),
    ('31b20721-cfa7-49e6-aaf3-31b477ea2742'::uuid, '27/27.5', null, true, null::jsonb, null::text),
    ('4634d1d5-70ab-4f0f-84d9-211d036f6273'::uuid, '26/26.5', null, true, null::jsonb, null::text),
    ('8abdc637-ba99-49af-8552-874703bf33f0'::uuid, '23/23.5', null, false, '["unisex"]'::jsonb, null::text),
    ('3859db4a-4fc8-424e-8d6d-4eff1e00e493'::uuid, '27/27.5', null, true, null::jsonb, null::text),
    ('8ce2421d-a94b-4b23-a4b7-b9622945b570'::uuid, '19/19.5', null, false, '["unisex"]'::jsonb, null::text),
    ('284de952-4698-4ae2-b137-1b3f2445dd02'::uuid, '29/29.5', null, true, null::jsonb, null::text),
    ('6e010bf0-0090-48b0-b36c-be2dfd57a1e1'::uuid, '24/24.5', null, false, '["unisex"]'::jsonb, null::text),
    ('294e6f98-3b71-41f1-a7f2-3af34882fc08'::uuid, '29/29.5', null, false, '["unisex"]'::jsonb, null::text)
)
update public.products as product
set attributes =
  (coalesce(product.attributes, '{}'::jsonb) - 'talla_cm' - 'talla_mondo')
  || jsonb_build_object('talla_mondo', normalized.talla_mondo)
  || case when normalized.flex is null then '{}'::jsonb else jsonb_build_object('flex', normalized.flex) end
  || jsonb_build_object('boa', normalized.boa)
  || case when normalized.genero is null then '{}'::jsonb else jsonb_build_object('genero', normalized.genero) end
  || case when normalized.largo_suela_mm is null then '{}'::jsonb else jsonb_build_object('largo_suela_mm', normalized.largo_suela_mm) end
from normalized
where product.id = normalized.id
  and product.product_type in ('botas_esqui', 'botas_snowboard');
