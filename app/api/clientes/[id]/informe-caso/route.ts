import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { validarCuerpoPlanificar } from '@/lib/entrenos/planificar-con-ia'
import { reunirDatosInforme } from '@/lib/informe-caso/datos'
import { construirInformeCaso } from '@/lib/informe-caso/construir'
import { htmlInformeCaso } from '@/lib/informe-caso/html'

export const maxDuration = 60

/** Informe del caso para que el coach explique la situación al cliente. Solo lectura, solo coach. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const v = validarCuerpoPlanificar({ cliente_id: id })
    if (!v.ok) return NextResponse.json({ error: 'Cliente no válido' }, { status: 400 })

    const { data: { user } } = await createApiSupabase(req).auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const db = createServiceSupabase()
    const a = await autorizarCoachCliente(db, { userId: user.id, clienteId: v.clienteId })
    if (!a.ok) return NextResponse.json({ error: a.mensaje }, { status: a.status })

    const datos = await reunirDatosInforme(db, v.clienteId)
    if (!datos) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    const informe = construirInformeCaso(datos)

    if (new URL(req.url).searchParams.get('formato') === 'html') {
      return new NextResponse(htmlInformeCaso(informe), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json(informe, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('informe-caso error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
