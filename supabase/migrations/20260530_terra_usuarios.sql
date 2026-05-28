-- Terra API: tabla de conexiones (terra_user_id → cliente_id + provider)
-- Terra asigna un user_id distinto por cada conexión (proveedor) del usuario.
-- Esta tabla es el lookup que el webhook usa para mapear datos entrantes al cliente correcto.

CREATE TABLE IF NOT EXISTS terra_usuarios (
  terra_user_id  TEXT        PRIMARY KEY,
  cliente_id     UUID        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  provider       TEXT        NOT NULL,  -- "TRAININGPEAKS", "COROS", "WHOOP", "GARMIN", "STRAVA"...
  activa         BOOLEAN     NOT NULL DEFAULT TRUE,
  ultima_sync    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS terra_usuarios_cliente_idx ON terra_usuarios(cliente_id);

ALTER TABLE terra_usuarios ENABLE ROW LEVEL SECURITY;

-- Solo el service role puede leer/escribir (webhooks y cron usan service_role)
CREATE POLICY "service_role_terra" ON terra_usuarios
  FOR ALL USING (TRUE);
