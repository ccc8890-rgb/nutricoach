import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const supabase = createServiceSupabase()
    const { codigo } = await params
    let body: { comida_id?: string; estado?: string; notas?: string | null; fecha?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }
    const { comida_id, estado, notas, fecha } = body

    if (!comida_id || !estado) {
      return NextResponse.json({ error: 'comida_id y estado son requeridos' }, { status: 400 })
    }

    const { data: plan } = await supabase
      .from('planes_nutricion')
      .select('id, cliente_id')
      .eq('codigo_publico', codigo)
      .eq('activo', true)
      .single()

    if (!plan || !plan.cliente_id) {
      return NextResponse.json({ error: 'Plan o cliente no encontrado' }, { status: 404 })
    }

    const fechaHoy = fecha ?? new Date().toISOString().split('T')[0]

    const { error } = await supabase
      .from('registro_comidas_dia')
      .upsert({
        cliente_id: plan.cliente_id,
        plan_id: plan.id,
        comida_id,
        fecha: fechaHoy,
        estado,
        notas: notas ?? null,
      }, { onConflict: 'cliente_id,comida_id,fecha' })

    if (error) {
      console.error('Error al registrar comida:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error en registrar-comida:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const supabase = createServiceSupabase()
    const { codigo } = await params
    let body: { comida_id?: string; fecha?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const { comida_id, fecha } = body
    if (!comida_id) {
      return NextResponse.json({ error: 'comida_id es requerido' }, { status: 400 })
    }

    const { data: plan } = await supabase
      .from('planes_nutricion')
      .select('id, cliente_id')
      .eq('codigo_publico', codigo)
      .eq('activo', true)
      .single()

    if (!plan || !plan.cliente_id) {
      return NextResponse.json({ error: 'Plan o cliente no encontrado' }, { status: 404 })
    }

    const fechaRegistro = fecha ?? new Date().toISOString().split('T')[0]

    const { error } = await supabase
      .from('registro_comidas_dia')
      .delete()
      .eq('cliente_id', plan.cliente_id)
      .eq('plan_id', plan.id)
      .eq('comida_id', comida_id)
      .eq('fecha', fechaRegistro)

    if (error) {
      console.error('Error al deshacer comida:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error en deshacer registrar-comida:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
