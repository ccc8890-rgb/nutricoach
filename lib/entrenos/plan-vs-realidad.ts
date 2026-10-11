// lib/entrenos/plan-vs-realidad.ts
// ¿El plan se queda corto frente a lo que el atleta ya hace y tolera? Hasta ahora todas las guardas solo vigilaban pasarse (salto >20-30 %);
// esta mira también el otro lado: un plan por debajo de su carga real es desentrenamiento (Mujika 2000) y desperdicia mejora.
import { validarPasos, resumenSesion } from './pasos'
import type { Ritmos } from './ritmos'

/** Un plan por debajo de este % de la capacidad demostrada se considera corto. */
export const PLAN_MIN_FRACCION = 0.85
/** La tirada larga del plan por debajo de este % de la más larga reciente se considera corta. */
export const TIRADA_MIN_FRACCION = 0.75

export interface PlanCarrera { minutos: number; tiradaMin: number | null; salidas: number }

/** Suma de las sesiones de carrera con pasos del plan (una semana tipo). Null si ninguna tiene pasos válidos. */
export function resumenPlanCarrera(sesiones: { nombre?: string | null; pasos: unknown }[], ritmos: Ritmos | null): PlanCarrera | null {
  const duraciones: { min: number; nombre: string }[] = []
  for (const s of sesiones) {
    const v = s.pasos ? validarPasos(s.pasos) : null
    if (!v?.ok) continue
    const r = resumenSesion(v.pasos, ritmos)
    const seg = r.duracion_s ?? (ritmos ? (r.distancia_m / 1000) * ritmos.E : null)
    if (seg && seg > 0) duraciones.push({ min: Math.round(seg / 60), nombre: s.nombre ?? '' })
  }
  if (!duraciones.length) return null
  const larga = duraciones.find(d => /tirada|larga/i.test(d.nombre)) ?? [...duraciones].sort((a, b) => b.min - a.min)[0]
  return { minutos: duraciones.reduce((a, d) => a + d.min, 0), tiradaMin: larga.min, salidas: duraciones.length }
}

/** Un plan por encima de este % de la capacidad es una subida brusca. */
export const PLAN_MAX_FRACCION = 1.25

export interface BrechaPlan {
  /** Minutos por semana del plan frente a la capacidad del atleta. */
  planCorto: { plan: number; capacidad: number; pct: number } | null
  /** Tirada larga del plan frente a la más larga que ha hecho en las últimas 4 semanas. */
  tiradaCorta: { plan: number; real: number } | null
  /** Plan muy por encima de lo que el atleta ya sostiene. */
  planExcesivo?: { plan: number; capacidad: number; pct: number } | null
}

/** Null si el plan está a la altura (o faltan datos). `capacidad` y `tiradaReal` en minutos. */
export function brechaPlanCapacidad(plan: PlanCarrera | null | undefined, capacidad: number | null | undefined, tiradaReal: number | null | undefined): BrechaPlan | null {
  if (!plan || !capacidad || capacidad <= 0) return null
  const pct = Math.round((plan.minutos / capacidad) * 100)
  const planCorto = plan.minutos < capacidad * PLAN_MIN_FRACCION ? { plan: plan.minutos, capacidad, pct } : null
  const tiradaCorta = tiradaReal && plan.tiradaMin && plan.tiradaMin < tiradaReal * TIRADA_MIN_FRACCION ? { plan: plan.tiradaMin, real: tiradaReal } : null
  const planExcesivo = plan.minutos > capacidad * PLAN_MAX_FRACCION ? { plan: plan.minutos, capacidad, pct } : null
  return planCorto || tiradaCorta || planExcesivo ? { planCorto, tiradaCorta, planExcesivo } : null
}
