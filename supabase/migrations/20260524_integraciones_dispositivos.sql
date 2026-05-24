-- supabase/migrations/20260524_integraciones_dispositivos.sql

-- ── Tokens OAuth por cliente y proveedor ─────────────────────
CREATE TABLE IF NOT EXISTS integraciones_cliente (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  proveedor       TEXT NOT NULL CHECK (proveedor IN ('strava','garmin','google_fit','whoop','manual')),
  access_token    TEXT,
  refresh_token   TEXT,
  token_expires_at TIMESTAMPTZ,
  proveedor_user_id TEXT,          -- ID del usuario en el proveedor externo
  scope           TEXT,
  activa          BOOLEAN NOT NULL DEFAULT true,
  ultima_sync     TIMESTAMPTZ,
  error_ultimo    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, proveedor)
);

-- ── Actividad normalizada de cualquier fuente ────────────────
CREATE TABLE IF NOT EXISTS actividad_externa_cliente (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  proveedor       TEXT NOT NULL,
  fecha           DATE NOT NULL,
  -- Actividad física
  pasos           INT,
  distancia_km    NUMERIC(6,2),
  calorias_activas INT,             -- kcal quemadas en ejercicio
  calorias_totales INT,             -- TDEE real del día (si disponible)
  minutos_activo  INT,
  minutos_alta_intensidad INT,
  -- Entrenamiento específico
  tipo_entreno    TEXT,             -- 'run','ride','swim','strength','hike',etc.
  duracion_min    INT,
  distancia_entreno_km NUMERIC(6,2),
  tss             NUMERIC(6,1),    -- Training Stress Score (Strava/Garmin)
  ftp_potencia    INT,             -- FTP watts si es ciclismo
  pace_min_km     NUMERIC(5,2),   -- ritmo running
  fc_media        INT,
  fc_max          INT,
  -- Recuperación
  hrv             NUMERIC(5,1),   -- Heart Rate Variability (ms, rMSSD)
  sueno_h         NUMERIC(3,1),
  sueno_calidad   INT,            -- 1-100
  rhr             INT,            -- Resting Heart Rate
  -- Metadatos
  raw_data        JSONB,          -- datos originales del proveedor sin procesar
  proveedor_activity_id TEXT,     -- ID nativo en el proveedor (para deduplicar)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraint único separado para manejar el COALESCE
CREATE UNIQUE INDEX IF NOT EXISTS idx_aec_unique_activity
  ON actividad_externa_cliente (cliente_id, proveedor, fecha, COALESCE(proveedor_activity_id, fecha::TEXT));

-- Índices de consulta frecuente
CREATE INDEX IF NOT EXISTS idx_aec_cliente_fecha ON actividad_externa_cliente (cliente_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_aec_proveedor ON actividad_externa_cliente (proveedor, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_int_cliente ON integraciones_cliente (cliente_id, activa);

-- RLS
ALTER TABLE integraciones_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividad_externa_cliente ENABLE ROW LEVEL SECURITY;

-- Service role bypassa RLS (para agentes y crons)
CREATE POLICY "service_role_integraciones" ON integraciones_cliente
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_actividad" ON actividad_externa_cliente
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger updated_at en integraciones
CREATE OR REPLACE FUNCTION update_integraciones_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_integraciones_updated_at ON integraciones_cliente;
CREATE TRIGGER trg_integraciones_updated_at
  BEFORE UPDATE ON integraciones_cliente
  FOR EACH ROW EXECUTE FUNCTION update_integraciones_updated_at();
