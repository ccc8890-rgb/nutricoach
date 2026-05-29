-- Training OS F2 — Contexto IA
-- Añade columnas de salida AI a sesiones y ejercicios
-- Idempotente con IF NOT EXISTS

ALTER TABLE public.sesiones_entrenamiento
  ADD COLUMN IF NOT EXISTS contexto_ia TEXT;

ALTER TABLE public.sesion_ejercicios
  ADD COLUMN IF NOT EXISTS contexto_ia TEXT;
