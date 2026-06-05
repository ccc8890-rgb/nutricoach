-- Stripe payment columns for clientes table
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_tipo                TEXT CHECK (plan_tipo IN ('base','pro','ultra','custom')),
  ADD COLUMN IF NOT EXISTS plan_precio              NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS fecha_inicio_plan        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pagado_via_stripe        BOOLEAN DEFAULT false;
