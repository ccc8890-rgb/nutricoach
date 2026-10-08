import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { limpiarPerfil } from '@/lib/ajustes/perfil'

const COLUMNAS = 'nombre, apellidos, email, telefono'

export async function GET(request: NextRequest) {
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await createServiceSupabase().from('profiles').select(COLUMNAS).eq('id', user.id).single()
  if (error) return NextResponse.json({ error: 'No se pudo cargar el perfil' }, { status: 500 })
  return NextResponse.json({ perfil: data })
}

export async function PATCH(request: NextRequest) {
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const limpio = limpiarPerfil(body)
  if (!limpio.ok) return NextResponse.json({ error: limpio.error }, { status: 400 })
  if (Object.keys(limpio.cambios).length === 0) return NextResponse.json({ error: 'Nada que guardar' }, { status: 400 })

  // El id sale siempre de la sesión, nunca del cuerpo de la petición.
  const { data, error } = await createServiceSupabase()
    .from('profiles').update(limpio.cambios).eq('id', user.id).select(COLUMNAS).single()
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ perfil: data })
}
