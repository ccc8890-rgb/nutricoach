import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = createApiSupabase(request)
        const { id } = await params
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json()
        const { nombre, categoria, calorias, proteinas, carbohidratos, grasas, fibra } = body

        const { data, error } = await supabase
            .from('alimentos')
            .update({
                nombre,
                categoria,
                calorias,
                proteinas,
                carbohidratos,
                grasas,
                fibra: fibra ?? 0,
            })
            .eq('id', id)
            .eq('coach_id', user.id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = createApiSupabase(request)
        const { id } = await params
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { error } = await supabase
            .from('alimentos')
            .delete()
            .eq('id', id)
            .eq('coach_id', user.id)

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
    }
}
