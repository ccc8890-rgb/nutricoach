import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const disciplina = searchParams.get('disciplina')
    const categoria = searchParams.get('categoria')
    const q = searchParams.get('q')
    const condiciones = searchParams.get('condiciones')?.split(',').filter(Boolean) ?? []

    const svc = createServiceSupabase()
    let query = svc
      .from('knowledge_base')
      .select('id, titulo, resumen, puntos_clave, fuente, disciplina, categoria, tipo, nivel_evidencia, tags, poblacion, condiciones, fuente_tipo, verificado, url_origen, doi, created_at')
      .or(`coach_id.is.null,coach_id.eq.${user.id}`)
      .eq('activo', true)
      .order('created_at', { ascending: false })

    if (disciplina && disciplina !== 'todos') query = query.eq('disciplina', disciplina)
    if (categoria && categoria !== 'todos') query = query.eq('categoria', categoria)
    if (q) query = query.textSearch('busqueda', q, { type: 'websearch', config: 'spanish' })
    if (condiciones.length > 0) query = query.overlaps('condiciones', condiciones)

    const { data, error } = await query.limit(100)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { data, error } = await supabase
      .from('knowledge_base')
      .insert({ ...body, coach_id: user.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id, ...body } = await request.json()
    const { data, error } = await supabase
      .from('knowledge_base')
      .update(body)
      .eq('id', id)
      .eq('coach_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    await supabase.from('knowledge_base').update({ activo: false }).eq('id', id).eq('coach_id', user.id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
