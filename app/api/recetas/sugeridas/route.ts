import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const kcal = parseFloat(searchParams.get('kcal') ?? '0')
    const proteinas = parseFloat(searchParams.get('proteinas') ?? '0')
    const limite = Math.min(parseInt(searchParams.get('limite') ?? '3'), 6)

    if (kcal <= 0) return NextResponse.json({ recetas: [] })

    const tolerancia = 0.35  // ±35%
    const db = createServiceSupabase()

    const { data } = await db
        .from('recetas')
        .select('id, nombre, imagen_url, kcal, proteinas, carbohidratos, grasas, tipo_plato, tiempo_prep_min')
        .eq('estado', 'aprobada')
        .gte('kcal', Math.round(kcal * (1 - tolerancia)))
        .lte('kcal', Math.round(kcal * (1 + tolerancia)))
        .gte('proteinas', Math.round(proteinas * (1 - tolerancia)))
        .order('kcal', { ascending: true })
        .limit(limite * 3)  // traer más para ordenar por proximidad

    if (!data?.length) return NextResponse.json({ recetas: [] })

    // Ordenar por distancia euclidiana a los macros objetivo
    const sorted = data
        .map(r => ({
            ...r,
            _dist: Math.abs(r.kcal - kcal) / kcal + Math.abs((r.proteinas ?? 0) - proteinas) / (proteinas || 1)
        }))
        .sort((a, b) => a._dist - b._dist)
        .slice(0, limite)
        .map(({ _dist: _, ...r }) => r)

    return NextResponse.json({ recetas: sorted })
}
