// lib/rendimiento/plan-cliente.ts
// Calcula el plan hacia una carrera con los datos reales de un atleta (VDOT, carga y volumen recientes).
import type { SupabaseClient } from '@supabase/supabase-js'
import { generarPlan, type PlanObjetivo, type ObjetivoCarrera } from './plan-objetivo'
import { construirPanel, type EntrenoPanel } from './panel'
import { esCarrera } from './carga'

export interface BaseAtleta { vdot: number; cargaSemanalActual: number; kmSemanaActual: number; tiradaMaxKm: number }

export async function planParaCliente(
  db: SupabaseClient,
  clienteId: string,
  objetivo: ObjetivoCarrera,
  hoy: string,
): Promise<{ ok: true; plan: PlanObjetivo; base: BaseAtleta } | { ok: false; error: string }> {
  const desde = new Date(Date.now() - 42 * 86_400_000).toISOString().slice(0, 10)
  const [{ data: perfil }, { data: entrenos }] = await Promise.all([
    db.from('perfil_entreno_cliente').select('vdot').eq('cliente_id', clienteId).maybeSingle(),
    db.from('entrenos_realizados').select('fecha,tipo,nombre,duracion_s,distancia_m,ritmo_medio_s_km,fc_media,tss,tss_metodo,carga_garmin,vo2max,tiempo_zona_fc,mejores_parciales,raw').eq('cliente_id', clienteId).gte('fecha', desde).order('fecha'),
  ])
  const vdot = perfil?.vdot ? Number(perfil.vdot) : null
  if (!vdot) return { ok: false, error: 'El atleta no tiene VDOT: hace falta para calcular ritmos' }

  const lista = (entrenos ?? []) as EntrenoPanel[]
  const panel = construirPanel(lista, [], hoy, 60)
  const completas = panel.semanas.slice(-5, -1) // las 4 últimas semanas cerradas
  const media = (v: number[]) => (v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0)
  const tiradaMaxKm = Math.max(0, ...lista.filter(e => esCarrera(e.tipo) && e.tipo !== 'treadmill_running').map(e => (e.distancia_m ?? 0) / 1000))
  const base: BaseAtleta = {
    vdot,
    cargaSemanalActual: Math.round(media(completas.map(s => s.tss))),
    kmSemanaActual: Math.round(media(completas.map(s => s.km)) * 10) / 10,
    tiradaMaxKm: Math.round(tiradaMaxKm * 10) / 10,
  }
  const plan = generarPlan({ hoy, objetivo, ...base })
  if ('error' in plan) return { ok: false, error: plan.error }
  return { ok: true, plan, base }
}
