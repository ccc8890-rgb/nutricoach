import assert from 'node:assert/strict'
import { atletaDesdeEstado } from '../lib/informe-caso/datos'

const estado = (o: Record<string, unknown> = {}) => ({
  minutosCarreraPorSemana: 89, carrerasPorSemana: 3.5, vdot: 45, retorno: false, fuerza28d: 0, fuerzaEnPlan: 3,
  intensidad: { valoracion: 'mejorable', pctSuave: 36, pctMedia: 52, pctDura: 12, minutos: 340 },
  carga: { ctl: 16.04, atl: 17.3, tsb: -1.3 },
  ejecucion: { repsEvaluadas: 10, repsLentas: 2, sesionesEvaluadas: 4, sesionesSaltadas: 2 },
  ...o,
}) as never

const a = atletaDesdeEstado(estado(), [{ codigo: 'a', gravedad: 'alta', texto: 'Carga alta' }, { codigo: 'b', gravedad: 'aviso', texto: 'Aviso' }, { codigo: 'c', gravedad: 'info', texto: 'Info' }], true)
assert.equal(a.minutosCarreraSemana, 89)
assert.equal(a.salidasSemana, 3.5)
assert.equal(a.pctSuave, 36)
assert.equal(a.forma, 16)
assert.equal(a.fatiga, 17.3)
assert.equal(a.frescura, -1.3)
assert.equal(a.sesionesCalidadHechas, 4, 'evaluadas = las hechas')
assert.equal(a.sesionesCalidadPrevistas, 6, 'previstas = hechas + saltadas')
assert.equal(a.fuerzaRegistrada, 0)
assert.equal(a.fuerzaEnPlan, 3)
assert.deepEqual(a.alertasAltas, ['Carga alta'], 'solo las de gravedad alta')

// Sin datos: todo a null, nunca 0 inventado
const v = atletaDesdeEstado(estado({ minutosCarreraPorSemana: 0, carrerasPorSemana: 0, vdot: null, carga: null, intensidad: { valoracion: 'sin_datos', pctSuave: 0, pctMedia: 0, pctDura: 0, minutos: 0 }, ejecucion: { repsEvaluadas: 0, repsLentas: 0, sesionesEvaluadas: 0, sesionesSaltadas: 0 } }), [], false)
assert.equal(v.hayDatos, false)
assert.equal(v.minutosCarreraSemana, null)
assert.equal(v.salidasSemana, null)
assert.equal(v.pctSuave, null)
assert.equal(v.forma, null)
assert.equal(v.sesionesCalidadPrevistas, null)
assert.equal(v.sesionesCalidadHechas, null)
// Solo saltadas: ninguna hecha, no un número negativo
const s = atletaDesdeEstado(estado({ ejecucion: { repsEvaluadas: 0, repsLentas: 0, sesionesEvaluadas: 0, sesionesSaltadas: 2 } }), [], true)
assert.equal(s.sesionesCalidadPrevistas, 2)
assert.equal(s.sesionesCalidadHechas, 0)
assert.equal(v.vdot, null)
console.log('informe-caso-datos.test OK')
