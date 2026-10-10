import assert from 'node:assert/strict'
import { calcularDeriva, valorarDeriva } from '../lib/rendimiento/deriva'
import type { VueltaEntreno } from '../lib/rendimiento/garmin-entrenos'

const vuelta = (tipo: string, fc: number, v = 3, dur = 333): VueltaEntreno =>
  ({ tipo, paso: null, distancia_m: 1000, duracion_s: dur, fc_media: fc, velocidad_ms: v })

// Rodaje continuo de 6 km: el pulso sube de 140 a 150 al mismo ritmo → ~7 % de deriva.
const rodaje = [
  vuelta('WARMUP', 130), // se excluye
  ...[140, 140, 141, 148, 150, 151].map(fc => vuelta('ACTIVE', fc)),
  vuelta('COOLDOWN', 135), // se excluye
]
const d = calcularDeriva(rodaje)!
assert.ok(d, 'rodaje continuo debe calcularse')
assert.equal(d.minutos, 33)
assert.ok(d.derivaPct > 5 && d.derivaPct < 10, `deriva ${d.derivaPct}`)
assert.equal(d.valoracion, 'moderada')
assert.ok(d.fc2 > d.fc1)

// Pulso plano → estable.
const plano = calcularDeriva([...Array(6)].map(() => vuelta('ACTIVE', 145)))!
assert.equal(plano.derivaPct, 0)
assert.equal(plano.valoracion, 'estable')

// Series con recuperaciones: no es carrera continua.
const series = [vuelta('WARMUP', 130), ...[...Array(6)].flatMap((_, i) => [vuelta('ACTIVE', 170 + i, 4, 300), vuelta('RECOVERY', 130, 2, 300)])]
assert.equal(calcularDeriva(series), null)

// Demasiado corta (4 km, ~22 min) y datos incompletos.
assert.equal(calcularDeriva([...Array(4)].map(() => vuelta('ACTIVE', 150))), null)
assert.equal(calcularDeriva([...Array(6)].map(() => ({ ...vuelta('ACTIVE', 150), fc_media: null }))), null)
assert.equal(calcularDeriva(null), null)

// Ritmo muy irregular (fartlek sin etiquetas): se descarta.
assert.equal(calcularDeriva([...Array(6)].map((_, i) => vuelta('ACTIVE', 150, i % 2 ? 4.5 : 2.5))), null)

assert.equal(valorarDeriva(4.9), 'estable')
assert.equal(valorarDeriva(10), 'moderada')
assert.equal(valorarDeriva(10.1), 'alta')
console.log('deriva.test OK')
