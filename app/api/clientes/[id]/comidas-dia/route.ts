import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { normalizarComidasDia } from '@/lib/ajustes-coach-validacion'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { data: { user }, error: authError } = await createApiSupabase(request).auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body: unknown = await request.json().catch(() => null)
    const comidasDia = normalizarComidasDia(
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>).comidas_dia
        : undefined,
    )
    if (comidasDia === undefined) return NextResponse.json({ error: 'Número de comidas inválido' }, { status: 400 })

    const { id } = await params
    const db = createServiceSupabase()
    const { data: perfil, error: perfilError } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (perfilError) throw new Error('No se pudo consultar el perfil')
    if (perfil?.role !== 'coach') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

    const acceso = await autorizarCoachCliente(db, { userId: user.id, clienteId: id })
    if (!acceso.ok) return NextResponse.json({ error: acceso.mensaje }, { status: acceso.status })

    const { data, error } = await db
      .from('clientes')
      .update({ comidas_dia: comidasDia })
      .eq('id', id)
      .select('id,comidas_dia')
      .single()
    if (error) throw new Error('No se pudo actualizar el cliente')

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error PATCH /api/clientes/[id]/comidas-dia:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
