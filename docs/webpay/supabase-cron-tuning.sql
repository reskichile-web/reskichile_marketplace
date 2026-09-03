-- Ajuste operativo idempotente para una instalacion existente.
-- Ejecutar en Supabase SQL Editor cuando Postgres acepte conexiones.
-- No modifica endpoints, secretos, estado de los jobs ni trabajo pendiente.

DO $$
DECLARE
  reconciliation_job_id BIGINT;
  outbox_job_id BIGINT;
BEGIN
  SELECT jobid INTO reconciliation_job_id
  FROM cron.job
  WHERE jobname = 'reski-payment-reconciliation';

  IF reconciliation_job_id IS NULL THEN
    RAISE EXCEPTION 'No existe el job reski-payment-reconciliation';
  END IF;

  SELECT jobid INTO outbox_job_id
  FROM cron.job
  WHERE jobname = 'reski-commerce-outbox';

  IF outbox_job_id IS NULL THEN
    RAISE EXCEPTION 'No existe el job reski-commerce-outbox';
  END IF;

  PERFORM cron.alter_job(
    job_id := reconciliation_job_id,
    schedule := '*/2 * * * *'
  );

  PERFORM cron.alter_job(
    job_id := outbox_job_id,
    schedule := '*/5 * * * *'
  );
END
$$;

-- Verificacion sin revelar las URLs ni los secretos guardados en Vault.
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname IN ('reski-payment-reconciliation', 'reski-commerce-outbox')
ORDER BY jobname;
