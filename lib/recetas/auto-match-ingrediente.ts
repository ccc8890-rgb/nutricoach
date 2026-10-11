/**
 * auto-match-ingrediente.ts — Motor de matching y creación de alimentos
 *
 * Pipeline de 3 fases para ingredientes sin alimento_id:
 *   FASE 1: Match contra alimentos existentes (EXACTO + solapamiento ≥60%)
 *   FASE 2: Match contra productos_supermercado (buscar nombre en scrapeos)
 *   FASE 3: Crear nuevo alimento vía DeepSeek con datos BEDCA/USDA verificables
 *
 * IMPORTANTE: NUNCA sobrescribir nombre_libre. Preserva siempre el nombre
 * original que el usuario/receta introdujo.
 *
 * Uso desde script:
 *   import { procesarIngredientesHuerfanos } from '@/lib/recetas/auto-match-ingrediente'
 *   const result = await procesarIngredientesHuerfanos(supabase, ['receta_id_1', ...])
 *
 * Uso desde API/trigger para receta nueva:
 *   import { autoMatchIngrediente } from '@/lib/recetas/auto-match-ingrediente'
 *   const result = await autoMatchIngrediente(supabase, 'nombre libre', 100)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { generateText } from 'ai'

// ── Tipos ────────────────────────────────────────────────────

export interface ResultadoMatch {
  estado: 'match_existente' | 'match_producto' | 'creado_nuevo' | 'sin_match'
  alimento_id: string | null
  alimento_nombre: string | null
  nombre_libre: string
  confianza: 'exacta' | 'alta' | 'producto' | 'ia_generado' | 'no_encontrado'
  macros_100g?: { calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number }
}

export interface ResultadoProcesar {
  total: number
  match_existente: number
  match_producto: number
  creado_nuevo: number
  sin_match: number
  recetas_recalculadas: number
  errores: string[]
  detalle: ResultadoMatch[]
}

// ── Normalización ────────────────────────────────────────────

const STOP_WORDS = /\b(de|del|la|las|los|el|en|con|sin|y|e|o|a|para|por|al|un|una|su|que|es|se|no|lo|le|sus|como|más|entre|todo|esta|son|ser|ni|ha|has|han)\b/gi

function normalizar(nombre: string): string {
  return nombre
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(STOP_WORDS, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function quitarAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Calcula el solapamiento léxico entre dos nombres normalizados.
 * Retorna ratio 0-1 donde 1 = idénticos.
 * Requiere que al menos un token coincida entre ambos.
 */
function ratioSolapamiento(a: string, b: string): number {
  const tokensA = a.split(/\s+/).filter(t => t.length > 1)
  const tokensB = b.split(/\s+/).filter(t => t.length > 1)
  if (tokensA.length === 0 || tokensB.length === 0) return 0

  // Sin acentos para comparación
  const normA = tokensA.map(quitarAcentos)
  const normB = tokensB.map(quitarAcentos)

  const comunes = normA.filter(t => normB.includes(t)).length
  const maxLen = Math.max(normA.length, normB.length)

  return maxLen > 0 ? comunes / maxLen : 0
}

function tokenizar(nombre: string): string[] {
  return nombre.split(/\s+/).filter(t => t.length > 1)
}

// ── FASE 1: Match contra alimentos existentes ────────────────
// ESTRICTAMENTE por solapamiento léxico. NADA de contains bidireccional.

async function fase1_matchAlimentos(
  supabase: SupabaseClient,
  nombre: string,
  alimentosCache: { id: string; nombre: string; calorias: number | null; proteinas: number | null; carbohidratos: number | null; grasas: number | null; fibra: number | null }[]
): Promise<ResultadoMatch | null> {
  const n = normalizar(nombre)
  if (!n || n.length < 2) return null

  const nSinAcentos = quitarAcentos(n)
  const tokensN = tokenizar(n)

  // 1a. Match exacto (normalizado)
  for (const a of alimentosCache) {
    const key = normalizar(a.nombre)
    if (key === n) {
      return { estado: 'match_existente', alimento_id: a.id, alimento_nombre: a.nombre, nombre_libre: nombre, confianza: 'exacta', macros_100g: { calorias: a.calorias ?? 0, proteinas: a.proteinas ?? 0, carbohidratos: a.carbohidratos ?? 0, grasas: a.grasas ?? 0, fibra: a.fibra ?? 0 } }
    }
  }

  // 1b. Match exacto sin acentos
  for (const a of alimentosCache) {
    const key = quitarAcentos(normalizar(a.nombre))
    if (key === nSinAcentos) {
      return { estado: 'match_existente', alimento_id: a.id, alimento_nombre: a.nombre, nombre_libre: nombre, confianza: 'exacta', macros_100g: { calorias: a.calorias ?? 0, proteinas: a.proteinas ?? 0, carbohidratos: a.carbohidratos ?? 0, grasas: a.grasas ?? 0, fibra: a.fibra ?? 0 } }
    }
  }

  // 1c. Solapamiento ALTO (≥60% de tokens en común)
  //     Con validación: si ambos tienen ≥2 tokens, requieren al menos 2 comunes
  let mejorMatch: typeof alimentosCache[0] | null = null
  let mejorRatio = 0

  for (const a of alimentosCache) {
    const key = normalizar(a.nombre)
    const ratio = ratioSolapamiento(n, key)

    if (ratio >= 0.6 && ratio > mejorRatio) {
      // Validación extra: si ambos tienen ≥2 tokens, mínimo 2 comunes
      const tokensB = tokenizar(key)
      const comunes = tokensN.filter(t => tokensB.some(bt => quitarAcentos(bt) === quitarAcentos(t))).length
      if (tokensN.length >= 2 && tokensB.length >= 2 && comunes < 2) continue
      // Validación extra: si uno tiene muchos más tokens que el otro, sospechoso
      // ("patatas" = 1 token, "Patatas fritas sabor chili lima" = 5 tokens → ratio=0.2, OK se filtra)
      mejorMatch = a
      mejorRatio = ratio
    }
  }

  if (mejorMatch && mejorRatio >= 0.6) {
    return {
      estado: 'match_existente',
      alimento_id: mejorMatch.id,
      alimento_nombre: mejorMatch.nombre,
      nombre_libre: nombre,
      confianza: 'alta',
      macros_100g: { calorias: mejorMatch.calorias ?? 0, proteinas: mejorMatch.proteinas ?? 0, carbohidratos: mejorMatch.carbohidratos ?? 0, grasas: mejorMatch.grasas ?? 0, fibra: mejorMatch.fibra ?? 0 }
    }
  }

  // 1d. ILIKE query DIRECTA como respaldo (solo si el nombre tiene ≥3 tokens)
  //     y el match debe tener ≥50% de solapamiento
  if (tokensN.length >= 3) {
    const palabraClave = [...tokensN].sort((a, b) => b.length - a.length).slice(0, 2)
    for (const termino of palabraClave) {
      const { data: ilikeMatches } = await supabase
        .from('alimentos')
        .select('id, nombre, calorias, proteinas, carbohidratos, grasas, fibra')
        .ilike('nombre', `%${termino}%`)
        .limit(10)

      if (ilikeMatches && ilikeMatches.length > 0) {
        for (const candidate of ilikeMatches) {
          const key = normalizar(candidate.nombre)
          const ratio = ratioSolapamiento(n, key)
          if (ratio >= 0.5) {
            return {
              estado: 'match_existente',
              alimento_id: candidate.id,
              alimento_nombre: candidate.nombre,
              nombre_libre: nombre,
              confianza: 'alta',
              macros_100g: { calorias: candidate.calorias ?? 0, proteinas: candidate.proteinas ?? 0, carbohidratos: candidate.carbohidratos ?? 0, grasas: candidate.grasas ?? 0, fibra: candidate.fibra ?? 0 }
            }
          }
        }
      }
    }
  }

  return null
}

// ── FASE 2: Match contra productos_supermercado ──────────────

async function fase2_matchProductos(
  supabase: SupabaseClient,
  nombre: string
): Promise<ResultadoMatch | null> {
  const n = normalizar(nombre)
  const tokensN = tokenizar(n)

  if (tokensN.length === 0) return null

  // Tomar los 2 tokens más largos como términos de búsqueda
  const terminos = [...tokensN].sort((a, b) => b.length - a.length).slice(0, 2)

  for (const termino of terminos) {
    const { data: productos } = await supabase
      .from('productos_supermercado')
      .select('id, nombre_original, alimento_id, marca')
      .not('alimento_id', 'is', null)
      .ilike('nombre_original', `%${termino}%`)
      .limit(5)

    if (productos && productos.length > 0) {
      // Evaluar solapamiento con el nombre del producto
      for (const prod of productos) {
        const prodNorm = normalizar(prod.nombre_original)
        const ratio = ratioSolapamiento(n, prodNorm)
        // Umbral ALTO (0.7) para productos comerciales - evitar falsos positivos
        // como "Vino blanco → Arroz blanco" (ratio 0.5 con solo "blanco" en común)
        if (ratio >= 0.7) {
          // Validación adicional: al menos 2 tokens en común si ambos tienen ≥2 tokens
          if (tokensN.length >= 2 && tokenizar(prodNorm).length >= 2) {
            const tokensB = tokenizar(prodNorm)
            const tokensANorm = tokensN.map(quitarAcentos)
            const tokensBNorm = tokensB.map(quitarAcentos)
            const comunes = tokensANorm.filter(t => tokensBNorm.includes(t)).length
            if (comunes < 2) continue
          }
          const alimentoId = prod.alimento_id
          try {
            const { data: alimento, error: alimErr } = await supabase
              .from('alimentos')
              .select('id, nombre, calorias, proteinas, carbohidratos, grasas, fibra')
              .eq('id', alimentoId)
              .single()

            if (alimErr) {
              console.error(`[FASE2] Error consultando alimento ${alimentoId}: ${alimErr.message}`)
              continue
            }

            if (alimento) {
              return {
                estado: 'match_producto',
                alimento_id: alimento.id,
                alimento_nombre: alimento.nombre,
                nombre_libre: nombre,
                confianza: 'producto',
                macros_100g: { calorias: alimento.calorias ?? 0, proteinas: alimento.proteinas ?? 0, carbohidratos: alimento.carbohidratos ?? 0, grasas: alimento.grasas ?? 0, fibra: alimento.fibra ?? 0 }
              }
            }
          } catch (err) {
            console.error(`[FASE2] Excepción consultando alimento ${alimentoId}:`, err)
            continue
          }
        }
      }
    }
  }

  return null
}

// ── FASE 3: Crear nuevo alimento con datos reales vía IA ─────

const deepseek = createDeepSeek()

function getModeloDeepSeek(): string {
  return process.env.DEEPSEEK_MODEL || 'deepseek-deepseek-chat'
}

async function fase3_crearAlimento(
  supabase: SupabaseClient,
  nombre: string
): Promise<ResultadoMatch> {
  try {
    const prompt = `Eres un nutricionista experto en composición de alimentos con acceso a las bases de datos BEDCA (Base de Datos Española de Composición de Alimentos) y USDA.

Necesito que me proporciones los valores nutricionales REALES y VERIFICABLES para el siguiente alimento. Si existe en BEDCA o USDA, usa sus valores exactos. Si no existe exactamente, busca el equivalente más cercano y menciónalo.

Alimento: "${nombre}"

Responde SOLO con un JSON válido, sin explicaciones, sin markdown:
{
  "nombre_estandar": "nombre estandarizado del alimento (en español, formato BEDCA)",
  "categoria": "categoría nutricional exacta de esta lista: Carnes rojas, Carnes blancas, Pescado azul, Pescado blanco, Mariscos, Huevos, Legumbres, Frutos secos y semillas, Lácteos, Cereales, Verduras y hortalizas, Frutas, Aceites y grasas, Condimentos, Salsas, Bebidas, Suplementos, Otros",
  "calorias": kcal_por_100g,
  "proteinas": proteinas_por_100g,
  "carbohidratos": carbohidratos_por_100g,
  "grasas": grasas_por_100g,
  "fibra": fibra_por_100g,
  "fuente_referencia": "BEDCA|USDA|estimacion_cercana",
  "alimento_referencia": "nombre del alimento de referencia usado (si no es exacto)"
}`

    const { text } = await generateText({
      model: deepseek(getModeloDeepSeek()),
      prompt,
      temperature: 0.1,
      maxOutputTokens: 1000,
    })

    // Extraer JSON del texto
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No se pudo extraer JSON de la respuesta de DeepSeek')

    const data = JSON.parse(jsonMatch[0])

    // Si el alimento de referencia es diferente, usar ese nombre estandarizado
    // pero mantener el nombre_libre original
    const nombreAlimento = data.nombre_estandar || nombre

    // Verificar si ya existe en alimentos (por si se creó entre tanto)
    const { data: existente } = await supabase
      .from('alimentos')
      .select('id, nombre')
      .ilike('nombre', nombreAlimento)
      .maybeSingle()

    if (existente) {
      return {
        estado: 'match_existente',
        alimento_id: existente.id,
        alimento_nombre: existente.nombre,
        nombre_libre: nombre,
        confianza: 'exacta',
        macros_100g: { calorias: data.calorias ?? 0, proteinas: data.proteinas ?? 0, carbohidratos: data.carbohidratos ?? 0, grasas: data.grasas ?? 0, fibra: data.fibra ?? 0 }
      }
    }

    // Crear el alimento nuevo
    const { data: nuevo, error } = await supabase
      .from('alimentos')
      .insert({
        nombre: nombreAlimento,
        categoria: data.categoria || 'Otros',
        calorias: data.calorias ?? 0,
        proteinas: data.proteinas ?? 0,
        carbohidratos: data.carbohidratos ?? 0,
        grasas: data.grasas ?? 0,
        fibra: data.fibra ?? 0,
        custom: false,
        es_generico: true,
        fuente: 'coach',
        fuente_nutricional: data.fuente_referencia === 'BEDCA' ? 'bedca' : 'deepseek',
      })
      .select('id, nombre')
      .single()

    if (error) throw new Error(`Error al crear alimento: ${error.message}`)

    return {
      estado: 'creado_nuevo',
      alimento_id: nuevo.id,
      alimento_nombre: nuevo.nombre,
      nombre_libre: nombre,
      confianza: 'ia_generado',
      macros_100g: { calorias: data.calorias ?? 0, proteinas: data.proteinas ?? 0, carbohidratos: data.carbohidratos ?? 0, grasas: data.grasas ?? 0, fibra: data.fibra ?? 0 }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[FASE3] Error creando alimento para "${nombre}": ${msg}`)
    return {
      estado: 'sin_match',
      alimento_id: null,
      alimento_nombre: null,
      nombre_libre: nombre,
      confianza: 'no_encontrado'
    }
  }
}

// ── Pipeline completo para un ingrediente ────────────────────

export async function autoMatchIngrediente(
  supabase: SupabaseClient,
  nombre_libre: string,
  cantidad_gramos: number | null,
  alimentosCache: { id: string; nombre: string; calorias: number | null; proteinas: number | null; carbohidratos: number | null; grasas: number | null; fibra: number | null }[]
): Promise<ResultadoMatch> {
  // Saltar cabeceras
  if (!nombre_libre || nombre_libre.length < 2 || !cantidad_gramos || cantidad_gramos <= 0) {
    return { estado: 'sin_match', alimento_id: null, alimento_nombre: null, nombre_libre, confianza: 'no_encontrado' }
  }

  // FASE 1: Match contra alimentos existentes
  const fase1 = await fase1_matchAlimentos(supabase, nombre_libre, alimentosCache)
  if (fase1) return fase1

  // FASE 2: Match contra productos_supermercado
  const fase2 = await fase2_matchProductos(supabase, nombre_libre)
  if (fase2) return fase2

  // FASE 3: Crear nuevo alimento con datos reales
  return await fase3_crearAlimento(supabase, nombre_libre)
}

// ── Procesar ingredientes huérfanos de una o más recetas ─────

export async function procesarIngredientesHuerfanos(
  supabase: SupabaseClient,
  recetaIds?: string[]
): Promise<ResultadoProcesar> {
  const result: ResultadoProcesar = {
    total: 0,
    match_existente: 0,
    match_producto: 0,
    creado_nuevo: 0,
    sin_match: 0,
    recetas_recalculadas: 0,
    errores: [],
    detalle: []
  }

  // 1. Obtener ingredientes huérfanos
  let query = supabase
    .from('receta_ingredientes')
    .select('id, receta_id, nombre_libre, cantidad_gramos')
    .is('alimento_id', null)

  if (recetaIds && recetaIds.length > 0) {
    query = query.in('receta_id', recetaIds)
  }

  const { data: orphans, error: e1 } = await query
  if (e1) { result.errores.push(e1.message); return result }

  if (!orphans || orphans.length === 0) {
    console.log('✅ No hay ingredientes huérfanos')
    return result
  }

  result.total = orphans.length
  console.log(`🔍 Procesando ${orphans.length} ingredientes huérfanos...`)

  // 2. Cache de alimentos para matching rápido
  const { data: alimentosCache } = await supabase
    .from('alimentos')
    .select('id, nombre, calorias, proteinas, carbohidratos, grasas, fibra')

  const cache = alimentosCache ?? []

  // 3. Agrupar por nombre_libre para no repetir matches
  const grupos = new Map<string, typeof orphans>()
  for (const o of orphans) {
    const key = (o.nombre_libre || '').toLowerCase().trim()
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(o)
  }

  console.log(`📦 ${grupos.size} nombres únicos para matchear`)

  // 4. Procesar cada grupo
  let idx = 0
  for (const [nombreNorm, records] of grupos) {
    idx++
    const nombreOriginal = records[0].nombre_libre || ''
    const cantidad = records[0].cantidad_gramos

    console.log(`  [${idx}/${grupos.size}] "${nombreOriginal}" (${cantidad}g, ${records.length} ocurrencia(s))`)

    const match = await autoMatchIngrediente(supabase, nombreOriginal, cantidad, cache)

    if (match.alimento_id) {
      // Actualizar TODOS los registros con este nombre
      // IMPORTANTE: NO sobrescribir nombre_libre, preservar el original
      // NOTA: last_matched_at requiere migración SQL, se omite si la columna no existe
      for (const rec of records) {
        const { error: uErr } = await supabase
          .from('receta_ingredientes')
          .update({ alimento_id: match.alimento_id })
          .eq('id', rec.id)

        if (uErr) result.errores.push(`Error actualizando ${rec.id}: ${uErr.message}`)
      }

      // Contar
      if (match.estado === 'match_existente') result.match_existente++
      else if (match.estado === 'match_producto') result.match_producto++
      else if (match.estado === 'creado_nuevo') result.creado_nuevo++

      console.log(`    ✅ ${match.estado} → "${match.alimento_nombre}" (${match.confianza})`)
    } else {
      result.sin_match++
      console.log(`    ❌ Sin match`)
    }

    result.detalle.push(match)
  }

  // 5. Recalcular macros de las recetas afectadas
  const recetaIdsAfectadas = [...new Set(orphans.map(o => o.receta_id))]
  console.log(`\n🔄 Recalculando macros de ${recetaIdsAfectadas.length} recetas...`)

  for (const rid of recetaIdsAfectadas) {
    // Usar la función SQL existente
    const { error: calcErr } = await supabase.rpc('calcular_macros_receta', {
      p_receta_id: rid
    })

    if (calcErr) {
      // Fallback: recalcular manualmente
      await recalcularMacrosManual(supabase, rid)
    }
    result.recetas_recalculadas++
  }

  console.log(`\n✅ Proceso completado:`)
  console.log(`   Match existente: ${result.match_existente}`)
  console.log(`   Match producto:  ${result.match_producto}`)
  console.log(`   Creado nuevo:    ${result.creado_nuevo}`)
  console.log(`   Sin match:       ${result.sin_match}`)
  console.log(`   Errores:         ${result.errores.length}`)

  return result
}

// ── Recalcular macros manualmente (fallback si no existe RPC) ─

async function recalcularMacrosManual(supabase: SupabaseClient, recetaId: string) {
  const { data: receta } = await supabase
    .from('recetas')
    .select('nombre, porciones')
    .eq('id', recetaId)
    .single()

  if (!receta) return

  const { data: ingredientes } = await supabase
    .from('receta_ingredientes')
    .select('alimento_id, cantidad_gramos')
    .eq('receta_id', recetaId)

  if (!ingredientes || ingredientes.length === 0) return

  const alimentoIds = ingredientes.map(i => i.alimento_id).filter(Boolean)
  const { data: alimentos } = await supabase
    .from('alimentos')
    .select('id, calorias, proteinas, carbohidratos, grasas, fibra')
    .in('id', alimentoIds)

  const alimentosMap = new Map((alimentos || []).map(a => [a.id, a]))

  let totalKcal = 0, totalP = 0, totalHC = 0, totalG = 0, totalFib = 0, pesoTotal = 0

  for (const ing of ingredientes) {
    const alim = ing.alimento_id ? alimentosMap.get(ing.alimento_id) : null
    if (alim && ing.cantidad_gramos) {
      const factor = ing.cantidad_gramos / 100
      totalKcal += (alim.calorias || 0) * factor
      totalP += (alim.proteinas || 0) * factor
      totalHC += (alim.carbohidratos || 0) * factor
      totalG += (alim.grasas || 0) * factor
      totalFib += (alim.fibra || 0) * factor
      pesoTotal += ing.cantidad_gramos
    }
  }

  const porciones = receta.porciones || 1

  await supabase
    .from('recetas')
    .update({
      kcal: Math.round((totalKcal / porciones) * 100) / 100,
      proteinas: Math.round((totalP / porciones) * 100) / 100,
      carbohidratos: Math.round((totalHC / porciones) * 100) / 100,
      grasas: Math.round((totalG / porciones) * 100) / 100,
      fibra: Math.round((totalFib / porciones) * 100) / 100,
      kcal_100g: pesoTotal > 0 ? Math.round((totalKcal / pesoTotal) * 100) : null,
      proteinas_100g: pesoTotal > 0 ? Math.round((totalP / pesoTotal) * 100) : null,
      carbohidratos_100g: pesoTotal > 0 ? Math.round((totalHC / pesoTotal) * 100) : null,
      grasas_100g: pesoTotal > 0 ? Math.round((totalG / pesoTotal) * 100) : null,
      fibra_100g: pesoTotal > 0 ? Math.round((totalFib / pesoTotal) * 100) : null,
      peso_total_g: pesoTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recetaId)
}
