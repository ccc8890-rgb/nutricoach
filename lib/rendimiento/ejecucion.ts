// lib/rendimiento/ejecucion.ts
// Plan vs realizado de las sesiones de carrera estructuradas del plan activo, semana a semana.
import type { SupabaseClient } from '@supabase/supabase-js'
import { validarPasos, type Paso } from '@/lib/entrenos/pasos'
import { ritmosDesdeVdot } from '@/lib/entrenos/ritmos'
import { esCarrera } from './carga'
import { lunesDe } from './panel'
import { evaluarCumplimiento, emparejarEntreno, fechaDeLaSemana, type Cumplimiento, type EntrenoEmparejable, type EstadoSesion } from './cumplimiento'

export interface EjecucionSesion {
  sesionId: string
  nombre: string
  diaSemana: string
  semana: string
  fechaPrevista: string
  estado: EstadoSesion
  fechaReal: string | null
  duracionMin: number | null
  cumplimiento: Cumplimiento | null
}

export interface ResumenEjecucion {
  sesiones: EjecucionSesion[]
  /** Desde cuándo se compara: la semana en que empezó el plan activo. */
  desdeSemana: string | null
  planNombre: string | null
}

export async function construirEjecucion(db: SupabaseClient, clienteId: string, hoy: string, semanasMax = 4): Promise<ResumenEjecucion> {
  const { data: plan } = await db.from('planes_entrenamiento').select('id,nombre,created_at').eq('cliente_id', clienteId).eq('activo', true).maybeSingle()
  if (!plan) return { sesiones: [], desdeSemana: null, planNombre: null }

  const [{ data: sesiones }, { data: perfil }] = await Promise.all([
    db.from('sesiones_entrenamiento').select('id,nombre,dia_semana,pasos').eq('plan_id', plan.id).not('pasos', 'is', null),
    db.from('perfil_entreno_cliente').select('vdot').eq('cliente_id', clienteId).maybeSingle(),
  ])
  const ritmos = perfil?.vdot ? ritmosDesdeVdot(Number(perfil.vdot)) : null

  // Semanas desde que empezó el plan (como mucho `semanasMax`, incluida la actual).
  const lunesHoy = lunesDe(hoy)
  const lunesPlan = lunesDe(String(plan.created_at).slice(0, 10))
  const lunes: string[] = []
  for (let i = 0, f = lunesHoy; i < semanasMax && f >= lunesPlan; i++) {
    lunes.unshift(f)
    const d = new Date(`${f}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 7)
    f = d.toISOString().slice(0, 10)
  }
  if (!lunes.length || !sesiones?.length) return { sesiones: [], desdeSemana: lunesPlan, planNombre: plan.nombre }

  const { data: entrenos } = await db
    .from('entrenos_realizados')
    .select('fecha,tipo,duracion_s,vueltas,raw')
    .eq('cliente_id', clienteId)
    .gte('fecha', lunes[0])
    .order('fecha')
  const lista = (entrenos ?? []) as EntrenoEmparejable[]

  const salida: EjecucionSesion[] = []
  for (const semana of lunes) {
    for (const s of sesiones) {
      const v = validarPasos(s.pasos)
      const fecha = fechaDeLaSemana(semana, s.dia_semana ?? '')
      if (!v.ok || !fecha) continue
      const { estado, entreno } = emparejarEntreno(fecha, hoy, lista, esCarrera)
      salida.push({
        sesionId: s.id,
        nombre: s.nombre,
        diaSemana: s.dia_semana,
        semana,
        fechaPrevista: fecha,
        estado,
        fechaReal: entreno?.fecha ?? null,
        duracionMin: entreno?.duracion_s ? Math.round(entreno.duracion_s / 60) : null,
        cumplimiento: entreno ? evaluarCumplimiento(v.pasos as Paso[], entreno.vueltas, ritmos) : null,
      })
    }
  }
  salida.sort((a, b) => b.fechaPrevista.localeCompare(a.fechaPrevista))
  return { sesiones: salida, desdeSemana: lunes[0], planNombre: plan.nombre }
}
