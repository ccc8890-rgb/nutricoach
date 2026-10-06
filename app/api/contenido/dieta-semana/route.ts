import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { autorizarSemanaDieta } from '@/lib/nutricion/semana-dieta'

type R = { id: string; nombre: string; imagen_url: string | null; tiempo_prep_min: number | null }
const SEL = 'receta:recetas(id, nombre, imagen_url, tiempo_prep_min)'

export async function GET(request: NextRequest) {
  const clienteId = new URL(request.url).searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'Falta cliente_id' }, { status: 400 })
  const c = await autorizarCoach(request)
  if ('error' in c) return c.error
  const a = await autorizarSemanaDieta(request, clienteId)
  if ('error' in a) return a.error
  if (!a.plan) return NextResponse.json({ recetas: [] })

  const [actuales, futuras] = await Promise.all([
    a.admin.from('comidas').select(SEL).eq('plan_id', a.plan.id).not('receta_id', 'is', null),
    a.admin.from('comidas_planificadas').select(`semana, ${SEL}`).eq('plan_id', a.plan.id).lte('semana', 2),
  ])
  if (actuales.error || futuras.error) return NextResponse.json({ error: 'No se pudo cargar la dieta' }, { status: 500 })

  const vistas = new Map<string, R & { origen: string }>()
  const incluir = (receta: R | null, origen: string) => { if (receta && !vistas.has(receta.id)) vistas.set(receta.id, { ...receta, origen }) }
  for (const f of (actuales.data ?? []) as unknown as { receta: R | null }[]) incluir(f.receta, 'Esta semana')
  for (const f of (futuras.data ?? []) as unknown as { semana: number; receta: R | null }[]) incluir(f.receta, `Semana +${f.semana}`)
  return NextResponse.json({ recetas: [...vistas.values()] })
}
