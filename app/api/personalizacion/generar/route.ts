import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'
import { generarComidaConIA, perfilVacio, type MacrosObjetivo } from '@/lib/personalizacion/generador-comidas'
import { obtenerOCrearPerfil } from '@/lib/personalizacion/actualizar-perfil'

export async function POST(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { cliente_id, tipo_comida, macros_objetivo } = body as {
    cliente_id: string
    tipo_comida: string
    macros_objetivo: MacrosObjetivo
  }

  if (!cliente_id || !tipo_comida || !macros_objetivo) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Obtener restricciones del onboarding
  const supabase = createApiSupabase(request)
  const { data: onboarding } = await supabase
    .from('onboarding_responses')
    .select('restricciones')
    .eq('cliente_id', cliente_id)
    .single()

  const restricciones: string[] = onboarding?.restricciones ?? []

  // Obtener o crear perfil alimentario del cliente
  let perfil
  try {
    perfil = await obtenerOCrearPerfil(cliente_id)
  } catch {
    perfil = perfilVacio()
  }

  const comida = await generarComidaConIA({
    tipoComida: tipo_comida,
    macrosObjetivo: macros_objetivo,
    perfil,
    restricciones,
  })

  if (!comida) {
    return NextResponse.json({ error: 'No se pudo generar la comida' }, { status: 500 })
  }

  return NextResponse.json({ comida })
}
