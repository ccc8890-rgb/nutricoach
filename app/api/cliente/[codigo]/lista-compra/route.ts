import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import {
    calcularOptimizacionMultiSuper,
    calcularProyeccionAnual,
    construirMensajeWhatsApp,
    detectarOfertas,
} from '@/lib/precios-smart-cart'
import {
    convertirGramosACompra,
    sugerirSustitutosEconomicos,
} from '@/lib/lista-compra/inteligente'
import { esIngredienteBasicoNoCompra, normalizarNombreCompra } from '@/lib/lista-compra/filtros'
import type { IngredienteSemanal, PrecioOpcion } from '@/types'

export interface ItemListaCompra {
    alimento_id: string
    alimento_ids?: string[]
    nombre: string
    categoria: string
    cantidad_gramos: number
    cantidad_compra?: string
    comidas_origen: string[]
}

function normalizarCompra(value: string | null | undefined) {
    return normalizarNombreCompra(value)
}

function esNoComestibleLista(nombre: string, categoria: string) {
    const text = `${normalizarCompra(nombre)} ${normalizarCompra(categoria)}`
    return /\b(cepillo|cepillos|dientes|dental|dentifrico|pasta dental|higiene|champu|gel ducha|desodorante|compresa|panal|pañal|toallita|mascota|arena gato|detergente|limpieza)\b/.test(text)
}

function canonicalItem(alimento: { id: string; nombre: string; categoria?: string | null }) {
    const nombre = normalizarCompra(alimento.nombre)
    if (/\b(huevo|huevos)\b/.test(nombre)) {
        return {
            key: 'canon:huevos',
            nombre: 'Huevos',
            categoria: 'Huevos',
        }
    }

    return {
        key: alimento.id,
        nombre: alimento.nombre,
        categoria: alimento.categoria ?? 'Otros',
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ codigo: string }> }
) {
    const { codigo } = await params
    const diaFiltro = new URL(request.url).searchParams.get('dia')
    const db = createServiceSupabase()

    const { data: plan } = await db
        .from('planes_nutricion')
        .select('id, nombre')
        .eq('codigo_publico', codigo)
        .eq('activo', true)
        .single()

    if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

    const { data: comidas } = await db
        .from('comidas')
        .select('nombre, dia_semana, comida_alimentos(cantidad_gramos, alimento:alimentos(id, nombre, categoria, es_generico))')
        .eq('plan_id', plan.id)

    const comidasFiltradas = diaFiltro
        ? (comidas ?? []).filter(comida => comida.dia_semana === diaFiltro)
        : (comidas ?? [])

    if (!comidasFiltradas.length) return NextResponse.json({ items: [] })

    // Agregar cantidades por alimento
    const mapa = new Map<string, ItemListaCompra>()
    for (const comida of comidasFiltradas) {
        const alimentos = comida.comida_alimentos as unknown as {
            cantidad_gramos: number
            alimento: { id: string; nombre: string; categoria: string; es_generico?: boolean } | null
        }[]
        for (const ca of alimentos ?? []) {
            if (!ca.alimento) continue
            const { id, nombre, categoria } = ca.alimento
            if (esIngredienteBasicoNoCompra(nombre)) continue
            if (esNoComestibleLista(nombre, categoria ?? '')) continue

            const canonical = canonicalItem({ id, nombre, categoria })
            if (mapa.has(canonical.key)) {
                const existing = mapa.get(canonical.key)!
                existing.cantidad_gramos += ca.cantidad_gramos
                existing.alimento_ids = Array.from(new Set([...(existing.alimento_ids ?? [existing.alimento_id]), id]))
                const origen = comida.dia_semana ? `${comida.dia_semana} · ${comida.nombre}` : comida.nombre
                if (!existing.comidas_origen.includes(origen)) {
                    existing.comidas_origen.push(origen)
                }
            } else {
                const origen = comida.dia_semana ? `${comida.dia_semana} · ${comida.nombre}` : comida.nombre
                mapa.set(canonical.key, {
                    alimento_id: id,
                    alimento_ids: [id],
                    nombre: canonical.nombre,
                    categoria: canonical.categoria,
                    cantidad_gramos: ca.cantidad_gramos,
                    comidas_origen: [origen],
                })
            }
        }
    }

    const items = Array.from(mapa.values()).sort((a, b) =>
        a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre)
    ).map(item => ({
        ...item,
        cantidad_gramos: Math.round(item.cantidad_gramos),
        cantidad_compra: convertirGramosACompra(item.cantidad_gramos, item.nombre),
    }))

    const alimentoIds = Array.from(new Set(items.flatMap(item => item.alimento_ids ?? [item.alimento_id])))
    const { data: preciosActuales } = await db
        .from('precios_actuales')
        .select('alimento_id, supermercado_id, supermercado_nombre, supermercado_slug, supermercado_color, precio_por_kg, url_producto')
        .in('alimento_id', alimentoIds)
        .gt('precio_por_kg', 0)

    const preciosPorAlimento = new Map<string, Array<{
        supermercado_id: string
        supermercado_nombre: string
        supermercado_slug: string
        supermercado_color?: string
        precio_por_kg: number
        url_producto?: string
    }>>()

    for (const precio of preciosActuales ?? []) {
        const arr = preciosPorAlimento.get(precio.alimento_id) ?? []
        arr.push({
            supermercado_id: precio.supermercado_id,
            supermercado_nombre: precio.supermercado_nombre,
            supermercado_slug: precio.supermercado_slug,
            supermercado_color: precio.supermercado_color,
            precio_por_kg: precio.precio_por_kg,
            url_producto: precio.url_producto,
        })
        preciosPorAlimento.set(precio.alimento_id, arr)
    }

    const ingredientes: IngredienteSemanal[] = items.map(item => {
        const ids = item.alimento_ids ?? [item.alimento_id]
        const preciosOrdenados = ids
            .flatMap(id => preciosPorAlimento.get(id) ?? [])
            .sort((a, b) => a.precio_por_kg - b.precio_por_kg)
        const precioMin = preciosOrdenados[0]?.precio_por_kg ?? null
        const precios: PrecioOpcion[] = preciosOrdenados.map(precio => ({
            supermercado_id: precio.supermercado_id,
            supermercado_nombre: precio.supermercado_nombre,
            supermercado_slug: precio.supermercado_slug,
            supermercado_color: precio.supermercado_color,
            precio_por_kg: precio.precio_por_kg,
            coste_euros: Math.round((item.cantidad_gramos / 1000) * precio.precio_por_kg * 100) / 100,
            url_producto: precio.url_producto,
            es_mas_barato: precio.precio_por_kg === precioMin,
        }))

        return {
            alimento_id: item.alimento_id,
            alimento_nombre: item.nombre,
            categoria: item.categoria,
            es_generico: false,
            cantidad_gramos_total: item.cantidad_gramos,
            recetas_origen: item.comidas_origen,
            precios,
            seleccion: null,
        }
    })

    const ingredientesConPrecio = ingredientes.filter(ing => ing.precios.length > 0)
    const optimizacion = ingredientesConPrecio.length
        ? calcularOptimizacionMultiSuper(ingredientesConPrecio)
        : null
    const ofertas = ingredientesConPrecio.length ? detectarOfertas(ingredientesConPrecio).slice(0, 8) : []
    const sustitutos_economicos = sugerirSustitutosEconomicos(ingredientesConPrecio).slice(0, 6)
    const costeTotalMasCaro = ingredientesConPrecio.reduce((total, ing) => {
        const caro = ing.precios[ing.precios.length - 1]
        return total + (caro?.coste_euros ?? 0)
    }, 0)
    const proyeccion_ahorro = optimizacion
        ? calcularProyeccionAnual(costeTotalMasCaro, optimizacion.coste_total_multi_super)
        : null
    const whatsapp = optimizacion
        ? construirMensajeWhatsApp(ingredientesConPrecio, optimizacion, plan.nombre)
        : null

    return NextResponse.json({
        items,
        ingredientes,
        optimizacion,
        ofertas,
        sustitutos_economicos,
        proyeccion_ahorro,
        whatsapp,
        coste_total: optimizacion?.coste_total_multi_super ?? 0,
        coste_diario_estimado: optimizacion
            ? Math.round((optimizacion.coste_total_multi_super / 7) * 100) / 100
            : 0,
    })
}
