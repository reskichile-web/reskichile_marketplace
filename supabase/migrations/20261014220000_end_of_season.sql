-- Pause, rather than delete, all pg_cron jobs. Existing products and queues stay intact.
DO $$
DECLARE job record;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    FOR job IN SELECT jobid FROM cron.job WHERE active LOOP
      PERFORM cron.alter_job(job.jobid, active := false);
    END LOOP;
  END IF;
END $$;

-- Restart only the reminder clock; keep publication ages and product statuses.
UPDATE public.products
SET sale_reminder_sent_at = now()
WHERE status = 'approved';
