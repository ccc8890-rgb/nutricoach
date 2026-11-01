// lib/platos/dieta.ts
// «Mis platos»: validación pura de las acciones del coach (añadir a la dieta, aprobar/devolver).
import { DIAS_SEMANA } from '@/lib/nutricion/comidas-dia'
import { FRANJAS } from '@/lib/nutricion/semana-dieta'
import type { SlotComida } from '@/lib/tipos-comida'

export type EntradaDieta = { dia: (typeof DIAS_SEMANA)[number]; franja: SlotComida; raciones: number }

export function validarEntradaDieta(body: unknown): { ok: true; valor: EntradaDieta } | { ok: false; motivo: string } {
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  if (!(DIAS_SEMANA as readonly unknown[]).includes(o.dia)) return { ok: false, motivo: 'Día no válido' }
  if (!(FRANJAS as readonly unknown[]).includes(o.franja)) return { ok: false, motivo: 'Franja no válida' }
  const raciones = Number(o.raciones ?? 1)
  if (!Number.isFinite(raciones) || raciones <= 0 || raciones > 12) return { ok: false, motivo: 'Raciones no válidas' }
  return { ok: true, valor: { dia: o.dia as EntradaDieta['dia'], franja: o.franja as SlotComida, raciones } }
}

export function validarRevision(body: unknown): { ok: true; valor: { accion: 'aprobar' } | { accion: 'devolver'; nota: string } } | { ok: false; motivo: string } {
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  if (o.accion === 'aprobar') return { ok: true, valor: { accion: 'aprobar' } }
  if (o.accion === 'devolver') {
    const nota = typeof o.nota === 'string' ? o.nota.trim() : ''
    if (!nota || nota.length > 500) return { ok: false, motivo: 'Al devolver un plato hay que escribir una nota (máx. 500 caracteres)' }
    return { ok: true, valor: { accion: 'devolver', nota } }
  }
  return { ok: false, motivo: 'Acción no válida' }
}

/**
 * Filas de `comida_alimentos` para un plato aprobado. Las líneas a 0 g no cuentan (p. ej. «sal al gusto»); una línea sin enlazar sí impide
 * añadirlo, porque sus macros no existirían. Cantidad = gramos × raciones / porciones del plato.
 */
export function lineasParaDieta(
  lineas: { alimento_id: string | null; cantidad_gramos: number }[],
  raciones: number,
  porciones: number,
): { ok: true; filas: { alimento_id: string; cantidad_gramos: number }[] } | { ok: false; motivo: string } {
  if (lineas.some(l => !l.alimento_id)) return { ok: false, motivo: 'El plato tiene ingredientes sin enlazar' }
  const factor = raciones / (porciones || 1)
  const filas = lineas.filter(l => Number(l.cantidad_gramos) > 0).map(l => ({ alimento_id: l.alimento_id as string, cantidad_gramos: Math.round(Number(l.cantidad_gramos) * factor * 10) / 10 }))
  if (filas.length === 0) return { ok: false, motivo: 'El plato no tiene ingredientes con cantidad' }
  return { ok: true, filas }
}

/** Al re-aprobar un plato, cada comida ya creada conserva su proporción de raciones: gramos actuales de la comida ÷ gramos de la versión anterior. */
export function factorDeActualizacion(gramosComida: number, gramosVersionAnterior: number, porciones: number): number {
  return gramosComida > 0 && gramosVersionAnterior > 0 ? gramosComida / gramosVersionAnterior : 1 / (porciones || 1)
}
