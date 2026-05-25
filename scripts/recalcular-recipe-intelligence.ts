import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { calcularRecipeIntelligence, type RecipeIntelligenceInput } from '../lib/recetas/intelligence'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const APPLY = process.argv.includes('--apply')
const ESTADO = process.argv.find(arg => arg.startsWith('--estado='))?.split('=')[1] ?? 'todas'
const TAG = process.argv.find(arg => arg.startsWith('--tag='))?.split('=')[1] ?? null
const LIMITE = Math.max(1, Math.min(Number(process.argv.find(arg => arg.startsWith('--limite='))?.split('=')[1] ?? 500), 2000))

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

type RecetaRow = RecipeIntelligenceInput & {
  id: string
  receta_ingredientes?: Array<{
    nombre_libre: string | null
    alimento_id: string | null
    cantidad_gramos: number | null
  }> | null
}

async function cargarRecetas() {
  let query = supabase
    .from('recetas')
    .select(`
      id, nombre, descripcion, instrucciones, tipo_plato, categoria,
      kcal, proteinas, carbohidratos, grasas, fibra, porciones,
      tiempo_prep_min, tiempo_coccion_min, score_calidad, adherencia_score,
      imagen_url, imagen_estado, imagen_quality_score, imagen_realismo_score, imagen_match_receta_score,
      premium_chef, batch_cooking, tupper, digestibilidad, densidad_energetica,
      coste_estimado_nivel, nivel_elaboracion, objetivos, deportes, momentos, estilos, intolerancias,
      receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre, alimento_id, cantidad_gramos)
    `)
    .order('created_at', { ascending: false })
    .limit(LIMITE)

  if (ESTADO !== 'todas') query = query.eq('estado', ESTADO)
  if (TAG) query = query.contains('tags', [TAG])

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as RecetaRow[]
}

async function main() {
  const recetas = await cargarRecetas()
  const report = {
    fecha: new Date().toISOString(),
    apply: APPLY,
    estado: ESTADO,
    tag: TAG,
    total: recetas.length,
    tiers: {} as Record<string, number>,
    top: [] as Array<{ id: string; nombre?: string | null; score: number; tier: string; flags: string[]; roles: string[] }>,
    revisar: [] as Array<{ id: string; nombre?: string | null; score: number; tier: string; flags: string[] }>,
  }

  for (const receta of recetas) {
    const result = calcularRecipeIntelligence({
      ...receta,
      ingredientes: receta.receta_ingredientes ?? [],
    })

    report.tiers[result.tier] = (report.tiers[result.tier] ?? 0) + 1
    const item = {
      id: receta.id,
      nombre: receta.nombre,
      score: result.score,
      tier: result.tier,
      flags: result.flags,
      roles: result.planning_roles,
    }
    if (result.score >= 76) report.top.push(item)
    if (result.tier === 'revisar' || result.tier === 'bloqueada') report.revisar.push({
      id: receta.id,
      nombre: receta.nombre,
      score: result.score,
      tier: result.tier,
      flags: result.flags,
    })

    if (APPLY) {
      const { error } = await supabase
        .from('recetas')
        .update({
          recipe_intelligence_score: result.score,
          recipe_intelligence_tier: result.tier,
          recipe_intelligence_detail: result.detail,
          recipe_intelligence_flags: result.flags,
          macro_flex_score: result.macro_flex_score,
          planning_roles: result.planning_roles,
          recipe_intelligence_updated_at: new Date().toISOString(),
        })
        .eq('id', receta.id)
      if (error) throw new Error(`${receta.nombre}: ${error.message}`)
    }
  }

  report.top.sort((a, b) => b.score - a.score)
  report.revisar.sort((a, b) => a.score - b.score)
  report.top = report.top.slice(0, 25)
  report.revisar = report.revisar.slice(0, 50)

  mkdirSync('salidas', { recursive: true })
  const file = 'salidas/25-05-2026_recipe-intelligence.json'
  writeFileSync(file, JSON.stringify(report, null, 2))

  console.log(JSON.stringify({
    apply: APPLY,
    total: report.total,
    tiers: report.tiers,
    top: report.top.slice(0, 8).map(r => ({ nombre: r.nombre, score: r.score, tier: r.tier, roles: r.roles })),
    revisar: report.revisar.slice(0, 8).map(r => ({ nombre: r.nombre, score: r.score, tier: r.tier, flags: r.flags })),
    file,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
