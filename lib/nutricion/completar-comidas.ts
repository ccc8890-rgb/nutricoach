// Tras generar la semana, cada plato principal puede quedarse corto respecto al objetivo de su franja
// (las raciones solo escalan hasta cierto punto). El hueco se cierra como lo haría un dietista: una guarnición
// o base (arroz, patata, tostada…), fruta o lácteo y, si falta grasa buena, frutos secos o aguacate.
// Cada candidato se prueba con su ración óptima y gana el que deja menos macros por cubrir (pasarse penaliza
// más que quedarse corto, y repetir lo mismo en la semana también). Se guardan como complementos
// (comida_alimentos.es_complemento).
import type { SupabaseClient } from '@supabase/supabase-js'
import { DIAS_SEMANA } from './comidas-dia'
import { FRANJAS, REPARTO } from './semana-dieta'
import { anadirComplemento } from './complementos'
import type { PlanObjetivo } from './planificar-semana'
import type { ObjetivoDia } from './objetivo-dia'
import type { SlotComida } from '@/lib/tipos-comida'

type Cat = 'base' | 'fruta' | 'lacteo' | 'grasa'
type Rango = { nombre: string; cat: Cat; gluten?: boolean; min: number; max: number; franjas?: SlotComida[] }

// Nombres exactos del catálogo de alimentos; min/max = ración razonable en gramos
const CATALOGO: Rango[] = [
  // Guarniciones de comida y cena (cocinadas, para que los gramos sean los del plato)
  { nombre: 'Arroz blanco (cocido)', cat: 'base', min: 80, max: 250, franjas: ['Comida', 'Cena'] },
  { nombre: 'Patata (cocida)', cat: 'base', min: 100, max: 250, franjas: ['Comida', 'Cena'] },
  { nombre: 'Pasta (cocinada)', cat: 'base', gluten: true, min: 80, max: 250, franjas: ['Comida', 'Cena'] },
  { nombre: 'Boniato cocido', cat: 'base', min: 100, max: 250, franjas: ['Comida', 'Cena'] },
  { nombre: 'Quinoa (cocida)', cat: 'base', min: 80, max: 220, franjas: ['Comida', 'Cena'] },
  { nombre: 'Cuscús (cocido)', cat: 'base', gluten: true, min: 80, max: 220, franjas: ['Comida', 'Cena'] },
  { nombre: 'Pan integral', cat: 'base', gluten: true, min: 40, max: 100 },
  // Sin avena ni pan sueltos: «Avena 65 g» no dice nada al cliente; en desayuno la base sale de recetas
  // componente con contexto (porridge, tostadas, crema de arroz…), ver `recetas` más abajo
  // Fruta
  ...['Plátano', 'Manzana', 'Naranja', 'Kiwi', 'Pera', 'Uvas', 'Mandarina', 'Fresas', 'Arándanos', 'Melocotón']
    .map((nombre): Rango => ({ nombre, cat: 'fruta', min: 80, max: 200 })),
  // Lácteos (proteína)
  ...['Skyr natural', 'Yogur griego natural', 'Requesón'].map((nombre): Rango => ({ nombre, cat: 'lacteo', min: 100, max: 250 })),
  // Grasa buena
  { nombre: 'Nueces', cat: 'grasa', min: 10, max: 30 }, { nombre: 'Almendras', cat: 'grasa', min: 10, max: 30 },
  { nombre: 'Aguacate', cat: 'grasa', min: 40, max: 100 },
]

type Macros = { kcal: number; p: number; c: number; g: number }
type Alim = { id: string; nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number }
type Cand =
  | { tipo: 'alimento'; clave: string; nombre: string; cat: Cat; alim: Alim; min: number; max: number; franjas?: SlotComida[] }
  | { tipo: 'receta'; clave: string; nombre: string; cat: Cat; id: string; m: Macros }
export type ResultadoComplementos = { anadidos: number; detalle: { dia: string; franja: string; que: string }[]; errores: number }

const sumar = (a: Macros, b: Macros): Macros => ({ kcal: a.kcal + b.kcal, p: a.p + b.p, c: a.c + b.c, g: a.g + b.g })
const por = (a: Alim, gramos: number): Macros => ({ kcal: (a.calorias * gramos) / 100, p: (a.proteinas * gramos) / 100, c: (a.carbohidratos * gramos) / 100, g: (a.grasas * gramos) / 100 })

// Lo que queda por cubrir: quedarse corto cuesta 1, pasarse cuesta 2 (un hueco pequeño es mejor que un exceso)
// Antes de entrenar pesan más los hidratos (y menos la grasa); después, la proteína y los hidratos
function coste(resto: Macros, objetivo: Macros, momento?: 'pre' | 'post'): number {
  const pen = (x: number, t: number) => (t > 0 ? (x > 0 ? x : -2 * x) / t : 0)
  const w = momento === 'pre' ? { p: 1, c: 1.5, g: 0.4 } : momento === 'post' ? { p: 1.5, c: 1.2, g: 0.5 } : { p: 1, c: 1, g: 0.7 }
  return pen(resto.kcal, objetivo.kcal) + w.p * pen(resto.p, objetivo.p) + w.c * pen(resto.c, objetivo.c) + w.g * pen(resto.g, objetivo.g)
}

export async function completarSemana(
  db: SupabaseClient, plan: PlanObjetivo, clienteId: string,
  opts: { franjas: SlotComida[]; restricciones?: string[]; objetivosDia?: Record<string, ObjetivoDia> },
): Promise<ResultadoComplementos> {
  const res: ResultadoComplementos = { anadidos: 0, detalle: [], errores: 0 }
  if (!plan.kcal_objetivo) return res
  const restr = (opts.restricciones ?? []).map(r => r.toLowerCase())
  const sinLactosa = restr.some(r => r.includes('vegan') || r.includes('lactosa'))
  const sinGluten = restr.some(r => r.includes('gluten'))
  const vegano = restr.some(r => r.includes('vegan'))
  const vegetariano = vegano || restr.some(r => r.includes('vegetarian'))

  const { data: alims } = await db.from('alimentos')
    .select('id, nombre, calorias, proteinas, carbohidratos, grasas').eq('es_comestible', true).in('nombre', [...new Set(CATALOGO.map(c => c.nombre))])
  const porNombre = new Map<string, Alim>()
  for (const a of (alims ?? []) as Alim[]) if (!porNombre.has(a.nombre) && a.calorias > 0) porNombre.set(a.nombre, a)
  const alimentos: Cand[] = CATALOGO
    .filter(c => !(sinGluten && c.gluten) && !(sinLactosa && c.cat === 'lacteo'))
    .flatMap(c => { const alim = porNombre.get(c.nombre); return alim ? [{ tipo: 'alimento' as const, clave: c.nombre, nombre: c.nombre, cat: c.cat, alim, min: c.min, max: c.max, franjas: c.franjas }] : [] })

  // Recetas marcadas como guarnición (comida/cena) o componente de desayuno, compatibles con las restricciones
  const { data: recG } = await db.from('recetas').select('id, nombre, kcal, proteinas, carbohidratos, grasas, intolerancias, tipo_plato')
    .eq('estado', 'aprobada').eq('tipo_receta', 'guarnicion').gt('kcal', 0)
  const recetas = (recG ?? []).filter(r => {
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
  const usosSemana = new Map<string, number>() // cuántas veces se ha usado cada opción en la semana
  const usadoHoy = new Map<string, Set<string>>() // día → opciones ya usadas ese día

  const ordenadas = [...filas].sort((a, b) => DIAS_SEMANA.indexOf(a.dia_semana as typeof DIAS_SEMANA[number]) - DIAS_SEMANA.indexOf(b.dia_semana as typeof DIAS_SEMANA[number]) || FRANJAS.indexOf(a.nombre as SlotComida) - FRANJAS.indexOf(b.nombre as SlotComida))
  for (const c of ordenadas) {
    if (c.comida_alimentos.some(x => x.es_complemento)) continue // ya tiene complementos: no se tocan
    const franja = c.nombre as SlotComida
    const share = REPARTO[franja] / sumaReparto
    const od = opts.objetivosDia?.[c.dia_semana]
    const objetivo: Macros = od && od.kcal
      ? { kcal: od.kcal * share, p: od.p * share, c: od.c * share, g: od.g * share }
      : { kcal: plan.kcal_objetivo * share, p: (plan.proteinas_objetivo ?? 0) * share, c: (plan.carbohidratos_objetivo ?? 0) * share, g: (plan.grasas_objetivo ?? 0) * share }
    let resto: Macros = c.comida_alimentos.reduce((t, x) => {
      const a = x.alimento; if (!a) return t
      const f = (x.cantidad_gramos ?? 0) / 100
      return { kcal: t.kcal - a.calorias * f, p: t.p - a.proteinas * f, c: t.c - a.carbohidratos * f, g: t.g - a.grasas * f }
    }, { ...objetivo })
    if (resto.kcal < Math.max(110, objetivo.kcal * 0.1)) continue

    const usados = usadoHoy.get(c.dia_semana) ?? new Set<string>()
    usadoHoy.set(c.dia_semana, usados)
    const esDesayuno = franja === 'Desayuno'
    const m = od?.momento
    const momento: 'pre' | 'post' | undefined = m?.pre === franja ? 'pre' : m?.post === franja ? 'post' : undefined
    // Candidatos de esta franja: alimentos sueltos y recetas de guarnición/desayuno
    const candidatos: Cand[] = [
      ...alimentos.filter(a => a.tipo !== 'alimento' || (a.franjas ?? [franja]).includes(franja)),
      ...recetas.filter(r => (r.tipo_plato === 'Desayuno') === esDesayuno).map((r): Cand => ({
        tipo: 'receta', clave: r.nombre, nombre: r.nombre, cat: 'base', id: r.id,
        m: { kcal: Number(r.kcal), p: Number(r.proteinas), c: Number(r.carbohidratos), g: Number(r.grasas ?? 0) },
      })),
    ]
    const catsUsadas = new Set<Cat>()

    // Hasta 3 complementos: en cada paso, el candidato con ración óptima que más baja el coste
    for (let paso = 0; paso < 3 && resto.kcal >= 70; paso++) {
      const costeActual = coste(resto, objetivo, momento)
      let mejor: { cand: Cand; gramos?: number; coste: number } | null = null
      for (const cand of candidatos) {
        if (catsUsadas.has(cand.cat) || usados.has(cand.clave)) continue
        if (momento && cand.cat === 'grasa') continue // sin frutos secos ni aguacate justo antes o después de entrenar
        const penVariedad = 1 + 0.12 * (usosSemana.get(cand.clave) ?? 0)
        if (cand.tipo === 'receta') {
          const k = coste({ kcal: resto.kcal - cand.m.kcal, p: resto.p - cand.m.p, c: resto.c - cand.m.c, g: resto.g - cand.m.g }, objetivo, momento) * penVariedad
          if (!mejor || k < mejor.coste) mejor = { cand, coste: k }
        } else {
          for (let g = cand.min; g <= cand.max; g += 10) {
            const m = por(cand.alim, g)
            const k = coste({ kcal: resto.kcal - m.kcal, p: resto.p - m.p, c: resto.c - m.c, g: resto.g - m.g }, objetivo, momento) * penVariedad
            if (!mejor || k < mejor.coste) mejor = { cand, gramos: g, coste: k }
          }
        }
      }
      if (!mejor || mejor.coste > costeActual * 0.92) break // ya no mejora lo bastante: mejor no añadir relleno
      try {
        await anadirComplemento(db, plan, clienteId, mejor.cand.tipo === 'receta'
          ? { dia: c.dia_semana, franja, receta_id: mejor.cand.id, ajustar: false }
          : { dia: c.dia_semana, franja, alimento_id: mejor.cand.alim.id, gramos: mejor.gramos, ajustar: false })
      } catch { res.errores++; break }
      const anadido = mejor.cand.tipo === 'receta' ? mejor.cand.m : por(mejor.cand.alim, mejor.gramos!)
      resto = { kcal: resto.kcal - anadido.kcal, p: resto.p - anadido.p, c: resto.c - anadido.c, g: resto.g - anadido.g }
      catsUsadas.add(mejor.cand.cat); usados.add(mejor.cand.clave)
      usosSemana.set(mejor.cand.clave, (usosSemana.get(mejor.cand.clave) ?? 0) + 1)
      res.anadidos++; res.detalle.push({ dia: c.dia_semana, franja, que: mejor.cand.nombre })
    }
  }
  return res
}
