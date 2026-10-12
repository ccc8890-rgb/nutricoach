import assert from 'node:assert/strict'
import { descansoVisible } from '../lib/entrenos/descanso-visible'

assert.equal(descansoVisible('cardio', 90, 4), 90)        // series de carrera: se ve
assert.equal(descansoVisible('funcional', 60, 3), 60)     // Hyrox / circuitos: se ve
assert.equal(descansoVisible('cardio', 60, 1), 0)         // calentamiento de 1 × 5 min: no hay nada que descansar
assert.equal(descansoVisible('fuerza', 120, 4), 0)        // en fuerza estorba
assert.equal(descansoVisible('cardio', 90), 90)           // sin dato de series: no se oculta
assert.equal(descansoVisible('cardio', null, 4), 0)
console.log('descanso-visible OK')
