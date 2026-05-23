import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

// GET: Obtener mensajes del chat (cliente)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const supabase = createServiceSupabase()
    const { codigo } = await params

    // Buscar cliente por código del plan
    const { data: plan } = await supabase
      .from('planes_nutricion')
      .select('cliente_id')
      .eq('codigo_publico', codigo)
      .eq('activo', true)
      .single()

    if (!plan || !plan.cliente_id) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
    }

    const { data } = await supabase
      .from('chat_mensajes')
      .select('*')
      .eq('cliente_id', plan.cliente_id)
      .order('created_at', { ascending: true })
      .limit(100)

    return NextResponse.json({ mensajes: data ?? [] })
  } catch (err) {
    console.error('Error GET chat cliente:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: Enviar mensaje como cliente
export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const supabase = createServiceSupabase()
    const { codigo } = await params
    const { contenido } = await request.json()

    if (!contenido?.trim()) {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 })
    }

    const { data: plan } = await supabase
      .from('planes_nutricion')
      .select('cliente_id')
      .eq('codigo_publico', codigo)
      .eq('activo', true)
      .single()

    if (!plan || !plan.cliente_id) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('chat_mensajes')
      .insert({
        cliente_id: plan.cliente_id,
        remitente: 'cliente',
        contenido: contenido.trim(),
        leido: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error POST chat cliente:', error)
      return NextResponse.json({ error: 'Error al enviar' }, { status: 500 })
    }

    return NextResponse.json({ mensaje: data })
  } catch (err) {
    console.error('Error POST chat cliente:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
