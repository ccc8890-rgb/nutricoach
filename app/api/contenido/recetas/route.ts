import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'

export async function GET(request: NextRequest) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  let consulta = r.admin.from('recetas').select('id, nombre, imagen_url, tiempo_prep_min').eq('estado', 'aprobada').order('nombre').limit(30)
  if (q) consulta = consulta.ilike('nombre', `%${q}%`)
  const { data, error } = await consulta
  if (error) return NextResponse.json({ error: 'No se pudieron cargar las recetas' }, { status: 500 })
  return NextResponse.json({ recetas: data ?? [] })
}
