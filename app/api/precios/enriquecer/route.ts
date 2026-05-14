import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import {
    ejecutarEnriquecimientoCompleto,
    obtenerPendientesEnriquecer,
    obtenerStatsEnriquecimiento,
} from '@/lib/enriquecimiento-nutricional'

/**
 * POST /api/precios/enriquecer
 * Inicia el enriquecimiento nutricional por IA de los alimentos pendientes.
 * Body opcional: { limite?: number, stream?: boolean }
 * Si stream=true, devuelve SSE con progreso en tiempo real.
 */
export async function POST(request: NextRequest) {
    try {
        const authSupabase = createApiSupabase(request)
        const { data: { user } } = await authSupabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { data: profile } = await authSupabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'coach') {
            return NextResponse.json({ error: 'Solo el coach puede ejecutar enriquecimiento' }, { status: 403 })
        }

        const body = await request.json().catch(() => ({}))
        const limite = body.limite ?? 100
        const stream = body.stream === true

        const serviceSupabase = createServiceSupabase()

        if (stream) {
            // ── SSE: Progreso en tiempo real ──
            const encoder = new TextEncoder()
            const streamResult = new ReadableStream({
                async start(controller) {
                    try {
                        const resultado = await ejecutarEnriquecimientoCompleto(
                            serviceSupabase,
                            limite,
                            (procesados, total, actualizados, errores) => {
                                const data = JSON.stringify({
                                    tipo: 'progreso',
                                    procesados,
                                    total,
                                    actualizados,
                                    errores,
                                    porcentaje: Math.round((procesados / total) * 100),
                                })
                                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                            }
                        )

                        // Enviar resultado final
                        const finalData = JSON.stringify({ tipo: 'completado', ...resultado })
                        controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
                    } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err)
                        const errorData = JSON.stringify({ tipo: 'error', error: msg })
                        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
                    } finally {
                        controller.close()
                    }
                },
            })

            return new NextResponse(streamResult, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            })
        }

        // ── Sin streaming: respuesta normal ──
        const resultado = await ejecutarEnriquecimientoCompleto(serviceSupabase, limite)

        return NextResponse.json(resultado)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Enriquecer] Error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

/**
 * GET /api/precios/enriquecer
 * Obtiene estadísticas y lista de pendientes de enriquecimiento.
 */
export async function GET(request: NextRequest) {
    try {
        const authSupabase = createApiSupabase(request)
        const { data: { user } } = await authSupabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const serviceSupabase = createServiceSupabase()

        const url = new URL(request.url)
        const accion = url.searchParams.get('accion') || 'stats'

        if (accion === 'pendientes') {
            const limite = parseInt(url.searchParams.get('limite') || '50')
            const pendientes = await obtenerPendientesEnriquecer(serviceSupabase, limite)
            return NextResponse.json(pendientes)
        }

        const stats = await obtenerStatsEnriquecimiento(serviceSupabase)
        return NextResponse.json(stats)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Enriquecer Stats] Error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
