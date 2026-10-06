import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { compraDeTanda } from '../lib/contenido/compra-tanda'

// Cliente falso: cada tabla devuelve filas fijas y registra qué tablas se consultan.
function fakeDb(tablas: Record<string, unknown[]>) {
  const llamadas: string[] = []
  const consulta = (tabla: string) => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'in', 'gt']) q[m] = () => q
    q.then = (resolver: (v: unknown) => void) => resolver({ data: tablas[tabla] ?? [], error: null })
    return q
  }
  const db = { from: (t: string) => { llamadas.push(t); return consulta(t) } }
  return { db: db as unknown as SupabaseClient, llamadas }
}

const ing = (id: string, nombre: string, categoria: string, gramos: number) =>
  ({ cantidad_gramos: gramos, alimento: { id, nombre, categoria, es_generico: true } })

async function main() {
  // Tanda vacía: no consulta nada y no da error
  const vacia = fakeDb({})
  assert.deepEqual(await compraDeTanda(vacia.db, []), { lineas: [], costeEstimado: 0 })
  assert.deepEqual(vacia.llamadas, [])

  // Receta sin ingredientes vinculados: compra vacía sin error
  const sinIngredientes = fakeDb({ recetas: [{ id: 'r1', nombre: 'Bowl', receta_ingredientes: [] }] })
  assert.deepEqual(await compraDeTanda(sinIngredientes.db, ['r1']), { lineas: [], costeEstimado: 0 })

  // Dos recetas: se suman cantidades completas, agua y sal fuera, coste con el precio más barato
  const { db } = fakeDb({
    recetas: [
      { id: 'r1', nombre: 'Bowl', receta_ingredientes: [ing('a1', 'Pechuga de pollo', 'Carnes', 200), ing('agua', 'Agua', 'Otros', 500), ing('t1', 'Tomate', 'Verduras', 250)] },
      { id: 'r2', nombre: 'Wrap', receta_ingredientes: [ing('a1', 'Pechuga de pollo', 'Carnes', 300), ing('sal', 'Sal', 'Otros', 5)] },
    ],
    precios_actuales: [{ alimento_id: 'a1', precio_por_kg: 8 }, { alimento_id: 'a1', precio_por_kg: 6 }],
  })
  const compra = await compraDeTanda(db, ['r1', 'r2'])
  assert.equal(compra.lineas.length, 2)
  const pollo = compra.lineas.find(l => l.alimento_id === 'a1')!
  assert.equal(pollo.gramos, 500)
  assert.deepEqual([...pollo.recetas].sort(), ['Bowl', 'Wrap'])
  assert.equal(pollo.coste_estimado, 3) // 0,5 kg × 6 €/kg
  const tomate = compra.lineas.find(l => l.alimento_id === 't1')!
  assert.equal(tomate.gramos, 250)
  assert.equal(tomate.coste_estimado, null) // sin precio conocido
  assert.equal(compra.costeEstimado, 3)
  // ordenadas por categoría y nombre
  assert.deepEqual(compra.lineas.map(l => l.categoria), ['Carnes', 'Verduras'])

  console.log('contenido-compra-tanda: OK')
}
main()
