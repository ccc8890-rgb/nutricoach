import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import {
  RECETA_DEPORTE_MINIMOS,
  RECETA_MOMENTOS,
  RECETA_OBJETIVO_MINIMOS,
  RECETA_SLOT_MINIMOS,
  estadoCobertura,
} from '@/lib/recetario-taxonomia'

type RecetaCoberturaRow = {
  id: string
  objetivos: string[] | null
  deportes: string[] | null
  momentos: string[] | null
  estilos: string[] | null
  premium_chef: boolean | null
  recipe_intelligence_score: number | null
  recipe_intelligence_tier: string | null
  macro_flex_score: number | null
  planning_roles: string[] | null
}

const ROLE_MINIMOS: Record<string, number> = {
  chef_signature: 60,
  high_protein_cut: 70,
  performance_fuel: 60,
  pre_training: 35,
  post_training: 45,
  batch_tupper: 60,
  quick_weekday: 80,
  portion_scalable: 100,
}

function contarPorTaxonomia(
  recetas: RecetaCoberturaRow[],
  campo: 'objetivos' | 'deportes' | 'momentos' | 'estilos' | 'planning_roles'
) {
  const map = new Map<string, number>()
  for (const receta of recetas) {
    for (const valor of receta[campo] ?? []) {
      map.set(valor, (map.get(valor) ?? 0) + 1)
    }
  }
  return Object.fromEntries([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

function avg(values: Array<number | null | undefined>) {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (!valid.length) return 0
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
}

function matrizConMinimos(conteos: Record<string, number>, minimos: Record<string, number>) {
  return Object.entries(minimos).map(([clave, minimo]) => {
    const actual = conteos[clave] ?? 0
    return {
      clave,
      actual,
      minimo,
      faltan: Math.max(0, minimo - actual),
      estado: estadoCobertura(actual, minimo),
    }
  })
}

export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = createServiceSupabase()
  const { data, error } = await db
    .from('recetas')
    .select('id, objetivos, deportes, momentos, estilos, premium_chef, recipe_intelligence_score, recipe_intelligence_tier, macro_flex_score, planning_roles')
    .eq('estado', 'aprobada')
    .or(`coach_id.eq.${user.id},coach_id.is.null`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const recetas = (data ?? []) as RecetaCoberturaRow[]
  const momentos = contarPorTaxonomia(recetas, 'momentos')
  const objetivos = contarPorTaxonomia(recetas, 'objetivos')
  const deportes = contarPorTaxonomia(recetas, 'deportes')
  const estilos = contarPorTaxonomia(recetas, 'estilos')
  const roles = contarPorTaxonomia(recetas, 'planning_roles')
  const premiumChef = recetas.filter(r => r.premium_chef).length
  const elite = recetas.filter(r => r.recipe_intelligence_tier === 'elite' || (r.recipe_intelligence_score ?? 0) >= 88).length
  const pro = recetas.filter(r => ['elite', 'pro'].includes(String(r.recipe_intelligence_tier)) || (r.recipe_intelligence_score ?? 0) >= 76).length
  const revisar = recetas.filter(r => ['revisar', 'bloqueada'].includes(String(r.recipe_intelligence_tier)) || (r.recipe_intelligence_score ?? 100) < 62).length
  const avgIq = avg(recetas.map(r => r.recipe_intelligence_score))
  const avgMacroFlex = avg(recetas.map(r => r.macro_flex_score))
  const rolesCobertura = matrizConMinimos(roles, ROLE_MINIMOS)

  return NextResponse.json({
    total: recetas.length,
    premium_chef: premiumChef,
    intelligence: {
      iq_medio: avgIq,
      macro_flex_medio: avgMacroFlex,
      elite,
      pro,
      revisar,
      roles: rolesCobertura,
      roles_conteos: roles,
    },
    cobertura: {
      slots: matrizConMinimos(momentos, RECETA_SLOT_MINIMOS),
      objetivos: matrizConMinimos(objetivos, RECETA_OBJETIVO_MINIMOS),
      deportes: matrizConMinimos(deportes, RECETA_DEPORTE_MINIMOS),
    },
    conteos: {
      momentos: Object.fromEntries(RECETA_MOMENTOS.map(m => [m, momentos[m] ?? 0])),
      objetivos,
      deportes,
      estilos,
    },
    recomendacion: [
      ...matrizConMinimos(momentos, RECETA_SLOT_MINIMOS).filter(i => i.faltan > 0).map(i => ({
        tipo: 'slot',
        clave: i.clave,
        faltan: i.faltan,
      })),
      ...matrizConMinimos(objetivos, RECETA_OBJETIVO_MINIMOS).filter(i => i.faltan > 0).map(i => ({
        tipo: 'objetivo',
        clave: i.clave,
        faltan: i.faltan,
      })),
      ...matrizConMinimos(deportes, RECETA_DEPORTE_MINIMOS).filter(i => i.faltan > 0).map(i => ({
        tipo: 'deporte',
        clave: i.clave,
        faltan: i.faltan,
      })),
    ].sort((a, b) => b.faltan - a.faltan).slice(0, 12),
  })
}
