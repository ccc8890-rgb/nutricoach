// Planifica (solo lectura) qué receta va en cada hueco de la semana de un cliente.
import type { SupabaseClient } from '@supabase/supabase-js'
import { DIAS_SEMANA } from './comidas-dia'
import { materializarComidasRecurrentes } from './materializar-comidas'
import { construirFiltroCliente, FRANJAS, repartoFranja } from './semana-dieta'
import { repartirSemanaSinRepetir, type Asignacion, type CandidataSemana, type Hueco } from './generar-semana'
import { filtrarRecetasPorSlot } from '@/lib/plan-recetas'
import { aplicarRecetaAComida } from '@/lib/recetas/aplicar-receta-comida'
import type { SlotComida } from '@/lib/tipos-comida'

const POOL_MAX = 400
const CANDIDATAS_POR_FRANJA = 60
const CONCURRENCIA = 4
// Franjas por defecto si el plan aún no tiene comidas con nombre de franja
const FRANJAS_BASE: SlotComida[] = ['Desayuno', 'Comida', 'Cena']

type PlanObjetivo = {
  id: string; kcal_objetivo: number | null; proteinas_objetivo: number | null
  carbohidratos_objetivo: number | null; grasas_objetivo: number | null
}
export type ComidaExistente = { id: string; nombre: string; dia_semana: string | null; receta_id: string | null }

export async function planificarSemana(
  db: SupabaseClient,
  clienteId: string,
  plan: PlanObjetivo,
  reemplazar: boolean,
) {
  const [{ data: onboarding }, { data: perfil }, { data: perfilEntreno }, { data: comidas }] = await Promise.all([
    db.from('onboarding_responses').select('*').eq('cliente_id', clienteId).maybeSingle(),
    db.from('onboarding_perfil_profundo').select('*').eq('cliente_id', clienteId).maybeSingle(),
    db.from('perfil_entreno_cliente').select('sport_modality').eq('cliente_id', clienteId).maybeSingle(),
    db.from('comidas').select('id, nombre, dia_semana, receta_id').eq('plan_id', plan.id),
  ])
  const { filtroCliente, tagsClinicos } = construirFiltroCliente(onboarding ?? {}, perfil ?? null)
  const existentes = (comidas ?? []) as ComidaExistente[]

  const franjasPlan = FRANJAS.filter(f => existentes.some(c => c.nombre === f))
  const franjas = franjasPlan.length > 0 ? franjasPlan : FRANJAS_BASE

  // Una comida sin día es "de todos los días": cuenta como ocupada en cualquier día
  const ocupado = (dia: string, franja: string) => existentes.some(c => c.nombre === franja && (c.dia_semana === dia || c.dia_semana == null) && c.receta_id)
  const huecos: Hueco[] = []
  for (const dia of DIAS_SEMANA) {
    for (const franja of franjas) {
      if (!reemplazar && ocupado(dia, franja)) continue
      huecos.push({ dia, franja })
    }
  }

  // Candidatas por franja con el mismo motor que la generación inicial, pero viendo el catálogo entero
  const candidatas: Record<string, CandidataSemana[]> = {}
  const shares = new Map<string, number>()
  for (const franja of [...new Set(huecos.map(h => h.franja))] as SlotComida[]) {
    const share = await repartoFranja(db, plan.id, franja)
    shares.set(franja, share)
    const t = (v: number | null) => (v ? v * share : 0)
    const pedir = (tags?: typeof tagsClinicos) => filtrarRecetasPorSlot(
      db, franja, t(plan.kcal_objetivo), t(plan.proteinas_objetivo), filtroCliente, CANDIDATAS_POR_FRANJA,
      clienteId, onboarding?.objetivo, tags && Object.keys(tags).length > 0 ? tags : undefined,
      perfilEntreno?.sport_modality ?? null,
      t(plan.carbohidratos_objetivo) || undefined, t(plan.grasas_objetivo) || undefined, POOL_MAX,
    )
    const necesarias = huecos.filter(h => h.franja === franja).length
    let lista = await pedir(tagsClinicos)
    // El filtro de etiquetas (p. ej. rendimiento) es una preferencia: si deja menos recetas que días, se completa sin él
    if (lista.length < necesarias && Object.keys(tagsClinicos).length > 0) {
      const vistas = new Set(lista.map(c => c.id))
      lista = [...lista, ...(await pedir(undefined)).filter(c => !vistas.has(c.id))]
    }
    candidatas[franja] = lista.map(c => ({ id: c.id, nombre: c.nombre }))
  }

  const { asignaciones, sinCubrir } = repartirSemanaSinRepetir(candidatas, huecos)
  return { huecos, candidatas, asignaciones: asignaciones as Asignacion[], sinCubrir, shares, existentes }
}

export type ResultadoSemana = {
  ok: boolean; asignadas: number; repetidas: number; sinCubrir: Hueco[]
  errores: { dia: string; franja: string; error: string }[]; mensaje?: string
}

// Si hay varias comidas con la misma franja el mismo día (restos de pruebas o ediciones), deja una
// (la que ya tiene receta) y borra las demás con sus ingredientes.
async function quitarComidasDuplicadas(db: SupabaseClient, planId: string) {
  const { data } = await db.from('comidas').select('id, nombre, dia_semana, receta_id, orden').eq('plan_id', planId).order('orden')
  const vistos = new Map<string, string>()
  const sobran: string[] = []
  const filas = [...(data ?? [])].sort((a, b) => Number(!!b.receta_id) - Number(!!a.receta_id))
  for (const c of filas) {
    if (!c.dia_semana) continue
    const clave = `${c.dia_semana}|${c.nombre}`
    if (vistos.has(clave)) sobran.push(c.id)
    else vistos.set(clave, c.id)
  }
  if (sobran.length === 0) return
  await db.from('comida_alimentos').delete().in('comida_id', sobran)
  await db.from('comidas').delete().in('id', sobran)
}

// Escribe la semana: materializa las comidas "de todos los días", crea las que falten y aplica cada receta.
export async function generarSemana(
  db: SupabaseClient,
  clienteId: string,
  plan: PlanObjetivo,
  reemplazar: boolean,
): Promise<ResultadoSemana> {
  // Con días concretos ya no hay comidas "de todos los días" que interpretar
  await materializarComidasRecurrentes(db, plan.id)
  if (reemplazar) await quitarComidasDuplicadas(db, plan.id)
  const { huecos, asignaciones, sinCubrir, shares, existentes } = await planificarSemana(db, clienteId, plan, reemplazar)
  if (huecos.length === 0) return { ok: true, asignadas: 0, repetidas: 0, sinCubrir: [], errores: [], mensaje: 'La semana ya está completa' }

  const faltan = asignaciones.filter(a => !existentes.some(c => c.dia_semana === a.dia && c.nombre === a.franja))
  if (faltan.length > 0) {
    const { data: nuevas, error } = await db.from('comidas')
      .insert(faltan.map(a => ({ plan_id: plan.id, nombre: a.franja, dia_semana: a.dia, orden: FRANJAS.indexOf(a.franja as SlotComida) + 1 })))
      .select('id, nombre, dia_semana, receta_id')
    if (error || !nuevas) throw new Error('No se pudieron crear las comidas de la semana')
    existentes.push(...(nuevas as ComidaExistente[]))
  }

  const errores: ResultadoSemana['errores'] = []
  for (let i = 0; i < asignaciones.length; i += CONCURRENCIA) {
    await Promise.all(asignaciones.slice(i, i + CONCURRENCIA).map(async a => {
      const share = shares.get(a.franja) ?? 1
      const objetivo = (v: number | null) => (v ? v * share : undefined)
      const comida = existentes.find(c => c.dia_semana === a.dia && c.nombre === a.franja)
      try {
        if (!comida) throw new Error('Comida no encontrada')
        await aplicarRecetaAComida(db, {
          comidaId: comida.id, recetaId: a.receta_id, clienteId, planId: plan.id, comidaSlot: a.franja,
          targetKcal: objetivo(plan.kcal_objetivo), targetProteinas: objetivo(plan.proteinas_objetivo),
          targetCarbohidratos: objetivo(plan.carbohidratos_objetivo), targetGrasas: objetivo(plan.grasas_objetivo),
          tipoInteraccion: 'asignada_plan', reemplazar: true,
        })
      } catch (e) {
        errores.push({ dia: a.dia, franja: a.franja, error: e instanceof Error ? e.message : 'Error' })
      }
    }))
  }
  return {
    ok: errores.length === 0,
    asignadas: asignaciones.length - errores.length,
    repetidas: asignaciones.filter(a => a.repetida).length,
    sinCubrir,
    errores,
  }
}
