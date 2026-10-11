import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { diaSemanaDe, diferenciaDias, esFechaISO } from '@/lib/entrenos/calendario-ajustes'

/**
 * Crea una sesión nueva desde el calendario mensual.
 * - alcance «dia»: solo existe en esa fecha (sesión sin día de la semana + ajuste de tipo copiar).
 * - alcance «semanal»: entra en la plantilla y se repite ese día de la semana durante el bloque.
 */
export async function POST(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => null) as { plan_id?: string; fecha?: unknown; nombre?: unknown; alcance?: unknown } | null
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  const fecha = body?.fecha
  const alcance = body?.alcance === 'semanal' ? 'semanal' : 'dia'
  if (!body?.plan_id || !esFechaISO(fecha) || nombre.length < 1 || nombre.length > 80
    || Math.abs(diferenciaDias(new Date().toISOString().slice(0, 10), fecha)) > 1100) {
    return NextResponse.json({ error: 'plan_id, fecha y nombre (1-80 caracteres) son obligatorios' }, { status: 400 })
  }

  const admin = createServiceSupabase()
  const { data: plan } = await admin.from('planes_entrenamiento').select('id, coach_id').eq('id', body.plan_id).maybeSingle()
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  if (plan.coach_id !== user.id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { data: ultima } = await admin.from('sesiones_entrenamiento').select('orden').eq('plan_id', plan.id).order('orden', { ascending: false }).limit(1).maybeSingle()
  const { data: sesion, error } = await admin
    .from('sesiones_entrenamiento')
    .insert({ plan_id: plan.id, nombre, dia_semana: alcance === 'semanal' ? diaSemanaDe(fecha) : null, orden: ((ultima?.orden as number | null) ?? 0) + 1 })
    .select('id')
    .single()
  if (error || !sesion) return NextResponse.json({ error: 'No se pudo crear la sesión' }, { status: 500 })

  if (alcance === 'dia') {
    const { error: e2 } = await admin.from('calendario_entreno_ajustes').insert({ plan_id: plan.id, sesion_id: sesion.id, tipo: 'copiar', fecha_origen: null, fecha })
    if (e2) {
      await admin.from('sesiones_entrenamiento').delete().eq('id', sesion.id)
      return NextResponse.json({ error: 'No se pudo crear la sesión' }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true, sesion_id: sesion.id })
}
