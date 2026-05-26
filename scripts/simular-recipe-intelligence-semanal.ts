import { resolve } from 'node:path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { scoreRecetaParaAgente } from '../lib/recetario-taxonomia'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const INCLUDE_REVISION = process.argv.includes('--include-review')
const DAYS = Number(process.argv.find(arg => arg.startsWith('--days='))?.split('=')[1] ?? 7)
const OPTIONS_PER_SLOT = Number(process.argv.find(arg => arg.startsWith('--options='))?.split('=')[1] ?? 4)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type Slot = {
  nombre: string
  tipoPlato: string
  momento: string
  kcal: number
  proteinas: number
  objetivo: string
  deporte: string
}

type Recipe = {
  id: string
  nombre: string
  estado: string
  tipo_plato: string | null
  categoria: string | null
  kcal: number | null
  proteinas: number | null
  carbohidratos: number | null
  grasas: number | null
  score_calidad: number | null
  recipe_intelligence_score: number | null
  recipe_intelligence_tier: string | null
  macro_flex_score: number | null
  planning_roles: string[] | null
  objetivos: string[] | null
  deportes: string[] | null
  momentos: string[] | null
  estilos: string[] | null
  premium_chef: boolean | null
  adherencia_score: number | null
}

const weekPattern: Array<{ dia: string; foco: string; deporte: string; preEntreno: boolean }> = [
  { dia: 'Lunes', foco: 'Fuerza + Hyrox', deporte: 'hyrox', preEntreno: true },
  { dia: 'Martes', foco: 'Running Z2', deporte: 'running', preEntreno: true },
  { dia: 'Miércoles', foco: 'Fuerza', deporte: 'fuerza', preEntreno: false },
  { dia: 'Jueves', foco: 'Series running', deporte: 'running', preEntreno: true },
  { dia: 'Viernes', foco: 'Hyrox técnico', deporte: 'hyrox', preEntreno: true },
  { dia: 'Sábado', foco: 'Tirada larga', deporte: 'endurance', preEntreno: true },
  { dia: 'Domingo', foco: 'Descanso', deporte: 'general', preEntreno: false },
]

function slotsForDay(day: { deporte: string; preEntreno: boolean }): Slot[] {
  return [
    {
      nombre: 'Desayuno',
      tipoPlato: 'Desayuno',
      momento: 'desayuno',
      kcal: 500,
      proteinas: 32,
      objetivo: 'recomposicion',
      deporte: day.deporte,
    },
    {
      nombre: 'Comida',
      tipoPlato: 'Comida',
      momento: day.deporte === 'general' ? 'comida' : 'post_entreno',
      kcal: 700,
      proteinas: 50,
      objetivo: day.deporte === 'general' ? 'recomposicion' : 'rendimiento',
      deporte: day.deporte,
    },
    {
      nombre: day.preEntreno ? 'Pre-entreno' : 'Merienda',
      tipoPlato: day.preEntreno ? 'Snack' : 'Merienda',
      momento: day.preEntreno ? 'pre_entreno' : 'merienda',
      kcal: day.preEntreno ? 320 : 300,
      proteinas: day.preEntreno ? 20 : 24,
      objetivo: day.preEntreno ? 'rendimiento' : 'recomposicion',
      deporte: day.deporte,
    },
    {
      nombre: 'Cena',
      tipoPlato: 'Cena',
      momento: 'cena',
      kcal: 620,
      proteinas: 42,
      objetivo: 'perdida_grasa',
      deporte: 'general',
    },
  ]
}

const compatiblesPorTipo: Record<string, string[]> = {
  Desayuno: ['Desayuno', 'Merienda', 'Snack'],
  Comida: ['Comida', 'Cena'],
  Snack: ['Snack', 'Merienda', 'Desayuno', 'Comida'],
  Merienda: ['Merienda', 'Snack', 'Desayuno'],
  Cena: ['Cena', 'Comida'],
}

function macroDistance(recipe: Recipe, slot: Slot) {
  return Math.abs(Number(recipe.kcal ?? 0) - slot.kcal) / slot.kcal +
    Math.abs(Number(recipe.proteinas ?? 0) - slot.proteinas) / Math.max(slot.proteinas, 1)
}

function scoreWithVariety(recipe: Recipe, slot: Slot, used: Map<string, number>, usedCategories: Map<string, number>) {
  const base = scoreRecetaParaAgente(recipe, {
    objetivo: slot.objetivo,
    deporte: slot.deporte,
    momento: slot.momento,
    targetKcal: slot.kcal,
    targetProteinas: slot.proteinas,
    preferirChefHealthy: true,
  })
  const recipeRepeatPenalty = (used.get(recipe.id) ?? 0) * 0.16
  const categoryRepeatPenalty = recipe.categoria ? Math.min((usedCategories.get(recipe.categoria) ?? 0) * 0.015, 0.06) : 0
  return base - recipeRepeatPenalty - categoryRepeatPenalty
}

async function loadRecipes() {
  const estados = INCLUDE_REVISION ? ['aprobada', 'en_revision'] : ['aprobada']
  const { data, error } = await supabase
    .from('recetas')
    .select('id,nombre,estado,tipo_plato,categoria,kcal,proteinas,carbohidratos,grasas,score_calidad,recipe_intelligence_score,recipe_intelligence_tier,macro_flex_score,planning_roles,objetivos,deportes,momentos,estilos,premium_chef,adherencia_score')
    .in('estado', estados)
    .gt('kcal', 0)
    .not('recipe_intelligence_score', 'is', null)
    .limit(1000)

  if (error) throw new Error(error.message)
  return (data ?? []) as Recipe[]
}

function pickOptions(recipes: Recipe[], slot: Slot, used: Map<string, number>, usedCategories: Map<string, number>) {
  const compatibleTypes = compatiblesPorTipo[slot.tipoPlato] ?? [slot.tipoPlato]
  return recipes
    .filter(recipe => compatibleTypes.includes(recipe.tipo_plato ?? ''))
    .filter(recipe => {
      const kcal = Number(recipe.kcal ?? 0)
      return kcal >= slot.kcal * 0.55 && kcal <= slot.kcal * 1.45
    })
    .map(recipe => ({
      recipe,
      distance: macroDistance(recipe, slot),
      score: scoreWithVariety(recipe, slot, used, usedCategories),
    }))
    .sort((a, b) => b.score - a.score || a.distance - b.distance)
    .slice(0, OPTIONS_PER_SLOT)
}

async function main() {
  const recipes = await loadRecipes()
  const used = new Map<string, number>()
  const usedCategories = new Map<string, number>()
  const days = weekPattern.slice(0, Math.max(1, Math.min(DAYS, weekPattern.length)))

  const plan = days.map(day => {
    const meals = slotsForDay(day).map(slot => {
      const options = pickOptions(recipes, slot, used, usedCategories)
      const principal = options[0]?.recipe
      if (principal) {
        used.set(principal.id, (used.get(principal.id) ?? 0) + 1)
        if (principal.categoria) {
          usedCategories.set(principal.categoria, (usedCategories.get(principal.categoria) ?? 0) + 1)
        }
      }

      return {
        comida: slot.nombre,
        target: `${slot.kcal} kcal · ${slot.proteinas}P`,
        principal: principal ? {
          nombre: principal.nombre,
          estado: principal.estado,
          kcal: Math.round(Number(principal.kcal ?? 0)),
          proteinas: Math.round(Number(principal.proteinas ?? 0)),
          carbos: Math.round(Number(principal.carbohidratos ?? 0)),
          grasas: Math.round(Number(principal.grasas ?? 0)),
          iq: principal.recipe_intelligence_score,
          tier: principal.recipe_intelligence_tier,
        } : null,
        equivalentes: options.slice(1).map(option => ({
          nombre: option.recipe.nombre,
          estado: option.recipe.estado,
          kcal: Math.round(Number(option.recipe.kcal ?? 0)),
          proteinas: Math.round(Number(option.recipe.proteinas ?? 0)),
          score: Number(option.score.toFixed(3)),
        })),
      }
    })

    const totals = meals.reduce((acc, meal) => {
      acc.kcal += meal.principal?.kcal ?? 0
      acc.proteinas += meal.principal?.proteinas ?? 0
      acc.carbos += meal.principal?.carbos ?? 0
      acc.grasas += meal.principal?.grasas ?? 0
      return acc
    }, { kcal: 0, proteinas: 0, carbos: 0, grasas: 0 })

    return {
      dia: day.dia,
      foco: day.foco,
      totals,
      meals,
    }
  })

  const repeatedPrincipals = [...used.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ receta: recipes.find(recipe => recipe.id === id)?.nombre ?? id, count }))

  console.log(JSON.stringify({
    config: {
      estados: INCLUDE_REVISION ? ['aprobada', 'en_revision'] : ['aprobada'],
      dias: days.length,
      opciones_por_comida: OPTIONS_PER_SLOT,
      recetas_cargadas: recipes.length,
    },
    resumen: {
      comidas: days.length * 4,
      principales_unicos: used.size,
      principales_repetidos: repeatedPrincipals,
    },
    plan,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
