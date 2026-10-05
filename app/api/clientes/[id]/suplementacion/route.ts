import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { faseEnFecha } from '@/lib/nutricion/competicion'
import { DIAS_SEMANA } from '@/lib/nutricion/comidas-dia'
import { clasificarDiaNutricional } from '@/lib/periodizacion/dia-entreno-nutricion'
import { recomendarSuplementos, type ContextoSuplementos } from '@/lib/nutricion/suplementos'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { data: { user }, error: authError } = await createApiSupabase(request).auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params
    const db = createServiceSupabase()
    const acceso = await autorizarCoachCliente(db, { userId: user.id, clienteId: id })
    if (!acceso.ok) return NextResponse.json({ error: acceso.mensaje }, { status: acceso.status })

    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const limite = new Date(`${hoy}T00:00:00Z`)
    limite.setUTCDate(limite.getUTCDate() - 10)
    const [clienteRes, pesoRes, competicionRes, planRes, onboardingRes] = await Promise.all([
      db.from('clientes').select('objetivo,peso_inicial,edad,sexo').eq('id', id).single(),
      db.from('checkins').select('peso').eq('cliente_id', id).not('peso', 'is', null).order('fecha', { ascending: false }).limit(1).maybeSingle(),
      db.from('competiciones').select('disciplina,fecha_competicion').eq('cliente_id', id).eq('activo', true).gte('fecha_competicion', limite.toISOString().slice(0, 10)).order('fecha_competicion', { ascending: true }).limit(1).maybeSingle(),
      db.from('planes_entrenamiento').select('id').eq('cliente_id', id).eq('activo', true).limit(1).maybeSingle(),
      db.from('onboarding_perfil_profundo').select('hora_entreno,condiciones_salud').eq('cliente_id', id).maybeSingle(),
    ])
    if (clienteRes.error || pesoRes.error || competicionRes.error || planRes.error || onboardingRes.error || !clienteRes.data) throw new Error('Error al consultar contexto de suplementacion')
    const peso = Number(pesoRes.data?.peso ?? clienteRes.data.peso_inicial)
    if (!Number.isFinite(peso) || peso <= 0) return NextResponse.json({ error: 'Falta un peso valido para calcular las dosis' }, { status: 422 })

    const dia = DIAS_SEMANA[(new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7]
    const sesionesRes = planRes.data
      ? await db.from('sesiones_entrenamiento').select('nombre,duracion_estimada_min').eq('plan_id', planRes.data.id).eq('dia_semana', dia)
      : null
    if (sesionesRes?.error) throw new Error('Error al consultar sesiones')
    const prioridad = { entreno_hibrido: 3, entreno_cardio: 2, entreno_fuerza: 1, descanso_activo: 0, descanso_total: 0 }
    const sesion = (sesionesRes?.data ?? []).slice().sort((a, b) => {
      const tipoA = clasificarDiaNutricional(a.nombre, true)
      const tipoB = clasificarDiaNutricional(b.nombre, true)
      return prioridad[tipoB] - prioridad[tipoA] || (b.duracion_estimada_min ?? 0) - (a.duracion_estimada_min ?? 0)
    })[0]
    const tipo = sesion ? clasificarDiaNutricional(sesion.nombre, true) : null
    const sexo = clienteRes.data.sexo
    const ctx: ContextoSuplementos = {
      peso_kg: peso,
      ...(sexo === 'hombre' || sexo === 'mujer' || sexo === 'otro' ? { sexo } : {}),
      edad: clienteRes.data.edad ?? undefined,
      objetivo: clienteRes.data.objetivo ?? undefined,
      disciplina: competicionRes.data?.disciplina ?? undefined,
      fase_competicion: competicionRes.data ? faseEnFecha(competicionRes.data.fecha_competicion, hoy, competicionRes.data.disciplina) : undefined,
      duracion_min: sesion?.duracion_estimada_min ?? undefined,
      tipo_sesion: tipo === 'entreno_hibrido' ? 'hibrido' : tipo === 'entreno_cardio' ? 'cardio' : tipo === 'entreno_fuerza' ? 'fuerza' : undefined,
      hora_inicio: onboardingRes.data?.hora_entreno ?? undefined,
      condiciones: onboardingRes.data?.condiciones_salud ? [onboardingRes.data.condiciones_salud] : undefined,
    }
    return NextResponse.json({ ...recomendarSuplementos(ctx), ctx })
  } catch (error) {
    console.error('Error GET /api/clientes/[id]/suplementacion:', error)
    return NextResponse.json({ error: 'Error al obtener suplementacion' }, { status: 500 })
  }
}
