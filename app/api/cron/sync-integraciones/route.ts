import { NextRequest, NextResponse } from 'next/server'
import { sincronizarTodosProveedores } from '@/lib/integraciones/sync'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sincronizarTodosProveedores()
  return NextResponse.json(result)
}
