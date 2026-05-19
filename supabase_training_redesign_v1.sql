-- supabase_training_redesign_v1.sql
-- Training Pro Redesign — Sprint 1 migraciones
-- Aplicar en Supabase Dashboard → SQL Editor
-- Idempotente: se puede ejecutar múltiples veces sin error
--
-- Orden de ejecución:
--   1. ALTER TABLE (nuevas columnas)
--   2. CREATE TABLE (registros_sets)
--   3. Índices
--   4. RLS
--   5. Actualizar CHECK constraint de sport_modality

-- ============================================================
-- 1. sesiones_entrenamiento — nuevas columnas
-- ============================================================
ALTER TABLE public.sesiones_entrenamiento
  ADD COLUMN IF NOT EXISTS instruccion_coach text,
  ADD COLUMN IF NOT EXISTS fase_bloque varchar(100),   -- ej: "Semana 4 — Bloque fuerza"
  ADD COLUMN IF NOT EXISTS duracion_estimada_min integer;

-- ============================================================
-- 2. plantilla_sesiones — nuevas columnas
-- ============================================================
ALTER TABLE public.plantilla_sesiones
  ADD COLUMN IF NOT EXISTS instruccion_coach text,
  ADD COLUMN IF NOT EXISTS fase_bloque varchar(100),
  ADD COLUMN IF NOT EXISTS duracion_estimada_min integer;

-- ============================================================
-- 3. sesion_ejercicios — nuevas columnas
-- ============================================================
ALTER TABLE public.sesion_ejercicios
  ADD COLUMN IF NOT EXISTS sets_config jsonb,          -- configuración de sets por modalidad
  ADD COLUMN IF NOT EXISTS instruccion_ejercicio text, -- instrucción específica del coach para este ejercicio
  ADD COLUMN IF NOT EXISTS tempo varchar(20);           -- ej: "3-1-2" (excéntrica-pausa-concéntrica)

-- ============================================================
-- 4. plantilla_sesion_ejercicios — nuevas columnas
-- ============================================================
ALTER TABLE public.plantilla_sesion_ejercicios
  ADD COLUMN IF NOT EXISTS sets_config jsonb,
  ADD COLUMN IF NOT EXISTS instruccion_ejercicio text,
  ADD COLUMN IF NOT EXISTS tempo varchar(20);

-- ============================================================
-- 5. registros_sets — nueva tabla
-- ============================================================
CREATE TABLE IF NOT EXISTS public.registros_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  sesion_ejercicio_id uuid REFERENCES public.sesion_ejercicios(id) ON DELETE SET NULL,
  ejercicio_id uuid NOT NULL REFERENCES public.ejercicios(id) ON DELETE RESTRICT,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  sets_ejecutados jsonb NOT NULL DEFAULT '[]'::jsonb,  -- Array de {set_num, peso_kg, reps, rpe, tiempo_s, distancia_m}
  duracion_sesion_s integer,
  esfuerzo_percibido integer CHECK (esfuerzo_percibido BETWEEN 1 AND 10),
  notas text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 6. Índices para registros_sets
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_registros_sets_cliente_ejercicio
  ON public.registros_sets(cliente_id, ejercicio_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_registros_sets_fecha
  ON public.registros_sets(cliente_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_registros_sets_sesion_ejercicio
  ON public.registros_sets(sesion_ejercicio_id);

-- ============================================================
-- 7. RLS — registros_sets
-- ============================================================
ALTER TABLE public.registros_sets ENABLE ROW LEVEL SECURITY;

-- Coach: ve registros de sus clientes
CREATE POLICY "Coach ve registros de sus clientes"
  ON public.registros_sets
  FOR SELECT
  USING (
    cliente_id IN (
      SELECT id FROM public.clientes WHERE coach_id = auth.uid()
    )
  );

-- Cliente: ve y gestiona sus propios registros
CREATE POLICY "Cliente gestiona sus registros"
  ON public.registros_sets
  FOR ALL
  USING (
    cliente_id IN (
      SELECT id FROM public.clientes
      WHERE id::text = (
        SELECT raw_user_meta_data->>'cliente_id'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

-- ============================================================
-- 8. Actualizar CHECK constraint de sport_modality en
--    plantillas_entrenamiento (añadir natacion + triatlon)
-- ============================================================
-- Paso 1: Eliminar el CHECK constraint existente
ALTER TABLE public.plantillas_entrenamiento
  DROP CONSTRAINT IF EXISTS plantillas_entrenamiento_sport_modality_check;

-- Paso 2: Crear el nuevo CHECK con los valores actualizados
ALTER TABLE public.plantillas_entrenamiento
  ADD CONSTRAINT plantillas_entrenamiento_sport_modality_check
  CHECK (
    sport_modality IS NULL OR
    sport_modality IN (
      'gym_estetica','gym_fuerza','funcional','hyrox',
      'ciclismo','running','hibrido','calistenia',
      'natacion','triatlon'
    )
  );

-- ============================================================
-- 9. Vista materializada para PR tracking
-- ============================================================
CREATE OR REPLACE VIEW public.prs_por_ejercicio AS
SELECT DISTINCT ON (cliente_id, ejercicio_id)
  cliente_id,
  ejercicio_id,
  fecha,
  (sets_ejecutados -> 0 ->> 'peso_kg')::numeric AS peso_max_kg,
  (sets_ejecutados -> 0 ->> 'reps')::integer AS reps_en_pr,
  ((sets_ejecutados -> 0 ->> 'peso_kg')::numeric * (sets_ejecutados -> 0 ->> 'reps')::integer) AS volumen_pr
FROM public.registros_sets,
  LATERAL jsonb_array_elements(sets_ejecutados) AS s(set_data)
WHERE (s.set_data ->> 'peso_kg') IS NOT NULL
ORDER BY cliente_id, ejercicio_id, (s.set_data ->> 'peso_kg')::numeric DESC;

COMMENT ON VIEW public.prs_por_ejercicio IS 'PR tracking: mejor marca (peso) por ejercicio y cliente';
