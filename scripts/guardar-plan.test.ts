import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { guardarPlanEntreno, type DatosGuardadoPlan } from '../lib/entrenos/guardar-plan'

type Op = { tabla: string; op: string; payload?: unknown; filtros: Record<string, unknown> }

/** Cliente falso: registra cada escritura en orden; `ejercicios` responde al buscador por nombre; `falla` hace fallar un insert concreto. */
function fakeDb(opts: { ejercicios?: { id: string; nombre: string; tipo: string }[]; planesActivos?: { id: string }[]; falla?: string } = {}) {
  const ops: Op[] = []
  let n = 0
  const from = (tabla: string) => {
    const filtros: Record<string, unknown> = {}
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: unknown
    const q: Record<string, unknown> = {}
    const registrar = () => { if (op !== 'select') ops.push({ tabla, op, payload, filtros: { ...filtros } }) }
    for (const m of ['select', 'not', 'order', 'limit']) q[m] = () => q
    q.eq = (c: string, v: unknown) => { filtros[c] = v; return q }
    q.in = (c: string, v: unknown) => { filtros[c] = v; return q }
    q.ilike = (c: string, v: unknown) => { filtros[c] = v; return q }
    q.insert = (p: unknown) => { op = 'insert'; payload = p; return q }
    q.update = (p: unknown) => { op = 'update'; payload = p; return q }
    q.delete = () => { op = 'delete'; return q }
    const resultado = () => {
      registrar()
      if (op === 'insert' && opts.falla === tabla) return { data: null, error: { message: 'fallo simulado' } }
      if (op === 'insert') return { data: { id: `${tabla}-${++n}` }, error: null }
      if (op === 'select' && tabla === 'ejercicios') {
        const patron = String(filtros.nombre ?? '').replace(/%/g, '').toLowerCase()
        return { data: (opts.ejercicios ?? []).filter(e => e.nombre.toLowerCase().includes(patron)), error: null }
      }
      if (op === 'select' && tabla === 'planes_entrenamiento') return { data: opts.planesActivos ?? [], error: null }
      return { data: null, error: null }
    }
    q.single = () => Promise.resolve(resultado())
    q.maybeSingle = () => Promise.resolve(resultado())
    q.then = (res: (v: unknown) => void) => res(resultado())
    return q
  }
  return { db: { from } as unknown as SupabaseClient, ops }
}

const datos = (sesiones: DatosGuardadoPlan['sesiones']): DatosGuardadoPlan => ({
  coachId: 'coach1', clienteId: 'cli1', nombre: 'Plan IA', descripcion: 'Porque sí', duracionSemanas: 4, faseBloque: null, sesiones,
})
const ejercicios = [{ id: 'e1', nombre: 'Rodaje continuo', tipo: 'cardio' }, { id: 'e2', nombre: 'Sentadilla goblet', tipo: 'fuerza' }]

async function main() {
  // Camino feliz: plan inactivo → sesiones → ejercicios → solo al final se desactivan los anteriores y se activa el nuevo.
  const ok = fakeDb({ ejercicios, planesActivos: [{ id: 'viejo1' }] })
  const r = await guardarPlanEntreno(ok.db, datos([
    { nombre: 'Rodaje fácil', dia_semana: 'martes', ejercicios: [{ nombre: 'Rodaje continuo', series: 1 }] },
    { nombre: 'Fuerza A', dia_semana: 'jueves', ejercicios: [{ nombre: 'Sentadilla goblet', series: 3, repeticiones: 10, peso_estimado_kg: 16, rpe_objetivo: 7 }] },
  ]))
  assert.equal(r.sesiones, 2)
  assert.equal(r.ejerciciosVinculados, 2)
  assert.deepEqual(r.ejerciciosOmitidos, [])
  const planInsert = ok.ops.find(o => o.tabla === 'planes_entrenamiento' && o.op === 'insert')!
  assert.equal((planInsert.payload as { activo: boolean }).activo, false, 'el plan nuevo nace inactivo')
  const idxUltimaEscrituraSesion = Math.max(...ok.ops.map((o, i) => (o.tabla === 'sesion_ejercicios' || o.tabla === 'sesiones_entrenamiento') && o.op === 'insert' ? i : -1))
  const idxDesactivar = ok.ops.findIndex(o => o.tabla === 'planes_entrenamiento' && o.op === 'update' && (o.payload as { activo: boolean }).activo === false)
  const idxActivar = ok.ops.findIndex(o => o.tabla === 'planes_entrenamiento' && o.op === 'update' && (o.payload as { activo: boolean }).activo === true)
  assert.ok(idxDesactivar > idxUltimaEscrituraSesion && idxActivar > idxDesactivar, 'se activa al final')
  const ejInsert = ok.ops.find(o => o.tabla === 'sesion_ejercicios' && (o.payload as { ejercicio_id: string }).ejercicio_id === 'e2')!
  assert.equal((ejInsert.payload as { peso_sugerido: string }).peso_sugerido, '16kg')
  assert.equal((ejInsert.payload as { notas: string }).notas, 'RPE 7')

  // Ejercicio que no existe en la base de datos: se omite y se declara.
  const sinMatch = fakeDb({ ejercicios })
  const r2 = await guardarPlanEntreno(sinMatch.db, datos([{ nombre: 'Rodaje fácil', ejercicios: [{ nombre: 'Rodaje continuo' }, { nombre: 'Paseo del granjero con hipopótamo' }] }]))
  assert.equal(r2.ejerciciosVinculados, 1)
  assert.deepEqual(r2.ejerciciosOmitidos, ['Paseo del granjero con hipopótamo'])

  // Fallo a mitad (al insertar una sesión): se borra lo creado, el plan anterior NO se desactiva y se lanza el error.
  const fallo = fakeDb({ ejercicios, planesActivos: [{ id: 'viejo1' }], falla: 'sesion_ejercicios' })
  await assert.rejects(() => guardarPlanEntreno(fallo.db, datos([{ nombre: 'Rodaje', ejercicios: [{ nombre: 'Rodaje continuo' }] }])), /No se pudo guardar el plan/)
  assert.ok(!fallo.ops.some(o => o.tabla === 'planes_entrenamiento' && o.op === 'update'), 'el plan anterior sigue activo')
  assert.ok(fallo.ops.some(o => o.tabla === 'planes_entrenamiento' && o.op === 'delete'), 'se limpia el plan a medias')

  // Plan sin sesiones: no se crea nada.
  const vacio = fakeDb({ ejercicios })
  await assert.rejects(() => guardarPlanEntreno(vacio.db, datos([])), /sin sesiones/)
  assert.equal(vacio.ops.length, 0)

  // Protocolo híbrido: fase_bloque y ritmo en cada sesión.
  const hib = fakeDb({ ejercicios })
  await guardarPlanEntreno(hib.db, { ...datos([{ nombre: 'Carrera: Tempo', ritmo_objetivo: '4:38/km', ejercicios: [] }]), faseBloque: 'Base' })
  const ses = hib.ops.find(o => o.tabla === 'sesiones_entrenamiento')!.payload as { fase_bloque: string; contexto_ia: string }
  assert.equal(ses.fase_bloque, 'Base')
  assert.equal(ses.contexto_ia, '4:38/km')

  console.log('guardar-plan.test OK')
}
main()
