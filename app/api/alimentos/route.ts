import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { esProductoNoComestible } from '@/lib/scraping/guard-no-comestible'

/**
 * UNIFICADO: La lógica de "qué es no comestible" está únicamente en
 * lib/scraping/guard-no-comestible.ts (esProductoNoComestible).
 *
 * NO duplicar listas de stopwords aquí — mantener un solo punto de verdad.
 */

export async function GET(request: NextRequest) {
    try {
        const supabase = createServiceSupabase()
        const { searchParams } = new URL(request.url)
        const q = searchParams.get('q') ?? ''
        const categoria = searchParams.get('categoria') ?? ''
        const custom = searchParams.get('custom')
        const fuente = searchParams.get('fuente') ?? ''
        const soloConDatos = searchParams.get('soloConDatos') === 'true'

        let query = supabase.from('alimentos').select('*', { count: 'exact' })
            .eq('es_comestible', true)  // ocultar no-comestibles

        if (q) {
            query = query.ilike('nombre', `%${q}%`)
        }

        if (categoria) query = query.eq('categoria', categoria)
        if (custom === 'true') query = query.eq('custom', true)
        else if (custom === 'false') query = query.eq('custom', false)
        if (fuente) query = query.eq('fuente', fuente)

        if (soloConDatos) {
            query = query.gt('calorias', 0)
        }

        if (q) {
            query = query.order("calorias", { ascending: false, nullsFirst: false })
            query = query.order("nombre", { ascending: true })
            query = query.limit(80)
        } else {
            query = query.order("categoria", { ascending: true })
            query = query.order("nombre", { ascending: true })
            query = query.limit(5000)
            const from = parseInt(searchParams.get("from") || "")
            const to = parseInt(searchParams.get("to") || "")
            if (!isNaN(from) && !isNaN(to)) {
                query = query.range(from, to)
            }
        }

        const { data, error, count } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })

        // 🛡️ Filtro post-query: delegado a guard-no-comestible.ts (único punto de verdad)
        const filtrados = (data ?? []).filter(a => {
            if (!a.nombre) return true
            return !esProductoNoComestible(a.nombre)
        })

        const response = filtrados as typeof data
        return NextResponse.json(response)
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json()
        const { nombre, categoria, calorias, proteinas, carbohidratos, grasas, fibra, fuente, codigo_externo } = body

        if (!nombre || calorias === undefined) {
            return NextResponse.json({ error: 'nombre y calorias son obligatorios' }, { status: 400 })
        }

        // 🚫 Rechazar productos no comestibles (delegado a guard-no-comestible.ts — ÚNICO punto de verdad)
        if (esProductoNoComestible(nombre || '')) {
            return NextResponse.json({ error: 'Producto no comestible rechazado' }, { status: 400 })
        }

        // Evitar duplicados (mismo nombre normalizado y coach)
        const nombreNormalizado = nombre.trim()
        const { data: existentes } = await supabase
            .from('alimentos')
            .select('id')
            .eq('coach_id', user.id)
            .ilike('nombre', nombreNormalizado)

        if (existentes && existentes.length > 0) {
            return NextResponse.json({ id: existentes[0].id, duplicado: true })
        }

        const { data, error } = await supabase.from('alimentos').insert({
            nombre: nombreNormalizado,
            categoria: categoria ?? 'Supermercado',
            calorias,
            proteinas: proteinas ?? 0,
            carbohidratos: carbohidratos ?? 0,
            grasas: grasas ?? 0,
            fibra: fibra ?? 0,
            fuente: fuente ?? undefined,
            codigo_externo: codigo_externo ?? null,
            custom: true,
            coach_id: user.id,
        }).select().single()

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
    }
}
