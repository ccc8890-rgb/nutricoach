-- ============================================================
-- AÑADIR COLUMNA video_url a recetas
-- ============================================================

ALTER TABLE public.recetas 
ADD COLUMN IF NOT EXISTS video_url text;

-- Bucket para imágenes generadas y extraídas
INSERT INTO storage.buckets (id, name, public) 
VALUES ('recetas', 'recetas', true)
ON CONFLICT (id) DO NOTHING;

-- Política de acceso público al bucket
DROP POLICY IF EXISTS "Public access to recetas" ON storage.objects;
CREATE POLICY "Public access to recetas" ON storage.objects
  FOR ALL USING (bucket_id = 'recetas')
  WITH CHECK (bucket_id = 'recetas');
