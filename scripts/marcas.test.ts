import assert from 'node:assert/strict'
import { preguntasDelPlan, rmDesdeCincoReps, textoMarcasYFeedback, validarMarcas } from '../lib/entrenos/marcas'

assert.equal(rmDesdeCincoReps(100), 116.5)
assert.equal(rmDesdeCincoReps(80), 93.5)
let v = validarMarcas({ sentadilla_5rm: '80', banca_5rm: 60.2, dominadas_max: 8, inventado: 5, sled_push_kg: '' })
assert.ok(v.ok && v.marcas.sentadilla_5rm === 80 && v.marcas.banca_5rm === 60 && v.marcas.dominadas_max === 8 && v.marcas.sled_push_kg === null && !('inventado' in v.marcas))
assert.equal(validarMarcas({ sentadilla_5rm: 900 }).ok, false)
assert.equal(validarMarcas({ sentadilla_5rm: 'abc' }).ok, false)
assert.equal(validarMarcas([]).ok, false)
assert.equal(validarMarcas({ dominadas_max: 0 }).ok, true)

// Solo se pregunta por lo que había en el plan
assert.deepEqual(preguntasDelPlan(['Sentadilla con barra', 'Sled push', 'Remo'], true).map(p => p.clave), ['sentadilla', 'sled_push', 'carrera'])
assert.deepEqual(preguntasDelPlan(['Sentadilla goblet'], false).map(p => p.clave), [])

assert.equal(textoMarcasYFeedback({}, []), '')
const t = textoMarcasYFeedback({ sentadilla_5rm: 80 }, [{ clave: 'sled_push', valoracion: 'pesado' }])
assert.match(t, /Sentadilla \(5 reps\): 80 kg/); assert.match(t, /Sled push del bloque anterior: iba pesada/)
console.log('marcas OK')
