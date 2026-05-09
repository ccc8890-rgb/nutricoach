import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { /* readonly */ },
            },
        }
    )

    const { data: precios } = await supabase
        .from('precios_actuales')
        .select('*')
        .order('supermercado_nombre', { ascending: true })
        .order('alimento_categoria', { ascending: true })
        .order('alimento_nombre', { ascending: true })

    return NextResponse.json(precios ?? [])
}

export async function POST(request: Request) {
    const body = await request.json()

    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { /* readonly */ },
            },
        }
    )

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

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { /* readonly */ },
            },
        }
    )

    const { error } = await supabase.from('productos_supermercado').delete().eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
