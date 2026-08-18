
CREATE POLICY "Admins can delete any product" ON public.products
  FOR DELETE USING (is_admin());

CREATE POLICY "Admins can delete any product image" ON public.product_images
  FOR DELETE USING (is_admin());
;
