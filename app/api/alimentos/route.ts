import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { esProductoNoComestible } from '@/lib/scraping/guard-no-comestible'
import { aplicarBusquedaNombre } from '@/lib/recetas/busqueda'
import { rankearParaSelector } from '@/lib/alimentos/ranking-selector'

/**
 * UNIFICADO: La lógica de "qué es no comestible" está únicamente en
 * lib/scraping/guard-no-comestible.ts (esProductoNoComestible).
 *
 * NO duplicar listas de stopwords aquí — mantener un solo punto de verdad.
 */

const sinTildes = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
// Categorías de producto elaborado: casi nunca es lo que se busca al añadir fruta, arroz o yogur a una comida
const CATEGORIAS_ELABORADAS = /bebida|condimento|dulce|boller|snack|platos preparados|suplemento/i

// Primero el alimento tal cual («Manzana»), luego los que empiezan por la palabra, luego los que la contienen;
// los productos elaborados (zumos, refrescos, bollería) quedan al final y los nombres cortos antes que los largos
function rankearGenericos<T extends { nombre: string | null; categoria?: string | null }>(filas: T[], q: string): T[] {
    const qn = sinTildes(q.trim())
    const puntuar = (a: T) => {
        const n = sinTildes(a.nombre ?? '')
        const tier = n === qn ? 0 : n.startsWith(qn) ? 1 : new RegExp(`\\b${qn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(n) ? 3 : 5
        return tier + (CATEGORIAS_ELABORADAS.test(a.categoria ?? '') ? 4 : 0) + Math.min(n.length, 80) / 100
    }
    return filas.map(a => ({ a, s: puntuar(a) })).sort((x, y) => x.s - y.s).slice(0, 12).map(x => x.a)
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createServiceSupabase()
        const { searchParams } = new URL(request.url)
        const q = searchParams.get('q') ?? ''
        const categoria = searchParams.get('categoria') ?? ''
        const custom = searchParams.get('custom')
        const fuente = searchParams.get('fuente') ?? ''
        const soloConDatos = searchParams.get('soloConDatos') === 'true'

        let query = supabase.from('alimentos').select('*', { count: 'exact' })
            .eq('es_comestible', true)  // ocultar no-comestibles

        if (q) {
            query = aplicarBusquedaNombre(query, q)
        }

        if (categoria) query = query.eq('categoria', categoria)
        if (custom === 'true') query = query.eq('custom', true)
        else if (custom === 'false') query = query.eq('custom', false)
        if (fuente) query = query.eq('fuente', fuente)

        if (soloConDatos) {
            query = query.gt('calorias', 0)
        }

        // selector=1: buscador para AÑADIR un alimento (editor de recetas, constructor de dietas): primero los alimentos base,
        // ordenados por «lo que es la palabra» y con las variantes de marca/envase agrupadas. Devuelve { items, hayMas }.
        // todo=1 amplía a todo el catálogo; sin la columna es_base (migración sin aplicar) busca en todo igualmente.
        if (searchParams.get('selector') === '1' && q.trim().length >= 2) {
            const todo = searchParams.get('todo') === '1'
            const VISIBLES = todo ? 40 : 5
            const consulta = (soloBase: boolean) => {
                let c = supabase.from('alimentos').select('id, nombre, categoria, fuente, calorias, proteinas, carbohidratos, grasas, fibra' + (soloBase ? ', es_base' : '')).eq('es_comestible', true)
                c = aplicarBusquedaNombre(c, q)
                if (searchParams.get('soloConDatos') === 'true') c = c.gt('calorias', 0)
                return soloBase ? c.eq('es_base', true).limit(300) : c.limit(600)
            }
            const limpiar = (filas: any[] | null) => (filas ?? []).filter(a => a.nombre && !esProductoNoComestible(a.nombre))
            const base = await consulta(true)
            const hayColumna = !base.error
            let candidatos: any[] = hayColumna ? limpiar(base.data) : []
            const rankBase = rankearParaSelector(candidatos, q)
            // el resto del catálogo solo si se pide, si falta la columna o si la base da muy pocas opciones
            let hayMasQueBase = false
            if (todo || !hayColumna || rankBase.length < 3) {
                const resto = limpiar((await consulta(false)).data).filter(a => !candidatos.some(c => c.id === a.id)).map(a => ({ ...a, es_base: false }))
                candidatos = [...candidatos, ...resto]
            } else {
                // ¿hay más fuera de la base? (solo para ofrecer «ver más»)
                const { count: total } = await aplicarBusquedaNombre(supabase.from('alimentos').select('id', { count: 'exact', head: true }).eq('es_comestible', true), q)
                hayMasQueBase = (total ?? 0) > candidatos.length
            }
            const ranked = rankearParaSelector(candidatos, q)
            return NextResponse.json({ items: ranked.slice(0, VISIBLES), hayMas: ranked.length > VISIBLES || hayMasQueBase })
        }

        // generico=1: búsqueda acotada para añadir un alimento a una comida (la fruta, no «bebida sabor a …»)
        const generico = searchParams.get('generico') === '1' && q.trim().length >= 2

        if (generico) {
            query = query.order("nombre", { ascending: true }).limit(500)
        } else if (q) {
            query = query.order("calorias", { ascending: false, nullsFirst: false })
            query = query.order("nombre", { ascending: true })
            query = query.limit(80)
        } else {
            query = query.order("categoria", { ascending: true })
            query = query.order("nombre", { ascending: true })
            query = query.limit(5000)
            const from = parseInt(searchParams.get("from") || "")
            const to = parseInt(searchParams.get("to") || "")
            if (!isNaN(from) && !isNaN(to)) {
                query = query.range(from, to)
            }
        }

        const { data, error, count } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })

        // 🛡️ Filtro post-query: delegado a guard-no-comestible.ts (único punto de verdad)
        const filtrados = (data ?? []).filter(a => {
            if (!a.nombre) return true
            return !esProductoNoComestible(a.nombre)
        })

        if (generico) return NextResponse.json(rankearGenericos(filtrados, q))

        const response = filtrados as typeof data
        return NextResponse.json(response)
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json()
        const { nombre, categoria, calorias, proteinas, carbohidratos, grasas, fibra, fuente, codigo_externo } = body

        if (!nombre || calorias === undefined) {
            return NextResponse.json({ error: 'nombre y calorias son obligatorios' }, { status: 400 })
        }

        // 🚫 Rechazar productos no comestibles (delegado a guard-no-comestible.ts — ÚNICO punto de verdad)
        if (esProductoNoComestible(nombre || '')) {
            return NextResponse.json({ error: 'Producto no comestible rechazado' }, { status: 400 })
        }

        // Evitar duplicados (mismo nombre normalizado y coach)
        const nombreNormalizado = nombre.trim()
        const { data: existentes } = await supabase
            .from('alimentos')
            .select('id')
            .eq('coach_id', user.id)
            .ilike('nombre', nombreNormalizado)

        if (existentes && existentes.length > 0) {
            return NextResponse.json({ id: existentes[0].id, duplicado: true })
        }

        const { data, error } = await supabase.from('alimentos').insert({
            nombre: nombreNormalizado,
            categoria: categoria ?? 'Supermercado',
            calorias,
            proteinas: proteinas ?? 0,
            carbohidratos: carbohidratos ?? 0,
            grasas: grasas ?? 0,
            fibra: fibra ?? 0,
            fuente: fuente ?? undefined,
            codigo_externo: codigo_externo ?? null,
            custom: true,
            coach_id: user.id,
        }).select().single()

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
    }
}
