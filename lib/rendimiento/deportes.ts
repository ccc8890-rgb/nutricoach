// lib/rendimiento/deportes.ts
// Clasificación de los tipos de actividad de Garmin en los deportes que tienen su propio apartado en Rendimiento.
import { esCarrera } from './carga'

export type Deporte = 'running' | 'ciclismo' | 'natacion' | 'fuerza' | 'otros'

/** Deportes con apartado propio, en el orden en que se muestran. */
export const DEPORTES_CON_PANEL = ['running', 'ciclismo', 'natacion', 'fuerza'] as const
export type DeporteConPanel = (typeof DEPORTES_CON_PANEL)[number]

export const NOMBRE_DEPORTE: Record<Deporte, string> = {
  running: 'Running', ciclismo: 'Ciclismo', natacion: 'Natación', fuerza: 'Fuerza', otros: 'Otros',
}

const CICLISMO = new Set([
  'cycling', 'road_biking', 'mountain_biking', 'gravel_cycling', 'indoor_cycling', 'virtual_ride',
  'cyclocross', 'bmx', 'e_bike_fitness', 'e_bike_mountain', 'track_cycling', 'recumbent_cycling',
])
const NATACION = new Set(['lap_swimming', 'open_water_swimming', 'swimming'])
const FUERZA = new Set(['strength_training', 'hiit'])

export function deporteDe(tipo: string | null | undefined): Deporte {
  if (!tipo) return 'otros'
  if (esCarrera(tipo)) return 'running'
  if (CICLISMO.has(tipo)) return 'ciclismo'
  if (NATACION.has(tipo)) return 'natacion'
  if (FUERZA.has(tipo)) return 'fuerza'
  return 'otros'
}
