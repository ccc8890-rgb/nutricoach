import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { inferirMomentoDesdeTipo, scoreRecetaParaAgente } from '@/lib/recetario-taxonomia'

// Mapeo: restricción del onboarding → alérgenos EU que la receta NO debe contener
// Modelo positivo: excluimos recetas donde intolerancias SOLAPA con los alérgenos del cliente
const RESTRICCION_A_ALERGENOS: Record<string, string[]> = {
    'sin gluten':       ['Gluten'],
    'sin lactosa':      ['Lácteos'],
    'sin huevo':        ['Huevos'],
    'sin frutos secos': ['Frutos Secos', 'Cacahuetes'],
    'sin soja':         ['Soja'],
    'sin mariscos':     ['Crustáceos', 'Moluscos'],
    'vegetariano':      ['Pescado', 'Crustáceos', 'Moluscos'],
    'vegano':           ['Lácteos', 'Huevos', 'Pescado', 'Crustáceos', 'Moluscos'],
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const kcal = parseFloat(searchParams.get('kcal') ?? '0')
    const proteinas = parseFloat(searchParams.get('proteinas') ?? '0')
    const limite = Math.min(parseInt(searchParams.get('limite') ?? '3'), 12)
    const tipo_plato = searchParams.get('tipo_plato') ?? null
    const cliente_id = searchParams.get('cliente_id') ?? null
    const qText = searchParams.get('q')?.trim() ?? ''
    const objetivo = searchParams.get('objetivo') ?? null
    const deporte = searchParams.get('deporte') ?? null
    const momento = searchParams.get('momento') ?? inferirMomentoDesdeTipo(tipo_plato)
    const preferirChefHealthy = searchParams.get('chef') === '1'

    if (kcal <= 0 && !qText) return NextResponse.json({ recetas: [] })

    const tolerancia = 0.35  // ±35%
    const db = createServiceSupabase()

    // Obtener restricciones del cliente y convertir a alérgenos EU a excluir
    let alergenosExcluir: string[] = []
    if (cliente_id) {
        const { data: onboarding } = await db
            .from('onboarding_responses')
            .select('restricciones')
            .eq('cliente_id', cliente_id)
            .maybeSingle()

        if (onboarding?.restricciones?.length) {
            const sets = (onboarding.restricciones as string[])
                .flatMap(r => RESTRICCION_A_ALERGENOS[r.toLowerCase()] ?? [])
            alergenosExcluir = [...new Set(sets)]
        }
    }

    const buildQuery = (extraFilters?: { tipos?: string[]; excludeIds?: string[]; relaxedMacros?: boolean }) => {
        let q = db
            .from('recetas')
            .select('id, nombre, imagen_url, kcal, proteinas, carbohidratos, grasas, tipo_plato, tiempo_prep_min, score_calidad, recipe_intelligence_score, macro_flex_score, planning_roles, objetivos, deportes, momentos, estilos, premium_chef, adherencia_score')
            .eq('estado', 'aprobada')
            .order('kcal', { ascending: true })
            .limit(extraFilters?.excludeIds ? limite * 2 : limite * 4)

        if (!extraFilters?.relaxedMacros && kcal > 0) {
            q = q
                .gte('kcal', Math.round(kcal * (1 - tolerancia)))
                .lte('kcal', Math.round(kcal * (1 + tolerancia)))
                .gte('proteinas', Math.round(proteinas * (1 - tolerancia)))
        }
        if (qText) {
            q = q.ilike('nombre', `%${qText}%`)
        }
        if (extraFilters?.tipos?.length) {
            q = q.in('tipo_plato', extraFilters.tipos)
        }
        if (objetivo) {
            q = q.or(`objetivos.cs.{${objetivo}},objetivos.eq.{}`)
        }
        if (deporte) {
            q = q.or(`deportes.cs.{${deporte}},deportes.cs.{general},deportes.eq.{}`)
        }
        if (momento) {
            q = q.or(`momentos.cs.{${momento}},momentos.eq.{}`)
        }
        if (extraFilters?.excludeIds?.length) {
            q = q.not('id', 'in', `(${extraFilters.excludeIds.join(',')})`)
        }
        // Excluir recetas que contengan alérgenos del cliente (modelo EU positivo)
        if (alergenosExcluir.length) {
            q = q.not('intolerancias', 'ov', `{${alergenosExcluir.join(',')}}`)
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

    if (qText && pool.length < limite) {
        const tiposExtra = tipo_plato ? (TIPOS_COMPATIBLES[tipo_plato] ?? [tipo_plato]) : undefined
        const fallbackQuery = buildQuery({
            relaxedMacros: true,
            tipos: tiposExtra,
            excludeIds: pool.length ? pool.map(r => r.id) : undefined,
        })
        const { data: sinMacros } = await fallbackQuery
        pool = [...pool, ...(sinMacros ?? [])]
    }

    if (!pool.length) return NextResponse.json({ recetas: [] })

    // Ordenar por score compuesto: macros + taxonomía + adherencia + calidad.
    const sorted = pool
        .map(r => ({
            ...r,
            _dist: kcal > 0
                ? Math.abs(r.kcal - kcal) / kcal + Math.abs((r.proteinas ?? 0) - proteinas) / (proteinas || 1)
                : Math.abs((r.proteinas ?? 0) - proteinas),
            _agent_score: scoreRecetaParaAgente(r, {
                objetivo,
                deporte,
                momento,
                targetKcal: kcal,
                targetProteinas: proteinas,
                preferirChefHealthy,
            }),
        }))
        .sort((a, b) => b._agent_score - a._agent_score || a._dist - b._dist)
        .slice(0, limite)
        .map(({ _dist, _agent_score, ...r }) => {
            void _dist
            void _agent_score
            return r
        })

    return NextResponse.json({ recetas: sorted })
}
