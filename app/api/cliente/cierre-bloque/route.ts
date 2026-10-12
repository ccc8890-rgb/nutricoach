import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { calcularEstadoBloque } from '@/lib/entrenos/bloques'
import { esValoracion, preguntasDelPlan } from '@/lib/entrenos/marcas'

/** Días que quedan de bloque a partir de los cuales se ofrece el cierre (la semana de descarga). */
const DIAS_PARA_CIERRE = 7

async function contexto(request: NextRequest) {
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return null
  const admin = createServiceSupabase()
  const { data: cliente } = await admin.from('clientes').select('id').eq('profile_id', user.id).maybeSingle()
  if (!cliente) return null
  const { data: plan } = await admin.from('planes_entrenamiento').select('id, created_at, duracion_semanas').eq('cliente_id', cliente.id).eq('activo', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return { admin, clienteId: cliente.id as string, plan }
}

async function preguntasYRespuestas(c: NonNullable<Awaited<ReturnType<typeof contexto>>>) {
  const planId = c.plan!.id as string
  const { data: ses } = await c.admin.from('sesiones_entrenamiento').select('id, pasos').eq('plan_id', planId)
  const ids = (ses ?? []).map(s => s.id as string)
  const { data: ej } = ids.length ? await c.admin.from('sesion_ejercicios').select('ejercicio:ejercicios(nombre)').in('sesion_id', ids) : { data: [] }
  const nombres = (ej ?? []).map(e => ((e as unknown as { ejercicio: { nombre: string } | null }).ejercicio?.nombre) ?? '')
  const preguntas = preguntasDelPlan(nombres, (ses ?? []).some(s => !!s.pasos))
  const { data: resp } = await c.admin.from('feedback_bloque').select('clave, valoracion').eq('plan_id', planId)
  const mapa = new Map((resp ?? []).map(r => [r.clave as string, r.valoracion as string]))
  return preguntas.map(p => ({ clave: p.clave, etiqueta: p.etiqueta, valoracion: mapa.get(p.clave) ?? null }))
}

/** ¿Toca preguntar cómo fue el bloque? Solo en la última semana (descarga) y mientras falten respuestas. */
export async function GET(request: NextRequest) {
  const c = await contexto(request)
  if (!c) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!c.plan?.duracion_semanas) return NextResponse.json({ mostrar: false })
  const e = calcularEstadoBloque(c.plan.created_at as string, c.plan.duracion_semanas as number)
  if (e.diasRestantes > DIAS_PARA_CIERRE && !e.terminado) return NextResponse.json({ mostrar: false })
  const preguntas = await preguntasYRespuestas(c)
  if (!preguntas.length) return NextResponse.json({ mostrar: false })
  return NextResponse.json({ mostrar: preguntas.some(p => !p.valoracion), preguntas })
}

export async function POST(request: NextRequest) {
  const c = await contexto(request)
  if (!c || !c.plan) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await request.json().catch(() => null) as { respuestas?: Record<string, unknown> } | null
  const validas = new Set<string>((await preguntasYRespuestas(c)).map(p => p.clave))
  const filas = Object.entries(body?.respuestas ?? {})
    .filter(([clave, v]) => validas.has(clave) && esValoracion(v))
    .map(([clave, v]) => ({ cliente_id: c.clienteId, plan_id: c.plan!.id, clave, valoracion: v as string }))
  if (!filas.length) return NextResponse.json({ error: 'Sin respuestas válidas' }, { status: 400 })
  const { error } = await c.admin.from('feedback_bloque').upsert(filas, { onConflict: 'plan_id,clave' })
  if (error) return NextResponse.json({ error: 'No se pudieron guardar las respuestas' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
