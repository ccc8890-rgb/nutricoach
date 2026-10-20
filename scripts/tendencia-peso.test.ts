import assert from 'node:assert/strict'
import { evaluarTendenciaPeso, metaDesdeObjetivo, ritmoSemanal, type PuntoPeso } from '../lib/periodizacion/tendencia-peso'

const serie = (inicio: number, kgSemana: number, semanas: number): PuntoPeso[] =>
  Array.from({ length: semanas + 1 }, (_, i) => ({ fecha: new Date(Date.UTC(2026, 8, 1 + i * 7)).toISOString().slice(0, 10), peso: inicio + kgSemana * i }))

assert.equal(metaDesdeObjetivo('perder_grasa'), 'perder')
assert.equal(metaDesdeObjetivo('ganar_musculo'), 'ganar')
assert.equal(metaDesdeObjetivo('mantener'), 'mantener')
assert.equal(metaDesdeObjetivo('rendimiento'), null)
assert.equal(metaDesdeObjetivo(null), null)

// Ritmo: 100 kg bajando 0,5 kg/semana = -0,5 %/semana
const r = ritmoSemanal(serie(100, -0.5, 4))!
assert.ok(Math.abs(r.pct + 0.5) < 0.05, `ritmo ${r.pct}`)
assert.equal(ritmoSemanal(serie(100, -0.5, 1)), null) // 2 puntos: no hay tendencia

// Perder
assert.equal(evaluarTendenciaPeso(serie(80, -0.4, 4), 'perder').estado, 'en_rango')          // -0,5 %/sem
assert.equal(evaluarTendenciaPeso(serie(80, -1.0, 3), 'perder').estado, 'perdida_rapida')    // -1,25 %/sem
assert.equal(evaluarTendenciaPeso(serie(80, -1.0, 3), 'perder').kcal_pct, 0.05)
assert.equal(evaluarTendenciaPeso(serie(80, 0, 3), 'perder').estado, 'estancamiento')        // 3 semanas planas
assert.equal(evaluarTendenciaPeso(serie(80, 0, 3), 'perder').kcal_pct, -0.05)
assert.equal(evaluarTendenciaPeso(serie(80, 0, 1), 'perder').estado, 'sin_datos')            // poco tiempo: no se declara estancado

// Ganar
assert.equal(evaluarTendenciaPeso(serie(62, 0.2, 4), 'ganar').estado, 'en_rango')            // +0,32 %/sem
assert.equal(evaluarTendenciaPeso(serie(62, 0, 3), 'ganar').estado, 'ganancia_lenta')
assert.equal(evaluarTendenciaPeso(serie(62, 0, 3), 'ganar').kcal_pct, 0.05)
assert.equal(evaluarTendenciaPeso(serie(62, 0.6, 3), 'ganar').estado, 'ganancia_rapida')     // +0,97 %/sem
assert.equal(evaluarTendenciaPeso(serie(62, 0.6, 3), 'ganar').kcal_pct, -0.05)

// Mantener
assert.equal(evaluarTendenciaPeso(serie(70, 0.1, 4), 'mantener').estado, 'en_rango')
assert.equal(evaluarTendenciaPeso(serie(70, 0.6, 3), 'mantener').estado, 'deriva')
assert.equal(evaluarTendenciaPeso(serie(70, -0.6, 3), 'mantener').kcal_pct, 0.05)

// Sin meta: no se evalúa
assert.equal(evaluarTendenciaPeso(serie(70, -2, 4), null).estado, 'sin_datos')

// Un pesaje aislado con agua (+1,5 kg) no convierte «perder» en estancamiento si la tendencia es clara
const ruido = serie(80, -0.5, 5); ruido[5].peso += 1.5
assert.notEqual(evaluarTendenciaPeso(ruido, 'perder').estado, 'perdida_rapida')
// Adherencia baja: un peso que no se mueve NO se arregla tocando calorías (se avisa, sin propuesta)
const lento = evaluarTendenciaPeso(serie(62, 0, 3), 'ganar', 5)
assert.equal(lento.estado, 'ganancia_lenta'); assert.equal(lento.kcal_pct, 0)
assert.equal(evaluarTendenciaPeso(serie(80, 0, 3), 'perder', 4).kcal_pct, 0)
assert.equal(evaluarTendenciaPeso(serie(62, 0, 3), 'ganar', 8).kcal_pct, 0.05)          // buena adherencia: sí se propone
assert.equal(evaluarTendenciaPeso(serie(80, -1.0, 3), 'perder', 3).kcal_pct, 0.05)      // pérdida rápida: se corrige con cualquier adherencia
console.log('tendencia-peso.test.ts OK')
