-- ============================================================
-- MIGRATION: Añadir tracking de fuentes de datos a alimentos
-- ============================================================

-- Fuente de origen del alimento
alter table public.alimentos add column if not exists fuente text default 'curada'
  check (fuente in ('curada', 'bedca', 'usda', 'openfoodfacts', 'ia', 'coach'));

-- Código externo en la fuente original (ej: barcode de OFF, ID de BEDCA)
alter table public.alimentos add column if not exists codigo_externo text;

-- Última vez que se actualizaron los micronutrientes desde fuente externa
alter table public.alimentos add column if not exists micros_actualizados_en timestamptz;

-- Índice para búsqueda por código de barras
create index if not exists idx_alimentos_codigo_externo on public.alimentos(codigo_externo);

-- Índice para filtrar alimentos sin micronutrientes
create index if not exists idx_alimentos_sin_micros on public.alimentos(vitamina_a_ug) where vitamina_a_ug is null;
