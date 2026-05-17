-- ============================================================
-- FASE 3 — Training Load Score (TLS)
-- Fecha: 17-05-2026
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Campo tls_umbral_carga_alta en clientes
-- ============================================================
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tls_umbral_carga_alta int NOT NULL DEFAULT 80;

COMMENT ON COLUMN public.clientes.tls_umbral_carga_alta IS
  'Umbral de carga alta semanal en puntos TLS. General: 80, Atleta rendimiento: 150+';

-- ============================================================
-- 2. Tabla registros_entreno — logs reales del cliente
-- ============================================================
CREATE TABLE IF NOT EXISTS public.registros_entreno (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  tipo_actividad text NOT NULL CHECK (tipo_actividad IN (
    'running', 'gym', 'hyrox', 'crossfit', 'ciclismo',
    'natacion', 'trail', 'yoga', 'otro'
  )),
  duracion_min int NOT NULL CHECK (duracion_min > 0 AND duracion_min <= 600),
  rpe numeric(3,1) NOT NULL CHECK (rpe >= 1 AND rpe <= 10),
  -- TLS = duracion_min × (rpe / 10)²
  tls_diario numeric(6,1) GENERATED ALWAYS AS
    (ROUND((duracion_min * POWER(rpe / 10.0, 2))::numeric, 1)) STORED,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registros_entreno_cliente_fecha
  ON public.registros_entreno (cliente_id, fecha DESC);

ALTER TABLE public.registros_entreno ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coach can manage registros_entreno" ON public.registros_entreno;
CREATE POLICY "Coach can manage registros_entreno"
  ON public.registros_entreno FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = cliente_id AND (p.role = 'coach' OR c.profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Cliente can manage own registros_entreno" ON public.registros_entreno;
CREATE POLICY "Cliente can manage own registros_entreno"
  ON public.registros_entreno FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes
      WHERE id = cliente_id AND profile_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Vista tls_por_cliente — TLS semanal y acumulado (4 sem)
-- ============================================================
CREATE OR REPLACE VIEW public.tls_por_cliente AS
SELECT
  cliente_id,
  date_trunc('week', fecha)::date AS semana_inicio,
  ROUND(SUM(tls_diario)::numeric, 1) AS tls_semanal,
  COUNT(*) AS num_sesiones
FROM public.registros_entreno
GROUP BY cliente_id, date_trunc('week', fecha);

-- ============================================================
-- 4. Función RPC: tls_dashboard — datos completos para un cliente
-- Devuelve: tls_semana_actual, tls_promedio_4sem, sesiones_esta_semana,
--           umbral, porcentaje_umbral, semaforo
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_tls_dashboard(p_cliente_id uuid)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER AS $$
WITH semana_actual AS (
  SELECT
    COALESCE(SUM(tls_diario), 0) AS tls_semanal,
    COUNT(*) AS num_sesiones
  FROM public.registros_entreno
  WHERE cliente_id = p_cliente_id
    AND fecha >= date_trunc('week', CURRENT_DATE)
    AND fecha < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
),
ultimas_4_semanas AS (
  SELECT tls_semanal
  FROM public.tls_por_cliente
  WHERE cliente_id = p_cliente_id
    AND semana_inicio >= date_trunc('week', CURRENT_DATE) - INTERVAL '3 weeks'
),
umbral AS (
  SELECT COALESCE(tls_umbral_carga_alta, 80) AS umbral
  FROM public.clientes
  WHERE id = p_cliente_id
),
sesiones_recientes AS (
  SELECT
    fecha,
    tipo_actividad,
    duracion_min,
    rpe,
    tls_diario,
    notas
  FROM public.registros_entreno
  WHERE cliente_id = p_cliente_id
  ORDER BY fecha DESC, created_at DESC
  LIMIT 7
)
SELECT json_build_object(
  'tls_semana_actual',    ROUND((SELECT tls_semanal FROM semana_actual)::numeric, 1),
  'num_sesiones',         (SELECT num_sesiones FROM semana_actual),
  'tls_promedio_4sem',    (SELECT ROUND(COALESCE(AVG(tls_semanal), 0)::numeric, 1) FROM ultimas_4_semanas),
  'umbral',               (SELECT umbral FROM umbral),
  'porcentaje_umbral',    CASE
                            WHEN (SELECT umbral FROM umbral) = 0 THEN 0
                            ELSE ROUND(
                              ((SELECT tls_semanal FROM semana_actual) /
                               (SELECT umbral FROM umbral) * 100)::numeric, 0
                            )
                          END,
  'semaforo',             CASE
                            WHEN (SELECT tls_semanal FROM semana_actual) <
                                 (SELECT umbral FROM umbral) * 0.5 THEN 'bajo'
                            WHEN (SELECT tls_semanal FROM semana_actual) <
                                 (SELECT umbral FROM umbral) THEN 'normal'
                            WHEN (SELECT tls_semanal FROM semana_actual) <
                                 (SELECT umbral FROM umbral) * 1.3 THEN 'alto'
                            ELSE 'muy_alto'
                          END,
  'sesiones_recientes',   (SELECT json_agg(row_to_json(sesiones_recientes.*))
                           FROM sesiones_recientes)
);
$$;
