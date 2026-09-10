BEGIN;
ALTER TABLE public.instagram_catalog_schedule_rules
  DROP CONSTRAINT instagram_catalog_schedule_rules_iso_weekday_check;
UPDATE public.instagram_catalog_schedule_rules SET iso_weekday = 2 WHERE iso_weekday = 3;
DELETE FROM public.instagram_catalog_schedule_rules WHERE iso_weekday = 7;
ALTER TABLE public.instagram_catalog_schedule_rules
  ADD CONSTRAINT instagram_catalog_schedule_rules_iso_weekday_check CHECK (iso_weekday IN (2, 5));
UPDATE public.instagram_catalog_schedule_rules SET local_time = '20:00', effective_from = '2026-09-10';
DELETE FROM public.instagram_story_schedule_rules WHERE iso_weekday IN (2, 3, 5, 7);
INSERT INTO public.instagram_story_schedule_rules (iso_weekday, slot, local_time) VALUES
  (2, 1, '11:30'), (2, 2, '12:30'),
  (3, 1, '19:30'), (3, 2, '19:45'), (3, 3, '20:00'),
  (5, 1, '11:30'), (5, 2, '12:30'),
  (7, 1, '19:30'), (7, 2, '19:45'), (7, 3, '20:00');
COMMIT;
