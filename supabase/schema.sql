-- ReskiChile Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- USERS (extends auth.users)
-- ============================================
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  instagram TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================
-- PRODUCTS
-- ============================================
-- product_type: tipo de producto del formulario
-- brand, model: comunes a todos
-- condition: Nuevo (sellado), Nuevo, Usado - Como nuevo, Usado - Buen estado, Usado - Aceptable
-- seasons_used: temporadas de uso (texto libre, ej: "2", "3-4")
-- region, comuna: ubicación de despacho
-- attributes: JSONB con campos específicos por tipo de producto
-- ============================================
CREATE TABLE public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN (
    'esquis', 'snowboards', 'botas_esqui', 'botas_snowboard',
    'bastones', 'cascos', 'guantes', 'fijaciones',
    'parkas', 'pantalones', 'antiparras', 'mochilas',
    'bolsos', 'equipo_avalanchas', 'camaras_accion', 'otros'
  )),
  brand TEXT NOT NULL,
  model TEXT,
  condition TEXT NOT NULL CHECK (condition IN (
    'nuevo_sellado', 'nuevo', 'usado_como_nuevo', 'usado_buen_estado', 'usado_aceptable'
  )),
  seasons_used TEXT,
  description TEXT,
  price INTEGER NOT NULL CHECK (price > 0),
  region TEXT NOT NULL,
  comuna TEXT NOT NULL,
  attributes JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending', 'approved', 'rejected', 'sold', 'archived'
  )),
  rejection_reason TEXT,
  terms_accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ATTRIBUTES JSONB examples per product_type:
--
-- esquis: {
--   "largo_cm": 170,
--   "ancho_mm": 88,
--   "radio_giro_m": 16,
--   "incluye_fijaciones": true,
--   "fijaciones_marca": "Marker",
--   "fijaciones_modelo": "Griffon",
--   "fijaciones_tipo_conexion": "alpina",       -- alpina | de_pines | hibrida
--   "fijaciones_estado": "usado_buen_estado"
-- }
--
-- snowboards: {
--   "largo": "155",
--   "ancho": "25",
--   "camber": "camber_clasico",                  -- camber_clasico | camber_rocker | camber_plano
--   "incluye_fijaciones": true,
--   "fijaciones_marca": "Burton",
--   "fijaciones_modelo": "Custom",
--   "fijaciones_tipo_conexion": "alpina",
--   "fijaciones_estado": "nuevo"
-- }
--
-- botas_esqui: {
--   "flex": "100",
--   "talla_mondo": "26.5",
--   "talla_cm": "30.5",
--   "tipo_conexion_fijacion": "alpina",           -- alpina | randonnee
--   "sexo": "hombre",                             -- hombre | mujer | unisex
--   "color": "negro/rojo"
-- }
--
-- botas_snowboard: {
--   "talla_cm": "28",
--   "tipo_conexion_fijacion": "comun",            -- comun | step_on
--   "color": "negro",
--   "sexo": "hombre"
-- }
--
-- bastones: {
--   "largo": "120",
--   "telescopicos": true
-- }
--
-- cascos: {
--   "color": "blanco",
--   "talla_cm": "56",
--   "talla": "M"                                  -- XS | S | M | L | XL
-- }
--
-- guantes: {
--   "talla": "L",                                 -- XS | S | M | L | XL
--   "sexo": "hombre"
-- }
--
-- parkas: {
--   "tipo_aislacion": "pluma",                    -- pluma | termica | cortaviento
--   "sexo": "mujer",
--   "talla": "M"                                  -- XS | S | M | L | XL | XXL
-- }
--
-- pantalones: {
--   "tipo_aislacion": "termica",
--   "sexo": "hombre",
--   "talla": "L",                                 -- XS | S | M | L | XL | XXL
--   "talla_numero": "42"
-- }
--
-- antiparras: {
--   "lente_intercambiable": true,
--   "talla": "M"                                  -- XS | S | M | L | XL
-- }
--
-- mochilas: {
--   "capacidad_litros": "40",
--   "compartimiento_avalancha": true
-- }
--
-- bolsos: {
--   "capacidad_litros": "120",
--   "tiene_ruedas": true,
--   "largo": "80"
-- }
--
-- fijaciones: {
--   "tipo_conexion": "alpina"                     -- alpina | de_pines | hibrida
-- }
--
-- equipo_avalanchas: {
--   "tipo_equipo": "arva"                         -- arva | pala | sonda
-- }
--
-- camaras_accion: {
--   "tipo_grabacion": "360"                       -- 360 | normal
-- }
--
-- otros: {}  (solo usa campos comunes)

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved products" ON public.products
  FOR SELECT USING (status = 'approved');

CREATE POLICY "Sellers can view own products" ON public.products
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert products" ON public.products
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own products" ON public.products
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Admins can view all products" ON public.products
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can update any product" ON public.products
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================
-- PRODUCT IMAGES
-- ============================================
CREATE TABLE public.product_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view images of approved products" ON public.product_images
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND status = 'approved')
  );

CREATE POLICY "Sellers can view own product images" ON public.product_images
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND seller_id = auth.uid())
  );

CREATE POLICY "Sellers can insert product images" ON public.product_images
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND seller_id = auth.uid())
  );

CREATE POLICY "Sellers can delete own product images" ON public.product_images
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND seller_id = auth.uid())
  );

CREATE POLICY "Admins can view all product images" ON public.product_images
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STORAGE
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

CREATE POLICY "Anyone can view product images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own product images" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
