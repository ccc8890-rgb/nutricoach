import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { validarTecnica } from '@/lib/tecnicas'

// Archivo de técnicas de cocina. Solo coach.
export async function GET(request: NextRequest) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const p = new URL(request.url).searchParams
  const q = (p.get('q') ?? '').trim().replace(/[%_,()]/g, ' ')
  let consulta = auth.admin.from('tecnicas').select('id, nombre, familia, descripcion, parametros, tags, imagen_url, estado, created_at').order('nombre').limit(500)
  const estado = p.get('estado')
  consulta = estado ? consulta.eq('estado', estado) : consulta.neq('estado', 'descartada')
  if (p.get('familia')) consulta = consulta.eq('familia', p.get('familia') as string)
  if (q) consulta = consulta.or(`nombre.ilike.%${q}%,descripcion.ilike.%${q}%`)
  const { data, error } = await consulta
  if (error) return NextResponse.json({ error: 'No se pudieron leer las técnicas' }, { status: 500 })
  return NextResponse.json({ tecnicas: data ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const body = await request.json().catch(() => null)
  const v = validarTecnica(body)
  if (!v.ok) return NextResponse.json({ error: v.motivo }, { status: 400 })
  const { data, error } = await auth.admin.from('tecnicas').insert({ ...v.tecnica, coach_id: auth.userId }).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo crear la técnica' }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
