// Objetivo de cada día de la semana según el entrenamiento previsto (sesiones del plan de entreno activo).
// El plan guarda un objetivo base; un día de fuerza o de carrera pide más hidratos y kcal, y un descanso menos.
import type { SupabaseClient } from '@supabase/supabase-js'
import { DIAS_SEMANA } from './comidas-dia'
import { clasificarDiaNutricional, getAjusteDiaNutricional, type TipoDiaNutricional } from '@/lib/periodizacion/dia-entreno-nutricion'
import type { PlanObjetivo } from './planificar-semana'
import { momentoDeEntreno, type MomentoDia } from './momentos-entreno'
import { FRANJAS } from './semana-dieta'
import type { SlotComida } from '@/lib/tipos-comida'

export type ObjetivoDia = {
  kcal: number; p: number; c: number; g: number
  tipo: TipoDiaNutricional | null; label: string | null; consejo: string | null; ajuste_kcal_pct: number
  momento?: MomentoDia | null
}

// Si un día tiene varias sesiones manda la más exigente
const PRIORIDAD: TipoDiaNutricional[] = ['entreno_hibrido', 'entreno_cardio', 'entreno_fuerza']

export function objetivoBase(plan: PlanObjetivo): ObjetivoDia {
  return { kcal: plan.kcal_objetivo ?? 0, p: plan.proteinas_objetivo ?? 0, c: plan.carbohidratos_objetivo ?? 0, g: plan.grasas_objetivo ?? 0, tipo: null, label: null, consejo: null, ajuste_kcal_pct: 0 }
}

export function ajustarObjetivo(plan: PlanObjetivo, tipo: TipoDiaNutricional): ObjetivoDia {
  const base = objetivoBase(plan)
  const a = getAjusteDiaNutricional(tipo)
  if (!base.kcal) return { ...base, tipo, label: a.label, consejo: a.consejo }
  const kcal = base.kcal * (1 + a.ajuste_kcal_pct / 100)
  const p = base.p * (1 + a.ajuste_proteinas_pct / 100)
  const c = base.c * (1 + a.ajuste_cho_pct / 100)
  // La grasa es lo que cuadra las kcal, sin bajar de un 60 % de la base
  const g = Math.max(base.g * 0.6, (kcal - 4 * p - 4 * c) / 9)
  return { kcal: Math.round(kcal), p: Math.round(p), c: Math.round(c), g: Math.round(g), tipo, label: a.label, consejo: a.consejo, ajuste_kcal_pct: a.ajuste_kcal_pct }
}

// Sin plan de entreno activo no hay nada que ajustar: todos los días con el objetivo base
export async function objetivosPorDia(db: SupabaseClient, clienteId: string, plan: PlanObjetivo): Promise<Record<string, ObjetivoDia>> {
  const base = objetivoBase(plan)
  const sinAjuste = Object.fromEntries(DIAS_SEMANA.map(d => [d, base])) as Record<string, ObjetivoDia>
  if (!base.kcal) return sinAjuste
  const { data: entreno } = await db.from('planes_entrenamiento').select('id').eq('cliente_id', clienteId).eq('activo', true).limit(1).maybeSingle()
  if (!entreno) return sinAjuste
  const { data: sesiones } = await db.from('sesiones_entrenamiento').select('nombre, dia_semana').eq('plan_id', entreno.id)
  if (!sesiones || sesiones.length === 0) return sinAjuste
  // Hora habitual de entreno del cuestionario y franjas que usa el plan, para saber qué comida cae antes/después
  const [{ data: onboarding }, { data: nombres }] = await Promise.all([
    db.from('onboarding_perfil_profundo').select('hora_entreno').eq('cliente_id', clienteId).maybeSingle(),
    db.from('comidas').select('nombre').eq('plan_id', plan.id),
  ])
  const franjas = FRANJAS.filter(f => (nombres ?? []).some(n => n.nombre === f)) as SlotComida[]
  return Object.fromEntries(DIAS_SEMANA.map(dia => {
    const tipos = sesiones.filter(s => s.dia_semana === dia).map(s => clasificarDiaNutricional(s.nombre, true))
    const tipo = PRIORIDAD.find(t => tipos.includes(t)) ?? 'descanso_activo'
    return [dia, { ...ajustarObjetivo(plan, tipo), momento: momentoDeEntreno(onboarding?.hora_entreno, tipo, franjas) }]
  })) as Record<string, ObjetivoDia>
}

// El mismo plan con el objetivo de un día concreto (para pasarlo a quien solo conoce `PlanObjetivo`)
export function planDelDia(plan: PlanObjetivo, o: ObjetivoDia | undefined): PlanObjetivo {
  if (!o || !o.kcal) return plan
  return { ...plan, kcal_objetivo: o.kcal, proteinas_objetivo: o.p, carbohidratos_objetivo: o.c, grasas_objetivo: o.g }
}
