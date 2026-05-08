-- ============================================================
-- NUTRICOACH - Fix duplicados + UNIQUE constraints
-- ============================================================
-- Este script:
--  1. Elimina alimentos duplicados (conserva el más completo)
--  2. Añade UNIQUE constraint para evitar futuros duplicados
--  3. Añade índice para búsqueda case-insensitive
-- ============================================================

-- ============================================================
-- PASO 1: Limpiar duplicados actuales
-- Conservamos el registro con más datos (mayor prioridad de fuente)
-- ============================================================

-- Identificar duplicados por nombre (ignorando mayúsculas/minúsculas)
WITH duplicados AS (
    SELECT 
        LOWER(TRIM(nombre)) as nombre_normalizado,
        COUNT(*) as cnt,
        array_agg(id ORDER BY 
            CASE 
                WHEN fuente = 'curada' THEN 0
                WHEN fuente = 'bedca' THEN 1
                WHEN fuente = 'openfoodfacts' THEN 2
                WHEN fuente = 'ia' THEN 3
                WHEN fuente = 'coach' THEN 4
                ELSE 5
            END,
            -- Preferir el que tiene más datos nutricionales
            (COALESCE(calorias,0) + COALESCE(proteinas,0) + COALESCE(carbohidratos,0) + COALESCE(grasas,0)) DESC
        ) as ids_ordenados
    FROM public.alimentos
    WHERE custom = false OR custom IS NULL
    GROUP BY LOWER(TRIM(nombre))
    HAVING COUNT(*) > 1
)
-- Eliminar duplicados (conservar solo el primero, que es el mejor según el orden)
DELETE FROM public.alimentos
WHERE id IN (
    SELECT unnest(ids_ordenados[2:]) 
    FROM duplicados
);

-- ============================================================
-- PASO 2: Añadir UNIQUE constraint
-- ============================================================

-- Para alimentos base (no custom): nombre único (case-insensitive)
-- Primero limpiamos posibles duplicados restantes por diferencia de espacios
DELETE FROM public.alimentos a1 USING public.alimentos a2
WHERE a1.id > a2.id
  AND LOWER(TRIM(a1.nombre)) = LOWER(TRIM(a2.nombre))
  AND (a1.custom = false OR a1.custom IS NULL)
  AND (a2.custom = false OR a2.custom IS NULL);

-- Añadir columna nombre_normalizado para el unique constraint
ALTER TABLE public.alimentos 
  ADD COLUMN IF NOT EXISTS nombre_normalizado text 
  GENERATED ALWAYS AS (LOWER(TRIM(nombre))) STORED;

-- UNIQUE para alimentos base (no custom)
-- Solo si no hay duplicados
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'alimentos_nombre_normalizado_unique_no_custom'
    ) THEN
        CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS 
            idx_alimentos_nombre_no_custom 
            ON public.alimentos (nombre_normalizado) 
            WHERE (custom = false OR custom IS NULL);
    END IF;
END $$;

-- Para alimentos custom: nombre único por coach
CREATE UNIQUE INDEX IF NOT EXISTS 
    idx_alimentos_nombre_coach_custom 
    ON public.alimentos (nombre_normalizado, coach_id) 
    WHERE custom = true;

-- ============================================================
-- PASO 3: Migrar alimentos BEDCA al mismo formato que el seed
-- Actualizar nombres de BEDCA para que coincidan con los del seed curado
-- ============================================================

-- Actualizar nombres BEDCA para que coincidan con nomenclatura del seed
UPDATE public.alimentos 
SET nombre = 'Pechuga de pollo (cocinada)', fuente = 'bedca'
WHERE LOWER(TRIM(nombre)) = 'pollo (pechuga)' AND (custom = false OR custom IS NULL);

UPDATE public.alimentos 
SET nombre = 'Ternera magra (solomillo)', fuente = 'bedca'
WHERE LOWER(TRIM(nombre)) = 'ternera (lomo)' AND (custom = false OR custom IS NULL);

UPDATE public.alimentos 
SET nombre = 'Lomo de cerdo', fuente = 'bedca'
WHERE LOWER(TRIM(nombre)) = 'cerdo (lomo)' AND (custom = false OR custom IS NULL);

UPDATE public.alimentos 
SET nombre = 'Yogur natural desnatado', fuente = 'bedca'
WHERE LOWER(TRIM(nombre)) = 'yogur natural' AND (custom = false OR custom IS NULL);

UPDATE public.alimentos 
SET nombre = 'Pan blanco', fuente = 'bedca'
WHERE LOWER(TRIM(nombre)) = 'pan blanco' AND (custom = false OR custom IS NULL);

UPDATE public.alimentos 
SET nombre = 'Arroz blanco (cocinado)', fuente = 'bedca'
WHERE LOWER(TRIM(nombre)) = 'arroz blanco' AND (custom = false OR custom IS NULL);

UPDATE public.alimentos 
SET nombre = 'Pasta (cocinada)', fuente = 'bedca'
WHERE LOWER(TRIM(nombre)) = 'pasta (spaghetti)' AND (custom = false OR custom IS NULL);

UPDATE public.alimentos 
SET nombre = 'Avena (copos)', fuente = 'bedca'
WHERE LOWER(TRIM(nombre)) = 'avena (copos)' AND (custom = false OR custom IS NULL);

-- ============================================================
-- PASO 4: Reconstruir el índice unique después de limpiar
-- ============================================================

-- Reindexar
REINDEX INDEX idx_alimentos_nombre_no_custom;
REINDEX INDEX idx_alimentos_nombre_coach_custom;

-- ============================================================
-- PASO 5: Mejorar búsqueda con índice trigram para ILIKE
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_alimentos_nombre_trgm 
  ON public.alimentos USING gin (nombre gin_trgm_ops);
