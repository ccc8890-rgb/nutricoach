import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { autorizarCoach } from '@/lib/contenido/auth'
import { autorizarSemanaDieta } from '@/lib/nutricion/semana-dieta'
import { compraDeTanda } from '@/lib/contenido/compra-tanda'
import { ordenarCocinado, resumenTanda } from '@/lib/contenido/tanda'

const FECHA = /^\d{4}-\d{2}-\d{2}$/

/** Ids de las recetas que aparecen en el plan del cliente (semana en curso y futuras planificadas). */
async function recetasDelPlan(db: SupabaseClient, planId: string): Promise<Set<string>> {
  const [{ data: actuales }, { data: futuras }] = await Promise.all([
    db.from('comidas').select('receta_id').eq('plan_id', planId).not('receta_id', 'is', null),
    db.from('comidas_planificadas').select('receta_id').eq('plan_id', planId),
  ])
  return new Set([...(actuales ?? []), ...(futuras ?? [])].map(f => f.receta_id as string))
}

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams
  const fecha = q.get('fecha') ?? ''
  const clienteId = q.get('cliente_id')
  if (!FECHA.test(fecha)) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 })

  // Con cliente: comprueba que es del coach y carga su plan; sin cliente: solo rol coach.
  const c = await autorizarCoach(request)
  if ('error' in c) return c.error
  const admin: SupabaseClient = c.admin
  const coachId = c.userId
  let planId: string | null = null
  if (clienteId) {
    const a = await autorizarSemanaDieta(request, clienteId)
    if ('error' in a) return a.error
    planId = a.plan?.id ?? null
  }

  const { data, error } = await admin.from('piezas_contenido')
    .select('*, receta:recetas(id, nombre, imagen_url, tiempo_prep_min, instrucciones, estado, verificacion)')
    .eq('coach_id', coachId).eq('fecha_grabacion', fecha).in('estado', ['para_grabar', 'grabada'])
  if (error) return NextResponse.json({ error: 'No se pudo cargar la tanda' }, { status: 500 })

  type Fila = { id: string; titulo: string; receta_id: string | null; planos_hechos: string[]; receta: { tiempo_prep_min: number | null } | null }
  const filas = (data ?? []) as unknown as Fila[]
  const ordenadas = ordenarCocinado(filas.map(p => ({ ...p, nombre: p.titulo, tiempo_prep_min: p.receta?.tiempo_prep_min ?? null })))

  const recetaIds = [...new Set(ordenadas.flatMap(p => p.receta_id ? [p.receta_id] : []))]
  try {
    const [compra, enPlan] = await Promise.all([
      compraDeTanda(admin, recetaIds),
      planId ? recetasDelPlan(admin, planId) : Promise.resolve(new Set<string>()),
    ])
    return NextResponse.json({
      fecha,
      piezas: ordenadas,
      compra,
      resumen: { ...resumenTanda(ordenadas), enDieta: recetaIds.filter(id => enPlan.has(id)).length },
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo calcular la compra de la tanda' }, { status: 500 })
  }
}
