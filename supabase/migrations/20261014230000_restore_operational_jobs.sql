-- End-of-season pauses apply to Instagram, not transactional commerce.
-- Restore delivery of purchase/fulfillment emails, payment recovery and listing age.
DO $$
DECLARE job record;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    FOR job IN
      SELECT jobid, jobname FROM cron.job
      WHERE jobname IN (
        'reski-commerce-outbox',
        'reski-payment-reconciliation',
        'increment-days-published'
      )
    LOOP
      PERFORM cron.alter_job(job.jobid, active := true);
      RAISE NOTICE 'Operational job restored: %', job.jobname;
    END LOOP;
  END IF;
END $$;
-- Keep existing reminder resets: the interval remains 30 days.
