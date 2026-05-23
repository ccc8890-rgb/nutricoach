import { NextRequest, NextResponse } from 'next/server'
import { ejecutarDirector } from '@/lib/agentes/director'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const token = authHeader.slice(7)
    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const modo = (searchParams.get('modo') as 'diario' | 'semanal') || 'diario'

    const resultado = await ejecutarDirector(modo)

    return NextResponse.json({ ok: true, resultado })
  } catch (error) {
    console.error('Error en ejecutar agente:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
