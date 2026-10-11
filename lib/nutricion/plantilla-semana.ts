// Aplicar una plantilla de planificación (1-4 semanas de platos) a un cliente: comprobación de compatibilidad con sus
// restricciones y colocación en servidor (objetivos calculados una vez por semana, platos en paralelo).
import type { SupabaseClient } from '@supabase/supabase-js'
import { FRANJAS, REPARTO, construirFiltroCliente } from './semana-dieta'
import { materializarComidasRecurrentes } from './materializar-comidas'
import { objetivosPorDia } from './objetivo-dia'
import { asignarFutura, MAX_SEMANAS } from './semanas-futuras'
import { motivoIncompatible } from './compatibilidad-receta'
import { aplicarRecetaAComida } from '@/lib/recetas/aplicar-receta-comida'
import type { PlanObjetivo } from './planificar-semana'
import type { SlotComida } from '@/lib/tipos-comida'

export type SemanaPlantilla = { dias: { dia: string; comidas: { franja: string; receta_id: string; nombre: string }[] }[] }
export type Problema = { semana: number | null; dia: string; franja: string; nombre: string; motivo: string }
const CONCURRENCIA = 4

async function enParalelo<T>(items: T[], n: number, f: (x: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += n) await Promise.all(items.slice(i, i + n).map(f))
}

// Semana destino (null = en curso) de cada semana de la plantilla
export const semanaDestino = (desde: 0 | 1, i: number) => (desde + i === 0 ? null : desde + i)

export async function comprobarPlantilla(db: SupabaseClient, clienteId: string, semanas: SemanaPlantilla[], desde: 0 | 1) {
  if (desde + semanas.length - 1 > MAX_SEMANAS) throw new Error(`Solo se pueden planificar ${MAX_SEMANAS} semanas por delante`)
  const ids = [...new Set(semanas.flatMap(s => s.dias.flatMap(d => d.comidas.map(c => c.receta_id))))]
  const [{ data: recetas }, { data: ings }, { data: onboarding }, { data: perfil }] = await Promise.all([
    db.from('recetas').select('id, nombre, estado, intolerancias').in('id', ids),
    db.from('receta_ingredientes').select('receta_id, nombre_libre').in('receta_id', ids),
    db.from('onboarding_responses').select('*').eq('cliente_id', clienteId).maybeSingle(),
    db.from('onboarding_perfil_profundo').select('*').eq('cliente_id', clienteId).maybeSingle(),
  ])
  const { filtroCliente } = construirFiltroCliente(onboarding ?? {}, perfil ?? null)
  const porId = new Map((recetas ?? []).map(r => [r.id, r]))
  const ingsDe = new Map<string, string[]>()
  for (const i of ings ?? []) ingsDe.set(i.receta_id, [...(ingsDe.get(i.receta_id) ?? []), i.nombre_libre ?? ''])

  const validos: { semana: number | null; dia: string; franja: string; receta_id: string }[] = []
  const incompatibles: Problema[] = []
  const noDisponibles: Problema[] = []
  semanas.forEach((s, i) => {
    const semana = semanaDestino(desde, i)
    for (const d of s.dias) for (const c of d.comidas) {
      const base = { semana, dia: d.dia, franja: c.franja, nombre: c.nombre }
      const r = porId.get(c.receta_id)
      if (!r || r.estado !== 'aprobada') { noDisponibles.push({ ...base, motivo: 'la receta ya no está disponible' }); continue }
      const motivo = motivoIncompatible({ nombre: r.nombre, intolerancias: r.intolerancias, ingredientes: ingsDe.get(r.id) ?? [] }, filtroCliente.restricciones, filtroCliente.alimentos_evitar_extra)
      if (motivo) incompatibles.push({ ...base, motivo }); else validos.push({ semana, dia: d.dia, franja: c.franja, receta_id: c.receta_id })
    }
  })
  return { validos, incompatibles, noDisponibles, total: validos.length + incompatibles.length + noDisponibles.length }
}

export async function aplicarPlantilla(db: SupabaseClient, clienteId: string, plan: PlanObjetivo, semanas: SemanaPlantilla[], desde: 0 | 1) {
  const { validos, incompatibles, noDisponibles, total } = await comprobarPlantilla(db, clienteId, semanas, desde)
  const fallos: Problema[] = []
  const nombreDe = new Map(semanas.flatMap(s => s.dias.flatMap(d => d.comidas.map(c => [c.receta_id, c.nombre] as const))))
  const fallo = (v: { semana: number | null; dia: string; franja: string; receta_id: string }, e: unknown) =>
    fallos.push({ semana: v.semana, dia: v.dia, franja: v.franja, nombre: nombreDe.get(v.receta_id) ?? '', motivo: e instanceof Error ? e.message : 'error' })

  // Semanas planificadas: solo se guarda la receta, sin cálculos
  await enParalelo(validos.filter(v => v.semana != null), 8, async v => {
    try { await asignarFutura(db, plan.id, { semana: v.semana!, dia: v.dia, franja: v.franja, receta_id: v.receta_id }) } catch (e) { fallo(v, e) }
  })

  // Semana en curso: crea las comidas que falten y reescala cada receta al objetivo de su día
  const enCurso = validos.filter(v => v.semana == null)
  if (enCurso.length > 0) {
    await materializarComidasRecurrentes(db, plan.id)
    const { data: existentes } = await db.from('comidas').select('id, nombre, dia_semana').eq('plan_id', plan.id)
    const lista = [...(existentes ?? [])]
    const faltan = enCurso.filter(v => !lista.some(c => c.dia_semana === v.dia && c.nombre === v.franja))
    const unicas = [...new Map(faltan.map(v => [`${v.dia}|${v.franja}`, v])).values()]
    if (unicas.length > 0) {
      const { data: nuevas, error } = await db.from('comidas')
        .insert(unicas.map(v => ({ plan_id: plan.id, nombre: v.franja, dia_semana: v.dia, orden: FRANJAS.indexOf(v.franja as SlotComida) + 1 })))
        .select('id, nombre, dia_semana')
      if (error || !nuevas) throw new Error('No se pudieron crear las comidas de la semana')
      lista.push(...nuevas)
    }
    const franjasPlan = FRANJAS.filter(f => lista.some(c => c.nombre === f) || enCurso.some(v => v.franja === f))
    const suma = franjasPlan.reduce((t, f) => t + REPARTO[f], 0) || 1
    const objDia = await objetivosPorDia(db, clienteId, plan, 0)
    await enParalelo(enCurso, CONCURRENCIA, async v => {
      const comida = lista.find(c => c.dia_semana === v.dia && c.nombre === v.franja)
      const share = REPARTO[v.franja as SlotComida] / suma
      const od = objDia[v.dia]
      const t = (x: number | null | undefined) => (x ? x * share : undefined)
      try {
        if (!comida) throw new Error('Comida no encontrada')
        await aplicarRecetaAComida(db, {
          comidaId: comida.id, recetaId: v.receta_id, clienteId, planId: plan.id, comidaSlot: v.franja,
          targetKcal: t(od?.kcal || plan.kcal_objetivo), targetProteinas: t(od?.kcal ? od.p : plan.proteinas_objetivo),
          targetCarbohidratos: t(od?.kcal ? od.c : plan.carbohidratos_objetivo), targetGrasas: t(od?.kcal ? od.g : plan.grasas_objetivo),
          tipoInteraccion: 'asignada_plan', reemplazar: true,
        })
      } catch (e) { fallo(v, e) }
    })
  }
  return { total, aplicados: validos.length - fallos.length, incompatibles, noDisponibles, fallos }
}
