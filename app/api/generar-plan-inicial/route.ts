import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { seleccionarProtocolos, formatearEvidenciaParaPrompt } from '@/lib/knowledge-base'
import { construirPrompt, generarDietaConIA, type DietaGenerada } from '@/lib/deepseek'
import { distribuirProteinas, verificarLeucina } from '@/lib/distribucion-proteinas'
import { planificarMesociclo, formatearMesociclo } from '@/lib/periodizacion/mesociclo'
import { evaluarPerfilEntreno, filtrarPlantillasPorPerfil } from '@/lib/motor-entreno'
import { generarRecomendacionPeriEntreno, formatearPeriEntrenoParaPrompt } from '@/lib/nutricion-peri-entreno'
import { validarMicronutrientes } from '@/lib/validacion-micronutrientes'
import { seleccionarPildoras } from '@/lib/micro-learning'
import type { MetodologiaCoach } from '@/types'

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

function calcularTDEE(peso: number, altura: number, edad: number, sexo: string, actividad: string): number {
  const tmb =
    sexo === 'mujer'
      ? 10 * peso + 6.25 * altura - 5 * edad - 161
      : 10 * peso + 6.25 * altura - 5 * edad + 5
  const factor = ACTIVIDAD_FACTOR[actividad] ?? 1.55
  return Math.round(tmb * factor)
}

export async function POST(request: NextRequest) {
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
    .maybeSingle() as { data: MetodologiaCoach | null }

  // ── 1b. Fetch perfil de entreno (Gap #9) ──────────────────────────────────
  const { data: perfilEntreno } = await supabase
    .from('perfil_entreno_cliente')
    .select('*')
    .eq('cliente_id', cliente_id)
    .maybeSingle()

  // ── 1c. Fetch plantillas de entrenamiento ──────────────────────────────────
  const { data: plantillasEntreno } = await supabase
    .from('plantillas_entrenamiento')
    .select('*')
    .eq('coach_id', cliente.coach_id)

  // ── 1d. Evaluar motor de entreno (Gap #9) ─────────────────────────────────
  let recomendacionEntreno = null
  let plantillasEntrenoRecomendadas = null
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
  const protocolos = seleccionarProtocolos({
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

  // ── 6. Build methodology prompt block ──────────────────────────────────────
  const metodologiaBlock = metodologia
    ? `
═══ METODOLOGÍA DEL COACH (reglas obligatorias) ═══
${metodologia.reglas_fijas?.length ? metodologia.reglas_fijas.map((r: string) => `- ✓ ${r}`).join('\n') : ''}
- Estilo de alimentación preferido: ${metodologia.estilos_dieta?.join(', ') || 'flexible'}
- Déficit máximo permitido: ${metodologia.deficit_maximo_kcal} kcal
- Superávit máximo permitido: ${metodologia.superavit_maximo_kcal} kcal
- Nº comidas habitual: ${metodologia.num_comidas_default}
${metodologia.filosofia_coaching ? `\nFilosofía del coach:\n"${metodologia.filosofia_coaching}"` : ''}`
    : ''

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

${evidenciaBlock ? `\n${evidenciaBlock}\n` : ''}${metodologiaBlock ? `\n${metodologiaBlock}\n` : ''}

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

  const { data: recetas } = await supabase
    .from('recetas')
    .select('id, nombre, categoria, kcal, proteinas, carbohidratos, grasas, azucares, sodio_mg, fibra')
  const recetasDisponibles = recetas ?? []
  const recetasPorId = new Map(recetasDisponibles.map(r => [r.id, r]))

  // ── 10. Construir el prompt final con recetas ──────────────────────────────
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
    recetasDisponibles.map(r => ({
      id: r.id,
      nombre: r.nombre,
      categoria: r.categoria || 'Otras',
      kcal: r.kcal,
      proteinas: r.proteinas,
      carbohidratos: r.carbohidratos,
      grasas: r.grasas,
      azucares: r.azucares,
      sodio_mg: r.sodio_mg,
      fibra: r.fibra,
    })),
    contextoCompleto, // ← Aquí se inyecta TODO: evidencia, flags, mesociclo, proteína
  )

  // ── 11. Llamar a DeepSeek ──────────────────────────────────────────────────
  let planJson: Record<string, unknown> = {}
  let tokensUsados = 0
  let dietaIA: DietaGenerada | null = null
  const apiKey = process.env.DEEPSEEK_API_KEY

  try {
    if (apiKey) {
      // Estrategia: primero intentar generar dieta con recetas
      const resultado = await generarDietaConIA(promptDieta)
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
          const kcalComida = c.alimentos.reduce((total, alimento) => {
            const receta = recetasPorId.get(alimento.receta_id)
            return total + ((receta?.kcal ?? 0) * alimento.cantidad_porciones)
          }, 0)
          const proteinaComida = distribucionProteina.comidas[index]?.proteinas_g ?? Math.round((kcalComida * 0.30) / 4)
          return {
            nombre: c.nombre,
            orden: c.orden,
            porcentaje_kcal: kcalComida > 0 ? Math.round((kcalComida / dietaGenerada.macros_totales.kcal) * 100) : undefined,
            kcal: Math.round(kcalComida || kcalObjetivo / Math.max(dietaGenerada.comidas.length, 1)),
            hora_sugerida: distribucionProteina.comidas[index]?.hora_sugerida || undefined,
            proteinas_g: proteinaComida,
            notas: `Proteína objetivo: ${proteinaComida}g`,
            recetas: c.alimentos.map(a => ({
              receta_id: a.receta_id,
              receta_nombre: a.receta_nombre,
              cantidad_porciones: a.cantidad_porciones,
            })),
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
        alertas_coach: [
          ...(confianzaBaja ? ['Autoeficacia baja — revisar expectativas'] : []),
          ...(duermePoco ? ['Sueño insuficiente — vigilar hambre y adherencia'] : []),
          ...(estresAlto ? ['Estrés alto — riesgo de alimentación emocional'] : []),
          ...(leucinaCheck.alerta ? [leucinaCheck.alerta] : []),
          ...(mesociclo.alertas.length > 0 ? mesociclo.alertas : []),
        ],
        notas_coach: `Cliente nuevo. Objetivo: ${onboarding.objetivo}. TDEE: ${tdee} kcal. Proteína: ${distribucionProteina.total}g/día (${distribucionProteina.g_por_kg.toFixed(1)}g/kg) distribuida estratégicamente. Plan de ${mesociclo.duracion_total_dias} días. Autoeficacia: ${perfil?.autoeficacia ?? '?'}/10.`,
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
      ],
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
      const recetaFull = recetasPorId.get(r.receta_id as string)
      return {
        kcal: recetaFull?.kcal ?? 0,
        proteinas: recetaFull?.proteinas ?? 0,
        carbohidratos: recetaFull?.carbohidratos ?? 0,
        grasas: recetaFull?.grasas ?? 0,
        fibra: recetaFull?.fibra,
        azucares: recetaFull?.azucares,
        sodio_mg: recetaFull?.sodio_mg,
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

  // ── 13. Save to registros_ia ───────────────────────────────────────────────
  try {
    await supabase.from('registros_ia').insert({
      coach_id: cliente.coach_id,
      cliente_id,
      tipo: 'dieta',
      prompt: promptDieta,
      respuesta_json: {
        ...planJson,
        dieta_ia_raw: dietaIA ?? undefined, // Guardar la respuesta cruda de la IA
      },
      modelo: DEEPSEEK_MODEL,
      tokens_usados: tokensUsados,
    })
  } catch {
    // Non-critical
  }

  // ── 14. Mark cliente as pending review ──────────────────────────────────────
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
