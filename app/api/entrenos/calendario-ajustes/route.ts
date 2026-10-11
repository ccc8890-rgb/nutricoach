import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { aplicarCambios, diferenciaDias, esFechaISO, planificarOperacion, type Ajuste, type Operacion } from '@/lib/entrenos/calendario-ajustes'
import { plantillaActivaEn } from '@/lib/entrenos/ventana-plan'

const MAX_OPERACIONES = 60

/** Fechas razonables (±3 años desde hoy): evita basura en la tabla por una petición manipulada. */
function fechaEnRango(f: unknown): boolean {
  if (!esFechaISO(f)) return false
  const dias = Math.abs(diferenciaDias(new Date().toISOString().slice(0, 10), f))
  return dias <= 1100
}

function operacionValida(o: unknown): o is Operacion {
  if (typeof o !== 'object' || o === null) return false
  const x = o as Record<string, unknown>
  if (typeof x.sesion_id !== 'string') return false
  if (x.op === 'mover') return fechaEnRango(x.desde) && fechaEnRango(x.hasta)
  if (x.op === 'copiar') return fechaEnRango(x.hasta)
  if (x.op === 'omitir') return fechaEnRango(x.desde)
  return false
}

/** Mueve, copia o quita sesiones en fechas concretas del calendario de un plan, sin tocar la plantilla semanal. */
export async function POST(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => null) as { plan_id?: string; operaciones?: unknown[] } | null
  const planId = body?.plan_id
  const ops = body?.operaciones
  if (!planId || !Array.isArray(ops) || ops.length === 0 || ops.length > MAX_OPERACIONES || !ops.every(operacionValida)) {
    return NextResponse.json({ error: 'plan_id y operaciones válidas son obligatorios' }, { status: 400 })
  }

  const admin = createServiceSupabase()
  const { data: plan } = await admin
    .from('planes_entrenamiento')
    .select('id, coach_id, created_at, duracion_semanas')
    .eq('id', planId)
    .maybeSingle()
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  if (plan.coach_id !== user.id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { data: sesiones } = await admin.from('sesiones_entrenamiento').select('id, dia_semana').eq('plan_id', plan.id)
  const idsSesiones = new Set((sesiones ?? []).map(s => s.id as string))
  if (!(ops as Operacion[]).every(o => idsSesiones.has(o.sesion_id))) {
    return NextResponse.json({ error: 'Alguna sesión no pertenece al plan' }, { status: 400 })
  }

  const { data: actuales } = await admin
    .from('calendario_entreno_ajustes')
    .select('id, sesion_id, tipo, fecha_origen, fecha')
    .eq('plan_id', plan.id)
  let ajustes = (actuales ?? []) as Ajuste[]
  const activa = plantillaActivaEn(plan.created_at, plan.duracion_semanas as number | null)

  let aplicados = 0
  for (const o of ops as Operacion[]) {
    const cambios = planificarOperacion(o, sesiones ?? [], ajustes, activa)
    if (cambios.length === 0) continue
    // Los ids nuevos se generan aquí para poder encadenar operaciones sin releer la tabla.
    const conIds = cambios.map(c => (c.accion === 'insertar' ? { ...c, id: randomUUID() } : c))
    for (const c of conIds) {
      const r = c.accion === 'insertar'
        ? await admin.from('calendario_entreno_ajustes').insert({ id: (c as { id: string }).id, plan_id: plan.id, ...c.fila })
        : c.accion === 'actualizar'
          ? await admin.from('calendario_entreno_ajustes').update(c.cambios).eq('id', c.id).eq('plan_id', plan.id)
          : await admin.from('calendario_entreno_ajustes').delete().eq('id', c.id).eq('plan_id', plan.id)
      if (r.error) return NextResponse.json({ error: 'No se pudo guardar el cambio' }, { status: 500 })
    }
    const ids = conIds.filter(c => c.accion === 'insertar').map(c => (c as { id: string }).id)
    ajustes = aplicarCambios(ajustes, cambios, () => ids.shift() as string)
    aplicados++
  }

  return NextResponse.json({ ok: true, aplicados })
}
