import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

/**
 * T33: guard de autorización para escrituras sobre un plan de nutrición.
 *
 * Comprueba que hay sesión autenticada y que el usuario es propietario del
 * plan (cliente con `profile_id` propio) o su coach (`coach_id` + role coach).
 *
 * Fail-closed: cualquier error de DB o excepción deniega sin escrituras.
 *
 * USO:
 *   const auth = await autorizarEscrituraPlan(request, codigo)
 *   if (auth instanceof NextResponse) return auth
 *   const planId = auth.planId
 */
export async function autorizarEscrituraPlan(
  request: NextRequest,
  codigo: string
): Promise<{ planId: string } | NextResponse> {
  try {
    const supabase = createApiSupabase(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const admin = createServiceSupabase()

    const { data: plan, error: planError } = await admin
      .from('planes_nutricion')
      .select('id, cliente_id')
      .eq('codigo_publico', codigo)
      .eq('activo', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
    }

    const { data: cliente, error: clienteError } = await admin
      .from('clientes')
      .select('profile_id, coach_id')
      .eq('id', plan.cliente_id)
      .single()

    if (clienteError || !cliente) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    if (cliente.profile_id && cliente.profile_id === user.id) {
      return { planId: plan.id }
    }

    if (cliente.coach_id && cliente.coach_id === user.id) {
      const { data: perfil, error: perfilError } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!perfilError && perfil?.role === 'coach') {
        return { planId: plan.id }
      }
    }

    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
}
