import type { SupabaseClient } from '@supabase/supabase-js'

/** Pipeline de limpieza de nombres de productos */
function limpiarNombre(nombre: string): string {
    let limpio = nombre

    // 1. Quitar contenido entre paréntesis (marcas, variantes)
    limpio = limpio.replace(/\([^)]*\)/g, '')

    // 2. Quitar cantidades y pesos (ej: "1 kg", "500 g", "6 unidades", "pack 3")
    limpio = limpio.replace(/\d+\s*(kg|g|ml|l|litro|unidad(?:es)?|pack|ud|uds|unid|pieza(?:s)?)/gi, '')

    // 3. Quitar marcas comunes al inicio/final
    limpio = limpio.replace(/^(Hacendado|Bosque Verde|Deliplus|Carrefour|Carrefour Bio|Carrefour Discount|Milbona|Cien|Lidl|Bellsola)\s*/i, '')
    limpio = limpio.replace(/\s*(Hacendado|Bosque Verde|Deliplus|Carrefour|Carrefour Bio|Carrefour Discount|Milbona|Cien|Lidl|Bellsola)$/i, '')

    // 4. Quitar palabras clave de preparación
    limpio = limpio.replace(/\b(para\s+)?(freír|asar|cocinar|horno|plancha|vapor|microondas|troceado|fileteado|cortado|entero|natural|ecológico|tradicional)\b/gi, '')

    // 5. Normalizar espacios
    limpio = limpio.replace(/\s+/g, ' ').trim()

    return limpio
}

/** Normaliza un nombre de producto para buscar en la BD */
export function normalizarProducto(nombre: string): string {
    return limpiarNombre(nombre)
}

export interface MatchResult {
    alimento_id: string | null
    confianza: 'exacta' | 'fuzzy' | 'no_encontrado'
}

/**
 * Busca un alimento en la BD por nombre normalizado.
 * Primero intenta fuzzy matching local, luego llama a la función SQL.
 * @param supabase - Cliente Supabase (browser o service_role según contexto)
 */
export async function buscarAlimento(
    nombre: string,
    supabase: SupabaseClient
): Promise<MatchResult> {
    const nombreLimpio = limpiarNombre(nombre)

    if (!nombreLimpio || nombreLimpio.length < 2) {
        return { alimento_id: null, confianza: 'no_encontrado' }
    }

    // 1. Intentar exacto en local
    const { data: exacto } = await supabase
        .from('alimentos')
        .select('id')
        .ilike('nombre', nombreLimpio)
        .maybeSingle()

    if (exacto) {
        return { alimento_id: exacto.id, confianza: 'exacta' }
    }

    // 2. Intentar contains
    const { data: contains } = await supabase
        .from('alimentos')
        .select('id, nombre')
        .or(`nombre.ilike.%${nombreLimpio}%,${nombreLimpio}.ilike.%nombre%`)
        .limit(1)
        .maybeSingle()

    if (contains) {
        return { alimento_id: contains.id, confianza: 'fuzzy' }
    }

    // 3. Fuzzy matching con la función SQL (pg_trgm)
    const { data: fuzzyId } = await supabase.rpc('match_alimento', {
        p_nombre: nombreLimpio,
    })

    if (fuzzyId) {
        return { alimento_id: fuzzyId as string, confianza: 'fuzzy' }
    }

    return { alimento_id: null, confianza: 'no_encontrado' }
}

/**
 * Intenta crear un nuevo alimento si no existe.
 * Útil para productos que no están en tu BD pero aparecen en el supermercado.
 * @param supabase - Cliente Supabase (browser o service_role según contexto)
 */
export async function crearAlimentoSiNoExiste(
    nombre: string,
    supabase: SupabaseClient,
    categoria?: string
): Promise<string | null> {
    const nombreLimpio = limpiarNombre(nombre)
    if (!nombreLimpio || nombreLimpio.length < 2) return null

    // La tabla alimentos tiene NOT NULL en calorias, proteinas, carbohidratos, grasas
    const { data, error } = await supabase
        .from('alimentos')
        .insert({
            nombre: nombreLimpio,
            categoria: categoria || 'Supermercado',
            calorias: 0,
            proteinas: 0,
            carbohidratos: 0,
            grasas: 0,
        })
        .select('id')
        .single()

    if (error) {
        console.error('[Normalizador] Error al crear alimento:', error.message)
        return null
    }

    console.log(`[Normalizador] Alimento creado: "${nombreLimpio}" (${data.id})`)
    return data.id
}
