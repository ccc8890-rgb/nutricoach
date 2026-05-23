import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

// GET: Obtener mensajes de un cliente (coach)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase()
    const { id: clienteId } = await params

    const { data } = await supabase
      .from('chat_mensajes')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: true })
      .limit(100)

    return NextResponse.json({ mensajes: data ?? [] })
  } catch (err) {
    console.error('Error GET chat:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: Enviar mensaje como coach
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase()
    const { id: clienteId } = await params
    const { contenido } = await request.json()

    if (!contenido?.trim()) {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('chat_mensajes')
      .insert({
        cliente_id: clienteId,
        coach_id: user.id,
        emisor: 'coach',
        contenido: contenido.trim(),
        leido: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error POST chat:', error)
      return NextResponse.json({ error: 'Error al enviar' }, { status: 500 })
    }

    return NextResponse.json({ mensaje: data })
  } catch (err) {
    console.error('Error POST chat:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// HEAD: Obtener número de mensajes no leídos (del cliente al coach)
export async function HEAD(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = createServiceSupabase()
    const { id: clienteId } = await params

    const { count } = await db
      .from('chat_mensajes')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .eq('emisor', 'cliente')
      .eq('leido', false)

    return NextResponse.json({ no_leidos: count ?? 0 })
  } catch {
    return NextResponse.json({ no_leidos: 0 })
  }
}
