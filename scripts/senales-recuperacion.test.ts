import assert from 'node:assert/strict'
import { senalesRecuperacion, textoSenales, type FilaSenales } from '../lib/entrenos/senales-recuperacion'
const dia = (i: number, o: Partial<FilaSenales> = {}): FilaSenales => ({ fecha: `2026-10-${String(i + 1).padStart(2, '0')}`, rhr: 50 + (i % 4), hrv: 51.1, sueno_h: null, training_readiness: 60 + i, body_battery_max: 80, ...o })
// Caso real de Carlos: HRV = media semanal repetida, sueño casi nunca
const filas = Array.from({ length: 14 }, (_, i) => dia(i, i < 2 ? { sueno_h: 7 } : {}))
const s = senalesRecuperacion(filas)
assert.equal(s.hrvDiaria, false)
assert.equal(s.nochesSueno, 2)
assert.ok(s.rhr && s.preparacion && s.bateria)
const t = textoSenales(s)
assert.ok(t.includes('pulso en reposo') && t.includes('HRV diaria') && t.includes('solo 2 de 14'))
// HRV que sí varía y sueño completo → ambas fiables
const buenas = senalesRecuperacion(Array.from({ length: 14 }, (_, i) => dia(i, { hrv: 40 + i, sueno_h: 7 })))
assert.equal(buenas.hrvDiaria, true)
assert.ok(!textoSenales(buenas).includes('NO DISPONIBLES → HRV'))
assert.ok(textoSenales(senalesRecuperacion([])).includes('sin datos'))
console.log('senales-recuperacion.test.ts OK')
