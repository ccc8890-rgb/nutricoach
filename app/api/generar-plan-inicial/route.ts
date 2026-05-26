import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase, createApiSupabase } from '@/lib/supabase-server'
import { seleccionarProtocolos, formatearEvidenciaParaPrompt } from '@/lib/knowledge-base'
import { obtenerInformeVigente, necesitaRegeneracion, generarInformeCasoClinico } from '@/lib/inteligencia-clinica'
import { construirPrompt, generarDietaConIA, type DietaGenerada } from '@/lib/deepseek'
import { distribuirProteinas, verificarLeucina } from '@/lib/distribucion-proteinas'
import { planificarMesociclo, formatearMesociclo } from '@/lib/periodizacion/mesociclo'
import { evaluarPerfilEntreno, filtrarPlantillasPorPerfil } from '@/lib/motor-entreno'
import { generarRecomendacionPeriEntreno, formatearPeriEntrenoParaPrompt } from '@/lib/nutricion-peri-entreno'
import { validarMicronutrientes } from '@/lib/validacion-micronutrientes'
import { seleccionarPildoras } from '@/lib/micro-learning'
import type { MetodologiaCoach } from '@/types'
import { filtrarRecetasPorSlot, validarYResolverRecetas, calcularTargetSlot, type PlanDeepSeekValidado } from '@/lib/plan-recetas'
import { calcularGramajeAjustado } from '@/lib/ingredient-roles'
import { calcularAjustesPeriEntreno } from '@/lib/nutricion-peri-entreno'
import { getContextoCoach, getContextoClienteClinico, getTargetsComidas } from '@/lib/metodologia-recetario'
import { aplicarRecetaAComida } from '@/lib/recetas/aplicar-receta-comida'
import type { PerfilEntrenoCliente, RecetaCandidata, SportModality } from '@/types'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

const ACTIVIDAD_FACTOR: Record<string, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  activo: 1.725,
  muy_activo: 1.9,
}

const OBJETIVO_AJUSTE: Record<string, number> = {
  perder_grasa: -400,
  ganar_musculo: 300,
  rendimiento: 200,
  mantener: 0,
  salud_general: 0,
  recomposicion: -100,
}

// Proteína objetivo por objetivo (g/kg de peso corporal)
const PROTEINA_OBJETIVO: Record<string, number> = {
  salud_general: 1.0,
  mantener: 1.6,
  rendimiento: 1.8,
  ganar_musculo: 2.0,
  perder_grasa: 2.4,
  recomposicion: 2.0,
}

type PerfilEntrenoInferido = Partial<PerfilEntrenoCliente> & {
  cliente_id: string
  sport_modality?: SportModality
}

type PlantillaSesionRow = {
  nombre: string
  dia_semana?: string | null
  orden?: number | null
  notas?: string | null
  descripcion?: string | null
  duracion_estimada_min?: number | null
  ejercicios?: Array<{
    ejercicio_id: string
    series?: number | null
    repeticiones?: string | null
    descanso_segundos?: number | null
    peso_sugerido?: string | null
    carga_valor?: number | null
    notas?: string | null
    notas_tecnicas?: string | null
    orden?: number | null
  }>
}

function calcularTDEE(peso: number, altura: number, edad: number, sexo: string, actividad: string): number {
  const tmb =
    sexo === 'mujer'
      ? 10 * peso + 6.25 * altura - 5 * edad - 161
      : 10 * peso + 6.25 * altura - 5 * edad + 5
  const factor = ACTIVIDAD_FACTOR[actividad] ?? 1.55
  return Math.round(tmb * factor)
}

function inferirModalidadEntreno(onboarding: Record<string, any>, perfil?: Record<string, any> | null): SportModality | undefined {
  const texto = [
    ...(Array.isArray(onboarding.tipo_entreno) ? onboarding.tipo_entreno : []),
    onboarding.objetivo_deportivo,
    perfil?.tipo_competicion,
    perfil?.descripcion_semana_entreno,
    perfil?.trigger_onboarding,
  ].filter(Boolean).join(' ').toLowerCase()

  const tieneHyrox = texto.includes('hyrox')
  const tieneRunning = texto.includes('running') || texto.includes('correr') || texto.includes('carrera') || texto.includes('10k') || texto.includes('5k') || texto.includes('marat')
  const tieneGym = texto.includes('gym') || texto.includes('muscul') || texto.includes('fuerza') || texto.includes('crossfit')
  const tieneCiclismo = texto.includes('ciclismo') || texto.includes('bici') || texto.includes('ftp')
  const tieneTriatlon = texto.includes('triat')

  if (tieneTriatlon) return 'triatlon'
  if ((tieneHyrox || tieneRunning) && tieneGym) return 'hibrido'
  if (tieneHyrox) return 'hyrox'
  if (tieneRunning) return 'running'
  if (tieneCiclismo) return 'ciclismo'
  if (tieneGym) return 'gym_fuerza'
  return undefined
}

function inferirPerfilEntreno(clienteId: string, onboarding: Record<string, any>, perfil?: Record<string, any> | null): PerfilEntrenoInferido {
  return {
    cliente_id: clienteId,
    sport_modality: inferirModalidadEntreno(onboarding, perfil),
    objetivo_especifico: perfil?.tipo_competicion || perfil?.trigger_onboarding || onboarding.objetivo_deportivo || onboarding.objetivo,
    nivel: onboarding.segmento === 'elite' ? 'avanzado' : 'intermedio',
    dias_disponibles: Math.max(1, Math.min(7, onboarding.dias_entreno ?? 3)),
    mejor_momento_sesion: perfil?.hora_entreno ? 'variable' : undefined,
    vo2max_estimado: perfil?.vo2max ?? undefined,
    capacidad_recuperacion: (perfil?.calidad_sueno ?? 3) <= 2 || (perfil?.nivel_estres ?? 0) >= 4 ? 'baja' : 'media',
    respuesta_a_volumen: (onboarding.dias_entreno ?? 3) >= 5 ? 'alto' : 'medio',
    respuesta_psicologica: perfil?.tipo_competicion || perfil?.fecha_competicion ? 'competicion' : 'rutina',
    plateau_detectado: false,
    semanas_sin_progresion: 0,
    equipo_disponible: ['Barra olímpica', 'Mancuernas', 'Máquinas cardio', 'Barras dominadas', 'Kettlebell'],
    patron_lesiones: [],
    fisio_informe: [],
    analisis_sangre: [],
    apple_health_enabled: false,
  }
}

async function crearPlanEntrenoDesdePlantilla(
  supabase: ReturnType<typeof createServiceSupabase>,
  input: { clienteId: string; coachId: string; plantillaId: string; nombre?: string }
): Promise<string | null> {
  const { data: plantilla } = await supabase
    .from('plantillas_entrenamiento')
    .select('id, nombre, descripcion, duracion_semanas')
    .eq('id', input.plantillaId)
    .single()

  if (!plantilla) return null

  const { data: sesiones } = await supabase
    .from('plantilla_sesiones')
    .select('*, ejercicios:plantilla_sesion_ejercicios(*)')
    .eq('plantilla_id', input.plantillaId)
    .order('orden')

  if (!sesiones?.length) return null

  const { data: plan, error: planError } = await supabase
    .from('planes_entrenamiento')
    .insert({
      coach_id: input.coachId,
      cliente_id: input.clienteId,
      nombre: input.nombre ?? plantilla.nombre,
      descripcion: plantilla.descripcion ?? null,
      duracion_semanas: plantilla.duracion_semanas ?? null,
      activo: true,
    })
    .select('id')
    .single()

  if (planError || !plan) return null

  for (const sesion of sesiones as PlantillaSesionRow[]) {
    const { data: nuevaSesion, error: sesionError } = await supabase
      .from('sesiones_entrenamiento')
      .insert({
        plan_id: plan.id,
        nombre: sesion.nombre,
        dia_semana: sesion.dia_semana ?? null,
        orden: sesion.orden ?? null,
        notas: sesion.notas ?? sesion.descripcion ?? null,
        duracion_estimada_min: sesion.duracion_estimada_min ?? null,
      })
      .select('id')
      .single()

    if (sesionError || !nuevaSesion) {
      await supabase.from('planes_entrenamiento').delete().eq('id', plan.id)
      return null
    }

    for (const ejercicio of sesion.ejercicios ?? []) {
      const { error: ejercicioError } = await supabase.from('sesion_ejercicios').insert({
        sesion_id: nuevaSesion.id,
        ejercicio_id: ejercicio.ejercicio_id,
        series: ejercicio.series ?? null,
        repeticiones: ejercicio.repeticiones ?? null,
        descanso_segundos: ejercicio.descanso_segundos ?? null,
        peso_sugerido: ejercicio.peso_sugerido ?? ejercicio.carga_valor?.toString() ?? null,
        notas: ejercicio.notas ?? ejercicio.notas_tecnicas ?? null,
        orden: ejercicio.orden ?? null,
      })

      if (ejercicioError) {
        await supabase.from('planes_entrenamiento').delete().eq('id', plan.id)
        return null
      }
    }
  }

  return plan.id
}

export async function POST(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { cliente_id } = await request.json()
  if (!cliente_id) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  const supabase = createServiceSupabase()

  // ── 1. Fetch ALL client data ───────────────────────────────────────────────
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, coach_id, objetivo, peso_inicial, altura, edad, sexo, restricciones_alimentarias')
    .eq('id', cliente_id)
    .single()

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  if (cliente.coach_id !== user.id) {
    return NextResponse.json({ error: 'Acceso restringido al coach del cliente' }, { status: 403 })
  }

  const { data: onboarding } = await supabase
    .from('onboarding_responses')
    .select('*')
    .eq('cliente_id', cliente_id)
    .single()

  if (!onboarding) return NextResponse.json({ error: 'Onboarding no completado' }, { status: 400 })

  const { data: perfil } = await supabase
    .from('onboarding_perfil_profundo')
    .select('*')
    .eq('cliente_id', cliente_id)
    .single()

  const { data: metodologia } = await supabase
    .from('metodologia_coach')
    .select('*')
    .eq('coach_id', cliente.coach_id)
    .maybeSingle()

  // ── 1b. Fetch perfil de entreno (Gap #9) ──────────────────────────────────
  const { data: perfilEntrenoExistente } = await supabase
    .from('perfil_entreno_cliente')
    .select('*')
    .eq('cliente_id', cliente_id)
    .maybeSingle()
  let perfilEntreno = perfilEntrenoExistente as PerfilEntrenoCliente | null

  if (!perfilEntreno) {
    const inferido = inferirPerfilEntreno(cliente_id, onboarding, perfil)
    const { data: perfilCreado } = await supabase
      .from('perfil_entreno_cliente')
      .insert(inferido)
      .select('*')
      .maybeSingle()
    perfilEntreno = (perfilCreado as PerfilEntrenoCliente | null) ?? (inferido as PerfilEntrenoCliente)
  }

  // ── 1e. Fetch perfil alimentario aprendido (intercambios) ─────────────────
  const { data: perfilAlimentario } = await supabase
    .from('perfil_alimentario_cliente')
    .select('ingredientes_rechazados, ingredientes_preferidos, total_interacciones')
    .eq('cliente_id', cliente_id)
    .maybeSingle()

  // ── 1c. Fetch plantillas de entrenamiento ──────────────────────────────────
  const { data: plantillasEntreno } = await supabase
    .from('plantillas_entrenamiento')
    .select('*')
    .eq('coach_id', cliente.coach_id)

  // ── 1d. Evaluar motor de entreno (Gap #9) ─────────────────────────────────
  let recomendacionEntreno: ReturnType<typeof evaluarPerfilEntreno> | null = null
  let plantillasEntrenoRecomendadas: typeof plantillasEntreno | null = null
  if (perfilEntreno) {
    const perfilEntrenoMapped = {
      ...perfilEntreno,
      sport_modality: perfilEntreno.sport_modality,
      nivel: perfilEntreno.nivel as 'principiante' | 'intermedio' | 'avanzado' | undefined,
    }
    recomendacionEntreno = evaluarPerfilEntreno(perfilEntrenoMapped)
    plantillasEntrenoRecomendadas = plantillasEntreno
      ? filtrarPlantillasPorPerfil(plantillasEntreno, recomendacionEntreno)
      : []
  }

  // ── 2. TDEE + Macros base ──────────────────────────────────────────────────
  const tdee = calcularTDEE(
    cliente.peso_inicial ?? 70,
    cliente.altura ?? 170,
    cliente.edad ?? 30,
    cliente.sexo ?? 'hombre',
    onboarding.actividad_base,
  )

  const deficitLimite = metodologia?.deficit_maximo_kcal ?? 500
  const superavitLimite = metodologia?.superavit_maximo_kcal ?? 400
  const OBJETIVO_AJUSTE_FINAL: Record<string, number> = {
    perder_grasa: -Math.min(Math.abs(OBJETIVO_AJUSTE.perder_grasa), deficitLimite),
    ganar_musculo: Math.min(OBJETIVO_AJUSTE.ganar_musculo, superavitLimite),
    rendimiento: Math.min(OBJETIVO_AJUSTE.rendimiento, superavitLimite),
    recomposicion: -100,
    mantener: 0,
    salud_general: 0,
  }

  const kcalObjetivo = tdee + (OBJETIVO_AJUSTE_FINAL[onboarding.objetivo] ?? 0)
  const factorSexo = cliente.sexo === 'mujer' && onboarding.objetivo === 'ganar_musculo' ? 0.9 : 1.0

  // Override protein factors from coach methodology
  const proteinaObjetivoFinal: Record<string, number> = {
    salud_general: metodologia?.proteina_salud_general ?? PROTEINA_OBJETIVO.salud_general,
    mantener: PROTEINA_OBJETIVO.mantener,
    rendimiento: metodologia?.proteina_rendimiento ?? PROTEINA_OBJETIVO.rendimiento,
    ganar_musculo: metodologia?.proteina_ganancia_musculo ?? PROTEINA_OBJETIVO.ganar_musculo,
    perder_grasa: metodologia?.proteina_perdida_grasa ?? PROTEINA_OBJETIVO.perder_grasa,
    recomposicion: metodologia?.proteina_recomposicion ?? 2.0,
  }
  const gProteina = (proteinaObjetivoFinal[onboarding.objetivo] ?? 1.8) * factorSexo

  // ── 3. Distribución estratégica de proteína (Gap #3) ──────────────────────
  const distribucionProteina = distribuirProteinas({
    edad: cliente.edad ?? 30,
    peso: cliente.peso_inicial ?? 70,
    objetivo: onboarding.objetivo,
    sexo: cliente.sexo,
    gProteinaFinal: gProteina,
    horaEntreno: perfil?.hora_entreno,
    numComidas: metodologia?.num_comidas_default ?? 4,
    proteinas: perfil?.proteinas?.split(',') || [],
  })
  const leucinaCheck = verificarLeucina(distribucionProteina)

  // Macros derivados (grasas fijas, carbos por resto calórico)
  const grasas = Math.round((kcalObjetivo * 0.28) / 9)
  const carbos = Math.round((kcalObjetivo - distribucionProteina.total * 4 - grasas * 9) / 4)

  // ── 4. Planificar mesociclo (Gap #2) ──────────────────────────────────────
  const mesociclo = planificarMesociclo({
    objetivo: onboarding.objetivo,
    semanas_en_deficit: 0, // Cliente nuevo — empieza en 0
    fatiga_acumulada: 1,
    adherencia: 100,
    tls_semanal_promedio: onboarding.dias_entreno * 40, // Estimación inicial
    tiene_competicion_proxima: !!perfil?.fecha_competicion,
    fecha_competicion: perfil?.fecha_competicion,
    edad: cliente.edad ?? 30,
  }, cliente_id)

  // ── 5. Scientific evidence ─────────────────────────────────────────────────
  const protocolos = await seleccionarProtocolos(supabase, {
    objetivo: onboarding.objetivo,
    tipo_entreno: onboarding.tipo_entreno?.join(', '),
    condiciones_salud: perfil?.condiciones_salud,
    restricciones_alimentarias: cliente.restricciones_alimentarias,
    edad: cliente.edad,
    sexo: cliente.sexo,
  })
  const evidenciaBlock = formatearEvidenciaParaPrompt(protocolos)

  // Behavioral flags
  const esInflexible = perfil?.todo_o_nada === 'si'
  const tieneAnsiedad = ['ansiedad', 'conflicto'].includes(perfil?.relacion_comida ?? '')
  const duermePoco = (perfil?.horas_sueno ?? 7) < 6
  const estresAlto = (perfil?.nivel_estres ?? 0) >= 4
  const confianzaBaja = (perfil?.autoeficacia ?? 10) < 7

  // ── 5b. Nutrición peri-entreno (Gap #4) ──────────────────────────────────
  const recomendacionPeriEntreno = generarRecomendacionPeriEntreno({
    sportModality: perfilEntreno?.sport_modality,
    horaEntreno: perfil?.hora_entreno,
    duracionMin: onboarding.duracion_sesion_min ?? 45,
    intensidad: recomendacionEntreno?.intensidad ?? 'moderada',
    volumen: recomendacionEntreno?.volumen ?? 'medio',
    tier: recomendacionEntreno?.tier ?? 'general',
    pesoKg: cliente.peso_inicial ?? 70,
    edad: cliente.edad ?? 30,
    objetivo: onboarding.objetivo,
    kcalObjetivo,
    carbosObjetivo: carbos,
    tipoEntreno: onboarding.tipo_entreno,
  })

  // ── 5c. Informe de caso clínico (inteligencia clínica) ───────────────────────
  // Si el cliente tiene checkins, inyectamos el informe clínico estructurado.
  // El informe se regenera automáticamente si hay 4+ checkins nuevos.
  let informeClinico = await obtenerInformeVigente(cliente_id)
  if (!informeClinico) {
    const debeReg = await necesitaRegeneracion(cliente_id)
    if (debeReg) {
      informeClinico = await generarInformeCasoClinico(cliente_id)
    }
  }
  const informeClinicoBlock = informeClinico?.instrucciones_ia
    ? `\n${informeClinico.instrucciones_ia}\n`
    : ''

  // ── 6. Build methodology prompt block ──────────────────────────────────────
  // La ciencia es la base. El coach sólo añade ajustes si tiene metodología configurada.
  const metodologiaBlock = metodologia
    ? `
═══ AJUSTES DEL COACH (sobre la base científica) ═══
${metodologia.reglas_fijas?.length ? metodologia.reglas_fijas.map((r: string) => `- ✓ ${r}`).join('\n') : ''}
${metodologia.estilos_dieta?.length ? `- Estilo preferido: ${metodologia.estilos_dieta.join(', ')}` : ''}
${metodologia.deficit_maximo_kcal ? `- Déficit máximo: ${metodologia.deficit_maximo_kcal} kcal (ajuste sobre referencia ISSN)` : ''}
${metodologia.superavit_maximo_kcal ? `- Superávit máximo: ${metodologia.superavit_maximo_kcal} kcal` : ''}
${metodologia.num_comidas_default ? `- Comidas habituales: ${metodologia.num_comidas_default}` : ''}
${metodologia.filosofia_coaching ? `\nFilosofía del coach:\n"${metodologia.filosofia_coaching}"` : ''}`
    : `
═══ MODO EVIDENCE-BASED PURO ═══
El coach no ha definido metodología propia aún.
APLICA ESTRICTAMENTE los valores de los protocolos científicos inyectados arriba.
Los valores de proteína, déficit y timing son los recomendados por ISSN, Morton 2018 y Helms 2014.
No añadas restricciones subjetivas — sólo ciencia.`

  // ── 7. Build segment-specific info ─────────────────────────────────────────
  const segmento = onboarding.segmento || 'standard'
  const isPerf = segmento === 'performance' || segmento === 'elite'
  const isElite = segmento === 'elite'

  const SEGMENTO_LABELS: Record<string, string> = {
    standard: 'Esencial — pérdida de peso / salud general',
    recomposicion: 'Avanzado — recomposición corporal / estética',
    performance: 'Pro — atleta recreacional / semi-atleta',
    elite: 'Élite — competición / físico élite',
  }

  const ventanaAlimentacion = perfil?.hora_primera_ingesta && perfil?.hora_ultima_ingesta
    ? `Ventana de alimentación: ${perfil.hora_primera_ingesta} - ${perfil.hora_ultima_ingesta}`
    : ''

  const analisisBlock = perfil?.analisis_disponibles?.length
    ? `\n═══ ANALÍTICA DISPONIBLE ═══\n${(perfil.analisis_disponibles as string[]).map((k: string) => `- ${k}: ${(perfil.analisis_valores as Record<string, string>)?.[k] ?? 'sin valor'}`).join('\n')}${perfil.notas_analisis ? `\n- Notas analítica: ${perfil.notas_analisis}` : ''}`
    : ''

  const composicionBlock = isPerf && (perfil?.composicion_grasa_pct || perfil?.composicion_masa_muscular_kg)
    ? `\n═══ COMPOSICIÓN CORPORAL ═══\n${perfil.composicion_grasa_pct ? `- % Grasa actual: ${perfil.composicion_grasa_pct}% (${perfil.composicion_metodo || 'método no especificado'})` : ''}\n${perfil.composicion_masa_muscular_kg ? `- Masa muscular: ${perfil.composicion_masa_muscular_kg} kg` : ''}\n${perfil.composicion_objetivo_grasa_pct ? `- % Grasa objetivo: ${perfil.composicion_objetivo_grasa_pct}%` : ''}\n${isElite && perfil.peso_competicion ? `- Peso de competición: ${perfil.peso_competicion} kg` : ''}\n${isElite && perfil.vo2max ? `- VO2max medido: ${perfil.vo2max} ml/kg/min` : ''}`
    : ''

  const testsBlock = isElite && perfil?.tests_recomendados_pendientes?.length
    ? `\n═══ PRUEBAS PENDIENTES DE REALIZAR ═══\n${(perfil.tests_recomendados_pendientes as string[]).join(', ')}\n(Cliente interesado en realizarlas — incluir referencia en hoja de ruta)`
    : ''

  const segmentoFlag = isElite
    ? '⚡ CLIENTE ÉLITE: periodización por fases, ajustes semanales, nutrición peri-entreno avanzada, nada de plan genérico.'
    : isPerf
      ? '⚡ CLIENTE PERFORMANCE: nutrición peri-entreno crítica, timing de macros, recuperación prioritaria.'
      : segmento === 'recomposicion'
        ? '⚡ CLIENTE RECOMPOSICIÓN: déficit mínimo o recomp, proteína alta (≥2.2g/kg), timing alrededor del entreno.'
        : ''

  // ── 8. Construir contexto completo para DeepSeek ──────────────────────────
  // Este bloque contiene TODA la información del cliente + evidencia científica
  // Se inyecta como "conocimiento científico" en el prompt de generación de dieta
  const contextoCompleto = `
═══ CONTEXTO COMPLETO DEL CLIENTE ═══

${informeClinicoBlock}${evidenciaBlock ? `\n${evidenciaBlock}\n` : ''}${metodologiaBlock ? `\n${metodologiaBlock}\n` : ''}

═══ SEGMENTO DE CLIENTE ═══
- Segmento: ${SEGMENTO_LABELS[segmento] || segmento}
${segmentoFlag}

═══ DATOS FÍSICOS Y OBJETIVO ═══
- Objetivo: ${onboarding.objetivo}
- TDEE calculado (Mifflin-St Jeor): ${tdee} kcal/día
- Kcal objetivo ajustado: ${kcalObjetivo} kcal/día
- Macros base: ${distribucionProteina.total}g proteína (${gProteina.toFixed(1)}g/kg) | ${carbos}g carbohidratos | ${grasas}g grasa
- Distribución proteína estratégica por comida:
${distribucionProteina.comidas.map(c => `  * ${c.nombre}: ${c.proteinas_g}g (${c.leucina_g}g leucina) ${c.mps_activada ? '✅ MPS' : '⚠️ sub-threshold'}${c.es_post_entreno ? ' [POST-ENTRENO]' : ''}`).join('\n')}
${leucinaCheck.alerta ? `- ⚠️ Alerta proteína: ${leucinaCheck.alerta}` : ''}
- Sexo: ${cliente.sexo ?? 'no especificado'} | Edad: ${cliente.edad ?? '?'} | Peso: ${cliente.peso_inicial ?? '?'}kg

═══ MESOCICLO PLANIFICADO ═══
${formatearMesociclo(mesociclo)}

═══ ACTIVIDAD Y ENTRENAMIENTO ═══
- Nivel actividad: ${onboarding.actividad_base} (${onboarding.dias_entreno} días/semana, ${onboarding.duracion_sesion_min} min/sesión)
- Tipos de entrenamiento: ${onboarding.tipo_entreno?.join(', ') || 'no especificado'}
${perfil?.hora_entreno ? `- Hora habitual de entreno: ${perfil.hora_entreno}` : ''}
${perfil?.descripcion_semana_entreno ? `- Descripción semana tipo: ${perfil.descripcion_semana_entreno}` : ''}
${perfil?.fecha_competicion ? `- COMPETICIÓN PRÓXIMA: ${perfil.fecha_competicion} (${perfil.tipo_competicion || 'tipo no especificado'})` : ''}
${perfil?.nutricion_peri_entreno ? `- Nutrición peri-entreno actual: ${perfil.nutricion_peri_entreno}` : ''}
${recomendacionEntreno ? `- 💪 Motor de entreno: ${recomendacionEntreno.foco_principal} (${recomendacionEntreno.dias_semana}días, ${recomendacionEntreno.intensidad}, ${recomendacionEntreno.volumen})` : ''}
${recomendacionPeriEntreno.alertas.length > 0 ? recomendacionPeriEntreno.alertas.map(a => `- ⚠️ ${a}`).join('\n') : ''}

${formatearPeriEntrenoParaPrompt(recomendacionPeriEntreno)}

═══ RESTRICCIONES Y PREFERENCIAS ═══
- Intolerancias/alergias: ${onboarding.restricciones?.join(', ') || 'ninguna'}
- Alimentos no deseados: ${onboarding.alimentos_no_gustan || 'ninguno'}
${perfil?.alimentos_evitar_extra ? `- Alimentos prohibidos: ${perfil.alimentos_evitar_extra}` : ''}
${perfil?.comidas_favoritas ? `- COMIDAS FAVORITAS (incluir): ${perfil.comidas_favoritas}` : ''}
${perfil?.suplementos ? `- Suplementos: ${perfil.suplementos}` : ''}
${perfil?.alcohol_semanal ? `- Alcohol: ${perfil.alcohol_semanal} ud/semana` : ''}
${(() => {
      const rechazados: string[] = perfilAlimentario?.ingredientes_rechazados ?? []
      const preferidos: string[] = perfilAlimentario?.ingredientes_preferidos ?? []
      const total = perfilAlimentario?.total_interacciones ?? 0
      if (total < 2) return ''
      return `
═══ PREFERENCIAS APRENDIDAS (comportamiento real del cliente) ═══
${rechazados.length > 0 ? `- Alimentos que rechaza habitualmente: ${rechazados.join(', ')} — EVITAR en el plan` : ''}
${preferidos.length > 0 ? `- Alimentos preferidos como sustitutos: ${preferidos.join(', ')} — PRIORIZAR si encajan con los macros` : ''}
- Intercambios registrados: ${total} (datos reales de adherencia)`
    })()}

═══ ALIMENTACIÓN ACTUAL ═══
${perfil?.dia_tipico ? `- Día típico: ${perfil.dia_tipico}` : '- Sin datos de alimentación actual'}

═══ LOGÍSTICA ═══
- Nivel cocina: ${onboarding.nivel_cocina} | Tiempo: ${onboarding.tiempo_cocina_min} min/día
${onboarding.presupuesto_semanal_eur ? `- Presupuesto: ${onboarding.presupuesto_semanal_eur}€/semana` : ''}
${perfil?.con_quien_come?.length ? `- Come con: ${perfil.con_quien_come.join(', ')}` : ''}
${perfil?.comida_trampa ? `- Válvula de escape: ${perfil.comida_trampa}` : ''}

═══ HORARIOS ═══
${ventanaAlimentacion}
${perfil?.hora_comida_principal ? `- Comida principal: ${perfil.hora_comida_principal}` : ''}

═══ SALUD ═══
${perfil?.condiciones_salud ? `- Condiciones: ${perfil.condiciones_salud}` : '- Sin condiciones reportadas'}
- Sueño: ${perfil?.horas_sueno ?? 7}h | Estrés: ${perfil?.nivel_estres ?? '?'}/5

═══ PERFIL PSICOLÓGICO ═══
- Confianza: ${perfil?.autoeficacia ?? '?'}/10 | Historial: ${perfil?.historial_dietas?.join(', ') || 'ninguno'}
${perfil?.razones_abandono?.length ? `- Razones abandono: ${perfil.razones_abandono.join(', ')}` : ''}
- Relación comida: ${perfil?.relacion_comida || 'no especificada'}
${analisisBlock}${composicionBlock}${testsBlock}

═══ FLAGS CRÍTICOS ═══
${confianzaBaja ? '⚠️ CONFIANZA BAJA: plan FLEXIBLE con margen 20%, evitar restricciones duras.' : ''}
${esInflexible ? '⚠️ TODO-O-NADA: incluir flexibilidad integrada, nunca alimentos prohibidos.' : ''}
${tieneAnsiedad ? '⚠️ RELACIÓN COMPLEJA: evitar culpa, permiso explícito para válvula de escape.' : ''}
${duermePoco ? '⚠️ SUEÑO <6H: +proteína en snacks, anticipar +300-500 kcal hambre.' : ''}
${estresAlto ? '⚠️ ESTRÉS ALTO: snacks proteína+fibra, aceptar variabilidad calórica.' : ''}
`

  // ── 9. Fetch plantillas y recetas para el prompt de dieta ──────────────────
  const { data: plantillas } = await supabase
    .from('plantillas_dieta')
    .select('id, nombre, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo')
    .eq('coach_id', cliente.coach_id)
    .limit(20)

  // ── 9b. Pre-filtrar recetas por slot del cliente ─────────────────────────────
  const numComidas = metodologia?.num_comidas_default ?? 4
  const slots = ['Desayuno', 'Comida', 'Merienda', 'Cena']

  const filtroCliente = {
    restricciones: onboarding.restricciones,
    alimentos_evitar_extra: (onboarding as Record<string, unknown>).alimentos_evitar_extra as string[] | null,
    tiempo_cocina_min: onboarding.tiempo_cocina_min,
    alimentos_base: (onboarding as Record<string, unknown>).alimentos_base as string[] | null,
  }

  // Tags clínicos derivados del perfil del cliente (filtro blando en recetario)
  const condicionSalud = ((perfil as Record<string, unknown>)?.condiciones_salud as string ?? '').toLowerCase()
  const tieneSOP = condicionSalud.includes('sop') || (onboarding.restricciones ?? []).includes('sop')
  const tieneHashimoto = condicionSalud.includes('hashimoto') || condicionSalud.includes('hipotiroidismo')
  const esAtleta = onboarding.objetivo === 'rendimiento' || (onboarding.dias_entreno ?? 0) >= 4
  const tagsClinicosRequeridos: Parameters<typeof filtrarRecetasPorSlot>[8] = {
    ...(tieneSOP && { apto_sop: true }),
    ...(tieneHashimoto && { apto_hashimoto: true }),
    ...(esAtleta && { apto_rendimiento: true }),
  }

  // Contexto clínico para el sistema prompt de IA
  const contextoClinico = [
    getContextoCoach({ incluirIngredientes: true }),
    getContextoClienteClinico({
      objetivo: onboarding.objetivo,
      restricciones: onboarding.restricciones ?? [],
      condiciones_salud: (perfil as Record<string, unknown>)?.condiciones_salud as string | undefined,
      actividad: onboarding.actividad_base,
      peso_kg: cliente.peso_inicial ?? undefined,
      altura_cm: cliente.altura ?? undefined,
      edad: cliente.edad ?? undefined,
      sexo: cliente.sexo ?? undefined,
    }),
    `TARGETS POR COMIDA:\n${getTargetsComidas()}`,
  ].filter(Boolean).join('\n\n')

  const candidatasPorSlot = new Map<string, import('@/types').RecetaCandidata[]>()

  for (const slot of slots) {
    const { targetKcal, targetProt } = calcularTargetSlot(slot, kcalObjetivo, distribucionProteina.total, numComidas)
    const candidatas = await filtrarRecetasPorSlot(
      supabase, slot, targetKcal, targetProt, filtroCliente, 6,
      cliente_id,
      onboarding.objetivo,
      tagsClinicosRequeridos && Object.keys(tagsClinicosRequeridos).length > 0 ? tagsClinicosRequeridos : undefined,
      perfilEntreno?.sport_modality ?? null
    )
    candidatasPorSlot.set(slot, candidatas)
  }

  // Compatibilidad con código posterior que usa recetasPorId / recetasPorNombre
  const recetasPorId = new Map(
    [...candidatasPorSlot.values()].flat().map(r => [r.id, r])
  )
  const recetasPorNombre = new Map(
    [...candidatasPorSlot.values()].flat().map(r => [r.nombre.toLowerCase().trim(), r])
  )

  // ── 10. Construir el prompt final con recetas ──────────────────────────────
  // Candidatas por slot para el prompt mejorado
  const candidatasBlock = slots.map(slot => {
    const lista = candidatasPorSlot.get(slot) ?? []
    if (lista.length === 0) return ''
    const { targetKcal, targetProt } = calcularTargetSlot(slot, kcalObjetivo, distribucionProteina.total, numComidas)
    const listaStr = lista.map(r =>
      `  {"id":"${r.id}","nombre":"${r.nombre}","kcal":${r.kcal},"prot":${r.proteinas}}`
    ).join(',\n')
    return `${slot.toUpperCase()}_TARGET: ${targetKcal} kcal / ${targetProt}g prot\n${slot.toUpperCase()}_CANDIDATAS: [\n${listaStr}\n]`
  }).filter(Boolean).join('\n\n')

  const ajustesPeriEntreno = calcularAjustesPeriEntreno({
    horaEntreno: (onboarding as Record<string, unknown>).horario_comidas
      ? ((onboarding as Record<string, unknown>).horario_comidas as Array<{ nombre: string; hora: string }>)?.find(h => h.nombre === 'Comida')?.hora
      : null,
    sportModality: perfilEntreno?.sport_modality ?? null,
    duracionMin: onboarding.duracion_sesion_min ?? 45,
    fase_deportiva: null,
  })

  const ajustesPeriBlock = ajustesPeriEntreno.length > 0
    ? `\n═══ AJUSTES PERI-ENTRENO ═══\n${ajustesPeriEntreno.map(a =>
        `- ${a.slot_nombre} (${a.tipo === 'pre' ? 'PRE' : 'POST'}): ${a.nota}`
      ).join('\n')}`
    : ''

  // Leer de perfil_profundo (fuente correcta tras el flujo unificado)
  const alimentosBaseOnb = (perfil?.alimentos_base ?? (onboarding as Record<string, unknown>).alimentos_base) as string[] | null
  const comeFueraDias = (perfil?.come_fuera_dias ?? (onboarding as Record<string, unknown>).come_fuera_dias) as number | null

  const contextoExtendido = `${contextoCompleto}

═══ ALIMENTOS BASE DEL CLIENTE ═══
${alimentosBaseOnb?.join(', ') || 'No especificados'}

${(comeFueraDias ?? 0) >= 3 ? `⚠️ Come fuera ${comeFueraDias} días/semana — priorizar recetas portables o de preparación rápida` : ''}

${ajustesPeriBlock}

═══ RECETAS DISPONIBLES POR SLOT (USAR SOLO ESTOS IDs) ═══
${candidatasBlock}

═══ INSTRUCCIÓN DE SALIDA — JSON ESTRICTO ═══
Devuelve ÚNICAMENTE el siguiente JSON sin texto adicional:
{
  "distribucion_comidas": [
    {
      "nombre": "Desayuno",
      "hora": "08:00",
      "orden": 1,
      "kcal_target": 400,
      "proteinas_target": 30,
      "receta_id": "uuid-exacto-de-la-lista",
      "receta_nombre": "nombre",
      "cantidad_porciones": 1,
      "alternativas": ["uuid-alternativa-1", "uuid-alternativa-2"],
      "notas_peri_entreno": "nota si aplica"
    }
  ],
  "notas_generales": "...",
  "evidencia_cientifica": ["paper1"]
}
REGLA ABSOLUTA: receta_id y alternativas DEBEN ser IDs de la lista *_CANDIDATAS.`

  // Combina el contexto completo del cliente con las recetas disponibles
  const promptDieta = construirPrompt(
    {
      nombre: perfil?.nombre || 'Cliente',
      objetivo: onboarding.objetivo,
      kcal_objetivo: kcalObjetivo,
      proteina_g: distribucionProteina.total,
      carbos_g: carbos,
      grasas_g: grasas,
      peso_kg: cliente.peso_inicial ?? 70,
      edad: cliente.edad ?? 30,
      sexo: cliente.sexo ?? 'hombre',
      actividad: onboarding.actividad_base,
      dias_entreno: onboarding.dias_entreno,
      restricciones: onboarding.restricciones ?? [],
      condiciones: perfil?.condiciones_salud || 'ninguna',
      comidas_favoritas: perfil?.comidas_favoritas || '',
      nivel_cocina: onboarding.nivel_cocina,
      presupuesto: onboarding.presupuesto_semanal_eur?.toString() || '',
    },
    (plantillas ?? []).map(p => ({
      id: p.id,
      nombre: p.nombre,
      kcal_objetivo: p.kcal_objetivo,
      proteinas_objetivo: p.proteinas_objetivo,
      carbohidratos_objetivo: p.carbohidratos_objetivo,
      grasas_objetivo: p.grasas_objetivo,
    })),
    [...recetasPorId.values()].map(r => ({
      id: r.id,
      nombre: r.nombre,
      categoria: (r as unknown as Record<string, unknown>).categoria as string || 'Otras',
      kcal: r.kcal,
      proteinas: r.proteinas,
      carbohidratos: r.carbohidratos,
      grasas: r.grasas,
    })),
    contextoExtendido, // ← Aquí se inyecta TODO: evidencia, flags, mesociclo, proteína + candidatas por slot
  )

  // ── 11. Llamar a DeepSeek ──────────────────────────────────────────────────
  let planJson: Record<string, unknown> = {}
  let tokensUsados = 0
  let dietaIA: DietaGenerada | null = null
  const apiKey = process.env.DEEPSEEK_API_KEY

  try {
    if (apiKey) {
      // Estrategia: primero intentar generar dieta con recetas
      const resultado = await generarDietaConIA(promptDieta, contextoClinico || undefined)
      const dietaGenerada = resultado.data
      dietaIA = dietaGenerada
      tokensUsados = resultado.total_tokens

      // Mapear respuesta de DietaGenerada al formato del plan
      planJson = {
        kcal_objetivo: dietaGenerada.macros_totales.kcal,
        macros: {
          proteinas_g: dietaGenerada.macros_totales.proteinas,
          carbos_g: dietaGenerada.macros_totales.carbohidratos,
          grasas_g: dietaGenerada.macros_totales.grasas,
        },
        distribucion_proteina: distribucionProteina.comidas.map(c => ({
          nombre: c.nombre,
          orden: c.orden,
          proteinas_g: c.proteinas_g,
          leucina_g: c.leucina_g,
          mps_activada: c.mps_activada,
          es_post_entreno: c.es_post_entreno,
        })),
        alerta_mps: leucinaCheck.alerta,
        distribucion_comidas: dietaGenerada.comidas.map((c, index) => {
          const resolverReceta = (receta_id: string, receta_nombre: string) =>
            recetasPorId.get(receta_id) ??
            recetasPorNombre.get(receta_nombre.toLowerCase().trim()) ??
            [...recetasPorNombre.entries()].find(([k]) => k.includes(receta_nombre.toLowerCase().split(' ')[0]))?.[1]
          const kcalComida = c.alimentos.reduce((total, alimento) => {
            const receta = resolverReceta(alimento.receta_id, alimento.receta_nombre)
            return total + ((receta?.kcal ?? 0) * alimento.cantidad_porciones)
          }, 0)
          const proteinaComida = distribucionProteina.comidas[index]?.proteinas_g ?? Math.round((kcalComida * 0.30) / 4)
          const kcalFinal = Math.round(kcalComida || kcalObjetivo / Math.max(dietaGenerada.comidas.length, 1))
          return {
            nombre: c.nombre,
            orden: c.orden,
            porcentaje_kcal: kcalComida > 0 ? Math.round((kcalComida / dietaGenerada.macros_totales.kcal) * 100) : undefined,
            kcal: kcalFinal,
            kcal_target: kcalFinal,
            proteinas_target: proteinaComida,
            hora_sugerida: distribucionProteina.comidas[index]?.hora_sugerida ||
              ({ Desayuno: '08:00', Comida: '13:30', Merienda: '17:00', Cena: '20:30' } as Record<string, string>)[c.nombre] ||
              undefined,
            proteinas_g: proteinaComida,
            notas: `Proteína objetivo: ${proteinaComida}g`,
            recetas: c.alimentos.map(a => {
              const recetaReal = resolverReceta(a.receta_id, a.receta_nombre)
              return {
                receta_id: recetaReal?.id ?? a.receta_id,
                receta_nombre: recetaReal?.nombre ?? a.receta_nombre,
                cantidad_porciones: a.cantidad_porciones,
              }
            }),
          }
        }),
        plantilla_id_elegida: dietaGenerada.plantilla_id_elegida,
        razon_plantilla: dietaGenerada.razon_plantilla,
        notas_dieta: dietaGenerada.notas,
        mesociclo_plan: {
          objetivo: mesociclo.objetivo_mesociclo,
          semanas: mesociclo.semanas.map(s => ({
            tipo: s.tipo,
            kcal_modificador: s.kcal_modificador,
            cho_modificador: s.cho_modificador,
            etiqueta: s.etiqueta,
            notas: s.notas,
          })),
          duracion_dias: mesociclo.duracion_total_dias,
          alertas: mesociclo.alertas,
        },
        estrategia_adherencia: confianzaBaja
          ? 'Plan flexible con margen de error incorporado. La distribución de proteína asegura que cada comida activa MPS.'
          : 'Plan estructurado con distribución proteica optimizada por comida y mesociclo planificado.',
        valvula_escape: perfil?.comida_trampa
          ? `${perfil.comida_trampa} integrado como comida libre semanal planificada.`
          : 'Una comida libre semanal permitida. Mantener proteína alta incluso en comida libre.',
        recomendaciones: [
          `Proteína distribuida en ${distribucionProteina.comidas.length} comidas para maximizar MPS.${leucinaCheck.alerta ? ` ⚠️ ${leucinaCheck.alerta}` : ''}`,
          mesociclo.semanas.length > 0 ? `Mesociclo planificado: ${mesociclo.semanas[0]?.etiqueta}.` : 'Plan inicial. Se ajustará según evolución.',
          dietaGenerada.notas ? dietaGenerada.notas : 'Seguir distribución de comidas sugerida. Ajustar porciones según hambre y energía.',
        ],
        evidencia_cientifica: protocolos.map(p => ({
          titulo: p.titulo,
          tags: p.tags,
          referencias: p.referencias,
          resumen: p.resumen.slice(0, 200),
        })),
        alertas_coach: [
          ...(confianzaBaja ? ['Autoeficacia baja — revisar expectativas'] : []),
          ...(duermePoco ? ['Sueño insuficiente — vigilar hambre y adherencia'] : []),
          ...(estresAlto ? ['Estrés alto — riesgo de alimentación emocional'] : []),
          ...(leucinaCheck.alerta ? [leucinaCheck.alerta] : []),
          ...(mesociclo.alertas.length > 0 ? mesociclo.alertas : []),
        ],
        notas_cliente: dietaIA?.notas_cliente ?? null,
        protocolo_semana: dietaIA?.protocolo_semana ?? null,
        justificacion_coach: dietaIA?.justificacion_coach ?? null,
        notas_coach: [
          `TDEE: ${tdee} kcal → objetivo: ${kcalObjetivo} kcal`,
          `Proteína: ${distribucionProteina.total}g/día (${distribucionProteina.g_por_kg.toFixed(1)}g/kg) — ref. ${onboarding.objetivo === 'rendimiento' ? 'ISSN 2017' : onboarding.objetivo === 'perder_grasa' ? 'Helms et al. 2014' : 'Morton 2018 BJSM'}`,
          `Mesociclo: ${mesociclo.duracion_total_dias} días — ${mesociclo.objetivo_mesociclo}`,
          metodologia ? 'Metodología del coach aplicada.' : 'Modo evidence-based puro.',
          dietaIA?.justificacion_coach?.razonamiento_macros ?? '',
        ].filter(Boolean).join('\n'),
      }

      // ── 11b. Validar y resolver recetas DeepSeek (garantizar IDs válidos) ──────
      try {
        const planValidado = validarYResolverRecetas(
          planJson as unknown as PlanDeepSeekValidado,
          candidatasPorSlot
        )
        if (planValidado.distribucion_comidas) {
          const comidasActuales = planJson.distribucion_comidas as Array<Record<string, unknown>>
          planValidado.distribucion_comidas.forEach((validada, i) => {
            if (comidasActuales[i]) {
              comidasActuales[i].receta_id = validada.receta_id
              comidasActuales[i].receta_nombre = validada.receta_nombre
              comidasActuales[i].alternativas = validada.alternativas
              comidasActuales[i].kcal_target = validada.kcal_target
              comidasActuales[i].proteinas_target = validada.proteinas_target
              comidasActuales[i].recetas = [{
                receta_id: validada.receta_id,
                receta_nombre: validada.receta_nombre,
                cantidad_porciones: 1,
              }]
            }
          })
        }
      } catch {
        // Validation failed — continue with original planJson
      }
    }
  } catch (err) {
    // DeepSeek failed — use fallback
    console.error('DeepSeek falló, usando plan de respaldo:', err instanceof Error ? err.message : 'error')
  }

  // ── 12. Fallback: plan calculado localmente ─────────────────────────────────
  if (!planJson.kcal_objetivo) {
    const horaBase = perfil?.hora_primera_ingesta ?? '08:00'
    planJson = {
      kcal_objetivo: kcalObjetivo,
      macros: {
        proteinas_g: distribucionProteina.total,
        carbos_g: carbos,
        grasas_g: grasas,
      },
      distribucion_proteina: distribucionProteina.comidas.map(c => ({
        nombre: c.nombre,
        orden: c.orden,
        proteinas_g: c.proteinas_g,
        leucina_g: c.leucina_g,
        mps_activada: c.mps_activada,
        es_post_entreno: c.es_post_entreno,
      })),
      alerta_mps: leucinaCheck.alerta,
      distribucion_comidas: [
        { nombre: 'Desayuno', orden: 1, porcentaje_kcal: 25, kcal: Math.round(kcalObjetivo * 0.25), hora_sugerida: horaBase, notas: `Proteína: ${distribucionProteina.comidas[0]?.proteinas_g ?? 25}g para activar MPS` },
        { nombre: 'Comida', orden: 2, porcentaje_kcal: 35, kcal: Math.round(kcalObjetivo * 0.35), hora_sugerida: '13:30', notas: `Proteína: ${distribucionProteina.comidas[1]?.proteinas_g ?? 35}g${distribucionProteina.comidas[1]?.es_post_entreno ? ' [POST-ENTRENO]' : ''}` },
        { nombre: 'Merienda', orden: 3, porcentaje_kcal: 15, kcal: Math.round(kcalObjetivo * 0.15), hora_sugerida: '17:00', notas: `Proteína: ${distribucionProteina.comidas[2]?.proteinas_g ?? 20}g` },
        { nombre: 'Cena', orden: 4, porcentaje_kcal: 25, kcal: Math.round(kcalObjetivo * 0.25), hora_sugerida: perfil?.hora_ultima_ingesta ?? '20:30', notas: `Proteína: ${distribucionProteina.comidas[3]?.proteinas_g ?? 25}g para MPS nocturna` },
      ].map((comida) => {
        const candidata = candidatasPorSlot.get(comida.nombre)?.[0]
        return {
          ...comida,
          kcal_target: comida.kcal,
          proteinas_target: distribucionProteina.comidas[(comida.orden as number) - 1]?.proteinas_g ?? null,
          receta_id: candidata?.id,
          receta_nombre: candidata?.nombre,
          alternativas: candidatasPorSlot.get(comida.nombre)?.slice(1, 3).map(r => r.id) ?? [],
          recetas: candidata ? [{
            receta_id: candidata.id,
            receta_nombre: candidata.nombre,
            cantidad_porciones: 1,
          }] : [],
        }
      }),
      mesociclo_plan: {
        objetivo: mesociclo.objetivo_mesociclo,
        semanas: mesociclo.semanas.map(s => ({
          tipo: s.tipo,
          kcal_modificador: s.kcal_modificador,
          cho_modificador: s.cho_modificador,
          etiqueta: s.etiqueta,
          notas: s.notas,
        })),
        duracion_dias: mesociclo.duracion_total_dias,
        alertas: mesociclo.alertas,
      },
      estrategia_adherencia: confianzaBaja
        ? 'Plan flexible con margen de error incorporado. La distribución de proteína asegura que cada comida activa MPS.'
        : 'Plan estructurado con distribución proteica optimizada.',
      valvula_escape: perfil?.comida_trampa
        ? `${perfil.comida_trampa} integrado como comida libre semanal.`
        : 'Una comida libre semanal permitida.',
      recomendaciones: [
        `Proteína distribuida en ${distribucionProteina.comidas.length} comidas.${leucinaCheck.alerta ? ` ⚠️ ${leucinaCheck.alerta}` : ''}`,
        'Plan generado localmente (DeepSeek no disponible). El coach revisará y personalizará.',
      ],
      alertas_coach: [
        ...(confianzaBaja ? ['Autoeficacia baja — revisar expectativas'] : []),
        ...(duermePoco ? ['Sueño insuficiente — vigilar hambre'] : []),
        ...(estresAlto ? ['Estrés alto — alimentación emocional'] : []),
        ...(leucinaCheck.alerta ? [leucinaCheck.alerta] : []),
        ...(mesociclo.alertas.length > 0 ? mesociclo.alertas : []),
      ],
      notas_coach: `[FALLBACK] Cliente nuevo. Objetivo: ${onboarding.objetivo}. TDEE: ${tdee} kcal. Proteína estratégica: ${distribucionProteina.total}g/día. Mesociclo planificado. Autoeficacia: ${perfil?.autoeficacia ?? '?'}/10.`,
    }
  }

  // ── 12b. Validación de micronutrientes (Gap #7) ─────────────────────────────
  // Se ejecuta sobre las comidas generadas (IA o fallback) para verificar targets
  const comidasParaValidar = (planJson.distribucion_comidas as Array<Record<string, unknown>> ?? []).map((c: Record<string, unknown>) => ({
    nombre: c.nombre as string,
    recetas: (c.recetas as Array<Record<string, unknown>> ?? []).map((r: Record<string, unknown>) => {
      const recetaFull =
        recetasPorId.get(r.receta_id as string) ??
        recetasPorNombre.get((r.receta_nombre as string ?? '').toLowerCase().trim())
      return {
        kcal: recetaFull?.kcal ?? 0,
        proteinas: recetaFull?.proteinas ?? 0,
        carbohidratos: recetaFull?.carbohidratos ?? 0,
        grasas: recetaFull?.grasas ?? 0,
        cantidad_porciones: (r.cantidad_porciones as number) ?? 1,
      }
    }),
  }))
  const validacionMicronutrientes = validarMicronutrientes({
    comidas: comidasParaValidar,
    condicionesSalud: perfil?.condiciones_salud?.split(',').map((s: string) => s.trim()) ?? [],
    edad: cliente.edad ?? 30,
    objetivo: onboarding.objetivo,
  })

  // ── 12c. Micro-learning — píldoras educativas para el inicio del plan (Gap #8) ──
  const pildorasInicio = seleccionarPildoras({
    clienteId: cliente_id,
    semanaPlan: 1,
    objetivo: onboarding.objetivo,
    condicionesSalud: perfil?.condiciones_salud?.split(',').map((s: string) => s.trim()) ?? [],
    flagsPsicologicos: { confianzaBaja, esInflexible, tieneAnsiedad, duermePoco, estresAlto },
    segmento,
    adherencia: 100,
    pesoInicial: cliente.peso_inicial ?? undefined,
    edad: cliente.edad ?? 30,
    sexo: cliente.sexo ?? undefined,
    sportModality: perfilEntreno?.sport_modality ?? undefined,
  })

  // Añadir validación y píldoras al planJson
  const planJsonConEnriquecimiento = {
    ...planJson,
    validacion_micronutrientes: validacionMicronutrientes,
    pildoras_educativas_inicio: pildorasInicio,
    recomendacion_entreno: recomendacionEntreno,
    nutricion_peri_entreno: recomendacionPeriEntreno,
  }
  planJson = planJsonConEnriquecimiento as Record<string, unknown>

  // ── 13. PERSISTIR plan en tablas reales ──────────────────────────────────────
  // Sin esto, alimentos y recetas NO aparecen en la UI del coach/cliente
  let planId: string | null = null
  try {
    const codigoPublico = crypto.randomUUID().slice(0, 10)
    const comidasData = (planJson.distribucion_comidas as Array<Record<string, unknown>> ?? [])
    const descripcion = (planJson.notas_dieta as string) ||
      (planJson.notas_coach as string) ||
      ('Plan nutricional para ' + onboarding.objetivo.replace(/_/g, ' '))

    // 13a. Crear el plan en BD
    const { data: planDb, error: planDbError } = await supabase
      .from('planes_nutricion')
      .insert({
        coach_id: cliente.coach_id,
        cliente_id: cliente_id,
        nombre: 'Plan ' + onboarding.objetivo.replace(/_/g, ' '),
        descripcion: descripcion,
        kcal_objetivo: planJson.kcal_objetivo as number,
        proteinas_objetivo: (planJson.macros as any)?.proteinas_g ?? null,
        carbohidratos_objetivo: (planJson.macros as any)?.carbos_g ?? null,
        grasas_objetivo: (planJson.macros as any)?.grasas_g ?? null,
        activo: true,
        generado_por_ia: true,
        codigo_publico: codigoPublico,
      })
      .select()
      .single()

    if (planDbError) throw planDbError
    planId = planDb.id

    // 13b. Crear comidas y expandir recetas en ingredientes reales
    for (const comida of comidasData) {
      const recetasNormalizadas = (() => {
        const directas = (comida.recetas as Array<Record<string, unknown>> | undefined) ?? []
        if (directas.length > 0) return directas
        const recetaId = comida.receta_id as string | undefined
        const recetaNombre = comida.receta_nombre as string | undefined
        return recetaId || recetaNombre
          ? [{
              receta_id: recetaId,
              receta_nombre: recetaNombre,
              cantidad_porciones: comida.cantidad_porciones ?? 1,
            }]
          : []
      })()
      const recetaIdPrincipal = (recetasNormalizadas[0]?.receta_id as string | undefined) ?? null
      const { data: comidaDb, error: comidaError } = await supabase
        .from('comidas')
        .insert({
          plan_id: planDb.id,
          nombre: comida.nombre as string,
          orden: (comida.orden as number) ?? 0,
          hora_sugerida: (comida.hora_sugerida as string) || null,
          alternativas_receta_ids: ((comida.alternativas as string[] | undefined) ?? []).length > 0
            ? (comida.alternativas as string[])
            : null,
          kcal_target: (comida.kcal_target as number) || null,
          proteinas_target: (comida.proteinas_target as number) || null,
          notas_peri_entreno: (comida.notas_peri_entreno as string) || null,
          receta_id: recetaIdPrincipal || null,
        })
        .select()
        .single()

      if (comidaError || !comidaDb) {
        console.error('Error creando comida:', comida.nombre, comidaError)
        continue
      }

      for (let recetaIndex = 0; recetaIndex < recetasNormalizadas.length; recetaIndex++) {
        const r = recetasNormalizadas[recetaIndex]
        const recetaId = r.receta_id as string | undefined
        const recetaNombre = (r.receta_nombre as string | undefined) ?? ''
        const cantPorciones = (r.cantidad_porciones as number) ?? 1
        const recetaResolved = (recetaId ? recetasPorId.get(recetaId) : undefined) ??
          recetasPorNombre.get(recetaNombre.toLowerCase().trim()) ??
          [...recetasPorNombre.entries()].find((e) =>
            e[0].includes(recetaNombre.toLowerCase().split(' ')[0])
          )?.[1]

        // Si la IA devuelve ID/nombre inválido, usar el mejor candidato real del slot
        const recetaFull = recetaResolved ??
          (candidatasPorSlot.get(comida.nombre as string) ?? [...candidatasPorSlot.values()].flat())[0]

        if (!recetaFull) {
          console.warn('[generar-plan-inicial] Sin candidatos para slot, omitiendo:', comida.nombre, recetaNombre)
          continue
        }

        const targetKcalComida = (comida.kcal_target as number) || Math.round(kcalObjetivo / (comidasData?.length ?? 4))
        try {
          await aplicarRecetaAComida(supabase, {
            comidaId: comidaDb.id,
            recetaId: recetaFull.id,
            clienteId: cliente_id,
            planId: planDb.id,
            comidaSlot: comida.nombre as string,
            targetKcal: targetKcalComida * cantPorciones,
            tipoInteraccion: 'asignada_plan',
            reemplazar: recetaIndex === 0,
          })
        } catch (err) {
          console.error('[generar-plan-inicial] Error expandiendo receta en ingredientes:', recetaFull.nombre, err)
        }
      }
    }
  } catch (err) {
    console.error('[generar-plan-inicial] Error persistiendo plan en BD:', err)
  }

  // ── 13c. Crear entrenamiento inicial si el cliente aún no tiene plan activo ──
  let planEntrenoId: string | null = null
  try {
    const { data: entrenoActivo } = await supabase
      .from('planes_entrenamiento')
      .select('id')
      .eq('cliente_id', cliente_id)
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const plantillaRecomendada = plantillasEntrenoRecomendadas?.[0]
    if (!entrenoActivo && plantillaRecomendada?.id) {
      planEntrenoId = await crearPlanEntrenoDesdePlantilla(supabase, {
        clienteId: cliente_id,
        coachId: cliente.coach_id,
        plantillaId: plantillaRecomendada.id,
        nombre: `Plan inicial — ${plantillaRecomendada.nombre}`,
      })
    }
  } catch (err) {
    console.error('[generar-plan-inicial] Error creando entrenamiento inicial:', err)
  }

  // ── 14. Save to registros_ia ───────────────────────────────────────────────
  try {
    await supabase.from('registros_ia').insert({
      coach_id: cliente.coach_id,
      cliente_id,
      tipo: 'dieta',
      prompt: promptDieta,
      respuesta_json: {
        ...planJson,
        dieta_ia_raw: dietaIA ?? undefined, // Guardar la respuesta cruda de la IA
        plan_nutricion_id: planId,
        plan_entrenamiento_id: planEntrenoId,
      },
      modelo: DEEPSEEK_MODEL,
      tokens_usados: tokensUsados,
    })
  } catch {
    // Non-critical
  }

  // ── 15. Mark cliente as pending review ──────────────────────────────────────
  await supabase
    .from('clientes')
    .update({ revisado_por_coach: false })
    .eq('id', cliente_id)

  // Notify coach via Make.com (fire-and-forget)
  const webhookUrl = process.env.MAKE_WEBHOOK_NUEVO_CLIENTE
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id,
        kcal_objetivo: planJson.kcal_objetivo,
        tiene_recetas: !!dietaIA,
        proteinas_distribuidas: distribucionProteina.comidas.length,
        mesociclo: mesociclo.objetivo_mesociclo,
      }),
    }).catch(() => { })
  }

  return NextResponse.json({
    ok: true,
    plan: planJson,
    modo: dietaIA ? 'ia_con_recetas' : 'fallback',
    distribucion_proteina: {
      total: distribucionProteina.total,
      g_por_kg: distribucionProteina.g_por_kg,
      comidas: distribucionProteina.comidas,
      alerta_mps: leucinaCheck.alerta,
    },
    mesociclo: {
      objetivo: mesociclo.objetivo_mesociclo,
      duracion_dias: mesociclo.duracion_total_dias,
      semanas: mesociclo.semanas.length,
      alertas: mesociclo.alertas,
    },
  })
}
