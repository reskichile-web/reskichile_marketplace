-- The footer counts real receipts globally, including transfers and refunds.
BEGIN;
DO $$
DECLARE
  v_admin UUID := gen_random_uuid(); v_order UUID; v_attempt UUID; v_case TEXT;
  v_status TEXT; v_total INTEGER; v_before_count BIGINT; v_before_total BIGINT;
  v_count BIGINT; v_collected BIGINT;
BEGIN
  SELECT paid_order_count,collected_clp INTO v_before_count,v_before_total FROM public.commerce_admin_order_totals();
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(v_admin,'totals-admin@test.invalid','{"name":"Totals Admin"}');
  FOREACH v_case IN ARRAY ARRAY['production','transfer','pending','rejected','expired','partial','refunded','sandbox','manual-pending'] LOOP
    v_status := CASE v_case WHEN 'pending' THEN 'pending' WHEN 'manual-pending' THEN 'pending'
      WHEN 'rejected' THEN 'rejected' WHEN 'expired' THEN 'expired'
      WHEN 'partial' THEN 'partially_refunded' WHEN 'refunded' THEN 'refunded' ELSE 'authorized' END;
    v_total := CASE v_case WHEN 'transfer' THEN 7990 WHEN 'sandbox' THEN 900000 ELSE 10000 END;
    INSERT INTO public.orders(order_number,buyer_email,buyer_name,buyer_phone,delivery_method,shipping_snapshot,
      subtotal_clp,total_clp,idempotency_key,request_fingerprint,guest_access_hash,expires_at,payment_status,
      payment_method,manual_payment_reference,manual_payment_recorded_by)
    VALUES('T-TOTAL-'||v_case,'totals@test.invalid','Totals Test','+56912345678',
      CASE WHEN v_case IN ('transfer','manual-pending') THEN 'manual' ELSE 'home' END,'{}',v_total,v_total,
      gen_random_uuid(),repeat('a',64),repeat('b',64),NOW()+INTERVAL '15 minutes',v_status,
      CASE v_case WHEN 'transfer' THEN 'bank_transfer' WHEN 'manual-pending' THEN 'manual_pending' ELSE 'webpay' END,
      CASE WHEN v_case='transfer' THEN 'TRANSFER-CONFIRMED' END,
      CASE WHEN v_case='transfer' THEN v_admin END) RETURNING id INTO v_order;
    INSERT INTO public.payment_attempts(order_id,environment,state,amount_clp,buy_order,session_id)
    VALUES(v_order,CASE WHEN v_case='sandbox' THEN 'integration' ELSE 'production' END,
      CASE WHEN v_case='transfer' THEN 'expired' WHEN v_status='pending' THEN 'initialized'
        WHEN v_status IN ('rejected','expired') THEN v_status ELSE 'authorized' END,
      CASE WHEN v_case='transfer' THEN 11480 ELSE v_total END,'TOTAL-'||v_case,'TOTAL-SESSION-'||v_case)
    RETURNING id INTO v_attempt;
    IF v_case='partial' THEN
      INSERT INTO public.refunds(order_id,payment_attempt_id,amount_clp,state,reason,admin_user_id,idempotency_key)
      VALUES(v_order,v_attempt,2000,'succeeded','Confirmed partial refund',v_admin,gen_random_uuid()),
        (v_order,v_attempt,1000,'failed','Failed refund must not reduce receipts',v_admin,gen_random_uuid());
    ELSIF v_case='refunded' THEN
      INSERT INTO public.refunds(order_id,payment_attempt_id,amount_clp,state,reason,admin_user_id,idempotency_key)
      VALUES(v_order,v_attempt,v_total,'succeeded','Full refund',v_admin,gen_random_uuid());
    END IF;
  END LOOP;
  SELECT paid_order_count,collected_clp INTO v_count,v_collected FROM public.commerce_admin_order_totals();
  IF v_count <> v_before_count+3 OR v_collected <> v_before_total+25990 THEN
    RAISE EXCEPTION 'receipt totals include unpaid/test orders, stale attempt amounts, or incorrect refunds: count %, total %',v_count,v_collected;
  END IF;
END;
$$;
ROLLBACK;
