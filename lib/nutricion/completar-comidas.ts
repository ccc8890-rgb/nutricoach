// Tras generar la semana, cada plato principal puede quedarse corto respecto al objetivo de su franja
// (las raciones solo escalan hasta cierto punto). En vez de dejar ese hueco, se cierra como en una
// comida real: una guarnición en comida y cena (arroz, patata, una receta de guarnición…) y un postre
// (fruta o lácteo) donde aún falte. Se guardan como complementos (comida_alimentos.es_complemento).
import type { SupabaseClient } from '@supabase/supabase-js'
import { DIAS_SEMANA } from './comidas-dia'
import { FRANJAS, REPARTO } from './semana-dieta'
import { anadirComplemento } from './complementos'
import type { PlanObjetivo } from './planificar-semana'
import type { SlotComida } from '@/lib/tipos-comida'

// Nombres exactos del catálogo de alimentos (cocinados, para que los gramos sean los del plato)
const GUARNICIONES = [
  { nombre: 'Arroz blanco (cocido)', gluten: false }, { nombre: 'Patata (cocida)', gluten: false },
  { nombre: 'Pasta (cocinada)', gluten: true }, { nombre: 'Boniato cocido', gluten: false },
  { nombre: 'Quinoa (cocida)', gluten: false }, { nombre: 'Cuscús (cocido)', gluten: true },
  { nombre: 'Pan integral', gluten: true },
]
const FRUTAS = ['Plátano', 'Manzana', 'Naranja', 'Kiwi', 'Pera', 'Uvas', 'Mandarina', 'Fresas', 'Arándanos', 'Melocotón']
const LACTEOS = ['Skyr natural', 'Yogur griego natural', 'Requesón']

type Macros = { kcal: number; p: number; c: number; g: number }
type Alim = { id: string; nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number }
type Opcion = { tipo: 'alimento'; alimento: Alim } | { tipo: 'receta'; id: string; nombre: string; kcal: number; proteinas: number; carbohidratos: number }
export type ResultadoComplementos = { anadidos: number; detalle: { dia: string; franja: string; que: string }[]; errores: number }

const vacio = (): Macros => ({ kcal: 0, p: 0, c: 0, g: 0 })
const redondeo10 = (g: number) => Math.round(g / 10) * 10
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export async function completarSemana(
  db: SupabaseClient, plan: PlanObjetivo, clienteId: string,
  opts: { franjas: SlotComida[]; restricciones?: string[] },
): Promise<ResultadoComplementos> {
  const res: ResultadoComplementos = { anadidos: 0, detalle: [], errores: 0 }
  if (!plan.kcal_objetivo) return res
  const restr = (opts.restricciones ?? []).map(r => r.toLowerCase())
  const sinLacteos = restr.some(r => r.includes('vegan') || r.includes('lactosa'))
  const sinGluten = restr.some(r => r.includes('gluten'))
  const vegano = restr.some(r => r.includes('vegan'))
  const vegetariano = vegano || restr.some(r => r.includes('vegetarian'))

  // Catálogo de opciones por nombre exacto
  const nombres = [...GUARNICIONES.map(g => g.nombre), ...FRUTAS, ...LACTEOS]
  const { data: alims } = await db.from('alimentos')
    .select('id, nombre, calorias, proteinas, carbohidratos, grasas').eq('es_comestible', true).in('nombre', nombres)
  const porNombre = new Map<string, Alim>()
  for (const a of (alims ?? []) as Alim[]) if (!porNombre.has(a.nombre) && a.calorias > 0) porNombre.set(a.nombre, a)
  const get = (n: string) => porNombre.get(n)

  const guarnicionesAlim = GUARNICIONES.filter(g => !(sinGluten && g.gluten)).map(g => get(g.nombre)).filter((a): a is Alim => !!a)
  const frutas = FRUTAS.map(get).filter((a): a is Alim => !!a)
  const lacteos = sinLacteos ? [] : LACTEOS.map(get).filter((a): a is Alim => !!a)

  // Recetas marcadas como guarnición, compatibles con las restricciones del cliente
  const { data: recG } = await db.from('recetas').select('id, nombre, kcal, proteinas, carbohidratos, intolerancias')
    .eq('estado', 'aprobada').eq('tipo_receta', 'guarnicion').gt('kcal', 0)
  const recetasG = (recG ?? []).filter(r => {
    const t = (r.intolerancias ?? []) as string[]
    if (sinGluten && !t.includes('Sin Gluten')) return false
    if (restr.some(x => x.includes('lactosa')) && !t.includes('Sin Lactosa') && !t.includes('Vegano')) return false
    if (vegano && !t.includes('Vegano')) return false
    if (vegetariano && !t.includes('Vegetariano') && !t.includes('Vegano')) return false
    return true
  })

  // Comidas del plan con sus macros actuales (complementos incluidos)
  const { data: comidas } = await db.from('comidas')
    .select('id, nombre, dia_semana, receta_id, comida_alimentos(cantidad_gramos, es_complemento, alimento:alimentos(calorias, proteinas, carbohidratos, grasas))')
    .eq('plan_id', plan.id).not('dia_semana', 'is', null).not('receta_id', 'is', null)
  type Fila = { id: string; nombre: string; dia_semana: string; comida_alimentos: { cantidad_gramos: number; es_complemento: boolean; alimento: { calorias: number; proteinas: number; carbohidratos: number; grasas: number } | null }[] }
  const filas = ((comidas ?? []) as unknown as Fila[]).filter(c => opts.franjas.includes(c.nombre as SlotComida))

  const franjasPlan = FRANJAS.filter(f => filas.some(c => c.nombre === f))
  const sumaReparto = franjasPlan.reduce((t, f) => t + REPARTO[f], 0) || 1
  const usadoHoy = new Map<string, Set<string>>() // día → nombres ya usados, para no repetir en el día
  let rotacion = 0

  const ordenadas = [...filas].sort((a, b) => DIAS_SEMANA.indexOf(a.dia_semana as typeof DIAS_SEMANA[number]) - DIAS_SEMANA.indexOf(b.dia_semana as typeof DIAS_SEMANA[number]) || FRANJAS.indexOf(a.nombre as SlotComida) - FRANJAS.indexOf(b.nombre as SlotComida))
  for (const c of ordenadas) {
    if (c.comida_alimentos.some(x => x.es_complemento)) continue // ya tiene complementos: no se tocan
    const share = REPARTO[c.nombre as SlotComida] / sumaReparto
    const objetivo: Macros = { kcal: plan.kcal_objetivo * share, p: (plan.proteinas_objetivo ?? 0) * share, c: (plan.carbohidratos_objetivo ?? 0) * share, g: (plan.grasas_objetivo ?? 0) * share }
    const actual = c.comida_alimentos.reduce((t, x) => {
      const a = x.alimento; if (!a) return t
      const f = (x.cantidad_gramos ?? 0) / 100
      return { kcal: t.kcal + a.calorias * f, p: t.p + a.proteinas * f, c: t.c + a.carbohidratos * f, g: t.g + a.grasas * f }
    }, vacio())
    const hueco: Macros = { kcal: objetivo.kcal - actual.kcal, p: objetivo.p - actual.p, c: objetivo.c - actual.c, g: objetivo.g - actual.g }
    if (hueco.kcal < Math.max(110, objetivo.kcal * 0.1)) continue

    const usados = usadoHoy.get(c.dia_semana) ?? new Set<string>()
    usadoHoy.set(c.dia_semana, usados)
    const anadir = async (p: { alimento_id?: string; gramos?: number; receta_id?: string }, que: string) => {
      try {
        await anadirComplemento(db, plan, clienteId, { dia: c.dia_semana, franja: c.nombre, ajustar: false, ...p })
        res.anadidos++; res.detalle.push({ dia: c.dia_semana, franja: c.nombre, que }); usados.add(que)
        return true
      } catch { res.errores++; return false }
    }
    let restante = hueco.kcal, huecoP = hueco.p

    // 1) Guarnición en comida y cena si faltan hidratos
    if ((c.nombre === 'Comida' || c.nombre === 'Cena') && hueco.c >= 15 && restante >= 150) {
      const meta = clamp(restante * 0.65, 100, 450)
      const opciones: Opcion[] = [
        ...recetasG.filter(r => r.kcal >= meta * 0.5 && r.kcal <= meta * 1.5).map(r => ({ tipo: 'receta' as const, id: r.id, nombre: r.nombre, kcal: Number(r.kcal), proteinas: Number(r.proteinas), carbohidratos: Number(r.carbohidratos) })),
        ...guarnicionesAlim.map(a => ({ tipo: 'alimento' as const, alimento: a })),
      ].filter(o => !usados.has(o.tipo === 'receta' ? o.nombre : o.alimento.nombre))
      if (opciones.length > 0) {
        const o = opciones[rotacion++ % opciones.length]
        if (o.tipo === 'receta') {
          if (await anadir({ receta_id: o.id }, o.nombre)) { restante -= o.kcal; huecoP -= o.proteinas }
        } else {
          const gramos = clamp(redondeo10((meta / o.alimento.calorias) * 100), 60, 250)
          if (await anadir({ alimento_id: o.alimento.id, gramos }, o.alimento.nombre)) { restante -= (o.alimento.calorias * gramos) / 100; huecoP -= (o.alimento.proteinas * gramos) / 100 }
        }
      }
    }

    // 2) Postre: lácteo si aún falta proteína, fruta si no
    if (restante >= 90) {
      const quiereLacteo = huecoP >= 10 && lacteos.length > 0
      const pool = (quiereLacteo ? lacteos : frutas).filter(a => !usados.has(a.nombre))
      if (pool.length > 0) {
        const a = pool[rotacion++ % pool.length]
        // Una ración razonable: ~1 pieza de fruta o ~1 yogur, aunque el hueco sea mayor
        const gramos = clamp(redondeo10((Math.min(restante, quiereLacteo ? 170 : 130) / a.calorias) * 100), 80, quiereLacteo ? 250 : 200)
        await anadir({ alimento_id: a.id, gramos }, a.nombre)
      }
    }
  }
  return res
}
