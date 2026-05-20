-- ============================================================
-- MIGRACIÓN: Fuente nutricional + Auditoría de cambios
-- Fase 1.3 + 1.4 del plan de mejoras
-- ============================================================
-- 
-- 1. Añade columna fuente_nutricional a alimentos
-- 2. Migra datos existentes con valores coherentes
-- 3. Crea tabla de auditoría de cambios nutricionales
-- 4. Crea trigger que registra automáticamente los cambios
-- 5. Crea vista de calidad de datos
-- ============================================================

-- ============================================================
-- PASO 1: Columna fuente_nutricional
-- ============================================================
ALTER TABLE public.alimentos 
ADD COLUMN IF NOT EXISTS fuente_nutricional text DEFAULT 'desconocida'
CHECK (fuente_nutricional IN ('bedca', 'deepseek', 'rapida', 'manual', 'scraping_default', 'desconocida'));

-- Columna de timestamp para saber cuándo se actualizó por última vez
ALTER TABLE public.alimentos 
ADD COLUMN IF NOT EXISTS ultima_actualizacion_nutricional timestamptz;

-- ============================================================
-- PASO 2: Migrar datos existentes
-- ============================================================
-- 
-- Criterios:
-- - calorias > 0 AND custom = false → probablemente vino de BEDCA (seed) o deepseek
-- - calorias > 0 AND custom = true → fue añadido manualmente por el coach
-- - calorias = 0 → creado por scraping (scraping_default)
-- - Si ya tenía fuente de una migración anterior, respetarla
--
DO $$
BEGIN
    UPDATE public.alimentos 
    SET fuente_nutricional = 'desconocida'
    WHERE fuente_nutricional IS NULL;
    
    -- Alimentos con macros reales que no son custom → BEDCA o deepseek
    UPDATE public.alimentos 
    SET fuente_nutricional = 'bedca'
    WHERE fuente_nutricional = 'desconocida' 
      AND calorias > 0 
      AND custom = false;
    
    -- Alimentos con macros reales que son custom → manual
    UPDATE public.alimentos 
    SET fuente_nutricional = 'manual'
    WHERE fuente_nutricional = 'desconocida' 
      AND calorias > 0 
      AND custom = true;
    
    -- Alimentos con macros = 0 → scraping_default
    UPDATE public.alimentos 
    SET fuente_nutricional = 'scraping_default'
    WHERE fuente_nutricional = 'desconocida' 
      AND calorias = 0;
    
    -- Actualizar timestamp para todos
    UPDATE public.alimentos 
    SET ultima_actualizacion_nutricional = created_at
    WHERE ultima_actualizacion_nutricional IS NULL;
END $$;

-- ============================================================
-- PASO 3: Tabla de auditoría de cambios nutricionales
-- ============================================================
CREATE TABLE IF NOT EXISTS public.alimentos_nutricion_audit (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    alimento_id uuid REFERENCES public.alimentos(id) ON DELETE CASCADE,
    campo text NOT NULL,           -- 'calorias', 'proteinas', 'carbohidratos', 'grasas', 'fibra', 'azucares'
    old_valor numeric,
    new_valor numeric,
    cambiado_por text DEFAULT 'sistema',  -- 'sistema' | 'coach' | 'deepseek' | 'scraping'
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alimentos_nutricion_audit_alimento 
ON public.alimentos_nutricion_audit(alimento_id);

CREATE INDEX IF NOT EXISTS idx_alimentos_nutricion_audit_created 
ON public.alimentos_nutricion_audit(created_at DESC);

-- ============================================================
-- PASO 4: Trigger de auditoría automática
-- ============================================================
CREATE OR REPLACE FUNCTION public.auditar_cambio_nutricional()
RETURNS trigger AS $$
DECLARE
    cambios text[] := ARRAY['calorias', 'proteinas', 'carbohidratos', 'grasas', 'fibra', 'azucares'];
    campo text;
    old_val numeric;
    new_val numeric;
BEGIN
    FOREACH campo IN ARRAY cambios LOOP
        EXECUTE format('SELECT ($1).%I, ($2).%I', campo, campo) INTO old_val, new_val USING OLD, NEW;
        
        IF old_val IS DISTINCT FROM new_val THEN
            INSERT INTO public.alimentos_nutricion_audit 
                (alimento_id, campo, old_valor, new_valor, cambiado_por)
            VALUES 
                (NEW.id, campo, old_val, new_val, 
                 CASE 
                    WHEN NEW.fuente_nutricional = 'manual' THEN 'coach'
                    WHEN NEW.fuente_nutricional = 'deepseek' THEN 'deepseek'
                    ELSE 'sistema'
                 END
                );
        END IF;
    END LOOP;
    
    -- Actualizar timestamp de modificación
    NEW.ultima_actualizacion_nutricional := now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si ya existe para poder recrearlo
DROP TRIGGER IF EXISTS trg_auditar_nutricion ON public.alimentos;

CREATE TRIGGER trg_auditar_nutricion
BEFORE UPDATE OF calorias, proteinas, carbohidratos, grasas, fibra, azucares
ON public.alimentos
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION public.auditar_cambio_nutricional();

-- ============================================================
-- PASO 5: Vista de calidad de datos
-- ============================================================
CREATE OR REPLACE VIEW public.vista_calidad_datos AS
SELECT
    -- Alimentos sin macros
    (SELECT COUNT(*) FROM public.alimentos WHERE calorias = 0 AND es_comestible = true) AS alimentos_sin_macros,
    (SELECT COUNT(*) FROM public.alimentos WHERE es_comestible = true) AS total_alimentos_comestibles,
    ROUND(
        (SELECT COUNT(*) FROM public.alimentos WHERE calorias = 0 AND es_comestible = true) * 100.0 /
        NULLIF((SELECT COUNT(*) FROM public.alimentos WHERE es_comestible = true), 0), 1
    ) AS pct_sin_macros,
    
    -- Alimentos sin fuente
    (SELECT COUNT(*) FROM public.alimentos WHERE (fuente_nutricional IS NULL OR fuente_nutricional = 'desconocida') AND es_comestible = true) AS alimentos_sin_fuente,
    
    -- Productos con precio
    (SELECT COUNT(*) FROM public.productos_supermercado) AS total_productos,
    (SELECT COUNT(*) FROM public.productos_supermercado WHERE precio_por_kg IS NOT NULL AND precio_por_kg > 0) AS productos_con_precio_unitario,
    ROUND(
        (SELECT COUNT(*) FROM public.productos_supermercado WHERE precio_por_kg IS NOT NULL AND precio_por_kg > 0) * 100.0 /
        NULLIF((SELECT COUNT(*) FROM public.productos_supermercado), 0), 1
    ) AS pct_con_precio_unitario,
    
    -- Distribución de fuentes
    (SELECT jsonb_object_agg(fuente_nutricional, cnt) FROM (
        SELECT COALESCE(fuente_nutricional, 'desconocida') AS fuente_nutricional, COUNT(*) AS cnt
        FROM public.alimentos WHERE es_comestible = true
        GROUP BY fuente_nutricional
    ) f) AS distribucion_fuentes,
    
    -- Auditoría reciente
    (SELECT COUNT(*) FROM public.alimentos_nutricion_audit WHERE created_at > now() - interval '7 days') AS cambios_ultimos_7_dias;

COMMENT ON VIEW public.vista_calidad_datos IS 'Métricas de calidad de datos para el dashboard de supervisión';
COMMENT ON COLUMN public.alimentos.fuente_nutricional IS 'Origen de los valores nutricionales: bedca, deepseek, rapida, manual, scraping_default, desconocida';
COMMENT ON TABLE public.alimentos_nutricion_audit IS 'Registro de auditoría de cambios en valores nutricionales de alimentos';
