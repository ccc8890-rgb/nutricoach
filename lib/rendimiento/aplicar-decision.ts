// lib/rendimiento/aplicar-decision.ts
// Aplica al plan (y al reloj) un cambio de pasos propuesto por el entrenador IA y aprobado por el coach.
import type { SupabaseClient } from '@supabase/supabase-js'
import { validarPasos, resumenSesion, type Paso } from '@/lib/entrenos/pasos'
import { ritmosDesdeVdot, type Ritmos } from '@/lib/entrenos/ritmos'
import { validarCambioPasos } from './cambio-sesion'
import { enviarSesionAGarmin, ErrorGarmin } from '@/lib/integraciones/garmin-workouts'

export interface DecisionGuardada {
  sesion?: string
  cambio?: string
  sesion_id?: string
  pasos?: unknown
  aplicada?: { at: string; anteriores: unknown } | null
}

export interface VistaPrevia {
  sesionId: string
  sesionNombre: string
  actual: string[]
  nuevo: string[]
  distanciaActualKm: number | null
  distanciaNuevaKm: number | null
  valido: boolean
  error?: string
}

/** Forma canónica para comparar: sin notas de texto y con las claves ordenadas. */
function canonico(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(canonico)
  if (x && typeof x === 'object') {
    return Object.fromEntries(Object.entries(x as Record<string, unknown>)
      .filter(([k]) => k !== 'nota')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, canonico(v)]))
  }
  return x
}

/** True si dos listas de pasos hacen lo mismo en el reloj (las notas de texto no cuentan). */
export function sinCambios(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonico(a)) === JSON.stringify(canonico(b))
}

async function ritmosDe(db: SupabaseClient, clienteId: string): Promise<Ritmos | null> {
  const { data } = await db.from('perfil_entreno_cliente').select('vdot').eq('cliente_id', clienteId).maybeSingle()
  return data?.vdot ? ritmosDesdeVdot(Number(data.vdot)) : null
}

/** Sesión del plan ACTIVO del atleta, o null si no existe o es de otro plan. */
async function sesionDelPlanActivo(db: SupabaseClient, clienteId: string, sesionId: string) {
  const { data: s } = await db.from('sesiones_entrenamiento').select('id,nombre,pasos,plan_id').eq('id', sesionId).maybeSingle()
  if (!s) return null
  const { data: plan } = await db.from('planes_entrenamiento').select('id').eq('id', s.plan_id).eq('cliente_id', clienteId).eq('activo', true).maybeSingle()
  return plan ? s : null
}

export async function vistaPreviaDecision(db: SupabaseClient, clienteId: string, d: DecisionGuardada): Promise<VistaPrevia | null> {
  if (!d.sesion_id || !d.pasos) return null
  const sesion = await sesionDelPlanActivo(db, clienteId, d.sesion_id)
  if (!sesion) return null
  const ritmos = await ritmosDe(db, clienteId)
  // Si ya está aplicada, "actual" son los pasos que había antes y "nuevo" los de la propuesta.
  const base = d.aplicada ? d.aplicada.anteriores : sesion.pasos
  if (!d.aplicada && sinCambios(base, d.pasos)) return null // propuesta idéntica a lo que ya hay: no hay nada que aplicar
  const a = validarPasos(base)
  const n = validarPasos(d.pasos)
  const ra = a.ok ? resumenSesion(a.pasos, ritmos) : null
  const rn = n.ok ? resumenSesion(n.pasos, ritmos) : null
  const val = validarCambioPasos(base, d.pasos, ritmos)
  return {
    sesionId: sesion.id,
    sesionNombre: sesion.nombre,
    actual: ra?.lineas ?? [],
    nuevo: rn?.lineas ?? [],
    distanciaActualKm: ra ? Math.round(ra.distancia_m / 100) / 10 : null,
    distanciaNuevaKm: rn ? Math.round(rn.distancia_m / 100) / 10 : null,
    valido: val.ok,
    error: val.ok ? undefined : val.error,
  }
}

export type ResultadoAplicar =
  | { ok: true; accion: 'aplicada' | 'deshecha'; garmin: { enviado: boolean; fecha?: string | null; aviso?: string } }
  | { ok: false; error: string; status: number }

export async function aplicarDecision(
  db: SupabaseClient,
  p: { clienteId: string; tareaId: string; indice: number; deshacer?: boolean; enviar?: typeof enviarSesionAGarmin },
): Promise<ResultadoAplicar> {
  const { data: tarea } = await db.from('agente_tareas').select('id,payload').eq('id', p.tareaId).eq('cliente_id', p.clienteId).eq('tipo', 'analisis_rendimiento').maybeSingle()
  if (!tarea) return { ok: false, error: 'Análisis no encontrado', status: 404 }
  const payload = (tarea.payload ?? {}) as { decisiones?: DecisionGuardada[] }
  const d = payload.decisiones?.[p.indice]
  if (!d?.sesion_id || !d.pasos) return { ok: false, error: 'Esta decisión no trae un cambio de pasos aplicable', status: 422 }

  const sesion = await sesionDelPlanActivo(db, p.clienteId, d.sesion_id)
  if (!sesion) return { ok: false, error: 'La sesión ya no pertenece al plan activo del atleta', status: 409 }
  const ritmos = await ritmosDe(db, p.clienteId)

  let pasosFinales: Paso[]
  if (p.deshacer) {
    if (!d.aplicada) return { ok: false, error: 'Este cambio no está aplicado', status: 409 }
    const v = validarPasos(d.aplicada.anteriores)
    if (!v.ok) return { ok: false, error: 'No se pueden restaurar los pasos anteriores', status: 422 }
    pasosFinales = v.pasos
  } else {
    if (d.aplicada) return { ok: false, error: 'Este cambio ya está aplicado', status: 409 }
    if (sinCambios(sesion.pasos, d.pasos)) return { ok: false, error: 'El cambio propuesto es idéntico a la sesión actual', status: 422 }
    const v = validarCambioPasos(sesion.pasos, d.pasos, ritmos)
    if (!v.ok) return { ok: false, error: v.error, status: 422 }
    pasosFinales = v.pasos
  }

  const { error: e1 } = await db.from('sesiones_entrenamiento').update({ pasos: pasosFinales }).eq('id', sesion.id)
  if (e1) return { ok: false, error: 'No se pudo actualizar la sesión', status: 500 }

  const decisiones = [...(payload.decisiones ?? [])]
  decisiones[p.indice] = p.deshacer
    ? { ...d, aplicada: null }
    : { ...d, aplicada: { at: new Date().toISOString(), anteriores: sesion.pasos } }
  const { error: e2 } = await db.from('agente_tareas').update({ payload: { ...payload, decisiones } }).eq('id', tarea.id)
  if (e2) {
    // Sin constancia del cambio no hay forma de deshacerlo después: se revierte la sesión.
    await db.from('sesiones_entrenamiento').update({ pasos: sesion.pasos }).eq('id', sesion.id)
    return { ok: false, error: 'No se pudo guardar el registro del cambio; no se ha modificado nada', status: 500 }
  }

  // Al reloj: mejor esfuerzo. Si falla, el plan ya está cambiado y el cron diario lo reintentará (los pasos cambiaron).
  let garmin: { enviado: boolean; fecha?: string | null; aviso?: string }
  try {
    const r = await (p.enviar ?? enviarSesionAGarmin)(db, sesion.id)
    garmin = { enviado: true, fecha: r.fecha }
  } catch (e) {
    garmin = { enviado: false, aviso: e instanceof ErrorGarmin ? e.mensaje : 'No se pudo enviar al reloj ahora; se reintentará con el envío diario' }
  }
  return { ok: true, accion: p.deshacer ? 'deshecha' : 'aplicada', garmin }
}
