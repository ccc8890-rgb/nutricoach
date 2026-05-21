// ── API Route: Ingesta de Papers (trigger manual desde dashboard) ──
// POST /api/ingesta-papers
//
// Body opcional:
//   { "dryRun": true }          — simular sin insertar
//   { "skipExtraction": true }  — solo fetch PubMed (sin DeepSeek)
//   { "fuentesIds": ["pubmed-proteina-ejercicio"] } — fuentes específicas
//
// Protegida por API key en header: Authorization: Bearer INGESTA_API_KEY

import { NextRequest, NextResponse } from 'next/server'
import { ejecutarIngesta, FUENTES_PUBMED } from '@/lib/ingesta-papers'

export async function POST(request: NextRequest) {
  // ── Auth: API key simple ─────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  const expectedKey = process.env.INGESTA_API_KEY

  if (expectedKey) {
    const token = authHeader?.replace('Bearer ', '')
    if (!token || token !== expectedKey) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
  }

  // ── Parsear body ─────────────────────────────────────────────────
  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    // Body vacío o no JSON -> usar defaults
  }

  const dryRun = body.dryRun === true
  const skipExtraction = body.skipExtraction === true
  const fuentesIds = Array.isArray(body.fuentesIds) ? (body.fuentesIds as string[]) : undefined

  // ── Validar fuentes ──────────────────────────────────────────────
  if (fuentesIds) {
    const validIds = new Set(FUENTES_PUBMED.map(f => f.id))
    const invalid = fuentesIds.filter(id => !validIds.has(id))
    if (invalid.length > 0) {
      return NextResponse.json({
        error: `Fuentes inválidas: ${invalid.join(', ')}`,
        fuentes_disponibles: FUENTES_PUBMED.map(f => ({ id: f.id, nombre: f.nombre })),
      }, { status: 400 })
    }
  }

  // ── Validar DeepSeek key ─────────────────────────────────────────
  if (!skipExtraction && !process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({
      error: 'DEEPSEEK_API_KEY no configurada',
      hint: 'Usa skipExtraction=true si solo quieres fetch PubMed',
    }, { status: 500 })
  }

  // ── Ejecutar ingesta ─────────────────────────────────────────────
  const startTime = Date.now()

  try {
    const resultado = await ejecutarIngesta({
      fuentesIds,
      skipExtraction,
      dryRun,
    })

    const elapsed = Date.now() - startTime

    return NextResponse.json({
      ok: true,
      ...resultado,
      duracion_ms: elapsed,
      dry_run: dryRun,
      skip_extraction: skipExtraction,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido en el pipeline de ingesta',
      duracion_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

/**
 * GET /api/ingesta-papers — Información del endpoint
 */
export async function GET() {
  return NextResponse.json({
    name: '🧠 Ingesta de Papers — NutriCoach',
    description: 'Pipeline automático: PubMed E-utilities → DeepSeek reader → evaluador → knowledge_base',
    version: '1.0.0',
    endpoints: {
      POST: 'Ejecutar ingesta de papers',
    },
    fuentes: FUENTES_PUBMED.map(f => ({
      id: f.id,
      nombre: f.nombre,
      disciplina: f.disciplina,
      categoria: f.categoria,
      activa: f.activa,
    })),
    auth: process.env.INGESTA_API_KEY ? 'Bearer token (INGESTA_API_KEY)' : 'Sin autenticación (no recomendado en producción)',
  })
}
