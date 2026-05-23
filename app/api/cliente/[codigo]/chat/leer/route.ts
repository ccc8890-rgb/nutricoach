import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await params
    const body = await request.json()
    const { mensaje_id } = body

    if (!mensaje_id) {
      return NextResponse.json(
        { error: 'mensaje_id es requerido' },
        { status: 400 }
      )
    }

    const supabase = createServiceSupabase()

    // Buscar cliente por codigo_publico en planes_nutricion
    const { data: plan } = await supabase
      .from('planes_nutricion')
      .select('cliente_id')
      .eq('codigo_publico', codigo)
      .maybeSingle()

    if (!plan) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    const clienteId = plan.cliente_id

    // Marcar mensaje como leído
    const { error } = await supabase
      .from('chat_mensajes')
      .update({ leido: true })
      .eq('id', mensaje_id)
      .eq('cliente_id', clienteId)

    if (error) {
      console.error('[chat/leer] Error actualizando mensaje:', error)
      return NextResponse.json(
        { error: 'Error al marcar como leído' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[chat/leer] Error inesperado:', err)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
