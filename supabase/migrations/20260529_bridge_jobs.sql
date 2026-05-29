-- supabase/migrations/20260529_bridge_jobs.sql
-- State machine para el pipeline Content Radar → NutriCoach

CREATE TABLE IF NOT EXISTS bridge_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id       UUID REFERENCES recetas(id) ON DELETE SET NULL,
  video_url       TEXT NOT NULL,
  titulo          TEXT,
  estado          TEXT NOT NULL DEFAULT 'pendiente',
  -- pendiente | en_proceso | completado | fallido | fallido_definitivo
  paso_actual     TEXT,
  -- extraer_ingredientes | match_ingredientes | calcular_macros |
  -- generar_imagen | insertar_receta | subir_imagen
  intentos        INT NOT NULL DEFAULT 0,
  max_intentos    INT NOT NULL DEFAULT 3,
  error_ultimo    TEXT,
  payload_json    JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bridge_jobs_estado     ON bridge_jobs(estado);
CREATE INDEX IF NOT EXISTS idx_bridge_jobs_updated    ON bridge_jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_bridge_jobs_receta     ON bridge_jobs(receta_id);

-- RLS: solo service_role puede operar (el bridge usa service role key)
ALTER TABLE bridge_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON bridge_jobs
  USING (true) WITH CHECK (true);
