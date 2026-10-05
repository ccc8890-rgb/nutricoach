// Semanas futuras de un plan: planificación del coach (tabla comidas_planificadas), sin efecto en el
// cliente hasta que se activa la semana. semana = 1 es la próxima respecto a la semana en curso.
import type { SupabaseClient } from '@supabase/supabase-js'
import { DIAS_SEMANA } from './comidas-dia'
import { materializarComidasRecurrentes } from './materializar-comidas'
import { FRANJAS, REPARTO, franjasDelCliente } from './semana-dieta'
import { candidatasPorFranja, type PlanObjetivo } from './planificar-semana'
import { repartirSemanaSinRepetir, type Hueco } from './generar-semana'
import { aplicarRecetaAComida } from '@/lib/recetas/aplicar-receta-comida'
import { completarSemana } from './completar-comidas'
import { objetivosPorDia, type ObjetivoDia } from './objetivo-dia'
import { construirFiltroCliente } from './semana-dieta'
import { optimizarFactoresReceta, type IngredienteOptimizable } from '@/lib/recetas/optimizar-factores'
import type { RolIngrediente } from '@/types'
import type { SlotComida } from '@/lib/tipos-comida'

export const MAX_SEMANAS = 8
const FRANJAS_BASE: SlotComida[] = ['Desayuno', 'Comida', 'Cena']
const CONCURRENCIA = 4

type RecetaResumen = {
  id: string; nombre: string; imagen_url: string | null; kcal: number; proteinas: number
  carbohidratos: number; grasas: number; verificacion: string | null; contenido_estado: string | null
}
type FilaPlanificada = { id: string; semana: number; dia_semana: string; franja: string; receta_id: string; receta: RecetaResumen | null }

type IngredienteRecetaCargado = IngredienteOptimizable & {
  alimento_id: string
  alimento_nombre: string
  categoria: string
  es_generico: boolean
}

export type ComidaFutura = {
  id: string; nombre: string; receta: Omit<RecetaResumen, 'kcal' | 'proteinas' | 'carbohidratos' | 'grasas'> | null
  kcal: number; p: number; c: number; g: number
}
export type DiaFuturo = { dia: string; comidas: ComidaFutura[]; total: { kcal: number; p: number; c: number; g: number } }
export type SemanaFutura = { semana: number; dias: DiaFuturo[] }

const orden = (f: string) => FRANJAS.indexOf(f as SlotComida)

async function cargarIngredientesRecetas(db: SupabaseClient, ids: string[]) {
  const ingredientes = new Map<string, IngredienteRecetaCargado[]>()
  if (ids.length === 0) return ingredientes
  const { data, error } = await db.from('recetas')
    .select('id, porciones, receta_ingredientes!receta_ingredientes_receta_id_fkey(cantidad_gramos, rol_ingrediente, es_cantidad_fija, alimento:alimentos(id, nombre, categoria, es_generico, calorias, proteinas, carbohidratos, grasas))')
    .in('id', ids)
  if (error) throw new Error('No se pudieron leer los ingredientes de las recetas')
  for (const r of (data ?? []) as unknown as { id: string; porciones: number | null; receta_ingredientes: { cantidad_gramos: number | null; rol_ingrediente: RolIngrediente | null; es_cantidad_fija: boolean | null; alimento: { id: string; nombre: string; categoria: string | null; es_generico: boolean | null; calorias: number; proteinas: number; carbohidratos: number; grasas: number } | null }[] }[]) {
    ingredientes.set(r.id, r.receta_ingredientes.filter(i => i.alimento && Number(i.cantidad_gramos) > 0).map(i => ({
      alimento_id: i.alimento!.id, alimento_nombre: i.alimento!.nombre, categoria: i.alimento!.categoria ?? 'Otros', es_generico: i.alimento!.es_generico ?? false,
      rol: i.rol_ingrediente, gramos: Number(i.cantidad_gramos) / Math.max(1, Number(r.porciones ?? 1)), fija: i.es_cantidad_fija === true,
      por100: { kcal: Number(i.alimento!.calorias ?? 0), p: Number(i.alimento!.proteinas ?? 0), c: Number(i.alimento!.carbohidratos ?? 0), g: Number(i.alimento!.grasas ?? 0) },
    })))
  }
  return ingredientes
}

function factoresParaComida(
  ingredientes: IngredienteOptimizable[], plan: PlanObjetivo, dia: string, franja: string,
  franjasSemana: string[], objetivosDia?: Record<string, ObjetivoDia>,
) {
  const sumaReparto = franjasSemana.reduce((t, f) => t + REPARTO[f as SlotComida], 0) || 1
  const share = REPARTO[franja as SlotComida] / sumaReparto
  const od = objetivosDia?.[dia]
  const objetivo = od && od.kcal
    ? { kcal: od.kcal * share, p: od.p * share, c: od.c * share, g: od.g * share }
    : { kcal: (plan.kcal_objetivo ?? 0) * share, p: (plan.proteinas_objetivo ?? 0) * share, c: (plan.carbohidratos_objetivo ?? 0) * share, g: (plan.grasas_objetivo ?? 0) * share }
  return objetivo.kcal > 0 ? optimizarFactoresReceta(ingredientes, objetivo).factores : ingredientes.map(() => 1)
}

async function filasPlanificadas(db: SupabaseClient, planId: string, hasta = MAX_SEMANAS): Promise<FilaPlanificada[]> {
  const { data, error } = await db.from('comidas_planificadas')
    .select('id, semana, dia_semana, franja, receta_id, receta:recetas(id, nombre, imagen_url, kcal, proteinas, carbohidratos, grasas, verificacion, contenido_estado)')
    .eq('plan_id', planId).lte('semana', hasta)
  if (error) throw new Error('No se pudieron leer las semanas planificadas')
  return (data ?? []) as unknown as FilaPlanificada[]
}

// Estima las macros de cada comida con el mismo optimizador que usa la activación (reparto de kcal y
// macros del plan por franja), para poder comparar días y semanas con lo que se aplicaría de verdad.
export async function obtenerFuturas(db: SupabaseClient, plan: PlanObjetivo, semanas: number, objetivosDia?: Record<string, ObjetivoDia>, cargarObjetivos?: (semana: number) => Promise<Record<string, ObjetivoDia>>): Promise<SemanaFutura[]> {
  const n = Math.min(semanas, MAX_SEMANAS)
  const filas = await filasPlanificadas(db, plan.id, n)
  const ids = [...new Set(filas.map(f => f.receta_id))]
  const ingredientes = await cargarIngredientesRecetas(db, ids)

  const resultado: SemanaFutura[] = []
  for (let semana = 1; semana <= n; semana++) {
    const objetivosSemana = cargarObjetivos ? await cargarObjetivos(semana) : objetivosDia
    const delaSemana = filas.filter(f => f.semana === semana)
    const franjasSemana = FRANJAS.filter(f => delaSemana.some(r => r.franja === f))
    const dias: DiaFuturo[] = DIAS_SEMANA.map(dia => {
      const comidas = delaSemana.filter(r => r.dia_semana === dia).sort((a, b) => orden(a.franja) - orden(b.franja)).map(r => {
        const rec = r.receta
        const ings = ingredientes.get(r.receta_id) ?? []
        let m = { kcal: rec?.kcal ?? 0, p: rec?.proteinas ?? 0, c: rec?.carbohidratos ?? 0, g: rec?.grasas ?? 0 }
        if (ings.length > 0) {
          const factores = factoresParaComida(ings, plan, dia, r.franja, franjasSemana, objetivosSemana)
          m = ings.reduce((a, ing, i) => ({
            kcal: a.kcal + ing.por100.kcal * ing.gramos * factores[i] / 100, p: a.p + ing.por100.p * ing.gramos * factores[i] / 100,
            c: a.c + ing.por100.c * ing.gramos * factores[i] / 100, g: a.g + ing.por100.g * ing.gramos * factores[i] / 100,
          }), { kcal: 0, p: 0, c: 0, g: 0 })
        }
        const recetaPublica = rec ? { id: rec.id, nombre: rec.nombre, imagen_url: rec.imagen_url, verificacion: rec.verificacion, contenido_estado: rec.contenido_estado } : null
        return { id: r.id, nombre: r.franja, receta: recetaPublica, kcal: Math.round(m.kcal), p: Math.round(m.p), c: Math.round(m.c), g: Math.round(m.g) }
      })
      const total = comidas.reduce((a, c) => ({ kcal: a.kcal + c.kcal, p: a.p + c.p, c: a.c + c.c, g: a.g + c.g }), { kcal: 0, p: 0, c: 0, g: 0 })
      return { dia, comidas, total }
    })
    resultado.push({ semana, dias })
  }
  return resultado
}

export type IngredienteSemanaFutura = {
  alimento_id: string; alimento_nombre: string; categoria: string; es_generico: boolean
  cantidad_gramos: number; receta_nombre: string
}

/** Ingredientes por racion de una semana planificada, ajustados igual que en obtenerFuturas. */
export async function obtenerIngredientesSemanaFutura(
  db: SupabaseClient, plan: PlanObjetivo, semana: number, objetivosDia?: Record<string, ObjetivoDia>,
): Promise<IngredienteSemanaFutura[]> {
  if (!Number.isInteger(semana) || semana < 1 || semana > MAX_SEMANAS) throw new Error('Semana no valida')
  const filas = (await filasPlanificadas(db, plan.id, semana)).filter(f => f.semana === semana)
  const ingredientes = await cargarIngredientesRecetas(db, [...new Set(filas.map(f => f.receta_id))])
  const franjasSemana = FRANJAS.filter(f => filas.some(r => r.franja === f))
  return filas.flatMap(fila => {
    const ings = ingredientes.get(fila.receta_id) ?? []
    const factores = factoresParaComida(ings, plan, fila.dia_semana, fila.franja, franjasSemana, objetivosDia)
    return ings.map((ing, i) => ({
      alimento_id: ing.alimento_id,
      alimento_nombre: ing.alimento_nombre,
      categoria: ing.categoria,
      es_generico: ing.es_generico,
      cantidad_gramos: ing.gramos * factores[i],
      receta_nombre: fila.receta?.nombre ?? fila.franja,
    }))
  })
}

export async function asignarFutura(db: SupabaseClient, planId: string, p: { semana: number; dia: string; franja: string; receta_id: string }) {
  if (!Number.isInteger(p.semana) || p.semana < 1 || p.semana > MAX_SEMANAS) throw new Error('Semana no válida')
  if (!DIAS_SEMANA.includes(p.dia as typeof DIAS_SEMANA[number]) || !FRANJAS.includes(p.franja as SlotComida)) throw new Error('Día o franja no válidos')
  const { data: receta } = await db.from('recetas').select('id').eq('id', p.receta_id).eq('estado', 'aprobada').maybeSingle()
  if (!receta) throw new Error('Receta no encontrada o no aprobada')
  const { error } = await db.from('comidas_planificadas').upsert(
    { plan_id: planId, semana: p.semana, dia_semana: p.dia, franja: p.franja, receta_id: p.receta_id },
    { onConflict: 'plan_id,semana,dia_semana,franja' },
  )
  if (error) throw new Error('No se pudo guardar la receta')
}

export async function quitarFutura(db: SupabaseClient, planId: string, id: string) {
  const { error } = await db.from('comidas_planificadas').delete().eq('id', id).eq('plan_id', planId)
  if (error) throw new Error('No se pudo quitar la comida')
}

async function comidasEnCurso(db: SupabaseClient, planId: string) {
  const { data } = await db.from('comidas').select('id, nombre, dia_semana, receta_id').eq('plan_id', planId)
  return (data ?? []) as { id: string; nombre: string; dia_semana: string | null; receta_id: string | null }[]
}

// Genera una semana futura sin repetir recetas entre esta y las demás semanas (en curso y planificadas)
export async function generarFutura(
  db: SupabaseClient, clienteId: string, plan: PlanObjetivo,
  p: { semana: number; franjas?: SlotComida[]; reemplazar?: boolean },
) {
  if (!Number.isInteger(p.semana) || p.semana < 1 || p.semana > MAX_SEMANAS) throw new Error('Semana no válida')
  const [enCurso, filas] = await Promise.all([comidasEnCurso(db, plan.id), filasPlanificadas(db, plan.id)])
  const propias = filas.filter(f => f.semana === p.semana)
  const elegidas = FRANJAS.filter(f => p.franjas?.includes(f))
  const franjasEnCurso = FRANJAS.filter(f => enCurso.some(c => c.nombre === f))
  const franjasPropias = FRANJAS.filter(f => propias.some(r => r.franja === f))
  const franjasCliente = elegidas.length > 0 || franjasPropias.length > 0 ? [] : await franjasDelCliente(db, clienteId)
  const franjas = elegidas.length > 0 ? elegidas : franjasPropias.length > 0 ? franjasPropias : franjasCliente.length > 0 ? franjasCliente : franjasEnCurso.length > 0 ? franjasEnCurso : FRANJAS_BASE

  const objDia = await objetivosPorDia(db, clienteId, plan, p.semana)
  const huecos: Hueco[] = []
  for (const dia of DIAS_SEMANA) for (const franja of franjas) {
    if (!p.reemplazar && propias.some(r => r.dia_semana === dia && r.franja === franja)) continue
    const m = objDia[dia]?.momento
    huecos.push({ dia, franja, ...(m?.pre === franja ? { momento: 'pre' as const } : m?.post === franja ? { momento: 'post' as const } : {}) })
  }
  if (huecos.length === 0) return { asignadas: 0, repetidas: 0, sinCubrir: [] as Hueco[], mensaje: 'Esa semana ya está completa' }

  const franjasConHueco = [...new Set(huecos.map(h => h.franja))] as SlotComida[]
  const franjasDia = FRANJAS.filter(f => franjas.includes(f) || franjasPropias.includes(f))
  const necesarias = Object.fromEntries(franjasConHueco.map(f => [f, huecos.filter(h => h.franja === f).length]))
  const { candidatas } = await candidatasPorFranja(db, clienteId, plan, franjasConHueco, franjasDia, necesarias)

  const evitar = new Set<string>([
    ...enCurso.flatMap(c => (c.receta_id ? [c.receta_id] : [])),
    ...filas.filter(f => f.semana !== p.semana).map(f => f.receta_id),
    ...(p.reemplazar ? [] : propias.map(r => r.receta_id)),
  ])
  const { asignaciones, sinCubrir } = repartirSemanaSinRepetir(candidatas, huecos, evitar)
  if (asignaciones.length > 0) {
    const { error } = await db.from('comidas_planificadas').upsert(
      asignaciones.map(a => ({ plan_id: plan.id, semana: p.semana, dia_semana: a.dia, franja: a.franja, receta_id: a.receta_id })),
      { onConflict: 'plan_id,semana,dia_semana,franja' },
    )
    if (error) throw new Error('No se pudo guardar la semana')
  }
  return { asignadas: asignaciones.length, repetidas: asignaciones.filter(a => a.repetida).length, sinCubrir }
}

// Copia las recetas de la semana en curso a una semana futura (punto de partida para cambios pequeños)
export async function copiarActualAFutura(db: SupabaseClient, plan: PlanObjetivo, semana: number) {
  if (!Number.isInteger(semana) || semana < 1 || semana > MAX_SEMANAS) throw new Error('Semana no válida')
  const enCurso = (await comidasEnCurso(db, plan.id)).filter(c => c.receta_id && FRANJAS.includes(c.nombre as SlotComida))
  // Una comida sin día es "de todos los días"
  const filas = enCurso.flatMap(c => (c.dia_semana ? [c.dia_semana] : [...DIAS_SEMANA]).map(dia => ({
    plan_id: plan.id, semana, dia_semana: dia, franja: c.nombre, receta_id: c.receta_id as string,
  })))
  const unicas = [...new Map(filas.map(f => [`${f.dia_semana}|${f.franja}`, f])).values()]
  if (unicas.length === 0) throw new Error('La semana en curso no tiene recetas que copiar')
  await db.from('comidas_planificadas').delete().eq('plan_id', plan.id).eq('semana', semana)
  const { error } = await db.from('comidas_planificadas').insert(unicas)
  if (error) throw new Error('No se pudo copiar la semana')
  return { copiadas: unicas.length }
}

export async function vaciarFutura(db: SupabaseClient, planId: string, semana: number) {
  await db.from('comidas_planificadas').delete().eq('plan_id', planId).eq('semana', semana)
}

// Convierte la semana planificada 1 en la semana en curso del cliente y adelanta las demás
export async function activarProximaSemana(db: SupabaseClient, clienteId: string, plan: PlanObjetivo) {
  const filas = (await filasPlanificadas(db, plan.id)).filter(f => f.semana === 1)
  if (filas.length === 0) throw new Error('No hay una próxima semana planificada')

  await materializarComidasRecurrentes(db, plan.id)
  const actuales = await comidasEnCurso(db, plan.id)
  const franjasNuevas = FRANJAS.filter(f => filas.some(r => r.franja === f))
  const sumaReparto = franjasNuevas.reduce((t, f) => t + REPARTO[f], 0)

  // Las franjas que la semana nueva no incluye se quitan de la semana en curso
  const sobran = actuales.filter(c => !franjasNuevas.includes(c.nombre as SlotComida)).map(c => c.id)
  if (sobran.length > 0) {
    await db.from('comida_alimentos').delete().in('comida_id', sobran)
    await db.from('comidas').delete().in('id', sobran)
  }
  // Y cada día se deja con una sola comida por franja
  const vistos = new Set<string>()
  const duplicadas: string[] = []
  for (const c of [...actuales].filter(c => !sobran.includes(c.id)).sort((a, b) => Number(!!b.receta_id) - Number(!!a.receta_id))) {
    const k = `${c.dia_semana}|${c.nombre}`
    if (vistos.has(k)) duplicadas.push(c.id); else vistos.add(k)
  }
  if (duplicadas.length > 0) {
    await db.from('comida_alimentos').delete().in('comida_id', duplicadas)
    await db.from('comidas').delete().in('id', duplicadas)
  }
  const vigentes = actuales.filter(c => !sobran.includes(c.id) && !duplicadas.includes(c.id))

  const faltan = filas.filter(r => !vigentes.some(c => c.dia_semana === r.dia_semana && c.nombre === r.franja))
  if (faltan.length > 0) {
    const { data: nuevas, error } = await db.from('comidas')
      .insert(faltan.map(r => ({ plan_id: plan.id, nombre: r.franja, dia_semana: r.dia_semana, orden: orden(r.franja) + 1 })))
      .select('id, nombre, dia_semana, receta_id')
    if (error || !nuevas) throw new Error('No se pudieron crear las comidas de la semana')
    vigentes.push(...(nuevas as typeof vigentes))
  }

  // Los complementos de la semana anterior no valen para las recetas nuevas: se recalculan al final
  const idsAplicar = filas.flatMap(r => vigentes.find(c => c.dia_semana === r.dia_semana && c.nombre === r.franja)?.id ?? [])
  if (idsAplicar.length > 0) await db.from('comida_alimentos').delete().in('comida_id', idsAplicar).eq('es_complemento', true)

  const objDia = await objetivosPorDia(db, clienteId, plan, 1)
  const errores: { dia: string; franja: string; error: string }[] = []
  for (let i = 0; i < filas.length; i += CONCURRENCIA) {
    await Promise.all(filas.slice(i, i + CONCURRENCIA).map(async r => {
      const share = REPARTO[r.franja as SlotComida] / sumaReparto
      const od = objDia[r.dia_semana]
      const objetivo = (v: number | null | undefined) => (v ? v * share : undefined)
      const comida = vigentes.find(c => c.dia_semana === r.dia_semana && c.nombre === r.franja)
      try {
        if (!comida) throw new Error('Comida no encontrada')
        await aplicarRecetaAComida(db, {
          comidaId: comida.id, recetaId: r.receta_id, clienteId, planId: plan.id, comidaSlot: r.franja,
          targetKcal: objetivo(od?.kcal ?? plan.kcal_objetivo), targetProteinas: objetivo(od?.p ?? plan.proteinas_objetivo),
          targetCarbohidratos: objetivo(od?.c ?? plan.carbohidratos_objetivo), targetGrasas: objetivo(od?.g ?? plan.grasas_objetivo),
          tipoInteraccion: 'asignada_plan', reemplazar: true,
        })
      } catch (e) {
        errores.push({ dia: r.dia_semana, franja: r.franja, error: e instanceof Error ? e.message : 'Error' })
      }
    }))
  }

  // Solo si todo salió bien se consume la semana planificada y se adelantan las siguientes
  if (errores.length === 0) {
    try {
      const [{ data: onboarding }, { data: perfil }] = await Promise.all([
        db.from('onboarding_responses').select('*').eq('cliente_id', clienteId).maybeSingle(),
        db.from('onboarding_perfil_profundo').select('*').eq('cliente_id', clienteId).maybeSingle(),
      ])
      const { filtroCliente } = construirFiltroCliente(onboarding ?? {}, perfil ?? null)
      await completarSemana(db, plan, clienteId, { franjas: franjasNuevas, restricciones: filtroCliente.restricciones, objetivosDia: objDia })
    } catch (e) { console.error('[activarProximaSemana] complementos', e) }
    await db.from('comidas_planificadas').delete().eq('plan_id', plan.id).eq('semana', 1)
    for (let s = 2; s <= MAX_SEMANAS; s++) {
      await db.from('comidas_planificadas').update({ semana: s - 1 }).eq('plan_id', plan.id).eq('semana', s)
    }
  }
  return { ok: errores.length === 0, activadas: filas.length - errores.length, errores }
}
