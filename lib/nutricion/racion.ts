// "Tu ración": lo que el cliente come de verdad en una comida de su plan (cantidades ya escaladas a su
// objetivo), separado entre el plato de la receta y los complementos (fruta, postre…).
import type { SupabaseClient } from '@supabase/supabase-js'

export type IngredienteRacion = { nombre: string; gramos: number; kcal: number }
export type Racion = {
  comida_id: string; franja: string; dia: string | null
  plato: { kcal: number; p: number; c: number; g: number; ingredientes: IngredienteRacion[] }
  complementos: IngredienteRacion[]
  total: { kcal: number; p: number; c: number; g: number }
}

type Fila = { cantidad_gramos: number; es_complemento: boolean; alimento: { nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number } | null }
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// Elige la comida del plan que lleva esta receta: la indicada, o la de hoy, o la primera
export function elegirComida<T extends { id: string; receta_id: string | null; dia_semana: string | null }>(comidas: T[], recetaId: string, comidaId?: string | null): T | null {
  const conReceta = comidas.filter(c => c.receta_id === recetaId)
  const indicada = comidaId ? conReceta.find(c => c.id === comidaId) : null
  if (indicada) return indicada
  const hoy = DIAS[new Date().getDay()]
  return conReceta.find(c => c.dia_semana === hoy) ?? conReceta.find(c => !c.dia_semana) ?? conReceta[0] ?? null
}

export async function racionDeComida(db: SupabaseClient, comida: { id: string; nombre: string; dia_semana: string | null }): Promise<Racion | null> {
  const { data } = await db.from('comida_alimentos')
    .select('cantidad_gramos, es_complemento, alimento:alimentos(nombre, calorias, proteinas, carbohidratos, grasas)')
    .eq('comida_id', comida.id)
  const filas = ((data ?? []) as unknown as Fila[]).filter(f => f.alimento)
  if (filas.length === 0) return null
  const m = (f: Fila) => {
    const x = f.cantidad_gramos / 100, a = f.alimento!
    return { kcal: a.calorias * x, p: a.proteinas * x, c: a.carbohidratos * x, g: a.grasas * x }
  }
  const suma = (fs: Fila[]) => fs.reduce((t, f) => { const v = m(f); return { kcal: t.kcal + v.kcal, p: t.p + v.p, c: t.c + v.c, g: t.g + v.g } }, { kcal: 0, p: 0, c: 0, g: 0 })
  const r = (t: { kcal: number; p: number; c: number; g: number }) => ({ kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), g: Math.round(t.g) })
  const aIng = (f: Fila): IngredienteRacion => ({ nombre: f.alimento!.nombre, gramos: Math.round(f.cantidad_gramos), kcal: Math.round(m(f).kcal) })
  const plato = filas.filter(f => !f.es_complemento), comp = filas.filter(f => f.es_complemento)
  return {
    comida_id: comida.id, franja: comida.nombre, dia: comida.dia_semana,
    plato: { ...r(suma(plato)), ingredientes: plato.map(aIng) },
    complementos: comp.map(aIng),
    total: r(suma(filas)),
  }
}
