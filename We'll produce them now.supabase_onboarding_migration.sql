-- Migration for onboarding system
CREATE TABLE IF NOT EXISTS invitaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32),'hex'),
    coach_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    email text,
    usado boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT now() + interval '7 days'
);

ALTER TABLE invitaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY invitaciones_coach ON invitaciones
    FOR ALL
    USING (coach_id = auth.uid());

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS revisado_por_coach boolean DEFAULT true;
