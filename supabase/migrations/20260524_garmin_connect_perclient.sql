-- 20260524_garmin_connect_perclient.sql
-- Soporte Garmin Connect por cliente (credenciales propias)

-- 1. Ampliar el CHECK de proveedor para incluir garmin_connect
ALTER TABLE integraciones_cliente
  DROP CONSTRAINT IF EXISTS integraciones_cliente_proveedor_check;

ALTER TABLE integraciones_cliente
  ADD CONSTRAINT integraciones_cliente_proveedor_check
  CHECK (proveedor IN ('strava', 'garmin', 'garmin_connect', 'google_fit', 'whoop', 'manual'));

-- 2. Columna para credenciales cifradas (email/password Garmin Connect)
ALTER TABLE integraciones_cliente
  ADD COLUMN IF NOT EXISTS credenciales_json TEXT;
-- Formato: AES-256-CBC cifrado de JSON {"email":"...","password":"..."}
-- Sólo usado por proveedor='garmin_connect'
