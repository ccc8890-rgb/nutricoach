-- Superficie de las sesiones de carrera: en cinta los tramos por distancia se envían a Garmin por tiempo.
ALTER TABLE sesiones_entrenamiento ADD COLUMN IF NOT EXISTS superficie text;
ALTER TABLE sesiones_entrenamiento DROP CONSTRAINT IF EXISTS sesiones_superficie_check;
ALTER TABLE sesiones_entrenamiento ADD CONSTRAINT sesiones_superficie_check CHECK (superficie IS NULL OR superficie IN ('pista', 'cinta'));
