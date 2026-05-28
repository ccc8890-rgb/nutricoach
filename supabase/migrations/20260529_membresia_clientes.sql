-- supabase/migrations/20260529_membresia_clientes.sql
-- Campos de membresía en tabla clientes
--
-- APLICAR MANUALMENTE en Supabase Dashboard → SQL Editor
-- URL: https://supabase.com/dashboard/project/<project-ref>/sql
--
-- Añade 3 columnas para gestionar el tipo de membresía y sus fechas:
--   tipo_membresia    → trimestral | semestral | anual
--   fecha_inicio_membresia → fecha de inicio del periodo
--   fecha_fin_membresia    → fecha de vencimiento (usada para filtro "próximos a vencer" y barra de progreso)
--
-- Uso futuro: Stripe webhooks poblarán estos campos automáticamente desde
-- los eventos de suscripción. Por ahora el coach los edita manualmente en la UI.

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo_membresia TEXT
    CHECK (tipo_membresia IN ('trimestral', 'semestral', 'anual')),
  ADD COLUMN IF NOT EXISTS fecha_inicio_membresia DATE,
  ADD COLUMN IF NOT EXISTS fecha_fin_membresia DATE;
