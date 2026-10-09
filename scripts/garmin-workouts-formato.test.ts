// scripts/garmin-workouts-formato.test.ts
import assert from 'node:assert/strict'
import { pasosAGarmin } from '../lib/integraciones/garmin-workouts-formato'
import { ritmosDesdeVdot } from '../lib/entrenos/ritmos'
import type { Paso } from '../lib/entrenos/pasos'

const pasos: Paso[] = [
  { tipo: 'calentamiento', duracion: { unidad: 'segundos', valor: 900 }, objetivo: { tipo: 'zona', zona: 'E' } },
  { tipo: 'repetir', veces: 5, pasos: [
    { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 1000 }, objetivo: { tipo: 'zona', zona: 'I' } },
    { tipo: 'recuperacion', duracion: { unidad: 'metros', valor: 400 } },
  ] },
  { tipo: 'enfriamiento', duracion: { unidad: 'lap' } },
]
const ritmos = ritmosDesdeVdot(45)!
const w = pasosAGarmin('Series 5x1000', pasos, ritmos)

assert.equal(w.workoutName, 'Series 5x1000')
assert.equal(w.sportType.sportTypeKey, 'running')
const steps = w.workoutSegments[0].workoutSteps
assert.equal(steps.length, 3)

// Calentamiento por tiempo con objetivo de ritmo en rango (m/s, uno < dos)
assert.equal(steps[0].stepType.stepTypeKey, 'warmup')
assert.equal(steps[0].endCondition.conditionTypeKey, 'time')
assert.equal(steps[0].endConditionValue, 900)
assert.equal(steps[0].targetType.workoutTargetTypeKey, 'pace.zone')
assert.ok(steps[0].targetValueOne! < steps[0].targetValueTwo!)

// Bloque de repetición
const rep = steps[1] as any
assert.equal(rep.type, 'RepeatGroupDTO')
assert.equal(rep.numberOfIterations, 5)
assert.equal(rep.endCondition.conditionTypeKey, 'iterations')
assert.equal(rep.endConditionValue, 5)
assert.equal(rep.workoutSteps.length, 2)
assert.equal(rep.workoutSteps[0].stepType.stepTypeKey, 'interval')
assert.equal(rep.workoutSteps[0].endCondition.conditionTypeKey, 'distance')
assert.equal(rep.workoutSteps[0].endConditionValue, 1000)
// Ritmo I con VDOT 45 ≈ 4:15/km ≈ 3,9 m/s
assert.ok(rep.workoutSteps[0].targetValueTwo > 3.7 && rep.workoutSteps[0].targetValueTwo < 4.4)
// Recuperación sin objetivo → sin target
assert.equal(rep.workoutSteps[1].stepType.stepTypeKey, 'recovery')
assert.equal(rep.workoutSteps[1].targetType.workoutTargetTypeKey, 'no.target')

// Vuelta a la calma con lap
assert.equal(steps[2].stepType.stepTypeKey, 'cooldown')
assert.equal(steps[2].endCondition.conditionTypeKey, 'lap.button')

// stepOrder consecutivo y único (incluye los pasos dentro del bloque)
const orden: number[] = []
const rec = (s: any[]) => s.forEach(x => { orden.push(x.stepOrder); if (x.workoutSteps) rec(x.workoutSteps) })
rec(steps)
assert.deepEqual(orden, [1, 2, 3, 4, 5])

// Sin VDOT: la zona no genera objetivo de ritmo (nunca se inventa)
const sin = pasosAGarmin('x', pasos, null).workoutSegments[0].workoutSteps
assert.equal(sin[0].targetType.workoutTargetTypeKey, 'no.target')
assert.equal(sin[0].targetValueOne, undefined)

// Ritmo manual y FC
const manual = pasosAGarmin('m', [
  { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 2000 }, objetivo: { tipo: 'ritmo', min_seg_km: 290, max_seg_km: 300 } },
  { tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 600 }, objetivo: { tipo: 'fc', min: 150, max: 160 } },
], null).workoutSegments[0].workoutSteps
assert.equal(manual[0].targetType.workoutTargetTypeKey, 'pace.zone')
assert.ok(Math.abs(manual[0].targetValueOne! - 1000 / 300) < 0.01) // más lento = menor velocidad
assert.ok(Math.abs(manual[0].targetValueTwo! - 1000 / 290) < 0.01)
assert.equal(manual[1].targetType.workoutTargetTypeKey, 'heart.rate.zone')
assert.equal(manual[1].targetValueOne, 150)
assert.equal(manual[1].targetValueTwo, 160)

console.log('garmin-workouts-formato.test.ts OK')
