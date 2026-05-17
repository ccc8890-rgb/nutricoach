import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = createApiSupabase(request)
        const { id } = await params

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const serviceSb = createServiceSupabase()

        // Fase deportiva activa (próxima competición)
        const { data: fase } = await serviceSb
            .from('fase_deportiva_cliente')
            .select('*')
            .eq('cliente_id', id)
            .neq('fase_actual', 'finalizada')
            .order('fecha_competicion', { ascending: true })
            .limit(1)
            .single()

        // Todas las competiciones del cliente (activas)
        const { data: competiciones } = await serviceSb
            .from('competiciones')
            .select('*')
            .eq('cliente_id', id)
            .eq('activo', true)
            .order('fecha_competicion', { ascending: true })

        return NextResponse.json({
            fase_activa: fase ?? null,
            competiciones: competiciones ?? [],
        })
    } catch (err) {
        console.error('Error en GET /api/clientes/[id]/fase-deportiva:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = createApiSupabase(request)
        const { id } = await params
        const body = await request.json().catch(() => ({}))

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { data: profile } = await supabase
            .from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'coach') {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
        }

        const { nombre, disciplina, fecha_competicion, objetivo, tiempo_objetivo_min, notas } = body
        if (!nombre || !disciplina || !fecha_competicion) {
            return NextResponse.json(
                { error: 'nombre, disciplina y fecha_competicion son obligatorios' },
                { status: 400 }
            )
        }

        const serviceSb = createServiceSupabase()
        const { data, error } = await serviceSb
            .from('competiciones')
            .insert({
                cliente_id: id,
                nombre,
                disciplina,
                fecha_competicion,
                objetivo: objetivo ?? 'completar',
                tiempo_objetivo_min: tiempo_objetivo_min || null,
                notas: notas || null,
            })
            .select()
            .single()

        if (error) {
            console.error('Error al crear competición:', error)
            return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
        }

        return NextResponse.json({ success: true, competicion: data })
    } catch (err) {
        console.error('Error en POST /api/clientes/[id]/fase-deportiva:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = createApiSupabase(request)
        const { id: clienteId } = await params
        const { searchParams } = new URL(request.url)
        const competicionId = searchParams.get('competicion_id')

        if (!competicionId) return NextResponse.json({ error: 'competicion_id requerido' }, { status: 400 })

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { data: profile } = await supabase
            .from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'coach') {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
        }

        const serviceSb = createServiceSupabase()
        const { error } = await serviceSb
            .from('competiciones')
            .update({ activo: false })
            .eq('id', competicionId)
            .eq('cliente_id', clienteId)

        if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Error en DELETE /api/clientes/[id]/fase-deportiva:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
