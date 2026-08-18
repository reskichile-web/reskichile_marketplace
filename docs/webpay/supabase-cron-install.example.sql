-- NO ejecutar como migración automática.
-- Reemplazar los dos valores CHANGE_ME directamente en Supabase/Vault.
-- El secreto debe ser el mismo RECONCILIATION_JOB_SECRET configurado en Vercel.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT vault.create_secret(
  'https://CHANGE_ME/api/cron/payments/reconcile',
  'reski_payment_reconciliation_url'
);

SELECT vault.create_secret(
  'https://CHANGE_ME/api/cron/commerce/outbox',
  'reski_commerce_outbox_url'
);

SELECT vault.create_secret(
  'CHANGE_ME_RANDOM_SECRET_AT_LEAST_32_CHARACTERS',
  'reski_payment_reconciliation_secret'
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'reski-payment-reconciliation'
  ) THEN
    PERFORM cron.unschedule('reski-payment-reconciliation');
  END IF;
END
$$;

SELECT cron.schedule(
  'reski-payment-reconciliation',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'reski_payment_reconciliation_url'
        ORDER BY created_at DESC
        LIMIT 1
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'reski_payment_reconciliation_secret'
          ORDER BY created_at DESC
          LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    ) AS request_id;
  $$
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'reski-commerce-outbox'
  ) THEN
    PERFORM cron.unschedule('reski-commerce-outbox');
  END IF;
END
$$;

SELECT cron.schedule(
  'reski-commerce-outbox',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'reski_commerce_outbox_url'
        ORDER BY created_at DESC
        LIMIT 1
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'reski_payment_reconciliation_secret'
          ORDER BY created_at DESC
          LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    ) AS request_id;
  $$
);

-- Verificación sin revelar secretos:
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname IN ('reski-payment-reconciliation', 'reski-commerce-outbox')
ORDER BY jobname;

-- Historial del scheduler:
SELECT status, start_time, end_time, return_message
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job
  WHERE jobname IN ('reski-payment-reconciliation', 'reski-commerce-outbox')
)
ORDER BY start_time DESC
LIMIT 20;

-- Respuestas HTTP recientes (no imprimir headers de la solicitud):
SELECT id, status_code, error_msg, created
FROM net._http_response
ORDER BY created DESC
LIMIT 20;
