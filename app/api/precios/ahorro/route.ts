import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import type { ComparativaSupermercados } from '@/types'

/**
 * POST /api/precios/ahorro
 *
 * Calcula la comparativa completa de precios de un plan de nutrición
 * en todos los supermercados disponibles.
 *
 * Body: { cliente_id: string } o { plan_id: string }
 *
 * Devuelve ComparativaSupermercados con:
 * - precio_total por supermercado
 * - ahorro mensual/anual
 * - desglose por alimento
 * - recomendación del más barato
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Autenticación
        const authSupabase = createApiSupabase(request)
        const { data: { user } } = await authSupabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const srv = createServiceSupabase()

        // 2. Obtener body
        const { cliente_id, plan_id: planIdDirecto } = await request.json()
        if (!cliente_id && !planIdDirecto) {
            return NextResponse.json({ error: 'cliente_id o plan_id es requerido' }, { status: 400 })
        }

        // 3. Obtener plan
        let planId = planIdDirecto
        if (cliente_id && !planId) {
            const { data: plan } = await srv
                .from('planes_nutricion')
                .select('id')
                .eq('cliente_id', cliente_id)
                .eq('activo', true)
                .single()
            if (!plan) {
                return NextResponse.json({ error: 'Cliente sin plan activo' }, { status: 404 })
            }
            planId = plan.id
        }

        // 4. Obtener comidas del plan
        const { data: comidas } = await srv
            .from('comidas')
            .select('*, comida_alimentos(*, alimentos(*))')
            .eq('plan_id', planId)

        if (!comidas || comidas.length === 0) {
            return NextResponse.json({ error: 'El plan no tiene comidas' }, { status: 404 })
        }

        // Extraer todos los alimento_id únicos y sus cantidades totales
        const alimentosDelPlan = new Map<string, {
            nombre: string
            categoria: string
            gramos_total: number
        }>()
        for (const comida of comidas) {
            for (const ca of (comida as any).comida_alimentos || []) {
                const id = ca.alimento_id
                const gramos = ca.cantidad_gramos || 0
                if (alimentosDelPlan.has(id)) {
                    alimentosDelPlan.get(id)!.gramos_total += gramos
                } else {
                    alimentosDelPlan.set(id, {
                        nombre: ca.alimentos?.nombre || '',
                        categoria: ca.alimentos?.categoria || 'Otros',
                        gramos_total: gramos,
                    })
                }
            }
        }

        const alimentoIds = Array.from(alimentosDelPlan.keys())

        // 5. Obtener supermercados activos
        const { data: supermercados } = await srv
            .from('supermercados')
            .select('*')
            .eq('activo', true)

        if (!supermercados || supermercados.length === 0) {
            return NextResponse.json({ error: 'No hay supermercados activos' }, { status: 404 })
        }

        // 6. Obtener precios de todos los supermercados para estos alimentos
        const { data: precios } = await srv
            .from('productos_supermercado')
            .select(`
                supermercado_id,
                alimento_id,
                precio_por_kg
            `)
            .in('alimento_id', alimentoIds)

        // Mapa: supermercado_id → { alimento_id → precio_por_kg (más barato) }
        const preciosPorSuper = new Map<string, Map<string, number>>()
        for (const p of precios ?? []) {
            const smId = p.supermercado_id
            const alId = p.alimento_id
            const precio = p.precio_por_kg
            if (!preciosPorSuper.has(smId)) {
                preciosPorSuper.set(smId, new Map())
            }
            const mapa = preciosPorSuper.get(smId)!
            const existente = mapa.get(alId)
            if (!existente || precio < existente) {
                mapa.set(alId, precio)
            }
        }

        // 7. Calcular coste total por supermercado y desglose
        const resultadosSuper: {
            id: string
            nombre: string
            color: string
            precio_total: number
        }[] = []

        // Desglose: para cada alimento, precios en todos los supers
        const desglose: {
            alimento_id: string
            alimento_nombre: string
            precios: { supermercado_id: string; precio: number }[]
            mas_barato: string
            precio_mas_barato: number
        }[] = []

        for (const [alimentoId, info] of alimentosDelPlan) {
            const entry = {
                alimento_id: alimentoId,
                alimento_nombre: info.nombre,
                precios: [] as { supermercado_id: string; precio: number }[],
                mas_barato: '',
                precio_mas_barato: Infinity,
            }

            for (const sm of supermercados) {
                const mapa = preciosPorSuper.get(sm.id)
                const precioKg = mapa?.get(alimentoId) ?? 0
                entry.precios.push({
                    supermercado_id: sm.id,
                    precio: precioKg,
                })
                if (precioKg > 0 && precioKg < entry.precio_mas_barato) {
                    entry.precio_mas_barato = precioKg
                    entry.mas_barato = sm.id  // ← usar UUID, no nombre
                }
            }

            desglose.push(entry)
        }

        // Calcular total por supermercado
        for (const sm of supermercados) {
            const mapa = preciosPorSuper.get(sm.id)
            let total = 0
            for (const [alimentoId, info] of alimentosDelPlan) {
                const precioKg = mapa?.get(alimentoId) ?? 0
                total += (info.gramos_total / 1000) * precioKg
            }
            resultadosSuper.push({
                id: sm.id,
                nombre: sm.nombre,
                color: sm.color || '#16A34A',
                precio_total: Math.round(total * 100) / 100,
            })
        }

        // Ordenar de más barato a más caro
        resultadosSuper.sort((a, b) => a.precio_total - b.precio_total)

        // 8. Construir respuesta
        const masBarato = resultadosSuper[0]
        const masCaro = resultadosSuper[resultadosSuper.length - 1]

        const supermercadosComparativa = resultadosSuper.map(sm => ({
            id: sm.id,
            nombre: sm.nombre,
            color: sm.color,
            precio_total: sm.precio_total,
            dif_respecto_barato: Math.round((sm.precio_total - masBarato.precio_total) * 100) / 100,
            es_mas_barato: sm.id === masBarato.id,
        }))

        // Ahorro mensual (x4.33 semanas) y anual (x52 semanas)
        const difSemanal = masCaro.precio_total - masBarato.precio_total
        const ahorroMensual = Math.round(difSemanal * 4.33 * 100) / 100
        const ahorroAnual = Math.round(difSemanal * 52 * 100) / 100

        return NextResponse.json({
            supermercados: supermercadosComparativa,
            ahorro_semanal: Math.round(difSemanal * 100) / 100,
            ahorro_mensual: ahorroMensual,
            ahorro_anual: ahorroAnual,
            recomendado: masBarato.nombre,
            desglose,
        } satisfies ComparativaSupermercados)

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Ahorro] Error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
