import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

/** Biblioteca de ejercicios + cuántas veces ha usado cada uno el coach en sus planes (para los «habituales»). */
export async function GET(request: NextRequest) {
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceSupabase()
  const { data: ejercicios, error } = await admin.from('ejercicios').select('id, nombre, tipo, grupo_muscular').order('nombre').limit(2000)
  if (error) return NextResponse.json({ error: 'No se pudo cargar la biblioteca' }, { status: 500 })

  const { data: planes } = await admin.from('planes_entrenamiento').select('id').eq('coach_id', user.id)
  const planIds = (planes ?? []).map(p => p.id as string)
  const uso: Record<string, number> = {}
  if (planIds.length > 0) {
    const { data: sesiones } = await admin.from('sesiones_entrenamiento').select('id').in('plan_id', planIds)
    const sesionIds = (sesiones ?? []).map(s => s.id as string)
    for (let i = 0; i < sesionIds.length; i += 200) {
      const { data: filas } = await admin.from('sesion_ejercicios').select('ejercicio_id').in('sesion_id', sesionIds.slice(i, i + 200))
      for (const f of filas ?? []) uso[f.ejercicio_id as string] = (uso[f.ejercicio_id as string] ?? 0) + 1
    }
  }
  return NextResponse.json({ ejercicios, uso })
}
