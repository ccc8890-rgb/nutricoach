import { resolve } from 'node:path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { inferirMomentoDesdeTipo, scoreRecetaParaAgente } from '../lib/recetario-taxonomia'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const INCLUDE_REVISION = process.argv.includes('--include-review')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const slots = [
  { nombre: 'Desayuno', tipo: 'Desayuno', kcal: 500, proteinas: 30, objetivo: 'recomposicion', deporte: 'general' },
  { nombre: 'Comida', tipo: 'Comida', kcal: 700, proteinas: 45, objetivo: 'recomposicion', deporte: 'hyrox' },
  { nombre: 'Pre-entreno', tipo: 'Snack', kcal: 320, proteinas: 20, objetivo: 'rendimiento', deporte: 'running', momento: 'pre_entreno' },
  { nombre: 'Cena', tipo: 'Cena', kcal: 600, proteinas: 40, objetivo: 'perdida_grasa', deporte: 'general' },
]

async function candidatas(slot: typeof slots[number]) {
  const estados = INCLUDE_REVISION ? ['aprobada', 'en_revision'] : ['aprobada']
  const momento = slot.momento ?? inferirMomentoDesdeTipo(slot.tipo)

  let query = supabase
    .from('recetas')
    .select('id,nombre,estado,tipo_plato,kcal,proteinas,carbohidratos,grasas,score_calidad,recipe_intelligence_score,recipe_intelligence_tier,macro_flex_score,planning_roles,objetivos,deportes,momentos,estilos,premium_chef,adherencia_score,tags')
    .in('estado', estados)
    .gt('kcal', 0)
    .gte('kcal', Math.round(slot.kcal * 0.55))
    .lte('kcal', Math.round(slot.kcal * 1.45))
    .limit(150)

  if (slot.tipo) {
    const compatibles: Record<string, string[]> = {
      Desayuno: ['Desayuno', 'Merienda', 'Snack'],
      Comida: ['Comida', 'Cena'],
      Snack: ['Snack', 'Merienda', 'Desayuno', 'Comida'],
      Cena: ['Cena', 'Comida'],
    }
    query = query.in('tipo_plato', compatibles[slot.tipo] ?? [slot.tipo])
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? [])
    .map(r => {
      const macroDist = Math.abs(Number(r.kcal) - slot.kcal) / slot.kcal +
        Math.abs(Number(r.proteinas ?? 0) - slot.proteinas) / Math.max(slot.proteinas, 1)
      return {
        ...r,
        macroDist,
        agentScore: scoreRecetaParaAgente(r, {
          objetivo: slot.objetivo,
          deporte: slot.deporte,
          momento,
          targetKcal: slot.kcal,
          targetProteinas: slot.proteinas,
          preferirChefHealthy: true,
        }),
      }
    })
    .sort((a, b) => b.agentScore - a.agentScore || a.macroDist - b.macroDist)
    .slice(0, 5)
}

async function main() {
  const output = []
  for (const slot of slots) {
    const top = await candidatas(slot)
    output.push({
      slot: slot.nombre,
      target: `${slot.kcal} kcal · ${slot.proteinas}P`,
      top: top.map(r => ({
        nombre: r.nombre,
        estado: r.estado,
        kcal: Math.round(Number(r.kcal ?? 0)),
        proteinas: Math.round(Number(r.proteinas ?? 0)),
        iq: r.recipe_intelligence_score,
        tier: r.recipe_intelligence_tier,
        flex: r.macro_flex_score,
        roles: r.planning_roles,
        agentScore: Number(r.agentScore.toFixed(3)),
      })),
    })
  }
  console.log(JSON.stringify(output, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
