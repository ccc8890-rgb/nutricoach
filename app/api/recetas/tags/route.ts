import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

/**
 * GET /api/recetas/tags?q=
 * Devuelve tags únicos existentes en la BD, filtrados por query opcional.
 * Usa service_role para bypass RLS.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const q = searchParams.get('q')?.trim().toLowerCase() || ''

        // Extraer todos los tags de la columna jsonb[] 'tags'
        // Supabase no tiene un operador directo para desanidar jsonb[],
        // así que traemos todos y filtramos en memoria.
        const svc = createServiceSupabase()
        const { data, error } = await svc
            .from('recetas')
            .select('tags')
            .not('tags', 'is', null)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Recoger tags únicos
        const tagSet = new Set<string>()
        for (const row of data ?? []) {
            if (Array.isArray(row.tags)) {
                for (const tag of row.tags) {
                    if (typeof tag === 'string') {
                        tagSet.add(tag.trim())
                    }
                }
            }
        }

        // Convertir a array y ordenar alfabéticamente
        let tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'es'))

        // Filtrar por query si existe
        if (q) {
            tags = tags.filter(t => t.toLowerCase().includes(q))
        }

        return NextResponse.json({ tags })
    } catch (e) {
        console.error('[api/recetas/tags] Error:', e)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
