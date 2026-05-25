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
}

function contarPorTaxonomia(
  recetas: RecetaCoberturaRow[],
  campo: 'objetivos' | 'deportes' | 'momentos' | 'estilos'
) {
  const map = new Map<string, number>()
  for (const receta of recetas) {
    for (const valor of receta[campo] ?? []) {
      map.set(valor, (map.get(valor) ?? 0) + 1)
    }
  }
  return Object.fromEntries([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])))
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
    .select('id, objetivos, deportes, momentos, estilos, premium_chef')
    .eq('estado', 'aprobada')
    .or(`coach_id.eq.${user.id},coach_id.is.null`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const recetas = (data ?? []) as RecetaCoberturaRow[]
  const momentos = contarPorTaxonomia(recetas, 'momentos')
  const objetivos = contarPorTaxonomia(recetas, 'objetivos')
  const deportes = contarPorTaxonomia(recetas, 'deportes')
  const estilos = contarPorTaxonomia(recetas, 'estilos')
  const premiumChef = recetas.filter(r => r.premium_chef).length

  return NextResponse.json({
    total: recetas.length,
    premium_chef: premiumChef,
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
