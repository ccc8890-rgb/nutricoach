-- ================================================================
-- Motor de Inteligencia Clínica — tabla de informes de caso
-- ================================================================

CREATE TABLE IF NOT EXISTS informes_caso_clinico (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id          UUID UNIQUE REFERENCES clientes(id) ON DELETE CASCADE,
  version             INTEGER DEFAULT 1,

  -- Análisis estructurado
  datos_base          JSONB DEFAULT '{}',
  flags_activos       JSONB DEFAULT '[]',
  protocolos_aplicados JSONB DEFAULT '[]',
  parametros_objetivo JSONB DEFAULT '{}',

  -- Outputs narrativos
  narrativa_clinica   TEXT,
  instrucciones_ia    TEXT,

  -- Metadatos
  checkins_analizados INTEGER DEFAULT 0,

  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE informes_caso_clinico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_read_informes" ON informes_caso_clinico
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "service_role_all_informes" ON informes_caso_clinico
  FOR ALL USING (auth.role() = 'service_role');

-- Index para lookups por cliente
CREATE INDEX IF NOT EXISTS idx_informes_cliente_id ON informes_caso_clinico(cliente_id);
