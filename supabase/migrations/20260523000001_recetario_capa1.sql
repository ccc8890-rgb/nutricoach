-- Capa 1: Recetario inteligente
-- Añade receta_id a comidas y crea tabla de interacciones receta-cliente

-- 1. Vincular comida generada a su receta
ALTER TABLE comidas
  ADD COLUMN IF NOT EXISTS receta_id uuid REFERENCES recetas(id) ON DELETE SET NULL;

COMMENT ON COLUMN comidas.receta_id IS
  'Receta asignada a esta comida por el plan IA. NULL si es comida de alimentos sueltos.';

-- 2. Historial de interacciones cliente-receta
CREATE TABLE IF NOT EXISTS receta_interacciones_cliente (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  receta_id    uuid NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  tipo         text NOT NULL CHECK (tipo IN (
                 'asignada_plan',
                 'swap_elegida',
                 'swap_rechazada',
                 'like',
                 'dislike',
                 'favorita'
               )),
  plan_id      uuid REFERENCES planes_nutricion(id) ON DELETE SET NULL,
  comida_slot  text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ric_cliente_receta
  ON receta_interacciones_cliente(cliente_id, receta_id);

CREATE INDEX IF NOT EXISTS idx_ric_cliente_tipo_fecha
  ON receta_interacciones_cliente(cliente_id, tipo, created_at DESC);

-- RLS
ALTER TABLE receta_interacciones_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_full_ric" ON receta_interacciones_cliente
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clientes c
      WHERE c.id = receta_interacciones_cliente.cliente_id
        AND c.coach_id = auth.uid()
    )
  );

-- Service role bypass (para API routes con service key)
CREATE POLICY "service_role_ric" ON receta_interacciones_cliente
  FOR ALL TO service_role USING (true) WITH CHECK (true);
