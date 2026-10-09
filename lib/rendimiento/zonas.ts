// lib/rendimiento/zonas.ts
// Zonas de ritmo y recalibración del VDOT con acceso a datos.
import type { SupabaseClient } from '@supabase/supabase-js'
import { ritmosDesdeVdot, type Ritmos } from '@/lib/entrenos/ritmos'
import { leerUmbrales } from './garmin-entrenos'
import { recalibrar, type EntrenoParaVdot, type Recalibracion } from './vdot'

export interface CambioVdot { fecha: string; anterior: number | null; vdot: number; origen: string; motivo: string }

export interface PanelZonas {
  recalibracion: Recalibracion
  zonasActuales: Ritmos | null
  zonasPropuestas: Ritmos | null
  historial: CambioVdot[]
}

export async function calcularZonas(db: SupabaseClient, clienteId: string, hoy: string): Promise<PanelZonas> {
  const desde = new Date(Date.now() - 200 * 86_400_000).toISOString().slice(0, 10)
  const [{ data: entrenos }, { data: perfil }, umbrales] = await Promise.all([
    db.from('entrenos_realizados').select('fecha,tipo,duracion_s,distancia_m,fc_media,mejores_parciales,vueltas').eq('cliente_id', clienteId).gte('fecha', desde),
    db.from('perfil_entreno_cliente').select('vdot,vdot_historial').eq('cliente_id', clienteId).maybeSingle(),
    leerUmbrales(db, clienteId),
  ])
  const vdotActual = perfil?.vdot ? Number(perfil.vdot) : null
  const recalibracion = recalibrar(vdotActual, (entrenos ?? []) as EntrenoParaVdot[], umbrales, hoy)
  return {
    recalibracion,
    zonasActuales: vdotActual ? ritmosDesdeVdot(vdotActual) : null,
    zonasPropuestas: recalibracion.propuesta ? ritmosDesdeVdot(recalibracion.propuesta) : null,
    historial: Array.isArray(perfil?.vdot_historial) ? (perfil!.vdot_historial as CambioVdot[]).slice(-10).reverse() : [],
  }
}

/** Un VDOT nuevo no puede saltar más de 6 puntos de golpe: un salto así casi siempre es un error de datos. */
const SALTO_MAXIMO = 6

export async function aplicarVdot(
  db: SupabaseClient,
  clienteId: string,
  vdotNuevo: number,
  motivo: string,
): Promise<{ ok: true; vdot: number } | { ok: false; error: string; status: number }> {
  if (!Number.isFinite(vdotNuevo) || vdotNuevo < 25 || vdotNuevo > 80) return { ok: false, error: 'El VDOT debe estar entre 25 y 80', status: 400 }
  const redondeado = Math.round(vdotNuevo * 2) / 2
  const { data: perfil } = await db.from('perfil_entreno_cliente').select('vdot,vdot_historial').eq('cliente_id', clienteId).maybeSingle()
  if (!perfil) return { ok: false, error: 'El atleta no tiene perfil de entrenamiento', status: 404 }
  const anterior = perfil.vdot ? Number(perfil.vdot) : null
  if (anterior !== null && Math.abs(redondeado - anterior) > SALTO_MAXIMO) return { ok: false, error: `El cambio es demasiado grande (más de ${SALTO_MAXIMO} puntos de golpe)`, status: 422 }
  if (anterior === redondeado) return { ok: false, error: 'Ese ya es su VDOT actual', status: 409 }
  const previo = Array.isArray(perfil.vdot_historial) ? perfil.vdot_historial : []
  const entrada: CambioVdot = { fecha: new Date().toISOString().slice(0, 10), anterior, vdot: redondeado, origen: 'coach', motivo: motivo.slice(0, 300) }
  const { error } = await db.from('perfil_entreno_cliente').update({ vdot: redondeado, vdot_historial: [...previo, entrada].slice(-50) }).eq('cliente_id', clienteId)
  if (error) return { ok: false, error: 'No se pudo guardar el VDOT', status: 500 }
  return { ok: true, vdot: redondeado }
}
