
CREATE POLICY "View product sellers"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.seller_id = users.id
  )
);
;
