-- Authorized 25% promotion, rounded down to $13.490 from $17.990.
-- Existing orders retain their original price snapshots.
UPDATE public.ski_rack_products
SET price_clp = 13490, updated_at = now()
WHERE slug = 'madera';

-- Seven days: end October 21 at 19:35 Chile daylight-saving time (22:35 UTC).
-- This one-time operational job does not activate any Instagram automation.
DO $migration$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.schedule(
      'end-ski-rack-seven-day-offer-2026',
      '35 22 21 10 *',
      $job$
        UPDATE public.ski_rack_products
        SET price_clp = 17990, updated_at = now()
        WHERE slug = 'madera' AND price_clp = 13490;
        SELECT cron.unschedule('end-ski-rack-seven-day-offer-2026');
      $job$
    );
  END IF;
END $migration$;
