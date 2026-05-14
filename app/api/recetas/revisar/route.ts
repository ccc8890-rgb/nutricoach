import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
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
