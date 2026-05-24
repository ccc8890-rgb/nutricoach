// ================================================================
// AGENTE REVISOR SEMANAL — Árbol de decisión 19 nodos
// Analiza progreso del cliente y propone ajustes al plan.
// Se ejecuta automáticamente cada lunes para cada cliente activo.
// ================================================================

import { llamarDeepSeek, cargarContextoCliente, guardarTareaAgente } from './executor'
import { obtenerInformeVigente } from '@/lib/inteligencia-clinica'
import { obtenerPerfilCliente } from './perfil-gusto'
import { obtenerPatronesRelevantes } from './aprendizaje-colectivo'
import type { ContextoCliente, ResultadoAgente } from './types'

// ── Tipos del árbol de decisión ───────────────────────────────
interface EvaluacionNodo {
  nodo: string
  resultado: string
  valor?: number
  umbral?: number
  confianza: number     // 0-1, cuánto peso tiene este nodo en la decisión final
}

interface DecisionArbol {
  nodos_evaluados: EvaluacionNodo[]
  urgencia: 'critica' | 'alta' | 'media' | 'baja' | 'ninguna'
  tipo_intervencion: string[]   // ['ajuste_kcal', 'refeed', 'mensaje_apoyo', ...]
  score_accion: number          // 0-10, cuánto urge intervenir
  contexto_aprendizaje: string  // Qué aporta el perfil de gusto y patrones colectivos
}

const SYSTEM_PROMPT = `Eres el nutricionista deportivo senior de NutriCoach.
Recibes el resultado de un árbol de decisión multicriteria de 19 nodos que ya ha pre-analizado al cliente.
Tu rol es INTERPRETAR ese análisis y proponer la acción óptima con justificación científica.

JERARQUÍA DE DECISIONES (de más a menos urgente):
1. Seguridad: pérdida >0.7 kg/semana sostenida → riesgo músculo → acción obligatoria
2. Estancamiento real (≥3 semanas, adherencia >75%) → ajuste metabólico
3. Riesgo abandono alto (≥0.65) → intervención psicológica antes que nutricional
4. Energía persistente baja (<5, ≥2 semanas) → revisar déficit, timing CHO, calidad sueño
5. Adherencia media-baja (5-7) → simplificar plan, no restricciones
6. Plan correcto, cliente on-track → reforzar positivamente, no cambiar nada

REGLAS CIENTÍFICAS ESTRICTAS:
- Pérdida óptima: 0.3-0.5 kg/semana (Helms 2014, ISSN 2017)
- No bajar más de -200 kcal/semana
- Refeed: 1 día +400-600 kcal CHO si: déficit >4 semanas + energía <6 + peso estable
- Sueño <6h = no reducir más → catabolismo real (Dattilo 2011)
- CHO timing: atletas de fuerza necesitan CHO pre/post (Ivy 1998)
- Proteína mínima en déficit: 2.0-2.4 g/kg (Morton 2018 BJSM)

FORMATO JSON OBLIGATORIO:
{
  "propuesta": "texto para el coach sobre qué propones y por qué (máx 120 palabras)",
  "mensaje_cliente": "mensaje directo al cliente: 2-3 frases cálidas con dato concreto",
  "razonamiento": "análisis técnico con datos del cliente (máx 150 palabras)",
  "ajustes": {
    "kcal": número o null,
    "proteinas": número o null,
    "carbohidratos": número o null,
    "grasas": número o null
  },
  "tipo_intervencion": ["lista de intervenciones: ajuste_kcal, refeed, mensaje_apoyo, simplificar_plan, aumentar_proteina, cambiar_timing, ninguna"],
  "senales_proxima_semana": ["qué observar en el siguiente check-in para validar el ajuste"],
  "fuentes": [{"autores": "...", "año": 2024, "titulo": "...", "conclusión": "..."}],
  "prioridad": número 1-10 (1=urgente),
  "score_confianza": número 0-1,
  "requiere_aprobacion": boolean
}`

// ── Árbol de 19 nodos ─────────────────────────────────────────
function evaluarArbolDecision(
  ctx: ContextoCliente,
  perfilGusto?: Awaited<ReturnType<typeof obtenerPerfilCliente>>
): DecisionArbol {
  const nodos: EvaluacionNodo[] = []
  const intervenciones: string[] = []
  let scoreAccion = 0

  const checkins = ctx.checkins_recientes.slice(0, 8)
  const plan = ctx.plan_activo
  const perfil = ctx.perfil_aprendizaje

  // ─ N1: ¿Suficientes datos? ───────────────────────────────────
  const n1_datos = checkins.length >= 2
  nodos.push({ nodo: 'N1_datos_suficientes', resultado: n1_datos ? 'SÍ' : 'NO', confianza: 1.0 })
  if (!n1_datos) return { nodos_evaluados: nodos, urgencia: 'ninguna', tipo_intervencion: [], score_accion: 0, contexto_aprendizaje: '' }

  // ─ N2: ¿Tendencia peso (3+ semanas)? ────────────────────────
  const pesos = checkins.filter(c => c.peso).map(c => c.peso as number)
  const tendenciaPeso = pesos.length >= 3
    ? pesos[0] < pesos[pesos.length - 1] ? 'bajando'
      : pesos[0] > pesos[pesos.length - 1] ? 'subiendo'
      : 'estable'
    : 'insuficiente'
  nodos.push({ nodo: 'N2_tendencia_peso', resultado: tendenciaPeso, confianza: pesos.length >= 3 ? 0.85 : 0.4 })

  // ─ N3: ¿Velocidad pérdida semanal? ───────────────────────────
  let velocidadPeso = 0
  if (pesos.length >= 2) {
    const semanas = Math.max(1, checkins.indexOf(checkins.find(c => c.peso === pesos[pesos.length - 1])!))
    velocidadPeso = Math.abs((pesos[0] - pesos[pesos.length - 1]) / semanas)
  }
  const n3_rapida = velocidadPeso > 0.65
  const n3_lenta = velocidadPeso < 0.2 && tendenciaPeso === 'estable'
  nodos.push({ nodo: 'N3_velocidad_perdida', resultado: `${velocidadPeso.toFixed(2)} kg/semana`, valor: velocidadPeso, umbral: 0.65, confianza: 0.8 })
  if (n3_rapida && ctx.cliente.objetivo === 'perder_grasa') {
    intervenciones.push('aumentar_proteina')
    scoreAccion += 3
  }

  // ─ N4: ¿Adherencia media últimas 4 semanas? ─────────────────
  const adherencias = checkins.slice(0, 4).filter(c => c.adherencia).map(c => c.adherencia as number)
  const adherenciaMedia = adherencias.length > 0
    ? adherencias.reduce((a, b) => a + b, 0) / adherencias.length
    : 70
  nodos.push({ nodo: 'N4_adherencia_media', resultado: `${adherenciaMedia.toFixed(0)}%`, valor: adherenciaMedia, umbral: 70, confianza: 0.9 })

  // ─ N5: ¿Adherencia en caída? (tendencia últimas 3 semanas) ───
  const n5_caida = adherencias.length >= 3 && adherencias[0] < adherencias[adherencias.length - 1] - 10
  nodos.push({ nodo: 'N5_adherencia_caida', resultado: n5_caida ? 'SÍ' : 'NO', confianza: 0.75 })

  // ─ N6: ¿Energía persistentemente baja? ───────────────────────
  const energias = checkins.slice(0, 4).filter(c => c.energia).map(c => c.energia as number)
  const energiaMedia = energias.length > 0
    ? energias.reduce((a, b) => a + b, 0) / energias.length
    : 7
  const n6_bajEnergia = energiaMedia < 5.5 && energias.length >= 2
  nodos.push({ nodo: 'N6_energia_baja', resultado: `${energiaMedia.toFixed(1)}/10`, valor: energiaMedia, umbral: 5.5, confianza: 0.8 })
  if (n6_bajEnergia) {
    intervenciones.push('revisar_deficit_timing')
    scoreAccion += 2
  }

  // ─ N7: ¿Sueño comprometido? ───────────────────────────────────
  const suenos = checkins.slice(0, 3).filter(c => c.sueno).map(c => c.sueno as number)
  const suenioMedio = suenos.length > 0 ? suenos.reduce((a, b) => a + b, 0) / suenos.length : 7
  const n7_suenioMalo = suenioMedio < 6
  nodos.push({ nodo: 'N7_suenio_comprometido', resultado: `${suenioMedio.toFixed(1)}/10`, valor: suenioMedio, umbral: 6, confianza: 0.7 })
  if (n7_suenioMalo) {
    scoreAccion += 1.5
  }

  // ─ N8: ¿Semanas sin mejora? ──────────────────────────────────
  const semanasSinMejora = perfil?.semanas_sin_mejora ?? 0
  const n8_estancado = semanasSinMejora >= 3
  nodos.push({ nodo: 'N8_semanas_sin_mejora', resultado: `${semanasSinMejora} semanas`, valor: semanasSinMejora, umbral: 3, confianza: 0.85 })
  if (n8_estancado && adherenciaMedia > 75) {
    intervenciones.push('ajuste_kcal')
    scoreAccion += 2.5
  }

  // ─ N9: ¿Estancamiento real vs falso? (adherencia como clave) ─
  const n9_estancamientoReal = n8_estancado && adherenciaMedia >= 75
  const n9_estancamientoAdherencia = n8_estancado && adherenciaMedia < 65
  nodos.push({ nodo: 'N9_tipo_estancamiento', resultado: n9_estancamientoReal ? 'metabolico' : n9_estancamientoAdherencia ? 'adherencia' : 'ninguno', confianza: 0.8 })
  if (n9_estancamientoAdherencia) {
    intervenciones.push('simplificar_plan')
    scoreAccion += 1.5
  }

  // ─ N10: ¿Riesgo abandono? ─────────────────────────────────────
  const riesgoAban = perfil?.riesgo_abandono ?? 0
  const n10_riesgoAlto = riesgoAban >= 0.65
  nodos.push({ nodo: 'N10_riesgo_abandono', resultado: riesgoAban >= 0.65 ? 'ALTO' : riesgoAban >= 0.4 ? 'MEDIO' : 'BAJO', valor: riesgoAban, umbral: 0.65, confianza: 0.75 })
  if (n10_riesgoAlto) {
    intervenciones.push('mensaje_apoyo')
    scoreAccion += 2
  }

  // ─ N11: ¿Objetivo permite déficit agresivo? ───────────────────
  const n11_objetivoDeficit = ['perder_grasa', 'recomposicion'].includes(ctx.cliente.objetivo ?? '')
  nodos.push({ nodo: 'N11_objetivo_deficit', resultado: n11_objetivoDeficit ? 'SÍ' : 'NO', confianza: 1.0 })

  // ─ N12: ¿Duración en déficit? (estimado por semanas con plan) ─
  const semanasConPlan = plan ? Math.round((Date.now() - new Date(checkins[checkins.length - 1]?.fecha ?? Date.now()).getTime()) / (7 * 24 * 60 * 60 * 1000)) : 0
  const n12_deficitLargo = semanasConPlan >= 4 && n11_objetivoDeficit
  nodos.push({ nodo: 'N12_deficit_sostenido', resultado: `${semanasConPlan} semanas`, valor: semanasConPlan, umbral: 4, confianza: 0.6 })
  if (n12_deficitLargo && n6_bajEnergia && n8_estancado) {
    intervenciones.push('refeed')
    scoreAccion += 2.5
  }

  // ─ N13: ¿Proteína suficiente en déficit? ─────────────────────
  const kcalObj = plan?.kcal_objetivo ?? 2000
  const protObj = plan?.proteinas_objetivo ?? 100
  const pesoActual = pesos[0] ?? 70
  const protGkg = protObj / pesoActual
  const n13_protBaja = n11_objetivoDeficit && protGkg < 1.8
  nodos.push({ nodo: 'N13_proteina_kg', resultado: `${protGkg.toFixed(2)} g/kg`, valor: protGkg, umbral: 1.8, confianza: 0.9 })
  if (n13_protBaja) {
    intervenciones.push('aumentar_proteina')
    scoreAccion += 2
  }

  // ─ N14: ¿Nivel cocina real vs complejidad del plan? ──────────
  const nivelCocinaReal = perfilGusto?.nivel_cocina_real ?? 2
  const complejidadPlan = perfilGusto?.nivel_cocina_real ? nivelCocinaReal : 2 // proxy
  const n14_sobrecarga = nivelCocinaReal < 2 && complejidadPlan > 3
  nodos.push({ nodo: 'N14_complejidad_plan', resultado: n14_sobrecarga ? 'SOBRECARGA' : 'OK', confianza: perfilGusto ? 0.8 : 0.4 })
  if (n14_sobrecarga) {
    intervenciones.push('simplificar_recetas')
    scoreAccion += 1
  }

  // ─ N15: ¿Recetas rechazadas sistemáticamente? ────────────────
  const rechazosCount = perfilGusto?.recetas_sistematicamente_rechazadas?.length ?? 0
  const n15_rechazos = rechazosCount >= 3
  nodos.push({ nodo: 'N15_rechazos_recetas', resultado: `${rechazosCount} recetas rechazadas`, confianza: perfilGusto ? 0.85 : 0.3 })
  if (n15_rechazos) {
    intervenciones.push('rotar_recetas')
    scoreAccion += 1
  }

  // ─ N16: ¿Progreso en línea con objetivo? ─────────────────────
  const n16_onTrack = tendenciaPeso === 'bajando' && velocidadPeso >= 0.2 && velocidadPeso <= 0.65 && adherenciaMedia >= 75
  const n16_superando = tendenciaPeso === 'bajando' && velocidadPeso > 0.5 && adherenciaMedia >= 80
  nodos.push({ nodo: 'N16_progreso_objetivo', resultado: n16_superando ? 'SUPERANDO' : n16_onTrack ? 'ON_TRACK' : 'REVISAR', confianza: 0.85 })
  if (n16_onTrack || n16_superando) {
    intervenciones.push('reforzar_positivo')
    scoreAccion = Math.max(0, scoreAccion - 2) // buen progreso reduce urgencia
  }

  // ─ N17: ¿Objetivo de ganancia muscular? ──────────────────────
  const n17_ganarMus = ctx.cliente.objetivo === 'ganar_musculo'
  if (n17_ganarMus && kcalObj < (pesoActual * 33)) { // <33 kcal/kg = probablemente en déficit
    intervenciones.push('ajuste_kcal')
    scoreAccion += 1.5
  }
  nodos.push({ nodo: 'N17_objetivo_ganancia', resultado: n17_ganarMus ? 'SÍ' : 'NO', confianza: 1.0 })

  // ─ N18: ¿Días activos bajos? ─────────────────────────────────
  const diasActivos = perfil?.dias_activos_30d ?? 15
  const n18_inactivo = diasActivos < 10
  nodos.push({ nodo: 'N18_dias_activos', resultado: `${diasActivos}/30 días`, valor: diasActivos, umbral: 10, confianza: 0.7 })

  // ─ N19: ¿Patrón colectivo aplicable? ─────────────────────────
  // (indicador de si hay conocimiento colectivo relevante — se usa en el prompt)
  nodos.push({ nodo: 'N19_patron_colectivo', resultado: 'pendiente_enriquecimiento', confianza: 0.5 })

  // ─ N_TDEE / N_TSS / N_HRV / N_PASOS — datos de dispositivo ──
  scoreAccion += evaluarNodosActividad(ctx, nodos, intervenciones)

  // ── Determinar urgencia ──────────────────────────────────────
  let urgencia: DecisionArbol['urgencia']
  if (n3_rapida && n11_objetivoDeficit) urgencia = 'critica'
  else if (scoreAccion >= 7) urgencia = 'alta'
  else if (scoreAccion >= 4) urgencia = 'media'
  else if (scoreAccion >= 2) urgencia = 'baja'
  else urgencia = 'ninguna'

  // ── Contexto de aprendizaje personalizado ───────────────────
  const ctxAprendizaje: string[] = []
  if (perfilGusto) {
    if (perfilGusto.nivel_cocina_real) ctxAprendizaje.push(`Nivel cocina real: ${perfilGusto.nivel_cocina_real}/5`)
    if (perfilGusto.adherencia_historica_media) ctxAprendizaje.push(`Adherencia histórica: ${perfilGusto.adherencia_historica_media}%`)
    if (perfilGusto.categorias_preferidas?.length) ctxAprendizaje.push(`Categorías preferidas: ${perfilGusto.categorias_preferidas.slice(0, 3).join(', ')}`)
  }

  return {
    nodos_evaluados: nodos,
    urgencia,
    tipo_intervencion: [...new Set(intervenciones)],
    score_accion: Math.min(10, scoreAccion),
    contexto_aprendizaje: ctxAprendizaje.join(' | '),
  }
}

// ── Árbol de 4 nodos de actividad externa (dispositivos) ─────
function evaluarNodosActividad(
  ctx: ContextoCliente,
  nodos: EvaluacionNodo[],
  intervenciones: string[]
): number {
  const act = ctx.actividad_semanal
  if (!act || !act.tiene_datos) {
    nodos.push({ nodo: 'N_DISPOSITIVO', resultado: 'sin_datos', confianza: 0 })
    return 0
  }

  let scoreExtra = 0

  // N_TDEE: TDEE estimado vs kcal objetivo → ¿el plan está por debajo de lo necesario?
  const tdee = act.tdee_estimado
  const kcalObj = ctx.plan_activo?.kcal_objetivo ?? 0
  const deficit = tdee > 0 ? tdee - kcalObj : 0
  const n_tdee_agresivo = deficit > 700
  nodos.push({
    nodo: 'N_TDEE',
    resultado: tdee > 0 ? `TDEE≈${Math.round(tdee)} kcal, déficit≈${Math.round(deficit)} kcal` : 'sin_tdee',
    valor: deficit,
    umbral: 700,
    confianza: tdee > 0 ? 0.75 : 0,
  })
  if (n_tdee_agresivo) {
    intervenciones.push('revisar_deficit_calorico')
    scoreExtra += 2
  }

  // N_TSS: Training Stress Score semanal alto → riesgo sobreentrenamiento
  const tss = act.tss_semanal
  const n_tss_alto = tss > 400
  nodos.push({
    nodo: 'N_TSS',
    resultado: `TSS_semanal=${tss.toFixed(0)}`,
    valor: tss,
    umbral: 400,
    confianza: tss > 0 ? 0.7 : 0,
  })
  if (n_tss_alto) {
    intervenciones.push('ajustar_cho_entreno')
    scoreExtra += 1.5
  }

  // N_HRV: HRV baja → fatiga acumulada → no recortar más calorías
  const hrv = act.hrv_media ?? 0
  const n_hrv_baja = hrv > 0 && hrv < 50
  nodos.push({
    nodo: 'N_HRV',
    resultado: hrv > 0 ? `HRV_media=${hrv.toFixed(0)} ms` : 'sin_hrv',
    valor: hrv,
    umbral: 50,
    confianza: hrv > 0 ? 0.8 : 0,
  })
  if (n_hrv_baja) {
    intervenciones.push('recuperacion_activa')
    scoreExtra += 1.5
  }

  // N_PASOS: Pasos medios bajos → TDEE estimado puede estar inflado o estilo de vida sedentario
  const pasos = act.pasos_media
  const n_pasos_bajo = pasos > 0 && pasos < 5000
  nodos.push({
    nodo: 'N_PASOS',
    resultado: pasos > 0 ? `pasos_media=${Math.round(pasos)}/día` : 'sin_pasos',
    valor: pasos,
    umbral: 5000,
    confianza: pasos > 0 ? 0.65 : 0,
  })
  if (n_pasos_bajo) {
    intervenciones.push('aumentar_neat')
    scoreExtra += 1
  }

  return scoreExtra
}

// ── Entry point principal ─────────────────────────────────────
export async function ejecutarRevisorSemanal(clienteId: string): Promise<void> {
  const ctx = await cargarContextoCliente(clienteId)
  if (!ctx) return
  if (ctx.checkins_recientes.length < 2) return

  // Cargar perfil de gusto y patrones colectivos en paralelo
  const [perfilGusto, patronesColectivos, informeClinico] = await Promise.all([
    obtenerPerfilCliente(clienteId),
    obtenerPatronesRelevantes(ctx.cliente.objetivo ?? 'salud_general'),
    obtenerInformeVigente(clienteId),
  ])

  // Ejecutar árbol de 19 nodos
  const decision = evaluarArbolDecision(ctx, perfilGusto)

  // Construir prompt enriquecido
  const userPrompt = construirPrompt(ctx, decision, patronesColectivos, informeClinico?.instrucciones_ia)
  const raw = await llamarDeepSeek(SYSTEM_PROMPT, userPrompt, 0.2)

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[revisor-semanal] JSON inválido:', raw)
    return
  }

  const senales = Array.isArray(parsed.senales_proxima_semana)
    ? (parsed.senales_proxima_semana as string[])
    : []

  const resultado: ResultadoAgente = {
    tipo: 'revision_semanal',
    propuesta: String(parsed.propuesta ?? ''),
    razonamiento: String(parsed.razonamiento ?? ''),
    payload: {
      ajustes: parsed.ajustes ?? {},
      checkins_analizados: ctx.checkins_recientes.length,
      peso_actual: ctx.checkins_recientes[0]?.peso,
      adherencia_media: ctx.perfil_aprendizaje?.adherencia_media ?? null,
      mensaje_cliente: parsed.mensaje_cliente ?? null,
      senales_proxima_semana: senales,
      tipo_intervencion: parsed.tipo_intervencion ?? decision.tipo_intervencion,
      arbol_decision: {
        urgencia: decision.urgencia,
        score_accion: decision.score_accion,
        nodos: decision.nodos_evaluados.length,
      },
    },
    fuentes: (parsed.fuentes as ResultadoAgente['fuentes']) ?? [],
    prioridad: Number(parsed.prioridad ?? 5),
    score_confianza: Number(parsed.score_confianza ?? 0.5),
    requiere_aprobacion: parsed.requiere_aprobacion !== false,
    mensaje_cliente: parsed.mensaje_cliente ? String(parsed.mensaje_cliente) : undefined,
    senales_proxima_semana: senales.length > 0 ? senales : undefined,
  }

  await guardarTareaAgente('revisor_semanal', resultado, clienteId)
}

// ── Construcción de prompt ────────────────────────────────────
function construirPrompt(
  ctx: ContextoCliente,
  decision: DecisionArbol,
  patronesColectivos: string,
  instruccionesClinicas?: string
): string {
  const { cliente, plan_activo, checkins_recientes, perfil_aprendizaje, metodologia_coach, actividad_semanal } = ctx

  const pesoInicial = cliente.peso_inicial ?? '?'
  const pesoActual = checkins_recientes[0]?.peso ?? '?'

  const metodologiaStr = metodologia_coach
    .slice(0, 5)
    .map(m => `- ${m.clave}: ${m.valor}`)
    .join('\n')

  const nodosUrgentes = decision.nodos_evaluados
    .filter(n => n.valor !== undefined && n.umbral !== undefined)
    .map(n => `  [${n.nodo}] → ${n.resultado} (confianza: ${(n.confianza * 100).toFixed(0)}%)`)
    .join('\n')

  const infClinicoBlock = instruccionesClinicas
    ? `\n\n═══ INFORME CLÍNICO VIGENTE ═══\n${instruccionesClinicas}\n═══════════════════════════════`
    : ''

  return `CLIENTE: ${cliente.nombre ?? 'Sin nombre'} (${cliente.sexo ?? '?'}, ${cliente.edad ?? '?'} años)
OBJETIVO: ${cliente.objetivo ?? 'No especificado'}
PESO INICIAL: ${pesoInicial} kg | PESO ACTUAL: ${pesoActual} kg

PLAN ACTIVO:
- Calorías: ${plan_activo?.kcal_objetivo ?? '?'} kcal
- Proteínas: ${plan_activo?.proteinas_objetivo ?? '?'}g | Carbos: ${plan_activo?.carbohidratos_objetivo ?? '?'}g | Grasas: ${plan_activo?.grasas_objetivo ?? '?'}g

CHECKINS RECIENTES (más reciente primero):
${checkins_recientes
  .slice(0, 6)
  .map(c => `• ${c.fecha}: peso=${c.peso ?? 'N/A'}kg, adherencia=${c.adherencia ?? 'N/A'}%, energía=${c.energia ?? 'N/A'}/10, sueño=${c.sueno ?? 'N/A'}/10`)
  .join('\n')}

═══ ÁRBOL DE DECISIÓN (19 nodos evaluados) ═══
URGENCIA DETECTADA: ${decision.urgencia.toUpperCase()}
SCORE ACCIÓN: ${decision.score_accion.toFixed(1)}/10
INTERVENCIONES SUGERIDAS: ${decision.tipo_intervencion.join(', ') || 'ninguna'}
CONTEXTO APRENDIZAJE: ${decision.contexto_aprendizaje || 'sin datos de perfil aún'}

NODOS CON VALORES NUMÉRICOS:
${nodosUrgentes || '  Sin anomalías detectadas'}
═══════════════════════════════════════════════

PERFIL APRENDIZAJE:
- Tendencia peso: ${perfil_aprendizaje?.peso_tendencia ?? 'desconocida'}
- Adherencia media 30d: ${perfil_aprendizaje?.adherencia_media ?? 'desconocida'}%
- Riesgo abandono: ${perfil_aprendizaje?.riesgo_abandono ?? 'desconocido'}
- Semanas sin mejora: ${perfil_aprendizaje?.semanas_sin_mejora ?? 0}
${actividad_semanal?.tiene_datos ? `
DATOS DISPOSITIVO (últimos 7 días — ${actividad_semanal.fuentes.join(', ')}):
- Pasos media: ${actividad_semanal.pasos_media > 0 ? Math.round(actividad_semanal.pasos_media) + '/día' : 'sin datos'}
- Calorías activas total: ${actividad_semanal.calorias_activas_total > 0 ? Math.round(actividad_semanal.calorias_activas_total) + ' kcal' : 'sin datos'}
- TDEE estimado: ${actividad_semanal.tdee_estimado > 0 ? Math.round(actividad_semanal.tdee_estimado) + ' kcal/día' : 'sin datos'}
- TSS semanal: ${actividad_semanal.tss_semanal > 0 ? actividad_semanal.tss_semanal.toFixed(0) : 'sin datos'}
- HRV media: ${(actividad_semanal.hrv_media ?? 0) > 0 ? (actividad_semanal.hrv_media as number).toFixed(0) + ' ms' : 'sin datos'}
- Sesiones entreno: ${actividad_semanal.sesiones_entreno}
- Minutos alta intensidad: ${actividad_semanal.minutos_alta_intensidad_total > 0 ? actividad_semanal.minutos_alta_intensidad_total + ' min' : 'sin datos'}` : ''}
METODOLOGÍA DEL COACH:
${metodologiaStr}
${patronesColectivos}${infClinicoBlock}

Analiza este contexto completo (árbol de decisión + perfil individual + patrones colectivos) y genera tu propuesta de revisión en JSON.`
}
