import { NextResponse } from 'next/server'

// Versión desplegada: la app instalada la compara con la suya para saber si tiene que recargarse.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ v: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? 'dev' }, { headers: { 'Cache-Control': 'no-store' } })
}
