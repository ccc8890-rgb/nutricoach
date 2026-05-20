import type { SupabaseClient } from '@supabase/supabase-js'

export interface AlimentoRecord {
    id: string
    nombre: string
    nombreLower: string
    calorias?: number  // opcional — para desempatar priorizando alimentos con macros reales
}

export function quitarAcentos(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Busca un alimento en el Map in-memory usando matching progresivo de 5 niveles.
 *
 * Nivel 1: Coincidencia exacta (case-insensitive)
 * Nivel 2: Coincidencia exacta sin acentos
 * Nivel 3: Contiene bidireccional con word boundaries
 *   - Caso A: alimento contiene nombre completo del producto (prioritario)
 *   - Caso B: producto contiene nombre del alimento como palabra completa (\b)
 *   - En Caso B prefiere el nombre más largo (más específico)
 * Nivel 4: Coincidencia por palabra clave (al menos 2 palabras coincidentes)
 * Nivel 5: Último recurso — palabra individual con \b, solo si <2 palabras relevantes
 *
 * @param nombreLimpio Nombre del producto normalizado (solo lowercase + trim)
 * @param alimentosMap Mapa de alimentos (nombreLower → AlimentoRecord)
 * @returns ID del alimento encontrado o null
 */
export function matchAlimentoInMemory(
    nombreLimpio: string,
    alimentosMap: Map<string, AlimentoRecord>
): string | null {
    const lower = nombreLimpio.toLowerCase()

    // 1. Coincidencia exacta
    const exacto = alimentosMap.get(lower)
    if (exacto) return exacto.id

    // 2. Coincidencia exacta sin acentos
    const lowerSinAcentos = quitarAcentos(lower)
    for (const a of alimentosMap.values()) {
        if (quitarAcentos(a.nombreLower) === lowerSinAcentos) {
            return a.id
        }
    }

    // 3. Contiene bidireccional
    let mejor: AlimentoRecord | null = null
    let mejorContainsLower: AlimentoRecord | null = null
    for (const a of alimentosMap.values()) {
        const aLower = a.nombreLower
        // Caso A: el alimento contiene el nombre completo del producto
        if (aLower.includes(lower)) {
            if (!mejorContainsLower || a.nombre.length < mejorContainsLower.nombre.length) {
                mejorContainsLower = a
            }
            continue
        }
        // Caso B: el producto contiene el nombre del alimento como palabra completa
        const aLowerEscaped = aLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const wordBoundaryRegex = new RegExp(`\\b${aLowerEscaped}\\b`)
        if (wordBoundaryRegex.test(lower)) {
            // Priorizar: primero macros reales, luego nombre más específico (más largo)
            const esMejor = !mejor ||
                ((a.calorias ?? 0) > 0 && (mejor.calorias ?? 0) === 0) ||
                ((a.calorias ?? 0) === (mejor.calorias ?? 0) && a.nombre.length > mejor.nombre.length)
            if (esMejor) {
                mejor = a
            }
        }
    }
    // Caso A tiene prioridad sobre Caso B
    // Y dentro de Caso A, priorizar macros reales
    if (mejorContainsLower) {
        if (mejor && (mejor.calorias ?? 0) > 0 && (mejorContainsLower.calorias ?? 0) === 0) {
            // mejor ya tiene macros, mantenerlo
        } else {
            mejor = mejorContainsLower
        }
    }
    if (mejor) return mejor.id

    // 4. Coincidencia por palabra clave (palabra más larga)
    const palabras = lower.split(/\s+/).filter(p => p.length > 2)
    if (palabras.length > 0) {
        const palabraClave = [...palabras].sort((a, b) => b.length - a.length)[0]
        const candidatos: AlimentoRecord[] = []
        for (const a of alimentosMap.values()) {
            if (a.nombreLower.includes(palabraClave)) {
                candidatos.push(a)
            }
        }
        if (candidatos.length > 0) {
            // Filtrar: el nombre del alimento debe contener AL MENOS 2 palabras del producto buscado
            const conMatch = candidatos.filter(a => {
                const palabrasAlimento = a.nombreLower.split(/\s+/)
                const coincidencias = palabras.filter(p =>
                    palabrasAlimento.some(pa => pa.includes(p) || p.includes(pa))
                )
                return coincidencias.length >= 2 || coincidencias.length === palabras.length
            })
            if (conMatch.length > 0) {
                // Desempate: priorizar alimentos con macros reales (calorias > 0)
                // sobre los creados por scraping con macros=0
                conMatch.sort((a, b) => {
                    const aHasMacros = (a.calorias ?? 0) > 0 ? 1 : 0
                    const bHasMacros = (b.calorias ?? 0) > 0 ? 1 : 0
                    if (aHasMacros !== bHasMacros) return bHasMacros - aHasMacros
                    // A igualdad de macros, elegir el nombre más corto (más genérico = mejor match)
                    return a.nombre.length - b.nombre.length
                })
                return conMatch[0].id
            }
        }
    }

    // 5. Último recurso: palabra individual con límite de palabra (\b)
    // Si hay 2+ palabras relevantes, no usar nivel 5 (evitar falsos positivos)
    const palabrasFiltradas = (palabras.length ? palabras : [lower])
        .filter(p => p.length >= 3)
        .sort((a, b) => b.length - a.length)

    if (palabrasFiltradas.length >= 2) return null

    for (const palabra of palabrasFiltradas) {
        const regex = new RegExp(`\\b${palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        for (const a of alimentosMap.values()) {
            if (regex.test(a.nombreLower)) {
                return a.id
            }
        }
    }

    return null
}

/**
 * Pre-carga todos los alimentos comestibles de la BD en un Map para matching rápido en memoria.
 * Ahora también carga `calorias` para poder desempatar entre candidatos.
 */
export async function cargarAlimentosMap(supabase: SupabaseClient): Promise<Map<string, AlimentoRecord>> {
    const map = new Map<string, AlimentoRecord>()
    const pageSize = 5000
    let desde = 0
    let hayMas = true

    while (hayMas) {
        const { data, error } = await supabase
            .from('alimentos')
            .select('id, nombre, calorias')
            .eq('es_comestible', true)
            .range(desde, desde + pageSize - 1)

        if (error || !data || data.length === 0) {
            hayMas = false
            break
        }

        for (const a of data) {
            const record: AlimentoRecord = {
                id: a.id,
                nombre: a.nombre,
                nombreLower: a.nombre.toLowerCase(),
                calorias: a.calorias ?? undefined,
            }
            map.set(record.nombreLower, record)
        }

        if (data.length < pageSize) hayMas = false
        else desde += pageSize
    }

    console.log(`[Matcher] Cargados ${map.size} alimentos en memoria`)
    return map
}
