-- Índices para escalar a cientos de clientes
-- Ejecutar en Supabase SQL Editor

-- Director de agentes: carga todos los clientes activos en cada cron
-- Sin índice: seq-scan completo de `clientes`. Con índice: lookup instantáneo.
CREATE INDEX IF NOT EXISTS idx_clientes_activo
  ON clientes(activo)
  WHERE activo = true;

-- Agente tareas: dashboard coach muestra pendientes/aprobadas de hoy
CREATE INDEX IF NOT EXISTS idx_agente_tareas_estado_fecha
  ON agente_tareas(estado, revisado_at DESC);

-- Checkins: contexto IA carga últimos N por cliente — sin índice, full scan
CREATE INDEX IF NOT EXISTS idx_checkins_cliente_fecha
  ON checkins(cliente_id, fecha DESC);

-- Registros entrenamiento: historial y PRs por cliente
CREATE INDEX IF NOT EXISTS idx_registros_sesion_cliente_fecha
  ON registros_sesion_entrenamiento(cliente_id, fecha DESC);

-- Actividad externa (Garmin/Strava): cron y agentes cargan últimos 7d
-- Índice compuesto ya existe en migration 20260524, solo verificamos:
-- idx_aec_cliente_fecha ON actividad_externa_cliente(cliente_id, fecha DESC)

-- Planes nutricion: portal carga plan activo por código_publico
-- Columna ya tiene índice implícito si es UNIQUE; si no, crear:
CREATE INDEX IF NOT EXISTS idx_planes_nutricion_codigo
  ON planes_nutricion(codigo_publico)
  WHERE activo = true;

-- Recetas: filtros por estado en recetario (sugeridas, revisar, etc.)
CREATE INDEX IF NOT EXISTS idx_recetas_estado
  ON recetas(estado)
  WHERE estado = 'aprobada';

-- Ingredientes: join frecuente receta_id → receta_ingredientes
CREATE INDEX IF NOT EXISTS idx_receta_ingredientes_receta_id
  ON receta_ingredientes(receta_id);
