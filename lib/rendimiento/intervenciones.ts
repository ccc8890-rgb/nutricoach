// lib/rendimiento/intervenciones.ts
// Cambios que el coach ha aplicado al plan del atleta y cuya evolución se quiere seguir.
import type { SupabaseClient } from '@supabase/supabase-js'
import { CLAVES_METRICA, type ClaveMetrica, type Direccion } from './seguimiento'

export type TipoIntervencion = 'cambio_sesion' | 'semana_plan' | 'hito'

export interface Intervencion {
  id: string
  tipo: TipoIntervencion
  /** Día (AAAA-MM-DD) en que se aplicó. */
  fecha: string
  titulo: string
  descripcion: string
  objetivo: { clave: ClaveMetrica; direccion?: Direccion } | null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const dia = (iso: unknown): string | null => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null)

export interface Hito {
  id: string
  fecha: string
  titulo: string
  descripcion: string
  metrica_objetivo?: ClaveMetrica
  direccion?: Direccion
}

export const MAX_HITOS = 30

/** Valida y normaliza un hito escrito por el coach. Devuelve el error en español si algo no cuadra. */
export function validarHito(entrada: unknown, hoy: string): { ok: true; hito: Omit<Hito, 'id'> } | { ok: false; error: string } {
  const e = (entrada ?? {}) as Record<string, unknown>
  const fecha = typeof e.fecha === 'string' ? e.fecha : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(new Date(`${fecha}T12:00:00Z`).getTime())) return { ok: false, error: 'La fecha no es válida.' }
  if (fecha > hoy) return { ok: false, error: 'La fecha no puede ser futura: el seguimiento compara con lo que ya ha pasado.' }
  if (fecha < '2020-01-01') return { ok: false, error: 'La fecha es demasiado antigua.' }
  const titulo = typeof e.titulo === 'string' ? e.titulo.trim().slice(0, 100) : ''
  if (!titulo) return { ok: false, error: 'Escribe un título para el cambio.' }
  const descripcion = typeof e.descripcion === 'string' ? e.descripcion.trim().slice(0, 400) : ''
  const metrica = CLAVES_METRICA.find(c => c === e.metrica_objetivo)
  const direccion: Direccion | undefined = e.direccion === 'sube' || e.direccion === 'baja' ? e.direccion : undefined
  const conDireccion = metrica === 'carga_semana' || metrica === 'km_semana'
  if (conDireccion && !direccion) return { ok: false, error: 'Indica si buscabas que suba o que baje.' }
  return { ok: true, hito: { fecha, titulo, descripcion, ...(metrica ? { metrica_objetivo: metrica } : {}), ...(metrica && conDireccion && direccion ? { direccion } : {}) } }
}

/** Decisiones del entrenador IA aplicadas al plan y semanas del plan hacia carrera aplicadas, de la más reciente a la más antigua. */
export async function leerIntervenciones(db: SupabaseClient, clienteId: string): Promise<Intervencion[]> {
  const [{ data: tareas }, { data: perfil }] = await Promise.all([
    db.from('agente_tareas').select('id,payload').eq('cliente_id', clienteId).eq('tipo', 'analisis_rendimiento').order('created_at', { ascending: false }).limit(40),
    db.from('perfil_entreno_cliente').select('plan_objetivo_log').eq('cliente_id', clienteId).maybeSingle(),
  ])

  const salida: Intervencion[] = []

  for (const t of tareas ?? []) {
    const decisiones: any[] = Array.isArray((t.payload as any)?.decisiones) ? (t.payload as any).decisiones : []
    decisiones.forEach((d, i) => {
      const fecha = dia(d?.aplicada?.at)
      if (!fecha) return
      const clave = CLAVES_METRICA.find(c => c === d.metrica_objetivo)
      const direccion: Direccion | undefined = d.direccion === 'sube' || d.direccion === 'baja' ? d.direccion : undefined
      salida.push({
        id: `${t.id}:${i}`,
        tipo: 'cambio_sesion',
        fecha,
        titulo: String(d.sesion ?? 'Cambio de sesión').slice(0, 120),
        descripcion: String(d.cambio ?? '').slice(0, 400),
        objetivo: clave ? { clave, ...(direccion ? { direccion } : {}) } : null,
      })
    })
  }

  const log: any[] = Array.isArray(perfil?.plan_objetivo_log) ? perfil!.plan_objetivo_log : []
  for (const l of log) {
    const fecha = dia(l?.at)
    if (!fecha) continue
    const nombres = (Array.isArray(l.cambios) ? l.cambios : []).map((c: any) => String(c?.nombre ?? '')).filter(Boolean)
    salida.push({
      id: String(l.id ?? `semana:${fecha}`),
      tipo: 'semana_plan',
      fecha,
      titulo: `Semana del plan hacia la carrera${l.semana ? ` (${String(l.semana).slice(0, 10)})` : ''}`,
      descripcion: nombres.length ? `Sesiones modificadas: ${nombres.join(', ')}` : 'Semana aplicada al plan',
      objetivo: null,
    })
  }

  // Los hitos se leen aparte: si la columna aún no existe (migración sin aplicar) no se pierde el resto.
  const { data: conHitos, error: errHitos } = await db.from('perfil_entreno_cliente').select('hitos_entreno').eq('cliente_id', clienteId).maybeSingle()
  const hitos: any[] = !errHitos && Array.isArray(conHitos?.hitos_entreno) ? conHitos!.hitos_entreno : []
  for (const h of hitos) {
    const fecha = dia(h?.fecha)
    if (!fecha || !h?.id) continue
    const clave = CLAVES_METRICA.find(c => c === h.metrica_objetivo)
    const direccion: Direccion | undefined = h.direccion === 'sube' || h.direccion === 'baja' ? h.direccion : undefined
    salida.push({
      id: String(h.id),
      tipo: 'hito',
      fecha,
      titulo: String(h.titulo ?? 'Cambio').slice(0, 120),
      descripcion: String(h.descripcion ?? '').slice(0, 400),
      objetivo: clave ? { clave, ...(direccion ? { direccion } : {}) } : null,
    })
  }

  return salida.sort((a, b) => b.fecha.localeCompare(a.fecha))
}
