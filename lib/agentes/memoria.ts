// ================================================================
// AGENTE MEMORIA
// Aprende de las decisiones del coach y actualiza coach_memoria.
// Se ejecuta tras cada aprobación/rechazo para mejorar el sistema.
// ================================================================

import { llamarDeepSeek } from './executor'
import { createServiceSupabase } from '@/lib/supabase-server'
import type { AgenteTarea, AgenteAprendizaje, CoachMemoria } from './types'

const SYSTEM_PROMPT = `Eres el agente Memoria de NutriCoach.

Tu función: analizar la decisión de un coach (aprobó/rechazó/modificó una propuesta de IA) y extraer reglas o preferencias nuevas para actualizar la metodología del coach.

CONTEXTO: El coach acaba de tomar una decisión sobre una propuesta generada por IA.
Solo extrae regla nueva si hay aprendizaje CLARO Y ACCIONABLE. Si no hay nada nuevo, devuelve null.

OUTPUT JSON:
{
  "nueva_regla": {
    "categoria": "metodologia" | "preferencia" | "regla" | "excepcion",
    "clave": "identificador_unico_snake_case",
    "valor": "la regla aprendida en texto claro",
    "contexto": "cuándo aplica esta regla"
  } | null,
  "razonamiento": "por qué extraes esta regla o por qué no hay nada nuevo"
}`

export async function ejecutarAgenteMemoria(
  tarea: AgenteTarea,
  señal: AgenteAprendizaje
): Promise<void> {
  if (!señal.comentario_coach) return  // Sin comentario del coach no hay qué aprender

  const db = createServiceSupabase()

  // Cargar metodología actual para no duplicar
  const { data: memExistente } = await db
    .from('coach_memoria')
    .select('clave, valor')
    .order('peso', { ascending: false })
    .limit(30)

  const memStr = (memExistente as Pick<CoachMemoria, 'clave' | 'valor'>[] | null)
    ?.map(m => `- ${m.clave}: ${m.valor}`)
    .join('\n') ?? ''

  const userPrompt = `DECISIÓN DEL COACH:
Tipo de tarea: ${tarea.tipo}
Propuesta IA: "${señal.propuesta_original}"
Decisión: ${señal.decision}
Propuesta final (si modificó): "${señal.propuesta_final ?? 'igual'}"
Comentario del coach: "${señal.comentario_coach}"

METODOLOGÍA ACTUAL (no duplicar):
${memStr}

¿Qué regla nueva puedes extraer de esta decisión?`

  const raw = await llamarDeepSeek(SYSTEM_PROMPT, userPrompt, 0.2)

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return
  }

  const nuevaRegla = parsed.nueva_regla as Record<string, string> | null
  if (!nuevaRegla) return

  // Guardar nueva regla en coach_memoria
  await db.from('coach_memoria').upsert(
    {
      categoria: nuevaRegla.categoria ?? 'preferencia',
      clave: nuevaRegla.clave,
      valor: nuevaRegla.valor,
      contexto: nuevaRegla.contexto ?? null,
      creado_por: 'agente_aprendizaje',
      peso: 0.7,  // Menos peso que las reglas manuales del coach
    },
    { onConflict: 'clave' }
  )

  // Incrementar contador de uso de reglas relacionadas (best-effort)
  try {
    await db.rpc('increment_coach_memoria_uso' as never)
  } catch { /* no-op */ }
}

// ── Función auxiliar: resumir señales de aprendizaje del sistema ──
export async function obtenerEstadisticasAprendizaje(): Promise<{
  total_señales: number
  tasa_aprobacion: number
  reglas_aprendidas: number
  agentes_stats: Record<string, { aprobados: number; rechazados: number }>
}> {
  const db = createServiceSupabase()

  const { data: señales } = await db
    .from('agente_aprendizaje')
    .select('agente, decision')
    .order('created_at', { ascending: false })
    .limit(500)

  const { count: reglas } = await db
    .from('coach_memoria')
    .select('*', { count: 'exact', head: true })
    .eq('creado_por', 'agente_aprendizaje')

  const stats: Record<string, { aprobados: number; rechazados: number }> = {}
  let aprobados = 0

  for (const s of señales ?? []) {
    if (!stats[s.agente]) stats[s.agente] = { aprobados: 0, rechazados: 0 }
    if (s.decision === 'aprobado' || s.decision === 'modificado') {
      stats[s.agente].aprobados++
      aprobados++
    } else {
      stats[s.agente].rechazados++
    }
  }

  return {
    total_señales: señales?.length ?? 0,
    tasa_aprobacion: señales?.length ? aprobados / señales.length : 0,
    reglas_aprendidas: reglas ?? 0,
    agentes_stats: stats,
  }
}
