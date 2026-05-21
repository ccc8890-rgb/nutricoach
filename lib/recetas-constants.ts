import type { ReactNode } from 'react'

// ─── Categorías ───
export const CATEGORIAS = ['Todos', 'Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack', 'Postre'] as const

// ─── Métodos de cocción (unificados) ───
export const TIPOS_COCCION = [
    'No Bake',
    'Sartén',
    'Sartén/Wok',
    'Plancha',
    'Horno/Airfryer',
    'Horno',
    'Freidora de Aire',
    'Microondas',
    'Vapor',
    'Olla/Cazuela',
    'Olla',
    'Hervido',
    'Parrilla',
] as const

export type TipoCoccion = (typeof TIPOS_COCCION)[number]

export const ICONOS_COCCION: Record<string, ReactNode> = {
    'Horno/Airfryer': '🔥',
    'Horno': '🔥',
    'Freidora de Aire': '🔥',
    'Sartén': '🍳',
    'Sartén/Wok': '🍳',
    'Plancha': '🧑‍🍳',
    'Microondas': '📡',
    'No Bake': '❄️',
    'Parrilla': '🔄',
    'Hervido': '🍳',
    'Olla/Cazuela': '🍳',
    'Olla': '🍳',
    'Vapor': '♨️',
}

// ─── Intolerancias ───
// Alérgenos EU (Reglamento 1169/2011) — declaración positiva: lo que la receta SÍ contiene
// Más Vegetariano/Vegano como clasificación dietética positiva
export const INTOLERANCIAS = [
    'Gluten',
    'Lácteos',
    'Huevos',
    'Soja',
    'Cacahuetes',
    'Frutos Secos',
    'Pescado',
    'Crustáceos',
    'Moluscos',
    'Sésamo',
    'Mostaza',
    'Sulfitos',
    'Vegetariano',
    'Vegano',
] as const

// ─── Dificultades ───
export const DIFICULTADES = ['Fácil', 'Medio', 'Difícil'] as const

// ─── Estados ───
export const ESTADOS_RECETA = ['aprobada', 'descartada', 'en_revision', 'borrador'] as const

// ─── Helper para normalizar esquemas (antiguo vs nuevo) ───
export interface RecetaNormalizada {
    kcal: number | null
    proteinas: number | null
    carbohidratos: number | null
    grasas: number | null
    instrucciones: string | null
    url_origen: string | null
    tipo_coccion: string | null
}

interface RecetaNormalizable {
    kcal?: number | null
    kcal_por_porcion?: number | null
    proteinas?: number | null
    proteinas_por_porcion?: number | null
    carbohidratos?: number | null
    carbohidratos_por_porcion?: number | null
    grasas?: number | null
    grasas_por_porcion?: number | null
    instrucciones?: string | null
    pasos?: string | null
    url_origen?: string | null
    url?: string | null
    tipo_coccion?: string | null
    tipo_plato?: string | null
}

export function normalizarReceta(r: RecetaNormalizable): RecetaNormalizada {
    return {
        kcal: r.kcal ?? r.kcal_por_porcion ?? null,
        proteinas: r.proteinas ?? r.proteinas_por_porcion ?? null,
        carbohidratos: r.carbohidratos ?? r.carbohidratos_por_porcion ?? null,
        grasas: r.grasas ?? r.grasas_por_porcion ?? null,
        instrucciones: r.instrucciones ?? r.pasos ?? null,
        url_origen: r.url_origen ?? r.url ?? null,
        tipo_coccion: r.tipo_coccion ?? r.tipo_plato ?? null,
    }
}
