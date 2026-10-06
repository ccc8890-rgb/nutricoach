import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { fusionarValoresAnalitica, validarEdicionAnalitica } from '@/lib/analiticas-validacion'

async function autorizar(request: NextRequest, clienteId: string) {
  const { data: { user }, error: authError } = await createApiSupabase(request).auth.getUser()
  if (authError || !user) return { respuesta: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const db = createServiceSupabase()
  const { data: perfil, error: perfilError } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (perfilError) throw new Error('No se pudo verificar el rol')
  if (perfil?.role !== 'coach') return { respuesta: NextResponse.json({ error: 'Sin acceso' }, { status: 403 }) }
  const acceso = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!acceso.ok) return { respuesta: NextResponse.json({ error: acceso.mensaje }, { status: acceso.status }) }
  return { db }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await autorizar(request, id)
    if ('respuesta' in auth) return auth.respuesta
    const { data, error } = await auth.db.from('onboarding_perfil_profundo')
      .select('analisis_valores,notas_analisis').eq('cliente_id', id).maybeSingle()
    if (error) throw new Error('No se pudieron consultar las analíticas')
    return NextResponse.json({
      valores: fusionarValoresAnalitica(data?.analisis_valores, {}),
      notas: typeof data?.notas_analisis === 'string' ? data.notas_analisis : '',
    })
  } catch (error) {
    console.error('Error GET /api/clientes/[id]/analiticas:', error)
    return NextResponse.json({ error: 'Error al obtener las analíticas' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await autorizar(request, id)
    if ('respuesta' in auth) return auth.respuesta
    const body: unknown = await request.json().catch(() => null)
    const validacion = validarEdicionAnalitica(body)
    if (!validacion.ok) return NextResponse.json({ error: validacion.error }, { status: 400 })

    const { data: actual, error: consultaError } = await auth.db.from('onboarding_perfil_profundo')
      .select('analisis_valores,notas_analisis').eq('cliente_id', id).maybeSingle()
    if (consultaError) throw new Error('No se pudieron consultar las analíticas')
    const valores = fusionarValoresAnalitica(actual?.analisis_valores, validacion.valores)
    const notas = validacion.notas ?? (typeof actual?.notas_analisis === 'string' ? actual.notas_analisis : '')
    const { error } = await auth.db.from('onboarding_perfil_profundo').upsert({
      cliente_id: id,
      analisis_valores: valores,
      analisis_disponibles: Object.keys(valores),
      notas_analisis: notas || null,
    }, { onConflict: 'cliente_id' })
    if (error) throw new Error('No se pudieron guardar las analíticas')
    return NextResponse.json({ valores, notas })
  } catch (error) {
    console.error('Error PATCH /api/clientes/[id]/analiticas:', error)
    return NextResponse.json({ error: 'Error al guardar las analíticas' }, { status: 500 })
  }
}
