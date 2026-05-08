import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET /api/clientes/[id]/protocolo-competicion — Listar protocolos del cliente
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { id } = await params

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { data, error } = await supabase
            .from('protocolos_competicion')
            .select('*')
            .eq('cliente_id', id)
            .eq('coach_id', user.id)
            .order('created_at', { ascending: false })

        if (error) throw error

        return NextResponse.json(data ?? [])
    } catch (error) {
        console.error('Error GET /api/clientes/[id]/protocolo-competicion:', error)
        return NextResponse.json({ error: 'Error al obtener protocolos' }, { status: 500 })
    }
}

// POST /api/clientes/[id]/protocolo-competicion — Crear nuevo protocolo
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { id } = await params

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const {
            nombre, deporte, fecha_competicion,
            peso_inicial, peso_objetivo,
            carga_dias_previos, carga_carbs_kg, carga_proteinas_kg, carga_grasas_kg, carga_inicio,
            geles_marca, geles_carbs_por_gel, geles_cada_minutos,
            electrolitos_marca, electrolitos_cada_minutos,
            cafeina_mg, hidratacion_ml_cada_15min,
            notas_previa, notas_durante, notas_post,
        } = body

        if (!nombre || !nombre.trim()) {
            return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('protocolos_competicion')
            .insert({
                cliente_id: id,
                coach_id: user.id,
                nombre: nombre.trim(),
                deporte: deporte || null,
                fecha_competicion: fecha_competicion || null,
                peso_inicial: peso_inicial ? Number(peso_inicial) : null,
                peso_objetivo: peso_objetivo ? Number(peso_objetivo) : null,
                carga_dias_previos: Number(carga_dias_previos) || 3,
                carga_carbs_kg: Number(carga_carbs_kg) || 8,
                carga_proteinas_kg: Number(carga_proteinas_kg) || 1.6,
                carga_grasas_kg: Number(carga_grasas_kg) || 0.6,
                carga_inicio: carga_inicio || null,
                geles_marca: geles_marca || null,
                geles_carbs_por_gel: Number(geles_carbs_por_gel) || 25,
                geles_cada_minutos: Number(geles_cada_minutos) || 30,
                electrolitos_marca: electrolitos_marca || null,
                electrolitos_cada_minutos: Number(electrolitos_cada_minutos) || 60,
                cafeina_mg: cafeina_mg ? Number(cafeina_mg) : null,
                hidratacion_ml_cada_15min: Number(hidratacion_ml_cada_15min) || 150,
                notas_previa: notas_previa || null,
                notas_durante: notas_durante || null,
                notas_post: notas_post || null,
                activo: true,
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json(data, { status: 201 })
    } catch (error) {
        console.error('Error POST /api/clientes/[id]/protocolo-competicion:', error)
        return NextResponse.json({ error: 'Error al crear protocolo' }, { status: 500 })
    }
}

// PUT /api/clientes/[id]/protocolo-competicion — Actualizar protocolo (por query param ?id=xxx)
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { id: clienteId } = await params
        const url = new URL(request.url)
        const protocoloId = url.searchParams.get('id')

        if (!protocoloId) {
            return NextResponse.json({ error: 'Falta el parámetro id del protocolo' }, { status: 400 })
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        }

        const campos = [
            'nombre', 'deporte', 'fecha_competicion',
            'peso_inicial', 'peso_objetivo',
            'carga_dias_previos', 'carga_carbs_kg', 'carga_proteinas_kg', 'carga_grasas_kg', 'carga_inicio',
            'geles_marca', 'geles_carbs_por_gel', 'geles_cada_minutos',
            'electrolitos_marca', 'electrolitos_cada_minutos',
            'cafeina_mg', 'hidratacion_ml_cada_15min',
            'notas_previa', 'notas_durante', 'notas_post', 'activo',
        ]

        for (const campo of campos) {
            if (body[campo] !== undefined) {
                const valor = body[campo]
                if (typeof valor === 'string' && valor.trim() === '') {
                    updates[campo] = null
                } else if (campo === 'nombre') {
                    updates[campo] = valor.trim()
                } else if (['peso_inicial', 'peso_objetivo', 'carga_dias_previos', 'carga_carbs_kg', 'carga_proteinas_kg', 'carga_grasas_kg', 'geles_carbs_por_gel', 'geles_cada_minutos', 'electrolitos_cada_minutos', 'cafeina_mg', 'hidratacion_ml_cada_15min'].includes(campo)) {
                    updates[campo] = valor !== null ? Number(valor) : null
                } else {
                    updates[campo] = valor
                }
            }
        }

        const { data, error } = await supabase
            .from('protocolos_competicion')
            .update(updates)
            .eq('id', protocoloId)
            .eq('coach_id', user.id)
            .select()
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: 'Protocolo no encontrado' }, { status: 404 })
            }
            throw error
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error PUT /api/clientes/[id]/protocolo-competicion:', error)
        return NextResponse.json({ error: 'Error al actualizar protocolo' }, { status: 500 })
    }
}

// DELETE /api/clientes/[id]/protocolo-competicion — Eliminar protocolo (por query param ?id=xxx)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const url = new URL(request.url)
        const protocoloId = url.searchParams.get('id')

        if (!protocoloId) {
            return NextResponse.json({ error: 'Falta el parámetro id del protocolo' }, { status: 400 })
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { error } = await supabase
            .from('protocolos_competicion')
            .delete()
            .eq('id', protocoloId)
            .eq('coach_id', user.id)

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: 'Protocolo no encontrado' }, { status: 404 })
            }
            throw error
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error DELETE protocolo-competicion:', error)
        return NextResponse.json({ error: 'Error al eliminar protocolo' }, { status: 500 })
    }
}
