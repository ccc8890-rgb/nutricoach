-- Añade planificación semanal a las comidas de un plan nutricional.
-- Los planes antiguos quedan en Lunes para mantener compatibilidad visual.

ALTER TABLE comidas
  ADD COLUMN IF NOT EXISTS dia_semana text
  CHECK (
    dia_semana IS NULL OR dia_semana IN (
      'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'
    )
  );

UPDATE comidas
SET dia_semana = 'Lunes'
WHERE dia_semana IS NULL;

CREATE INDEX IF NOT EXISTS idx_comidas_plan_dia_orden
  ON comidas(plan_id, dia_semana, orden);
