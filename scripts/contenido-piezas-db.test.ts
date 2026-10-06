import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { anadirRecetasATanda, buscarRecetaPorEnlace, sincronizarIconoReceta } from '../lib/contenido/piezas'

type Op = { tabla: string; op: 'update' | 'insert'; payload: unknown }

// Cliente falso: cada tabla devuelve filas fijas al leer y registra las escrituras.
function fakeDb(tablas: Record<string, unknown[]>) {
  const ops: Op[] = []
  let consultas = 0
  const from = (tabla: string) => {
    let esLectura = true
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'ilike', 'limit']) q[m] = () => q
    q.update = (payload: unknown) => { esLectura = false; ops.push({ tabla, op: 'update', payload }); return q }
    q.insert = (payload: unknown) => { esLectura = false; ops.push({ tabla, op: 'insert', payload }); return q }
    q.then = (resolver: (v: unknown) => void) => resolver({ data: esLectura ? tablas[tabla] ?? [] : null, error: null })
    consultas++
    return q
  }
  return { db: { from } as unknown as SupabaseClient, ops, consultas: () => consultas }
}

async function main() {
  // Enlace → receta del recetario por url_origen (ignora parámetros, www y barra final)
  const filas = [
    { id: 'r2', nombre: 'Otro', url_origen: 'https://instagram.com/reel/XYZ' },
    { id: 'r1', nombre: 'Bowl', url_origen: 'https://instagram.com/reel/ABC123/' },
  ]
  assert.deepEqual(await buscarRecetaPorEnlace(fakeDb({ recetas: filas }).db, 'https://www.instagram.com/reel/ABC123/?igsh=zz'), { id: 'r1', nombre: 'Bowl' })
  assert.equal(await buscarRecetaPorEnlace(fakeDb({ recetas: [filas[0]] }).db, 'https://www.instagram.com/reel/ABC123/'), null)
  // Un enlace que no es un enlace no consulta la base de datos
  const sinConsulta = fakeDb({ recetas: filas })
  assert.equal(await buscarRecetaPorEnlace(sinConsulta.db, 'una idea cualquiera'), null)
  assert.equal(sinConsulta.consultas(), 0)

  // El icono (caché en recetas.contenido_estado) refleja las piezas: lo pendiente manda
  const mixta = fakeDb({ piezas_contenido: [{ estado: 'grabada' }, { estado: 'para_grabar' }] })
  await sincronizarIconoReceta(mixta.db, 'coach1', 'r1')
  assert.deepEqual(mixta.ops, [{ tabla: 'recetas', op: 'update', payload: { contenido_estado: 'para_grabar' } }])
  const sinPiezas = fakeDb({ piezas_contenido: [] })
  await sincronizarIconoReceta(sinPiezas.db, 'coach1', 'r1')
  assert.deepEqual(sinPiezas.ops, [{ tabla: 'recetas', op: 'update', payload: { contenido_estado: null } }])
  const sinReceta = fakeDb({})
  await sincronizarIconoReceta(sinReceta.db, 'coach1', null)
  assert.equal(sinReceta.consultas(), 0)

  // Añadir a la tanda: promueve la pieza pendiente de la receta o crea una nueva; no duplica
  const tanda = fakeDb({
    recetas: [{ id: 'r1', nombre: 'Bowl' }, { id: 'r2', nombre: 'Wrap' }],
    piezas_contenido: [{ id: 'p1', receta_id: 'r1', estado: 'documentada' }],
  })
  assert.equal(await anadirRecetasATanda(tanda.db, 'coach1', '2026-10-17', ['r1', 'r2']), 2)
  const escrituras = tanda.ops.filter(o => o.tabla === 'piezas_contenido')
  assert.equal(escrituras.length, 2)
  const promovida = escrituras.find(o => o.op === 'update')!.payload as Record<string, unknown>
  assert.equal(promovida.estado, 'para_grabar')
  assert.equal(promovida.fecha_grabacion, '2026-10-17')
  const nueva = escrituras.find(o => o.op === 'insert')!.payload as Record<string, unknown>
  assert.deepEqual({ receta_id: nueva.receta_id, titulo: nueva.titulo, estado: nueva.estado, fecha_grabacion: nueva.fecha_grabacion, coach_id: nueva.coach_id },
    { receta_id: 'r2', titulo: 'Wrap', estado: 'para_grabar', fecha_grabacion: '2026-10-17', coach_id: 'coach1' })
  assert.equal(await anadirRecetasATanda(fakeDb({}).db, 'coach1', '2026-10-17', []), 0)

  console.log('contenido-piezas-db: OK')
}
main()
