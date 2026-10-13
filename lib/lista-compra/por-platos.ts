import { convertirGramosACompra } from './inteligente'

export interface IngredientePlato {
    clave: string
    nombre: string
    categoria: string
    cantidad_gramos: number
}

export interface PlatoCompra {
    id: string
    /** Nombre de la receta, o el de la comida si no tiene receta vinculada. */
    nombre: string
    /** Franja de la comida (Desayuno, Comida…) cuando el nombre es el de la receta. */
    franja: string | null
    dia: string | null
    ingredientes: IngredientePlato[]
}

export interface ItemSeleccion {
    clave: string
    nombre: string
    categoria: string
    cantidad_gramos: number
    cantidad_compra: string
    platos: string[]
}

/** Suma los ingredientes de los platos elegidos, agrupados por clave canónica. */
export function ingredientesDePlatos(platos: PlatoCompra[], elegidos: Set<string>): ItemSeleccion[] {
    const mapa = new Map<string, ItemSeleccion>()
    for (const plato of platos) {
        if (!elegidos.has(plato.id)) continue
        for (const ing of plato.ingredientes) {
            const actual = mapa.get(ing.clave)
            if (actual) {
                actual.cantidad_gramos += ing.cantidad_gramos
                if (!actual.platos.includes(plato.nombre)) actual.platos.push(plato.nombre)
            } else {
                mapa.set(ing.clave, {
                    clave: ing.clave,
                    nombre: ing.nombre,
                    categoria: ing.categoria,
                    cantidad_gramos: ing.cantidad_gramos,
                    cantidad_compra: '',
                    platos: [plato.nombre],
                })
            }
        }
    }
    return Array.from(mapa.values())
        .map(item => ({
            ...item,
            cantidad_gramos: Math.round(item.cantidad_gramos),
            cantidad_compra: convertirGramosACompra(item.cantidad_gramos, item.nombre),
        }))
        .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre))
}
