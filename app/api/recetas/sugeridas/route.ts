import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

// Mapeo entre las restricciones del onboarding del cliente y los tags de intolerancias en recetas
const RESTRICCION_A_INTOLERANCIA: Record<string, string> = {
    'sin gluten':       'Sin Gluten',
    'sin lactosa':      'Sin Lactosa',
    'vegetariano':      'Vegetariano',
    'vegano':           'Vegano',
    'sin frutos secos': 'Sin Frutos Secos',
    'sin huevo':        'Sin Huevo',
    'sin mariscos':     'Sin Mariscos',
    'sin cerdo':        'Sin Cerdo',
    'sin soja':         'Sin Soja',
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const kcal = parseFloat(searchParams.get('kcal') ?? '0')
    const proteinas = parseFloat(searchParams.get('proteinas') ?? '0')
    const limite = Math.min(parseInt(searchParams.get('limite') ?? '3'), 7)
    const tipo_plato = searchParams.get('tipo_plato') ?? null
    const cliente_id = searchParams.get('cliente_id') ?? null

    if (kcal <= 0) return NextResponse.json({ recetas: [] })

    const tolerancia = 0.35  // ±35%
    const db = createServiceSupabase()

    // Obtener restricciones del cliente si se proporciona cliente_id
    let restriccionesIntolerancia: string[] = []
    if (cliente_id) {
        const { data: onboarding } = await db
            .from('onboarding_responses')
            .select('restricciones')
            .eq('cliente_id', cliente_id)
            .maybeSingle()

        if (onboarding?.restricciones?.length) {
            restriccionesIntolerancia = (onboarding.restricciones as string[])
                .map(r => RESTRICCION_A_INTOLERANCIA[r.toLowerCase()])
                .filter(Boolean)
        }
    }

    const buildQuery = (extraFilters?: { tipos?: string[]; excludeIds?: string[] }) => {
        let q = db
            .from('recetas')
            .select('id, nombre, imagen_url, kcal, proteinas, carbohidratos, grasas, tipo_plato, tiempo_prep_min')
            .eq('estado', 'aprobada')
            .gte('kcal', Math.round(kcal * (1 - tolerancia)))
            .lte('kcal', Math.round(kcal * (1 + tolerancia)))
            .gte('proteinas', Math.round(proteinas * (1 - tolerancia)))
            .order('kcal', { ascending: true })
            .limit(extraFilters?.excludeIds ? limite * 2 : limite * 4)

        if (extraFilters?.tipos?.length) {
            q = q.in('tipo_plato', extraFilters.tipos)
        }
        if (extraFilters?.excludeIds?.length) {
            q = q.not('id', 'in', `(${extraFilters.excludeIds.join(',')})`)
        }
        // Filtrar por intolerancias del cliente: solo recetas compatibles con TODAS sus restricciones
        if (restriccionesIntolerancia.length) {
            q = q.contains('intolerancias', restriccionesIntolerancia)
        }
        return q
    }

    let query = buildQuery()
    if (tipo_plato) query = query.eq('tipo_plato', tipo_plato)
    const { data } = await query

    // Si no hay suficientes con filtro de tipo_plato, ampliar con tipos compatibles
    const TIPOS_COMPATIBLES: Record<string, string[]> = {
        'Merienda': ['Merienda', 'Snack', 'Desayuno'],
        'Snack':    ['Snack', 'Merienda', 'Desayuno'],
        'Desayuno': ['Desayuno', 'Merienda', 'Snack'],
        'Comida':   ['Comida', 'Cena'],
        'Cena':     ['Cena', 'Comida'],
    }

    let pool = data ?? []
    if (tipo_plato && pool.length < limite) {
        const tiposExtra = TIPOS_COMPATIBLES[tipo_plato] ?? []
        const fallbackQuery = buildQuery({
            tipos: tiposExtra.length ? tiposExtra : undefined,
            // NOT IN () vacío es SQL inválido — solo excluir si hay resultados previos
            excludeIds: pool.length ? pool.map(r => r.id) : undefined,
        })
        const { data: sinFiltro } = await fallbackQuery
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
        .map(({ _dist, ...r }) => {
            void _dist
            return r
        })

    return NextResponse.json({ recetas: sorted })
}
