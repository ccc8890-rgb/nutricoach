-- ============================================================
-- FASE 4 — Periodización nutricional dinámica
-- Fecha: 17-05-2026
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- REQUIERE: supabase_fase3_tls.sql aplicado previamente
-- ============================================================

-- ============================================================
-- 1. Tabla periodizacion_acciones — historial de decisiones
-- ============================================================
CREATE TABLE IF NOT EXISTS public.periodizacion_acciones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  checkin_id uuid REFERENCES public.checkins(id) ON DELETE SET NULL,
  accion text NOT NULL CHECK (accion IN (
    'refeed_sugerir',
    'higiene_sueno',
    'mensaje_apoyo',
    'ajuste_calorico_10pct',
    'alerta_coach_solo',
    'sin_accion'
  )),
  -- Snapshot de los inputs para auditoría
  input_snapshot jsonb NOT NULL DEFAULT '{}',
  -- Resultado: ajuste de macros calculado (si aplica)
  ajuste_macros jsonb,
  -- Flujo de aprobación para refeeds y alertas
  requiere_aprobacion bool NOT NULL DEFAULT false,
  aprobado_por_coach bool,
  coach_nota text,
  -- Estado de aplicación
  aplicado bool NOT NULL DEFAULT false,
  -- Mensaje generado por IA (para mensaje_apoyo)
  mensaje_generado text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_periodizacion_cliente_fecha
  ON public.periodizacion_acciones (cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_periodizacion_pendientes
  ON public.periodizacion_acciones (aprobado_por_coach, requiere_aprobacion)
  WHERE requiere_aprobacion = true AND aprobado_por_coach IS NULL;

ALTER TABLE public.periodizacion_acciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coach can manage periodizacion_acciones" ON public.periodizacion_acciones;
CREATE POLICY "Coach can manage periodizacion_acciones"
  ON public.periodizacion_acciones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'coach'
    )
  );

-- ============================================================
-- 2. Vista: acciones pendientes de aprobación (para badge coach)
-- clientes.nombre no existe → join a profiles para obtener el nombre
-- ============================================================
CREATE OR REPLACE VIEW public.periodizacion_pendientes AS
SELECT
  pa.id,
  pa.cliente_id,
  pa.accion,
  pa.created_at,
  COALESCE(p.nombre, p.email, 'Cliente') AS cliente_nombre
FROM public.periodizacion_acciones pa
JOIN public.clientes c ON c.id = pa.cliente_id
LEFT JOIN public.profiles p ON p.id = c.profile_id
WHERE pa.requiere_aprobacion = true
  AND pa.aprobado_por_coach IS NULL
ORDER BY pa.created_at DESC;
