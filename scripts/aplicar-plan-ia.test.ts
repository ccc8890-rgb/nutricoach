import assert from 'node:assert/strict'
import { aplicarPlanEntrenoIA, validarPayloadPlanEntrenoIA } from '../lib/entrenos/aplicar-plan-ia'
import { fakeSupabase } from './helpers/fake-supabase'
import type { AgenteTarea } from '../lib/agentes/types'

const base = { modo: 'crear', fase_bloque: 'Base', nombre_plan: 'Plan', duracion_semanas: 4, es_hibrido: true, macrociclo: null, validacion: null, generado_en: '2026-10-10T10:00:00Z' }
const sesion = { nombre: 'Rodaje', dia_semana: 'martes', ejercicios: [{ nombre: 'Rodaje continuo' }] }

const ok = validarPayloadPlanEntrenoIA({ ...base, plan: { sesiones: [sesion] } })
assert.equal(ok.ok, true)

// Payloads inválidos o manipulados: nada se crea
for (const [nombre, p] of Object.entries({
  'no es objeto': 'hola', 'null': null,
  'sin plan': { ...base },
  'plan no objeto': { ...base, plan: 'x' },
  'sin sesiones': { ...base, plan: { sesiones: [] } },
  'sesiones no es lista': { ...base, plan: { sesiones: 'x' } },
  'demasiadas sesiones': { ...base, plan: { sesiones: Array.from({ length: 15 }, () => sesion) } },
  'sesión sin nombre': { ...base, plan: { sesiones: [{ ejercicios: [] }] } },
  'modo raro': { ...base, modo: 'borrar_todo', plan: { sesiones: [sesion] } },
  'duración absurda': { ...base, duracion_semanas: 500, plan: { sesiones: [sesion] } },
})) {
  const r = validarPayloadPlanEntrenoIA(p)
  assert.equal(r.ok, false, nombre)
}
console.log('aplicar-plan-ia.test OK')
async function main() {
  const ejercicios = [{ id: 'e1', nombre: 'Rodaje continuo', tipo: 'cardio' }]
  const payload = { ...base, plan: { sesiones: [{ nombre: 'Carrera: Rodaje', dia_semana: 'martes', ejercicios: [{ nombre: 'Rodaje continuo' }, { nombre: 'Paseo del hipopótamo' }] }] } }
  const nuevaTarea = (): AgenteTarea => ({ id: 't1', tipo: 'plan_entreno_ia', cliente_id: 'cli1', agente: 'planificador', estado: 'aprobado', prioridad: 2, payload, propuesta: 'x', comentario_coach: null, razonamiento: null, fuentes: [], created_at: '', updated_at: '', revisado_at: null, aplicado_at: null })
  const tablas = () => ({
    clientes: [{ id: 'cli1', coach_id: 'coach1' }],
    agente_tareas: [{ id: 't1', estado: 'aprobado', aplicado_at: null, payload }],
    planes_entrenamiento: [{ id: 'viejo1', cliente_id: 'cli1', activo: true }],
    ejercicios, sesiones_entrenamiento: [], sesion_ejercicios: [], registros_ia: [],
  })

  // Aprobar crea el plan, marca la tarea como aplicada y declara los ejercicios omitidos (también en el payload, para que el coach los vea).
  const f = fakeSupabase(tablas())
  const r = await aplicarPlanEntrenoIA(f.db, nuevaTarea())
  assert.equal(r.ok, true)
  assert.match(r.mensaje ?? '', /omitidos: Paseo del hipopótamo/)
  const tarea = f.tablas.agente_tareas[0] as { estado: string; aplicado_at: string | null }
  assert.equal(tarea.estado, 'aplicado')
  assert.ok(tarea.aplicado_at, 'la tarea queda marcada como aplicada')
  const planes = f.tablas.planes_entrenamiento as { id: string; activo: boolean }[]
  assert.equal(planes.filter(p => p.activo).length, 1, 'un solo plan activo')
  assert.equal(planes.find(p => p.id === 'viejo1')!.activo, false)

  // Segunda aprobación de la misma propuesta (otra pestaña, reintento): NO crea otro plan.
  const antes = planes.length
  const r2 = await aplicarPlanEntrenoIA(f.db, nuevaTarea())
  assert.equal(r2.ok, true)
  assert.match(r2.mensaje ?? '', /ya estaba aplicada/)
  assert.equal((f.tablas.planes_entrenamiento as unknown[]).length, antes, 'no se crea un segundo plan')

  // Si crear el plan falla, la tarea NO queda marcada como aplicada (se puede reintentar) y el plan anterior sigue activo.
  const g = fakeSupabase(tablas(), { falla: (tabla, op) => tabla === 'sesiones_entrenamiento' && op === 'insert' })
  const r3 = await aplicarPlanEntrenoIA(g.db, nuevaTarea())
  assert.equal(r3.ok, false)
  assert.equal((g.tablas.agente_tareas[0] as { aplicado_at: unknown }).aplicado_at, null, 'se libera la reserva')
  assert.equal((g.tablas.planes_entrenamiento as { id: string; activo: boolean }[]).find(p => p.id === 'viejo1')!.activo, true)
  assert.equal((g.tablas.planes_entrenamiento as unknown[]).length, 1, 'sin restos del plan a medias')
  console.log('aplicar-plan-ia.test (aplicación) OK')
}
main()

