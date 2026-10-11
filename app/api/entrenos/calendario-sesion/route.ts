import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { diaSemanaDe, diferenciaDias, esFechaISO } from '@/lib/entrenos/calendario-ajustes'

const MAX_FECHAS = 120

/**
 * Crea una sesión nueva desde el calendario mensual, vacía o copiada de una sesión base de las plantillas
 * (con sus ejercicios y pasos de Garmin).
 * - `fechas` (una o varias): la sesión existe solo en esas fechas (sesión sin día de la semana + ajustes de tipo copiar).
 * - alcance «semanal»: entra en la plantilla y se repite ese día de la semana durante el bloque.
 */
export async function POST(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => null) as { plan_id?: string; fecha?: unknown; fechas?: unknown; nombre?: unknown; alcance?: unknown; plantilla_sesion_id?: unknown } | null
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  const alcance = body?.alcance === 'semanal' ? 'semanal' : 'dia'
  const hoy = new Date().toISOString().slice(0, 10)
  const fechas = [...new Set(Array.isArray(body?.fechas) ? body!.fechas : [body?.fecha])]
  const plantillaSesionId = typeof body?.plantilla_sesion_id === 'string' ? body.plantilla_sesion_id : null
  if (!body?.plan_id || nombre.length < 1 || nombre.length > 80 || fechas.length < 1 || fechas.length > MAX_FECHAS
    || !fechas.every((f): f is string => esFechaISO(f) && Math.abs(diferenciaDias(hoy, f)) <= 1100)
    || (body?.plantilla_sesion_id !== undefined && typeof body.plantilla_sesion_id !== 'string')) {
    return NextResponse.json({ error: 'plan_id, fechas y nombre (1-80 caracteres) son obligatorios' }, { status: 400 })
  }
  const fecha = fechas[0] as string

  const admin = createServiceSupabase()
  const { data: plan } = await admin.from('planes_entrenamiento').select('id, coach_id').eq('id', body.plan_id).maybeSingle()
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  if (plan.coach_id !== user.id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  // Sesión base de las plantillas del coach (opcional): se copian sus datos, pasos y ejercicios.
  let base: Record<string, unknown> | null = null
  let ejerciciosBase: Record<string, unknown>[] = []
  if (plantillaSesionId) {
    const { data: ps } = await admin
      .from('plantilla_sesiones')
      .select('*, plantilla:plantillas_entrenamiento(coach_id), ejercicios:plantilla_sesion_ejercicios(*)')
      .eq('id', plantillaSesionId)
      .maybeSingle()
    if (!ps || (ps.plantilla as { coach_id?: string } | null)?.coach_id !== user.id) {
      return NextResponse.json({ error: 'Sesión base no encontrada' }, { status: 404 })
    }
    base = ps
    ejerciciosBase = (ps.ejercicios ?? []) as Record<string, unknown>[]
  }

  const { data: ultima } = await admin.from('sesiones_entrenamiento').select('orden').eq('plan_id', plan.id).order('orden', { ascending: false }).limit(1).maybeSingle()
  const { data: sesion, error } = await admin
    .from('sesiones_entrenamiento')
    .insert({
      plan_id: plan.id,
      nombre,
      dia_semana: alcance === 'semanal' ? diaSemanaDe(fecha) : null,
      orden: ((ultima?.orden as number | null) ?? 0) + 1,
      ...(base ? {
        notas: base.notas ?? null,
        instruccion_coach: base.instruccion_coach ?? null,
        fase_bloque: base.fase_bloque ?? null,
        duracion_estimada_min: base.duracion_estimada_min ?? null,
        pasos: base.pasos ?? null,
      } : {}),
    })
    .select('id')
    .single()
  if (error || !sesion) return NextResponse.json({ error: 'No se pudo crear la sesión' }, { status: 500 })

  const deshacer = async () => { await admin.from('sesiones_entrenamiento').delete().eq('id', sesion.id) }

  if (ejerciciosBase.length > 0) {
    const { error: eEj } = await admin.from('sesion_ejercicios').insert(ejerciciosBase.map(e => ({
      sesion_id: sesion.id,
      ejercicio_id: e.ejercicio_id,
      series: e.series ?? null,
      repeticiones: e.repeticiones ?? null,
      descanso_segundos: e.descanso_segundos ?? null,
      peso_sugerido: e.peso_sugerido ?? (e.carga_valor != null ? String(e.carga_valor) : null),
      notas: e.notas ?? e.notas_tecnicas ?? null,
      orden: e.orden ?? null,
      sets_config: e.sets_config ?? null,
      instruccion_ejercicio: e.instruccion_ejercicio ?? null,
      tempo: e.tempo ?? null,
      rpe: e.rpe ?? null,
    })))
    if (eEj) { await deshacer(); return NextResponse.json({ error: 'No se pudo crear la sesión' }, { status: 500 }) }
  }

  if (alcance === 'dia') {
    const { error: e2 } = await admin.from('calendario_entreno_ajustes').insert(
      (fechas as string[]).map(f => ({ plan_id: plan.id, sesion_id: sesion.id, tipo: 'copiar', fecha_origen: null, fecha: f })),
    )
    if (e2) { await deshacer(); return NextResponse.json({ error: 'No se pudo crear la sesión' }, { status: 500 }) }
  }
  return NextResponse.json({ ok: true, sesion_id: sesion.id })
}
