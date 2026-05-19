-- Migración: Añadir columnas de desglose de carbohidratos
-- azucares_anyadidos, almidon, polialcoholes

ALTER TABLE alimentos
ADD COLUMN IF NOT EXISTS azucares_anyadidos NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS almidon NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS polialcoholes NUMERIC DEFAULT NULL;

-- Actualizar la vista de pendientes de enriquecer (si existe)
-- para incluir estos nuevos campos
DROP VIEW IF EXISTS alimentos_pendientes_enriquecer;
CREATE VIEW alimentos_pendientes_enriquecer AS
SELECT
    id,
    nombre,
    categoria,
    calorias,
    proteinas,
    carbohidratos,
    grasas,
    fibra,
    azucares,
    azucares_anyadidos,
    almidon,
    polialcoholes
FROM alimentos
WHERE (calorias IS NULL OR calorias = 0)
  AND es_comestible = true
  AND fuente != 'bedca'
  AND deleted_at IS NULL;
