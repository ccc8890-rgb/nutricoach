// app/api/lista-compra/semanal/route.ts
/**
 * GET /api/lista-compra/semanal?plan_id=&semana_inicio=YYYY-MM-DD
 *
 * Devuelve ingredientes del plan agregados para la semana, con precios
 * de todos los supermercados y selecciones actuales del cliente.
 *
 * semana_inicio es opcional — si se omite, usa el lunes de la semana actual.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import type { IngredienteSemanal, PrecioOpcion, ResumenSupermercado } from '@/types'

function getLunesActual(): string {
    const hoy = new Date()
    const dia = hoy.getDay() // 0=dom, 1=lun, ...
    const diff = dia === 0 ? -6 : 1 - dia
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() + diff)
    return lunes.toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { searchParams } = new URL(request.url)
        const planId = searchParams.get('plan_id')
        const semanaInicio = searchParams.get('semana_inicio') || getLunesActual()

        if (!planId) {
            return NextResponse.json({ error: 'Falta plan_id' }, { status: 400 })
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const srv = createServiceSupabase()

        // 1. Obtener cliente_id del plan
        const { data: plan } = await srv
            .from('planes_nutricion')
            .select('id, cliente_id')
            .eq('id', planId)
            .single()

        if (!plan) {
            return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
        }

        // 2. Obtener todas las comidas del plan con sus alimentos
        const { data: comidas } = await srv
            .from('comidas')
            .select('nombre, comida_alimentos(cantidad_gramos, alimentos(id, nombre, categoria, es_generico))')
            .eq('plan_id', planId)

        if (!comidas || comidas.length === 0) {
            return NextResponse.json({
                plan_id: planId,
                semana_inicio: semanaInicio,
                ingredientes: [],
                resumen_por_supermercado: [],
                coste_total: 0,
                coste_total_mas_caro: 0,
            })
        }

        // 3. Agregar cantidades por alimento (sumar si aparece en varias comidas)
        const mapaAlimentos = new Map<string, {
            alimento_id: string
            alimento_nombre: string
            categoria: string
            es_generico: boolean
            cantidad_gramos_total: number
            recetas_origen: string[]
        }>()

        for (const comida of comidas) {
            for (const ca of (comida.comida_alimentos || []) as any[]) {
                const a = ca.alimentos
                if (!a) continue
                const existing = mapaAlimentos.get(a.id)
                if (existing) {
                    existing.cantidad_gramos_total += ca.cantidad_gramos || 0
                    if (!existing.recetas_origen.includes(comida.nombre)) {
                        existing.recetas_origen.push(comida.nombre)
                    }
                } else {
                    mapaAlimentos.set(a.id, {
                        alimento_id: a.id,
                        alimento_nombre: a.nombre,
                        categoria: a.categoria || 'Otros',
                        es_generico: a.es_generico ?? false,
                        cantidad_gramos_total: ca.cantidad_gramos || 0,
                        recetas_origen: [comida.nombre],
                    })
                }
            }
        }

        const alimentoIds = Array.from(mapaAlimentos.keys())

        // 4. Obtener todos los precios para estos alimentos en todos los supers
        const { data: todosPrecios } = await srv
            .from('precios_actuales')
            .select('alimento_id, supermercado_id, supermercado_nombre, supermercado_slug, supermercado_color, precio_por_kg, url_producto')
            .in('alimento_id', alimentoIds)

        // Mapa: alimento_id → [ precios por super ]
        const mapaPrecios = new Map<string, Array<{
            supermercado_id: string
            supermercado_nombre: string
            supermercado_slug: string
            supermercado_color?: string
            precio_por_kg: number
            url_producto?: string
        }>>()

        for (const p of todosPrecios || []) {
            const arr = mapaPrecios.get(p.alimento_id) || []
            arr.push({
                supermercado_id: p.supermercado_id,
                supermercado_nombre: p.supermercado_nombre,
                supermercado_slug: p.supermercado_slug,
                supermercado_color: p.supermercado_color,
                precio_por_kg: p.precio_por_kg,
                url_producto: p.url_producto,
            })
            mapaPrecios.set(p.alimento_id, arr)
        }

        // 5. Obtener selecciones actuales del cliente para este plan/semana
        const { data: selecciones } = await srv
            .from('selecciones_lista_compra')
            .select('*, supermercados(nombre, color)')
            .eq('plan_id', planId)
            .eq('semana_inicio', semanaInicio)

        const mapaSelecciones = new Map<string, any>()
        for (const s of selecciones || []) {
            mapaSelecciones.set(s.alimento_id, s)
        }

        // 6. Construir ingredientes con precios y selección
        const ingredientes: IngredienteSemanal[] = []

        for (const [, item] of mapaAlimentos) {
            const preciosRaw = mapaPrecios.get(item.alimento_id) || []
            const gramos = item.cantidad_gramos_total

            // Ordenar por precio ascendente y marcar el más barato
            const preciosOrdenados = [...preciosRaw].sort((a, b) => a.precio_por_kg - b.precio_por_kg)
            const precioMin = preciosOrdenados[0]?.precio_por_kg ?? null

            const precios: PrecioOpcion[] = preciosOrdenados.map(p => ({
                supermercado_id: p.supermercado_id,
                supermercado_nombre: p.supermercado_nombre,
                supermercado_slug: p.supermercado_slug,
                supermercado_color: p.supermercado_color,
                precio_por_kg: p.precio_por_kg,
                coste_euros: Math.round((gramos / 1000) * p.precio_por_kg * 100) / 100,
                url_producto: p.url_producto,
                es_mas_barato: p.precio_por_kg === precioMin,
            }))

            const selRaw = mapaSelecciones.get(item.alimento_id)
            const seleccion = selRaw ? {
                id: selRaw.id,
                cliente_id: plan.cliente_id,
                plan_id: planId,
                alimento_id: item.alimento_id,
                supermercado_id: selRaw.supermercado_id,
                supermercado_nombre: selRaw.supermercados?.nombre,
                producto_nombre: selRaw.producto_nombre,
                precio_por_kg: selRaw.precio_por_kg,
                url_producto: selRaw.url_producto,
                semana_inicio: semanaInicio,
                seleccionado_por: selRaw.seleccionado_por,
            } : null

            ingredientes.push({ ...item, precios, seleccion })
        }

        // Ordenar por categoría luego nombre
        ingredientes.sort((a, b) =>
            a.categoria.localeCompare(b.categoria) || a.alimento_nombre.localeCompare(b.alimento_nombre)
        )

        // 7. Calcular resumen por supermercado (basado en selecciones o más barato)
        const mapaResumen = new Map<string, { nombre: string; color?: string; ingredientes: string[]; coste: number }>()
        let costeTotal = 0
        let costeTotalMasCaro = 0

        for (const ing of ingredientes) {
            // Determinar qué supermercado aplica: selección del usuario o el más barato
            const precioAplicado = ing.seleccion
                ? ing.precios.find(p => p.supermercado_id === ing.seleccion?.supermercado_id)
                : ing.precios[0] // ya ordenado por precio

            if (precioAplicado) {
                costeTotal += precioAplicado.coste_euros
                const r = mapaResumen.get(precioAplicado.supermercado_id) || {
                    nombre: precioAplicado.supermercado_nombre,
                    color: precioAplicado.supermercado_color,
                    ingredientes: [],
                    coste: 0,
                }
                r.ingredientes.push(ing.alimento_nombre)
                r.coste += precioAplicado.coste_euros
                mapaResumen.set(precioAplicado.supermercado_id, r)
            }

            // Coste en el super más caro (último de la lista ordenada)
            const precioMasCaro = ing.precios[ing.precios.length - 1]
            if (precioMasCaro) costeTotalMasCaro += precioMasCaro.coste_euros
        }

        const resumen: ResumenSupermercado[] = Array.from(mapaResumen.entries()).map(([id, r]) => ({
            supermercado_id: id,
            supermercado_nombre: r.nombre,
            supermercado_color: r.color,
            ingredientes: r.ingredientes,
            coste_total: Math.round(r.coste * 100) / 100,
        })).sort((a, b) => b.coste_total - a.coste_total)

        return NextResponse.json({
            plan_id: planId,
            semana_inicio: semanaInicio,
            ingredientes,
            resumen_por_supermercado: resumen,
            coste_total: Math.round(costeTotal * 100) / 100,
            coste_total_mas_caro: Math.round(costeTotalMasCaro * 100) / 100,
        })

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Lista Semanal]', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
