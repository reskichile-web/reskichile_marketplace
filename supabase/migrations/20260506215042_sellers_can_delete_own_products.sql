
CREATE POLICY "Sellers can delete own products"
ON public.products
FOR DELETE
TO authenticated
USING (auth.uid() = seller_id);
;
