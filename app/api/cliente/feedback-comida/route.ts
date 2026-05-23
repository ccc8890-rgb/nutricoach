// app/api/cliente/feedback-comida/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      comida_id: string
      receta_id: string
      accion: string
      cliente_id?: string
    }

    const { comida_id, receta_id, accion, cliente_id } = body

    if (!comida_id || !receta_id || !accion) {
      return NextResponse.json({ error: 'comida_id, receta_id y accion son requeridos' }, { status: 400 })
    }

    const supabase = createServiceSupabase()

    const { error } = await supabase
      .from('feedback_comidas_generadas')
      .insert({
        comida_id,
        receta_id,
        accion,
        ...(cliente_id ? { cliente_id } : {}),
      })

    if (error) {
      console.error('[feedback-comida] Error al insertar:', error.message)
      return NextResponse.json({ error: 'Error al guardar feedback' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[feedback-comida] Error inesperado:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
