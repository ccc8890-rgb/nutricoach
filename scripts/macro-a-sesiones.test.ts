import assert from 'node:assert/strict'
import { planificarMacrociclo, type EntradaMacro } from '../lib/entrenos/macrociclo'
import { concretarSemana, minutosDeTrabajo } from '../lib/entrenos/macro-a-sesiones'
import { ritmosDesdeVdot, formatearRitmo } from '../lib/entrenos/ritmos'

const e: EntradaMacro = { hoy: '2026-10-10', nivel: 'avanzado', edad: 36, sexo: 'hombre', diasDisponibles: 5, diasCorrer: 3, vdot: 45, minutosSemanaActuales: 89, competicion: null, lesiones: [], restricciones: null, recuperacion: 'alta', condicionesSalud: null, semanasParon: 0, sesionesFuerzaFijas: 3 }
const r = planificarMacrociclo(e)
const ritmos = ritmosDesdeVdot(45)!

// Cada sesión concreta suma exactamente los minutos de la estructura y lleva el ritmo calculado, no inventado.
for (const semana of r.semanas) {
  const sesiones = concretarSemana(semana, ritmos)
  assert.equal(sesiones.length, semana.sesiones.length)
  assert.equal(sesiones.reduce((a, x) => a + x.minutos, 0), semana.minutos)
  for (const s of sesiones) {
    if (s.tipo === 'rodaje' || s.tipo === 'tirada') assert.ok(s.detalle.includes(formatearRitmo(ritmos.E * 0.96)), s.detalle)
    if (s.tipo === 'tempo') assert.ok(s.detalle.includes(formatearRitmo(ritmos.T * 0.98)), s.detalle)
    // Los tiempos del calentamiento + trabajo + vuelta suman la sesión.
    const nums = [...s.detalle.matchAll(/(\d+)'/g)].map(m => Number(m[1]))
    if (s.tipo === 'tempo') assert.equal(nums[0] + nums[1] + nums[2], s.minutos, s.detalle)
  }
}
// El trabajo intenso respeta el tope.
assert.equal(minutosDeTrabajo(70, 160), 19)
assert.equal(minutosDeTrabajo(70, 400), 40)
assert.equal(minutosDeTrabajo(30, 100), 15)
assert.ok(minutosDeTrabajo(20, 100) >= 8)
// Sin VDOT no se inventan ritmos.
const sin = concretarSemana(r.semanas[4], null)
assert.ok(sin.every(s => !/\d:\d\d\/km/.test(s.detalle)), 'sin VDOT no hay ritmos numéricos')
assert.ok(sin.some(s => s.detalle.includes('sin VDOT') || s.detalle.includes('a fijar')))
// El ritmo de una prueba que no es maratón no se deduce del VDOT.
const hm = planificarMacrociclo({ ...e, competicion: { fecha: '2027-01-17', disciplina: 'running_hm', tiempoObjetivoMin: 105, objetivo: null }, diasCorrer: 4, sesionesFuerzaFijas: 0 })
const esp = hm.semanas.find(s => s.sesiones.some(x => x.tipo === 'ritmo_carrera'))
if (esp) assert.ok(concretarSemana(esp, ritmos, 'running_hm').filter(s => s.tipo === 'ritmo_carrera').every(s => s.detalle.includes('a fijar con el coach')))
console.log('macro-a-sesiones.test OK')
