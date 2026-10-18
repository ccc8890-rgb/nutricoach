// lib/rendimiento/aplicar-decision.ts
// Aplica al plan (y al reloj) un cambio de pasos propuesto por el entrenador IA y aprobado por el coach.
import type { SupabaseClient } from '@supabase/supabase-js'
import { validarPasos, resumenSesion, type Paso } from '@/lib/entrenos/pasos'
import { ritmosDesdeVdot, type Ritmos } from '@/lib/entrenos/ritmos'
import { validarCambioPasos } from './cambio-sesion'
import { enviarSesionAGarmin, ErrorGarmin } from '@/lib/integraciones/garmin-workouts'
import { ES_EXIGENTE, evaluarMover, fechaCorta, moverValido, persistirCambios, sincronizarGarminAtleta, type MoverGuardado } from './mover-sesion'

export interface DecisionGuardada {
  sesion?: string
  cambio?: string
  metrica_objetivo?: string
  direccion?: string
  sesion_id?: string
  pasos?: unknown
  /** Mover la sesión de día solo en esa fecha (en lugar de cambiar sus pasos). */
  mover?: MoverGuardado
  aplicada?: { at: string; anteriores?: unknown } | null
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
  /** Cosas a tener en cuenta antes de aplicar (p. ej. qué más hay ese día). */
  avisos?: string[]
  tipo?: 'pasos' | 'mover'
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

export async function vistaPreviaMover(db: SupabaseClient, clienteId: string, d: DecisionGuardada, hoy = new Date().toISOString().slice(0, 10)): Promise<VistaPrevia | null> {
  const m = d.mover
  if (!moverValido(m)) return null
  const base = { sesionId: m.sesion_id, distanciaActualKm: null, distanciaNuevaKm: null, tipo: 'mover' as const }
  // Ya aplicado: se enseña lo que se hizo (y se podrá deshacer); no se vuelve a evaluar contra el calendario.
  if (d.aplicada) {
    const ev = await evaluarMover(db, clienteId, m, hoy, true)
    return { ...base, sesionNombre: ev.ok ? ev.nombre : 'Sesión', actual: [fechaCorta(m.desde)], nuevo: [fechaCorta(m.hasta)], valido: ev.ok, error: ev.ok ? undefined : ev.error }
  }
  const ev = await evaluarMover(db, clienteId, m, hoy)
  if (!ev.ok) return { ...base, sesionNombre: 'Sesión', actual: [fechaCorta(m.desde)], nuevo: [fechaCorta(m.hasta)], valido: false, error: ev.error }
  const avisos = [
    ev.esDescanso ? `El ${fechaCorta(m.hasta)} está libre.` : `Ese día ya hay: ${ev.enDestino.join(', ')}.`,
    ...(ES_EXIGENTE.test(ev.nombre) && ev.enDestino.some(n => ES_EXIGENTE.test(n)) ? ['Ojo: ese día ya tiene otra sesión exigente.'] : []),
    ...(ES_EXIGENTE.test(ev.nombre) ? ev.vecinos.filter(v => v.nombres.some(n => ES_EXIGENTE.test(n))).map(v => `Ojo: ${v.fecha < m.hasta ? 'el día anterior' : 'el día siguiente'} (${fechaCorta(v.fecha)}) hay otra sesión exigente: ${v.nombres.filter(n => ES_EXIGENTE.test(n)).join(', ')}.`) : []),
    'Solo cambia esa fecha; la plantilla semanal y la dieta de ese día siguen igual.',
  ]
  return { ...base, sesionNombre: ev.nombre, actual: [`${fechaCorta(m.desde)} · ${ev.nombre}`], nuevo: [`${fechaCorta(m.hasta)} · ${ev.nombre}`], valido: true, avisos }
}

export async function vistaPreviaDecision(db: SupabaseClient, clienteId: string, d: DecisionGuardada): Promise<VistaPrevia | null> {
  if (d.mover) return vistaPreviaMover(db, clienteId, d)
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
  if (d?.mover) return aplicarMoverDecision(db, p, tarea.id, payload, d)
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

async function aplicarMoverDecision(
  db: SupabaseClient,
  p: { clienteId: string; indice: number; deshacer?: boolean },
  tareaId: string,
  payload: { decisiones?: DecisionGuardada[] },
  d: DecisionGuardada,
): Promise<ResultadoAplicar> {
  const m = d.mover
  if (!moverValido(m)) return { ok: false, error: 'La propuesta de mover la sesión no es válida', status: 422 }
  if (p.deshacer && !d.aplicada) return { ok: false, error: 'Este cambio no está aplicado', status: 409 }
  if (!p.deshacer && d.aplicada) return { ok: false, error: 'Este cambio ya está aplicado', status: 409 }

  const hoy = new Date().toISOString().slice(0, 10)
  const ev = await evaluarMover(db, p.clienteId, m, hoy, !!p.deshacer)
  if (!ev.ok) return { ok: false, error: ev.error, status: 409 }
  if (!(await persistirCambios(db, ev.planId, ev.cambios))) return { ok: false, error: 'No se pudo cambiar el calendario', status: 500 }

  const decisiones = [...(payload.decisiones ?? [])]
  decisiones[p.indice] = p.deshacer ? { ...d, aplicada: null } : { ...d, aplicada: { at: new Date().toISOString() } }
  const { error } = await db.from('agente_tareas').update({ payload: { ...payload, decisiones } }).eq('id', tareaId)
  if (error) {
    // Sin constancia no se podría deshacer: se devuelve el calendario a como estaba.
    const inv = await evaluarMover(db, p.clienteId, m, hoy, !p.deshacer)
    if (inv.ok) await persistirCambios(db, inv.planId, inv.cambios)
    return { ok: false, error: 'No se pudo guardar el registro del cambio; no se ha modificado nada', status: 500 }
  }

  const g = await sincronizarGarminAtleta(p.clienteId)
  return { ok: true, accion: p.deshacer ? 'deshecha' : 'aplicada', garmin: { enviado: g.ok, fecha: p.deshacer ? m.desde : m.hasta, aviso: g.aviso } }
}
