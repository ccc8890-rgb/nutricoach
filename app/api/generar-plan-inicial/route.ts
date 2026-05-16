import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'

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

  // Fetch deep profile (optional — may not exist yet)
  const { data: perfil } = await supabase
    .from('onboarding_perfil_profundo')
    .select('*')
    .eq('cliente_id', cliente_id)
    .single()

  const tdee = calcularTDEE(
    cliente.peso_inicial ?? 70,
    cliente.altura ?? 170,
    cliente.edad ?? 30,
    cliente.sexo ?? 'hombre',
    onboarding.actividad_base,
  )
  const kcalObjetivo = tdee + (OBJETIVO_AJUSTE[onboarding.objetivo] ?? 0)
  const proteinas = Math.round((cliente.peso_inicial ?? 70) * 2)
  const grasas = Math.round((kcalObjetivo * 0.28) / 9)
  const carbos = Math.round((kcalObjetivo - proteinas * 4 - grasas * 9) / 4)

  // Build timing context for circadian nutrition
  const ventanaAlimentacion = perfil?.hora_primera_ingesta && perfil?.hora_ultima_ingesta
    ? `Ventana de alimentación: ${perfil.hora_primera_ingesta} - ${perfil.hora_ultima_ingesta}`
    : ''

  // Behavioral flags for the AI
  const esInflexible = perfil?.todo_o_nada === 'si'
  const tieneAnsiedad = ['ansiedad', 'conflicto'].includes(perfil?.relacion_comida ?? '')
  const duermePoco = (perfil?.horas_sueno ?? 7) < 6
  const estresAlto = (perfil?.nivel_estres ?? 0) >= 4
  const confianzaBaja = (perfil?.autoeficacia ?? 10) < 7

  // ── Segment-specific prompt modules ────────────────────────────────────────
  const segmento = onboarding.segmento || 'standard'
  const isPerf = segmento === 'performance' || segmento === 'elite'
  const isElite = segmento === 'elite'

  const SEGMENTO_LABELS: Record<string, string> = {
    standard: 'Esencial — pérdida de peso / salud general',
    recomposicion: 'Avanzado — recomposición corporal / estética',
    performance: 'Pro — atleta recreacional / semi-atleta',
    elite: 'Élite — competición / físico élite',
  }

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

  const prompt = `Eres Carlos Casanova, dietista titulado. Genera un plan nutricional inicial altamente personalizado en JSON.

═══ SEGMENTO DE CLIENTE ═══
- Segmento: ${SEGMENTO_LABELS[segmento] || segmento}
${segmentoFlag}

═══ DATOS FÍSICOS Y OBJETIVO ═══
- Objetivo: ${onboarding.objetivo}
- TDEE calculado (Mifflin-St Jeor): ${tdee} kcal/día
- Kcal objetivo ajustado: ${kcalObjetivo} kcal/día
- Macros objetivo: ${proteinas}g proteína | ${carbos}g carbohidratos | ${grasas}g grasa
- Sexo: ${cliente.sexo ?? 'no especificado'} | Edad: ${cliente.edad ?? '?'} | Peso: ${cliente.peso_inicial ?? '?'}kg

═══ ACTIVIDAD Y ENTRENAMIENTO ═══
- Nivel actividad: ${onboarding.actividad_base} (${onboarding.dias_entreno} días/semana, ${onboarding.duracion_sesion_min} min/sesión)
- Tipos de entrenamiento: ${onboarding.tipo_entreno?.join(', ') || 'no especificado'}
${perfil?.hora_entreno ? `- Hora habitual de entreno: ${perfil.hora_entreno}` : ''}
${perfil?.descripcion_semana_entreno ? `- Descripción semana tipo: ${perfil.descripcion_semana_entreno}` : ''}
${perfil?.fecha_competicion ? `- COMPETICIÓN PRÓXIMA: ${perfil.fecha_competicion} (${perfil.tipo_competicion || 'tipo no especificado'})` : ''}
${perfil?.nutricion_peri_entreno ? `- Nutrición peri-entreno actual: ${perfil.nutricion_peri_entreno}` : ''}

═══ RESTRICCIONES Y PREFERENCIAS ALIMENTARIAS ═══
- Intolerancias/alergias: ${onboarding.restricciones?.join(', ') || 'ninguna'}
- Alimentos no deseados (wizard): ${onboarding.alimentos_no_gustan || 'ninguno'}
${perfil?.alimentos_evitar_extra ? `- Alimentos que no comería nunca: ${perfil.alimentos_evitar_extra}` : ''}
${perfil?.comidas_favoritas ? `- COMIDAS QUE LE ENCANTAN (incluir en el plan): ${perfil.comidas_favoritas}` : ''}
${perfil?.suplementos ? `- Suplementos actuales: ${perfil.suplementos}` : ''}
${perfil?.alcohol_semanal ? `- Consumo de alcohol semanal: ${perfil.alcohol_semanal} unidades` : ''}

═══ ALIMENTACIÓN REAL HOY ═══
${perfil?.dia_tipico ? `- Día típico actual del cliente: ${perfil.dia_tipico}` : '- Sin información de hábitos actuales'}

═══ LOGÍSTICA Y COCINA ═══
- Nivel cocina: ${onboarding.nivel_cocina}
- Tiempo para cocinar: ${onboarding.tiempo_cocina_min} min/día
${onboarding.presupuesto_semanal_eur ? `- Presupuesto semanal: ${onboarding.presupuesto_semanal_eur}€` : ''}
${perfil?.con_quien_come?.length ? `- Come habitualmente con: ${perfil.con_quien_come.join(', ')}` : ''}
${perfil?.frecuencia_fuera ? `- Come fuera de casa: ${perfil.frecuencia_fuera} veces/semana` : ''}
${perfil?.comida_trampa ? `- "Válvula de escape" planificada: ${perfil.comida_trampa}` : ''}

═══ HORARIOS Y TIMING ═══
${ventanaAlimentacion}
${perfil?.hora_comida_principal ? `- Comida principal: ${perfil.hora_comida_principal}` : ''}
${perfil?.patrones_energia?.length ? `- Patrones de energía reportados: ${perfil.patrones_energia.join(', ')}` : ''}

═══ SALUD Y BIENESTAR ═══
${perfil?.condiciones_salud ? `- Condiciones de salud / medicación: ${perfil.condiciones_salud}` : '- Sin condiciones reportadas'}
- Sueño: ${perfil?.horas_sueno ?? 7}h/noche, calidad ${perfil?.calidad_sueno ?? '?'}/5
- Estrés habitual: ${perfil?.nivel_estres ?? '?'}/5

═══ PERFIL PSICOLÓGICO Y ADHERENCIA ═══
- Confianza en seguir el plan: ${perfil?.autoeficacia ?? '?'}/10
- Historial dietas: ${perfil?.historial_dietas?.join(', ') || 'ninguna anterior'}
${perfil?.razones_abandono?.length ? `- Razones de abandono anteriores: ${perfil.razones_abandono.join(', ')}` : ''}
- Relación con la comida: ${perfil?.relacion_comida || 'no especificada'}
- Mentalidad "todo o nada": ${perfil?.todo_o_nada || 'no especificada'}
${perfil?.trigger_onboarding ? `- Motivación para buscar ayuda: ${perfil.trigger_onboarding}` : ''}
${analisisBlock}${composicionBlock}${testsBlock}

═══ FLAGS DE PERSONALIZACIÓN CRÍTICOS ═══
${confianzaBaja ? '⚠️ CONFIANZA BAJA (<7): diseñar plan FLEXIBLE con margen del 20%, evitar restricciones duras.' : ''}
${esInflexible ? '⚠️ MENTALIDAD TODO-O-NADA: incluir días de flex integrados, nunca alimentos "prohibidos absolutos".' : ''}
${tieneAnsiedad ? '⚠️ RELACIÓN COMPLEJA CON COMIDA: evitar lenguaje de culpa, incluir permiso explícito para la válvula de escape.' : ''}
${duermePoco ? '⚠️ SUEÑO <6H: aumentar proteína en snacks para controlar grelina, anticipar hambre extra de 300-500 kcal.' : ''}
${estresAlto ? '⚠️ ESTRÉS ALTO: incluir snacks de control anti-ansiedad (proteína+fibra), aceptar mayor variabilidad calórica.' : ''}

Responde SOLO con este JSON (sin markdown):
{
  "kcal_objetivo": número,
  "macros": { "proteinas_g": número, "carbos_g": número, "grasas_g": número },
  "distribucion_comidas": [
    { "nombre": string, "porcentaje_kcal": número, "kcal": número, "hora_sugerida": "HH:MM", "notas": "string breve" }
  ],
  "estrategia_adherencia": "1-2 frases sobre cómo adaptar el plan a su perfil psicológico concreto",
  "valvula_escape": "cómo integrar su comida trampa sin destruir el plan",
  "recomendaciones": ["máx 4 frases cortas accionables y específicas para ESTE cliente"],
  "alertas_coach": ["alertas o puntos de atención específicos para que el coach los vigile"],
  "notas_coach": "párrafo con los puntos clave del perfil — qué vigilar, qué evitar, qué potenciar"
}`

  let planJson: Record<string, unknown> = {}
  let tokensUsados = 0

  try {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (apiKey) {
      const res = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: 'system', content: 'Eres un dietista experto. Respondes solo con JSON válido en español.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content ?? ''
        const match = content.match(/\{[\s\S]*\}/)
        if (match) planJson = JSON.parse(match[0])
        tokensUsados = data.usage?.total_tokens ?? 0
      }
    }
  } catch {
    // Plan generation failed — save what we have and continue
  }

  // If DeepSeek failed, build a minimal plan from our calculations
  if (!planJson.kcal_objetivo) {
    const horaBase = perfil?.hora_primera_ingesta ?? '08:00'
    planJson = {
      kcal_objetivo: kcalObjetivo,
      macros: { proteinas_g: proteinas, carbos_g: carbos, grasas_g: grasas },
      distribucion_comidas: [
        { nombre: 'Desayuno', porcentaje_kcal: 25, kcal: Math.round(kcalObjetivo * 0.25), hora_sugerida: horaBase, notas: '' },
        { nombre: 'Comida', porcentaje_kcal: 35, kcal: Math.round(kcalObjetivo * 0.35), hora_sugerida: '13:30', notas: '' },
        { nombre: 'Merienda', porcentaje_kcal: 15, kcal: Math.round(kcalObjetivo * 0.15), hora_sugerida: '17:00', notas: '' },
        { nombre: 'Cena', porcentaje_kcal: 25, kcal: Math.round(kcalObjetivo * 0.25), hora_sugerida: perfil?.hora_ultima_ingesta ?? '20:30', notas: '' },
      ],
      estrategia_adherencia: confianzaBaja ? 'Plan flexible con margen de error incorporado.' : 'Plan estructurado con flexibilidad semanal.',
      valvula_escape: perfil?.comida_trampa ? `${perfil.comida_trampa} integrado como comida libre semanal planificada.` : 'Una comida libre semanal permitida.',
      recomendaciones: ['Plan generado. El coach revisará y personalizará en detalle.'],
      alertas_coach: [
        ...(confianzaBaja ? ['Autoeficacia baja — revisar expectativas'] : []),
        ...(duermePoco ? ['Sueño insuficiente — vigilar hambre y adherencia'] : []),
        ...(estresAlto ? ['Estrés alto — riesgo de alimentación emocional'] : []),
      ],
      notas_coach: `Cliente nuevo. Objetivo: ${onboarding.objetivo}. TDEE: ${tdee} kcal. Autoeficacia: ${perfil?.autoeficacia ?? '?'}/10.`,
    }
  }

  // Save to registros_ia
  try {
    await supabase.from('registros_ia').insert({
      coach_id: cliente.coach_id,
      cliente_id,
      tipo: 'plan_inicial',
      prompt,
      respuesta_json: planJson,
      modelo: DEEPSEEK_MODEL,
      tokens_usados: tokensUsados,
    })
  } catch {
    // Non-critical — continue
  }

  // Mark cliente as pending review
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
      body: JSON.stringify({ cliente_id, kcal_objetivo: planJson.kcal_objetivo }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, plan: planJson })
}
