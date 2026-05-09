import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const alimentoId = searchParams.get('alimento_id')

    if (!alimentoId) {
        return NextResponse.json({ error: 'alimento_id es requerido' }, { status: 400 })
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

    const { data: precios } = await supabase
        .from('precios_actuales')
        .select('*')
        .eq('alimento_id', alimentoId)
        .order('precio_por_kg', { ascending: true })

    return NextResponse.json(precios ?? [])
}
