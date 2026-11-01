import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { enlazarSoloExistente } from '../lib/platos/enlazar'

const al = (id: string, nombre: string) => ({ id, nombre, calorias: 100, proteinas: 5, carbohidratos: 10, grasas: 3, fibra: 1 })
const cache = [al('1', 'Huevo'), al('2', 'Patata'), al('3', 'Aceite de oliva virgen extra'), al('4', 'Chips Ahoy')]

// La fase 1 puede consultar BD con nombres largos: respuesta vacía. Cualquier otra tabla (productos, creación) hace fallar el test.
const consultas: string[] = []
const supabaseVacio = {
  from(tabla: string) {
    consultas.push(tabla)
    if (tabla !== 'alimentos') throw new Error(`no debe tocar ${tabla}`)
    const q: Record<string, unknown> = {}
    q.select = () => q; q.ilike = () => q
    q.limit = () => Promise.resolve({ data: [], error: null })
    return q
  },
} as unknown as SupabaseClient

;(async () => {
  assert.deepEqual(await enlazarSoloExistente(supabaseVacio, 'Huevo', cache), { alimento_id: '1', alimento_nombre: 'Huevo' })
  assert.equal((await enlazarSoloExistente(supabaseVacio, 'huevos', cache))?.alimento_id, '1')
  assert.equal(await enlazarSoloExistente(supabaseVacio, 'patata cocida', cache), null, 'una variante que el catálogo no tiene queda para el coach')
  assert.equal(await enlazarSoloExistente(supabaseVacio, 'salsa secreta de la abuela', cache), null, 'sin match → null, nunca crea alimentos')
  assert.equal(await enlazarSoloExistente(supabaseVacio, 'chips de chocolate', cache), null, 'vínculo dudoso (Chips Ahoy) → null')
  assert.ok(consultas.every(t => t === 'alimentos'), 'solo consulta alimentos')
  console.log('platos-enlazar OK')
})()
