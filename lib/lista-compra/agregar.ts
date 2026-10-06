import { canonicalizarItemCompra, esIngredienteBasicoNoCompra } from './filtros'
import type { IngredienteSemanal } from '@/types'

export type FuenteIngrediente = {
    alimento_id: string; alimento_nombre: string; categoria: string; es_generico: boolean
    cantidad_gramos: number; receta_nombre: string
}
export type IngredienteAgregado = Omit<IngredienteSemanal, 'precios' | 'seleccion'> & { alimento_ids: string[] }

export function agregarIngredientes(fuentes: FuenteIngrediente[]) {
    const mapa = new Map<string, IngredienteAgregado>()
    for (const fuente of fuentes) {
        if (esIngredienteBasicoNoCompra(fuente.alimento_nombre)) continue
        const canonical = canonicalizarItemCompra({ id: fuente.alimento_id, nombre: fuente.alimento_nombre, categoria: fuente.categoria })
        const existing = mapa.get(canonical.key)
        if (existing) {
            existing.cantidad_gramos_total += fuente.cantidad_gramos || 0
            existing.alimento_ids = Array.from(new Set([...existing.alimento_ids, fuente.alimento_id]))
            if (!existing.recetas_origen.includes(fuente.receta_nombre)) existing.recetas_origen.push(fuente.receta_nombre)
        } else {
            mapa.set(canonical.key, {
                alimento_id: fuente.alimento_id, alimento_ids: [fuente.alimento_id], alimento_nombre: canonical.nombre,
                categoria: canonical.categoria, es_generico: fuente.es_generico, cantidad_gramos_total: fuente.cantidad_gramos || 0,
                recetas_origen: [fuente.receta_nombre],
            })
        }
    }
    return mapa
}
