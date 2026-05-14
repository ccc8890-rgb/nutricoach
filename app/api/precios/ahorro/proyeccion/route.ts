/**
 * GET /api/precios/ahorro/proyeccion?cliente_id=X&supermercado_base=Mercadona&supermercado_ahorro=Lidl
 *
 * Calcula la proyección de ahorro semanal, mensual y anual
 * comparando dos supermercados para el plan de un cliente.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import type { ProyeccionAhorro } from '@/types'

export async function GET(request: NextRequest) {
    try {
        const authSupabase = createApiSupabase(request)
        const { data: { user } } = await authSupabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const clienteId = searchParams.get('cliente_id')

        // Aceptamos tanto UUIDs directos (supermercado_base_id) como slugs (supermercado_base)
        const superBaseId = searchParams.get('supermercado_base_id')
        const superAhorroId = searchParams.get('supermercado_ahorro_id')
        const superBaseSlug = searchParams.get('supermercado_base')
        const superAhorroSlug = searchParams.get('supermercado_ahorro')

        if (!clienteId || (!superBaseId && !superBaseSlug) || (!superAhorroId && !superAhorroSlug)) {
            return NextResponse.json({
                error: 'cliente_id, supermercado_base_id (o slug) y supermercado_ahorro_id (o slug) son requeridos',
            }, { status: 400 })
        }

        const srv = createServiceSupabase()

        // Obtener supermercados
        let smBase, smAhorro: any
        if (superBaseId) {
            const { data } = await srv.from('supermercados').select('*').eq('id', superBaseId).single()
            smBase = data
        } else {
            const { data } = await srv.from('supermercados').select('*').eq('slug', superBaseSlug).single()
            smBase = data
        }
        if (superAhorroId) {
            const { data } = await srv.from('supermercados').select('*').eq('id', superAhorroId).single()
            smAhorro = data
        } else {
            const { data } = await srv.from('supermercados').select('*').eq('slug', superAhorroSlug).single()
            smAhorro = data
        }

        if (!smBase || !smAhorro) {
            return NextResponse.json({ error: 'Supermercados no encontrados' }, { status: 404 })
        }

        // Obtener plan activo del cliente
        const { data: plan } = await srv
            .from('planes_nutricion')
            .select('id')
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

        // Acumular cantidades por alimento
        const alimentosGramos = new Map<string, number>()
        for (const comida of comidas) {
            for (const ca of (comida as any).comida_alimentos || []) {
                const id = ca.alimento_id
                alimentosGramos.set(id, (alimentosGramos.get(id) || 0) + (ca.cantidad_gramos || 0))
            }
        }

        const alimentoIds = Array.from(alimentosGramos.keys())

        // Obtener precios de ambos supermercados
        const { data: precios } = await srv
            .from('productos_supermercado')
            .select('supermercado_id, alimento_id, precio_por_kg')
            .in('alimento_id', alimentoIds)
            .in('supermercado_id', [smBase.id, smAhorro.id])

        // Construir mapa: supermercado_id → { alimento_id → mejor_precio }
        const preciosPorSuper = new Map<string, Map<string, number>>()
        for (const p of precios ?? []) {
            if (!preciosPorSuper.has(p.supermercado_id)) {
                preciosPorSuper.set(p.supermercado_id, new Map())
            }
            const mapa = preciosPorSuper.get(p.supermercado_id)!
            const existente = mapa.get(p.alimento_id)
            if (!existente || p.precio_por_kg < existente) {
                mapa.set(p.alimento_id, p.precio_por_kg)
            }
        }

        // Calcular total semanal en cada supermercado
        function calcularTotal(smId: string): number {
            const mapa = preciosPorSuper.get(smId)
            if (!mapa) return 0
            let total = 0
            for (const [alimentoId, gramos] of alimentosGramos) {
                const precioKg = mapa.get(alimentoId) ?? 0
                total += (gramos / 1000) * precioKg
            }
            return Math.round(total * 100) / 100
        }

        const totalBase = calcularTotal(smBase.id)
        const totalAhorro = calcularTotal(smAhorro.id)
        const difSemanal = totalBase - totalAhorro
        const diffPorcentual = totalBase > 0
            ? Math.round((difSemanal / totalBase) * 100 * 100) / 100
            : 0

        const resultado: ProyeccionAhorro = {
            semanal: Math.round(difSemanal * 100) / 100,
            mensual: Math.round(difSemanal * 4.33 * 100) / 100,
            anual: Math.round(difSemanal * 52 * 100) / 100,
            supermercado_base: smBase.nombre,
            supermercado_comparado: smAhorro.nombre,
            diferencia_porcentual: diffPorcentual,
        }

        return NextResponse.json(resultado)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Proyeccion] Error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
