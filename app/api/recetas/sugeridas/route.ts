import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const kcal = parseFloat(searchParams.get('kcal') ?? '0')
    const proteinas = parseFloat(searchParams.get('proteinas') ?? '0')
    const limite = Math.min(parseInt(searchParams.get('limite') ?? '3'), 6)
    const tipo_plato = searchParams.get('tipo_plato') ?? null

    if (kcal <= 0) return NextResponse.json({ recetas: [] })

    const tolerancia = 0.35  // ±35%
    const db = createServiceSupabase()

    let query = db
        .from('recetas')
        .select('id, nombre, imagen_url, kcal, proteinas, carbohidratos, grasas, tipo_plato, tiempo_prep_min')
        .eq('estado', 'aprobada')
        .gte('kcal', Math.round(kcal * (1 - tolerancia)))
        .lte('kcal', Math.round(kcal * (1 + tolerancia)))
        .gte('proteinas', Math.round(proteinas * (1 - tolerancia)))
        .order('kcal', { ascending: true })
        .limit(limite * 4)

    if (tipo_plato) query = query.eq('tipo_plato', tipo_plato)
    const { data } = await query

    // Si no hay suficientes con filtro de tipo_plato, ampliar sin él
    let pool = data ?? []
    if (tipo_plato && pool.length < limite) {
        const { data: sinFiltro } = await db
            .from('recetas')
            .select('id, nombre, imagen_url, kcal, proteinas, carbohidratos, grasas, tipo_plato, tiempo_prep_min')
            .eq('estado', 'aprobada')
            .gte('kcal', Math.round(kcal * (1 - tolerancia)))
            .lte('kcal', Math.round(kcal * (1 + tolerancia)))
            .gte('proteinas', Math.round(proteinas * (1 - tolerancia)))
            .not('id', 'in', `(${pool.map(r => r.id).join(',')})`)
            .order('kcal', { ascending: true })
            .limit(limite * 2)
        pool = [...pool, ...(sinFiltro ?? [])]
    }

    if (!pool.length) return NextResponse.json({ recetas: [] })

    // Ordenar por distancia euclidiana a los macros objetivo
    const sorted = pool
        .map(r => ({
            ...r,
            _dist: Math.abs(r.kcal - kcal) / kcal + Math.abs((r.proteinas ?? 0) - proteinas) / (proteinas || 1)
        }))
        .sort((a, b) => a._dist - b._dist)
        .slice(0, limite)
        .map(({ _dist: _, ...r }) => r)

    return NextResponse.json({ recetas: sorted })
}
