import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { copiarSesionesPlanAPlantilla } from '@/lib/entrenos/copiar-plan'

const MODALIDADES_VALIDAS = ['gym_estetica', 'gym_fuerza', 'funcional', 'hyrox', 'ciclismo', 'running', 'hibrido', 'calistenia', 'natacion', 'triatlon']

/** Guarda la estructura semanal de un plan (de un cliente o el activo de Carlos) como plantilla reutilizable. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => null) as { nombre?: unknown } | null
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  if (nombre.length < 1 || nombre.length > 80) return NextResponse.json({ error: 'Nombre (1-80 caracteres) obligatorio' }, { status: 400 })

  const admin = createServiceSupabase()
  const { data: plan } = await admin.from('planes_entrenamiento').select('id, coach_id, cliente_id, descripcion, duracion_semanas').eq('id', id).maybeSingle()
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  if (plan.coach_id !== user.id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { data: perfil } = await admin.from('perfil_entreno_cliente').select('sport_modality').eq('cliente_id', plan.cliente_id).maybeSingle()
  const modalidad = MODALIDADES_VALIDAS.includes(perfil?.sport_modality as string) ? (perfil!.sport_modality as string) : null
  const tipo = modalidad && ['running', 'ciclismo', 'natacion'].includes(modalidad) ? 'cardio' : modalidad && modalidad.startsWith('gym') ? 'gimnasio' : 'mixto'

  const { data: plantilla, error } = await admin.from('plantillas_entrenamiento')
    .insert({ coach_id: user.id, nombre, descripcion: plan.descripcion ?? 'Guardada desde un plan de cliente.', tipo, sport_modality: modalidad, duracion_semanas: plan.duracion_semanas ?? 4, activo: true })
    .select('id').single()
  if (error || !plantilla) return NextResponse.json({ error: 'No se pudo guardar la plantilla' }, { status: 500 })

  const copia = await copiarSesionesPlanAPlantilla(admin, id, plantilla.id)
  if (!copia.ok) {
    await admin.from('plantillas_entrenamiento').delete().eq('id', plantilla.id)
    return NextResponse.json({ error: 'El plan no tiene sesiones con día de la semana que guardar' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, plantilla_id: plantilla.id, sesiones: copia.sesiones })
}
