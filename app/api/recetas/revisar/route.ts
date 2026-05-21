import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { auditarRecetaProfesional } from '@/lib/recetas/auditoria'

export const dynamic = 'force-dynamic'

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
        score_calidad, nivel_fit, tipo_uso, contexto_uso, apta_cliente,
        alcohol_culinario, quality_estado_sugerido, quality_actualizado_at,
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
                id, nombre, estado
            `)
            .in('id', ids)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const bloqueadas: Array<{ id: string; nombre: string; motivos: string[] }> = []
        const aprobables: string[] = []

        for (const receta of recetas || []) {
            const audit = await auditarRecetaProfesional(supabase, receta.id, 'revision_lote_quality', 'api_recetas_revisar')
            const motivos = [...audit.score.bloqueantes]
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

        await Promise.all(aprobables.map(id => auditarRecetaProfesional(supabase, id, 'aprobada_lote', 'api_recetas_revisar')))

        return NextResponse.json({ ok: true, aprobadas: aprobables.length })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
