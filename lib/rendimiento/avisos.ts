// lib/rendimiento/avisos.ts
// Avisa al coach cuando salta una alerta de gravedad alta en el panel de rendimiento.
// Sin IA: solo reglas deterministas. Aparece en la bandeja «IA» del dashboard como tarea pendiente.
import { createServiceSupabase } from '@/lib/supabase-server'
import { construirContextoRendimiento } from './contexto'
import { guardarTareaAgente } from '@/lib/agentes/executor'

/** Un mismo aviso no se repite hasta pasados estos días, aunque la alerta siga activa. */
const DIAS_SIN_REPETIR = 7

export type ResultadoAviso =
  | { ok: true; tareaId: string; codigos: string[] }
  | { ok: false; motivo: string }

export async function generarAvisoRendimiento(clienteId: string): Promise<ResultadoAviso> {
  const db = createServiceSupabase()
  const hoy = new Date().toISOString().slice(0, 10)

  const ctx = await construirContextoRendimiento(db, clienteId, hoy)
  if (!ctx.hayDatos) return { ok: false, motivo: 'sin entrenos recientes' }

  const altas = ctx.alertas.filter(a => a.gravedad === 'alta')
  if (altas.length === 0) return { ok: false, motivo: 'sin alertas altas' }

  const desde = new Date(Date.now() - DIAS_SIN_REPETIR * 86_400_000).toISOString()
  const { data: previas } = await db.from('agente_tareas').select('payload')
    .eq('cliente_id', clienteId).eq('tipo', 'alerta_rendimiento').gte('created_at', desde)
  const avisadas = new Set<string>()
  for (const t of previas ?? []) {
    const codigos = (t.payload as { codigos?: unknown } | null)?.codigos
    if (Array.isArray(codigos)) codigos.forEach(c => typeof c === 'string' && avisadas.add(c))
  }

  const nuevas = altas.filter(a => !avisadas.has(a.codigo))
  if (nuevas.length === 0) return { ok: false, motivo: 'ya avisado esta semana' }

  const tarea = await guardarTareaAgente('director', {
    tipo: 'alerta_rendimiento',
    propuesta: nuevas.map(a => a.texto).join(' '),
    razonamiento: 'Regla de seguridad automática del panel de rendimiento (sin IA).',
    payload: { codigos: nuevas.map(a => a.codigo), alertas: nuevas, metricas: ctx.metricas },
    fuentes: [],
    prioridad: 1,
    score_confianza: 1,
    requiere_aprobacion: true,
  }, clienteId)

  return tarea ? { ok: true, tareaId: tarea.id, codigos: nuevas.map(a => a.codigo) } : { ok: false, motivo: 'no se pudo guardar el aviso' }
}
