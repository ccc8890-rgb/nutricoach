/**
 * API route: /api/precios/browser-agent
 * Browser Agent con Vercel AI SDK + Playwright para scraping inteligente
 */

import { NextRequest, NextResponse } from 'next/server'
import { browserAgentScrape } from '@/lib/browser-agent'
import { createApiSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { url, supermercado, marcasSugeridas } = body

        if (!url || !supermercado) {
            return NextResponse.json(
                { error: 'Faltan campos requeridos: url, supermercado' },
                { status: 400 }
            )
        }

        const supabase = createApiSupabase(request)

        // Verificar autenticación
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            )
        }

        const resultado = await browserAgentScrape(url, supermercado, marcasSugeridas)

        return NextResponse.json(resultado)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API BrowserAgent] Error:', msg)
        return NextResponse.json(
            { error: msg },
            { status: 500 }
        )
    }
}
