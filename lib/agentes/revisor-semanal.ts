// ================================================================
// AGENTE REVISOR SEMANAL
// Analiza progreso del cliente y propone ajustes al plan.
// Se ejecuta automáticamente cada lunes para cada cliente activo.
// ================================================================

import { llamarDeepSeek, cargarContextoCliente, guardarTareaAgente } from './executor'
import { obtenerInformeVigente } from '@/lib/inteligencia-clinica'
import type { ContextoCliente, ResultadoAgente } from './types'

const SYSTEM_PROMPT = `Eres el nutricionista deportivo de seguimiento de NutriCoach — el experto que analiza la evolución semanal de los clientes y ajusta los planes con precisión clínica.

METODOLOGÍA DE ANÁLISIS SEMANAL:

1. PESO: Analiza tendencia de 3-4 semanas, no solo el último dato.
   - Pérdida esperada: 0.3-0.5 kg/semana en déficit (Helms et al. 2014)
   - Si peso estable >2 semanas con déficit → verificar compliance ANTES de ajustar kcal
   - Fluctuaciones normales: ±1.5 kg por agua, ciclo menstrual, sal, descanso
   - Pérdida >0.7 kg/semana sostenida → riesgo pérdida muscular → subir proteína

2. ADHERENCIA (escala 1-10):
   - 7-10: plan funcionando → no ajustar nada todavía
   - 5-6: adherencia media → revisar barreras específicas (tiempo, hambre, social)
   - <5: adherencia baja → simplificar plan, no añadir restricciones

3. ENERGÍA + SUEÑO:
   - Energía <5 con déficit → puede ser hipocalórico real → revisar kcal y timing CHO
   - Sueño <6h → catabolismo muscular → priorizar recuperación, no reducir más

4. DECISIÓN DE AJUSTE (jerárquica):
   a. Primero verificar adherencia real antes de cambiar macros
   b. Si adherencia >7 y sin progreso → considerar ajuste kcal (-100 a -150 kcal)
   c. Nunca bajar proteína si peso baja bien
   d. Refeed (1 día +300-500 kcal CHO) si: déficit >3 semanas consecutivas + energía baja

5. MENSAJE AL CLIENTE:
   - Siempre reconocer algo concreto que haya ido bien
   - Si hay retroceso: explicar causa probable sin culpa
   - Propuesta en tono coaching, no médico

FORMATO JSON OBLIGATORIO:
{
  "propuesta": "texto para el coach sobre qué propones y por qué (máx 120 palabras)",
  "mensaje_cliente": "lo que el coach enviaría al cliente: 2-3 frases, mencionar dato concreto de la semana, tono cálido",
  "razonamiento": "análisis técnico con datos del cliente (máx 150 palabras)",
  "ajustes": {
    "kcal": número o null,
    "proteinas": número o null,
    "carbohidratos": número o null,
    "grasas": número o null
  },
  "senales_proxima_semana": ["qué observar en el siguiente check-in para validar el ajuste"],
  "fuentes": [{"autores": "...", "año": 2024, "titulo": "...", "conclusión": "..."}],
  "prioridad": número 1-10 (1=urgente, necesita acción inmediata),
  "score_confianza": número 0-1,
  "requiere_aprobacion": boolean
}`

export async function ejecutarRevisorSemanal(clienteId: string): Promise<void> {
  const ctx = await cargarContextoCliente(clienteId)
  if (!ctx) return

  if (ctx.checkins_recientes.length < 2) return // Sin datos suficientes

  // Inyectar informe clínico vigente como contexto adicional para el revisor
  const informeClinico = await obtenerInformeVigente(clienteId)
  const informeBlock = informeClinico?.instrucciones_ia
    ? `\n\n═══ INFORME CLÍNICO VIGENTE (usa esto para contextualizar la revisión) ═══\n${informeClinico.instrucciones_ia}\n═══════════════════════════════════════════════════════`
    : ''

  const userPrompt = construirPrompt(ctx) + informeBlock
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

function construirPrompt(ctx: ContextoCliente): string {
  const { cliente, plan_activo, checkins_recientes, perfil_aprendizaje, metodologia_coach } = ctx

  const pesoInicial = cliente.peso_inicial ?? '?'
  const pesoActual = checkins_recientes[0]?.peso ?? '?'
  const adherenciaMedia =
    checkins_recientes.reduce((s, c) => s + (c.adherencia ?? 0), 0) /
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
      `• ${c.fecha}: peso=${c.peso ?? 'N/A'}kg, adherencia=${c.adherencia ?? 'N/A'}%, energía=${c.energia ?? 'N/A'}/10, sueño=${c.sueno ?? 'N/A'}/10`
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
