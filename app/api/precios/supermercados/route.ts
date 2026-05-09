import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { SLUGS_SCRAPERS_DISPONIBLES } from '@/lib/scraping'

/**
 * GET /api/precios/supermercados
 * Devuelve la lista de supermercados activos con información adicional:
 * - tiene_scraper: boolean que indica si hay implementación de scraping
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

        // Añadir flag tiene_scraper basado en los módulos implementados
        const supermercadosConScraper = (supermercados ?? []).map(sm => ({
            ...sm,
            tiene_scraper: SLUGS_SCRAPERS_DISPONIBLES.includes(sm.slug),
        }))

        console.log(`[API /api/precios/supermercados] OK → ${supermercadosConScraper.length} supermercados (${SLUGS_SCRAPERS_DISPONIBLES.length} con scraper)`)
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
