// ================================================================
// AGENTE REVISOR SEMANAL
// Analiza progreso del cliente y propone ajustes al plan.
// Se ejecuta automáticamente cada lunes para cada cliente activo.
// ================================================================

import { llamarDeepSeek, cargarContextoCliente, guardarTareaAgente } from './executor'
import type { ContextoCliente, ResultadoAgente } from './types'

const SYSTEM_PROMPT = `Eres el agente Revisor Semanal de NutriCoach, un sistema de IA para coaches de nutrición.

Tu función es analizar el progreso semanal de un cliente y proponer ajustes concretos al plan nutricional.

PRINCIPIOS CIENTÍFICOS QUE SIEMPRE DEBES APLICAR:
- Déficit calórico óptimo: 300-400 kcal/día (preserva músculo, pérdida 0.3-0.5 kg/semana)
- Proteína mínima en déficit: 2.0-2.4 g/kg peso corporal (Helms 2014, Morton 2018 BJSM)
- Si peso estable >2 semanas con déficit → verificar compliance antes de ajustar calorías
- Refeed estratégico si déficit >20% por >10 días consecutivos

TU OUTPUT DEBE SER JSON con esta estructura exacta:
{
  "propuesta": "texto claro de qué propones (máx 150 palabras)",
  "razonamiento": "por qué lo propones, con datos del cliente (máx 200 palabras)",
  "ajustes": {
    "kcal": número o null,
    "proteinas": número o null,
    "carbohidratos": número o null,
    "grasas": número o null
  },
  "fuentes": [{"autores": "...", "año": 2024, "titulo": "...", "conclusión": "..."}],
  "prioridad": número del 1 al 10 (1=urgente),
  "score_confianza": número 0-1,
  "requiere_aprobacion": boolean
}`

export async function ejecutarRevisorSemanal(clienteId: string): Promise<void> {
  const ctx = await cargarContextoCliente(clienteId)
  if (!ctx) return

  if (ctx.checkins_recientes.length < 2) return // Sin datos suficientes

  const userPrompt = construirPrompt(ctx)
  const raw = await llamarDeepSeek(SYSTEM_PROMPT, userPrompt, 0.2)

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[revisor-semanal] JSON inválido:', raw)
    return
  }

  const resultado: ResultadoAgente = {
    tipo: 'revision_semanal',
    propuesta: String(parsed.propuesta ?? ''),
    razonamiento: String(parsed.razonamiento ?? ''),
    payload: {
      ajustes: parsed.ajustes ?? {},
      checkins_analizados: ctx.checkins_recientes.length,
      peso_actual: ctx.checkins_recientes[0]?.peso_kg,
      adherencia_media: ctx.perfil_aprendizaje?.adherencia_media ?? null,
    },
    fuentes: (parsed.fuentes as ResultadoAgente['fuentes']) ?? [],
    prioridad: Number(parsed.prioridad ?? 5),
    score_confianza: Number(parsed.score_confianza ?? 0.5),
    requiere_aprobacion: parsed.requiere_aprobacion !== false,
  }

  await guardarTareaAgente('revisor_semanal', resultado, clienteId)
}

function construirPrompt(ctx: ContextoCliente): string {
  const { cliente, plan_activo, checkins_recientes, perfil_aprendizaje, metodologia_coach } = ctx

  const pesoInicial = cliente.peso_inicial ?? '?'
  const pesoActual = checkins_recientes[0]?.peso_kg ?? '?'
  const adherenciaMedia =
    checkins_recientes.reduce((s, c) => s + (c.adherencia_dieta ?? 0), 0) /
    Math.max(checkins_recientes.length, 1)

  const metodologiaStr = metodologia_coach
    .slice(0, 5)
    .map(m => `- ${m.clave}: ${m.valor}`)
    .join('\n')

  return `CLIENTE: ${cliente.nombre ?? 'Sin nombre'} (${cliente.sexo ?? '?'}, ${cliente.edad ?? '?'} años)
OBJETIVO: ${cliente.objetivo ?? 'No especificado'}
PESO INICIAL: ${pesoInicial} kg | PESO ACTUAL: ${pesoActual} kg

PLAN ACTIVO:
- Calorías: ${plan_activo?.kcal_objetivo ?? '?'} kcal
- Proteínas: ${plan_activo?.proteinas_objetivo ?? '?'}g | Carbos: ${plan_activo?.carbohidratos_objetivo ?? '?'}g | Grasas: ${plan_activo?.grasas_objetivo ?? '?'}g

CHECKINS RECIENTES (más reciente primero):
${checkins_recientes
  .slice(0, 6)
  .map(
    c =>
      `• ${c.fecha_checkin}: peso=${c.peso_kg ?? 'N/A'}kg, adherencia=${c.adherencia_dieta ?? 'N/A'}%, energía=${c.nivel_energia ?? 'N/A'}/10, sueño=${c.calidad_sueno ?? 'N/A'}/10`
  )
  .join('\n')}

PERFIL APRENDIZAJE:
- Tendencia peso: ${perfil_aprendizaje?.peso_tendencia ?? 'desconocida'}
- Adherencia media 30d: ${perfil_aprendizaje?.adherencia_media ?? adherenciaMedia.toFixed(0)}%
- Riesgo abandono: ${perfil_aprendizaje?.riesgo_abandono ?? 'desconocido'}
- Semanas sin mejora: ${perfil_aprendizaje?.semanas_sin_mejora ?? 0}

METODOLOGÍA DEL COACH:
${metodologiaStr}

Analiza la semana y genera tu propuesta de revisión en JSON.`
}
