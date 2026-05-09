/**
 * GET /api/precios/escandallo/receta?id=[receta_id]&supermercado_id=[opcional]
 *
 * Devuelve el coste desglosado de una receta:
 * - Coste total y por porción
 * - Coste por ingrediente en el supermercado elegido
 * - Comparativa de precios en todos los supermercados disponibles
 * - Mejor opción de supermercado (menor coste total)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { searchParams } = new URL(request.url)
        const recetaId = searchParams.get('id')
        const supermercadoId = searchParams.get('supermercado_id') || null

        if (!recetaId) {
            return NextResponse.json({ error: 'Falta id de receta' }, { status: 400 })
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const srv = createServiceSupabase()

        // 1. Receta con porciones
        const { data: receta } = await srv
            .from('recetas')
            .select('id, nombre, porciones')
            .eq('id', recetaId)
            .single()

        if (!receta) {
            return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })
        }

        const porciones = receta.porciones || 1

        // 2. Ingredientes con su alimento_id
        const { data: ingredientes } = await srv
            .from('receta_ingredientes')
            .select('alimento_id, cantidad_gramos, alimentos(id, nombre, categoria)')
            .eq('receta_id', recetaId)
            .gt('cantidad_gramos', 0)

        if (!ingredientes || ingredientes.length === 0) {
            return NextResponse.json({
                receta_id: recetaId,
                receta_nombre: receta.nombre,
                porciones,
                sin_ingredientes: true,
                ingredientes: [],
                coste_total: 0,
                coste_por_porcion: 0,
                comparativa_supermercados: [],
            })
        }

        const alimentoIds = ingredientes.map(i => i.alimento_id).filter(Boolean)

        // 3. Precios en TODOS los supermercados para estos alimentos
        const { data: todosPrecios } = await srv
            .from('precios_actuales')
            .select('alimento_id, supermercado_id, supermercado_nombre, supermercado_slug, supermercado_color, precio_por_kg, url_producto')
            .in('alimento_id', alimentoIds)

        // 4. Supermercados disponibles con precio completo
        const superIds = new Set(todosPrecios?.map(p => p.supermercado_id) || [])

        // Mapa: supermercado_id → { nombre, slug, color, precios: Map<alimento_id, precio_kg> }
        const mapaSuper = new Map<string, {
            id: string; nombre: string; slug: string; color: string
            precios: Map<string, number>
            urls: Map<string, string>
        }>()

        for (const p of todosPrecios || []) {
            if (!mapaSuper.has(p.supermercado_id)) {
                mapaSuper.set(p.supermercado_id, {
                    id: p.supermercado_id,
                    nombre: p.supermercado_nombre,
                    slug: p.supermercado_slug,
                    color: p.supermercado_color,
                    precios: new Map(),
                    urls: new Map(),
                })
            }
            mapaSuper.get(p.supermercado_id)!.precios.set(p.alimento_id, p.precio_por_kg)
            if (p.url_producto) {
                mapaSuper.get(p.supermercado_id)!.urls.set(p.alimento_id, p.url_producto)
            }
        }

        // 5. Calcular coste por ingrediente en el supermercado elegido (o el más barato si no se elige)
        const preciosSuper = supermercadoId ? mapaSuper.get(supermercadoId)?.precios : null

        const desglose = ingredientes.map(ing => {
            const a = ing.alimentos as any
            const gramos = ing.cantidad_gramos || 0

            // Precio en supermercado seleccionado
            let precioKg = preciosSuper?.get(ing.alimento_id) ?? 0

            // Si no hay supermercado elegido, usar el más barato disponible
            let superMasBarato: string | null = null
            let superMasBaratoNombre = ''
            let precioMasBarato = Infinity
            for (const [sid, sdata] of mapaSuper.entries()) {
                const p = sdata.precios.get(ing.alimento_id)
                if (p !== undefined && p < precioMasBarato) {
                    precioMasBarato = p
                    superMasBarato = sid
                    superMasBaratoNombre = sdata.nombre
                }
            }

            if (!supermercadoId && precioMasBarato !== Infinity) {
                precioKg = precioMasBarato
            }

            const coste = (gramos / 1000) * precioKg

            // Precios en todos los supermercados para este ingrediente
            const preciosComparativos = Array.from(mapaSuper.values())
                .map(s => ({
                    supermercado_id: s.id,
                    supermercado_nombre: s.nombre,
                    supermercado_slug: s.slug,
                    supermercado_color: s.color,
                    precio_por_kg: s.precios.get(ing.alimento_id) ?? null,
                    coste_euros: s.precios.has(ing.alimento_id)
                        ? Math.round((gramos / 1000) * s.precios.get(ing.alimento_id)! * 100) / 100
                        : null,
                    url_producto: s.urls.get(ing.alimento_id) || null,
                    es_mas_barato: s.id === superMasBarato,
                }))
                .filter(p => p.precio_por_kg !== null)
                .sort((a, b) => (a.precio_por_kg || 0) - (b.precio_por_kg || 0))

            return {
                alimento_id: ing.alimento_id,
                alimento_nombre: a?.nombre || '',
                categoria: a?.categoria || '',
                cantidad_gramos: gramos,
                precio_por_kg: Math.round(precioKg * 100) / 100,
                coste_euros: Math.round(coste * 100) / 100,
                coste_por_porcion: Math.round((coste / porciones) * 100) / 100,
                super_mas_barato: superMasBarato ? { id: superMasBarato, nombre: superMasBaratoNombre } : null,
                precios_comparativos: preciosComparativos,
            }
        })

        const costeTotal = desglose.reduce((s, i) => s + i.coste_euros, 0)

        // 6. Comparativa por supermercado (coste total de la receta en cada super)
        const comparativaSupers = Array.from(mapaSuper.values()).map(s => {
            let coste = 0
            let ingredientesSinPrecio = 0
            for (const ing of ingredientes) {
                const p = s.precios.get(ing.alimento_id)
                if (p !== undefined) {
                    coste += (ing.cantidad_gramos / 1000) * p
                } else {
                    ingredientesSinPrecio++
                }
            }
            return {
                supermercado_id: s.id,
                supermercado_nombre: s.nombre,
                supermercado_slug: s.slug,
                supermercado_color: s.color,
                coste_total: Math.round(coste * 100) / 100,
                coste_por_porcion: Math.round((coste / porciones) * 100) / 100,
                ingredientes_sin_precio: ingredientesSinPrecio,
                cobertura_pct: Math.round(((ingredientes.length - ingredientesSinPrecio) / ingredientes.length) * 100),
            }
        }).sort((a, b) => a.coste_total - b.coste_total)

        return NextResponse.json({
            receta_id: recetaId,
            receta_nombre: receta.nombre,
            porciones,
            supermercado_id: supermercadoId,
            coste_total: Math.round(costeTotal * 100) / 100,
            coste_por_porcion: Math.round((costeTotal / porciones) * 100) / 100,
            ingredientes: desglose,
            comparativa_supermercados: comparativaSupers,
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Escandallo Receta]', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
