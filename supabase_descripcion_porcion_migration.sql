-- Migración: añadir campo descripcion_porcion a recetas
-- Ejecutar en Supabase SQL Editor
-- Ejemplo de valor: "1 galleta", "2 tacos", "1 rebanada", "100g"

ALTER TABLE public.recetas
ADD COLUMN IF NOT EXISTS descripcion_porcion text;
