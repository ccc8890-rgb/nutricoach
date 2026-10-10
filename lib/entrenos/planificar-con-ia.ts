// lib/entrenos/planificar-con-ia.ts
// «Planificar con IA»: decide el modo, genera la propuesta y la deja como tarea pendiente (nunca cambia el plan activo).
import type { SupabaseClient } from '@supabase/supabase-js'
import { decidirModoPlanificacion, type DecisionModo, type ModoPlanificacion } from './planificar-modo'
import { ErrorGeneracionPlan, generarPlanEntrenoIA, type ResultadoGeneracionPlan } from './generar-plan-ia'
import type { ResultadoMacro } from './macrociclo'
import type { ResultadoValidacion } from './validar-plan-carrera'
import { ejecutarAnalisisRendimiento } from '@/lib/agentes/analisis-rendimiento'
import { normalizarDuracionSemanas } from './guardar-plan'

export interface PayloadPlanEntrenoIA {
  modo: ModoPlanificacion
  fase_bloque: string | null
  nombre_plan: string
  duracion_semanas: number | null
  es_hibrido: boolean
  plan: Record<string, unknown>
  macrociclo: ResultadoMacro | null
  validacion: ResultadoValidacion | null
  generado_en: string
}

export type ResultadoPlanificacion =
  | { ok: true; modo: ModoPlanificacion; tareaId: string; resumen: string }
  | { ok: false; modo: ModoPlanificacion | null; codigo: 'YA_HAY_PROPUESTA' | 'SIN_DATOS' | 'IA_ERROR' | 'CLIENTE_NO_ENCONTRADO'; motivo: string }

export function estadoHttpDe(r: Extract<ResultadoPlanificacion, { ok: false }>): number {
  return r.codigo === 'YA_HAY_PROPUESTA' ? 409 : r.codigo === 'SIN_DATOS' ? 422 : r.codigo === 'CLIENTE_NO_ENCONTRADO' ? 404 : 502
}

export function construirResumenPropuesta(r: ResultadoGeneracionPlan, modo: ModoPlanificacion): string {
  const sesiones = ((r.planIA.sesiones as unknown[]) ?? []).length
  const partes = [r.faseBloque ? `Bloque ${r.faseBloque}` : modo === 'siguiente_bloque' ? 'Siguiente bloque' : 'Plan nuevo']
  const min = r.macrociclo?.semanas[0]?.minutos
  partes.push(min ? `${sesiones} sesiones (${min} min de carrera/semana)` : `${sesiones} sesiones`)
  const avisos = r.validacion?.hallazgos.length ?? 0
  if (avisos) partes.push(`${avisos} ${avisos === 1 ? 'aviso' : 'avisos'} del validador`)
  return partes.join(' · ')
}

export function construirPayloadPropuesta(r: ResultadoGeneracionPlan, modo: ModoPlanificacion): PayloadPlanEntrenoIA {
  // Lo que devuelve la IA puede venir incompleto: una propuesta que luego no se pueda aprobar es peor que una normalizada.
  const sesiones = ((r.planIA.sesiones as Record<string, unknown>[] | undefined) ?? []).map((s, i) => ({
    ...s, nombre: typeof s?.nombre === 'string' && s.nombre.trim() ? s.nombre : `Sesión ${i + 1}`,
  }))
  return {
    modo, fase_bloque: r.faseBloque, nombre_plan: r.nombrePlan, duracion_semanas: normalizarDuracionSemanas(r.duracionSemanas), es_hibrido: r.esHibrido,
    plan: { ...r.planIA, sesiones }, macrociclo: r.macrociclo, validacion: r.validacion, generado_en: new Date().toISOString(),
  }
}

async function hayPropuestaPendiente(sb: SupabaseClient, clienteId: string): Promise<boolean> {
  const { data } = await sb.from('agente_tareas').select('id').eq('cliente_id', clienteId).eq('tipo', 'plan_entreno_ia').in('estado', ['pendiente', 'en_revision']).limit(1)
  return (data ?? []).length > 0
}

export async function leerModoPlanificacion(sb: SupabaseClient, clienteId: string): Promise<DecisionModo & { hayPropuestaPendiente: boolean }> {
  const { data: plan } = await sb.from('planes_entrenamiento').select('id,created_at,duracion_semanas').eq('cliente_id', clienteId).eq('activo', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const decision = decidirModoPlanificacion(plan ? { created_at: plan.created_at as string, duracion_semanas: (plan.duracion_semanas as number | null) ?? null } : null)
  return { ...decision, hayPropuestaPendiente: await hayPropuestaPendiente(sb, clienteId) }
}

export async function planificarConIA(sb: SupabaseClient, input: { clienteId: string }): Promise<ResultadoPlanificacion> {
  const modoActual = await leerModoPlanificacion(sb, input.clienteId)
  if (modoActual.hayPropuestaPendiente) {
    return { ok: false, modo: modoActual.modo, codigo: 'YA_HAY_PROPUESTA', motivo: 'Ya hay una propuesta de plan pendiente de aprobar para este cliente.' }
  }

  // A mitad de bloque no se sustituye nada: se pide el análisis de rendimiento con los datos reales (ya crea su propia tarea).
  if (modoActual.modo === 'ajustar') {
    // Cada análisis cuesta una llamada a la IA: si ya hay uno reciente sin revisar, se remite a él.
    const hace24h = new Date(Date.now() - 86_400_000).toISOString()
    const { data: pendiente } = await sb.from('agente_tareas').select('id').eq('cliente_id', input.clienteId).eq('tipo', 'analisis_rendimiento').eq('estado', 'pendiente').gte('created_at', hace24h).limit(1)
    if ((pendiente ?? []).length) return { ok: false, modo: 'ajustar', codigo: 'YA_HAY_PROPUESTA', motivo: 'Ya hay un análisis de rendimiento reciente pendiente de revisar: está en Rendimiento → Análisis IA.' }
    const a = await ejecutarAnalisisRendimiento(input.clienteId, { forzar: true })
    if (!a.ok || !a.tareaId) return { ok: false, modo: 'ajustar', codigo: 'SIN_DATOS', motivo: a.motivo ?? 'No hay datos suficientes del reloj para proponer ajustes. Sigue el plan actual unas semanas más.' }
    return { ok: true, modo: 'ajustar', tareaId: a.tareaId, resumen: 'Análisis de rendimiento generado: revísalo en Rendimiento → Análisis IA.' }
  }

  try {
    const r = await generarPlanEntrenoIA(sb, { clienteId: input.clienteId })
    const resumen = construirResumenPropuesta(r, modoActual.modo)
    const { data: tarea, error } = await sb.from('agente_tareas').insert({
      tipo: 'plan_entreno_ia', cliente_id: input.clienteId, agente: 'planificador', estado: 'pendiente', prioridad: 2,
      payload: construirPayloadPropuesta(r, modoActual.modo),
      propuesta: resumen,
      razonamiento: typeof r.planIA.fundamentacion === 'string' ? r.planIA.fundamentacion : null,
      fuentes: [],
    }).select('id').single()
    if (error || !tarea) return { ok: false, modo: modoActual.modo, codigo: 'IA_ERROR', motivo: 'No se pudo guardar la propuesta.' }
    return { ok: true, modo: modoActual.modo, tareaId: tarea.id as string, resumen }
  } catch (e) {
    if (e instanceof ErrorGeneracionPlan) return { ok: false, modo: modoActual.modo, codigo: e.codigo === 'CLIENTE_NO_ENCONTRADO' ? 'CLIENTE_NO_ENCONTRADO' : 'IA_ERROR', motivo: e.message }
    console.error('planificarConIA:', e instanceof Error ? e.message : e)
    return { ok: false, modo: modoActual.modo, codigo: 'IA_ERROR', motivo: 'No se pudo generar la propuesta.' }
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validarCuerpoPlanificar(b: unknown): { ok: true; clienteId: string } | { ok: false; motivo: string } {
  const id = b && typeof b === 'object' ? (b as { cliente_id?: unknown }).cliente_id : undefined
  if (typeof id !== 'string' || !UUID.test(id)) return { ok: false, motivo: 'cliente_id no válido' }
  return { ok: true, clienteId: id }
}
