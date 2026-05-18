import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { SLUGS_SCRAPERS_DISPONIBLES } from '@/lib/scraping'

/**
 * GET /api/precios/supermercados
 * Devuelve la lista de supermercados activos con información adicional:
 * - tiene_scraper: boolean que indica si hay implementación de scraping
 * - total_productos: número de productos con precio registrado para ese supermercado
 *
 * Usa service_role key para bypass de RLS ya que son datos de catálogo público.
 */
export async function GET() {
    console.log('[API /api/precios/supermercados] Iniciando...')

    try {
        const supabase = createServiceSupabase()

        const { data: supermercados, error } = await supabase
            .from('supermercados')
            .select('*')
            .eq('activo', true)
            .order('nombre')

        if (error) {
            console.error('[API /api/precios/supermercados] Error de consulta:', error.message)
            return NextResponse.json(
                { error: 'Error al cargar supermercados', detalle: error.message },
                { status: 500 }
            )
        }

        // Obtener conteo EXACTO por supermercado usando count: 'exact' + head: true
        // IMPORTANTE: No podemos hacer un solo select('supermercado_id') porque Supabase
        // limita a 1000 filas por defecto, dando conteos incorrectos cuando hay muchos productos.
        // Con head: true obtenemos el count exacto sin transferir filas.
        const mapaConteos: Record<string, number> = {}
        for (const sm of supermercados ?? []) {
            const { count, error: countError } = await supabase
                .from('productos_supermercado')
                .select('*', { count: 'exact', head: true })
                .eq('supermercado_id', sm.id)

            if (countError) {
                console.warn(`[API] Error al contar productos para ${sm.nombre}: ${countError.message}`)
            }
            mapaConteos[sm.id] = count ?? 0
        }

        // Añadir flag tiene_scraper + total_productos basado en conteos reales
        const supermercadosConScraper = (supermercados ?? []).map(sm => ({
            ...sm,
            tiene_scraper: SLUGS_SCRAPERS_DISPONIBLES.includes(sm.slug),
            total_productos: mapaConteos[sm.id] ?? 0,
        }))

        // Log de diagnóstico
        for (const sm of supermercadosConScraper) {
            console.log(`  ${sm.nombre.padEnd(20)} → ${sm.total_productos} productos`)
        }
        console.log(`[API /api/precios/supermercados] OK → ${supermercadosConScraper.length} supermercados`)

        return NextResponse.json(supermercadosConScraper)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API /api/precios/supermercados] Excepción:', msg)
        return NextResponse.json(
            { error: 'Error interno', detalle: msg },
            { status: 500 }
        )
    }
}
