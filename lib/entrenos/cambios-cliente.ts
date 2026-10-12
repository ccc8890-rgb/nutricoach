// lib/entrenos/cambios-cliente.ts
// El plan nace en el coach. Cuando el atleta cambia algo (mueve una sesión o una comida), se deja constancia para que el coach lo vea y no se
// encuentre un plan distinto al que programó sin saber por qué.
import type { SupabaseClient } from '@supabase/supabase-js'

export type TipoCambioCliente = 'sesion_movida' | 'sesion_devuelta' | 'sesion_reordenada' | 'comida_movida' | 'dieta_por_dias'

const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** «sábado 24 oct» a partir de una fecha ISO. */
export function fechaLegible(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return `${DIAS_LARGOS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
}

export const textoSesionMovida = (nombre: string, desde: string, hasta: string) => `Movió «${nombre}» del ${fechaLegible(desde)} al ${fechaLegible(hasta)}`
export const textoSesionDevuelta = (nombre: string, dia: string) => `Devolvió «${nombre}» a su día de siempre (${fechaLegible(dia)})`

/** Nunca lanza: dejar constancia no debe romper la acción del atleta. */
export async function registrarCambioCliente(db: SupabaseClient, c: { clienteId: string; planId?: string | null; tipo: TipoCambioCliente; resumen: string; detalle?: Record<string, unknown> }) {
  try {
    await db.from('cambios_cliente').insert({ cliente_id: c.clienteId, plan_id: c.planId ?? null, tipo: c.tipo, resumen: c.resumen.slice(0, 300), detalle: c.detalle ?? {} })
  } catch (e) {
    console.error('[registrarCambioCliente]', e instanceof Error ? e.message : e)
  }
}

// ───────────── Mover una sesión solo en una fecha (la semana tipo del coach no se toca) ─────────────
import { diaSemanaDe, type Ajuste } from './calendario-ajustes'

export type DecisionMovimiento =
  | { accion: 'insertar'; fila: { tipo: 'mover'; fecha_origen: string; fecha: string } }
  | { accion: 'actualizar'; ajusteId: string; fecha: string }
  | { accion: 'borrar'; ajusteId: string }
  | { accion: 'error'; mensaje: string }

/** `existente` = ajuste que ya coloca la sesión en `fechaOrigen` (movida o copiada a ese día); sin él, la sesión viene de la semana tipo. */
export function decidirMovimientoSesion(i: { fechaOrigen: string; destino: string; diaPlantilla: string | null; existente: Ajuste | null }): DecisionMovimiento {
  if (i.existente) {
    if (i.existente.tipo === 'mover' && i.existente.fecha_origen === i.destino) return { accion: 'borrar', ajusteId: i.existente.id } // vuelve a su día de siempre
    return { accion: 'actualizar', ajusteId: i.existente.id, fecha: i.destino }
  }
  if (i.diaPlantilla !== diaSemanaDe(i.fechaOrigen)) return { accion: 'error', mensaje: 'Esa sesión no toca ese día' }
  return { accion: 'insertar', fila: { tipo: 'mover', fecha_origen: i.fechaOrigen, fecha: i.destino } }
}
