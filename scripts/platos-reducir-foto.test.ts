import assert from 'node:assert/strict'
import { dimensionesReducidas } from '../lib/platos/reducir-foto'

// Lado largo máximo 1600 px conservando proporción (Final #6)
assert.deepEqual(dimensionesReducidas(4032, 3024, 1600), { ancho: 1600, alto: 1200 })
assert.deepEqual(dimensionesReducidas(3024, 4032, 1600), { ancho: 1200, alto: 1600 })
assert.deepEqual(dimensionesReducidas(800, 600, 1600), { ancho: 800, alto: 600 }, 'no amplía')
assert.deepEqual(dimensionesReducidas(0, 0, 1600), { ancho: 1, alto: 1 }, 'entrada degenerada no rompe')
console.log('platos-reducir-foto OK')
