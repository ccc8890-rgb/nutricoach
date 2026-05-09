// app/api/lista-compra/selecciones/route.ts
/**
 * GET  /api/lista-compra/selecciones?plan_id=&semana_inicio=
 * POST /api/lista-compra/selecciones
 *
 * Gestiona las selecciones de supermercado por ingrediente del cliente.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const planId = searchParams.get('plan_id')
        const semanaInicio = searchParams.get('semana_inicio')

        if (!planId || !semanaInicio) {
            return NextResponse.json({ error: 'Faltan plan_id o semana_inicio' }, { status: 400 })
        }

        const srv = createServiceSupabase()
        const { data, error } = await srv
            .from('selecciones_lista_compra')
            .select('*, supermercados(nombre, color, slug)')
            .eq('plan_id', planId)
            .eq('semana_inicio', semanaInicio)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ selecciones: data || [] })

    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json().catch(() => null)
        if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

        const {
            cliente_id, plan_id, alimento_id, supermercado_id,
            producto_nombre, precio_por_kg, url_producto, semana_inicio,
            seleccionado_por = 'cliente',
        } = body

        if (!cliente_id || !plan_id || !alimento_id || !semana_inicio) {
            return NextResponse.json({ error: 'Faltan campos requeridos: cliente_id, plan_id, alimento_id, semana_inicio' }, { status: 400 })
        }

        const srv = createServiceSupabase()

        // Upsert: actualiza si ya existe selección para este alimento/plan/semana
        const { data, error } = await srv
            .from('selecciones_lista_compra')
            .upsert({
                cliente_id,
                plan_id,
                alimento_id,
                supermercado_id: supermercado_id || null,
                producto_nombre: producto_nombre || null,
                precio_por_kg: precio_por_kg || null,
                url_producto: url_producto || null,
                semana_inicio,
                seleccionado_por,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'cliente_id,plan_id,alimento_id,semana_inicio',
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ ok: true, seleccion: data })

    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
