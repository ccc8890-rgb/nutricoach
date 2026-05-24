// ================================================================
// AGENTE APRENDIZAJE COLECTIVO
// Extrae patrones anónimos de todos los clientes y los persiste en
// `conocimiento_colectivo` para que futuros planes se beneficien.
//
// Ejecución: mensual (cron 1er día del mes) o bajo demanda.
// Modelo: DeepSeek V3 (análisis estructurado + JSON estricto)
// ================================================================

import { createServiceSupabase } from '@/lib/supabase-server'
import { llamarDeepSeek } from './executor'

export interface PatronColectivo {
  categoria: string         // 'adherencia' | 'perdida_peso' | 'energia' | 'entreno' | 'clinico' | 'recetario'
  patron: string            // Descripción natural del patrón detectado
  condicion_contexto: string // Contexto en que aplica (ej: "objetivo perder_grasa + >4 semanas")
  evidencia_estadistica: string // Número de clientes, % que confirman, etc.
  recomendacion_accion: string  // Qué debe hacer el sistema cuando detecta este patrón
  confianza: number         // 0-1
  n_clientes: number        // Cuántos clientes hay detrás
}

const SYSTEM_PROMPT = `Eres un científico de datos especializado en nutrición deportiva.
Tu tarea es analizar datos anónimos de múltiples clientes y extraer PATRONES GENERALES que
se puedan aplicar a futuros clientes.

TIPOS DE PATRONES A BUSCAR:
1. Adherencia: ¿Qué correlaciona con alta/baja adherencia?
2. Pérdida de peso: ¿Cuándo se estanca? ¿Qué funciona para desbloquearlo?
3. Energía: ¿Qué macros/timing mejoran la energía reportada?
4. Recetario: ¿Qué tipos de recetas tienen más aceptación? ¿Cuáles se rechazan?
5. Clínico: Patrones en clientes con SOP, Hashimoto, atletas de alto volumen

RESTRICCIONES CRÍTICAS:
- Solo patrones que aparezcan en ≥3 clientes distintos
- Nunca mencionar datos individuales — todo es agregado
- Confianza alta (>0.7) solo si ≥5 clientes confirman el patrón
- Formato JSON estricto

FORMATO DE RESPUESTA:
{
  "patrones": [
    {
      "categoria": "adherencia",
      "patron": "descripción del patrón",
      "condicion_contexto": "en qué contexto aplica",
      "evidencia_estadistica": "X/Y clientes, Z% confirmación",
      "recomendacion_accion": "qué hacer cuando se detecta",
      "confianza": 0.75,
      "n_clientes": 5
    }
  ],
  "resumen_ejecutivo": "2-3 frases sobre el hallazgo más importante del mes"
}`

// ── Entrada del agente ────────────────────────────────────────
export async function ejecutarAprendizajeColectivo(): Promise<{
  patrones_extraidos: number
  patrones_actualizados: number
  resumen: string
}> {
  const db = createServiceSupabase()

  // 1. Recopilar datos agregados anónimos
  const datos = await recopilarDatosAgregados(db)
  if (!datos) return { patrones_extraidos: 0, patrones_actualizados: 0, resumen: 'Sin datos suficientes' }

  // 2. Llamar DeepSeek para extraer patrones
  const raw = await llamarDeepSeek(SYSTEM_PROMPT, datos.prompt, 0.2)
  let parsed: { patrones: PatronColectivo[]; resumen_ejecutivo: string }
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[aprendizaje-colectivo] JSON inválido:', raw.slice(0, 200))
    return { patrones_extraidos: 0, patrones_actualizados: 0, resumen: 'Error parseando respuesta IA' }
  }

  if (!Array.isArray(parsed.patrones) || parsed.patrones.length === 0) {
    return { patrones_extraidos: 0, patrones_actualizados: 0, resumen: parsed.resumen_ejecutivo ?? 'Sin patrones nuevos' }
  }

  // 3. Filtrar patrones con confianza mínima y guardar
  const validos = parsed.patrones.filter(p => p.confianza >= 0.5 && p.n_clientes >= 3)
  let actualizados = 0

  for (const patron of validos) {
    const { error } = await db.from('conocimiento_colectivo').upsert(
      {
        categoria: patron.categoria,
        patron: patron.patron,
        condicion_contexto: patron.condicion_contexto,
        evidencia_estadistica: patron.evidencia_estadistica,
        recomendacion_accion: patron.recomendacion_accion,
        confianza: patron.confianza,
        n_clientes_soporte: patron.n_clientes,
        fecha_ultima_validacion: new Date().toISOString().split('T')[0],
        activo: true,
      },
      {
        onConflict: 'categoria,patron',
        ignoreDuplicates: false,
      }
    )
    if (!error) actualizados++
  }

  // 4. Guardar resumen ejecutivo en coach_memoria
  if (parsed.resumen_ejecutivo) {
    await db.from('coach_memoria').upsert(
      {
        categoria: 'metodologia',
        clave: `aprendizaje_colectivo_${new Date().toISOString().slice(0, 7)}`,
        valor: parsed.resumen_ejecutivo,
        contexto: `Análisis mensual de ${datos.n_clientes} clientes activos`,
        ejemplos: [],
        peso: 0.7,
        creado_por: 'agente_aprendizaje',
      },
      { onConflict: 'clave', ignoreDuplicates: false }
    )
  }

  return {
    patrones_extraidos: validos.length,
    patrones_actualizados: actualizados,
    resumen: parsed.resumen_ejecutivo ?? `${actualizados} patrones actualizados`,
  }
}

// ── Construcción del prompt con datos agregados ───────────────
async function recopilarDatosAgregados(
  db: ReturnType<typeof createServiceSupabase>
): Promise<{ prompt: string; n_clientes: number } | null> {
  // Clientes activos con al menos 4 check-ins
  const { data: clientes } = await db
    .from('clientes')
    .select('id, objetivo, sexo, edad')
    .eq('activo', true)

  if (!clientes || clientes.length < 3) return null

  const clienteIds = clientes.map(c => c.id)

  // Checkins de las últimas 8 semanas
  const hace8semanas = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString()
  const { data: checkins } = await db
    .from('checkins')
    .select('cliente_id, peso, adherencia, energia, sueno, fecha')
    .in('cliente_id', clienteIds)
    .gte('created_at', hace8semanas)

  if (!checkins || checkins.length < 20) return null

  // Feedback de recetas (últimas 4 semanas)
  const hace4semanas = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
  const { data: feedbacks } = await db
    .from('receta_feedback')
    .select('cliente_id, tipo, receta_id')
    .in('cliente_id', clienteIds)
    .gte('created_at', hace4semanas)

  // Perfiles de aprendizaje actuales
  const { data: perfiles } = await db
    .from('agente_perfil_cliente')
    .select('cliente_id, nivel_cocina_real, alimentos_rechazados_categorias, adherencia_historica_media, tasa_ejecucion_media')
    .in('cliente_id', clienteIds)

  // ── Agregación anónima ────────────────────────────────────
  const objetivos = agrupar(clientes.map(c => c.objetivo ?? 'desconocido'))
  const edadMedia = media(clientes.map(c => c.edad).filter(Boolean) as number[])

  // Adherencia por semana
  const adherenciasSemana: number[] = []
  const energiasMedia: number[] = []
  let checkinsBajosEnergia = 0
  let checkinsAltosSueno = 0

  for (const c of checkins) {
    if (c.adherencia) adherenciasSemana.push(c.adherencia)
    if (c.energia) {
      energiasMedia.push(c.energia)
      if (c.energia < 5) checkinsBajosEnergia++
    }
    if (c.sueno && c.sueno >= 7) checkinsAltosSueno++
  }

  const adherenciaMediaGlobal = media(adherenciasSemana)
  const energiaMediaGlobal = media(energiasMedia)
  const pctBajaEnergia = checkins.length > 0 ? (checkinsBajosEnergia / checkins.length * 100).toFixed(0) : '0'
  const pctBuenSueno = checkins.length > 0 ? (checkinsAltosSueno / checkins.length * 100).toFixed(0) : '0'

  // Feedback recetas
  const likes = feedbacks?.filter(f => f.tipo === 'like' || f.tipo === 'favorita').length ?? 0
  const dislikes = feedbacks?.filter(f => f.tipo === 'dislike').length ?? 0
  const hechas = feedbacks?.filter(f => f.tipo === 'hecha').length ?? 0

  // Nivel cocina
  const nivelescocina = perfiles?.map(p => p.nivel_cocina_real).filter(Boolean) as number[] ?? []
  const nivelMedio = nivelescocina.length > 0 ? media(nivelescocina).toFixed(1) : 'desconocido'

  // Categorías más rechazadas
  const categoriasRechazadas: Record<string, number> = {}
  for (const p of perfiles ?? []) {
    const rechazadas = p.alimentos_rechazados_categorias as string[] ?? []
    for (const cat of rechazadas) {
      categoriasRechazadas[cat] = (categoriasRechazadas[cat] ?? 0) + 1
    }
  }
  const topRechazadas = Object.entries(categoriasRechazadas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, n]) => `${cat}(${n})`)
    .join(', ')

  const prompt = `DATOS AGREGADOS ANÓNIMOS — ${clientes.length} clientes activos
Fecha análisis: ${new Date().toISOString().split('T')[0]}

=== DEMOGRAFÍA ===
Clientes activos: ${clientes.length}
Edad media: ${edadMedia.toFixed(0)} años
Distribución objetivos: ${JSON.stringify(objetivos)}

=== CHECK-INS (últimas 8 semanas) ===
Total check-ins analizados: ${checkins.length}
Adherencia media global: ${adherenciaMediaGlobal.toFixed(0)}%
Energía media global: ${energiaMediaGlobal.toFixed(1)}/10
% check-ins con energía baja (<5): ${pctBajaEnergia}%
% check-ins con buen sueño (≥7h): ${pctBuenSueno}%

=== RECETARIO (últimas 4 semanas) ===
Total interacciones con recetas: ${(feedbacks?.length ?? 0)}
Likes + favoritas: ${likes}
Dislikes: ${dislikes}
Recetas marcadas "hecha": ${hechas}
Ratio aceptación: ${likes + dislikes > 0 ? (likes / (likes + dislikes) * 100).toFixed(0) : 'N/A'}%
Nivel cocina medio real de clientes: ${nivelMedio}/5
Categorías de alimentos más rechazadas: ${topRechazadas || 'ninguna registrada'}

=== PERFILES DE APRENDIZAJE ===
Clientes con perfil activo: ${perfiles?.length ?? 0}
Adherencia histórica media: ${media((perfiles ?? []).map(p => p.adherencia_historica_media ?? 0)).toFixed(0)}%
Tasa ejecución media recetas: ${media((perfiles ?? []).map(p => p.tasa_ejecucion_media ?? 0)).toFixed(0)}%

Analiza estos datos y extrae los patrones más relevantes y accionables.`

  return { prompt, n_clientes: clientes.length }
}

// ── Helpers ───────────────────────────────────────────────────
function media(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function agrupar(arr: string[]): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, val) => {
    acc[val] = (acc[val] ?? 0) + 1
    return acc
  }, {})
}

// ── Leer patrones vigentes (para inyectar en prompts de plan) ─
export async function obtenerPatronesRelevantes(
  objetivo: string,
  condicionSalud?: string
): Promise<string> {
  const db = createServiceSupabase()

  const { data: patrones } = await db
    .from('conocimiento_colectivo')
    .select('patron, condicion_contexto, recomendacion_accion, confianza')
    .eq('activo', true)
    .gte('confianza', 0.6)
    .order('confianza', { ascending: false })
    .limit(10)

  if (!patrones || patrones.length === 0) return ''

  // Filtrar por relevancia al objetivo/condición
  const relevantes = patrones.filter(p => {
    const ctx = p.condicion_contexto?.toLowerCase() ?? ''
    return (
      ctx.includes(objetivo.toLowerCase()) ||
      ctx.includes('todos') ||
      (condicionSalud && ctx.includes(condicionSalud.toLowerCase()))
    )
  })

  if (relevantes.length === 0) return ''

  return `\n\nCONOCIMIENTO COLECTIVO VALIDADO (${relevantes.length} patrones relevantes):
${relevantes.map(p =>
  `• ${p.patron} → ${p.recomendacion_accion} [confianza: ${(p.confianza * 100).toFixed(0)}%]`
).join('\n')}`
}
