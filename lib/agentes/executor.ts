// ================================================================
// EXECUTOR BASE — Llama a DeepSeek y guarda resultado en BD
// ================================================================

import { createServiceSupabase } from '@/lib/supabase-server'
import type {
  TipoAgente,
  ContextoCliente,
  ResultadoAgente,
  AgenteTarea,
  CheckinResumen,
  ClientePerfilAprendizaje,
  CoachMemoria,
} from './types'

const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'

// ── Llamada raw a DeepSeek ────────────────────────────────────
export async function llamarDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.3
): Promise<string> {
  const res = await fetch(DEEPSEEK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DeepSeek error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? '{}'
}

// ── Cargar contexto completo de un cliente ────────────────────
export async function cargarContextoCliente(clienteId: string): Promise<ContextoCliente | null> {
  const db = createServiceSupabase()

  const { data: cliente } = await db
    .from('clientes')
    .select('id, objetivo, peso_inicial, altura, edad, sexo, profiles(nombre, apellidos)')
    .eq('id', clienteId)
    .single()

  if (!cliente) return null

  const profiles = cliente.profiles as { nombre?: string; apellidos?: string } | null

  const { data: plan } = await db
    .from('planes_nutricion')
    .select('id, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const { data: checkins } = await db
    .from('checkins')
    .select('id, fecha_checkin, peso_kg, adherencia_dieta, nivel_energia, calidad_sueno, notas_cliente')
    .eq('cliente_id', clienteId)
    .order('fecha_checkin', { ascending: false })
    .limit(8)

  const { data: perfil } = await db
    .from('cliente_perfil_aprendizaje')
    .select('*')
    .eq('cliente_id', clienteId)
    .single()

  const { data: metodologia } = await db
    .from('coach_memoria')
    .select('*')
    .order('peso', { ascending: false })
    .limit(20)

  return {
    cliente: {
      id: cliente.id,
      nombre: profiles?.nombre ?? null,
      apellidos: profiles?.apellidos ?? null,
      objetivo: cliente.objetivo ?? null,
      peso_inicial: cliente.peso_inicial ?? null,
      altura: cliente.altura ?? null,
      edad: cliente.edad ?? null,
      sexo: cliente.sexo ?? null,
    },
    plan_activo: plan ?? null,
    checkins_recientes: (checkins as CheckinResumen[]) ?? [],
    perfil_aprendizaje: perfil as ClientePerfilAprendizaje | null,
    metodologia_coach: (metodologia as CoachMemoria[]) ?? [],
  }
}

// ── Guardar tarea generada por un agente ─────────────────────
export async function guardarTareaAgente(
  agente: TipoAgente,
  resultado: ResultadoAgente,
  clienteId: string | null
): Promise<AgenteTarea | null> {
  const db = createServiceSupabase()

  const { data, error } = await db
    .from('agente_tareas')
    .insert({
      tipo: resultado.tipo,
      cliente_id: clienteId,
      agente,
      estado: resultado.requiere_aprobacion ? 'pendiente' : 'aprobado',
      prioridad: resultado.prioridad,
      payload: resultado.payload,
      propuesta: resultado.propuesta,
      razonamiento: resultado.razonamiento,
      fuentes: resultado.fuentes,
    })
    .select()
    .single()

  if (error) {
    console.error('[executor] Error guardando tarea:', error)
    return null
  }

  return data as AgenteTarea
}

// ── Registrar señal de aprendizaje tras decisión del coach ───
export async function registrarAprendizaje(
  tarea: AgenteTarea,
  decision: 'aprobado' | 'rechazado' | 'modificado',
  propuestaFinal?: string,
  comentarioCoach?: string
): Promise<void> {
  const db = createServiceSupabase()

  await db.from('agente_aprendizaje').insert({
    tarea_id: tarea.id,
    cliente_id: tarea.cliente_id,
    agente: tarea.agente,
    tipo_tarea: tarea.tipo,
    decision,
    propuesta_original: tarea.propuesta,
    propuesta_final: propuestaFinal ?? tarea.propuesta,
    comentario_coach: comentarioCoach ?? null,
    score_confianza: null,
  })
}

// ── Actualizar perfil de aprendizaje del cliente ─────────────
export async function actualizarPerfilAprendizaje(clienteId: string): Promise<void> {
  const db = createServiceSupabase()

  // Calcular métricas desde checkins reales
  const { data: checkins } = await db
    .from('checkins')
    .select('fecha_checkin, peso_kg, adherencia_dieta, nivel_energia, calidad_sueno')
    .eq('cliente_id', clienteId)
    .order('fecha_checkin', { ascending: false })
    .limit(30)

  if (!checkins?.length) return

  const adherenciaMedia =
    checkins.reduce((s, c) => s + (c.adherencia_dieta ?? 0), 0) / checkins.length

  const pesos = checkins.filter(c => c.peso_kg).map(c => c.peso_kg as number)
  let pesoTendencia: 'bajando' | 'subiendo' | 'estable' = 'estable'
  if (pesos.length >= 2) {
    const diff = pesos[0] - pesos[pesos.length - 1]
    if (diff < -0.3) pesoTendencia = 'bajando'
    else if (diff > 0.3) pesoTendencia = 'subiendo'
  }

  const variabilidadPeso =
    pesos.length > 1
      ? Math.sqrt(
          pesos.reduce((s, p) => s + Math.pow(p - pesos[0], 2), 0) / pesos.length
        )
      : 0

  // Detección de riesgo de abandono: días sin check-in
  const ultimoCheckin = checkins[0]?.fecha_checkin
  const diasSinCheckin = ultimoCheckin
    ? Math.floor((Date.now() - new Date(ultimoCheckin).getTime()) / 86_400_000)
    : 99
  const riesgoAbandono = Math.min(1, diasSinCheckin / 21)

  await db.from('cliente_perfil_aprendizaje').upsert(
    {
      cliente_id: clienteId,
      adherencia_media: Math.round(adherenciaMedia),
      checkins_completados: checkins.length,
      peso_tendencia: pesoTendencia,
      variabilidad_peso: Math.round(variabilidadPeso * 100) / 100,
      riesgo_abandono: Math.round(riesgoAbandono * 100) / 100,
      ultima_actualizacion: new Date().toISOString(),
    },
    { onConflict: 'cliente_id' }
  )
}
