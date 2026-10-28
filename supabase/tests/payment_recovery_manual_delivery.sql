-- Regressions for the real special-return incident and safe manual recovery.
BEGIN;
DO $$
DECLARE
  v_admin UUID := gen_random_uuid(); v_buyer UUID := gen_random_uuid();
  v_inventory UUID; v_order UUID; v_public UUID; v_attempt UUID;
  v_case TEXT; v_result JSONB; v_token TEXT; v_correlation UUID; v_stock INTEGER;
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (v_admin,'recovery-admin@test.invalid','{"name":"Recovery Admin"}'),
    (v_buyer,'recovery-buyer@test.invalid','{"name":"Recovery Buyer"}');
  UPDATE public.users SET is_admin = TRUE WHERE id = v_admin;
  SELECT inventory.id INTO v_inventory FROM public.ski_rack_inventory inventory
  JOIN public.ski_rack_products p ON p.id = inventory.rack_product_id
  WHERE p.slug = 'filamento' AND inventory.size = 'L' AND inventory.shipping_origin_code = 'los_angeles';
  UPDATE public.ski_rack_inventory SET stock_on_hand = 20 WHERE id = v_inventory;
  FOREACH v_case IN ARRAY ARRAY['recent','old','mismatch','unknown','stale','manual','silent-manual','no-evidence'] LOOP
    INSERT INTO public.orders(order_number,buyer_email,buyer_name,buyer_phone,delivery_method,
      shipping_snapshot,subtotal_clp,shipping_clp,total_clp,idempotency_key,request_fingerprint,guest_access_hash,expires_at)
    VALUES ('TEST-REC-'||v_case,'recovery@test.invalid','Recovery Test','+56912345678','home','{}',
      7990,3490,11480,gen_random_uuid(),repeat('a',64),repeat('b',64),NOW()+INTERVAL '15 minutes')
    RETURNING id,public_id INTO v_order,v_public;
    INSERT INTO public.order_items(order_id,rack_inventory_id,sku,product_name,product_type,unit_price_clp,quantity,line_total_clp,shipping_origin_code,package_snapshot)
    VALUES(v_order,v_inventory,'RACK-FILAMENTO-L','Filamento L','ski_rack',7990,1,7990,'los_angeles','{}');
    INSERT INTO public.inventory_reservations(order_id,rack_inventory_id,quantity,state,expires_at)
    VALUES(v_order,v_inventory,1,'reconciliation_required',NOW()+INTERVAL '15 minutes');
    v_correlation := gen_random_uuid(); v_token := 'recovery_token_' || replace(v_case,'-','_');
    INSERT INTO public.payment_attempts(order_id,environment,state,amount_clp,buy_order,session_id,transbank_token,
      created_at,webpay_return_kind,reconcile_count,processing_correlation_id)
    VALUES(v_order,'integration','reconciliation_required',11480,'REC'||v_case,'SESSION'||v_case,v_token,
      CASE WHEN v_case = 'recent' THEN NOW() WHEN v_case = 'unknown' THEN NOW()-INTERVAL '2 days' ELSE NOW()-INTERVAL '2 hours' END,
      'special',2,v_correlation) RETURNING id INTO v_attempt;
    IF v_case = 'stale' THEN
      BEGIN
        PERFORM public.commerce_finalize_webpay(v_attempt,'reconciliation_required',11480,'REC'||v_case,'SESSION'||v_case,'INITIALIZED',NULL,NULL,NULL,NULL,NULL,NOW(),gen_random_uuid());
        RAISE EXCEPTION 'expected stale claim rejection';
      EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'stale payment processing claim' THEN RAISE; END IF; END;
      IF public.commerce_mark_webpay_reconciliation(v_attempt,gen_random_uuid(),'stale') THEN RAISE EXCEPTION 'stale error overwrote active lease'; END IF;
      CONTINUE;
    END IF;
    v_result := public.commerce_finalize_webpay(v_attempt,
      CASE WHEN v_case = 'no-evidence' THEN 'expired' ELSE 'reconciliation_required' END,
      CASE WHEN v_case = 'mismatch' THEN 9999 WHEN v_case = 'no-evidence' THEN NULL ELSE 11480 END,
      CASE WHEN v_case = 'no-evidence' THEN NULL ELSE 'REC'||v_case END,
      CASE WHEN v_case = 'no-evidence' THEN NULL ELSE 'SESSION'||v_case END,
      CASE WHEN v_case = 'unknown' THEN 'UNKNOWN' WHEN v_case = 'no-evidence' THEN NULL ELSE 'INITIALIZED' END,
      NULL,NULL,NULL,NULL,NULL,NOW(),v_correlation);
    IF v_case IN ('old','manual','silent-manual') THEN
      IF v_result->>'attempt_state' <> 'expired' OR NOT EXISTS(SELECT 1 FROM public.inventory_reservations WHERE order_id=v_order AND state='expired') THEN
        RAISE EXCEPTION 'old INITIALIZED did not release stock: %',v_result;
      END IF;
    ELSE
      IF v_result->>'attempt_state' <> 'reconciliation_required' THEN RAISE EXCEPTION 'uncertain evidence released stock: % %',v_case,v_result; END IF;
    END IF;
    IF v_case = 'recent' AND NOT EXISTS(SELECT 1 FROM public.payment_attempts WHERE id=v_attempt AND next_reconcile_at >= NOW()+INTERVAL '60 seconds') THEN
      RAISE EXCEPTION 'ambiguous responses do not back off';
    END IF;
    IF v_case = 'unknown' THEN
      IF NOT EXISTS(SELECT 1 FROM public.payment_attempts WHERE id=v_attempt AND reconciliation_paused_at IS NOT NULL AND next_reconcile_at IS NULL) THEN
        RAISE EXCEPTION 'unresolvable payment was not escalated';
      END IF;
      PERFORM public.commerce_pause_exhausted_webpay(v_attempt);
      IF (SELECT COUNT(*) FROM public.commerce_outbox WHERE payment_attempt_id=v_attempt AND dedupe_key LIKE 'payment-manual-review/%') <> 1 THEN RAISE EXCEPTION 'manual alert not idempotent'; END IF;
      v_result := public.commerce_claim_webpay_status(v_token,gen_random_uuid());
      IF v_result->>'action' <> 'wait' THEN RAISE EXCEPTION 'paused payment keeps polling'; END IF;
      v_correlation := gen_random_uuid();
      v_result := public.commerce_admin_resume_webpay_reconciliation(v_public,v_admin,v_correlation);
      IF v_result->>'action' <> 'status' THEN RAISE EXCEPTION 'administrator cannot recheck paused payment'; END IF;
      v_result := public.commerce_finalize_webpay(v_attempt,'authorized',11480,'REC'||v_case,'SESSION'||v_case,'AUTHORIZED',0,'AUTH01','VN',0,'1234',NOW(),v_correlation);
      IF v_result->>'attempt_state' <> 'authorized' THEN RAISE EXCEPTION 'late authorization was not preserved'; END IF;
    END IF;
    IF v_case IN ('manual','silent-manual') THEN
      BEGIN
        PERFORM public.commerce_admin_set_manual_delivery(v_public,v_buyer,'Entrega personal acordada.',gen_random_uuid());
        RAISE EXCEPTION 'nonadmin converted delivery';
      EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'delivery administrator is not authorized' THEN RAISE; END IF; END;
      PERFORM public.commerce_admin_set_manual_delivery(v_public,v_admin,'Entrega personal acordada.',gen_random_uuid());
      IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id=v_order AND total_clp=7990 AND shipping_clp=0 AND delivery_method='manual' AND payment_status='pending' AND paid_at IS NULL) THEN RAISE EXCEPTION 'manual delivery amount/payment truth incorrect'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.payment_attempts WHERE id=v_attempt AND amount_clp=11480 AND state='expired') THEN RAISE EXCEPTION 'provider history was rewritten'; END IF;
      BEGIN
        PERFORM public.commerce_admin_update_fulfillment(v_public,v_admin,'preparing',gen_random_uuid());
        RAISE EXCEPTION 'unpaid manual order was fulfilled';
      EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'payment required before fulfillment' THEN RAISE; END IF; END;
      BEGIN
        PERFORM public.commerce_admin_record_manual_payment(v_public,v_admin,'bank_transfer',11480,'REF001',gen_random_uuid());
        RAISE EXCEPTION 'wrong amount accepted';
      EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'manual payment conflicts with order' THEN RAISE; END IF; END;
      SELECT stock_on_hand INTO v_stock FROM public.ski_rack_inventory WHERE id=v_inventory;
      PERFORM public.commerce_admin_record_manual_payment(v_public,v_admin,'bank_transfer',7990,'REF001',gen_random_uuid(),v_case = 'manual');
      PERFORM public.commerce_admin_record_manual_payment(v_public,v_admin,'bank_transfer',7990,'REF001',gen_random_uuid(),v_case = 'manual');
      IF (SELECT stock_on_hand FROM public.ski_rack_inventory WHERE id=v_inventory) <> v_stock-1 THEN RAISE EXCEPTION 'manual payment consumed inventory twice'; END IF;
      IF (SELECT COUNT(*) FROM public.commerce_outbox WHERE order_id=v_order AND kind='order_confirmation') <> (CASE WHEN v_case = 'manual' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'manual confirmation missing or duplicated'; END IF;
      v_result := public.commerce_finalize_webpay(v_attempt,'authorized',11480,'REC'||v_case,'SESSION'||v_case,'AUTHORIZED',0,'LATE01','VN',0,'1234',NOW(),gen_random_uuid());
      IF v_result->>'attempt_state' <> 'expired' OR (SELECT total_clp FROM public.orders WHERE id=v_order) <> 7990 THEN RAISE EXCEPTION 'late callback rewrote recovered order'; END IF;
      PERFORM public.commerce_admin_update_fulfillment(v_public,v_admin,'preparing',gen_random_uuid());
      PERFORM public.commerce_admin_update_fulfillment(v_public,v_admin,'delivered',gen_random_uuid());
      IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id=v_order AND order_status='completed' AND shipping_carrier IS NULL AND tracking_number IS NULL) THEN RAISE EXCEPTION 'manual delivery incorrectly requires tracking'; END IF;
    END IF;
  END LOOP;
END;
$$;
ROLLBACK;
