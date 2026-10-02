import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

/**
 * Guard para endpoints que actúan sobre un cliente concreto (por `cliente_id` o `codigo`).
 * Exige sesión y que el usuario sea el propio cliente (`profile_id`) o su coach (role coach).
 * Fail-closed: cualquier error deniega. Devuelve el `clienteId` resuelto o la respuesta de error.
 */
export async function autorizarAccesoCliente(
  request: NextRequest,
  input: { clienteId?: string | null; codigo?: string | null }
): Promise<{ clienteId: string } | NextResponse> {
  try {
    const { data: { user }, error: authError } = await createApiSupabase(request).auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const admin = createServiceSupabase()

    let clienteId = input.clienteId ?? null
    if (!clienteId && input.codigo) {
      const { data: plan } = await admin
        .from('planes_nutricion').select('cliente_id').eq('codigo_publico', input.codigo).eq('activo', true).single()
      clienteId = plan?.cliente_id ?? null
    }
    if (!clienteId) return NextResponse.json({ error: 'cliente no encontrado' }, { status: 404 })

    const { data: cliente } = await admin
      .from('clientes').select('profile_id, coach_id').eq('id', clienteId).single()
    if (!cliente) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    if (cliente.profile_id && cliente.profile_id === user.id) return { clienteId }

    if (cliente.coach_id && cliente.coach_id === user.id) {
      const { data: perfil } = await admin.from('profiles').select('role').eq('id', user.id).single()
      if (perfil?.role === 'coach') return { clienteId }
    }
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
}
