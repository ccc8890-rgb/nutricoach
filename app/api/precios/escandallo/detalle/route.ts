/**
 * GET /api/precios/escandallo/detalle?cliente_id=X&supermercado_id=Y
 *
 * Devuelve el escandallo detallado con alternativas de producto para cada alimento.
 * Usa la función calcularEscandalloConAlternativas() que devuelve:
 * - precio_total
 * - supermercado_base
 * - alimentos[] con producto_seleccionado + alternativas
 * - ahorro_potencial
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { calcularEscandalloConAlternativas } from '@/lib/precios-supermercado'

export async function GET(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { searchParams } = new URL(request.url)
        const clienteId = searchParams.get('cliente_id')
        const supermercadoId = searchParams.get('supermercado_id')

        // Verificar autenticación
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const srv = createServiceSupabase()

        if (!clienteId) {
            return NextResponse.json({ error: 'cliente_id es requerido' }, { status: 400 })
        }

        // Obtener el plan activo del cliente
        const { data: plan } = await srv
            .from('planes_nutricion')
            .select('*')
            .eq('cliente_id', clienteId)
            .eq('activo', true)
            .single()

        if (!plan) {
            return NextResponse.json({ error: 'Cliente sin plan activo' }, { status: 404 })
        }

        // Obtener comidas del plan
        const { data: comidas } = await srv
            .from('comidas')
            .select('*, comida_alimentos(*, alimentos(*))')
            .eq('plan_id', plan.id)

        if (!comidas || comidas.length === 0) {
            return NextResponse.json({ error: 'El plan no tiene comidas' }, { status: 404 })
        }

        // Construir estructura para calcularEscandalloConAlternativas
        const comidasData = comidas.map((c: any) => ({
            nombre: c.nombre,
            alimentos: (c.comida_alimentos || []).map((ca: any) => ({
                alimento: {
                    id: ca.alimento_id,
                    nombre: ca.alimentos?.nombre || '',
                    categoria: ca.alimentos?.categoria || null,
                },
                cantidad_gramos: ca.cantidad_gramos,
            })),
        }))

        const resultado = await calcularEscandalloConAlternativas(comidasData, supermercadoId || null)

        return NextResponse.json({
            cliente_id: clienteId,
            cliente_nombre: '',  // se rellena desde la UI
            plan_id: plan.id,
            plan_nombre: plan.nombre,
            ...resultado,
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Escandallo Detalle] Error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
