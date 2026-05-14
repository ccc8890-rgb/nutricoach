import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    try {
        // Usamos service_role_key para el GET porque el catálogo de alimentos
        // es público (shared) y no requiere sesión. Esto evita que RLS
        // devuelva array vacío para peticiones sin cookies.
        const supabase = createServiceSupabase()
        const { searchParams } = new URL(request.url)
        const q = searchParams.get('q') ?? ''
        const categoria = searchParams.get('categoria') ?? ''
        const custom = searchParams.get('custom') // 'true' | 'false' | null
        const fuente = searchParams.get('fuente') ?? '' // 'ia' | 'bedca' | etc.

        let query = supabase.from('alimentos').select('*')

        if (q) {
            query = query.ilike('nombre', `%${q}%`)
        }

        if (categoria) query = query.eq('categoria', categoria)
        if (custom === 'true') query = query.eq('custom', true)
        else if (custom === 'false') query = query.eq('custom', false)
        if (fuente) query = query.eq('fuente', fuente)

        // Orden: primero los que tienen calorias > 0 (tienen datos nutricionales),
        // luego el resto. Así el buscador del editor muestra primero alimentos con macros.
        query = query.order('calorias', { ascending: false, nullsFirst: false })
        query = query.order('nombre', { ascending: true })

        // Limitar a 50 resultados para no saturar
        query = query.limit(50)

        const { data, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data)
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
