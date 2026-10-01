// Detalle de un día de la dieta: cada comida con su receta, ingredientes y macros.
// Semana en curso = comidas reales; semana futura = recetas planificadas con las cantidades que
// calcularía el optimizador al activarla.
import type { SupabaseClient } from '@supabase/supabase-js'
import { comidasDelDia, DIAS_SEMANA } from './comidas-dia'
import { FRANJAS, REPARTO } from './semana-dieta'
import type { PlanObjetivo } from './planificar-semana'
import { optimizarFactoresReceta } from '@/lib/recetas/optimizar-factores'
import { redondearGramajePractico } from '@/lib/recetas/aplicar-receta-comida'
import type { RolIngrediente } from '@/types'
import type { SlotComida } from '@/lib/tipos-comida'

export type IngredienteDetalle = { nombre: string; gramos: number; kcal: number; p: number; c: number; g: number }
export type RecetaDetalle = { id: string; nombre: string; imagen_url: string | null; tiempo_prep_min: number | null; contenido_estado: string | null; url_origen: string | null }
// Postre/complemento: un alimento suelto (fila) o un postre-receta (receta_id, todos sus ingredientes juntos)
export type ComplementoDetalle = { fila?: string; receta_id?: string; nombre: string; gramos: number | null; kcal: number; p: number; c: number; g: number }
export type ComidaDetalle = {
  id: string; franja: string; recurrente: boolean; receta: RecetaDetalle | null
  kcal: number; p: number; c: number; g: number; ingredientes: IngredienteDetalle[]; complementos: ComplementoDetalle[]
}
export type DetalleDia = { dia: string; semana: number | null; estimado: boolean; comidas: ComidaDetalle[]; total: { kcal: number; p: number; c: number; g: number } }

type Alimento = { nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number }
const orden = (f: string) => FRANJAS.indexOf(f as SlotComida)
const macrosDe = (a: Alimento, gramos: number) => ({
  kcal: Math.round((a.calorias * gramos) / 100), p: Math.round(((a.proteinas * gramos) / 100) * 10) / 10,
  c: Math.round(((a.carbohidratos * gramos) / 100) * 10) / 10, g: Math.round(((a.grasas * gramos) / 100) * 10) / 10,
})
const sumar = (xs: { kcal: number; p: number; c: number; g: number }[]) =>
  xs.reduce((a, x) => ({ kcal: a.kcal + x.kcal, p: a.p + x.p, c: a.c + x.c, g: a.g + x.g }), { kcal: 0, p: 0, c: 0, g: 0 })
const redondear = (t: { kcal: number; p: number; c: number; g: number }) => ({ kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), g: Math.round(t.g) })

export async function detalleDiaEnCurso(db: SupabaseClient, planId: string, dia: string): Promise<DetalleDia> {
  const { data, error } = await db.from('comidas')
    .select('id, nombre, dia_semana, orden, receta:recetas(id, nombre, imagen_url, tiempo_prep_min, contenido_estado, url_origen), comida_alimentos(id, cantidad_gramos, es_complemento, complemento_receta_id, alimento:alimentos(nombre, calorias, proteinas, carbohidratos, grasas))')
    .eq('plan_id', planId)
  if (error) throw new Error('No se pudo leer el día')
  const filas = (data ?? []) as unknown as { id: string; nombre: string; dia_semana: string | null; orden: number; receta: RecetaDetalle | null; comida_alimentos: { id: string; cantidad_gramos: number; es_complemento: boolean; complemento_receta_id: string | null; alimento: Alimento | null }[] }[]
  const idsPostre = [...new Set(filas.flatMap(c => c.comida_alimentos.map(x => x.complemento_receta_id)).filter((x): x is string => !!x))]
  const { data: nombresPostre } = idsPostre.length ? await db.from('recetas').select('id, nombre').in('id', idsPostre) : { data: [] }
  const nombrePostre = new Map((nombresPostre ?? []).map(r => [r.id, r.nombre as string]))
  const comidas: ComidaDetalle[] = comidasDelDia(filas, DIAS_SEMANA.indexOf(dia as typeof DIAS_SEMANA[number]))
    .sort((a, b) => orden(a.nombre) - orden(b.nombre))
    .map(c => {
      const validas = c.comida_alimentos.filter(x => x.alimento)
      const ingredientes = validas.filter(x => !x.es_complemento).map(x => ({ nombre: x.alimento!.nombre, gramos: Math.round(x.cantidad_gramos), ...macrosDe(x.alimento!, x.cantidad_gramos) }))
      const complementos: ComplementoDetalle[] = []
      const porPostre = new Map<string, ComplementoDetalle>()
      for (const x of validas.filter(v => v.es_complemento)) {
        const m = macrosDe(x.alimento!, x.cantidad_gramos)
        if (x.complemento_receta_id) {
          const g = porPostre.get(x.complemento_receta_id)
          if (g) { g.kcal += m.kcal; g.p += m.p; g.c += m.c; g.g += m.g }
          else { const n: ComplementoDetalle = { receta_id: x.complemento_receta_id, nombre: `${nombrePostre.get(x.complemento_receta_id) ?? 'Postre'} (1 ración)`, gramos: null, ...m }; porPostre.set(x.complemento_receta_id, n); complementos.push(n) }
        } else complementos.push({ fila: x.id, nombre: x.alimento!.nombre, gramos: Math.round(x.cantidad_gramos), ...m })
      }
      return { id: c.id, franja: c.nombre, recurrente: !c.dia_semana, receta: c.receta, ingredientes, complementos, ...redondear(sumar([...ingredientes, ...complementos])) }
    })
  return { dia, semana: null, estimado: false, comidas, total: redondear(sumar(comidas)) }
}

export async function detalleDiaFutura(db: SupabaseClient, plan: PlanObjetivo, semana: number, dia: string): Promise<DetalleDia> {
  const { data: filasData, error } = await db.from('comidas_planificadas')
    .select('id, franja, receta_id').eq('plan_id', plan.id).eq('semana', semana).eq('dia_semana', dia)
  if (error) throw new Error('No se pudo leer el día')
  const filas = (filasData ?? []) as { id: string; franja: string; receta_id: string }[]
  const { data: todas } = await db.from('comidas_planificadas').select('franja').eq('plan_id', plan.id).eq('semana', semana)
  const franjasSemana = FRANJAS.filter(f => (todas ?? []).some(r => r.franja === f))
  const suma = franjasSemana.reduce((t, f) => t + REPARTO[f], 0) || 1

  const ids = [...new Set(filas.map(f => f.receta_id))]
  const { data: recs } = ids.length === 0 ? { data: [] } : await db.from('recetas')
    .select('id, nombre, imagen_url, tiempo_prep_min, contenido_estado, url_origen, receta_ingredientes!receta_ingredientes_receta_id_fkey(cantidad_gramos, rol_ingrediente, es_cantidad_fija, orden, alimento:alimentos(nombre, calorias, proteinas, carbohidratos, grasas))')
    .in('id', ids)
  type RecRow = RecetaDetalle & { receta_ingredientes: { cantidad_gramos: number | null; rol_ingrediente: RolIngrediente | null; es_cantidad_fija: boolean | null; orden: number | null; alimento: Alimento | null }[] }
  const porId = new Map(((recs ?? []) as unknown as RecRow[]).map(r => [r.id, r]))

  const comidas: ComidaDetalle[] = filas.sort((a, b) => orden(a.franja) - orden(b.franja)).map(f => {
    const r = porId.get(f.receta_id)
    const ings = (r?.receta_ingredientes ?? []).filter(i => i.alimento && Number(i.cantidad_gramos) > 0).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    const share = REPARTO[f.franja as SlotComida] / suma
    const objetivo = { kcal: (plan.kcal_objetivo ?? 0) * share, p: (plan.proteinas_objetivo ?? 0) * share, c: (plan.carbohidratos_objetivo ?? 0) * share, g: (plan.grasas_objetivo ?? 0) * share }
    const factores = objetivo.kcal > 0 && ings.length > 0
      ? optimizarFactoresReceta(ings.map(i => ({
          rol: i.rol_ingrediente, gramos: Number(i.cantidad_gramos), fija: i.es_cantidad_fija === true,
          por100: { kcal: Number(i.alimento!.calorias ?? 0), p: Number(i.alimento!.proteinas ?? 0), c: Number(i.alimento!.carbohidratos ?? 0), g: Number(i.alimento!.grasas ?? 0) },
        })), objetivo).factores
      : ings.map(() => 1)
    const ingredientes = ings.map((i, k) => {
      const gramos = redondearGramajePractico(Number(i.cantidad_gramos) * factores[k])
      return { nombre: i.alimento!.nombre, gramos, ...macrosDe(i.alimento!, gramos) }
    })
    const receta = r ? { id: r.id, nombre: r.nombre, imagen_url: r.imagen_url, tiempo_prep_min: r.tiempo_prep_min, contenido_estado: r.contenido_estado, url_origen: r.url_origen } : null
    return { id: f.id, franja: f.franja, recurrente: false, receta, ingredientes, complementos: [], ...redondear(sumar(ingredientes)) }
  })
  return { dia, semana, estimado: true, comidas, total: redondear(sumar(comidas)) }
}
