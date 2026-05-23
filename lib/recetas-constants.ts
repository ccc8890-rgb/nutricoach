import type { ReactNode } from 'react'

// ─── Categorías ───
export const CATEGORIAS = ['Todos', 'Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack', 'Postre', 'Salsa', 'Acompañamiento'] as const

// ─── Sub-categorías contextuales por tipo de plato ───
// Se muestran en la segunda fila solo cuando hay una categoría activa.
// Matching: tags[] de la receta O nombre contiene el sub-tag (case-insensitive).
export const SUBCATEGORIAS: Partial<Record<string, string[]>> = {
    Desayuno: ['Tortitas', 'Pancakes', 'Gofre', 'Tostada', 'Bowl', 'Batido', 'Granola', 'Bizcocho', 'Yogur', 'Crepe', 'Pudding'],
    Comida: ['Ensalada', 'Pasta', 'Bowl', 'Arroz', 'Legumbre', 'Burrito', 'Wrap', 'Sandwich', 'Pollo', 'Carne', 'Pescado'],
    Cena: ['Ensalada', 'Pasta', 'Bowl', 'Arroz', 'Legumbre', 'Pollo', 'Carne', 'Pescado', 'Wok', 'Sopa'],
    Merienda: ['Batido', 'Bizcocho', 'Galleta', 'Tortitas', 'Tostada', 'Yogur', 'Donut', 'Crepe', 'Cookie', 'Pudding'],
    Snack: ['Galleta', 'Donut', 'Cookie', 'Yogur', 'Chocolate', 'Batido', 'Granola'],
    Postre: ['Bizcocho', 'Tortitas', 'Pancakes', 'Mousse', 'Galleta', 'Tarta', 'Helado', 'Brownie', 'Cookie', 'Pudding', 'Crepe', 'Donut'],
    Salsa: ['Mayonesa', 'Pesto', 'Salsa', 'Barbacoa', 'Alioli', 'Hummus', 'Guacamole', 'Tzatziki'],
    Acompañamiento: ['Patata', 'Arroz', 'Pasta', 'Pan', 'Legumbre'],
}

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

// Alérgenos EU de declaración positiva (lo que la receta CONTIENE)
export const ALERGENOS_POSITIVOS = [
    'Gluten', 'Lácteos', 'Huevos', 'Soja', 'Cacahuetes',
    'Frutos Secos', 'Pescado', 'Crustáceos', 'Moluscos',
    'Sésamo', 'Mostaza', 'Sulfitos',
] as const

// Etiquetas de "libre de" (lo que la receta NO contiene)
export const ALERGENOS_NEGATIVOS = [
    'Sin Gluten', 'Sin Lactosa', 'Sin Huevo',
    'Sin Frutos Secos', 'Sin Soja', 'Sin Pescado',
    'Sin Mariscos', 'Sin Cerdo',
] as const

// Clasificación dietética
export const DIETETICOS = ['Vegetariano', 'Vegano'] as const

// Normaliza un valor de intolerancia a su forma canónica (case-insensitive)
export function normalizarIntolerancia(raw: string): string {
    const trimmed = raw.trim()
    const lower = trimmed.toLowerCase()
    // Buscar match case-insensitive en todas las categorías
    const todasLasOpciones = [
        ...ALERGENOS_POSITIVOS,
        ...ALERGENOS_NEGATIVOS,
        ...DIETETICOS,
    ] as readonly string[]
    for (const valido of todasLasOpciones) {
        if (valido.toLowerCase() === lower) return valido
    }
    // Fallback: devolver con capitalización correcta si parece "sin algo"
    if (lower.startsWith('sin ')) {
        const resto = trimmed.slice(4).trim()
        return `Sin ${resto.charAt(0).toUpperCase() + resto.slice(1).toLowerCase()}`
    }
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

// Normaliza un array completo de intolerancias (deduplica)
export function normalizarIntolerancias(raw: string[]): string[] {
    const vistos = new Set<string>()
    return raw
        .map(normalizarIntolerancia)
        .filter(t => {
            if (vistos.has(t)) return false
            vistos.add(t)
            return true
        })
}

// Clasifica una etiqueta de intolerancias en su categoría (case-insensitive)
export function clasificarIntolerancia(tag: string): 'positivo' | 'negativo' | 'dietetico' {
    const lower = tag.toLowerCase()
    for (const d of DIETETICOS) {
        if (d.toLowerCase() === lower) return 'dietetico'
    }
    // Cualquier tag que empiece con "Sin " es negativo, independientemente del listado explícito
    if (lower.startsWith('sin ')) return 'negativo'
    for (const n of ALERGENOS_NEGATIVOS) {
        if (n.toLowerCase() === lower) return 'negativo'
    }
    return 'positivo'
}

// Comprueba si un tag negativo ("Sin Gluten") coincide con un filtro positivo ("Gluten")
export function negativoCoincideCon(negativo: string, positivo: string): boolean {
    const extraer = negativo.replace(/^Sin\s+/i, '')
    return extraer.toLowerCase() === positivo.toLowerCase()
}

// Obtiene el alérgeno positivo correspondiente a un negativo ("Sin Gluten" → "Gluten")
export function negativoAPositivo(negativo: string): string | null {
    const extraer = negativo.replace(/^Sin\s+/i, '').trim()
    for (const p of ALERGENOS_POSITIVOS) {
        if (p.toLowerCase() === extraer.toLowerCase()) return p
    }
    return null
}

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
