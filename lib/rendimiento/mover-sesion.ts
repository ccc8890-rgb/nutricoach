// lib/rendimiento/mover-sesion.ts
// Mover UNA sesión de día (solo esa fecha) por propuesta del entrenador IA. Usa los ajustes por fecha del calendario
// (calendario_entreno_ajustes): la plantilla semanal no cambia y se puede deshacer devolviendo la sesión a su día.
import type { SupabaseClient } from '@supabase/supabase-js'
import { diaSemanaDe, esFechaISO, ocurrenciasDelDia, planificarOperacion, sumarDias, type Ajuste, type CambioBD } from '@/lib/entrenos/calendario-ajustes'
import { plantillaActivaEn } from '@/lib/entrenos/ventana-plan'

export interface MoverGuardado { sesion_id: string; desde: string; hasta: string }

/** Cuántos días por delante se admite mover una sesión. */
export const HORIZONTE_MOVER_DIAS = 28

/** Sesiones que cargan mucho las piernas o el sistema (calidad, tirada, híbridas de pierna): no conviene pegarlas entre sí. */
export const ES_EXIGENTE = /series|tempo|intervalo|tirada|pierna|h[ií]brid|sled|calidad|umbral|fartlek|pliometr|competici/i

export const fechaCorta = (f: string) => `${diaSemanaDe(f)} ${f.slice(8, 10)}-${f.slice(5, 7)}`

export function moverValido(x: unknown): x is MoverGuardado {
  if (!x || typeof x !== 'object') return false
  const m = x as Record<string, unknown>
  return typeof m.sesion_id === 'string' && esFechaISO(m.desde) && esFechaISO(m.hasta)
}

export type EvaluacionMover =
  | { ok: true; planId: string; nombre: string; cambios: CambioBD[]; enDestino: string[]; esDescanso: boolean; vecinos: { fecha: string; nombres: string[] }[] }
  | { ok: false; error: string }

/** Comprueba, con el calendario REAL de hoy, que la sesión ocurre en `desde` y se puede llevar a `hasta`. */
export async function evaluarMover(db: SupabaseClient, clienteId: string, m: MoverGuardado, hoy: string, invertir = false): Promise<EvaluacionMover> {
  const desde = invertir ? m.hasta : m.desde
  const hasta = invertir ? m.desde : m.hasta
  const { data: plan } = await db.from('planes_entrenamiento').select('id, created_at, duracion_semanas').eq('cliente_id', clienteId).eq('activo', true).maybeSingle()
  if (!plan) return { ok: false, error: 'El atleta no tiene plan activo' }
  const { data: sesiones } = await db.from('sesiones_entrenamiento').select('id, nombre, dia_semana').eq('plan_id', plan.id)
  const sesion = (sesiones ?? []).find(s => s.id === m.sesion_id)
  if (!sesion) return { ok: false, error: 'La sesión ya no pertenece al plan activo del atleta' }
  if (!invertir) {
    if (hasta < hoy) return { ok: false, error: `El ${fechaCorta(hasta)} ya ha pasado` }
    if (hasta > sumarDias(hoy, HORIZONTE_MOVER_DIAS)) return { ok: false, error: 'Solo se pueden mover sesiones a las próximas 4 semanas' }
  }
  const { data: ajustesBD } = await db.from('calendario_entreno_ajustes').select('id, sesion_id, tipo, fecha_origen, fecha').eq('plan_id', plan.id)
  const ajustes = (ajustesBD ?? []) as Ajuste[]
  const activa = plantillaActivaEn(plan.created_at as string, plan.duracion_semanas as number | null)
  const cambios = planificarOperacion({ op: 'mover', sesion_id: sesion.id, desde, hasta }, sesiones ?? [], ajustes, activa)
  if (cambios.length === 0) {
    const ocurre = ocurrenciasDelDia(desde, sesiones ?? [], ajustes, activa(desde)).some(o => o.sesion.id === sesion.id)
    return { ok: false, error: ocurre ? `El ${fechaCorta(hasta)} ya tiene esta sesión` : `Esta sesión ya no está el ${fechaCorta(desde)} (el calendario ha cambiado desde el análisis)` }
  }
  const enDestino = ocurrenciasDelDia(hasta, sesiones ?? [], ajustes, activa(hasta)).map(o => String(o.sesion.nombre))
  // Día anterior y posterior al destino, ya sin la sesión que se mueve (para avisar de dos días duros seguidos).
  const vecinos = [sumarDias(hasta, -1), sumarDias(hasta, 1)].map(f => ({
    fecha: f,
    nombres: ocurrenciasDelDia(f, sesiones ?? [], ajustes, activa(f)).filter(o => o.sesion.id !== sesion.id).map(o => String(o.sesion.nombre)),
  })).filter(v => v.nombres.length > 0)
  return { ok: true, planId: plan.id as string, nombre: String(sesion.nombre), cambios, enDestino, esDescanso: enDestino.length === 0, vecinos }
}

/** Escribe los cambios en la tabla de ajustes. */
export async function persistirCambios(db: SupabaseClient, planId: string, cambios: CambioBD[]): Promise<boolean> {
  for (const c of cambios) {
    const r = c.accion === 'insertar'
      ? await db.from('calendario_entreno_ajustes').insert({ plan_id: planId, ...c.fila })
      : c.accion === 'actualizar'
        ? await db.from('calendario_entreno_ajustes').update(c.cambios).eq('id', c.id).eq('plan_id', planId)
        : await db.from('calendario_entreno_ajustes').delete().eq('id', c.id).eq('plan_id', planId)
    if (r.error) return false
  }
  return true
}

/** Pasa el envío a Garmin de este atleta para que el reloj siga la fecha nueva (solo lo que cambió; mejor esfuerzo). */
export async function sincronizarGarminAtleta(clienteId: string): Promise<{ ok: boolean; aviso?: string }> {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return { ok: false, aviso: 'Envío a Garmin no disponible ahora; se actualizará con el envío diario' }
  try {
    const { NextRequest } = await import('next/server')
    const { GET } = await import('@/app/api/cron/enviar-garmin/route')
    const res = await GET(new NextRequest(`http://localhost/api/cron/enviar-garmin?cliente=${clienteId}`, { headers: { authorization: `Bearer ${secreto}` } }))
    const r = await res.json() as { errores?: string[] }
    if (!res.ok || r.errores?.length) return { ok: false, aviso: 'No se pudo actualizar el reloj ahora; se reintentará con el envío diario' }
    return { ok: true }
  } catch {
    return { ok: false, aviso: 'No se pudo actualizar el reloj ahora; se reintentará con el envío diario' }
  }
}

/** Fechas en las que ocurre una sesión en los próximos `dias` (plantilla del bloque + ajustes ya hechos). */
export async function fechasDeSesion(db: SupabaseClient, clienteId: string, sesionId: string, hoy: string, dias = 21): Promise<string[]> {
  const { data: plan } = await db.from('planes_entrenamiento').select('id, created_at, duracion_semanas').eq('cliente_id', clienteId).eq('activo', true).maybeSingle()
  if (!plan) return []
  const { data: sesiones } = await db.from('sesiones_entrenamiento').select('id, dia_semana').eq('plan_id', plan.id)
  const { data: ajustesBD } = await db.from('calendario_entreno_ajustes').select('id, sesion_id, tipo, fecha_origen, fecha').eq('plan_id', plan.id)
  const activa = plantillaActivaEn(plan.created_at as string, plan.duracion_semanas as number | null)
  const out: string[] = []
  for (let i = 0; i < dias; i++) {
    const f = sumarDias(hoy, i)
    if (ocurrenciasDelDia(f, sesiones ?? [], (ajustesBD ?? []) as Ajuste[], activa(f)).some(o => o.sesion.id === sesionId)) out.push(f)
  }
  return out
}
