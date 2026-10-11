import { NextRequest, NextResponse } from 'next/server'
import { autorizarSesionCoach } from '@/lib/entrenos/autorizar-sesion-coach'
import { esFechaISO } from '@/lib/entrenos/calendario-ajustes'
import { CATEGORIAS_SESION, type CategoriaSesion } from '@/lib/entrenos/biblioteca-categorias'

// Cómo se guarda cada categoría en las plantillas (respetando los CHECK de plantillas_entrenamiento).
const PLANTILLA_POR_CATEGORIA: Record<string, { tipo: string; sport_modality: string | null }> = {
  Running: { tipo: 'cardio', sport_modality: 'running' },
  'Híbrido': { tipo: 'mixto', sport_modality: 'hibrido' },
  Fuerza: { tipo: 'gimnasio', sport_modality: 'gym_fuerza' },
  Cardio: { tipo: 'cardio', sport_modality: null },
  Funcional: { tipo: 'mixto', sport_modality: 'funcional' },
}

const CAMPOS_SESION = 'nombre, notas, instruccion_coach, fase_bloque, duracion_estimada_min, pasos'
const CAMPOS_EJ = 'ejercicio_id, series, repeticiones, descanso_segundos, peso_sugerido, notas, orden, sets_config, instruccion_ejercicio, tempo, rpe'

/** Edita datos básicos de una sesión (nombre, duración). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await autorizarSesionCoach(request, id)
  if ('error' in a) return a.error
  const body = await request.json().catch(() => null) as { nombre?: unknown; duracion_estimada_min?: unknown } | null
  const cambios: Record<string, unknown> = {}
  if (body?.nombre !== undefined) {
    if (typeof body.nombre !== 'string' || body.nombre.trim().length < 1 || body.nombre.trim().length > 80) return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 })
    cambios.nombre = body.nombre.trim()
  }
  if (body?.duracion_estimada_min !== undefined) {
    const d = body.duracion_estimada_min
    if (d !== null && (typeof d !== 'number' || !Number.isInteger(d) || d < 5 || d > 480)) return NextResponse.json({ error: 'Duración inválida' }, { status: 400 })
    cambios.duracion_estimada_min = d
  }
  if (Object.keys(cambios).length === 0) return NextResponse.json({ error: 'Nada que cambiar' }, { status: 400 })
  const { error } = await a.ctx.admin.from('sesiones_entrenamiento').update(cambios).eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/**
 * Acciones sobre una sesión:
 * - `independizar` (fecha): clona la sesión solo para esa fecha y la quita de ahí en la original, para editarla sin afectar a otros días.
 * - `guardar_base` (categoria): guarda una copia en la biblioteca de sesiones base del coach.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await autorizarSesionCoach(request, id)
  if ('error' in a) return a.error
  const { admin, userId, planId } = a.ctx
  const body = await request.json().catch(() => null) as { accion?: unknown; fecha?: unknown; categoria?: unknown } | null

  const { data: origen } = await admin.from('sesiones_entrenamiento').select(CAMPOS_SESION).eq('id', id).single()
  const { data: ejOrigen } = await admin.from('sesion_ejercicios').select(CAMPOS_EJ).eq('sesion_id', id)
  if (!origen) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

  if (body?.accion === 'independizar') {
    if (!esFechaISO(body.fecha)) return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
    const fecha = body.fecha
    const { data: ultima } = await admin.from('sesiones_entrenamiento').select('orden').eq('plan_id', planId).order('orden', { ascending: false }).limit(1).maybeSingle()
    const { data: clon, error } = await admin.from('sesiones_entrenamiento')
      .insert({ ...origen, plan_id: planId, dia_semana: null, orden: ((ultima?.orden as number | null) ?? 0) + 1 })
      .select('id').single()
    if (error || !clon) return NextResponse.json({ error: 'No se pudo crear la copia' }, { status: 500 })
    const deshacer = async () => { await admin.from('sesiones_entrenamiento').delete().eq('id', clon.id) }
    if ((ejOrigen ?? []).length > 0) {
      const { error: e1 } = await admin.from('sesion_ejercicios').insert((ejOrigen ?? []).map(e => ({ ...e, sesion_id: clon.id })))
      if (e1) { await deshacer(); return NextResponse.json({ error: 'No se pudo crear la copia' }, { status: 500 }) }
    }
    // La copia vive solo en esa fecha; la original deja de aparecer ese día.
    const { error: e2 } = await admin.from('calendario_entreno_ajustes').insert([
      { plan_id: planId, sesion_id: clon.id, tipo: 'copiar', fecha_origen: null, fecha },
      { plan_id: planId, sesion_id: id, tipo: 'omitir', fecha_origen: fecha, fecha: null },
    ])
    if (e2) { await deshacer(); return NextResponse.json({ error: 'No se pudo crear la copia' }, { status: 500 }) }
    return NextResponse.json({ ok: true, sesion_id: clon.id })
  }

  if (body?.accion === 'guardar_base') {
    const categoria = body.categoria as CategoriaSesion
    const destino = PLANTILLA_POR_CATEGORIA[categoria]
    if (!destino || !CATEGORIAS_SESION.includes(categoria)) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
    const nombrePlantilla = `Mis sesiones · ${categoria}`
    let { data: plantilla } = await admin.from('plantillas_entrenamiento').select('id').eq('coach_id', userId).eq('nombre', nombrePlantilla).maybeSingle()
    if (!plantilla) {
      const { data: nueva, error } = await admin.from('plantillas_entrenamiento')
        .insert({ coach_id: userId, nombre: nombrePlantilla, descripcion: 'Sesiones guardadas desde el calendario del coach.', tipo: destino.tipo, sport_modality: destino.sport_modality, duracion_semanas: 4, activo: true })
        .select('id').single()
      if (error || !nueva) return NextResponse.json({ error: 'No se pudo guardar la sesión base' }, { status: 500 })
      plantilla = nueva
    }
    const { data: ultima } = await admin.from('plantilla_sesiones').select('orden').eq('plantilla_id', plantilla.id).order('orden', { ascending: false }).limit(1).maybeSingle()
    const { data: guardada, error } = await admin.from('plantilla_sesiones')
      .insert({ ...origen, plantilla_id: plantilla.id, dia_semana: null, orden: ((ultima?.orden as number | null) ?? 0) + 1 })
      .select('id').single()
    if (error || !guardada) return NextResponse.json({ error: 'No se pudo guardar la sesión base' }, { status: 500 })
    if ((ejOrigen ?? []).length > 0) {
      const { error: e1 } = await admin.from('plantilla_sesion_ejercicios').insert((ejOrigen ?? []).map(e => ({ ...e, sesion_id: guardada.id })))
      if (e1) { await admin.from('plantilla_sesiones').delete().eq('id', guardada.id); return NextResponse.json({ error: 'No se pudo guardar la sesión base' }, { status: 500 }) }
    }
    return NextResponse.json({ ok: true, plantilla: nombrePlantilla })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}

