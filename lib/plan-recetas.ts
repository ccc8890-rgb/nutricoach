// lib/plan-recetas.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { RESTRICCION_A_ALERGENO, RESTRICCION_A_TAG_POSITIVO, RESTRICCION_A_EVITAR, expandirEvitar } from '@/lib/nutricion/compatibilidad-receta'
import type { RecetaCandidata, TipoReceta } from '@/types'
import { obtenerPerfilCliente } from '@/lib/agentes/perfil-gusto'
import { ajusteClinico, reglasClinicas } from '@/lib/nutricion/reglas-clinicas'
import { afinidadHabitual, cargarPreferencias, lleva, type PreferenciasCliente } from '@/lib/nutricion/preferencias-cliente'
import { inferirMomentoDesdeTipo, requiereMomentoExacto, scoreRecetaParaAgente } from '@/lib/recetario-taxonomia'

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
  // Una guarnición no es un plato: va como complemento de una comida o cena (lib/nutricion/completar-comidas.ts)
  // `completa` también: muchas meriendas reales (wraps, batidos, bagels, bowls) están guardadas como receta completa
  // de categoría Merienda/Snack y quedaban fuera, dejando ~7 candidatas para toda la semana
  'Media mañana':  ['snack_postre', 'desayuno', 'completa'],
  'Snack':         ['snack_postre', 'desayuno', 'completa'],
  'Comida':        ['completa'],
  'Merienda':      ['snack_postre', 'desayuno', 'completa'],
  'Cena':          ['completa'],
}

// Distancia normalizada a los macros objetivo. Antes solo comparaba
// kcal+proteína, así que dos recetas con las mismas kcal pero ratios de
// carbohidrato/grasa opuestos puntuaban igual — el plan final podía
// desviarse ~40% en carbohidratos aunque las kcal totales cuadraran casi
// exactas. Ahora promedia solo los macros con target > 0 (retrocompatible:
// si no se pasan targetCarb/targetGrasa, se comporta igual que antes).
function distanciaEuclidiana(
  kcal: number, prot: number, carb: number, grasa: number,
  targetKcal: number, targetProt: number, targetCarb?: number, targetGrasa?: number
): number {
  const dKcal = targetKcal > 0 ? Math.abs(kcal - targetKcal) / targetKcal : 0
  const dProt = targetProt > 0 ? Math.abs(prot - targetProt) / targetProt : 0
  const dCarb = targetCarb && targetCarb > 0 ? Math.abs(carb - targetCarb) / targetCarb : 0
  const dGrasa = targetGrasa && targetGrasa > 0 ? Math.abs(grasa - targetGrasa) / targetGrasa : 0
  const terminos = 2 + (targetCarb && targetCarb > 0 ? 1 : 0) + (targetGrasa && targetGrasa > 0 ? 1 : 0)
  return (dKcal + dProt + dCarb + dGrasa) * (2 / terminos)
}

export function calcularTargetSlot(
  slotNombre: string,
  kcalObjetivo: number,
  proteinaObjetivo: number,
  numComidas: number,
  carbohidratoObjetivo?: number,
  grasaObjetivo?: number
): { targetKcal: number; targetProt: number; targetCarb?: number; targetGrasa?: number } {
  const [min, max] = SLOT_KCAL_PCT[slotNombre] ?? [1 / numComidas, 1 / numComidas]
  const pct = (min + max) / 2
  return {
    targetKcal: Math.round(kcalObjetivo * pct),
    targetProt: Math.round(proteinaObjetivo * pct),
    targetCarb: carbohidratoObjetivo ? Math.round(carbohidratoObjetivo * pct) : undefined,
    targetGrasa: grasaObjetivo ? Math.round(grasaObjetivo * pct) : undefined,
  }
}

interface FiltroCliente {
  restricciones?: string[] | null
  alimentos_evitar_extra?: string[] | string | null
  tiempo_cocina_min?: number | null
  alimentos_base?: string[] | null
  // Texto libre del cuestionario: de aquí salen las reglas clínicas (dislipidemia, hipertensión, diabetes, anemia)
  condiciones_salud?: string | null
}

// Candidatas mínimas para que una semana (7 días) no repita: los filtros blandos no deben dejar menos
const POOL_SEMANA = 7

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
  tagsClinicosRequeridos?: Partial<Record<'apto_sop' | 'apto_hashimoto' | 'apto_rendimiento' | 'es_post_entreno' | 'es_pre_entreno', boolean>>,
  deporteCliente?: string | null,
  // Añadidos al final (retrocompatible con llamadas posicionales previas).
  // Sin esto, la selección solo comparaba kcal+proteína: una receta con las
  // kcal correctas pero carbohidratos/grasas invertidos puntuaba igual que
  // una bien equilibrada, y el plan final podía desviarse ~40% en
  // carbohidratos aunque las kcal cuadraran.
  targetCarb?: number,
  targetGrasa?: number,
  // La consulta lee `poolMax` filas sin ORDER BY antes de filtrar y puntuar. Con
  // el valor por defecto (80), en franjas con más recetas (comida 119, cena 166
  // aprobadas) el motor solo ve una porción arbitraria del catálogo. El
  // planificador semanal lo sube para poder repartir sin repetir.
  poolMax = 80
): Promise<RecetaCandidata[]> {
  const categorias = SLOT_CATEGORIAS[slotNombre] ?? SLOT_CATEGORIAS['Comida']
  const tiposPermitidos = SLOT_TIPOS_PERMITIDOS[slotNombre] ?? ['completa']
  const restricciones = filtroCliente.restricciones ?? []
  const tiempoMaximo = filtroCliente.tiempo_cocina_min
  const momentoTaxonomia = tagsClinicosRequeridos?.es_pre_entreno
    ? 'pre_entreno'
    : tagsClinicosRequeridos?.es_post_entreno
      ? 'post_entreno'
      : inferirMomentoDesdeTipo(slotNombre)

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

  // El select original no pedía las columnas de tags clínicos
  // (apto_rendimiento/apto_sop/apto_hashimoto/es_post_entreno/es_pre_entreno)
  // ni las de calidad nutricional (densidad_proteica/score_saciedad). Sin
  // ellas, `rec[tag]` más abajo siempre era `undefined` — el filtro de tags
  // clínicos y el bonus de ajuste a rendimiento no podían funcionar nunca,
  // para ningún cliente, aunque el código los usara como si existieran.
  let query = supabase
    .from('recetas')
    .select('id, nombre, kcal, proteinas, carbohidratos, grasas, fibra, tiempo_prep_min, tipo_receta, imagen_url, url_origen, intolerancias, score_calidad, verificacion, recipe_intelligence_score, macro_flex_score, planning_roles, apta_cliente, objetivos, deportes, momentos, estilos, premium_chef, adherencia_score, densidad_energetica, digestibilidad, apto_sop, apto_hashimoto, apto_rendimiento, es_post_entreno, es_pre_entreno, densidad_proteica, score_saciedad, receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre, alimento:alimentos(nombre))')
    .eq('estado', 'aprobada')
    .gt('kcal', 0)
    .in('categoria', categorias)
    .or(`tipo_receta.is.null,tipo_receta.in.(${tiposPermitidos.join(',')})`)

  if (tiempoMaximo && tiempoMaximo > 0) {
    query = query.or(`tiempo_prep_min.is.null,tiempo_prep_min.lte.${tiempoMaximo}`)
  }
  if (requiereMomentoExacto(momentoTaxonomia)) {
    query = query.contains('momentos', [momentoTaxonomia])
  }

  const { data: recetas } = await query.limit(poolMax)
  if (!recetas || recetas.length === 0) return []

  const alergenosExcluir = [...new Set(
    restricciones.flatMap(r => RESTRICCION_A_ALERGENO[r.toLowerCase()] ?? [r])
  )]

  // La carne no es alérgeno EU: vegano/vegetariano se exigen con el tag positivo (ver compatibilidad-receta.ts)
  const tagsPositivosRequeridos = [...new Set(
    restricciones
      .map(r => RESTRICCION_A_TAG_POSITIVO[r.toLowerCase()])
      .filter((tag): tag is string => Boolean(tag))
  )]

  // Filtro duro: intolerancias (exclusión por alérgeno + requisito positivo vegano/vegetariano)
  let candidatas = recetas.filter(r => {
    const recetaIntol: string[] = r.intolerancias ?? []
    if (alergenosExcluir.length && alergenosExcluir.some(alergeno => recetaIntol.includes(alergeno))) {
      return false
    }
    if (tagsPositivosRequeridos.length && !tagsPositivosRequeridos.every(tag => recetaIntol.includes(tag))) {
      return false
    }
    return true
  })

  // Filtro duro: alimentos a evitar — se comprueba tanto el nombre de la
  // receta como sus ingredientes reales. Antes solo miraba el título: una
  // receta llamada "Espaguetis a la boloñesa" con cebolla como ingrediente
  // interno no se excluía para un cliente que declaraba "sin cebolla".
  const evitarRaw = filtroCliente.alimentos_evitar_extra
  const evitarArr: string[] = Array.isArray(evitarRaw)
    ? evitarRaw
    : typeof evitarRaw === 'string' && evitarRaw.trim()
      ? evitarRaw.split(',').map(s => s.trim()).filter(Boolean)
      : []

  // Dietas sin etiqueta propia (pescetariano) → lo que hay que evitar
  evitarArr.push(...restricciones.flatMap(r => RESTRICCION_A_EVITAR[r.toLowerCase()] ?? []))

  if (evitarArr.length > 0) {
    const evitarLower = evitarArr.map(a => a.toLowerCase()).flatMap(expandirEvitar)
    candidatas = candidatas.filter(r => {
      const rIng = (r as unknown as { receta_ingredientes?: Array<{ nombre_libre?: string | null; alimento?: { nombre?: string | null } | null }> }).receta_ingredientes ?? []
      const textosReceta = [
        r.nombre.toLowerCase(),
        ...rIng.map(i => (i.nombre_libre ?? '').toLowerCase()),
        ...rIng.map(i => (i.alimento?.nombre ?? '').toLowerCase()),
      ]
      return !evitarLower.some(term => textosReceta.some(texto => texto.includes(term)))
    })
  }

  // Reglas clínicas: se excluyen las recetas incompatibles con la condición (si quedan al menos 3) y el resto se ajusta al puntuar
  const reglasCli = reglasClinicas(filtroCliente.condiciones_salud)
  const ingredientesDe = (r: unknown) => ((r as { receta_ingredientes?: { nombre_libre?: string | null; alimento?: { nombre?: string | null } | null }[] }).receta_ingredientes ?? []).flatMap(i => [i.nombre_libre ?? '', i.alimento?.nombre ?? ''])
  if (reglasCli.condiciones.length > 0) {
    const compatibles = candidatas.filter(r => !ajusteClinico(reglasCli, r.nombre, ingredientesDe(r)).excluir)
    if (compatibles.length >= 3) candidatas = compatibles
  }

  // Filtro duro: dislikes del cliente
  candidatas = candidatas.filter(r => !dislikeIds.has(r.id))

  // Lo que el cliente ya ha cambiado por otra receta (la rechazó al elegir una alternativa) y lo que come habitualmente
  const prefs: PreferenciasCliente | null = clienteId ? await cargarPreferencias(supabase, clienteId).catch(() => null) : null
  if (prefs) {
    // Cambiada 2 veces o más: fuera (si quedan suficientes); 1 vez: solo baja en el ranking
    const sinRechazadas = candidatas.filter(r => (prefs.rechazos.get(r.id) ?? 0) < 2)
    if (sinRechazadas.length >= 3) candidatas = sinRechazadas
    if (prefs.evitar.length > 0) {
      const sinEvitar = candidatas.filter(r => !lleva(`${r.nombre} ${((r as Record<string, unknown>).receta_ingredientes as { nombre_libre?: string }[] | undefined)?.map(i => i.nombre_libre ?? '').join(' ') ?? ''}`, prefs.evitar))
      if (sinEvitar.length >= 3) candidatas = sinEvitar
    }
  }

  // Recetario de confianza: preferir recetas verificadas si hay suficientes
  const verificadas = candidatas.filter(r => r.verificacion != null)
  if (verificadas.length >= 3) candidatas = verificadas

  // Filtro blando: densidad proteica. Escalar cantidades clava las kcal pero NO la proteína: la receta elegida ya trae
  // su proporción. Una con el 17 % de sus kcal en proteína no llega a un plan que pide el 29 % (Marta: −15 %), y una
  // con el 30 % se pasa en un plan de proteína limitada (ERC: 59 g = 11 % de las kcal → +21 %). Se prefieren recetas
  // cuya densidad esté cerca de la del plan, solo si quedan ≥7 candidatas.
  if (targetKcal > 0 && targetProt > 0) {
    const densObjetivo = (targetProt * 4) / targetKcal
    const dens = (r: { kcal?: number | null; proteinas?: number | null }) => ((r.proteinas ?? 0) * 4) / Math.max(1, r.kcal ?? 0)
    if (densObjetivo >= 0.2) {
      const proteicas = candidatas.filter(r => (r.kcal ?? 0) > 0 && dens(r) >= densObjetivo * 0.8)
      if (proteicas.length >= POOL_SEMANA) candidatas = proteicas
    } else if (densObjetivo <= 0.14) {
      const moderadas = candidatas.filter(r => (r.kcal ?? 0) > 0 && dens(r) <= densObjetivo * 1.6)
      if (moderadas.length >= POOL_SEMANA) candidatas = moderadas
    }
  }

  // Filtro blando: score_calidad mínimo (solo si quedan >=3)
  const aptasCalidad = candidatas.filter(r => (r.score_calidad ?? 50) >= 50)
  if (aptasCalidad.length >= 3) candidatas = aptasCalidad

  // Filtro blando: excluir recientes SOLO si queda variedad para una semana (7). Con un pool pequeño (p. ej. 13
  // desayunos veganos) quitar lo de las últimas 2 semanas dejaba 6 y forzaba repetir; en ese caso los recientes
  // se quedan y restan puntuación más abajo.
  const sinRecientes = candidatas.filter(r => !recientesIds.has(r.id))
  if (sinRecientes.length >= POOL_SEMANA) candidatas = sinRecientes

  // Filtro blando: tags clínicos (SOP, Hashimoto, Rendimiento, peri-entreno)
  // Solo se aplica si hay tags requeridos Y quedan >=3 candidatas tras el filtro
  if (tagsClinicosRequeridos && Object.keys(tagsClinicosRequeridos).length > 0) {
    const conTags = candidatas.filter(r => {
      const rec = r as Record<string, unknown>
      return Object.entries(tagsClinicosRequeridos).every(([tag, val]) => rec[tag] === val)
    })
    if (conTags.length >= POOL_SEMANA) candidatas = conTags   // mismo criterio: no vaciar el pool por un filtro blando
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
    const dist = distanciaEuclidiana(
      r.kcal, r.proteinas ?? 0, r.carbohidratos ?? 0, r.grasas ?? 0,
      targetKcal, targetProt, targetCarb, targetGrasa
    )
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
    // `apto_rendimiento` solo se usa arriba como filtro categórico, y ese
    // filtro se DESCARTA en silencio si quedan <3 candidatas (slots como
    // "Merienda vegana" suelen tener muy pocas recetas con el tag puesto).
    // Sin este bonus, tras descartarse el filtro no queda ninguna señal
    // nutricional en el ranking — solo `score_calidad`/`recipe_intelligence`
    // (fotografía, ejecución...), que no distingue una guarnición de
    // patatas fritas (alta puntuación de producción, baja saciedad/proteína)
    // de un snack realmente pensado para después de entrenar.
    const perfRendimientoFit = tagsClinicosRequeridos?.apto_rendimiento
      ? ((rec.apto_rendimiento as boolean) ? 0.5 : 0) +
        Math.min(1, ((rec.densidad_proteica as number) ?? 0) / 20) * 0.3 +
        Math.min(1, ((rec.score_saciedad as number) ?? 0) / 3) * 0.2
      : null

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
    const taxonomyScore = scoreRecetaParaAgente(r, {
      objetivo: objetivoCliente,
      deporte: deporteCliente,
      momento: momentoTaxonomia,
      targetKcal,
      targetProteinas: targetProt,
      preferirChefHealthy: true,
    })

    // Pesos ARAG: si hay perfil confiable, usamos los pesos enriquecidos
    // Si no, usamos pesos legacy (calidad + macro + apta)
    let sortScore: number
    if (confianzaPerfil >= 0.2) {
      sortScore =
        scoreNorm      * 0.20 +
        (1 - distNorm) * 0.18 +
        taxonomyScore  * 0.12 +
        alineacionPerfil * 0.28 +
        novedadScore   * 0.10 +
        Math.max(aptaMatch, objetivoTaxonomia, perfRendimientoFit ?? 0) * 0.07 +
        adherenciaScore * 0.03 +
        macroFlexScore * 0.015 +
        (planningRoles.has('portion_scalable') ? 1 : 0.4) * 0.005
    } else {
      // Legacy weights (sin datos de perfil)
      sortScore =
        scoreNorm * 0.22 +
        Math.max(aptaMatch, objetivoTaxonomia, perfRendimientoFit ?? 0) * 0.22 +
        (1 - distNorm) * 0.24 +
        taxonomyScore * 0.20 +
        adherenciaScore * 0.07 +
        macroFlexScore * 0.03 +
        chefHealthyScore * 0.02
    }

    // Recientes que se quedaron en el pool (por ser pocas recetas): bajan, no desaparecen
    if (recientesIds.has(r.id)) sortScore *= 0.9

    // «No romper con su vida»: bonus si se parece a lo que ya come en esta franja; baja si ya la cambió una vez
    if (prefs) {
      const ing = ((rec.receta_ingredientes as { nombre_libre?: string }[] | undefined) ?? []).map(i => i.nombre_libre ?? '').join(' ')
      sortScore += 0.1 * afinidadHabitual(`${r.nombre} ${ing}`, slotNombre, prefs.habituales)
      if ((prefs.rechazos.get(r.id) ?? 0) === 1) sortScore *= 0.85
    }

    if (reglasCli.condiciones.length > 0) {
      const aj = ajusteClinico(reglasCli, r.nombre, ingredientesDe(r), rec)
      sortScore = sortScore * aj.mult + aj.bonus
    }

    return { ...r, _dist: dist, _sort_score: sortScore }
  })

  return scored
    .sort((a, b) => (b._sort_score ?? 0) - (a._sort_score ?? 0))
    .slice(0, limit)
    .map(row => {
      const { _dist, _sort_score, ...r } = row
      void _dist
      void _sort_score
      return r
    })
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
