-- Inventory aging: days a product has been published (visible in catalog).
-- Incremented nightly at midnight (America/Santiago) by a pg_cron job;
-- freezes automatically when the product leaves 'approved' (sold/archived).
ALTER TABLE public.products ADD COLUMN days_published INTEGER NOT NULL DEFAULT 0;

-- Backfill: approved products age from their creation date;
-- sold products freeze at the days between creation and the sale update.
UPDATE public.products
SET days_published = GREATEST(0, (now() AT TIME ZONE 'America/Santiago')::date - (created_at AT TIME ZONE 'America/Santiago')::date)
WHERE status = 'approved';

UPDATE public.products
SET days_published = GREATEST(0, (updated_at AT TIME ZONE 'America/Santiago')::date - (created_at AT TIME ZONE 'America/Santiago')::date)
WHERE status = 'sold';

-- Nightly tick at midnight Chile. pg_cron schedules in UTC: 04:00 UTC = 00:00
-- CLT (winter) / 01:00 CLST (summer) — still exactly one tick per day.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'increment-days-published',
  '0 4 * * *',
  $$UPDATE public.products SET days_published = days_published + 1 WHERE status = 'approved'$$
);;
