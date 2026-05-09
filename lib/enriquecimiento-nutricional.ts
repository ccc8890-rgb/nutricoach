/**
 * enriquecimiento-nutricional.ts — Motor de enriquecimiento nutricional por IA
 *
 * Usa Vercel AI SDK + DeepSeek para rellenar macros y categorizar
 * alimentos de supermercado automáticamente.
 *
 * FLUJO:
 *   1. Obtener productos pendientes (sin macros o macros=0)
 *   2. Enviar lotes a DeepSeek vía Vercel AI SDK
 *   3. Actualizar alimentos en Supabase con macros + categoría IA
 *   4. Marcar como completado en la cola de enriquecimiento
 */

import { createDeepSeek } from '@ai-sdk/deepseek'
import { generateText } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResultadoEnriquecimiento, AlimentoPendienteEnriquecer } from '@/types'

// ── Configuración ─────────────────────────────────────────────

const MODELO = 'deepseek-chat'
const TEMPERATURA = 0.1
const LOTES_POR_VEZ = 25 // nº de alimentos por llamada a DeepSeek
const MAX_INTENTOS = 3

const deepseek = createDeepSeek()

/**
 * Prompt para que DeepSeek rellene macros de alimentos.
 * Se le pasa un JSON con nombre y categoría actual, devuelve JSON array.
 */
function construirPromptEnriquecimiento(alimentos: { id: string; nombre: string; categoria_actual: string | null }[]): string {
    return `Eres un nutricionista experto. Para cada alimento de la lista, debes proporcionar:
1. **categoria_ia**: categoría nutricional precisa (elige de esta lista: Carnes rojas, Carnes blancas, Pescado azul, Pescado blanco, Mariscos, Huevos, Legumbres, Frutos secos y semillas, Lácteos enteros, Lácteos semidesnatados, Lácteos desnatados, Arroces y pastas, Pan y cereales, Patatas y tubérculos, Verduras de hoja verde, Verduras y hortalizas, Frutas frescas, Frutas deshidratadas, Aceites y grasas, Salsas y condimentos, Bebidas, Dulces y bollería, Platos preparados, Suplementos deportivos, Supermercado - Sin clasificar)
2. **calorias**: kcal por 100g
3. **proteinas**: gramos por 100g
4. **carbohidratos**: gramos por 100g
5. **grasas**: gramos por 100g
6. **fibra**: gramos por 100g (0 si no aplica)
7. **confianza**: "alta" si conoces el valor exacto, "media" si es estimación, "baja" si es muy incierto

IMPORTANTE: Responde SOLO con un array JSON válido, sin markdown ni explicaciones.
Usa valores realistas basados en tablas de composición de alimentos españolas (BEDCA).

Alimentos a procesar:
${JSON.stringify(alimentos, null, 2)}

Formato de respuesta (array JSON):
[
  {
    "alimento_id": "uuid",
    "nombre": "nombre del alimento",
    "categoria_ia": "Categoría exacta de la lista",
    "calorias": 0,
    "proteinas": 0,
    "carbohidratos": 0,
    "grasas": 0,
    "fibra": 0,
    "confianza": "alta|media|baja",
    "explicacion": "breve razón de los valores"
  }
]`
}

/**
 * Envía un lote de alimentos a DeepSeek para enriquecerlos.
 */
async function enriquecerLoteConIA(
    alimentos: { id: string; nombre: string; categoria_actual: string | null }[]
): Promise<ResultadoEnriquecimiento[]> {
    const prompt = construirPromptEnriquecimiento(alimentos)

    const { text } = await generateText({
        model: deepseek(MODELO),
        prompt,
        temperature: TEMPERATURA,
        maxOutputTokens: 4000,
    })

    // Extraer JSON del texto de respuesta
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
        // Intentar con objeto individual
        const singleMatch = text.match(/\{[\s\S]*\}/)
        if (!singleMatch) {
            throw new Error(`No se pudo extraer JSON de la respuesta. Texto: ${text.slice(0, 500)}`)
        }
        return [JSON.parse(singleMatch[0])]
    }

    const parsed: ResultadoEnriquecimiento[] = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed)) {
        return [parsed as unknown as ResultadoEnriquecimiento]
    }

    return parsed
}

/**
 * Obtiene alimentos pendientes de enriquecer desde Supabase.
 * @param supabase - Cliente Supabase con service_role
 * @param limite - Nº máximo de alimentos a obtener
 */
export async function obtenerPendientesEnriquecer(
    supabase: SupabaseClient,
    limite: number = 100
): Promise<AlimentoPendienteEnriquecer[]> {
    const { data, error } = await supabase
        .from('alimentos_pendientes_enriquecer')
        .select('*')
        .limit(limite)
        .order('nombre')

    if (error) {
        console.error('[Enriquecimiento] Error al obtener pendientes:', error.message)
        return []
    }

    return data ?? []
}

/**
 * Procesa un lote de alimentos con IA y los actualiza en Supabase.
 * @param supabase - Cliente Supabase con service_role
 * @param alimentos - Array de alimentos pendientes
 * @returns Estadísticas del proceso
 */
export async function procesarLoteEnriquecimiento(
    supabase: SupabaseClient,
    alimentos: AlimentoPendienteEnriquecer[]
): Promise<{
    procesados: number
    actualizados: number
    errores: string[]
}> {
    const stats = { procesados: 0, actualizados: 0, errores: [] as string[] }

    // Dividir en sublotes para la IA
    for (let i = 0; i < alimentos.length; i += LOTES_POR_VEZ) {
        const lote = alimentos.slice(i, i + LOTES_POR_VEZ)
        const loteParaIA = lote.map(a => ({
            id: a.id,
            nombre: a.nombre,
            categoria_actual: a.categoria,
        }))

        let intentos = 0
        let exito = false

        while (intentos < MAX_INTENTOS && !exito) {
            try {
                const resultados = await enriquecerLoteConIA(loteParaIA)
                stats.procesados += resultados.length

                // Actualizar cada alimento en Supabase
                for (const r of resultados) {
                    const { error } = await supabase.rpc('actualizar_alimento_con_ia', {
                        p_alimento_id: r.alimento_id,
                        p_categoria_ia: r.categoria_ia,
                        p_calorias: r.calorias,
                        p_proteinas: r.proteinas,
                        p_carbohidratos: r.carbohidratos,
                        p_grasas: r.grasas,
                        p_fibra: r.fibra ?? null,
                        p_resultado_json: JSON.stringify(r),
                    })

                    if (error) {
                        stats.errores.push(`Error al actualizar ${r.nombre}: ${error.message}`)
                    } else {
                        stats.actualizados++
                    }
                }

                exito = true
                // Pequeña pausa entre lotes para no saturar la API
                if (i + LOTES_POR_VEZ < alimentos.length) {
                    await new Promise(r => setTimeout(r, 1000))
                }
            } catch (err) {
                intentos++
                const msg = err instanceof Error ? err.message : String(err)
                if (intentos >= MAX_INTENTOS) {
                    stats.errores.push(`Error tras ${MAX_INTENTOS} intentos en lote ${i / LOTES_POR_VEZ}: ${msg}`)
                } else {
                    console.warn(`[Enriquecimiento] Reintento ${intentos}/${MAX_INTENTOS} lote ${i / LOTES_POR_VEZ}: ${msg}`)
                    await new Promise(r => setTimeout(r, 2000 * intentos))
                }
            }
        }
    }

    return stats
}

/**
 * Enriquecimiento completo: obtiene pendientes, procesa y actualiza.
 */
export async function ejecutarEnriquecimientoCompleto(
    supabase: SupabaseClient,
    limite: number = 100
): Promise<{
    total_pendientes: number
    procesados: number
    actualizados: number
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()

    const pendientes = await obtenerPendientesEnriquecer(supabase, limite)

    if (pendientes.length === 0) {
        return {
            total_pendientes: 0,
            procesados: 0,
            actualizados: 0,
            errores: [],
            duracion_ms: 0,
        }
    }

    const stats = await procesarLoteEnriquecimiento(supabase, pendientes)

    return {
        total_pendientes: pendientes.length,
        ...stats,
        duracion_ms: Date.now() - inicio,
    }
}

/**
 * Obtiene estadísticas de enriquecimiento desde Supabase.
 */
export async function obtenerStatsEnriquecimiento(
    supabase: SupabaseClient
): Promise<{
    total_pendientes: number
    total_completados: number
    total_errores: number
    total_alimentos_en_db: number
    supermercados_con_precios: number
    productos_con_precio: number
}> {
    // Total alimentos en DB
    const { count: totalAlimentos } = await supabase
        .from('alimentos')
        .select('*', { count: 'exact', head: true })

    // Pendientes de enriquecer (vista)
    const { count: pendientes } = await supabase
        .from('alimentos_pendientes_enriquecer')
        .select('*', { count: 'exact', head: true })

    // Completados en cola
    const { count: completados } = await supabase
        .from('alimentos_enriquecimiento_cola')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'completado')

    // Errores
    const { count: errores } = await supabase
        .from('alimentos_enriquecimiento_cola')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'error')

    // Productos con precio
    const { count: productosConPrecio } = await supabase
        .from('productos_supermercado')
        .select('*', { count: 'exact', head: true })

    // Supermercados activos
    const { count: supermercados } = await supabase
        .from('supermercados')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)

    return {
        total_alimentos_en_db: totalAlimentos ?? 0,
        total_pendientes: pendientes ?? 0,
        total_completados: completados ?? 0,
        total_errores: errores ?? 0,
        supermercados_con_precios: supermercados ?? 0,
        productos_con_precio: productosConPrecio ?? 0,
    }
}
