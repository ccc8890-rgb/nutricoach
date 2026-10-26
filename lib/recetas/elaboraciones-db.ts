// Elaboraciones como ingrediente: carga, expansión y recálculo en servidor (cliente Supabase de servicio).
import type { createServiceSupabase } from '@/lib/supabase-server'
import { aplanarLineas, macrosPorRacion, CicloElaboracion, type Elaboracion, type Linea } from './elaboraciones'

type Db = ReturnType<typeof createServiceSupabase>

const PROFUNDIDAD = 2
const LINEAS = 'id, alimento_id, elaboracion_id, nombre_libre, cantidad_gramos, orden, es_opcional, rol_ingrediente, es_cantidad_fija, alimento:alimentos(id, nombre, categoria, es_generico, calorias, proteinas, carbohidratos, grasas, fibra)'
export const ETIQUETA_REVISAR_ALERGENOS = 'Revisar alérgenos'

type FilaElaboracion = { id: string; peso_final_g: number | null; receta_ingredientes: Linea[] | null }

/** Carga elaboraciones (en cualquier estado salvo descartada: una en revisión sigue contando en las recetas que ya la llevan) con sus líneas, y por niveles (máx. 2) las que estas contengan. */
export async function cargarElaboraciones(db: Db, ids: string[]): Promise<Map<string, Elaboracion>> {
  const mapa = new Map<string, Elaboracion>()
  let pendientes = [...new Set(ids)]
  for (let nivel = 0; nivel <= PROFUNDIDAD && pendientes.length > 0; nivel++) {
    const { data, error } = await db
      .from('recetas')
      .select(`id, peso_final_g, receta_ingredientes!receta_ingredientes_receta_id_fkey(${LINEAS})`)
      .in('id', pendientes)
      .eq('tipo_receta', 'salsa_base')
      .neq('estado', 'descartada')
    if (error) throw error
    const siguientes = new Set<string>()
    for (const r of (data ?? []) as unknown as FilaElaboracion[]) {
      const lineas = (r.receta_ingredientes ?? []).map(l => ({ ...l, alimento: Array.isArray(l.alimento) ? l.alimento[0] : l.alimento }))
      mapa.set(r.id, { peso_final_g: r.peso_final_g, lineas })
      for (const l of lineas) if (l.elaboracion_id && !mapa.has(l.elaboracion_id)) siguientes.add(l.elaboracion_id)
    }
    pendientes = [...siguientes]
  }
  return mapa
}

/**
 * Devuelve las filas con las líneas de elaboración sustituidas por sus ingredientes base (misma forma que una fila de
 * receta_ingredientes con su alimento). Sin líneas de elaboración devuelve el mismo array sin consultar nada.
 */
export async function expandirIngredientes<T extends Linea>(db: Db, filas: T[], raiz?: string): Promise<T[]> {
  const ids = filas.filter(f => f.elaboracion_id).map(f => f.elaboracion_id as string)
  if (ids.length === 0) return filas
  const mapa = await cargarElaboraciones(db, ids)
  try {
    const { lineas, sinResolver } = aplanarLineas(filas, mapa, { raiz })
    if (sinResolver.length) console.warn('[elaboraciones] líneas sin resolver:', sinResolver.join(','))
    return lineas as T[]
  } catch (e) {
    // Un ciclo (solo posible por una carrera entre dos guardados o por un script) no debe dar 500 en la compra o el escandallo
    if (e instanceof CicloElaboracion) { console.warn('[elaboraciones] ciclo en', raiz ?? ids.join(',')); return filas }
    throw e
  }
}

/**
 * Variante en bloque para lectores que cargan muchas recetas con su `receta_ingredientes`: sustituye en cada una las líneas
 * de elaboración por sus ingredientes base (una sola carga de elaboraciones para todas). Una receta con ciclo se deja como está.
 */
export async function expandirRecetas<R extends { id?: string; receta_ingredientes?: unknown }>(db: Db, recetas: R[]): Promise<R[]> {
  const lineasDe = (r: R) => (Array.isArray(r.receta_ingredientes) ? r.receta_ingredientes : []) as Linea[]
  const ids = [...new Set(recetas.flatMap(r => lineasDe(r).filter(l => l.elaboracion_id).map(l => l.elaboracion_id as string)))]
  if (ids.length === 0) return recetas
  const mapa = await cargarElaboraciones(db, ids)
  return recetas.map(r => {
    const ls = lineasDe(r)
    if (!ls.some(l => l.elaboracion_id)) return r
    try {
      const { lineas, sinResolver } = aplanarLineas(ls, mapa, { raiz: r.id })
      if (sinResolver.length) console.warn('[elaboraciones] líneas sin resolver:', sinResolver.join(','))
      return { ...r, receta_ingredientes: lineas }
    } catch (e) {
      if (e instanceof CicloElaboracion) return r
      throw e
    }
  })
}

/** Recalcula kcal y macros por ración de una receta contando sus elaboraciones; marca «Revisar alérgenos» si las lleva. */
export async function recalcularMacrosReceta(db: Db, recetaId: string): Promise<{ kcal: number } | null> {
  const { data: receta, error } = await db
    .from('recetas')
    .select(`id, porciones, tags, receta_ingredientes!receta_ingredientes_receta_id_fkey(${LINEAS})`)
    .eq('id', recetaId)
    .single()
  if (error || !receta) return null
  const crudas = ((receta.receta_ingredientes ?? []) as unknown as Linea[]).map(l => ({ ...l, alimento: Array.isArray(l.alimento) ? l.alimento[0] : l.alimento }))
  const planas = await expandirIngredientes(db, crudas, recetaId)
  const m = macrosPorRacion(planas, Number(receta.porciones) || 1)
  const actualizacion: Record<string, unknown> = {}
  if (m.kcal > 0) Object.assign(actualizacion, { kcal: m.kcal, proteinas: m.proteinas, carbohidratos: m.carbohidratos, grasas: m.grasas, fibra: m.fibra })
  const tags: string[] = Array.isArray(receta.tags) ? receta.tags : []
  if (crudas.some(l => l.elaboracion_id) && !tags.includes(ETIQUETA_REVISAR_ALERGENOS)) actualizacion.tags = [...tags, ETIQUETA_REVISAR_ALERGENOS]
  if (Object.keys(actualizacion).length === 0) return null
  const { error: errUpd } = await db.from('recetas').update(actualizacion).eq('id', recetaId)
  if (errUpd) throw errUpd
  return { kcal: m.kcal }
}

/** Ids de recetas que usan una elaboración, directa o indirectamente (hasta 2 niveles). */
export async function recetasQueUsan(db: Db, elaboracionId: string): Promise<string[]> {
  const vistos = new Set<string>()
  let actuales = [elaboracionId]
  for (let nivel = 0; nivel < PROFUNDIDAD && actuales.length > 0; nivel++) {
    const { data, error } = await db.from('receta_ingredientes').select('receta_id').in('elaboracion_id', actuales)
    if (error) throw error
    const nuevos = [...new Set((data ?? []).map(r => r.receta_id as string))].filter(id => id !== elaboracionId && !vistos.has(id))
    nuevos.forEach(id => vistos.add(id))
    actuales = nuevos
  }
  return [...vistos]
}

/** Tras cambiar una elaboración (ingredientes o peso final): recalcula ella misma y todas las recetas que la usan. */
export async function propagarCambioElaboracion(db: Db, elaboracionId: string): Promise<number> {
  let n = 0
  if (await recalcularMacrosReceta(db, elaboracionId)) n++
  // Las más profundas primero no importa: cada recálculo expande desde los ingredientes base
  for (const id of await recetasQueUsan(db, elaboracionId)) if (await recalcularMacrosReceta(db, id)) n++
  return n
}

/** True si enlazar esas elaboraciones dentro de `recetaId` crearía un ciclo (la receta ya está dentro de alguna de ellas). */
export async function enlaceCreaCiclo(db: Db, recetaId: string, elaboracionIds: string[]): Promise<boolean> {
  if (elaboracionIds.includes(recetaId)) return true
  const mapa = await cargarElaboracionesSinFiltro(db, elaboracionIds)
  const profundidadHasta = (ids: string[], nivel: number): boolean => {
    if (nivel > PROFUNDIDAD + 1) return false
    for (const id of ids) {
      const hijas = (mapa.get(id) ?? []).filter(Boolean) as string[]
      if (hijas.includes(recetaId)) return true
      if (profundidadHasta(hijas, nivel + 1)) return true
    }
    return false
  }
  return profundidadHasta(elaboracionIds, 0)
}

/** Niveles de elaboración que habría al enlazar estas dentro de una receta (1 = solo ellas; el máximo permitido es 2). */
export async function nivelesAlEnlazar(db: Db, elaboracionIds: string[]): Promise<number> {
  const mapa = await cargarElaboracionesSinFiltro(db, elaboracionIds)
  const nivel = (id: string, vistos: string[]): number => {
    if (vistos.includes(id)) return 1
    const hijas = mapa.get(id) ?? []
    return 1 + Math.max(0, ...hijas.map(h => nivel(h, [...vistos, id])))
  }
  return Math.max(0, ...elaboracionIds.map(id => nivel(id, [])))
}

// Para detectar ciclos no importa el estado de la elaboración: mapa id → ids de elaboraciones que contiene
async function cargarElaboracionesSinFiltro(db: Db, ids: string[]): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>()
  let pendientes = [...new Set(ids)]
  for (let nivel = 0; nivel <= PROFUNDIDAD && pendientes.length > 0; nivel++) {
    const { data, error } = await db.from('receta_ingredientes').select('receta_id, elaboracion_id').in('receta_id', pendientes).not('elaboracion_id', 'is', null)
    if (error) throw error
    const siguientes = new Set<string>()
    for (const id of pendientes) mapa.set(id, [])
    for (const r of data ?? []) {
      mapa.get(r.receta_id as string)!.push(r.elaboracion_id as string)
      if (!mapa.has(r.elaboracion_id as string)) siguientes.add(r.elaboracion_id as string)
    }
    pendientes = [...siguientes]
  }
  return mapa
}
