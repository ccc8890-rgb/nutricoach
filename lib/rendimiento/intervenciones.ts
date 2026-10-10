// lib/rendimiento/intervenciones.ts
// Cambios que el coach ha aplicado al plan del atleta y cuya evolución se quiere seguir.
import type { SupabaseClient } from '@supabase/supabase-js'
import { CLAVES_METRICA, type ClaveMetrica, type Direccion } from './seguimiento'

export type TipoIntervencion = 'cambio_sesion' | 'semana_plan'

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

  return salida.sort((a, b) => b.fecha.localeCompare(a.fecha))
}
