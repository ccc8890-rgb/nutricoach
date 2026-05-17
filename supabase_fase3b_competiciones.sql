-- ============================================================
-- FASE 3b — Protocolos atletas + calendario de competiciones
-- Fecha: 17-05-2026
-- ============================================================

-- ============================================================
-- 1. Tabla competiciones
-- ============================================================
CREATE TABLE IF NOT EXISTS public.competiciones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  disciplina text NOT NULL CHECK (disciplina IN (
    'hyrox', 'running_5k', 'running_10k', 'running_hm', 'running_maraton',
    'trail_corto', 'trail_largo', 'ultra',
    'ciclismo_fondo', 'triatlon_sprint', 'triatlon_olimpico',
    'triatlon_70_3', 'ironman', 'crossfit', 'otro'
  )),
  fecha_competicion date NOT NULL,
  objetivo text NOT NULL DEFAULT 'completar'
    CHECK (objetivo IN ('completar', 'tiempo_objetivo', 'podio_categoria')),
  tiempo_objetivo_min int,
  activo bool NOT NULL DEFAULT true,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competiciones_cliente_fecha
  ON public.competiciones (cliente_id, fecha_competicion);

ALTER TABLE public.competiciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coach can manage competiciones" ON public.competiciones;
CREATE POLICY "Coach can manage competiciones"
  ON public.competiciones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'coach'
    )
  );

DROP POLICY IF EXISTS "Cliente can view own competiciones" ON public.competiciones;
CREATE POLICY "Cliente can view own competiciones"
  ON public.competiciones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes
      WHERE id = cliente_id AND profile_id = auth.uid()
    )
  );

-- ============================================================
-- 2. Vista fase_deportiva_cliente
-- ============================================================
CREATE OR REPLACE VIEW public.fase_deportiva_cliente AS
SELECT
  c.cliente_id,
  c.id AS competicion_id,
  c.nombre AS competicion_nombre,
  c.disciplina,
  c.fecha_competicion,
  c.objetivo,
  c.tiempo_objetivo_min,
  (c.fecha_competicion - CURRENT_DATE) AS dias_restantes,
  CASE
    WHEN (c.fecha_competicion - CURRENT_DATE) > 90   THEN 'base'
    WHEN (c.fecha_competicion - CURRENT_DATE) > 60   THEN 'construccion'
    WHEN (c.fecha_competicion - CURRENT_DATE) > 20   THEN 'pico'
    WHEN (c.fecha_competicion - CURRENT_DATE) > 7    THEN 'pico_maximo'
    WHEN (c.fecha_competicion - CURRENT_DATE) > 3    THEN 'tapering'
    WHEN (c.fecha_competicion - CURRENT_DATE) > 0    THEN 'carrera_inminente'
    WHEN (c.fecha_competicion - CURRENT_DATE) = 0    THEN 'race_day'
    WHEN (c.fecha_competicion - CURRENT_DATE) >= -10 THEN 'recuperacion'
    ELSE 'finalizada'
  END AS fase_actual,
  CASE
    WHEN (c.fecha_competicion - CURRENT_DATE) BETWEEN 1 AND 7 THEN true
    ELSE false
  END AS alerta_tapering_activa
FROM public.competiciones c
WHERE c.activo = true
ORDER BY c.fecha_competicion ASC;
