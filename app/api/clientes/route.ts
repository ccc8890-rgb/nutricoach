import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

interface ClienteRow {
    id: string
    profile_id: string
    activo: boolean
    profiles?: {
        nombre?: string | null
        apellidos?: string | null
        email?: string | null
    } | null
}

interface PlanRow {
    id: string
    nombre: string
    cliente_id: string
}

export async function GET(request: NextRequest) {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = createServiceSupabase()
    const { data: clientesRaw, error } = await db
        .from('clientes')
        .select('id, profile_id, activo, profiles(nombre, apellidos, email)')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const clientes = (clientesRaw ?? []) as ClienteRow[]
    const clienteIds = clientes.map(cliente => cliente.id)
    const { data: planesRaw } = clienteIds.length
        ? await db
            .from('planes_nutricion')
            .select('id, nombre, cliente_id')
            .in('cliente_id', clienteIds)
            .eq('activo', true)
        : { data: [] }

    const planPorCliente = new Map((planesRaw as PlanRow[] | null ?? []).map(plan => [plan.cliente_id, plan]))

    return NextResponse.json({
        clientes: clientes.map(cliente => ({
            id: cliente.id,
            nombre: cliente.profiles?.nombre ?? '',
            apellidos: cliente.profiles?.apellidos ?? '',
            email: cliente.profiles?.email ?? '',
            activo: cliente.activo,
            plan_activo: planPorCliente.get(cliente.id)
                ? {
                    id: planPorCliente.get(cliente.id)!.id,
                    nombre: planPorCliente.get(cliente.id)!.nombre,
                }
                : null,
        })),
    })
}
