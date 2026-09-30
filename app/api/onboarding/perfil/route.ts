import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

// GET — devuelve datos del onboarding básico para saber si es atleta y el cliente_id
export async function GET(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceSupabase()
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: onboarding } = await supabase
    .from('onboarding_responses')
    .select('dias_entreno, segmento')
    .eq('cliente_id', cliente.id)
    .single()

  return NextResponse.json({
    cliente_id: cliente.id,
    dias_entreno: onboarding?.dias_entreno ?? 0,
    segmento: onboarding?.segmento ?? 'standard',
  })
}

// POST — retirado: el perfil completo y la generación ocurren en /api/onboarding/completo.
export async function POST() {
  return NextResponse.json({
    error: {
      codigo: 'LEGACY_ONBOARDING_ROUTE_RETIRED',
      mensaje: 'La ruta de onboarding legado ya no está disponible.',
      accion: 'Usa /onboarding para completar tu perfil.',
    },
  }, { status: 410 })
}
