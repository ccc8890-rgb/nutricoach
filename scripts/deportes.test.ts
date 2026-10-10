import assert from 'node:assert/strict'
import { deporteDe } from '../lib/rendimiento/deportes'
import { construirPanel, type EntrenoPanel } from '../lib/rendimiento/panel'

assert.equal(deporteDe('running'), 'running')
assert.equal(deporteDe('treadmill_running'), 'running')
assert.equal(deporteDe('trail_running'), 'running')
assert.equal(deporteDe('cycling'), 'ciclismo')
assert.equal(deporteDe('indoor_cycling'), 'ciclismo')
assert.equal(deporteDe('lap_swimming'), 'natacion')
assert.equal(deporteDe('open_water_swimming'), 'natacion')
assert.equal(deporteDe('strength_training'), 'fuerza')
assert.equal(deporteDe('hiking'), 'otros')
assert.equal(deporteDe(null), 'otros')

const base = { nombre: null, duracion_s: 3600, distancia_m: 10000, ritmo_medio_s_km: 360, fc_media: 150, tss_metodo: null, carga_garmin: null, vo2max: null, tiempo_zona_fc: null, mejores_parciales: null, raw: null } as const
const e = (fecha: string, tipo: string, tss: number, distancia_m = 10000): EntrenoPanel => ({ ...base, fecha, tipo, tss, distancia_m })
const panel = construirPanel([
  e('2026-10-05', 'running', 60), e('2026-10-07', 'cycling', 80, 40000), e('2026-10-08', 'strength_training', 30, 0), e('2026-10-09', 'hiking', 20),
], [], '2026-10-10')

assert.deepEqual(panel.deportes.map(d => d.deporte), ['running', 'ciclismo', 'natacion', 'fuerza'])
const por = Object.fromEntries(panel.deportes.map(d => [d.deporte, d]))
assert.equal(por.running.sesiones, 1)
assert.equal(por.ciclismo.sesiones, 1)
assert.equal(por.natacion.sesiones, 0)
assert.equal(por.natacion.ultimaFecha, null)
assert.equal(por.fuerza.sesiones, 1)
// «hiking» (otros) no cuenta en ningún deporte con apartado propio pero sí en la carga general.
assert.equal(panel.deportes.reduce((a, d) => a + d.sesiones, 0), 3)
// El km de ciclismo cuenta en su resumen, no en el general de carrera.
assert.equal(por.ciclismo.semanas.at(-1)!.km, 40)
assert.equal(panel.semanas.at(-1)!.km, 10)
assert.equal(por.ciclismo.entrenos[0].tipo, 'cycling')
console.log('deportes.test OK')
