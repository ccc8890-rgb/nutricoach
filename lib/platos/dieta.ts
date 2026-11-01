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
