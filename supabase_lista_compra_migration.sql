-- supabase_lista_compra_migration.sql
-- Ejecutar en Supabase SQL Editor. Idempotente (usa IF NOT EXISTS / OR REPLACE).

-- ─────────────────────────────────────────────────────────────
-- 1. Columna es_generico en alimentos
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.alimentos
  ADD COLUMN IF NOT EXISTS es_generico boolean NOT NULL DEFAULT false;

-- Marcar como genéricos los alimentos con macros reales (calorias > 0)
UPDATE public.alimentos
  SET es_generico = true
  WHERE calorias > 0
    AND es_generico = false;

-- ─────────────────────────────────────────────────────────────
-- 2. Tabla selecciones_lista_compra
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.selecciones_lista_compra (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id      uuid REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  plan_id         uuid REFERENCES public.planes_nutricion(id) ON DELETE CASCADE NOT NULL,
  alimento_id     uuid REFERENCES public.alimentos(id) ON DELETE CASCADE NOT NULL,
  supermercado_id uuid REFERENCES public.supermercados(id) ON DELETE SET NULL,
  producto_nombre text,
  precio_por_kg   numeric(10,4),
  url_producto    text,
  semana_inicio   date NOT NULL,
  seleccionado_por text CHECK (seleccionado_por IN ('coach', 'cliente')) NOT NULL DEFAULT 'cliente',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (cliente_id, plan_id, alimento_id, semana_inicio)
);

ALTER TABLE public.selecciones_lista_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coach puede gestionar selecciones" ON public.selecciones_lista_compra;
CREATE POLICY "Coach puede gestionar selecciones" ON public.selecciones_lista_compra
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.coach_id = auth.uid())
  );

DROP POLICY IF EXISTS "Cliente puede ver y editar sus selecciones" ON public.selecciones_lista_compra;
CREATE POLICY "Cliente puede ver y editar sus selecciones" ON public.selecciones_lista_compra
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.profile_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_selecciones_plan_semana
  ON public.selecciones_lista_compra(plan_id, semana_inicio);
CREATE INDEX IF NOT EXISTS idx_selecciones_cliente
  ON public.selecciones_lista_compra(cliente_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Tabla temporal para revisión de deduplicación ambigua
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dedup_revision (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alimento_a_id   uuid REFERENCES public.alimentos(id),
  alimento_b_id   uuid REFERENCES public.alimentos(id),
  motivo          text,
  resuelto        boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.dedup_revision ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Coach puede gestionar dedup_revision" ON public.dedup_revision;
CREATE POLICY "Coach puede gestionar dedup_revision" ON public.dedup_revision
  FOR ALL USING (auth.uid() IS NOT NULL);
