import assert from 'node:assert/strict'
import { evaluarCambio, indicadoresVentana, METRICAS } from '../lib/rendimiento/seguimiento'
import type { EntrenoPanel } from '../lib/rendimiento/panel'

const base = '2026-09-01' // fecha del cambio
const dia = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 86_400_000).toISOString().slice(0, 10)

/** Carrera continua de 50 min (10 vueltas de 5 min; las 2 primeras son calentamiento y no cuentan) con una subida de pulso en la segunda parte. */
function carrera(fecha: string, fc: number, deriva = 0): EntrenoPanel {
  const vueltas = Array.from({ length: 10 }, (_, i) => ({
    tipo: 'ACTIVE', paso: null, distancia_m: 900, duracion_s: 300, velocidad_ms: 3, fc_media: i < 6 ? fc : Math.round(fc * (1 + deriva)),
  }))
  return {
    fecha, tipo: 'running', nombre: null, duracion_s: 3000, distancia_m: 9000, ritmo_medio_s_km: 333, fc_media: fc,
    tss: 40, tss_metodo: 'pulso', carga_garmin: null, vo2max: null, tiempo_zona_fc: null, mejores_parciales: null, raw: null, vueltas,
  }
}
const UMBRAL = 176 // suave < 158

// Antes: rodajes a 168 ppm con deriva alta. Después: rodajes a 145 ppm con deriva baja.
const antes = [-26, -22, -19, -15, -12, -8, -4].map(n => carrera(dia(n), 168, 0.10))
const despues = [2, 5, 9, 12, 16, 19, 23].map(n => carrera(dia(n), 145, 0.02))
const todos = [...antes, ...despues]

const ind = indicadoresVentana(todos, dia(-28), dia(-1), UMBRAL)
assert.equal(ind.pct_suave, 0)
assert.ok(ind.deriva! > 8 && ind.deriva! < 11, `deriva antes ${ind.deriva}`)
assert.ok(Math.abs(ind.km_semana! - (7 * 9) / 4) < 0.01)
assert.equal(Math.round(ind.carga_semana!), 70)

// 40 días después del cambio: evaluable, y funciona (más suave, menos deriva).
const ev = evaluarCambio(todos, base, dia(40), UMBRAL)
assert.equal(ev.estado, 'evaluable')
const por = Object.fromEntries(ev.metricas.map(m => [m.clave, m]))
assert.equal(por.pct_suave.lectura, 'mejora')
assert.ok(por.pct_suave.despues! > 90)
assert.equal(por.deriva.lectura, 'mejora')
assert.ok(por.deriva.delta! < -5)
assert.equal(por.carga_semana.lectura, 'igual') // misma carga: no cambió el volumen
assert.equal(ev.veredicto, 'funciona')

// Con un objetivo declarado manda ese: si buscaba subir km y no subieron → no se nota.
const evObj = evaluarCambio(todos, base, dia(40), UMBRAL, { objetivo: { clave: 'km_semana', direccion: 'sube' } })
assert.equal(evObj.metricas.find(m => m.clave === 'km_semana')!.esObjetivo, true)
assert.equal(evObj.veredicto, 'no_se_nota')

// A los 20 días es un avance; a los 5, está en curso y no se juzga.
assert.equal(evaluarCambio(todos, base, dia(20), UMBRAL).estado, 'avance')
const pronto = evaluarCambio(todos, base, dia(5), UMBRAL)
assert.equal(pronto.estado, 'en_curso')
assert.equal(pronto.veredicto, 'pendiente')

// Empeora: invertimos el escenario.
const inverso = [...[-26, -22, -19, -15, -12, -8, -4].map(n => carrera(dia(n), 145, 0.02)), ...[2, 5, 9, 12, 16, 19, 23].map(n => carrera(dia(n), 168, 0.12))]
assert.equal(evaluarCambio(inverso, base, dia(40), UMBRAL).veredicto, 'empeora')

// Sin umbral del atleta no se calcula el reparto, pero sí el resto; con pocas carreras, deriva sin datos.
const sinUmbral = evaluarCambio(todos, base, dia(40), null)
assert.equal(sinUmbral.metricas.find(m => m.clave === 'pct_suave')!.lectura, 'sin_datos')
const pocas = evaluarCambio([carrera(dia(-5), 168), carrera(dia(10), 145)], base, dia(40), UMBRAL)
assert.equal(pocas.metricas.find(m => m.clave === 'deriva')!.lectura, 'sin_datos')
assert.equal(pocas.veredicto, 'sin_datos')

// Sin ningún entreno: todo sin datos.
assert.equal(evaluarCambio([], base, dia(40), UMBRAL).veredicto, 'sin_datos')
assert.equal(METRICAS.pct_suave.mejor, 'sube')
console.log('seguimiento.test OK')
