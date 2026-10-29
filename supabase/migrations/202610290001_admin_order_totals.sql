-- Global receipts for the orders footer, independent of list pagination.
BEGIN;

CREATE OR REPLACE FUNCTION public.commerce_admin_order_totals()
RETURNS TABLE (paid_order_count BIGINT, collected_clp BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    COUNT(*),
    COALESCE(SUM(GREATEST(orders.total_clp - COALESCE(refunded.amount_clp, 0), 0)), 0)::BIGINT
  FROM public.orders
  LEFT JOIN LATERAL (
    SELECT SUM(refunds.amount_clp) AS amount_clp
    FROM public.refunds
    WHERE refunds.order_id = orders.id AND refunds.state = 'succeeded'
  ) refunded ON TRUE
  WHERE orders.payment_status IN ('authorized', 'partially_refunded')
    AND (
      orders.payment_method IN ('cash', 'bank_transfer')
      OR EXISTS (
        SELECT 1 FROM public.payment_attempts attempt
        WHERE attempt.order_id = orders.id
          AND attempt.environment = 'production'
          AND attempt.state = 'authorized'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.commerce_admin_order_totals() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_admin_order_totals() TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
