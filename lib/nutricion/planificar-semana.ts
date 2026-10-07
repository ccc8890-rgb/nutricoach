// Planifica (solo lectura) qué receta va en cada hueco de la semana de un cliente.
import type { SupabaseClient } from '@supabase/supabase-js'
import { DIAS_SEMANA } from './comidas-dia'
import { materializarComidasRecurrentes } from './materializar-comidas'
import { construirFiltroCliente, franjasDelCliente, FRANJAS, REPARTO } from './semana-dieta'
import { claveCompeticion, repartirSemanaSinRepetir, type Asignacion, type CandidataSemana, type Hueco } from './generar-semana'
import { filtrarRecetasPorSlot } from '@/lib/plan-recetas'
import { aplicarRecetaAComida } from '@/lib/recetas/aplicar-receta-comida'
import { completarSemana } from './completar-comidas'
import { objetivosPorDia, planDelDia, type ObjetivoDia } from './objetivo-dia'
import { contextoRecetaCompeticion } from './receta-competicion'
import type { SlotComida } from '@/lib/tipos-comida'

const POOL_MAX = 400
const CANDIDATAS_POR_FRANJA = 60
const CANDIDATAS_COMPETICION = 120
const POOL_MAX_COMPETICION = 600
const CONCURRENCIA = 4
// Franjas por defecto si el plan aún no tiene comidas con nombre de franja
const FRANJAS_BASE: SlotComida[] = ['Desayuno', 'Comida', 'Cena']

export type PlanObjetivo = {
  id: string; kcal_objetivo: number | null; proteinas_objetivo: number | null
  carbohidratos_objetivo: number | null; grasas_objetivo: number | null
}
export type ComidaExistente = { id: string; nombre: string; dia_semana: string | null; receta_id: string | null }

// Candidatas por franja con el mismo motor que la generación inicial, pero viendo el catálogo entero.
// `franjasDia` son todas las franjas del día (reparto de kcal); `franjas` las que se van a rellenar.
export async function candidatasPorFranja(
  db: SupabaseClient,
  clienteId: string,
  plan: PlanObjetivo,
  franjas: SlotComida[],
  franjasDia: SlotComida[],
  necesarias: Record<string, number>,
  franjasCompeticion: Iterable<SlotComida> = [],
) {
  const [{ data: onboarding }, { data: perfil }, { data: perfilEntreno }] = await Promise.all([
    db.from('onboarding_responses').select('*').eq('cliente_id', clienteId).maybeSingle(),
    db.from('onboarding_perfil_profundo').select('*').eq('cliente_id', clienteId).maybeSingle(),
    db.from('perfil_entreno_cliente').select('sport_modality').eq('cliente_id', clienteId).maybeSingle(),
  ])
  const { filtroCliente, tagsClinicos } = construirFiltroCliente(onboarding ?? {}, perfil ?? null)
  const candidatas: Record<string, CandidataSemana[]> = {}
  const shares = new Map<string, number>()
  const conCompeticion = new Set(franjasCompeticion)
  for (const franja of franjas) {
    const share = REPARTO[franja] / franjasDia.reduce((t, f) => t + REPARTO[f], 0)
    shares.set(franja, share)
    const t = (v: number | null) => (v ? v * share : 0)
    const limite = conCompeticion.has(franja) ? CANDIDATAS_COMPETICION : CANDIDATAS_POR_FRANJA
    const poolMax = conCompeticion.has(franja) ? POOL_MAX_COMPETICION : POOL_MAX
    const pedir = (tags?: typeof tagsClinicos) => filtrarRecetasPorSlot(
      db, franja, t(plan.kcal_objetivo), t(plan.proteinas_objetivo), filtroCliente, limite,
      clienteId, onboarding?.objetivo, tags && Object.keys(tags).length > 0 ? tags : undefined,
      perfilEntreno?.sport_modality ?? null,
      t(plan.carbohidratos_objetivo) || undefined, t(plan.grasas_objetivo) || undefined, poolMax,
    )
    let lista = await pedir(tagsClinicos)
    // El filtro de etiquetas (p. ej. rendimiento) es una preferencia: si deja menos recetas que días, se completa sin él
    if (lista.length < (necesarias[franja] ?? 0) && Object.keys(tagsClinicos).length > 0) {
      const vistas = new Set(lista.map(c => c.id))
      lista = [...lista, ...(await pedir(undefined)).filter(c => !vistas.has(c.id))]
    }
    candidatas[franja] = lista.map(c => ({
      id: c.id, nombre: c.nombre, kcal: c.kcal, proteinas: c.proteinas, carbohidratos: c.carbohidratos,
      grasas: c.grasas, fibra: c.fibra, planningRoles: c.planning_roles,
      pre: c.es_pre_entreno === true, post: c.es_post_entreno === true,
    }))
  }
  return { candidatas, shares }
}

// Candidatas para los huecos de víspera, día de carrera y recuperación, pedidas con el OBJETIVO DE ESE DÍA
// (hidratos altos) y no con el del plan base: así el filtro de encaje ya busca platos ricos en hidratos.
export async function candidatasDeCompeticion(
  db: SupabaseClient,
  clienteId: string,
  plan: PlanObjetivo,
  huecos: Hueco[],
  objDia: Record<string, ObjetivoDia>,
  franjasDia: SlotComida[],
) {
  const grupos = new Map<string, { franja: SlotComida; dia: string; n: number }>()
  for (const h of huecos) {
    if (!h.competicion) continue
    const clave = claveCompeticion(h.competicion, h.franja)
    const g = grupos.get(clave)
    if (g) g.n += 1
    else grupos.set(clave, { franja: h.franja as SlotComida, dia: h.dia, n: 1 })
  }
  const resultado: Record<string, CandidataSemana[]> = {}
  await Promise.all([...grupos].map(async ([clave, g]) => {
    const { candidatas } = await candidatasPorFranja(db, clienteId, planDelDia(plan, objDia[g.dia]), [g.franja], franjasDia, { [g.franja]: g.n }, [g.franja])
    resultado[clave] = candidatas[g.franja] ?? []
  }))
  return resultado
}

export async function planificarSemana(
  db: SupabaseClient,
  clienteId: string,
  plan: PlanObjetivo,
  reemplazar: boolean,
  franjasElegidas?: SlotComida[],
  semana = 0,
) {
  const { data: comidas } = await db.from('comidas').select('id, nombre, dia_semana, receta_id').eq('plan_id', plan.id)
  const existentes = (comidas ?? []) as ComidaExistente[]

  const franjasPlan = FRANJAS.filter(f => existentes.some(c => c.nombre === f))
  // Si el coach elige franjas, mandan; después las comidas al día del cliente; si no, las que ya usa el plan
  const elegidas = FRANJAS.filter(f => franjasElegidas?.includes(f))
  const franjasCliente = elegidas.length > 0 ? [] : await franjasDelCliente(db, clienteId)
  const franjas = elegidas.length > 0 ? elegidas : franjasCliente.length > 0 ? franjasCliente : franjasPlan.length > 0 ? franjasPlan : FRANJAS_BASE

  // Una comida sin día es "de todos los días": cuenta como ocupada en cualquier día
  const ocupado = (dia: string, franja: string) => existentes.some(c => c.nombre === franja && (c.dia_semana === dia || c.dia_semana == null) && c.receta_id)
  const objDiaPlan = await objetivosPorDia(db, clienteId, plan, semana)
  const huecos: Hueco[] = []
  for (const dia of DIAS_SEMANA) {
    for (const franja of franjas) {
      if (!reemplazar && ocupado(dia, franja)) continue
      const m = objDiaPlan[dia]?.momento
      const competicion = contextoRecetaCompeticion(objDiaPlan[dia])
      huecos.push({ dia, franja, ...(m?.pre === franja ? { momento: 'pre' as const } : m?.post === franja ? { momento: 'post' as const } : {}), ...(competicion ? { competicion } : {}) })
    }
  }

  const franjasConHueco = [...new Set(huecos.map(h => h.franja))] as SlotComida[]
  const franjasDia = FRANJAS.filter(f => franjas.includes(f) || existentes.some(c => c.nombre === f))
  const necesarias = Object.fromEntries(franjasConHueco.map(f => [f, huecos.filter(h => h.franja === f).length]))
  const franjasCompeticion = franjasConHueco.filter(f => huecos.some(h => h.franja === f && h.competicion))
  const { candidatas, shares } = await candidatasPorFranja(db, clienteId, plan, franjasConHueco, franjasDia, necesarias, franjasCompeticion)

  const candidatasComp = await candidatasDeCompeticion(db, clienteId, plan, huecos, objDiaPlan, franjasDia)
  const { asignaciones, sinCubrir } = repartirSemanaSinRepetir(candidatas, huecos, undefined, candidatasComp)
  return { huecos, candidatas, asignaciones: asignaciones as Asignacion[], sinCubrir, shares, existentes }
}

export type ResultadoSemana = {
  ok: boolean; asignadas: number; repetidas: number; sinCubrir: Hueco[]
  errores: { dia: string; franja: string; error: string }[]; mensaje?: string; complementos?: number; avisos?: { dia: string; franja: string; motivo: string }[]
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
  franjasElegidas?: SlotComida[],
  complementar = true,
  semana = 0,
): Promise<ResultadoSemana> {
  // Con días concretos ya no hay comidas "de todos los días" que interpretar
  await materializarComidasRecurrentes(db, plan.id)
  if (reemplazar) await quitarComidasDuplicadas(db, plan.id)
  const { huecos, asignaciones, sinCubrir, shares, existentes } = await planificarSemana(db, clienteId, plan, reemplazar, franjasElegidas, semana)
  if (huecos.length === 0) return { ok: true, asignadas: 0, repetidas: 0, sinCubrir: [], errores: [], mensaje: 'La semana ya está completa' }

  const faltan = asignaciones.filter(a => !existentes.some(c => c.dia_semana === a.dia && c.nombre === a.franja))
  if (faltan.length > 0) {
    const { data: nuevas, error } = await db.from('comidas')
      .insert(faltan.map(a => ({ plan_id: plan.id, nombre: a.franja, dia_semana: a.dia, orden: FRANJAS.indexOf(a.franja as SlotComida) + 1 })))
      .select('id, nombre, dia_semana, receta_id')
    if (error || !nuevas) throw new Error('No se pudieron crear las comidas de la semana')
    existentes.push(...(nuevas as ComidaExistente[]))
  }

  // Los complementos de la semana anterior no valen para las recetas nuevas: se recalculan al final
  const idsAplicar = asignaciones.flatMap(a => existentes.find(c => c.dia_semana === a.dia && c.nombre === a.franja)?.id ?? [])
  if (idsAplicar.length > 0) await db.from('comida_alimentos').delete().in('comida_id', idsAplicar).eq('es_complemento', true)

  // Cada día se calcula con su propio objetivo: más hidratos si entrena, menos si descansa
  const objDia = await objetivosPorDia(db, clienteId, plan, semana)
  const errores: ResultadoSemana['errores'] = []
  for (let i = 0; i < asignaciones.length; i += CONCURRENCIA) {
    await Promise.all(asignaciones.slice(i, i + CONCURRENCIA).map(async a => {
      const share = shares.get(a.franja) ?? 1
      const od = objDia[a.dia]
      const objetivo = (v: number | null, dia: number) => (v ? v * share : dia ? dia * share : undefined)
      const comida = existentes.find(c => c.dia_semana === a.dia && c.nombre === a.franja)
      try {
        if (!comida) throw new Error('Comida no encontrada')
        await aplicarRecetaAComida(db, {
          comidaId: comida.id, recetaId: a.receta_id, clienteId, planId: plan.id, comidaSlot: a.franja,
          targetKcal: objetivo(od?.kcal ?? plan.kcal_objetivo, 0), targetProteinas: objetivo(od?.p ?? plan.proteinas_objetivo, 0),
          targetCarbohidratos: objetivo(od?.c ?? plan.carbohidratos_objetivo, 0), targetGrasas: objetivo(od?.g ?? plan.grasas_objetivo, 0),
          tipoInteraccion: 'asignada_plan', reemplazar: true,
        })
      } catch (e) {
        errores.push({ dia: a.dia, franja: a.franja, error: e instanceof Error ? e.message : 'Error' })
      }
    }))
  }
  // Los platos no siempre llegan al objetivo de su franja: guarnición y postre cierran el hueco
  let complementos = 0
  let avisos: { dia: string; franja: string; motivo: string }[] = []
  if (complementar && errores.length === 0) {
    try {
      const [{ data: onboarding }, { data: perfil }] = await Promise.all([
        db.from('onboarding_responses').select('*').eq('cliente_id', clienteId).maybeSingle(),
        db.from('onboarding_perfil_profundo').select('*').eq('cliente_id', clienteId).maybeSingle(),
      ])
      const { filtroCliente } = construirFiltroCliente(onboarding ?? {}, perfil ?? null)
      const r = await completarSemana(db, plan, clienteId, { franjas: [...new Set(asignaciones.map(a => a.franja))] as SlotComida[], restricciones: filtroCliente.restricciones, objetivosDia: objDia })
      complementos = r.anadidos
      avisos = r.avisos
    } catch (e) { console.error('[generarSemana] complementos', e) }
  }
  return {
    ok: errores.length === 0,
    asignadas: asignaciones.length - errores.length,
    repetidas: asignaciones.filter(a => a.repetida).length,
    sinCubrir,
    errores,
    complementos,
    avisos,
  }
}

// Mantiene las recetas de la semana en curso y vuelve a calcular las cantidades con el objetivo de cada día
// (más hidratos si entrena, menos si descansa); los complementos se recalculan al final.
export async function reajustarSemana(db: SupabaseClient, clienteId: string, plan: PlanObjetivo): Promise<{ reajustadas: number; complementos: number; errores: number }> {
  await materializarComidasRecurrentes(db, plan.id)
  const { data } = await db.from('comidas').select('id, nombre, dia_semana, receta_id').eq('plan_id', plan.id).not('dia_semana', 'is', null).not('receta_id', 'is', null)
  const comidas = ((data ?? []) as ComidaExistente[]).filter(c => FRANJAS.includes(c.nombre as SlotComida))
  if (comidas.length === 0) return { reajustadas: 0, complementos: 0, errores: 0 }
  const franjasPlan = FRANJAS.filter(f => comidas.some(c => c.nombre === f))
  const suma = franjasPlan.reduce((t, f) => t + REPARTO[f], 0) || 1
  const objDia = await objetivosPorDia(db, clienteId, plan)
  await db.from('comida_alimentos').delete().in('comida_id', comidas.map(c => c.id)).eq('es_complemento', true)

  let errores = 0
  for (let i = 0; i < comidas.length; i += CONCURRENCIA) {
    await Promise.all(comidas.slice(i, i + CONCURRENCIA).map(async c => {
      const share = REPARTO[c.nombre as SlotComida] / suma
      const od = objDia[c.dia_semana as string]
      const t = (v: number | null | undefined) => (v ? v * share : undefined)
      try {
        await aplicarRecetaAComida(db, {
          comidaId: c.id, recetaId: c.receta_id as string, clienteId, planId: plan.id, comidaSlot: c.nombre,
          targetKcal: t(od?.kcal || plan.kcal_objetivo), targetProteinas: t(od?.kcal ? od.p : plan.proteinas_objetivo),
          targetCarbohidratos: t(od?.kcal ? od.c : plan.carbohidratos_objetivo), targetGrasas: t(od?.kcal ? od.g : plan.grasas_objetivo),
          tipoInteraccion: 'asignada_plan', reemplazar: true,
        })
      } catch { errores++ }
    }))
  }
  let complementos = 0
  try {
    const [{ data: onboarding }, { data: perfil }] = await Promise.all([
      db.from('onboarding_responses').select('*').eq('cliente_id', clienteId).maybeSingle(),
      db.from('onboarding_perfil_profundo').select('*').eq('cliente_id', clienteId).maybeSingle(),
    ])
    const { filtroCliente } = construirFiltroCliente(onboarding ?? {}, perfil ?? null)
    complementos = (await completarSemana(db, plan, clienteId, { franjas: franjasPlan, restricciones: filtroCliente.restricciones, objetivosDia: objDia })).anadidos
  } catch (e) { console.error('[reajustarSemana] complementos', e) }
  return { reajustadas: comidas.length - errores, complementos, errores }
}
