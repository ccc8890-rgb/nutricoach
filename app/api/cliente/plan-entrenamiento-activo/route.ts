import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

/**
 * Mismo bug que /api/cliente/plan-nutricion-activo pero para el plan de
 * entrenamiento: app/cliente/page.tsx pedía sesiones+ejercicios en un join
 * anidado de 3 niveles directo desde el cliente Supabase — RLS lo vacía en
 * silencio (0 sesiones vistas, 6 reales en BD). El stat "Entrenos" de la
 * pestaña Hoy salía siempre en 0 por este motivo.
 */
export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceSupabase()

  const { data: clienteData } = await admin
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!clienteData) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: plan, error } = await admin
    .from('planes_entrenamiento')
    .select('*, sesiones:sesiones_entrenamiento(*, ejercicios:sesion_ejercicios(*, ejercicio:ejercicios(*)))')
    .eq('cliente_id', clienteData.id)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

  return NextResponse.json({ plan: plan ?? null })
}
