/**
 * GET /api/compra
 *
 * Genera la lista de la compra con costes y supermercado óptimo.
 *
 * Parámetros:
 *   - recetas  JSON: [{ id, porciones }]
 *   - cliente_id  UUID (opcional) — usa el plan activo del cliente
 *   - supermercado_id  UUID (opcional) — '' = más barato automático
 *   - periodo  'diario' | 'semanal' | 'mensual'  (multiplica cantidades)
 *
 * Respuesta:
 *   { lista: LineaCompra[], coste_total, periodo }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

const MULTIPLICADOR: Record<string, number> = {
    diario: 1,
    semanal: 7,
    mensual: 30,
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { searchParams } = new URL(request.url)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const srv = createServiceSupabase()
        const supermercadoId = searchParams.get('supermercado_id') || null
        const periodo = searchParams.get('periodo') || 'semanal'
        const mult = MULTIPLICADOR[periodo] || 7

        // ── Acumular ingredientes por alimento_id ───────────────────
        const mapaIngredientes = new Map<string, {
            alimento_id: string
            alimento_nombre: string
            categoria: string
            cantidad_gramos: number
            recetas_origen: string[]
        }>()

        // 1. Desde recetas seleccionadas
        const recetasRaw = searchParams.get('recetas')
        if (recetasRaw) {
            const recetasSel = JSON.parse(recetasRaw) as { id: string; porciones: number }[]

            for (const { id: recetaId, porciones } of recetasSel) {
                const { data: receta } = await srv
                    .from('recetas')
                    .select('id, nombre, porciones')
                    .eq('id', recetaId)
                    .single()

                if (!receta) continue

                const { data: ings } = await srv
                    .from('receta_ingredientes')
                    .select('alimento_id, cantidad_gramos, alimentos(id, nombre, categoria)')
                    .eq('receta_id', recetaId)
                    .gt('cantidad_gramos', 0)

                if (!ings) continue

                const factorPorciones = porciones / (receta.porciones || 1)

                for (const ing of ings) {
                    const a = ing.alimentos as any
                    if (!a) continue
                    const gramos = (ing.cantidad_gramos || 0) * factorPorciones * mult

                    if (mapaIngredientes.has(ing.alimento_id)) {
                        const prev = mapaIngredientes.get(ing.alimento_id)!
                        prev.cantidad_gramos += gramos
                        if (!prev.recetas_origen.includes(receta.nombre)) {
                            prev.recetas_origen.push(receta.nombre)
                        }
                    } else {
                        mapaIngredientes.set(ing.alimento_id, {
                            alimento_id: ing.alimento_id,
                            alimento_nombre: a.nombre || '',
                            categoria: a.categoria || 'Otros',
                            cantidad_gramos: gramos,
                            recetas_origen: [receta.nombre],
                        })
                    }
                }
            }
        }

        // 2. Desde plan activo de un cliente
        const clienteId = searchParams.get('cliente_id')
        if (clienteId) {
            const { data: plan } = await srv
                .from('planes_nutricion')
                .select('id, nombre')
                .eq('cliente_id', clienteId)
                .eq('activo', true)
                .single()

            if (plan) {
                const { data: comidas } = await srv
                    .from('comidas')
                    .select('id, nombre, comida_alimentos(alimento_id, cantidad_gramos, alimentos(id, nombre, categoria))')
                    .eq('plan_id', plan.id)

                for (const comida of comidas || []) {
                    for (const ca of (comida.comida_alimentos as any[]) || []) {
                        const a = ca.alimentos
                        if (!a) continue
                        const gramos = (ca.cantidad_gramos || 0) * mult

                        if (mapaIngredientes.has(ca.alimento_id)) {
                            const prev = mapaIngredientes.get(ca.alimento_id)!
                            prev.cantidad_gramos += gramos
                            if (!prev.recetas_origen.includes(comida.nombre || plan.nombre)) {
                                prev.recetas_origen.push(comida.nombre || plan.nombre)
                            }
                        } else {
                            mapaIngredientes.set(ca.alimento_id, {
                                alimento_id: ca.alimento_id,
                                alimento_nombre: a.nombre || '',
                                categoria: a.categoria || 'Otros',
                                cantidad_gramos: gramos,
                                recetas_origen: [comida.nombre || plan.nombre],
                            })
                        }
                    }
                }
            }
        }

        if (mapaIngredientes.size === 0) {
            return NextResponse.json({ lista: [], coste_total: 0, periodo })
        }

        // ── Obtener precios ─────────────────────────────────────────
        const alimentoIds = Array.from(mapaIngredientes.keys())

        const { data: precios } = await srv
            .from('precios_actuales')
            .select('alimento_id, supermercado_id, supermercado_nombre, supermercado_slug, supermercado_color, precio_por_kg, url_producto')
            .in('alimento_id', alimentoIds)

        // Mapa: alimento_id → array de precios por super
        const mapaPrecio = new Map<string, typeof precios>()
        for (const p of precios || []) {
            if (!mapaPrecio.has(p.alimento_id)) mapaPrecio.set(p.alimento_id, [])
            mapaPrecio.get(p.alimento_id)!.push(p)
        }

        // ── Construir lista final ────────────────────────────────────
        const lista = Array.from(mapaIngredientes.values()).map(ing => {
            const preciosIng = mapaPrecio.get(ing.alimento_id) || []

            // Si hay supermercado seleccionado, usar ese precio
            let mejor = supermercadoId
                ? preciosIng.find(p => p.supermercado_id === supermercadoId) || null
                : null

            // Si no hay seleccionado o no hay precio en ese super, usar el más barato
            if (!mejor && preciosIng.length > 0) {
                mejor = preciosIng.reduce((min, p) =>
                    p.precio_por_kg < min.precio_por_kg ? p : min
                )
            }

            const precioKg = mejor?.precio_por_kg ?? 0
            const costeEuros = (ing.cantidad_gramos / 1000) * precioKg

            return {
                alimento_id: ing.alimento_id,
                alimento_nombre: ing.alimento_nombre,
                categoria: ing.categoria,
                cantidad_gramos: Math.round(ing.cantidad_gramos),
                recetas_origen: ing.recetas_origen,
                precio_por_kg: Math.round(precioKg * 100) / 100,
                coste_euros: Math.round(costeEuros * 100) / 100,
                super_id: mejor?.supermercado_id ?? null,
                super_nombre: mejor?.supermercado_nombre ?? null,
                super_color: mejor?.supermercado_color ?? null,
                super_slug: mejor?.supermercado_slug ?? null,
                url_producto: mejor?.url_producto ?? null,
            }
        }).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.alimento_nombre.localeCompare(b.alimento_nombre))

        const costeTotal = Math.round(lista.reduce((s, l) => s + l.coste_euros, 0) * 100) / 100

        return NextResponse.json({ lista, coste_total: costeTotal, periodo })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Compra]', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
