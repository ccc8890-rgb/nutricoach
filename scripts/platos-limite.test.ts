import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { reservarAnalisis } from '../lib/platos/guardar'
import { MAX_ANALISIS_POR_DIA } from '../lib/platos/estado'

// BD en memoria solo para platos_analisis_log
function fakeDb() {
  const filas: { id: number; cliente_id: string; created_at: string }[] = []
  let n = 0
  const db = {
    from(tabla: string) {
      assert.equal(tabla, 'platos_analisis_log')
      return {
        insert: (r: { cliente_id: string }) => ({ select: () => ({ single: async () => { const f = { id: ++n, cliente_id: r.cliente_id, created_at: new Date().toISOString() }; filas.push(f); return { data: { id: f.id }, error: null } } }) }),
        select: () => ({ eq: (_c: string, v: string) => ({ gte: async () => ({ count: filas.filter(f => f.cliente_id === v).length, error: null }) }) }),
        delete: () => ({ eq: async (_c: string, id: number) => { const i = filas.findIndex(f => f.id === id); if (i >= 0) filas.splice(i, 1); return { error: null } } }),
      }
    },
  }
  return { db: db as unknown as SupabaseClient, filas }
}

;(async () => {
  // 25 peticiones simultáneas del mismo cliente: nunca pasan más de MAX (Final #7)
  const { db, filas } = fakeDb()
  const r = await Promise.all(Array.from({ length: 25 }, () => reservarAnalisis(db, 'c1')))
  assert.ok(r.filter(Boolean).length <= MAX_ANALISIS_POR_DIA, `pasaron ${r.filter(Boolean).length}`)
  assert.ok(filas.length <= MAX_ANALISIS_POR_DIA, 'las reservas rechazadas se devuelven')

  // En secuencia: exactamente MAX pasan y la siguiente no
  const s = fakeDb()
  const seq: boolean[] = []
  for (let i = 0; i < MAX_ANALISIS_POR_DIA + 2; i++) seq.push(await reservarAnalisis(s.db, 'c2'))
  assert.equal(seq.filter(Boolean).length, MAX_ANALISIS_POR_DIA)
  assert.equal(seq[MAX_ANALISIS_POR_DIA], false)

  // Otro cliente no se ve afectado
  assert.equal(await reservarAnalisis(s.db, 'c3'), true)
  console.log('platos-limite OK')
})()
