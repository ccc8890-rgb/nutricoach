// ================================================================
// AGENTE RIESGO
// Detecta clientes en riesgo de abandono y propone acción.
// Se ejecuta diariamente. Solo genera tarea si riesgo > umbral.
// ================================================================

import { llamarGemini, cargarContextoCliente, guardarTareaAgente } from './executor'
import { createServiceSupabase } from '@/lib/supabase-server'
import type { ContextoCliente, ResultadoAgente } from './types'

const UMBRAL_RIESGO = 0.35  // >35% → genera alerta (~7 días sin checkin)

const SYSTEM_PROMPT = `Eres el agente de Riesgo de Abandono de NutriCoach.

Tu misión: detectar clientes en riesgo de abandonar el programa y proponer UN mensaje personalizado de re-engagement para que el coach envíe.

SEÑALES DE RIESGO:
- Más de 10 días sin check-in
- Adherencia bajando >20% respecto a la semana anterior
- Mensajes negativos en notas (cansancio, frustración, trabajo)
- Peso estancado >3 semanas con buena adherencia (frustración)

REGLAS:
- El mensaje propuesto debe ser PERSONAL, usar el nombre del cliente, referencias a su situación concreta
- NO mensajes genéricos ("¿Cómo estás?" sin contexto)
- El mensaje debe resolver la barrera detectada (tiempo → ajuste plan, desmotivación → resultados conseguidos)
- Máx 3 frases. Tono cercano, no clínico.

OUTPUT JSON:
{
  "barrera_detectada": "razón principal del riesgo",
  "propuesta": "mensaje que el coach enviaría al cliente (personalizado, max 3 frases)",
  "razonamiento": "por qué este cliente está en riesgo y por qué este mensaje (max 100 palabras)",
  "señales": ["señal1", "señal2"],
  "prioridad": número 1-10,
  "score_confianza": número 0-1,
  "requiere_aprobacion": true
}`

export async function ejecutarAgenteRiesgo(clienteId: string): Promise<void> {
  const ctx = await cargarContextoCliente(clienteId)
  if (!ctx) return

  const riesgo = ctx.perfil_aprendizaje?.riesgo_abandono ?? calcularRiesgoRapido(ctx)
  if (riesgo < UMBRAL_RIESGO) return

  // Evitar crear tarea de riesgo duplicada si ya hay una pendiente
  const db = createServiceSupabase()
  const { data: existente } = await db
    .from('agente_tareas')
    .select('id')
    .eq('cliente_id', clienteId)
    .eq('tipo', 'alerta_riesgo')
    .eq('estado', 'pendiente')
    .limit(1)

  if (existente?.length) return  // Ya hay una alerta pendiente

  // Gemini Flash: tarea diaria simple, barato y suficientemente preciso
  const userPrompt = `${SYSTEM_PROMPT}\n\n${construirPrompt(ctx, riesgo)}`
  const raw = await llamarGemini(userPrompt, 0.4)

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[riesgo] JSON inválido:', raw)
    return
  }

  const resultado: ResultadoAgente = {
    tipo: 'alerta_riesgo',
    propuesta: String(parsed.propuesta ?? ''),
    razonamiento: String(parsed.razonamiento ?? ''),
    payload: {
      riesgo_abandono: riesgo,
      barrera_detectada: parsed.barrera_detectada ?? '',
      señales: parsed.señales ?? [],
    },
    fuentes: [],
    prioridad: Number(parsed.prioridad ?? 2),
    score_confianza: Number(parsed.score_confianza ?? 0.6),
    requiere_aprobacion: true,
  }

  await guardarTareaAgente('riesgo', resultado, clienteId)
}

function calcularRiesgoRapido(ctx: ContextoCliente): number {
  if (!ctx.checkins_recientes.length) return 0.8  // Sin check-ins = alto riesgo

  const ultimo = ctx.checkins_recientes[0]
  const diasSin = Math.floor(
    (Date.now() - new Date(ultimo.fecha).getTime()) / 86_400_000
  )

  return Math.min(1, diasSin / 21)
}

function construirPrompt(ctx: ContextoCliente, riesgo: number): string {
  const { cliente, checkins_recientes, perfil_aprendizaje } = ctx

  const ultimoCheckin = checkins_recientes[0]
  const diasSin = ultimoCheckin
    ? Math.floor((Date.now() - new Date(ultimoCheckin.fecha).getTime()) / 86_400_000)
    : 99

  return `CLIENTE EN RIESGO: ${cliente.nombre ?? 'Sin nombre'}
OBJETIVO: ${cliente.objetivo ?? 'No especificado'}
RIESGO CALCULADO: ${(riesgo * 100).toFixed(0)}%

ÚLTIMOS CHECKINS:
${checkins_recientes
  .slice(0, 4)
  .map(
    c =>
      `• ${c.fecha}: adherencia=${c.adherencia ?? 'N/A'}%, notas="${c.notas ?? 'sin notas'}"`
  )
  .join('\n') || '• Sin check-ins recientes'}

DÍAS SIN CHECK-IN: ${diasSin}
ADHERENCIA MEDIA: ${perfil_aprendizaje?.adherencia_media ?? 'desconocida'}%
TENDENCIA PESO: ${perfil_aprendizaje?.peso_tendencia ?? 'desconocida'}

Genera el mensaje de re-engagement personalizado en JSON.`
}
