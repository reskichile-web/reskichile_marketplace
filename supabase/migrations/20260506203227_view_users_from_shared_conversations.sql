-- Allow reading the counterparty's user row when you share a conversation with them.
DROP POLICY IF EXISTS "View users from shared conversations" ON public.users;
CREATE POLICY "View users from shared conversations"
  ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE (c.buyer_id = auth.uid() AND c.seller_id = public.users.id)
         OR (c.seller_id = auth.uid() AND c.buyer_id = public.users.id)
    )
  );;
