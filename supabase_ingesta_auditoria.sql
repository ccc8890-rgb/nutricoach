-- ============================================================
-- Tabla de auditoría para el pipeline de ingesta de papers
-- Creada: 21-05-2026 (Mejora #2)
-- ============================================================
-- Registra cada ejecución del pipeline con su resultado completo.
-- Proporciona trazabilidad y permite diagnosticar ejecuciones fallidas.

CREATE TABLE IF NOT EXISTS public.ingesta_auditoria (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'ingesta_pipeline',
  resultado jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingesta_auditoria_pkey PRIMARY KEY (id)
);

-- Índice para consultar ejecuciones recientes
CREATE INDEX IF NOT EXISTS idx_ingesta_auditoria_created_at
  ON public.ingesta_auditoria (created_at DESC);

-- Comentarios
COMMENT ON TABLE public.ingesta_auditoria IS 'Auditoría del pipeline de ingesta de papers (Mejora #2)';
COMMENT ON COLUMN public.ingesta_auditoria.tipo IS 'Tipo de ejecución (ej: ingesta_pipeline)';
COMMENT ON COLUMN public.ingesta_auditoria.resultado IS 'Resultado completo de la ejecución (ResultadoIngesta)';
