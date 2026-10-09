// lib/rendimiento/aplicar-semana.ts
// Lleva una semana del plan-objetivo al plan activo del atleta (y al reloj), con vista previa y deshacer.
import type { SupabaseClient } from '@supabase/supabase-js'
import { validarPasos, resumenSesion, type Paso } from '@/lib/entrenos/pasos'
import { ritmosDesdeVdot } from '@/lib/entrenos/ritmos'
import { proximaFechaDia } from '@/lib/entrenos/proxima-fecha'
import { enviarSesionAGarmin, ErrorGarmin } from '@/lib/integraciones/garmin-workouts'
import { validarCambioPasos } from './cambio-sesion'
import { sinCambios } from './aplicar-decision'
import { fechaDeLaSemana } from './cumplimiento'
import type { PlanObjetivo, TipoClave } from './plan-objetivo'

export type EstadoItem = 'aplicable' | 'aplazada' | 'sin_sesion' | 'invalida' | 'sin_cambios'

export interface ItemSemana {
  tipo: TipoClave
  titulo: string
  estado: EstadoItem
  motivo?: string
  sesionId?: string
  sesionNombre?: string
  diaSemana?: string
  fecha?: string
  actual: string[]
  nuevo: string[]
  distanciaActualKm: number | null
  distanciaNuevaKm: number | null
}

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const indiceDia = (d: string) => { const i = DIAS.indexOf(norm(d).trim()); return i < 0 ? 99 : i }

/**
 * Asigna a cada papel del plan una sesión estructurada del atleta. La tirada es la que se llama «tirada/larga»
 * (o, si ninguna, la del último día); las dos de calidad, las restantes por orden de día. Así el nombre de la
 * sesión no importa y se puede renombrar al aplicar sin perder la asignación.
 */
export function asignarSesiones<T extends { nombre: string; dia_semana: string }>(sesiones: T[]): Partial<Record<TipoClave, T>> {
  const porDia = [...sesiones].sort((a, b) => indiceDia(a.dia_semana) - indiceDia(b.dia_semana))
  const tirada = porDia.find(x => /tirada|larga/.test(norm(x.nombre))) ?? (porDia.length > 2 ? porDia[porDia.length - 1] : undefined)
  const resto = porDia.filter(x => x !== tirada)
  return { calidad1: resto[0], calidad2: resto[1], tirada }
}

/**
 * Decide qué se puede hacer con una sesión clave. Una sesión semanal que ocurre ANTES de que empiece la semana
 * del plan (p. ej. el domingo, cuando el plan arranca el lunes) no se toca: sería adelantar el cambio.
 */
export function estadoDeItem(i: { fechaSemana: string | null; proxima: string | null; validacion: { ok: boolean; error?: string }; identico: boolean }): { estado: EstadoItem; motivo?: string } {
  if (!i.fechaSemana) return { estado: 'invalida', motivo: 'La sesión no tiene un día de la semana válido' }
  if (i.proxima && i.proxima < i.fechaSemana) return { estado: 'aplazada', motivo: `Su próxima fecha (${i.proxima}) cae antes de que empiece esta semana (${i.fechaSemana}); aplícala después` }
  if (!i.validacion.ok) return { estado: 'invalida', motivo: i.validacion.error }
  if (i.identico) return { estado: 'sin_cambios', motivo: 'Ya tiene estos pasos' }
  return { estado: 'aplicable' }
}

const sumarDias = (f: string, n: number) => new Date(new Date(`${f}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10)

interface Sesion { id: string; nombre: string; dia_semana: string; pasos: unknown }

async function cargar(db: SupabaseClient, clienteId: string) {
  const { data: plan } = await db.from('planes_entrenamiento').select('id').eq('cliente_id', clienteId).eq('activo', true).maybeSingle()
  if (!plan) return null
  const [{ data: sesiones }, { data: perfil }] = await Promise.all([
    db.from('sesiones_entrenamiento').select('id,nombre,dia_semana,pasos').eq('plan_id', plan.id).not('pasos', 'is', null),
    db.from('perfil_entreno_cliente').select('vdot,plan_objetivo_log').eq('cliente_id', clienteId).maybeSingle(),
  ])
  return { sesiones: (sesiones ?? []) as Sesion[], vdot: perfil?.vdot ? Number(perfil.vdot) : null, log: Array.isArray(perfil?.plan_objetivo_log) ? perfil.plan_objetivo_log as LogSemana[] : [] }
}

export interface LogSemana { id: string; at: string; semana: number; lunes: string; /** `nombre` y `anteriores` son el nombre y los pasos que tenía la sesión antes del cambio. */
  cambios: { sesionId: string; nombre: string; anteriores: unknown }[] }

export async function prepararSemana(
  db: SupabaseClient, clienteId: string, plan: PlanObjetivo, n: number, hoy: string,
): Promise<{ ok: true; semana: number; lunes: string; fase: string; items: ItemSemana[]; log: LogSemana[] } | { ok: false; error: string; status: number }> {
  const sem = plan.semanas[n - 1]
  if (!sem) return { ok: false, error: 'Esa semana no existe en el plan', status: 400 }
  if (sem.lunes > sumarDias(hoy, 7)) return { ok: false, error: 'Aún queda demasiado para esa semana: se puede aplicar cuando falte una semana o menos', status: 409 }
  const c = await cargar(db, clienteId)
  if (!c) return { ok: false, error: 'El atleta no tiene un plan de entrenamiento activo', status: 409 }
  const ritmos = c.vdot ? ritmosDesdeVdot(c.vdot) : null
  const desde = new Date(`${hoy}T12:00:00`)

  const asignadas = asignarSesiones(c.sesiones)
  const items: ItemSemana[] = sem.claves.map(clave => {
    const sesion = asignadas[clave.tipo]
    const nuevoRes = resumenSesion(clave.pasos, ritmos)
    const base: ItemSemana = { tipo: clave.tipo, titulo: clave.titulo, estado: 'sin_sesion', actual: [], nuevo: nuevoRes.lineas, distanciaActualKm: null, distanciaNuevaKm: Math.round(nuevoRes.distancia_m / 100) / 10 }
    if (!sesion) return { ...base, motivo: 'No hay en el plan activo una sesión estructurada para este papel' }
    const v = validarPasos(sesion.pasos)
    const actual = v.ok ? resumenSesion(v.pasos, ritmos) : null
    const val = validarCambioPasos(sesion.pasos, clave.pasos, ritmos)
    const fechaSemana = fechaDeLaSemana(sem.lunes, sesion.dia_semana)
    const e = estadoDeItem({ fechaSemana, proxima: proximaFechaDia(sesion.dia_semana, desde), validacion: val.ok ? { ok: true } : { ok: false, error: val.error }, identico: sinCambios(sesion.pasos, clave.pasos) })
    return { ...base, ...e, sesionId: sesion.id, sesionNombre: sesion.nombre, diaSemana: sesion.dia_semana, fecha: fechaSemana ?? undefined, actual: actual?.lineas ?? [], distanciaActualKm: actual ? Math.round(actual.distancia_m / 100) / 10 : null }
  })
  return { ok: true, semana: n, lunes: sem.lunes, fase: sem.fase, items, log: c.log }
}

type Enviar = typeof enviarSesionAGarmin

export type ResultadoSemana =
  | { ok: true; aplicadas: { sesion: string; garmin: string }[]; omitidas: number; logId: string }
  | { ok: false; error: string; status: number }

export async function aplicarSemana(
  db: SupabaseClient, clienteId: string, plan: PlanObjetivo, n: number, hoy: string, enviar: Enviar = enviarSesionAGarmin,
): Promise<ResultadoSemana> {
  const prep = await prepararSemana(db, clienteId, plan, n, hoy)
  if (!prep.ok) return prep
  const aplicables = prep.items.filter(i => i.estado === 'aplicable' && i.sesionId)
  if (!aplicables.length) return { ok: false, error: 'No hay ninguna sesión que se pueda aplicar ahora (revisa los motivos en la vista previa)', status: 409 }

  const c = await cargar(db, clienteId)
  const sem = plan.semanas[n - 1]
  const cambios: LogSemana['cambios'] = []
  for (const it of aplicables) {
    const sesion = c!.sesiones.find(s => s.id === it.sesionId)!
    const clave = sem.claves.find(k => k.tipo === it.tipo)!
    const { error } = await db.from('sesiones_entrenamiento').update({ pasos: clave.pasos, nombre: `Carrera: ${clave.titulo}` }).eq('id', sesion.id)
    if (error) {
      for (const x of cambios) await db.from('sesiones_entrenamiento').update({ pasos: x.anteriores, nombre: x.nombre }).eq('id', x.sesionId) // revertir lo ya hecho
      return { ok: false, error: 'No se pudo actualizar una sesión; no se ha cambiado nada', status: 500 }
    }
    cambios.push({ sesionId: sesion.id, nombre: sesion.nombre, anteriores: sesion.pasos })
  }
  const entrada: LogSemana = { id: crypto.randomUUID(), at: new Date().toISOString(), semana: n, lunes: sem.lunes, cambios }
  const { error: eLog } = await db.from('perfil_entreno_cliente').update({ plan_objetivo_log: [...c!.log, entrada].slice(-5) }).eq('cliente_id', clienteId)
  if (eLog) {
    for (const x of cambios) await db.from('sesiones_entrenamiento').update({ pasos: x.anteriores, nombre: x.nombre }).eq('id', x.sesionId)
    return { ok: false, error: 'No se pudo guardar el registro; no se ha cambiado nada', status: 500 }
  }

  const aplicadas: { sesion: string; garmin: string }[] = []
  for (const it of aplicables) {
    try {
      const r = await enviar(db, it.sesionId!, it.fecha)
      aplicadas.push({ sesion: it.sesionNombre!, garmin: `enviada${r.fecha ? ` para el ${r.fecha}` : ''}` })
    } catch (e) {
      aplicadas.push({ sesion: it.sesionNombre!, garmin: e instanceof ErrorGarmin ? e.mensaje : 'no se pudo enviar ahora; se reintentará con el envío diario' })
    }
  }
  return { ok: true, aplicadas, omitidas: prep.items.length - aplicables.length, logId: entrada.id }
}

export async function deshacerSemana(
  db: SupabaseClient, clienteId: string, logId: string, enviar: Enviar = enviarSesionAGarmin,
): Promise<{ ok: true; restauradas: number } | { ok: false; error: string; status: number }> {
  const c = await cargar(db, clienteId)
  if (!c) return { ok: false, error: 'El atleta no tiene un plan de entrenamiento activo', status: 409 }
  const entrada = c.log.find(l => l.id === logId)
  if (!entrada) return { ok: false, error: 'Ese cambio ya no se puede deshacer', status: 404 }
  let restauradas = 0
  for (const x of entrada.cambios) {
    if (!c.sesiones.some(s => s.id === x.sesionId)) continue // la sesión ya no está en el plan activo
    const v = validarPasos(x.anteriores)
    if (!v.ok) continue
    const { error } = await db.from('sesiones_entrenamiento').update({ pasos: v.pasos as Paso[], nombre: x.nombre }).eq('id', x.sesionId)
    if (error) return { ok: false, error: 'No se pudo restaurar una sesión', status: 500 }
    restauradas++
    try { await enviar(db, x.sesionId) } catch { /* el envío diario lo reintentará */ }
  }
  await db.from('perfil_entreno_cliente').update({ plan_objetivo_log: c.log.filter(l => l.id !== logId) }).eq('cliente_id', clienteId)
  return { ok: true, restauradas }
}
