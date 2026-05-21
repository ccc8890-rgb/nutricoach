import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const RANGOS_KCAL: Record<string, { min: number; max: number }> = {
    Desayuno: { min: 80, max: 900 },
    Almuerzo: { min: 50, max: 600 },
    Comida: { min: 100, max: 1200 },
    Cena: { min: 80, max: 1000 },
    Snack: { min: 30, max: 500 },
    Merienda: { min: 50, max: 600 },
    Postre: { min: 30, max: 800 },
    Bebida: { min: 0, max: 300 },
    Condimento: { min: 0, max: 200 },
}

async function requireUser(request: NextRequest) {
    const auth = createApiSupabase(request)
    const { data: { user } } = await auth.auth.getUser()
    return user
}

export async function GET(request: NextRequest) {
    try {
        const user = await requireUser(request)
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const pageSize = parseInt(searchParams.get('pageSize') || '100')
        const offset = (page - 1) * pageSize

        const supabase = createServiceSupabase()

        // ── 1. Obtener total ──
        const { count: total } = await supabase
            .from('recetas')
            .select('*', { count: 'exact', head: true })

        // ── 2. Obtener recetas ──
        const { data: recetas, error } = await supabase
            .from('recetas')
            .select(`
        id, nombre, descripcion, instrucciones, consejos, notas_coach,
        categoria, tipo_coccion, dificultad, intolerancias, tags,
        porciones, descripcion_porcion, tiempo_prep_min, tiempo_coccion_min,
        kcal, proteinas, carbohidratos, grasas, fibra,
        imagen_url, url_origen, fuente, estado,
        created_at, updated_at
      `)
            .order('nombre', { ascending: true })
            .range(offset, offset + pageSize - 1)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // ── 3. Para cada receta, contar ingredientes ──
        const recetaIds = (recetas || []).map(r => r.id)
        let ingredientesCount: Record<string, number> = {}

        if (recetaIds.length > 0) {
            const { data: counts } = await supabase
                .from('receta_ingredientes')
                .select('receta_id, id')
                .in('receta_id', recetaIds)

            if (counts) {
                const map: Record<string, number> = {}
                counts.forEach(c => {
                    map[c.receta_id] = (map[c.receta_id] || 0) + 1
                })
                ingredientesCount = map
            }
        }

        // ── 4. Ensamblar respuesta ──
        const data = (recetas || []).map(r => ({
            ...r,
            num_ingredientes: ingredientesCount[r.id] || 0,
        }))

        return NextResponse.json({
            data,
            total: total || 0,
            page,
            pageSize,
            totalPages: total ? Math.ceil(total / pageSize) : 0,
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await requireUser(request)
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json()
        const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string') : []
        if (ids.length === 0) {
            return NextResponse.json({ error: 'No hay recetas para aprobar' }, { status: 400 })
        }
        if (ids.length > 250) {
            return NextResponse.json({ error: 'Máximo 250 recetas por lote' }, { status: 400 })
        }

        const supabase = createServiceSupabase()
        const { data: recetas, error } = await supabase
            .from('recetas')
            .select(`
                id, nombre, descripcion, instrucciones, categoria, tipo_plato,
                dificultad, intolerancias, imagen_url, url_origen, kcal, porciones, estado,
                receta_ingredientes(id, alimento_id, cantidad_gramos)
            `)
            .in('id', ids)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const bloqueadas: Array<{ id: string; nombre: string; motivos: string[] }> = []
        const aprobables: string[] = []

        for (const receta of recetas || []) {
            const motivos: string[] = []
            const ingredientes = receta.receta_ingredientes || []
            if (!receta.descripcion) motivos.push('sin descripción')
            if (!receta.instrucciones || receta.instrucciones.length < 20) motivos.push('instrucciones insuficientes')
            if (!receta.categoria) motivos.push('sin categoría')
            if (!receta.dificultad) motivos.push('sin dificultad')
            if (!receta.imagen_url) motivos.push('sin imagen')
            if (!receta.intolerancias || receta.intolerancias.length === 0) motivos.push('sin intolerancias')
            if (!receta.kcal || receta.kcal <= 0) motivos.push('sin macros')
            if (!receta.porciones || receta.porciones <= 0) motivos.push('porciones inválidas')
            if (ingredientes.length < 3) motivos.push(`solo ${ingredientes.length} ingredientes`)
            if (ingredientes.some((i: { alimento_id: string | null }) => !i.alimento_id)) motivos.push('ingredientes sin alimento')
            if (ingredientes.some((i: { cantidad_gramos: number | null }) => !i.cantidad_gramos || i.cantidad_gramos <= 0)) motivos.push('cantidades inválidas')

            const rango = receta.tipo_plato ? RANGOS_KCAL[receta.tipo_plato] : null
            if (rango && receta.kcal) {
                if (receta.kcal < rango.min) motivos.push(`kcal bajas para ${receta.tipo_plato}`)
                if (receta.kcal > rango.max) motivos.push(`kcal altas para ${receta.tipo_plato}`)
            }

            if (motivos.length > 0) bloqueadas.push({ id: receta.id, nombre: receta.nombre, motivos })
            else aprobables.push(receta.id)
        }

        if (bloqueadas.length > 0) {
            return NextResponse.json({
                error: 'Hay recetas que no pasan quality gate',
                bloqueadas,
                aprobables: aprobables.length,
            }, { status: 409 })
        }

        const { error: updateError } = await supabase
            .from('recetas')
            .update({ estado: 'aprobada' })
            .in('id', aprobables)

        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

        return NextResponse.json({ ok: true, aprobadas: aprobables.length })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
