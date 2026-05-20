/**
 * post-scraping.ts — Post-procesado automático tras la ejecución de scraping
 *
 * FLUJO COMPLETO (FASE 4):
 *   1. clasificarPendientes() — productos sin match se vinculan o se crean alimentos
 *   2. enriquecerAlimentosNuevos() — DeepSeek rellena macros + micronutrientes
 *
 * FASE 3 — Micronutrientes integrados:
 *   - DeepSeek ya devuelve 21 micronutrientes + perfil lipídico
 *   - post-scraping persiste todo en la misma UPDATE (sin RPC extra)
 *   - Las columnas existen en la tabla gracias a supabase_micronutrientes.sql
 *
 * FASE 4 — Refactor:
 *   - El scraper ya NO crea alimentos directamente
 *   - Los productos sin match se marcan como pendiente_clasificacion = true
 *   - clasificarPendientes() los procesa post-ejecución
 *
 * Esto evita que los alimentos creados durante scraping se queden
 * permanentemente con macros=0 hasta una ejecución manual de enriquecimiento.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { completarAlimentoConIA } from '@/lib/deepseek'

const MAX_POR_LOTE = 5
const PAUSA_MS = 1000

export interface ResultadoPostScraping {
  procesados: number
  actualizados: number
  errores: string[]
}

export interface ResultadoClasificacion {
  clasificados: number
  creados: number
  nuevosAlimentosIds: string[]
}

/** Columnas de micronutrientes en la tabla alimentos */
const CAMPOS_MICROS: readonly string[] = [
  'vitamina_a_ug', 'vitamina_c_mg', 'vitamina_d_ug',
  'vitamina_e_mg', 'vitamina_k_ug', 'vitamina_b6_mg',
  'vitamina_b12_ug', 'tiamina_mg', 'riboflavina_mg',
  'niacina_mg', 'folato_ug',
  'calcio_mg', 'hierro_mg', 'magnesio_mg', 'fosforo_mg',
  'potasio_mg', 'sodio_mg', 'zinc_mg', 'cobre_mg',
  'selenio_ug',
  'saturados_g', 'monoinsaturados_g', 'poliinsaturados_g',
  'colesterol_mg',
]

/**
 * Extrae solo los campos de micronutrientes del objeto devuelto por DeepSeek.
 */
function extraerMicros(data: Record<string, unknown>): Record<string, number> {
  const micros: Record<string, number> = {}
  for (const key of CAMPOS_MICROS) {
    const val = data[key as string]
    if (typeof val === 'number' && !isNaN(val)) {
      micros[key] = val
    }
  }
  return micros
}

/**
 * Clasifica productos pendientes tras un scraping:
 *   1. Busca productos con pendiente_clasificacion = true para el supermercado
 *   2. Los agrupa por nombre normalizado
 *   3. Intenta match con buscarAlimento() (fuzzy pg_trgm en BD)
 *   4. Si encuentra match - vincula; si no - crea alimento y vincula
 *   5. Marca pendiente_clasificacion = false
 *
 * Devuelve los IDs de alimentos recien creados para post-enriquecimiento.
 */
export async function clasificarPendientes(
  supabase: SupabaseClient,
  supermercadoId: string
): Promise<ResultadoClasificacion> {
  const resultado: ResultadoClasificacion = { clasificados: 0, creados: 0, nuevosAlimentosIds: [] }

  // 1. Obtener productos pendientes de este supermercado
  const { data: pendientes, error: qError } = await supabase
    .from('productos_supermercado')
    .select('id, nombre_original, supermercado_id')
    .eq('supermercado_id', supermercadoId)
    .eq('pendiente_clasificacion', true)
    .limit(500)

  if (qError) {
    console.warn(`[Clasificar] Error al consultar pendientes: ${qError.message}`)
    return resultado
  }

  if (!pendientes || pendientes.length === 0) {
    console.log('[Clasificar] No hay productos pendientes')
    return resultado
  }

  console.log(`[Clasificar] ${pendientes.length} productos pendientes`)

  // 2. Agrupar por nombre normalizado
  const grupos = new Map<string, string[]>()
  for (const p of pendientes) {
    const nombre = p.nombre_original?.toLowerCase().trim() || ''
    if (!nombre) continue
    if (!grupos.has(nombre)) grupos.set(nombre, [])
    grupos.get(nombre)!.push(p.id)
  }

  console.log(`[Clasificar] ${grupos.size} grupos de nombres unicos`)

  // 3-4. Para cada grupo, intentar match o crear alimento
  for (const [nombreNormalizado, ids] of grupos) {
    try {
      // Import dinamico para evitar dependencia circular
      const { buscarAlimento } = await import('./normalizador')
      const { categorizarAlimento } = await import('./categorizador')

      const match = await buscarAlimento(nombreNormalizado, supabase)

      let alimentoId: string | null = match.alimento_id

      // Si no hay match, crear alimento
      if (!alimentoId) {
        const categoria = categorizarAlimento(nombreNormalizado) || 'Supermercado'
        const { data: creado, error: cError } = await supabase
          .from('alimentos')
          .insert({
            nombre: nombreNormalizado,
            categoria,
            calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0,
            es_generico: true,
            es_comestible: true,
            fuente_nutricional: 'scraping_default',
            ultima_actualizacion_nutricional: new Date().toISOString(),
          })
          .select('id')
          .maybeSingle()

        if (cError || !creado) {
          console.warn(`[Clasificar] No se pudo crear alimento para "${nombreNormalizado}": ${cError?.message || 'sin ID'}`)
          continue
        }

        alimentoId = creado.id
        resultado.creados++
        if (alimentoId) {
          resultado.nuevosAlimentosIds.push(alimentoId)
        }
        console.log(`[Clasificar] Alimento creado: "${nombreNormalizado}" -> ${alimentoId}`)
      }

      // 5. Vincular todos los productos de este grupo al alimento
      const { error: uError } = await supabase
        .from('productos_supermercado')
        .update({
          alimento_id: alimentoId,
          pendiente_clasificacion: false,
        })
        .in('id', ids)

      if (uError) {
        console.warn(`[Clasificar] Error al vincular productos "${nombreNormalizado}": ${uError.message}`)
      } else {
        resultado.clasificados += ids.length
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[Clasificar] Error inesperado con "${nombreNormalizado}": ${msg}`)
    }
  }

  console.log(`[Clasificar] Completado: ${resultado.clasificados} productos vinculados, ${resultado.creados} alimentos creados`)
  return resultado
}

/**
 * Enriquece los alimentos recien creados durante scraping.
 * Usa DeepSeek para rellenar macros + micronutrientes + fuente_nutricional = 'deepseek'.
 */
export async function enriquecerAlimentosNuevos(
  supabase: SupabaseClient,
  nuevosAlimentosIds: string[]
): Promise<ResultadoPostScraping> {
  const resultado: ResultadoPostScraping = { procesados: 0, actualizados: 0, errores: [] }

  if (nuevosAlimentosIds.length === 0) {
    return resultado
  }

  console.log(`[PostScraping] Enriqueciendo ${nuevosAlimentosIds.length} alimentos nuevos...`)

  // Obtener datos actuales de los alimentos recien creados
  const { data: alimentos, error: queryError } = await supabase
    .from('alimentos')
    .select('id, nombre, calorias')
    .in('id', nuevosAlimentosIds)

  if (queryError || !alimentos || alimentos.length === 0) {
    resultado.errores.push(`Error al consultar alimentos nuevos: ${queryError?.message || 'sin datos'}`)
    return resultado
  }

  // Filtrar solo los que siguen con macros=0 (los recien creados)
  const pendientes = alimentos.filter(a => !a.calorias || a.calorias === 0)

  if (pendientes.length === 0) {
    console.log('[PostScraping] Todos los alimentos nuevos ya tienen macros — saltando enriquecimiento')
    return resultado
  }

  console.log(`[PostScraping] ${pendientes.length} alimentos pendientes de enriquecer`)

  // Procesar en lotes de MAX_POR_LOTE
  for (let i = 0; i < pendientes.length; i += MAX_POR_LOTE) {
    const lote = pendientes.slice(i, i + MAX_POR_LOTE)

    for (const alimento of lote) {
      try {
        const { data } = await completarAlimentoConIA(alimento.nombre)

        if (!data) {
          resultado.errores.push(`DeepSeek devolvio datos vacios para "${alimento.nombre}"`)
          continue
        }

        // Construir objeto de actualizacion: macros + micronutrientes
        const updateData: Record<string, unknown> = {
          calorias: data.kcal,
          proteinas: data.proteinas,
          carbohidratos: data.carbohidratos,
          grasas: data.grasas,
          fibra: data.fibra ?? 0,
          fuente_nutricional: 'deepseek',
          ultima_actualizacion_nutricional: new Date().toISOString(),
        }

        // Anadir micronutrientes (FASE 3)
        const micros = extraerMicros(data as unknown as Record<string, unknown>)
        for (const [k, v] of Object.entries(micros)) {
          updateData[k] = v
        }

        // Actualizar en BD
        const { error: updateError } = await supabase
          .from('alimentos')
          .update(updateData)
          .eq('id', alimento.id)

        if (updateError) {
          resultado.errores.push(`Error al actualizar "${alimento.nombre}": ${updateError.message}`)
        } else {
          resultado.actualizados++
          const microCount = Object.keys(micros).length
          console.log(`[PostScraping] "${alimento.nombre}" -> ${data.kcal} kcal, ${data.proteinas}g prot, ${microCount} micros`)
        }

        resultado.procesados++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        resultado.errores.push(`Error en DeepSeek para "${alimento.nombre}": ${msg}`)
        console.warn(`[PostScraping] Error con "${alimento.nombre}": ${msg}`)
      }

      // Pequena pausa entre llamadas para no saturar API
      if (lote.length > 1) {
        await new Promise(r => setTimeout(r, PAUSA_MS))
      }
    }

    // Pausa entre lotes
    if (i + MAX_POR_LOTE < pendientes.length) {
      await new Promise(r => setTimeout(r, PAUSA_MS * 2))
    }
  }

  console.log(`[PostScraping] Completado: ${resultado.actualizados}/${resultado.procesados} actualizados, ${resultado.errores.length} errores`)
  return resultado
}
