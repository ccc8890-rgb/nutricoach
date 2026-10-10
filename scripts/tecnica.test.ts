import assert from 'node:assert/strict'
import { lecturaCambio, puntosTecnica, resumenTecnica, type EntrenoTecnica } from '../lib/rendimiento/tecnica'

const dia = (n: number) => new Date(Date.UTC(2026, 9, 10) - n * 86_400_000).toISOString().slice(0, 10)
// Contacto y cadencia dependen del ritmo; las carreras recientes tienen 10 ms menos de contacto y 3 ppm más a igual ritmo.
function carrera(atras: number, ritmo: number, mejora: boolean): EntrenoTecnica {
  return {
    fecha: dia(atras), tipo: 'running', duracion_s: 2400, distancia_m: 7000, ritmo_medio_s_km: ritmo,
    raw: {
      cadencia: 190 - ritmo * 0.04 + (mejora ? 3 : 0),
      zancada_m: 250 - ritmo * 0.4,
      contacto_suelo_ms: 150 + ritmo * 0.3 - (mejora ? 10 : 0),
      oscilacion_vertical_cm: 9,
    },
  }
}
// Ritmos variados (para que la recta se ajuste) en ambas ventanas.
const ritmos = [300, 330, 360, 330, 300]
const entrenos = [
  ...ritmos.map((r, i) => carrera(5 + i * 6, r, true)),     // recientes (≤42 d)
  ...ritmos.map((r, i) => carrera(60 + i * 15, r, false)),  // previas (43-162 d)
]
const pts = puntosTecnica(entrenos)
assert.equal(pts.length, 10)
const res = resumenTecnica(pts, dia(0))!
assert.ok(res)
assert.equal(res.carrerasRecientes, 5)
assert.equal(res.carrerasPrevias, 5)
assert.ok(Math.abs(res.metricas.contacto_ms.delta - -10) < 0.6, `contacto ${res.metricas.contacto_ms.delta}`)
assert.ok(Math.abs(res.metricas.cadencia.delta - 3) < 0.6, `cadencia ${res.metricas.cadencia.delta}`)
assert.ok(res.metricas.contacto_ms.reciente < res.metricas.contacto_ms.previo)

// Filtros: cinta, corta, ritmo absurdo, series y datos incompletos no entran.
const base = carrera(3, 330, true)
const malos: EntrenoTecnica[] = [
  { ...base, tipo: 'treadmill_running' },
  { ...base, duracion_s: 600 },
  { ...base, ritmo_medio_s_km: 150 },
  { ...base, raw: { ...base.raw, contacto_suelo_ms: null } },
  { ...base, vueltas: [...Array(4)].flatMap(() => [
    { tipo: 'ACTIVE', paso: null, distancia_m: 400, duracion_s: 100, fc_media: 170, velocidad_ms: 4 },
    { tipo: 'RECOVERY', paso: null, distancia_m: 200, duracion_s: 90, fc_media: 130, velocidad_ms: 2 },
  ]) },
  { ...base, tipo: 'strength_training' },
]
assert.equal(puntosTecnica(malos).length, 0)

// Zancada en cm y ratio vertical = oscilación / zancada.
const [p] = puntosTecnica([base])
assert.equal(p.zancada_cm, base.raw!.zancada_m)
assert.ok(Math.abs(p.ratio_vertical - (9 / base.raw!.zancada_m!) * 100) < 1e-9)

// Pocas carreras en una ventana → sin comparación.
assert.equal(resumenTecnica(pts.slice(0, 6), dia(0)), null)
assert.equal(resumenTecnica([], dia(0)), null)

assert.equal(lecturaCambio('contacto_ms', -6), 'mejora')
assert.equal(lecturaCambio('contacto_ms', 6), 'empeora')
assert.equal(lecturaCambio('contacto_ms', -3.5), 'estable')
assert.equal(lecturaCambio('ratio_vertical', -0.4), 'mejora')
assert.equal(lecturaCambio('cadencia', 3), 'cambio')
assert.equal(lecturaCambio('cadencia', 0.8), 'estable')
console.log('tecnica.test OK')
