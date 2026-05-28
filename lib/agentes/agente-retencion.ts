// ================================================================
// AGENTE RETENCIÓN
// Detecta clientes con riesgo de baja/no-renovación y propone
// una acción concreta al coach. Ejecución: diaria.
// Señales: membresía caduca pronto, baja adherencia, nuevo sin enganchar.
// ================================================================

import { llamarDeepSeek, cargarContextoCliente, guardarTareaAgente } from './executor'
import { createServiceSupabase } from '@/lib/supabase-server'
import type { ResultadoAgente } from './types'

const SYSTEM_PROMPT = `Eres el agente de Retención de NutriCoach.

Tu misión: detectar clientes que pueden abandonar el programa o no renovar su membresía, y proponer al coach una acción concreta y personalizada.

SEÑALES DE RIESGO DE BAJA:
- Membresía que caduca en ≤30 días sin renovación conocida
- Score de adherencia < 40 durante varios días
- Sin respuesta a mensajes del coach en >5 días
- Primera semana de membresía sin check-in (cliente nuevo sin enganchar)

ACCIONES POSIBLES:
- Mensaje de re-enganche personalizado (menciona su progreso real)
- Oferta de renovación (menciona el beneficio conseguido hasta ahora)
- Propuesta de ajuste de plan (si hay plateau o desmotivación)
- Alerta urgente: recomendar que el coach llame por teléfono

REGLAS:
- Máximo UNA acción propuesta por cliente, la más urgente
- Nunca duplicar una tarea de retención pendiente
- Personalizar con datos reales: nombre, días sin check-in, objetivo

Responde ÚNICAMENTE con JSON válido:
{
  "señal_principal": "caduca_pronto|baja_adherencia|nuevo_sin_enganche",
  "accion": "mensaje|oferta_renovacion|ajuste_plan|alerta_llamada",
  "propuesta": "texto exacto que el coach usaría (max 3 frases, personalizado)",
  "razonamiento": "por qué esta acción ahora (max 80 palabras)",
  "urgencia": número del 1 al 10
}`

export async function ejecutarAgenteRetencion(clienteId: string): Promise<void> {
  const ctx = await cargarContextoCliente(clienteId)
  if (!ctx) return

  // Consulta separada para campos no presentes en ContextoCliente
  const db = createServiceSupabase()
  const { data: clienteExtra } = await db
    .from('clientes')
    .select('fecha_fin_membresia, created_at')
    .eq('id', clienteId)
    .single()

  // ── Calcular señales ──────────────────────────────────────────

  const ultimaFecha = ctx.checkins_recientes[0]?.fecha
  const diasSinCheckin = ultimaFecha
    ? Math.floor((Date.now() - new Date(ultimaFecha).getTime()) / 86_400_000)
    : 999

  const tienePlanNutricion = ctx.plan_activo !== null

  // Señal 1: membresía caduca pronto (≤30 días)
  const fechaFin = clienteExtra?.fecha_fin_membresia
    ? new Date(clienteExtra.fecha_fin_membresia)
    : null
  const diasHastaFin = fechaFin
    ? Math.floor((fechaFin.getTime() - Date.now()) / 86_400_000)
    : null
  const caduca_pronto = diasHastaFin !== null && diasHastaFin >= 0 && diasHastaFin <= 30

  // Señal 2: baja adherencia prolongada (sin check-in >10 días)
  const baja_adherencia = diasSinCheckin > 10

  // Señal 3: cliente nuevo (alta ≤7 días) sin ningún check-in
  const createdAt = clienteExtra?.created_at ? new Date(clienteExtra.created_at) : null
  const diasAlta = createdAt
    ? Math.floor((Date.now() - createdAt.getTime()) / 86_400_000)
    : null
  const nuevo_sin_enganche =
    diasAlta !== null && diasAlta <= 7 && diasSinCheckin >= diasAlta

  // Sin señales → salir sin generar tarea
  if (!caduca_pronto && !baja_adherencia && !nuevo_sin_enganche) return

  // ── Deduplicación ─────────────────────────────────────────────
  const { data: existente } = await db
    .from('agente_tareas')
    .select('id')
    .eq('cliente_id', clienteId)
    .eq('tipo', 'alerta_retencion')
    .eq('estado', 'pendiente')
    .limit(1)

  if (existente?.length) return  // Ya hay alerta de retención pendiente

  // ── Construir prompt de usuario ───────────────────────────────
  const userPrompt = construirPrompt({
    ctx,
    diasSinCheckin,
    tienePlanNutricion,
    caduca_pronto,
    baja_adherencia,
    nuevo_sin_enganche,
    diasHastaFin,
    diasAlta,
  })

  // DeepSeek V3: JSON estricto requerido, análisis de retención
  const raw = await llamarDeepSeek(SYSTEM_PROMPT, userPrompt, 0.3)

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[retencion] JSON inválido:', raw)
    return
  }

  const urgencia = Number(parsed.urgencia ?? 5)

  const resultado: ResultadoAgente = {
    tipo: 'alerta_retencion',
    propuesta: String(parsed.propuesta ?? ''),
    razonamiento: String(parsed.razonamiento ?? ''),
    payload: {
      señal_principal: parsed.señal_principal ?? '',
      accion: parsed.accion ?? '',
      urgencia,
      caduca_pronto,
      baja_adherencia,
      nuevo_sin_enganche,
      dias_sin_checkin: diasSinCheckin,
      dias_hasta_fin: diasHastaFin,
      dias_alta: diasAlta,
    },
    fuentes: [],
    prioridad: urgencia >= 7 ? 8 : 5,
    score_confianza: 0.8,
    requiere_aprobacion: true,
  }

  await guardarTareaAgente('retencion', resultado, clienteId)
}

// ── Helpers ───────────────────────────────────────────────────

interface PromptParams {
  ctx: Awaited<ReturnType<typeof cargarContextoCliente>> & {}
  diasSinCheckin: number
  tienePlanNutricion: boolean
  caduca_pronto: boolean
  baja_adherencia: boolean
  nuevo_sin_enganche: boolean
  diasHastaFin: number | null
  diasAlta: number | null
}

function construirPrompt(p: PromptParams): string {
  const { ctx, diasSinCheckin, tienePlanNutricion, caduca_pronto, baja_adherencia, nuevo_sin_enganche, diasHastaFin, diasAlta } = p
  const { cliente, checkins_recientes, perfil_aprendizaje } = ctx

  const señalesActivas: string[] = []
  if (caduca_pronto) señalesActivas.push(`Membresía caduca en ${diasHastaFin} días`)
  if (baja_adherencia) señalesActivas.push(`${diasSinCheckin} días sin check-in`)
  if (nuevo_sin_enganche) señalesActivas.push(`Cliente nuevo (${diasAlta} días de alta) sin ningún check-in`)

  return `CLIENTE: ${cliente.nombre ?? 'Sin nombre'} ${cliente.apellidos ?? ''}
OBJETIVO: ${cliente.objetivo ?? 'No especificado'}
TIENE PLAN DE NUTRICIÓN: ${tienePlanNutricion ? 'Sí' : 'No'}
ADHERENCIA MEDIA: ${perfil_aprendizaje?.adherencia_media ?? 'desconocida'}%
TENDENCIA PESO: ${perfil_aprendizaje?.peso_tendencia ?? 'desconocida'}

SEÑALES DETECTADAS:
${señalesActivas.map(s => `• ${s}`).join('\n') || '• Ninguna'}

ÚLTIMOS CHECK-INS:
${checkins_recientes
  .slice(0, 4)
  .map(
    c =>
      `• ${c.fecha}: adherencia=${c.adherencia ?? 'N/A'}%, notas="${c.notas ?? 'sin notas'}"`
  )
  .join('\n') || '• Sin check-ins registrados'}

Identifica la señal principal y propone la acción más urgente en JSON.`
}
