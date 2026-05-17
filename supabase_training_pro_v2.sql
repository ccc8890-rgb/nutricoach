-- supabase_training_pro_v2.sql
-- Aplicar en Supabase Dashboard → SQL Editor

-- ─────────────────────────────────────────────────────────────
-- 1. plantillas_entrenamiento — nuevas columnas
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.plantillas_entrenamiento
  ADD COLUMN IF NOT EXISTS sport_modality text
    CHECK (sport_modality IN (
      'gym_estetica','gym_fuerza','funcional','hyrox',
      'ciclismo','running','hibrido','calistenia'
    )),
  ADD COLUMN IF NOT EXISTS objetivo_especifico text,
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'general'
    CHECK (tier IN ('general','elite')),
  ADD COLUMN IF NOT EXISTS phase_adjustments jsonb DEFAULT '{
    "base":         {"volumen":1.0, "intensidad":1.0},
    "construccion": {"volumen":1.15,"intensidad":1.1},
    "pico":         {"volumen":1.0, "intensidad":1.15},
    "tapering":     {"volumen":0.65,"intensidad":0.9},
    "race_day":     {"volumen":0.2, "intensidad":0.6},
    "recuperacion": {"volumen":0.45,"intensidad":0.7}
  }'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- 2. plantilla_sesion_ejercicios — nuevas columnas
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.plantilla_sesion_ejercicios
  ADD COLUMN IF NOT EXISTS unidad text DEFAULT 'reps'
    CHECK (unidad IN ('reps','cal','metros','segundos','km','pct_ftp','km_h','kg')),
  ADD COLUMN IF NOT EXISTS carga_tipo text
    CHECK (carga_tipo IN ('peso_kg','pct_rm','pct_ftp','rpe','zona_fc','rir','sin_carga')),
  ADD COLUMN IF NOT EXISTS carga_valor float,
  ADD COLUMN IF NOT EXISTS notas_tecnicas text,
  ADD COLUMN IF NOT EXISTS sustituciones jsonb DEFAULT '[]'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- 3. perfil_entreno_cliente — nueva tabla
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.perfil_entreno_cliente (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE UNIQUE NOT NULL,
  sport_modality text,
  objetivo_especifico text,
  nivel text CHECK (nivel IN ('principiante','intermedio','avanzado')),
  dias_disponibles int DEFAULT 4,
  mejor_momento_sesion text CHECK (mejor_momento_sesion IN ('manana','tarde','noche','variable')),
  ftp_watts int,
  vdot float,
  rm_sentadilla_kg float,
  rm_banca_kg float,
  rm_peso_muerto_kg float,
  dominadas_max_reps int,
  capacidad_recuperacion text DEFAULT 'media'
    CHECK (capacidad_recuperacion IN ('baja','media','alta')),
  respuesta_a_volumen text DEFAULT 'medio'
    CHECK (respuesta_a_volumen IN ('bajo','medio','alto')),
  patron_lesiones jsonb DEFAULT '[]'::jsonb,
  adherencia_historica_pct float,
  respuesta_psicologica text DEFAULT 'rutina'
    CHECK (respuesta_psicologica IN ('variedad','rutina','competicion')),
  plateau_detectado boolean DEFAULT false,
  semanas_sin_progresion int DEFAULT 0,
  equipo_disponible jsonb DEFAULT '["barra","mancuernas","polea","cardio_maquinas"]'::jsonb,
  restricciones_temporales text,
  hrv_baseline float,
  hrv_fecha_ultimo date,
  vo2max_estimado float,
  fms_score jsonb,
  garmin_user_id text,
  strava_athlete_id text,
  apple_health_enabled boolean DEFAULT false,
  fisio_informe jsonb DEFAULT '[]'::jsonb,
  analisis_sangre jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.perfil_entreno_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach can manage perfil_entreno_cliente"
  ON public.perfil_entreno_cliente FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      JOIN public.profiles p ON p.id = c.coach_id
      WHERE c.id = cliente_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "Cliente can read own perfil_entreno"
  ON public.perfil_entreno_cliente FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. ajustes_sesion_cliente — nueva tabla
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ajustes_sesion_cliente (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  plantilla_sesion_id uuid REFERENCES public.plantilla_sesiones(id) ON DELETE SET NULL,
  fecha_semana date NOT NULL,
  motivo text CHECK (motivo IN (
    'lesion','molestia','fatiga_alta','hrv_bajo','viaje',
    'equipo_no_disponible','sobreentrenamiento','deload','coach_manual'
  )),
  detalle_motivo text,
  ajuste_aplicado jsonb,
  razonamiento_ia text,
  generado_por text DEFAULT 'ia' CHECK (generado_por IN ('ia','coach')),
  estado text DEFAULT 'propuesto'
    CHECK (estado IN ('propuesto','aprobado','modificado','revertido')),
  coach_notas text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ajustes_sesion_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach can manage ajustes_sesion_cliente"
  ON public.ajustes_sesion_cliente FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.coach_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. Índices
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_plantillas_sport_modality
  ON public.plantillas_entrenamiento(sport_modality);
CREATE INDEX IF NOT EXISTS idx_plantillas_tier
  ON public.plantillas_entrenamiento(tier);
CREATE INDEX IF NOT EXISTS idx_ajustes_cliente_semana
  ON public.ajustes_sesion_cliente(cliente_id, fecha_semana);
