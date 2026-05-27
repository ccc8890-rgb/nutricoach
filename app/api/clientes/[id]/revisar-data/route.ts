import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createServerSupabase()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const sb = createServiceSupabase()

    const [
      { data: cliente },
      { data: onboarding },
      { data: registros },
      { data: perfilProfundo },
      { data: dietaHabitual },
    ] = await Promise.all([
      sb.from('clientes')
        .select('*, profiles!profile_id(nombre, apellidos, email)')
        .eq('id', id)
        .single(),
      sb.from('onboarding_responses')
        .select('*')
        .eq('cliente_id', id)
        .maybeSingle(),
      sb.from('registros_ia')
        .select('id, respuesta_json, created_at')
        .eq('cliente_id', id)
        .in('tipo', ['plan_inicial', 'dieta'])
        .order('created_at', { ascending: false }),
      sb.from('onboarding_perfil_profundo')
        .select('*')
        .eq('cliente_id', id)
        .maybeSingle(),
      sb.from('dieta_habitual_cliente')
        .select('*')
        .eq('cliente_id', id)
        .order('created_at', { ascending: true }),
    ])

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      cliente,
      onboarding,
      registros: registros ?? [],
      perfilProfundo,
      dietaHabitual: dietaHabitual ?? [],
    })
  } catch (error) {
    console.error('Error en GET /api/clientes/[id]/revisar-data:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
