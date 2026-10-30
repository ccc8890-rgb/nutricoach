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
// calentamiento + bloque (5-1 repeticiones) + última serie aparte + vuelta a la calma
assert.equal(steps.length, 4)

// Calentamiento por tiempo con objetivo de ritmo en rango (m/s, uno < dos)
assert.equal(steps[0].stepType.stepTypeKey, 'warmup')
assert.equal(steps[0].endCondition.conditionTypeKey, 'time')
assert.equal(steps[0].endConditionValue, 900)
assert.equal(steps[0].targetType.workoutTargetTypeKey, 'pace.zone')
assert.ok(steps[0].targetValueOne! < steps[0].targetValueTwo!)

// Bloque de repetición
const rep = steps[1] as any
assert.equal(rep.type, 'RepeatGroupDTO')
assert.equal(rep.numberOfIterations, 4)
assert.equal(rep.endCondition.conditionTypeKey, 'iterations')
assert.equal(rep.endConditionValue, 4)
assert.equal(rep.workoutSteps.length, 2)
assert.equal(rep.workoutSteps[0].stepType.stepTypeKey, 'interval')
assert.equal(rep.workoutSteps[0].endCondition.conditionTypeKey, 'distance')
assert.equal(rep.workoutSteps[0].endConditionValue, 1000)
// Ritmo I con VDOT 45 ≈ 4:15/km ≈ 3,9 m/s
assert.ok(rep.workoutSteps[0].targetValueTwo > 3.7 && rep.workoutSteps[0].targetValueTwo < 4.4)
// Recuperación sin objetivo → sin target
assert.equal(rep.workoutSteps[1].stepType.stepTypeKey, 'recovery')
assert.equal(rep.workoutSteps[1].targetType.workoutTargetTypeKey, 'no.target')

// Última serie aparte, marcada y sin recuperación detrás
assert.equal(steps[2].stepType.stepTypeKey, 'interval')
assert.ok(String(steps[2].description).startsWith('Última serie'))
assert.equal(steps[2].endConditionValue, 1000)

// Vuelta a la calma con lap
assert.equal(steps[3].stepType.stepTypeKey, 'cooldown')
assert.equal(steps[3].endCondition.conditionTypeKey, 'lap.button')

// stepOrder consecutivo y único (incluye los pasos dentro del bloque)
const orden: number[] = []
const rec = (s: any[]) => s.forEach(x => { orden.push(x.stepOrder); if (x.workoutSteps) rec(x.workoutSteps) })
rec(steps)
assert.deepEqual(orden, [1, 2, 3, 4, 5, 6])

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

// Con pulso conocido, la zona suave (E) va por techo de pulso y el resto sigue por ritmo
import { zonasFcDesde } from '../lib/entrenos/zonas-fc'
const fc = zonasFcDesde({ fcUmbral: 177, fcMax: 195 })!
assert.equal(fc.E!.max, Math.round(Math.min(177 * 0.9, 195 * 0.79))) // 154 (Daniels, más estricto que 159)
assert.ok(fc.E!.min < fc.E!.max && fc.T!.min < fc.T!.max)
assert.equal(fc.R, undefined)
const conFc = pasosAGarmin('x', pasos, ritmos, undefined, fc).workoutSegments[0].workoutSteps as any[]
// En una sesión de series el calentamiento no lleva techo de pulso (aún no ha subido)
assert.equal(conFc[0].targetType.workoutTargetTypeKey, 'no.target')
// Un rodaje suave (sin series) sí va por techo de pulso
const rodaje = pasosAGarmin('r', [{ tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 3000 }, objetivo: { tipo: 'zona', zona: 'E' } }], ritmos, undefined, fc).workoutSegments[0].workoutSteps as any[]
assert.equal(rodaje[0].targetType.workoutTargetTypeKey, 'heart.rate.zone')
assert.equal(rodaje[0].targetValueTwo, fc.E!.max)
assert.equal(conFc[1].workoutSteps[0].targetType.workoutTargetTypeKey, 'pace.zone') // I sigue por ritmo
assert.equal(zonasFcDesde({ fcUmbral: null, fcMax: null }), null)
console.log('garmin-workouts-formato fc OK')

// Cinta: tramos por distancia pasan a tiempo, sin alerta de ritmo, con velocidad de la cinta
const cinta = pasosAGarmin('Series 5x1000', pasos, ritmos, undefined, null, 'cinta').workoutSegments[0].workoutSteps
const repC = cinta[1] as any
const trabajoC = repC.workoutSteps[0]
assert.equal(trabajoC.endCondition.conditionTypeKey, 'time')
assert.equal(trabajoC.endConditionValue, Math.round(ritmos.I / 5) * 5) // 1000 m al ritmo I, a múltiplo de 5 s
assert.equal(trabajoC.targetType.workoutTargetTypeKey, 'no.target')
assert.match(trabajoC.description, /Cinta a \d+,\d km\/h/)
// Recuperación en metros sin ritmo propio: trote a ritmo E
assert.equal(repC.workoutSteps[1].endCondition.conditionTypeKey, 'time')
assert.equal(repC.workoutSteps[1].endConditionValue, Math.round((ritmos.E * 0.4) / 5) * 5)
// El calentamiento por tiempo sigue por tiempo, sin alerta de ritmo
assert.equal(cinta[0].endCondition.conditionTypeKey, 'time')
assert.equal(cinta[0].targetType.workoutTargetTypeKey, 'no.target')
// Sin VDOT no se inventa: se queda en metros
const cintaSin = pasosAGarmin('x', pasos, null, undefined, null, 'cinta').workoutSegments[0].workoutSteps[1] as any
assert.equal(cintaSin.workoutSteps[0].endCondition.conditionTypeKey, 'distance')
// Pista (por defecto) no cambia
assert.equal(pasosAGarmin('x', pasos, ritmos, undefined, null, 'pista').workoutSegments[0].workoutSteps.length, 4)
console.log('garmin-workouts-formato (cinta) OK')

// Recuperación entre series: sin techo de pulso ni ritmo (el pulso tarda en bajar)
const pasosRec: Paso[] = [{ tipo: 'repetir', veces: 3, pasos: [
  { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 500 }, objetivo: { tipo: 'zona', zona: 'I' } },
  { tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 120 }, objetivo: { tipo: 'zona', zona: 'E' } },
] }]
const wRec = pasosAGarmin('x', pasosRec, ritmos, undefined, { E: { min: 114, max: 153 } } as any).workoutSegments[0].workoutSteps[0] as any
assert.equal(wRec.workoutSteps[1].stepType.stepTypeKey, 'recovery')
assert.equal(wRec.workoutSteps[1].targetType.workoutTargetTypeKey, 'no.target')
// En series, calentamiento y vuelta a la calma tampoco llevan techo de pulso
const wS = pasosAGarmin('x', [{ tipo: 'calentamiento', duracion: { unidad: 'segundos', valor: 600 }, objetivo: { tipo: 'zona', zona: 'E' } }, ...pasosRec, { tipo: 'enfriamiento', duracion: { unidad: 'segundos', valor: 300 }, objetivo: { tipo: 'zona', zona: 'E' } }], ritmos, undefined, { E: { min: 114, max: 153 } } as any).workoutSegments[0].workoutSteps
assert.equal(wS[0].targetType.workoutTargetTypeKey, 'no.target')
assert.equal(wS[3].targetType.workoutTargetTypeKey, 'no.target')
// La última repetición va aparte y marcada, sin recuperación detrás: calentamiento + bloque (veces-1) + última serie + vuelta a la calma
assert.equal(wS.length, 4)
assert.equal(wS[1].numberOfIterations, 2)
assert.equal(wS[2].stepType.stepTypeKey, 'interval')
assert.ok(String(wS[2].description).startsWith('Última serie'))
assert.equal(wS[3].stepType.stepTypeKey, 'cooldown')
// Con una sola repetición no hay «última» aparte
const w1 = pasosAGarmin('x', [{ tipo: 'repetir', veces: 1, pasos: pasosRec[0].tipo === 'repetir' ? pasosRec[0].pasos : [] }], ritmos).workoutSegments[0].workoutSteps
assert.equal(w1.length, 1)
assert.equal((w1[0] as any).numberOfIterations, 1)
// Un rodaje sin series conserva el techo de pulso
assert.equal(pasosAGarmin('x', [{ tipo: 'calentamiento', duracion: { unidad: 'segundos', valor: 600 }, objetivo: { tipo: 'zona', zona: 'E' } }], ritmos, undefined, { E: { min: 114, max: 153 } } as any).workoutSegments[0].workoutSteps[0].targetType.workoutTargetTypeKey, 'heart.rate.zone')
console.log('garmin-workouts-formato (recuperación) OK')
