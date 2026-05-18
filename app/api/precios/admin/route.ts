import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

/**
 * GET /api/precios/admin
 * Devuelve todos los precios actuales de la vista precios_actuales.
 * Usa service_role para ver TODOS los supermercados (sin filtro RLS).
 *
 * Query params:
 *   - supermercado_id: string — filtrar por supermercado
 *   - q: string — búsqueda por nombre/categoría
 *   - from: number (default 0) — offset para paginación
 *   - to: number (default 199) — límite para paginación
 */
export async function GET(request: NextRequest) {
    const supabase = createServiceSupabase()
    const { searchParams } = new URL(request.url)

    const supermercadoId = searchParams.get('supermercado_id')
    const q = searchParams.get('q')
    const from = parseInt(searchParams.get('from') ?? '0')
    const to = parseInt(searchParams.get('to') ?? '199')

    let query = supabase
        .from('precios_actuales')
        .select('*', { count: 'exact' })

    if (supermercadoId) {
        query = query.eq('supermercado_id', supermercadoId)
    }

    if (q) {
        const term = q.toLowerCase()
        query = query.or(`alimento_nombre.ilike.%${term}%,alimento_categoria.ilike.%${term}%`)
    }

    const { data, count, error } = await query
        .order('supermercado_nombre', { ascending: true })
        .order('alimento_categoria', { ascending: true })
        .order('alimento_nombre', { ascending: true })
        .range(from, to)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [], count: count ?? 0 })
}

/**
 * POST /api/precios/admin
 * Inserta o actualiza un precio de producto.
 */
export async function POST(request: Request) {
    const body = await request.json()
    const supabase = createServiceSupabase()

    const { error } = await supabase.from('productos_supermercado').upsert({
        supermercado_id: body.supermercado_id,
        alimento_id: body.alimento_id,
        precio_por_kg: body.precio_por_kg,
        precio_unidad: body.precio_unidad || null,
        url_producto: body.url_producto || null,
        fecha_precio: new Date().toISOString().split('T')[0],
    }, {
        onConflict: 'supermercado_id, alimento_id',
    })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}

/**
 * PATCH /api/precios/admin
 * Actualiza el precio_por_kg de un producto (edición inline).
 * Body: { id: string, precio_por_kg: number }
 */
export async function PATCH(request: Request) {
    const body = await request.json()
    const { id, precio_por_kg } = body

    if (!id || precio_por_kg === undefined) {
        return NextResponse.json({ error: 'id y precio_por_kg son requeridos' }, { status: 400 })
    }

    const supabase = createServiceSupabase()

    const { error } = await supabase.from('productos_supermercado').update({
        precio_por_kg: parseFloat(precio_por_kg),
        fecha_precio: new Date().toISOString().split('T')[0],
    }).eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}

/**
 * DELETE /api/precios/admin?id=X
 * Elimina un precio de producto.
 */
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
    }

    const supabase = createServiceSupabase()

    const { error } = await supabase.from('productos_supermercado').delete().eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
