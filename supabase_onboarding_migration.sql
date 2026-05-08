-- Migración: Sistema de onboarding autónomo de clientes
-- Ejecutar en: Supabase Dashboard > SQL Editor

-- 1. Tabla de invitaciones
CREATE TABLE IF NOT EXISTS invitaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    coach_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email text,
    usado boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT now() + interval '7 days'
);

-- 2. RLS — el coach solo ve sus propias invitaciones
ALTER TABLE invitaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY invitaciones_coach ON invitaciones
    FOR ALL
    USING (coach_id = auth.uid());

-- 3. Columna para marcar clientes sin revisar por el coach
--    Los clientes creados manualmente nacen como revisados (default true).
--    Los que llegan por onboarding se insertan con false.
ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS revisado_por_coach boolean DEFAULT true;
