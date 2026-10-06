import type { SupabaseClient } from '@supabase/supabase-js'
import { agregarIngredientes, type FuenteIngrediente } from '@/lib/lista-compra/agregar'

export type LineaCompraTanda = {
  alimento_id: string
  alimento_nombre: string
  categoria: string
  gramos: number
  recetas: string[]
  coste_estimado: number | null
}

type FilaReceta = {
  id: string; nombre: string
  receta_ingredientes: { cantidad_gramos: number | null; alimento: { id: string; nombre: string; categoria: string | null; es_generico: boolean | null } | null }[]
}

const redondear = (n: number) => Math.round(n * 100) / 100

/** Compra consolidada de una tanda: cantidades completas de cada receta, sumadas por alimento. Coste con el precio más barato. */
export async function compraDeTanda(db: SupabaseClient, recetaIds: string[]): Promise<{ lineas: LineaCompraTanda[]; costeEstimado: number }> {
  if (recetaIds.length === 0) return { lineas: [], costeEstimado: 0 }
  const { data, error } = await db.from('recetas')
    .select('id, nombre, receta_ingredientes!receta_ingredientes_receta_id_fkey(cantidad_gramos, alimento:alimentos(id, nombre, categoria, es_generico))')
    .in('id', recetaIds)
  if (error) throw new Error('No se pudieron leer los ingredientes de la tanda')

  const fuentes: FuenteIngrediente[] = ((data ?? []) as unknown as FilaReceta[]).flatMap(r =>
    r.receta_ingredientes.flatMap(i => i.alimento && Number(i.cantidad_gramos) > 0 ? [{
      alimento_id: i.alimento.id, alimento_nombre: i.alimento.nombre, categoria: i.alimento.categoria ?? 'Otros',
      es_generico: i.alimento.es_generico ?? false, cantidad_gramos: Number(i.cantidad_gramos), receta_nombre: r.nombre,
    }] : []))

  const agregados = [...agregarIngredientes(fuentes).values()]
  const alimentoIds = [...new Set(agregados.flatMap(a => a.alimento_ids))]
  const minPorAlimento = new Map<string, number>()
  if (alimentoIds.length > 0) {
    const { data: precios } = await db.from('precios_actuales')
      .select('alimento_id, precio_por_kg').in('alimento_id', alimentoIds).gt('precio_por_kg', 0)
    for (const p of (precios ?? []) as { alimento_id: string; precio_por_kg: number }[]) {
      const actual = minPorAlimento.get(p.alimento_id)
      if (actual === undefined || p.precio_por_kg < actual) minPorAlimento.set(p.alimento_id, p.precio_por_kg)
    }
  }

  const lineas: LineaCompraTanda[] = agregados.map(a => {
    const candidatos = a.alimento_ids.map(id => minPorAlimento.get(id)).filter((n): n is number => n !== undefined)
    const mejor = candidatos.length > 0 ? Math.min(...candidatos) : null
    return {
      alimento_id: a.alimento_id, alimento_nombre: a.alimento_nombre, categoria: a.categoria,
      gramos: Math.round(a.cantidad_gramos_total), recetas: a.recetas_origen,
      coste_estimado: mejor === null ? null : redondear((a.cantidad_gramos_total / 1000) * mejor),
    }
  }).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.alimento_nombre.localeCompare(b.alimento_nombre))

  return { lineas, costeEstimado: redondear(lineas.reduce((t, l) => t + (l.coste_estimado ?? 0), 0)) }
}
