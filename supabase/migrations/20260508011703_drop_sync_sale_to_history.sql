-- sales_history table no longer exists; the sync trigger now blocks every
-- sale_price UPDATE with "relation does not exist". Drop both — sale data
-- lives directly on products.sale_price + products.status for now.

drop trigger if exists on_product_sale_price_set on public.products;
drop function if exists public.sync_sale_to_history();
;
