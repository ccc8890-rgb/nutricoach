import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const supabase = await createServerSupabase()
    const { codigo } = await params
    const { comida_id, comida_nombre, hecho, cambio } = await request.json()

    // Buscar cliente por código del plan
    const { data: plan } = await supabase
      .from('planes_nutricion')
      .select('cliente_id')
      .eq('codigo_publico', codigo)
      .eq('activo', true)
      .single()

    if (!plan || !plan.cliente_id) {
      return NextResponse.json({ error: 'Plan o cliente no encontrado' }, { status: 404 })
    }

    const hoy = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD en UTC+2

    // Upsert: si ya existe registro para esta comida en esta fecha, actualizarlo
    const { data: existente } = await supabase
      .from('registro_comidas_dia')
      .select('id')
      .eq('cliente_id', plan.cliente_id)
      .eq('comida_id', comida_id)
      .eq('fecha', hoy)
      .maybeSingle()

    let result
    if (existente) {
      result = await supabase
        .from('registro_comidas_dia')
        .update({ hecho, cambio: cambio ?? null, updated_at: new Date().toISOString() })
        .eq('id', existente.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('registro_comidas_dia')
        .insert({
          cliente_id: plan.cliente_id,
          fecha: hoy,
          comida_id,
          comida_nombre,
          hecho,
          cambio: cambio ?? null,
        })
        .select()
        .single()
    }

    if (result.error) {
      console.error('Error al registrar comida:', result.error)
      return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
    }

    return NextResponse.json({ success: true, registro: result.data })
  } catch (err) {
    console.error('Error en registrar-comida:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
