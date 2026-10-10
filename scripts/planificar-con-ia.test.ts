import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { validarPayloadPlanEntrenoIA } from '../lib/entrenos/aplicar-plan-ia'
import { construirPayloadPropuesta, construirResumenPropuesta, estadoHttpDe, leerModoPlanificacion, planificarConIA } from '../lib/entrenos/planificar-con-ia'
import type { ResultadoGeneracionPlan } from '../lib/entrenos/generar-plan-ia'
import { fakeSupabase } from './helpers/fake-supabase'

const generado = (over: Partial<ResultadoGeneracionPlan> = {}): ResultadoGeneracionPlan => ({
  planIA: { nombre_plan: 'Plan X', fundamentacion: 'porque', sesiones: [
    { nombre: 'Híbrida A', ejercicios: [] }, { nombre: 'Carrera: Rodaje', ejercicios: [] }, { nombre: 'Carrera: Tirada', ejercicios: [] },
  ] },
  nombrePlan: 'Híbrido Hyrox + Running — Base', duracionSemanas: 4, esHibrido: true, faseBloque: 'Base', modalidad: 'hibrido',
  validacion: { hallazgos: [{ nivel: 'aviso', codigo: 'x', texto: 'y' }, { nivel: 'aviso', codigo: 'z', texto: 'w' }], resumen: { carrerasSemana: 3, minutosCarrera: 100, sesionesCalidad: 0, tiradaLargaMin: 40, tiradaLargaPct: 40 } },
  macrociclo: { semanasHastaCarrera: null, semanas: [{ n: 1, lunes: '2026-10-12', fase: 'base', descarga: false, minutos: 100, salidas: 3, tiradaMin: 40, pctSuave: 95, fuerza: 3, sesiones: [], notas: [] }], ritmos: null, parametros: { nivel: 'avanzado', salidasSemana: 3, volumenBase: 89, volumenPico: 158, crecimientoSemanal: 0.1, descargaCada: 4 }, avisos: [], datosFaltantes: [], supuestos: [], fundamentos: [] },
  metadata: { rpe_promedio: null, ajuste_rpe: '', modalidad: 'hibrido', recomendacion_motor: null, papers_usados: 0, generado_con: 'deepseek-chat' },
  ...over,
})

// Resumen y payload
assert.equal(construirResumenPropuesta(generado(), 'siguiente_bloque'), 'Bloque Base · 3 sesiones (100 min de carrera/semana) · 2 avisos del validador')
assert.equal(construirResumenPropuesta(generado({ validacion: null, faseBloque: null, esHibrido: false, macrociclo: null }), 'crear'), 'Plan nuevo · 3 sesiones')
const p = construirPayloadPropuesta(generado(), 'crear')
assert.equal(p.modo, 'crear'); assert.equal(p.fase_bloque, 'Base'); assert.equal(p.duracion_semanas, 4); assert.equal(p.es_hibrido, true)
assert.ok(Array.isArray((p.plan as { sesiones: unknown[] }).sesiones)); assert.ok(p.generado_en.length > 10)

// Códigos HTTP
assert.equal(estadoHttpDe({ ok: false, modo: 'crear', codigo: 'YA_HAY_PROPUESTA', motivo: '' }), 409)
assert.equal(estadoHttpDe({ ok: false, modo: 'ajustar', codigo: 'SIN_DATOS', motivo: '' }), 422)
assert.equal(estadoHttpDe({ ok: false, modo: 'crear', codigo: 'IA_ERROR', motivo: '' }), 502)
assert.equal(estadoHttpDe({ ok: false, modo: null, codigo: 'CLIENTE_NO_ENCONTRADO', motivo: '' }), 404)

// Cliente falso: tablas → filas; registra inserts
function fakeDb(tablas: Record<string, unknown[]>) {
  const inserts: { tabla: string; payload: unknown }[] = []
  const from = (tabla: string) => {
    let esInsert = false
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit']) q[m] = () => q
    q.insert = (payload: unknown) => { esInsert = true; inserts.push({ tabla, payload }); return q }
    const filas = () => (esInsert ? [{ id: 'tarea-nueva' }] : tablas[tabla] ?? [])
    q.single = () => Promise.resolve({ data: filas()[0] ?? null, error: null })
    q.maybeSingle = () => Promise.resolve({ data: filas()[0] ?? null, error: null })
    q.then = (res: (v: unknown) => void) => res({ data: filas(), error: null })
    return q
  }
  return { db: { from } as unknown as SupabaseClient, inserts }
}

async function main() {
  // Modo: sin plan → crear; con propuesta pendiente se refleja
  const sinPlan = await leerModoPlanificacion(fakeDb({ planes_entrenamiento: [], agente_tareas: [] }).db, 'c1')
  assert.equal(sinPlan.modo, 'crear'); assert.equal(sinPlan.hayPropuestaPendiente, false)
  const conPend = await leerModoPlanificacion(fakeDb({ planes_entrenamiento: [], agente_tareas: [{ id: 't1' }] }).db, 'c1')
  assert.equal(conPend.hayPropuestaPendiente, true)

  // Dos pulsaciones: si ya hay una propuesta pendiente NO se genera otra (ni se llama a la IA)
  const dup = fakeDb({ planes_entrenamiento: [], agente_tareas: [{ id: 't1' }] })
  const r = await planificarConIA(dup.db, { clienteId: 'c1' })
  assert.equal(r.ok, false)
  if (!r.ok) { assert.equal(r.codigo, 'YA_HAY_PROPUESTA'); assert.equal(estadoHttpDe(r), 409) }
  assert.equal(dup.inserts.length, 0)

  // Lo que devuelve la IA no puede dejar una propuesta imposible de aprobar: sesiones sin nombre y duración en texto se normalizan.
  const rara = generado({ duracionSemanas: '8-12 semanas' as unknown as number, planIA: { sesiones: [{ nombre: 'Rodaje' }, { ejercicios: [] }, { nombre: '   ' }] } })
  const pr = construirPayloadPropuesta(rara, 'crear')
  assert.equal(pr.duracion_semanas, 8)
  assert.deepEqual((pr.plan as { sesiones: { nombre: string }[] }).sesiones.map(x => x.nombre), ['Rodaje', 'Sesión 2', 'Sesión 3'])
  assert.equal(validarPayloadPlanEntrenoIA(pr).ok, true, 'el payload normalizado se puede aprobar')

  // A mitad de bloque con un análisis de rendimiento ya pendiente: no se lanza otro (cuesta una llamada a la IA) y se dice dónde está.
  const hace10 = new Date(Date.now() - 10 * 86_400_000).toISOString()
  const ajustando = fakeSupabase({
    planes_entrenamiento: [{ id: 'p1', cliente_id: 'c1', activo: true, created_at: hace10, duracion_semanas: 4 }],
    agente_tareas: [{ id: 'a1', cliente_id: 'c1', tipo: 'analisis_rendimiento', estado: 'pendiente', created_at: new Date().toISOString() }],
  })
  const ra = await planificarConIA(ajustando.db, { clienteId: 'c1' })
  assert.equal(ra.ok, false)
  if (!ra.ok) { assert.equal(ra.codigo, 'YA_HAY_PROPUESTA'); assert.equal(ra.modo, 'ajustar'); assert.match(ra.motivo, /Rendimiento/) }
  assert.equal(ajustando.ops.length, 0, 'no se escribe nada')
  console.log('planificar-con-ia.test OK')
}
main()
