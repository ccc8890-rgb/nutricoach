import { supabase } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Supermercado, PrecioActual, CosteAlimento, CosteComida, CostePorReceta, ProductoSupermercadoDetalle, OpcionEscandallo, EscandalloPlan, ResumenCostesPlan } from '@/types'

/**
 * Helper: si se pasa un cliente db (service_role), lo usa.
 * Si no, usa el cliente browser por defecto (anon key).
 */
function getClient(db?: SupabaseClient): SupabaseClient {
    return db ?? supabase
}

/**
 * Helper: ejecuta una query Supabase con paginación automática.
 * Supabase JS limita a 1.000 filas por defecto en .select().
 * Esta función itera en bloques de PAGE_SIZE hasta obtener todos los datos.
 */
const PAGE_SIZE = 1000

async function paginateQuery<T>(
    client: SupabaseClient,
    table: string,
    columns: string,
    filters?: (qb: any) => any,
    orderColumn?: string,
    orderAscending: boolean = true
): Promise<T[]> {
    const allData: T[] = []
    let desde = 0
    let hayMas = true

    while (hayMas) {
        let qb = client
            .from(table)
            .select(columns)

        if (filters) qb = filters(qb)

        if (orderColumn) {
            qb = qb.order(orderColumn, { ascending: orderAscending })
        }

        const { data, error } = await qb.range(desde, desde + PAGE_SIZE - 1)

        if (error) {
            console.error(`[paginateQuery] Error en ${table}:`, error.message)
            break
        }

        if (!data || data.length === 0) {
            hayMas = false
            break
        }

        allData.push(...(data as T[]))

        if (data.length < PAGE_SIZE) {
            hayMas = false
        } else {
            desde += PAGE_SIZE
        }
    }

    return allData
}

// ── Supermercados ─────────────────────────────────────────────

export async function obtenerSupermercados(db?: SupabaseClient): Promise<Supermercado[]> {
    const client = getClient(db)
    const { data } = await client
        .from('supermercados')
        .select('*')
        .eq('activo', true)
        .order('nombre')
    return data ?? []
}

export async function obtenerSupermercadoPorSlug(slug: string, db?: SupabaseClient): Promise<Supermercado | null> {
    const client = getClient(db)
    const { data } = await client
        .from('supermercados')
        .select('*')
        .eq('slug', slug)
        .single()
    return data
}

// ── Precios ───────────────────────────────────────────────────

/**
 * Obtiene todas las opciones de productos para un alimento en todos los supermercados.
 * Usa la vista mejores_precios_por_alimento que prioriza (1) preferido (2) más barato.
 */
export async function obtenerPreciosAlimento(alimentoId: string, db?: SupabaseClient): Promise<ProductoSupermercadoDetalle[]> {
    const client = getClient(db)
    // Filtrado por alimento_id: como cada alimento tiene unos ~12 supermercados,
    // esto siempre devuelve ≤ 12 filas. No necesita paginación.
    const { data } = await client
        .from('mejores_precios_por_alimento')
        .select('*')
        .eq('alimento_id', alimentoId)
        .order('precio_por_kg', { ascending: true })
    return data ?? []
}

export async function obtenerPreciosPorSupermercado(supermercadoId: string, db?: SupabaseClient): Promise<ProductoSupermercadoDetalle[]> {
    const client = getClient(db)
    // ⚠️ Un supermercado grande (Consum ~7.000 productos) puede devolver
    // >1.000 filas únicas (DISTINCT ON alimento_id). Usamos paginación.
    return paginateQuery<ProductoSupermercadoDetalle>(
        client,
        'mejores_precios_por_alimento',
        '*',
        (qb) => qb.eq('supermercado_id', supermercadoId),
        'alimento_categoria',
        true
    )
}

export async function obtenerTodosLosPrecios(db?: SupabaseClient): Promise<ProductoSupermercadoDetalle[]> {
    const client = getClient(db)
    // ⚠️ Esta vista contiene TODOS los precios de todos los supermercados.
    // Fácilmente >10.000 filas. Usamos paginación obligatoria.
    return paginateQuery<ProductoSupermercadoDetalle>(
        client,
        'mejores_precios_por_alimento',
        '*',
        undefined,
        'supermercado_nombre',
        true
    )
}

/**
 * Guarda un precio manualmente. Si el producto ya existe (mismo URL en mismo supermercado),
 * lo actualiza. Si no, inserta uno nuevo (permitiendo múltiples productos por alimento).
 */
export async function guardarPrecio(params: {
    supermercado_id: string
    alimento_id: string
    precio_por_kg: number
    precio_unidad?: number
    url_producto?: string
}, db?: SupabaseClient): Promise<boolean> {
    const client = getClient(db)
    const payload: Record<string, unknown> = {
        supermercado_id: params.supermercado_id,
        alimento_id: params.alimento_id,
        precio_por_kg: params.precio_por_kg,
        precio_unidad: params.precio_unidad || null,
        url_producto: params.url_producto || null,
        fecha_precio: new Date().toISOString().split('T')[0],
    }

    // Si tiene URL, upsert por URL; si no, insert directo
    if (params.url_producto) {
        const { error } = await client.from('productos_supermercado').upsert(payload, {
            onConflict: 'supermercado_id, url_producto',
        })
        return !error
    } else {
        const { error } = await client.from('productos_supermercado').insert(payload)
        return !error
    }
}

export async function eliminarPrecio(id: string, db?: SupabaseClient): Promise<boolean> {
    const client = getClient(db)
    const { error } = await client.from('productos_supermercado').delete().eq('id', id)
    return !error
}

// ── Favoritos / Preferidos ───────────────────────────────────

/**
 * Marca un producto como preferido para su alimento.
 * Desmarca cualquier otro preferido del mismo alimento en el mismo supermercado.
 */
export async function marcarProductoPreferido(productoId: string, alimentoId: string, supermercadoId: string, db?: SupabaseClient): Promise<boolean> {
    const client = getClient(db)
    // Desmarcar todos los preferidos de este alimento en este supermercado
    const { error: unmarkError } = await client
        .from('productos_supermercado')
        .update({ preferido: false })
        .eq('alimento_id', alimentoId)
        .eq('supermercado_id', supermercadoId)

    if (unmarkError) return false

    // Marcar el seleccionado
    const { error: markError } = await client
        .from('productos_supermercado')
        .update({ preferido: true })
        .eq('id', productoId)

    return !markError
}

// ── Cálculo de Costes ─────────────────────────────────────────

/**
 * Mapa de categorías de alimentos a su % de merma típico en hostelería.
 * Basado en estándares del sector HORECA.
 * - Carnes: 15-25% (recortes, cocción)
 * - Pescados: 20-30% (espinas, piel, cocción)
 * - Verduras/Hortalizas: 10-20% (piel, recortes)
 * - Frutas: 10-15%
 * - Huevos/Lácteos: 0-5% (merma mínima)
 * - Cereales/Legumbres secas: 0% (se pesan secos, absorción al cocer)
 * - Pan/Bollería: 0-5%
 * - Congelados/Enlatados: 0% (ya procesados)
 */
const MERMA_POR_CATEGORIA: Record<string, number> = {
    'Carnes': 20,
    'Carne': 20,
    'Carnes y derivados': 20,
    'Cerdo': 20,
    'Ternera': 20,
    'Pollo': 15,
    'Aves': 15,
    'Pescados': 25,
    'Pescado': 25,
    'Pescados y mariscos': 25,
    'Mariscos': 20,
    'Marisco': 20,
    'Verduras': 15,
    'Verdura': 15,
    'Hortalizas': 15,
    'Verduras y hortalizas': 15,
    'Frutas': 12,
    'Fruta': 12,
    'Huevos': 3,
    'Lácteos': 3,
    'Lacteos': 3,
    'Leche y derivados': 3,
    'Quesos': 3,
    'Queso': 3,
    'Legumbres': 0,
    'Legumbre': 0,
    'Cereales': 0,
    'Cereal': 0,
    'Arroz': 0,
    'Pastas': 0,
    'Pasta': 0,
    'Pan': 3,
    'Bollería': 3,
    'Bolleria': 3,
    'Congelados': 0,
    'Enlatados': 0,
    'Conservas': 0,
    'Aceites y grasas': 0,
    'Aceite': 0,
    'Especias': 0,
    'Salsas': 3,
    'Bebidas': 0,
    'Infusiones': 0,
    'Suplementos': 0,
}

/** IVA estándar para alimentación en España (10% reducido) */
const IVA_ALIMENTACION = 10

/**
 * Calcula el % de merma estimado para una categoría de alimento.
 */
function obtenerMermaPct(categoria?: string): number {
    if (!categoria) return 0
    return MERMA_POR_CATEGORIA[categoria] ?? 0
}

/**
 * Calcula el coste con merma: coste_sin_merma / (1 - merma_pct/100)
 * Si merma_pct es 0, devuelve el mismo coste.
 */
function aplicarMerma(coste: number, mermaPct: number): number {
    if (mermaPct <= 0) return coste
    return coste / (1 - mermaPct / 100)
}

/**
 * Calcula el precio de venta recomendado a partir del coste con merma,
 * aplicando un margen de beneficio.
 * margen: porcentaje de beneficio sobre el coste (ej: 30 = 30%)
 */
function calcularPrecioVenta(costeConMerma: number, margenPct: number, ivaPct: number = IVA_ALIMENTACION): { sin_iva: number; con_iva: number } {
    const sinIva = costeConMerma * (1 + margenPct / 100)
    const conIva = sinIva * (1 + ivaPct / 100)
    return { sin_iva: Math.round(sinIva * 100) / 100, con_iva: Math.round(conIva * 100) / 100 }
}

/**
 * Calcula el coste total de un array de comidas (plan semanal)
 * usando los mejores precios del supermercado seleccionado.
 *
 * Si se pasa db (service_role), usa ese cliente para saltarse RLS
 * y obtener TODOS los precios reales.
 *
 * Usa la vista mejores_precios_por_alimento que para cada alimento
 * devuelve el producto preferido (o el más barato si no hay preferido).
 *
 * @param comidas - Array de comidas con sus alimentos
 * @param supermercadoId - Supermercado para buscar precios
 * @param opciones - Opciones de cálculo profesional:
 *   - margen_beneficio_pct: Margen de beneficio sobre coste (ej: 30 = +30%)
 *   - iva_pct: IVA aplicable (default: 10% para alimentación)
 *   - porciones: Número de porciones/raciones del plan
 * @param db - Cliente Supabase opcional (service_role)
 */
export async function calcularCostePlan(
    comidas: { id?: string; nombre?: string; alimentos?: { alimento?: { id?: string; nombre?: string; categoria?: string }; cantidad_gramos?: number }[] }[],
    supermercadoId: string | null,
    opciones?: {
        margen_beneficio_pct?: number
        iva_pct?: number
        porciones?: number
    },
    db?: SupabaseClient
): Promise<ResumenCostesPlan> {
    if (!supermercadoId) {
        return {
            supermercado_seleccionado: null,
            precio_total: 0,
            precio_total_con_merma: 0,
            alimentos: [],
            coste_por_comida: [],
        }
    }

    const client = getClient(db)
    const margenPct = opciones?.margen_beneficio_pct ?? 0
    const ivaPct = opciones?.iva_pct ?? IVA_ALIMENTACION
    const porciones = opciones?.porciones ?? 1

    // Obtener mejor precio de cada alimento en este supermercado
    // ⚠️ Un supermercado grande puede tener >1.000 productos únicos (DISTINCT ON alimento_id).
    // Usamos paginación automática para obtenerlos todos.
    const precios = await paginateQuery<any>(
        client,
        'mejores_precios_por_alimento',
        '*',
        (qb) => qb.eq('supermercado_id', supermercadoId),
        'alimento_categoria',
        true
    )

    const mapaPrecios = new Map<string, number>()
    if (precios) {
        for (const p of precios) {
            const actual = mapaPrecios.get(p.alimento_id) ?? Infinity
            if (p.precio_por_kg < actual) {
                mapaPrecios.set(p.alimento_id, p.precio_por_kg)
            }
        }
    }

    // Acumular alimentos globalmente
    const mapaGlobal = new Map<string, {
        alimento_id: string
        alimento_nombre: string
        categoria: string
        cantidad_total_gramos: number
        precio_por_kg: number
        merma_pct: number
    }>()

    // Acumular por comida
    const costePorComida: CostePorReceta[] = []

    for (const comida of comidas) {
        const alimentosComida: CosteComida[] = []
        let costeComidaTotal = 0
        let costeComidaConMerma = 0

        for (const ca of comida.alimentos ?? []) {
            if (!ca.alimento?.nombre) continue
            const a = ca.alimento
            const id = a.id ?? ''
            const gramos = ca.cantidad_gramos ?? 0
            const precioKg = mapaPrecios.get(id) ?? 0
            const coste = (gramos / 1000) * precioKg
            const mermaPct = obtenerMermaPct(a.categoria)
            const costeConMerma = aplicarMerma(coste, mermaPct)

            alimentosComida.push({
                alimento_id: id,
                alimento_nombre: a.nombre ?? '',
                cantidad_gramos: gramos,
                precio_por_kg: precioKg,
                coste_euros: Math.round(coste * 100) / 100,
                merma_pct: mermaPct,
                coste_con_merma: Math.round(costeConMerma * 100) / 100,
            })

            costeComidaTotal += coste
            costeComidaConMerma += costeConMerma

            // Acumular global
            if (mapaGlobal.has(id)) {
                const g = mapaGlobal.get(id)!
                g.cantidad_total_gramos += gramos
            } else {
                mapaGlobal.set(id, {
                    alimento_id: id,
                    alimento_nombre: a.nombre ?? '',
                    categoria: a.categoria || 'Otros',
                    cantidad_total_gramos: gramos,
                    precio_por_kg: precioKg,
                    merma_pct: mermaPct,
                })
            }
        }

        if (alimentosComida.length > 0) {
            costePorComida.push({
                comida_nombre: comida.nombre ?? 'Comida',
                coste_total: Math.round(costeComidaTotal * 100) / 100,
                coste_total_con_merma: Math.round(costeComidaConMerma * 100) / 100,
                alimentos: alimentosComida,
            })
        }
    }

    // Calcular alimentos agregados con merma
    const alimentos = Array.from(mapaGlobal.values()).map(a => {
        const costeTotal = (a.cantidad_total_gramos / 1000) * a.precio_por_kg
        const costeConMerma = aplicarMerma(costeTotal, a.merma_pct)
        const costePorPorcion = costeTotal / porciones
        return {
            alimento_id: a.alimento_id,
            alimento_nombre: a.alimento_nombre,
            categoria: a.categoria,
            cantidad_total_gramos: a.cantidad_total_gramos,
            precio_por_kg: a.precio_por_kg,
            coste_total_euros: Math.round(costeTotal * 100) / 100,
            merma_pct: a.merma_pct,
            coste_con_merma: Math.round(costeConMerma * 100) / 100,
            coste_por_porcion: Math.round(costePorPorcion * 100) / 100,
        }
    })

    const precioTotal = alimentos.reduce((sum, a) => sum + a.coste_total_euros, 0)
    const precioTotalConMerma = alimentos.reduce((sum, a) => sum + (a.coste_con_merma ?? a.coste_total_euros), 0)
    const mermaMedia = precioTotal > 0
        ? Math.round(((precioTotalConMerma - precioTotal) / precioTotal) * 100 * 100) / 100
        : 0

    // Calcular precios de venta profesionales
    const venta = margenPct > 0
        ? calcularPrecioVenta(precioTotalConMerma, margenPct, ivaPct)
        : undefined

    const result: ResumenCostesPlan = {
        supermercado_seleccionado: null,
        precio_total: Math.round(precioTotal * 100) / 100,
        precio_total_con_merma: Math.round(precioTotalConMerma * 100) / 100,
        coste_por_porcion: Math.round((precioTotal / porciones) * 100) / 100,
        merma_media_pct: mermaMedia,
        alimentos,
        coste_por_comida: costePorComida,
    }

    if (venta) {
        result.precio_venta_sin_iva = venta.sin_iva
        result.precio_venta_con_iva = venta.con_iva
        result.margen_beneficio_pct = margenPct
        result.beneficio_neto = Math.round((venta.sin_iva - precioTotalConMerma) * 100) / 100
    }

    return result
}

// ── Escandallo con Alternativas (multi-producto) ──────────────

/**
 * Calcula el escandallo de un plan incluyendo todas las alternativas
 * de producto para cada alimento, permitiendo al coach comparar y elegir.
 *
 * Si se pasa db (service_role), usa ese cliente para saltarse RLS
 * y obtener TODOS los productos reales de todos los supermercados.
 *
 * Para cada alimento del plan, obtiene:
 * - El producto seleccionado (preferido o más barato)
 * - Alternativas en otros supermercados / productos
 * - Ahorro potencial si se escoge la opción más barata global
 */
export async function calcularEscandalloConAlternativas(
    comidas: { id?: string; nombre?: string; alimentos?: { alimento?: { id?: string; nombre?: string; categoria?: string }; cantidad_gramos?: number }[] }[],
    supermercadoId: string | null,
    db?: SupabaseClient
): Promise<EscandalloPlan> {
    if (!supermercadoId) {
        return { precio_total: 0, alimentos: [], ahorro_potencial: 0 }
    }

    const client = getClient(db)

    // 1. Obtener el mejor precio de cada alimento en el supermercado seleccionado
    // ⚠️ Un supermercado grande puede tener >1.000 productos únicos. Paginación automática.
    const mejoresPrecios = await paginateQuery<any>(
        client,
        'mejores_precios_por_alimento',
        '*',
        (qb) => qb.eq('supermercado_id', supermercadoId),
        'alimento_categoria',
        true
    )

    const mapaMejores = new Map<string, ProductoSupermercadoDetalle>()
    if (mejoresPrecios) {
        for (const p of mejoresPrecios) {
            const actual = mapaMejores.get(p.alimento_id)
            if (!actual || p.precio_por_kg < actual.precio_por_kg) {
                mapaMejores.set(p.alimento_id, p as ProductoSupermercadoDetalle)
            }
        }
    }

    // 2. Obtener TODOS los productos de cada alimento (para alternativas)
    const todosAlimentoIds = new Set<string>()
    for (const comida of comidas) {
        for (const ca of comida.alimentos ?? []) {
            if (ca.alimento?.id) todosAlimentoIds.add(ca.alimento.id)
        }
    }

    const { data: todosProductos } = await client
        .from('productos_supermercado')
        .select(`
            id,
            supermercado_id,
            alimento_id,
            precio_por_kg,
            nombre_original,
            marca,
            preferido,
            supermercados!inner(nombre, slug, color)
        `)
        .in('alimento_id', Array.from(todosAlimentoIds))
        .order('precio_por_kg', { ascending: true })

    // Agrupar productos por alimento_id
    const productosPorAlimento = new Map<string, any[]>()
    for (const p of todosProductos ?? []) {
        const arr = productosPorAlimento.get(p.alimento_id) || []
        arr.push(p)
        productosPorAlimento.set(p.alimento_id, arr)
    }

    // 3. Construir alimentos de salida
    const alimentosEscandallo: OpcionEscandallo[] = []
    let precioTotal = 0
    let sumaMasBaratos = 0

    for (const comida of comidas) {
        for (const ca of comida.alimentos ?? []) {
            if (!ca.alimento?.id || !ca.alimento?.nombre) continue
            const alimentoId = ca.alimento.id
            const alimentoNombre = ca.alimento.nombre
            const categoria = ca.alimento.categoria || 'Otros'
            const gramos = ca.cantidad_gramos ?? 0
            if (gramos === 0) continue

            // Producto seleccionado (mejor precio en supermercado elegido)
            const seleccionado = mapaMejores.get(alimentoId)
            const precioKg = seleccionado?.precio_por_kg ?? 0
            const coste = (gramos / 1000) * precioKg
            precioTotal += coste

            // Alternativas: todos los productos de este alimento
            const productos = productosPorAlimento.get(alimentoId) ?? []
            const alternativas = productos.map((p: any) => ({
                id: p.id,
                supermercado_nombre: p.supermercados?.nombre || '',
                precio_por_kg: p.precio_por_kg,
                es_preferido: p.preferido === true,
            }))
            // Quitar duplicados de mismo supermercado (quedarse con el más barato)
            const unicas = new Map<string, typeof alternativas[0]>()
            for (const alt of alternativas) {
                const existente = unicas.get(alt.supermercado_nombre)
                if (!existente || alt.precio_por_kg < existente.precio_por_kg) {
                    unicas.set(alt.supermercado_nombre, alt)
                }
            }
            const alternativasUnicas = Array.from(unicas.values())
                .sort((x, y) => x.precio_por_kg - y.precio_por_kg)

            // Calcular el más barato global para ahorro potencial
            const masBaratoGlobal = alternativasUnicas[0]
            const costeMasBarato = masBaratoGlobal
                ? (gramos / 1000) * masBaratoGlobal.precio_por_kg
                : coste
            sumaMasBaratos += costeMasBarato

            alimentosEscandallo.push({
                alimento_id: alimentoId,
                alimento_nombre: alimentoNombre,
                categoria: categoria,
                cantidad_gramos: gramos,
                producto_seleccionado: {
                    id: seleccionado?.id || '',
                    nombre_original: seleccionado?.nombre_original,
                    supermercado_nombre: seleccionado?.supermercado_nombre || '',
                    precio_por_kg: precioKg,
                },
                coste_euros: Math.round(coste * 100) / 100,
                alternativas: alternativasUnicas,
            })
        }
    }

    // 4. Determinar supermercado base (el que más aparece como preferido)
    const conteoSuper = new Map<string, number>()
    for (const al of alimentosEscandallo) {
        const nombre = al.producto_seleccionado.supermercado_nombre
        conteoSuper.set(nombre, (conteoSuper.get(nombre) || 0) + 1)
    }
    let superBase = ''
    let maxCount = 0
    for (const [nombre, count] of conteoSuper) {
        if (count > maxCount) {
            maxCount = count
            superBase = nombre
        }
    }

    return {
        precio_total: Math.round(precioTotal * 100) / 100,
        supermercado_base: superBase || undefined,
        alimentos: alimentosEscandallo,
        ahorro_potencial: Math.round((precioTotal - sumaMasBaratos) * 100) / 100,
    }
}
