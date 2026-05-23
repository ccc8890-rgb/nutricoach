import { NextRequest, NextResponse } from 'next/server'
import { ejecutarDirector } from '@/lib/agentes/director'

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === process.env.CRON_SECRET
  }
  // Vercel crons send the secret as a header
  return request.headers.get('x-vercel-cron-secret') === process.env.CRON_SECRET
}

// GET: invocado por Vercel crons
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const modo = (searchParams.get('modo') ?? 'diario') as 'diario' | 'semanal'
    const resultado = await ejecutarDirector(modo)
    return NextResponse.json({ ok: true, resultado })
  } catch (error) {
    console.error('[agentes/ejecutar]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: invocado manualmente por el coach
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const modo = (searchParams.get('modo') ?? 'diario') as 'diario' | 'semanal'
    const resultado = await ejecutarDirector(modo)
    return NextResponse.json({ ok: true, resultado })
  } catch (error) {
    console.error('[agentes/ejecutar]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
