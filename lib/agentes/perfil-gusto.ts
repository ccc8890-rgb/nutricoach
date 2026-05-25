/**
 * lib/agentes/perfil-gusto.ts
 *
 * AgentePerfilGusto — el "inconsciente" del sistema.
 *
 * Observa TODO lo que hace el cliente (check-ins, recetas hechas/no hechas,
 * feedback explícito, pesos, energía) y destila un perfil semántico creciente.
 * Cada semana el perfil se vuelve más preciso. Nunca descarta datos.
 *
 * Principios de diseño:
 * - No inventa: solo infiere de señales observables
 * - Bayesiano: confianza baja al inicio, alta con muchos datos
 * - Nunca sobreescribe certezas: si algo lleva 8 semanas funcionando, no lo toca
 * - Cross-cliente: detecta patrones anónimos y los eleva a conocimiento_colectivo
 */

import { createServiceSupabase } from '@/lib/supabase-server'
import { llamarGemini } from './executor'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── TIPOS ─────────────────────────────────────────────────────────────

export interface PerfilCliente {
  id: string
  cliente_id: string
  proteinas_favoritas: string[]
  texturas_favoritas: string[]
  categorias_favoritas: string[]
  categorias_preferidas: string[]           // alias exportado de categorias_favoritas
  ingredientes_evitar: string[]
  categorias_evitar: string[]
  alimentos_rechazados_categorias: string[] // alias exportado de categorias_evitar
  aversiones_blandas: string[]
  mejor_dia_semana: string | null
  peor_dia_semana: string | null
  adherencia_promedio_30d: number | null
  adherencia_historica_media: number | null // alias exportado de adherencia_promedio_30d
  nivel_cocina_real: number
  nivel_cocina_declarado: number
  novedad_deseada: number
  semanas_misma_receta: number
  ultimas_recetas_ids: string[]
  recetas_preferidas_ids: string[]          // recetas con likes/favorita
  recetas_sistematicamente_rechazadas: string[] // recetas con ≥3 dislikes
  flags_activos: string[]
  condicion_hormonal: string | null
  semanas_con_mejora: number
  semanas_sin_mejora: number
  n_eventos_total: number
  confianza_perfil: number
  version: number
  // Campos de síntesis IA
  preferencia_mealprep: boolean
  hora_pico_hambre: string | null
  patron_abandono: string | null
  respuesta_proteina: string
  sensibilidad_cho: string
  tasa_ejecucion_media: number | null
}

interface RecetaFeedback {
  receta_id: string
  tipo: string
  slot: string | null
  created_at: string
  recetas?: { nombre: string; categoria: string; nivel_elaboracion: number; proteinas: number; kcal: number }
}

interface Checkin {
  peso_kg: number | null
  adherencia_pct: number | null
  energia: number | null
  sueno: number | null
  created_at: string
}

interface ContextoCliente {
  perfil_existente: PerfilCliente | null
  feedbacks_recientes: RecetaFeedback[]
  checkins_recientes: Checkin[]
  semana_actual: number
    onboarding: { nivel_cocina?: number | string; restricciones?: string[]; objetivo?: string }
  plan_activo_recetas: { nombre: string; slot: string; nivel_elaboracion: number; es_apta_mealprep: boolean }[]
}

// ─── CARGA DE CONTEXTO ──────────────────────────────────────────────────

async function cargarContexto(supabase: SupabaseClient, clienteId: string): Promise<ContextoCliente> {
  const hace8semanas = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString()
  const hace4semanas = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()

  const [perfilRes, feedbackRes, checkinRes, onboardingRes, planRes, onboardingDateRes] = await Promise.all([
    supabase.from('agente_perfil_cliente').select('*').eq('cliente_id', clienteId).maybeSingle(),
    supabase
      .from('receta_interacciones_cliente')
      .select('receta_id, tipo, comida_slot, created_at, recetas(nombre, categoria, nivel_elaboracion, proteinas, kcal)')
      .eq('cliente_id', clienteId)
      .gte('created_at', hace8semanas)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('checkins')
      .select('peso_kg, adherencia_pct, energia, sueno, created_at')
      .eq('cliente_id', clienteId)
      .gte('created_at', hace4semanas)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('onboarding_responses')
      .select('nivel_cocina, restricciones, objetivo')
      .eq('cliente_id', clienteId)
      .maybeSingle(),
    supabase
      .from('planes_nutricion')
      .select('id, comidas(nombre, receta_id, recetas(nivel_elaboracion, es_apta_mealprep))')
      .eq('cliente_id', clienteId)
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('clientes').select('created_at').eq('id', clienteId).single(),
  ])

  // Calcular semana del cliente desde onboarding
  const clienteCreado = onboardingDateRes.data?.created_at ? new Date(onboardingDateRes.data.created_at) : new Date()
  const semanaActual = Math.floor((Date.now() - clienteCreado.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1

  return {
    perfil_existente: perfilRes.data as PerfilCliente | null,
    feedbacks_recientes: ((feedbackRes.data ?? []) as unknown as Array<RecetaFeedback & { comida_slot?: string | null }>).map(f => ({
      ...f,
      tipo: f.tipo === 'asignada_plan' ? 'asignada' : f.tipo,
      slot: f.slot ?? f.comida_slot ?? null,
    })),
    checkins_recientes: (checkinRes.data ?? []) as Checkin[],
    semana_actual: semanaActual,
    onboarding: onboardingRes.data ?? {},
    plan_activo_recetas: (((planRes.data?.[0]?.comidas ?? []) as Record<string, unknown>[]).map(c => ({
      nombre: c.nombre as string,
      slot: c.nombre as string,
      nivel_elaboracion: ((c.recetas as Record<string, unknown> | null)?.nivel_elaboracion as number) ?? 2,
      es_apta_mealprep: ((c.recetas as Record<string, unknown> | null)?.es_apta_mealprep as boolean) ?? false,
    }))),
  }
}

// ─── ANÁLISIS DETERMINÍSTICO (sin IA) ──────────────────────────────────

function analizarFeedbacks(ctx: ContextoCliente) {
  const negativos = ctx.feedbacks_recientes.filter(f =>
    ['dislike', 'no_me_gusto', 'muy_dificil', 'no_tenia_ingredientes', 'cambiada_por_alternativa'].includes(f.tipo)
  )
  const positivos = ctx.feedbacks_recientes.filter(f =>
    ['like', 'favorita', 'repetir_siempre', 'foto_subida', 'hecha'].includes(f.tipo)
  )

  // Categorías más rechazadas
  const categorias_rechazadas: Record<string, number> = {}
  const ingredientes_rechazados: Record<string, number> = {}
  const niveles_rechazados: Record<number, number> = {}

  for (const f of negativos) {
    const r = f.recetas
    if (!r) continue
    categorias_rechazadas[r.categoria] = (categorias_rechazadas[r.categoria] ?? 0) + 1
    niveles_rechazados[r.nivel_elaboracion] = (niveles_rechazados[r.nivel_elaboracion] ?? 0) + 1
  }

  // Categorías más gustadas
  const categorias_gustadas: Record<string, number> = {}
  for (const f of positivos) {
    const r = f.recetas
    if (!r) continue
    categorias_gustadas[r.categoria] = (categorias_gustadas[r.categoria] ?? 0) + 1
  }

  // Nivel cocina real: máximo nivel que ha hecho sin quejarse
  const nivelesHechos = ctx.feedbacks_recientes
    .filter(f => f.tipo === 'hecha')
    .map(f => f.recetas?.nivel_elaboracion ?? 2)
  const nivelDeclarado = normalizarNivelCocina(ctx.onboarding.nivel_cocina)
  const nivelMaxHecho = nivelesHechos.length > 0 ? Math.max(...nivelesHechos) : nivelDeclarado

  // Adherencia promedio
  const adherencias = ctx.checkins_recientes.map(c => c.adherencia_pct ?? 0).filter(a => a > 0)
  const adherenciaPromedio = adherencias.length > 0
    ? adherencias.reduce((a, b) => a + b, 0) / adherencias.length
    : null

  // Patrón de días (día de la semana con mejor adherencia)
  const diasAdherencia: Record<string, number[]> = {}
  for (const c of ctx.checkins_recientes) {
    if (c.adherencia_pct == null) continue
    const dia = new Date(c.created_at).toLocaleDateString('es-ES', { weekday: 'long' })
    if (!diasAdherencia[dia]) diasAdherencia[dia] = []
    diasAdherencia[dia].push(c.adherencia_pct)
  }
  const promediosDias = Object.entries(diasAdherencia).map(([dia, vals]) => ({
    dia,
    promedio: vals.reduce((a, b) => a + b, 0) / vals.length,
  }))
  const mejorDia = promediosDias.sort((a, b) => b.promedio - a.promedio)[0]?.dia ?? null
  const peorDia = promediosDias.sort((a, b) => a.promedio - b.promedio)[0]?.dia ?? null

  // Tendencia de peso (mejora o no)
  const pesos = ctx.checkins_recientes.map(c => c.peso_kg).filter(Boolean) as number[]
  let semanasConMejora = ctx.perfil_existente?.semanas_con_mejora ?? 0
  let semanasSinMejora = ctx.perfil_existente?.semanas_sin_mejora ?? 0

  if (pesos.length >= 2) {
    const tendencia = pesos[0] - pesos[pesos.length - 1] // positivo = perdió peso
    if (tendencia > 0.2) semanasConMejora += 1
    else if (tendencia < -0.1) semanasSinMejora += 1
  }

  return {
    categorias_rechazadas,
    ingredientes_rechazados,
    categorias_gustadas,
    niveles_rechazados,
    nivel_cocina_real: Math.min(nivelMaxHecho + 1, 5), // puede intentar un nivel más
    adherencia_promedio: adherenciaPromedio,
    mejor_dia: mejorDia,
    peor_dia: peorDia,
    semanas_con_mejora: semanasConMejora,
    semanas_sin_mejora: semanasSinMejora,
    n_positivos: positivos.length,
    n_negativos: negativos.length,
  }
}

// ─── SÍNTESIS CON IA (solo si hay suficientes datos) ───────────────────

async function sintetizarConIA(
  clienteId: string,
  ctx: ContextoCliente,
  analisis: ReturnType<typeof analizarFeedbacks>
): Promise<Partial<PerfilCliente>> {
  // Con <5 eventos no merece la pena la síntesis IA — usar solo determinístico
  if (ctx.feedbacks_recientes.length < 5 && ctx.checkins_recientes.length < 3) {
    return {}
  }

  const prompt = `Eres un psicólogo nutricional analizando el comportamiento alimentario de un cliente.
Analiza estos datos y extrae patrones de comportamiento NO OBVIOS.

FEEDBACKS RECIENTES (${ctx.feedbacks_recientes.length} eventos):
${ctx.feedbacks_recientes.slice(0, 30).map(f => `  ${f.tipo}: ${f.recetas?.nombre ?? 'desconocida'} (${f.recetas?.categoria}, nivel ${f.recetas?.nivel_elaboracion})`).join('\n')}

CHECK-INS (${ctx.checkins_recientes.length} semanas):
${ctx.checkins_recientes.map(c => `  Adherencia: ${c.adherencia_pct}% | Energía: ${c.energia}/10 | Sueño: ${c.sueno}/10`).join('\n')}

ANÁLISIS DETERMINÍSTICO YA CALCULADO:
- Categorías más rechazadas: ${JSON.stringify(analisis.categorias_rechazadas)}
- Categorías más gustadas: ${JSON.stringify(analisis.categorias_gustadas)}
- Niveles elaboración rechazados: ${JSON.stringify(analisis.niveles_rechazados)}
- Adherencia promedio: ${analisis.adherencia_promedio?.toFixed(0) ?? 'sin datos'}%
- Nivel cocina real estimado: ${analisis.nivel_cocina_real}/5

Responde SOLO JSON con estos campos (omite los que no puedas inferir con seguridad):
{
  "proteinas_favoritas": ["proteína1", "proteína2"],
  "texturas_favoritas": ["textura1"],
  "categorias_favoritas": ["categoria1"],
  "aversiones_blandas": ["ingrediente o categoría a evitar sin ser duro"],
  "hora_pico_hambre": "mañana|tarde|noche|null",
  "patron_abandono": "descripción del patrón de fallo o null",
  "preferencia_mealprep": true|false,
  "novedad_deseada": 0.0-1.0,
  "respuesta_proteina": "alta|normal|baja",
  "sensibilidad_cho": "alta|normal|baja",
  "insights_adicionales": "observación no obvia más relevante o null"
}`

  const resultado = await llamarGemini(prompt, 0.2)
  try {
    return JSON.parse(resultado) as Partial<PerfilCliente>
  } catch {
    return {}
  }
}

// ─── FUNCIÓN PRINCIPAL ─────────────────────────────────────────────────

export async function actualizarPerfilGusto(clienteId: string): Promise<{
  actualizado: boolean
  confianza: number
  cambios: string[]
}> {
  const supabase = createServiceSupabase()
  const ctx = await cargarContexto(supabase, clienteId)
  const analisis = analizarFeedbacks(ctx)

  // Síntesis IA solo si hay datos suficientes
  const sintesisIA = await sintetizarConIA(clienteId, ctx, analisis)

  const perfil_previo = ctx.perfil_existente
  const n_eventos = ctx.feedbacks_recientes.length + ctx.checkins_recientes.length
  const n_eventos_total = Math.max(perfil_previo?.n_eventos_total ?? 0, n_eventos)

  // Confianza del perfil: crece logarítmicamente con los eventos
  // 10 eventos = 0.30, 50 eventos = 0.60, 200 eventos = 0.85
  const confianza = Math.min(0.95, Math.log10(Math.max(n_eventos_total, 1) + 1) / Math.log10(201))

  // Categorías a evitar (threshold: rechazada ≥3 veces)
  const nuevas_categorias_evitar = Object.entries(analisis.categorias_rechazadas)
    .filter(([, n]) => n >= 3)
    .map(([cat]) => cat)

  // Categorías favoritas (threshold: gustada ≥2 veces)
  const nuevas_categorias_favoritas = Object.entries(analisis.categorias_gustadas)
    .filter(([, n]) => n >= 2)
    .map(([cat]) => cat)

  // Últimas recetas asignadas (para evitar repetición)
  const ultimas_recetas = ctx.feedbacks_recientes
    .filter(f => f.tipo === 'asignada')
    .slice(0, 20)
    .map(f => f.receta_id)

  // Recetas preferidas y sistematicamente rechazadas
  const recetasPreferidas = ctx.feedbacks_recientes
    .filter(f => ['like', 'favorita', 'repetir_siempre', 'foto_subida'].includes(f.tipo))
    .map(f => f.receta_id)

  const recetasDislikes: Record<string, number> = {}
  for (const f of ctx.feedbacks_recientes) {
    if (['dislike', 'no_me_gusto'].includes(f.tipo)) {
      recetasDislikes[f.receta_id] = (recetasDislikes[f.receta_id] ?? 0) + 1
    }
  }
  const recetasRechazadas = Object.entries(recetasDislikes)
    .filter(([, n]) => n >= 3)
    .map(([id]) => id)

  // Merge con perfil previo (sin perder datos históricos)
  const categorias_favoritas_merged = mergeArrays(perfil_previo?.categorias_favoritas, nuevas_categorias_favoritas)
  const categorias_evitar_merged = mergeArrays(perfil_previo?.categorias_evitar, nuevas_categorias_evitar)

  const perfilActualizado = {
    cliente_id: clienteId,
    proteinas_favoritas: mergeArrays(perfil_previo?.proteinas_favoritas, sintesisIA.proteinas_favoritas),
    texturas_favoritas: mergeArrays(perfil_previo?.texturas_favoritas, sintesisIA.texturas_favoritas),
    categorias_favoritas: categorias_favoritas_merged,
    ingredientes_evitar: mergeArrays(perfil_previo?.ingredientes_evitar, sintesisIA.ingredientes_evitar),
    categorias_evitar: categorias_evitar_merged,
    aversiones_blandas: mergeArrays(perfil_previo?.aversiones_blandas, sintesisIA.aversiones_blandas),
    mejor_dia_semana: analisis.mejor_dia ?? perfil_previo?.mejor_dia_semana,
    peor_dia_semana: analisis.peor_dia ?? perfil_previo?.peor_dia_semana,
    adherencia_promedio_30d: analisis.adherencia_promedio ?? perfil_previo?.adherencia_promedio_30d,
    nivel_cocina_declarado: normalizarNivelCocina(ctx.onboarding.nivel_cocina ?? perfil_previo?.nivel_cocina_declarado),
    nivel_cocina_real: calibrarNivelCocina(analisis.nivel_cocina_real, analisis.niveles_rechazados, perfil_previo?.nivel_cocina_real ?? 2),
    preferencia_mealprep: sintesisIA.preferencia_mealprep ?? perfil_previo?.preferencia_mealprep ?? false,
    novedad_deseada: calcularNovedadDeseada(analisis, perfil_previo),
    semanas_misma_receta: calcularSemanasMismaReceta(ctx, perfil_previo),
    ultimas_recetas_ids: ultimas_recetas,
    semanas_con_mejora: analisis.semanas_con_mejora,
    semanas_sin_mejora: analisis.semanas_sin_mejora,
    hora_pico_hambre: sintesisIA.hora_pico_hambre ?? perfil_previo?.hora_pico_hambre,
    patron_abandono: sintesisIA.patron_abandono ?? perfil_previo?.patron_abandono,
    respuesta_proteina: sintesisIA.respuesta_proteina ?? perfil_previo?.respuesta_proteina ?? 'normal',
    sensibilidad_cho: sintesisIA.sensibilidad_cho ?? perfil_previo?.sensibilidad_cho ?? 'normal',
    n_eventos_total,
    confianza_perfil: parseFloat(confianza.toFixed(3)),
    version: (perfil_previo?.version ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }

  // Registrar en memoria episódica el evento de actualización
  await supabase.from('agente_memoria_episodica').insert({
    cliente_id: clienteId,
    tipo: 'perfil_actualizado',
    payload: {
      version: perfilActualizado.version,
      confianza: perfilActualizado.confianza_perfil,
      n_eventos_procesados: n_eventos,
      cambios_detectados: detectarCambios(perfil_previo, perfilActualizado),
    },
    relevancia: 0.4,
    semana_numero: ctx.semana_actual,
  })

  const { data: perfilGuardado, error: guardarError } = perfil_previo
    ? await supabase
        .from('agente_perfil_cliente')
        .update(perfilActualizado)
        .eq('cliente_id', clienteId)
        .select('id')
        .maybeSingle()
    : await supabase
        .from('agente_perfil_cliente')
        .insert(perfilActualizado)
        .select('id')
        .maybeSingle()

  if (guardarError || !perfilGuardado) {
    throw new Error(`No se pudo guardar agente_perfil_cliente: ${guardarError?.message ?? 'sin fila devuelta'}`)
  }

  // Actualizar stats de popularidad en recetas (fire-and-forget)
  actualizarPopularidadRecetas(supabase).catch(() => {})

  const cambios = detectarCambios(perfil_previo, perfilActualizado)
  return { actualizado: true, confianza, cambios }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────

function mergeArrays(existente?: string[], nuevo?: string[]): string[] {
  if (!existente && !nuevo) return []
  const combined = [...(existente ?? []), ...(nuevo ?? [])]
  return [...new Set(combined)].slice(0, 20) // máximo 20 items
}

function normalizarNivelCocina(valor: number | string | null | undefined): number {
  if (typeof valor === 'number' && Number.isFinite(valor)) return Math.max(1, Math.min(5, Math.round(valor)))
  const v = String(valor ?? '').toLowerCase()
  if (['no_cocina', 'muy_simple', 'basico', 'principiante'].some(x => v.includes(x))) return 1
  if (['simple', 'facil', 'fácil'].some(x => v.includes(x))) return 2
  if (['intermedio', 'normal'].some(x => v.includes(x))) return 3
  if (['avanzado'].some(x => v.includes(x))) return 4
  if (['chef', 'experto'].some(x => v.includes(x))) return 5
  return 2
}

function calibrarNivelCocina(
  nivelCalculado: number,
  nivelesRechazados: Record<number, number>,
  nivelPrevio: number
): number {
  // Si rechazó nivel 3+ frecuentemente, bajar estimación
  const rechazos3Plus = (nivelesRechazados[3] ?? 0) + (nivelesRechazados[4] ?? 0) + (nivelesRechazados[5] ?? 0)
  if (rechazos3Plus >= 3) return Math.min(nivelCalculado, 2)
  // No bajar más de 1 nivel respecto al previo para evitar oscilaciones
  return Math.max(nivelPrevio - 1, Math.min(nivelCalculado, nivelPrevio + 1))
}

function calcularNovedadDeseada(
  analisis: ReturnType<typeof analizarFeedbacks>,
  previo: PerfilCliente | null
): number {
  const base = previo?.novedad_deseada ?? 0.4
  // Si muchas semanas con las mismas recetas y buena adherencia → subir novedad
  if ((previo?.semanas_misma_receta ?? 0) >= 3 && (analisis.adherencia_promedio ?? 0) > 75) {
    return Math.min(base + 0.1, 0.8)
  }
  // Si rechaza muchas recetas nuevas → bajar novedad (prefiere zona de confort)
  if (analisis.n_negativos > analisis.n_positivos * 1.5) {
    return Math.max(base - 0.1, 0.2)
  }
  return base
}

function calcularSemanasMismaReceta(ctx: ContextoCliente, previo: PerfilCliente | null): number {
  const recetasEstasSemana = new Set(ctx.feedbacks_recientes.filter(f => f.tipo === 'asignada').map(f => f.receta_id))
  const recetasSemanaAnterior = new Set(previo?.ultimas_recetas_ids?.slice(0, 10) ?? [])
  const overlap = [...recetasEstasSemana].filter(id => recetasSemanaAnterior.has(id)).length
  const pctOverlap = recetasEstasSemana.size > 0 ? overlap / recetasEstasSemana.size : 0
  if (pctOverlap > 0.7) return (previo?.semanas_misma_receta ?? 0) + 1
  return 0
}

function detectarCambios(previo: PerfilCliente | null, nuevo: Record<string, unknown>): string[] {
  if (!previo) return ['perfil_creado']
  const cambios: string[] = []
  if ((nuevo.nivel_cocina_real as number) !== previo.nivel_cocina_real) {
    cambios.push(`nivel_cocina: ${previo.nivel_cocina_real}→${nuevo.nivel_cocina_real}`)
  }
  if (Math.abs((nuevo.novedad_deseada as number) - previo.novedad_deseada) > 0.05) {
    cambios.push(`novedad: ${previo.novedad_deseada.toFixed(2)}→${(nuevo.novedad_deseada as number).toFixed(2)}`)
  }
  if ((nuevo.categorias_evitar as string[]).length > previo.categorias_evitar.length) {
    cambios.push(`nuevas_aversiones: ${(nuevo.categorias_evitar as string[]).join(',')}`)
  }
  return cambios
}

async function actualizarPopularidadRecetas(supabase: SupabaseClient): Promise<void> {
  // Recalcular score_popularidad para recetas con actividad reciente
  const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: activas } = await supabase
    .from('receta_interacciones_cliente')
    .select('receta_id')
    .gte('created_at', hace30dias)
    .in('tipo', ['like', 'favorita', 'swap_elegida', 'asignada_plan'])

  const recetasConActividad = [...new Set((activas ?? []).map(r => r.receta_id))]
  if (recetasConActividad.length === 0) return

  for (const recetaId of recetasConActividad) {
    const { data: stats } = await supabase
      .from('receta_interacciones_cliente')
      .select('tipo')
      .eq('receta_id', recetaId)

    const pesos: Record<string, number> = {
      favorita: 3,
      like: 1.5,
      swap_elegida: 1.2,
      asignada_plan: 0.2,
      swap_rechazada: -1.5,
      dislike: -2,
    }
    const score = (stats ?? []).reduce((acc, s) => acc + (pesos[s.tipo] ?? 0), 0)
    const scoreClamped = Math.max(0, Math.min(10, score))

    await supabase
      .from('recetas')
      .update({
        score_popularidad: scoreClamped,
        n_veces_asignada: (stats ?? []).filter(s => s.tipo === 'asignada_plan').length,
        n_veces_hecha: (stats ?? []).filter(s => s.tipo === 'swap_elegida').length,
        n_dislikes: (stats ?? []).filter(s => ['dislike', 'swap_rechazada'].includes(s.tipo)).length,
      })
      .eq('id', recetaId)
  }
}

// ─── EXPORTAR perfil para uso en otros agentes ─────────────────────────

export async function obtenerPerfilCliente(clienteId: string): Promise<PerfilCliente | null> {
  const supabase = createServiceSupabase()
  const { data } = await supabase
    .from('agente_perfil_cliente')
    .select('*')
    .eq('cliente_id', clienteId)
    .maybeSingle()
  if (!data) return null
  const perfil = data as PerfilCliente

  const { data: interacciones } = await supabase
    .from('receta_interacciones_cliente')
    .select('receta_id, tipo')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
    .limit(200)

  const preferidas = new Set<string>()
  const dislikes: Record<string, number> = {}
  for (const i of interacciones ?? []) {
    if (['like', 'favorita'].includes(i.tipo)) preferidas.add(i.receta_id)
    if (['dislike', 'swap_rechazada'].includes(i.tipo)) {
      dislikes[i.receta_id] = (dislikes[i.receta_id] ?? 0) + 1
    }
  }

  return {
    ...perfil,
    categorias_preferidas: perfil.categorias_favoritas ?? [],
    alimentos_rechazados_categorias: perfil.categorias_evitar ?? [],
    adherencia_historica_media: perfil.adherencia_promedio_30d,
    tasa_ejecucion_media: null,
    recetas_preferidas_ids: [...preferidas],
    recetas_sistematicamente_rechazadas: Object.entries(dislikes)
      .filter(([, n]) => n >= 3)
      .map(([id]) => id),
  }
}
