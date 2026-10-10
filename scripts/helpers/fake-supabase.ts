// Cliente Supabase falso con estado: tablas = listas de filas que se leen, se filtran (eq/in/is/gte/ilike) y se modifican (insert/update/delete).
// Cada escritura queda registrada en `ops`, en orden. `falla(tabla, op, payload)` permite simular un error en una escritura concreta.
import type { SupabaseClient } from '@supabase/supabase-js'

export type Fila = Record<string, unknown>
export interface Op { tabla: string; op: 'insert' | 'update' | 'delete'; payload?: unknown; filtros: Record<string, unknown> }

export function fakeSupabase(tablas: Record<string, Fila[]>, opts: { falla?: (tabla: string, op: Op['op'], payload: unknown) => boolean } = {}) {
  const ops: Op[] = []
  let n = 0
  const from = (tabla: string) => {
    const filtros: Record<string, unknown> = {}
    const filtrosIs: Record<string, unknown> = {}
    const filtrosIn: Record<string, unknown[]> = {}
    let ilike: { col: string; v: string } | null = null
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: unknown
    const q: Record<string, unknown> = {}
    for (const m of ['not', 'order', 'limit', 'gte', 'lte']) q[m] = () => q
    q.select = () => q
    q.eq = (c: string, v: unknown) => { filtros[c] = v; return q }
    q.is = (c: string, v: unknown) => { filtrosIs[c] = v; return q }
    q.in = (c: string, v: unknown[]) => { filtrosIn[c] = v; return q }
    q.ilike = (c: string, v: string) => { ilike = { col: c, v }; return q }
    q.insert = (p: unknown) => { op = 'insert'; payload = p; return q }
    q.update = (p: unknown) => { op = 'update'; payload = p; return q }
    q.delete = () => { op = 'delete'; return q }
    const coincide = (f: Fila) =>
      Object.entries(filtros).every(([c, v]) => !(c in f) || f[c] === v) &&
      Object.entries(filtrosIs).every(([c, v]) => !(c in f) || f[c] === v || (v === null && f[c] == null)) &&
      Object.entries(filtrosIn).every(([c, v]) => !(c in f) || v.includes(f[c])) &&
      (!ilike || !(ilike.col in f) || String(f[ilike.col]).toLowerCase().includes(ilike.v.replace(/%/g, '').toLowerCase()))
    const resultado = () => {
      const filas = tablas[tabla] ?? (tablas[tabla] = [])
      if (op !== 'select') ops.push({ tabla, op, payload, filtros: { ...filtros, ...Object.fromEntries(Object.entries(filtrosIn)) } })
      if (op !== 'select' && opts.falla?.(tabla, op, payload)) return { data: null, error: { message: 'fallo simulado' } }
      if (op === 'insert') {
        const fila = { id: `${tabla}-${++n}`, ...(payload as Fila) }
        filas.push(fila)
        return { data: [fila], error: null }
      }
      const afectadas = filas.filter(coincide)
      if (op === 'update') { for (const f of afectadas) Object.assign(f, payload as Fila); return { data: afectadas, error: null } }
      if (op === 'delete') { tablas[tabla] = filas.filter(f => !afectadas.includes(f)); return { data: afectadas, error: null } }
      return { data: afectadas, error: null }
    }
    q.single = () => { const r = resultado(); return Promise.resolve({ data: (r.data as Fila[] | null)?.[0] ?? null, error: r.error }) }
    q.maybeSingle = q.single
    q.then = (res: (v: unknown) => void) => res(resultado())
    return q
  }
  return { db: { from } as unknown as SupabaseClient, ops, tablas }
}
