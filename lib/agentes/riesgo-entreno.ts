// ================================================================
// AGENTE RIESGO ENTRENAMIENTO
// Detecta clientes que no están registrando sesiones de entreno.
// Se ejecuta diariamente. Solo actúa si hay plan activo + inactividad.
// ================================================================

import { llamarGemini, guardarTareaAgente } from './executor'
import { createServiceSupabase } from '@/lib/supabase-server'

const DIAS_SIN_SESION_UMBRAL = 10  // >10 días sin registrar → alerta

export async function ejecutarAgenteRiesgoEntreno(clienteId: string): Promise<void> {
  const db = createServiceSupabase()

  // 1. Verificar que el cliente tiene plan de entreno activo
  const { data: plan } = await db
    .from('planes_entrenamiento')
    .select('id, nombre')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .single()

  if (!plan) return  // Sin plan activo → no aplica

  // 2. Última sesión registrada
  const { data: ultimaSesion } = await db
    .from('registros_sets')
    .select('fecha')
    .eq('cliente_id', clienteId)
    .order('fecha', { ascending: false })
    .limit(1)
    .single()

  const diasSin = ultimaSesion
    ? Math.floor((Date.now() - new Date(ultimaSesion.fecha).getTime()) / 86_400_000)
    : 99

  if (diasSin < DIAS_SIN_SESION_UMBRAL) return

  // 3. Evitar tarea duplicada pendiente
  const { count } = await db
    .from('agente_tareas')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .eq('tipo', 'alerta_riesgo_entreno')
    .eq('estado', 'pendiente')

  if (count && count > 0) return

  // 4. Cargar contexto mínimo
  const { data: perfil } = await db
    .from('profiles')
    .select('nombre, apellidos')
    .eq('id', clienteId)
    .single()

  const nombre = [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(' ') || 'el cliente'

  const { data: sesionesTotal } = await db
    .from('registros_sets')
    .select('fecha', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)

  // 5. Llamar Gemini para mensaje personalizado
  const prompt = `Eres el agente de adherencia al entrenamiento de NutriCoach.

CLIENTE: ${nombre}
PLAN ACTIVO: ${plan.nombre}
DÍAS SIN REGISTRAR SESIÓN: ${diasSin}
SESIONES TOTALES REGISTRADAS: ${sesionesTotal ?? 0}

Genera un mensaje corto (max 2 frases) que el coach enviará al cliente para reactivar su adherencia al plan de entrenamiento. Debe ser empático, concreto, sin clichés.

Responde en JSON: {"propuesta": "mensaje al cliente", "razonamiento": "por qué este ángulo (max 60 palabras)", "prioridad": 1-10}`

  let raw: string
  try {
    raw = await llamarGemini(prompt, 0.4)
  } catch {
    return
  }

  let parsed: { propuesta: string; razonamiento: string; prioridad: number }
  try {
    parsed = JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return
    try { parsed = JSON.parse(match[0]) } catch { return }
  }

  if (!parsed.propuesta) return

  await guardarTareaAgente('riesgo', {
    tipo: 'alerta_riesgo_entreno',
    propuesta: parsed.propuesta,
    razonamiento: parsed.razonamiento ?? '',
    payload: {
      dias_sin_sesion: diasSin,
      plan_nombre: plan.nombre,
    },
    fuentes: [],
    prioridad: Number(parsed.prioridad ?? 3),
    score_confianza: 0.75,
    requiere_aprobacion: true,
  }, clienteId)
}
