// lib/entrenos/running-plantillas.ts
import type { Paso } from './pasos'

const E = { tipo: 'zona', zona: 'E' } as const
const T = { tipo: 'zona', zona: 'T' } as const
const I = { tipo: 'zona', zona: 'I' } as const
const R = { tipo: 'zona', zona: 'R' } as const

/** Pasos de las sesiones de «Running — Fondo Intermedio (VDOT 40-50)», por nombre de sesión. */
export const PASOS_RUNNING: Record<string, Paso[]> = {
  'Long Run — E-pace': [
    { tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 4500 }, objetivo: E, nota: 'Conversacional. Hidratación cada 20-25 min.' },
  ],
  'Umbral — Tempo + Strides': [
    { tipo: 'calentamiento', duracion: { unidad: 'segundos', valor: 900 }, objetivo: E },
    { tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 1500 }, objetivo: T, nota: 'Cómodamente duro, frases cortas.' },
    { tipo: 'repetir', veces: 6, pasos: [
      { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 100 }, objetivo: R, nota: 'Progresivo, máximo en los últimos 40 m.' },
      { tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 60 } },
    ] },
    { tipo: 'enfriamiento', duracion: { unidad: 'segundos', valor: 600 }, objetivo: E },
  ],
  'VO2max — Intervalos I-pace': [
    { tipo: 'calentamiento', duracion: { unidad: 'segundos', valor: 900 }, objetivo: E },
    { tipo: 'repetir', veces: 5, pasos: [
      { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 1000 }, objetivo: I },
      { tipo: 'recuperacion', duracion: { unidad: 'metros', valor: 400 }, objetivo: E, nota: 'Trote lento, sin parar.' },
    ] },
    { tipo: 'repetir', veces: 4, pasos: [
      { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 100 }, objetivo: R },
      { tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 60 } },
    ] },
    { tipo: 'enfriamiento', duracion: { unidad: 'segundos', valor: 600 }, objetivo: E },
  ],
  'Easy + Strides — Recuperación activa': [
    { tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 2700 }, objetivo: E, nota: 'Recuperación activa. Si hay fatiga, reducir a 30 min.' },
    { tipo: 'repetir', veces: 6, pasos: [
      { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 100 }, objetivo: R },
      { tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 60 } },
    ] },
  ],
}
