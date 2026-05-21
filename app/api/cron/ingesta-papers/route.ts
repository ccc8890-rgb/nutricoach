import { NextResponse } from 'next/server'
import { ejecutarIngesta } from '@/lib/ingesta-papers'

/**
 * Cron semanal de ingesta de papers — Lunes 8:30 UTC
 *
 * Ejecuta el pipeline completo:
 *   1. PubMed E-utilities (8 fuentes) → PaperRaw[]
 *   2. DeepSeek reader → PaperExtraido[]
 *   3. Evaluador de calidad → PaperEvaluado[]
 *   4. Dedup → knowledge_base
 *
 * Protegido por CRON_SECRET (misma variable que el cron de recordatorios).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[cron/ingesta-papers] CRON_SECRET no configurado — ruta deshabilitada')
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    console.log('[cron/ingesta-papers] Iniciando ingesta semanal...')

    const resultado = await ejecutarIngesta()

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log(`[cron/ingesta-papers] Completado en ${elapsed}s`)
    console.log(`[cron/ingesta-papers]   Fuentes: ${resultado.fuentes_consultadas}`)
    console.log(`[cron/ingesta-papers]   Encontrados: ${resultado.papers_encontrados}`)
    console.log(`[cron/ingesta-papers]   Extraídos: ${resultado.papers_extraidos}`)
    console.log(`[cron/ingesta-papers]   Evaluados: ${resultado.papers_evaluados}`)
    console.log(`[cron/ingesta-papers]   Duplicados: ${resultado.papers_duplicados}`)
    console.log(`[cron/ingesta-papers]   Insertados: ${resultado.papers_insertados}`)
    console.log(`[cron/ingesta-papers]   Errores: ${resultado.errores.length}`)

    return NextResponse.json({
      ok: true,
      ...resultado,
      duracion_seg: elapsed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron/ingesta-papers] Error:', error)

    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      duracion_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
