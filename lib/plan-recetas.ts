// lib/plan-recetas.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecetaCandidata, TipoReceta } from '@/types'
import { obtenerPerfilCliente } from '@/lib/agentes/perfil-gusto'

const SLOT_KCAL_PCT: Record<string, [number, number]> = {
  'Desayuno':       [0.20, 0.25],
  'Media mañana':   [0.08, 0.10],
  'Comida':         [0.30, 0.35],
  'Merienda':       [0.08, 0.10],
  'Snack':          [0.08, 0.10],
  'Cena':           [0.25, 0.30],
}

const SLOT_CATEGORIAS: Record<string, string[]> = {
  'Desayuno':      ['Desayuno', 'Gofres', 'Bowls fruta'],
  'Media mañana':  ['Snack', 'Merienda', 'Postres'],
  'Snack':         ['Snack', 'Merienda', 'Postres'],
  'Comida':        ['Comida', 'Platos variados', 'Carnes', 'Pescados', 'Bowls', 'Ensaladas', 'Burritos', 'Fajitas/Tacos', 'Entrante'],
  'Merienda':      ['Merienda', 'Snack', 'Desayuno', 'Postres'],
  'Cena':          ['Cena', 'Comida', 'Platos variados', 'Carnes', 'Pescados', 'Ensaladas'],
}

const SLOT_TIPOS_PERMITIDOS: Record<string, TipoReceta[]> = {
  'Desayuno':      ['desayuno', 'completa'],
  'Media mañana':  ['snack_postre', 'desayuno', 'guarnicion'],
  'Snack':         ['snack_postre', 'desayuno', 'guarnicion'],
  'Comida':        ['completa'],
  'Merienda':      ['snack_postre', 'desayuno'],
  'Cena':          ['completa', 'guarnicion'],
}

function distanciaEuclidiana(
  kcal: number, prot: number,
  targetKcal: number, targetProt: number
): number {
  const dKcal = targetKcal > 0 ? Math.abs(kcal - targetKcal) / targetKcal : 0
  const dProt = targetProt > 0 ? Math.abs(prot - targetProt) / targetProt : 0
  return dKcal + dProt
}

export function calcularTargetSlot(
  slotNombre: string,
  kcalObjetivo: number,
  proteinaObjetivo: number,
  numComidas: number
): { targetKcal: number; targetProt: number } {
  const [min, max] = SLOT_KCAL_PCT[slotNombre] ?? [1 / numComidas, 1 / numComidas]
  const pct = (min + max) / 2
  return {
    targetKcal: Math.round(kcalObjetivo * pct),
    targetProt: Math.round(proteinaObjetivo * pct),
  }
}

interface FiltroCliente {
  restricciones?: string[] | null
  alimentos_evitar_extra?: string[] | string | null
  tiempo_cocina_min?: number | null
  alimentos_base?: string[] | null
}

// Mapeo objetivo → valores apta_cliente aceptados
const OBJETIVO_APTA: Record<string, string[]> = {
  perder_grasa:  ['perdida_grasa', 'general'],
  ganar_musculo: ['ganancia_muscular', 'atleta', 'general'],
  rendimiento:   ['atleta', 'ganancia_muscular', 'general'],
  salud_general: ['general', 'clinica'],
  mantener:      ['mantenimiento', 'general'],
  recomposicion: ['perdida_grasa', 'ganancia_muscular', 'general'],
}

export async function filtrarRecetasPorSlot(
  supabase: SupabaseClient,
  slotNombre: string,
  targetKcal: number,
  targetProt: number,
  filtroCliente: FiltroCliente,
  limit = 6,
  clienteId?: string,
  objetivoCliente?: string,
  tagsClinicosRequeridos?: Partial<Record<'apto_sop' | 'apto_hashimoto' | 'apto_rendimiento' | 'es_post_entreno' | 'es_pre_entreno', boolean>>
): Promise<RecetaCandidata[]> {
  const categorias = SLOT_CATEGORIAS[slotNombre] ?? SLOT_CATEGORIAS['Comida']
  const tiposPermitidos = SLOT_TIPOS_PERMITIDOS[slotNombre] ?? ['completa']
  const restricciones = filtroCliente.restricciones ?? []
  const tiempoMaximo = filtroCliente.tiempo_cocina_min

  // Cargar interacciones recientes del cliente (si hay clienteId)
  const recientesIds = new Set<string>()
  const dislikeIds = new Set<string>()

  if (clienteId) {
    const hace2semanas = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: interacciones } = await supabase
      .from('receta_interacciones_cliente')
      .select('receta_id, tipo')
      .eq('cliente_id', clienteId)
      .or(`tipo.eq.asignada_plan,tipo.eq.dislike`)
      .gte('created_at', hace2semanas)

    for (const i of interacciones ?? []) {
      if (i.tipo === 'dislike') dislikeIds.add(i.receta_id)
      else recientesIds.add(i.receta_id)
    }
  }

  let query = supabase
    .from('recetas')
    .select('id, nombre, kcal, proteinas, carbohidratos, grasas, tiempo_prep_min, tipo_receta, imagen_url, url_origen, intolerancias, score_calidad, recipe_intelligence_score, macro_flex_score, planning_roles, apta_cliente, objetivos, deportes, momentos, estilos, premium_chef, adherencia_score, densidad_energetica, digestibilidad')
    .eq('estado', 'aprobada')
    .gt('kcal', 0)
    .in('categoria', categorias)
    .or(`tipo_receta.is.null,tipo_receta.in.(${tiposPermitidos.join(',')})`)

  if (tiempoMaximo && tiempoMaximo > 0) {
    query = query.or(`tiempo_prep_min.is.null,tiempo_prep_min.lte.${tiempoMaximo}`)
  }

  const { data: recetas } = await query.limit(80)
  if (!recetas || recetas.length === 0) return []

  // Filtro duro: intolerancias
  let candidatas = recetas.filter(r => {
    if (!restricciones.length) return true
    const recetaIntol: string[] = r.intolerancias ?? []
    return !restricciones.some(intol => recetaIntol.includes(intol))
  })

  // Filtro duro: alimentos a evitar
  const evitarRaw = filtroCliente.alimentos_evitar_extra
  const evitarArr: string[] = Array.isArray(evitarRaw)
    ? evitarRaw
    : typeof evitarRaw === 'string' && evitarRaw.trim()
      ? evitarRaw.split(',').map(s => s.trim()).filter(Boolean)
      : []

  if (evitarArr.length > 0) {
    const evitarLower = evitarArr.map(a => a.toLowerCase())
    candidatas = candidatas.filter(r =>
      !evitarLower.some(term => r.nombre.toLowerCase().includes(term))
    )
  }

  // Filtro duro: dislikes del cliente
  candidatas = candidatas.filter(r => !dislikeIds.has(r.id))

  // Filtro blando: score_calidad mínimo (solo si quedan >=3)
  const aptasCalidad = candidatas.filter(r => (r.score_calidad ?? 50) >= 50)
  if (aptasCalidad.length >= 3) candidatas = aptasCalidad

  // Filtro blando: excluir recientes si quedan >=3
  const sinRecientes = candidatas.filter(r => !recientesIds.has(r.id))
  if (sinRecientes.length >= 3) candidatas = sinRecientes

  // Filtro blando: tags clínicos (SOP, Hashimoto, Rendimiento, peri-entreno)
  // Solo se aplica si hay tags requeridos Y quedan >=3 candidatas tras el filtro
  if (tagsClinicosRequeridos && Object.keys(tagsClinicosRequeridos).length > 0) {
    const conTags = candidatas.filter(r => {
      const rec = r as Record<string, unknown>
      return Object.entries(tagsClinicosRequeridos).every(([tag, val]) => rec[tag] === val)
    })
    if (conTags.length >= 3) candidatas = conTags
  }

  // Cargar perfil de gusto del cliente (puede ser null si no hay datos aún)
  const perfilGusto = clienteId ? await obtenerPerfilCliente(clienteId) : null

  // Conjuntos para scoring personalizado
  const recetasPreferidas = new Set<string>(perfilGusto?.recetas_preferidas_ids ?? [])
  const recetasRechazadas = new Set<string>(perfilGusto?.recetas_sistematicamente_rechazadas ?? [])
  const categoriasPreferidas = new Set<string>(perfilGusto?.categorias_preferidas ?? [])
  const nivelCocinaCliente = perfilGusto?.nivel_cocina_real ?? 3
  const confianzaPerfil = perfilGusto?.confianza_perfil ?? 0

  // Filtro duro adicional: recetas sistemáticamente rechazadas (>= 3 dislikes)
  if (recetasRechazadas.size > 0) {
    candidatas = candidatas.filter(r => !recetasRechazadas.has(r.id))
  }

  // Filtro blando: nivel de elaboración vs nivel cocina del cliente
  // nivel_elaboracion: 1=ultrafast, 2=fácil, 3=medio, 4=avanzado, 5=chef
  if (confianzaPerfil > 0.3 && nivelCocinaCliente < 3) {
    const nivelMax = Math.min(5, nivelCocinaCliente + 1) // tolerancia +1
    const porNivel = candidatas.filter(r => {
      const nivel = (r as Record<string, unknown>).nivel_elaboracion as number | undefined
      return nivel === undefined || nivel === null || nivel <= nivelMax
    })
    if (porNivel.length >= 3) candidatas = porNivel
  }

  // Sort score compuesto ARAG (Agentic Retrieval-Augmented Generation)
  const aptasObjetivo = objetivoCliente ? (OBJETIVO_APTA[objetivoCliente] ?? ['general']) : ['general']

  const scored = candidatas.map(r => {
    const rec = r as Record<string, unknown>

    // ── Componente 1: calidad de receta (25%) ─────────────────
    const scoreNorm = ((rec.recipe_intelligence_score as number | undefined) ?? r.score_calidad ?? 60) / 100
    const macroFlexScore = ((rec.macro_flex_score as number | undefined) ?? 55) / 100
    const planningRoles = new Set((rec.planning_roles as string[] | undefined) ?? [])

    // ── Componente 2: proximidad macro objetivo (20%) ─────────
    const dist = distanciaEuclidiana(r.kcal, r.proteinas ?? 0, targetKcal, targetProt)
    const distNorm = Math.min(dist, 2) / 2

    // ── Componente 3: alineación con perfil de gusto (30%) ────
    // Solo pesa si hay confianza de perfil >= 0.2 (mínimo 5 eventos)
    let alineacionPerfil = 0.5 // neutral por defecto
    if (confianzaPerfil >= 0.2) {
      if (recetasPreferidas.has(r.id)) alineacionPerfil = 1.0
      else if (categoriasPreferidas.has((rec.categoria as string) ?? '')) alineacionPerfil = 0.75
      else alineacionPerfil = 0.4

      // Bonus popularidad colectiva (normalizado 0-1)
      const popScore = ((rec.score_popularidad as number) ?? 50) / 100
      alineacionPerfil = alineacionPerfil * 0.7 + popScore * 0.3
    }

    // ── Componente 4: novedad apropiada (15%) ─────────────────
    // Receta nueva (nunca asignada) = ligero bonus; muy popular = ligero malus
    const nAsignada = (rec.n_veces_asignada as number) ?? 0
    const novedadScore = nAsignada === 0 ? 0.8 : nAsignada <= 2 ? 0.6 : 0.4

    // ── Componente 5: tag clínico match + apta_objetivo (10%) ─
    const aptaMatch = r.apta_cliente
      ? aptasObjetivo.includes(r.apta_cliente) ? 1.0
        : r.apta_cliente === 'general' ? 0.5
        : 0.0
      : 0.5

    const objetivosReceta = new Set((r.objetivos ?? []) as string[])
    const objetivoTaxonomia = objetivoCliente
      ? objetivosReceta.has(objetivoCliente) ? 1.0
        : objetivosReceta.has('salud_general') || objetivosReceta.has('mantenimiento') ? 0.5
          : 0.15
      : 0.5

    const adherenciaScore = ((r.adherencia_score ?? 65) / 100)
    const chefHealthyScore = r.premium_chef ? 0.85 : 0.6

    // Pesos ARAG: si hay perfil confiable, usamos los pesos enriquecidos
    // Si no, usamos pesos legacy (calidad + macro + apta)
    let sortScore: number
    if (confianzaPerfil >= 0.2) {
      sortScore =
        scoreNorm      * 0.25 +
        (1 - distNorm) * 0.20 +
        alineacionPerfil * 0.30 +
        novedadScore   * 0.10 +
        Math.max(aptaMatch, objetivoTaxonomia) * 0.10 +
        adherenciaScore * 0.03 +
        macroFlexScore * 0.015 +
        (planningRoles.has('portion_scalable') ? 1 : 0.4) * 0.005
    } else {
      // Legacy weights (sin datos de perfil)
      sortScore =
        scoreNorm * 0.30 +
        Math.max(aptaMatch, objetivoTaxonomia) * 0.30 +
        (1 - distNorm) * 0.25 +
        adherenciaScore * 0.08 +
        macroFlexScore * 0.04 +
        chefHealthyScore * 0.03
    }

    return { ...r, _dist: dist, _sort_score: sortScore }
  })

  return scored
    .sort((a, b) => (b._sort_score ?? 0) - (a._sort_score ?? 0))
    .slice(0, limit)
    .map(({ _dist: _, _sort_score: __, ...r }) => r)
}

interface ComidaDeepSeek {
  nombre: string
  hora?: string
  kcal_target?: number
  proteinas_target?: number
  carbos_target?: number
  grasas_target?: number
  receta_id: string
  receta_nombre: string
  alternativas?: string[]
  notas_peri_entreno?: string
  _receta_corregida?: boolean
}

export interface PlanDeepSeekValidado {
  distribucion_comidas: ComidaDeepSeek[]
  notas_generales?: string
  evidencia_cientifica?: string[]
}

export function validarYResolverRecetas(
  respuestaDS: PlanDeepSeekValidado,
  candidatasPorSlot: Map<string, RecetaCandidata[]>
): PlanDeepSeekValidado {
  for (const comida of respuestaDS.distribucion_comidas) {
    const candidatas = candidatasPorSlot.get(comida.nombre) ?? []
    const idsValidos = new Set(candidatas.map(r => r.id))

    if (!idsValidos.has(comida.receta_id)) {
      comida.receta_id = candidatas[0]?.id ?? ''
      comida.receta_nombre = candidatas[0]?.nombre ?? comida.receta_nombre
      comida._receta_corregida = true
    }

    const alternativasValidas = (comida.alternativas ?? [])
      .filter(id => idsValidos.has(id))
      .filter(id => id !== comida.receta_id)

    const usadas = new Set([comida.receta_id, ...alternativasValidas])
    for (const r of candidatas) {
      if (alternativasValidas.length >= 2) break
      if (!usadas.has(r.id)) {
        alternativasValidas.push(r.id)
        usadas.add(r.id)
      }
    }

    comida.alternativas = alternativasValidas
  }

  return respuestaDS
}

export function calcularFactorGramaje(
  recetaKcal: number,
  targetKcal: number
): number | null {
  if (recetaKcal <= 0) return null
  const factor = targetKcal / recetaKcal
  if (factor > 1.6 || factor < 0.55) return null
  return factor
}

export function esPlataCompleto(
  roles: Array<string | null | undefined>,
  kcal?: number
): boolean {
  const tieneProteina = roles.some(r => r === 'proteina_principal')
  const tieneCarbOVerdura = roles.some(r =>
    r === 'carbohidrato_base' || r === 'verdura_volumen'
  )
  return tieneProteina && tieneCarbOVerdura && (kcal === undefined || kcal >= 200)
}
