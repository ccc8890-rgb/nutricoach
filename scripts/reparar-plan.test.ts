import assert from 'node:assert/strict'
import { problemasDelPlan, promptDeReparacion } from '../lib/entrenos/reparar-plan'
import type { EvidenciaPlan } from '../lib/entrenos/evidencia-plan'

const evOk: EvidenciaPlan = { ofrecidos: 16, decisiones: Array.from({ length: 7 }, () => ({ decision: 'd', motivo: 'm', tipo: 'estudio' as const, estudios: [], clavesInventadas: [] })), estudiosCitados: [], clavesInventadas: 0, autoresNoVerificables: [] }

assert.deepEqual(problemasDelPlan({ hallazgos: [], sesiones: 6, sesionesEsperadas: 6, evidencia: evOk }), [])
// Hallazgos del validador pasan tal cual; sesiones distintas de las esperadas y citas inventadas se reportan
const p = problemasDelPlan({
  hallazgos: [{ nivel: 'aviso', codigo: 'plan_por_debajo_realidad', texto: 'El plan suma 97 min y sostiene ~133.' }],
  sesiones: 5, sesionesEsperadas: 6,
  evidencia: { ...evOk, clavesInventadas: 2, autoresNoVerificables: ['Smith 2019'], decisiones: [] },
})
assert.equal(p.length, 5)
assert.ok(p[0].includes('97 min'))
assert.ok(p.some(x => x.includes('exactamente 6')))
assert.ok(p.some(x => x.includes('Smith 2019')))
// Sin número fijo de sesiones no se exige
assert.equal(problemasDelPlan({ hallazgos: [], sesiones: 4, sesionesEsperadas: null, evidencia: null }).length, 0)
const prompt = promptDeReparacion('{"a":1}', ['uno', 'dos'])
assert.ok(prompt.includes('{"a":1}') && prompt.includes('1. uno') && prompt.includes('2. dos'))
// Días de la semana en las decisiones: solo se señalan si el sistema es el que decide los días
const conDia: EvidenciaPlan = { ...evOk, decisiones: [{ decision: 'Pierna el miércoles', motivo: 'x', tipo: 'estudio', estudios: [], clavesInventadas: [] }, ...evOk.decisiones] }
assert.ok(problemasDelPlan({ hallazgos: [], sesiones: 6, sesionesEsperadas: 6, evidencia: conDia, sinDiasEnTexto: true }).some(x => x.includes('no nombres días')))
assert.equal(problemasDelPlan({ hallazgos: [], sesiones: 6, sesionesEsperadas: 6, evidencia: conDia }).length, 0)
console.log('reparar-plan.test.ts OK')
