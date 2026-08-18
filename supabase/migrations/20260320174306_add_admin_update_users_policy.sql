
CREATE POLICY "Admins can update any user" ON public.users
  FOR UPDATE USING (is_admin());
;
