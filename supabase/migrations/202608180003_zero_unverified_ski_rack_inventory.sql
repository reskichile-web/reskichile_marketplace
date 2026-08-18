-- Production safety gate: inventory must be confirmed by an administrator.
-- The catalog migration seeded placeholder quantities for isolated testing;
-- no unit may be sold until physical stock has been reconciled in production.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders)
    OR EXISTS (SELECT 1 FROM public.inventory_reservations)
    OR EXISTS (SELECT 1 FROM public.payment_attempts) THEN
    RAISE EXCEPTION
      'cannot reset unverified rack inventory after commerce activity exists';
  END IF;
END;
$$;

INSERT INTO public.ski_rack_inventory_adjustments (
  inventory_id,
  admin_user_id,
  previous_stock,
  new_stock,
  reason
)
SELECT
  inventory.id,
  NULL,
  inventory.stock_on_hand,
  0,
  'production_safety_reset'
FROM public.ski_rack_inventory inventory
WHERE inventory.stock_on_hand <> 0;

UPDATE public.ski_rack_inventory
SET stock_on_hand = 0,
    updated_at = NOW()
WHERE stock_on_hand <> 0;

COMMIT;
