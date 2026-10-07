// Detalle de un día de la dieta: cada comida con su receta, ingredientes y macros.
// Semana en curso = comidas reales; semana futura = recetas planificadas con las cantidades que
// calcularía el optimizador al activarla.
import type { SupabaseClient } from '@supabase/supabase-js'
import { comidasDelDia, DIAS_SEMANA } from './comidas-dia'
import { FRANJAS, REPARTO } from './semana-dieta'
import type { PlanObjetivo } from './planificar-semana'
import type { ObjetivoDia } from './objetivo-dia'
import { optimizarFactoresReceta } from '@/lib/recetas/optimizar-factores'
import { redondearGramajePractico } from '@/lib/recetas/aplicar-receta-comida'
import type { RolIngrediente } from '@/types'
import type { SlotComida } from '@/lib/tipos-comida'

export type IngredienteDetalle = { nombre: string; gramos: number; kcal: number; p: number; c: number; g: number }
export type RecetaDetalle = { id: string; nombre: string; imagen_url: string | null; tiempo_prep_min: number | null; contenido_estado: string | null; url_origen: string | null }
// Postre/complemento: un alimento suelto (fila) o un postre-receta (receta_id, todos sus ingredientes juntos)
// rol: dónde se coloca en la tarjeta (se deduce de la receta o del tipo de alimento; no se guarda)
export type RolComplemento = 'plato' | 'guarnicion' | 'fruta' | 'postre'
export type ComplementoDetalle = { fila?: string; receta_id?: string; rol: RolComplemento; nombre: string; gramos: number | null; kcal: number; p: number; c: number; g: number }
export type ComidaDetalle = {
  id: string; franja: string; recurrente: boolean; receta: RecetaDetalle | null
  kcal: number; p: number; c: number; g: number; ingredientes: IngredienteDetalle[]; complementos: ComplementoDetalle[]
}
export type DetalleDia = { dia: string; semana: number | null; estimado: boolean; comidas: ComidaDetalle[]; total: { kcal: number; p: number; c: number; g: number } }

type Alimento = { nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number }
const rolDeReceta = (r?: { tipo_receta?: string | null; tipo_plato?: string | null }): RolComplemento =>
  r?.tipo_receta === 'guarnicion' ? 'guarnicion' : /postre|dulce/i.test(r?.tipo_plato ?? '') ? 'postre' : 'plato'
const orden = (f: string) => FRANJAS.indexOf(f as SlotComida)
const macrosDe = (a: Alimento, gramos: number) => ({
  kcal: Math.round((a.calorias * gramos) / 100), p: Math.round(((a.proteinas * gramos) / 100) * 10) / 10,
  c: Math.round(((a.carbohidratos * gramos) / 100) * 10) / 10, g: Math.round(((a.grasas * gramos) / 100) * 10) / 10,
})
const sumar = (xs: { kcal: number; p: number; c: number; g: number }[]) =>
  xs.reduce((a, x) => ({ kcal: a.kcal + x.kcal, p: a.p + x.p, c: a.c + x.c, g: a.g + x.g }), { kcal: 0, p: 0, c: 0, g: 0 })
const redondear = (t: { kcal: number; p: number; c: number; g: number }) => ({ kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), g: Math.round(t.g) })

// Una sola lectura del plan para los 7 días (antes se releía todo el plan al tocar cada día)
export async function detalleSemanaEnCurso(db: SupabaseClient, planId: string): Promise<DetalleDia[]> {
  const { data, error } = await db.from('comidas')
    .select('id, nombre, dia_semana, orden, receta:recetas(id, nombre, imagen_url, tiempo_prep_min, contenido_estado, url_origen), comida_alimentos(id, cantidad_gramos, es_complemento, complemento_receta_id, alimento:alimentos(nombre, calorias, proteinas, carbohidratos, grasas))')
    .eq('plan_id', planId)
  if (error) throw new Error('No se pudo leer el día')
  const filas = (data ?? []) as unknown as { id: string; nombre: string; dia_semana: string | null; orden: number; receta: RecetaDetalle | null; comida_alimentos: { id: string; cantidad_gramos: number; es_complemento: boolean; complemento_receta_id: string | null; alimento: Alimento | null }[] }[]
  const idsPostre = [...new Set(filas.flatMap(c => c.comida_alimentos.map(x => x.complemento_receta_id)).filter((x): x is string => !!x))]
  const { data: nombresPostre } = idsPostre.length ? await db.from('recetas').select('id, nombre, tipo_receta, tipo_plato').in('id', idsPostre) : { data: [] }
  const nombrePostre = new Map((nombresPostre ?? []).map(r => [r.id, r.nombre as string]))
  const rolPostre = new Map((nombresPostre ?? []).map(r => [r.id, rolDeReceta(r)]))
  return DIAS_SEMANA.map((dia, idx) => {
  const comidas: ComidaDetalle[] = comidasDelDia(filas, idx)
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
          else { const n: ComplementoDetalle = { receta_id: x.complemento_receta_id, rol: rolPostre.get(x.complemento_receta_id) ?? 'plato', nombre: `${nombrePostre.get(x.complemento_receta_id) ?? 'Postre'} (1 ración)`, gramos: null, ...m }; porPostre.set(x.complemento_receta_id, n); complementos.push(n) }
        } else complementos.push({ fila: x.id, rol: 'fruta', nombre: x.alimento!.nombre, gramos: Math.round(x.cantidad_gramos), ...m })
      }
      return { id: c.id, franja: c.nombre, recurrente: !c.dia_semana, receta: c.receta, ingredientes, complementos, ...redondear(sumar([...ingredientes, ...complementos])) }
    })
  return { dia, semana: null, estimado: false, comidas, total: redondear(sumar(comidas)) }
  })
}

export async function detalleDiaEnCurso(db: SupabaseClient, planId: string, dia: string): Promise<DetalleDia> {
  const semana = await detalleSemanaEnCurso(db, planId)
  return semana.find(d => d.dia === dia) ?? { dia, semana: null, estimado: false, comidas: [], total: { kcal: 0, p: 0, c: 0, g: 0 } }
}

export async function detalleSemanaFutura(db: SupabaseClient, plan: PlanObjetivo, semana: number, objetivosDia?: Record<string, ObjetivoDia>): Promise<DetalleDia[]> {
  const { data: filasData, error } = await db.from('comidas_planificadas')
    .select('id, franja, receta_id, dia_semana').eq('plan_id', plan.id).eq('semana', semana)
  if (error) throw new Error('No se pudo leer la semana')
  const todasFilas = (filasData ?? []) as { id: string; franja: string; receta_id: string; dia_semana: string }[]
  const franjasSemana = FRANJAS.filter(f => todasFilas.some(r => r.franja === f))
  const suma = franjasSemana.reduce((t, f) => t + REPARTO[f], 0) || 1

  const ids = [...new Set(todasFilas.map(f => f.receta_id))]
  const { data: recs } = ids.length === 0 ? { data: [] } : await db.from('recetas')
    .select('id, nombre, imagen_url, tiempo_prep_min, contenido_estado, url_origen, porciones, receta_ingredientes!receta_ingredientes_receta_id_fkey(cantidad_gramos, rol_ingrediente, es_cantidad_fija, orden, alimento:alimentos(nombre, calorias, proteinas, carbohidratos, grasas))')
    .in('id', ids)
  type RecRow = RecetaDetalle & { porciones: number | null; receta_ingredientes: { cantidad_gramos: number | null; rol_ingrediente: RolIngrediente | null; es_cantidad_fija: boolean | null; orden: number | null; alimento: Alimento | null }[] }
  const porId = new Map(((recs ?? []) as unknown as RecRow[]).map(r => [r.id, r]))

  return DIAS_SEMANA.map(dia => {
  const filas = todasFilas.filter(f => f.dia_semana === dia)
  const comidas: ComidaDetalle[] = filas.sort((a, b) => orden(a.franja) - orden(b.franja)).map(f => {
    const r = porId.get(f.receta_id)
    const porciones = Math.max(1, Number(r?.porciones ?? 1))
    const ings = (r?.receta_ingredientes ?? []).filter(i => i.alimento && Number(i.cantidad_gramos) > 0).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    const share = REPARTO[f.franja as SlotComida] / suma
    const od = objetivosDia?.[dia]
    const objetivo = od && od.kcal ? { kcal: od.kcal * share, p: od.p * share, c: od.c * share, g: od.g * share } : { kcal: (plan.kcal_objetivo ?? 0) * share, p: (plan.proteinas_objetivo ?? 0) * share, c: (plan.carbohidratos_objetivo ?? 0) * share, g: (plan.grasas_objetivo ?? 0) * share }
    const factores = objetivo.kcal > 0 && ings.length > 0
      ? optimizarFactoresReceta(ings.map(i => ({
          rol: i.rol_ingrediente, gramos: Number(i.cantidad_gramos) / porciones, fija: i.es_cantidad_fija === true,
          por100: { kcal: Number(i.alimento!.calorias ?? 0), p: Number(i.alimento!.proteinas ?? 0), c: Number(i.alimento!.carbohidratos ?? 0), g: Number(i.alimento!.grasas ?? 0) },
        })), objetivo).factores
      : ings.map(() => 1)
    const ingredientes = ings.map((i, k) => {
      const gramos = redondearGramajePractico((Number(i.cantidad_gramos) / porciones) * factores[k])
      return { nombre: i.alimento!.nombre, gramos, ...macrosDe(i.alimento!, gramos) }
    })
    const receta = r ? { id: r.id, nombre: r.nombre, imagen_url: r.imagen_url, tiempo_prep_min: r.tiempo_prep_min, contenido_estado: r.contenido_estado, url_origen: r.url_origen } : null
    return { id: f.id, franja: f.franja, recurrente: false, receta, ingredientes, complementos: [], ...redondear(sumar(ingredientes)) }
  })
  return { dia, semana, estimado: true, comidas, total: redondear(sumar(comidas)) }
  })
}

export async function detalleDiaFutura(db: SupabaseClient, plan: PlanObjetivo, semana: number, dia: string, objetivosDia?: Record<string, ObjetivoDia>): Promise<DetalleDia> {
  const dias = await detalleSemanaFutura(db, plan, semana, objetivosDia)
  return dias.find(d => d.dia === dia) ?? { dia, semana, estimado: true, comidas: [], total: { kcal: 0, p: 0, c: 0, g: 0 } }
}
