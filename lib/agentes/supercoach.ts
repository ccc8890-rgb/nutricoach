import { createServiceSupabase } from '@/lib/supabase-server'
import { cargarActividadCoach } from '@/lib/actividad/coach-insights'
import { seleccionarProtocolos } from '@/lib/knowledge-base'
import { guardarTareaAgente } from './executor'
import { crearAccionesSupercoach } from './supercoach-engine'
import type { PerfilEntrenoCliente } from '@/types'

function getDesde(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]
}

export async function ejecutarDirectorSupercoachCliente(clienteId: string): Promise<{ generadas: number }> {
  const db = createServiceSupabase()
  const desde7 = getDesde(7)

  const [
    planNutricionRes,
    planEntrenoRes,
    perfilEntrenoRes,
    clienteRes,
    onboardingRes,
    perfilProfundoRes,
    registros7Res,
    pendientesRes,
  ] = await Promise.all([
    db
      .from('planes_nutricion')
      .select('kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo')
      .eq('cliente_id', clienteId)
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('planes_entrenamiento')
      .select('id, nombre')
      .eq('cliente_id', clienteId)
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('perfil_entreno_cliente')
      .select('*')
      .eq('cliente_id', clienteId)
      .maybeSingle(),
    db
      .from('clientes')
      .select('objetivo, edad, sexo, restricciones_alimentarias')
      .eq('id', clienteId)
      .maybeSingle(),
    db
      .from('onboarding_responses')
      .select('objetivo, tipo_entreno')
      .eq('cliente_id', clienteId)
      .maybeSingle(),
    db
      .from('onboarding_perfil_profundo')
      .select('condiciones_salud')
      .eq('cliente_id', clienteId)
      .maybeSingle(),
    db
      .from('registros_sets')
      .select('fecha, esfuerzo_percibido')
      .eq('cliente_id', clienteId)
      .gte('fecha', desde7),
    db
      .from('agente_tareas')
      .select('tipo')
      .eq('cliente_id', clienteId)
      .eq('agente', 'supercoach')
      .eq('estado', 'pendiente'),
  ])

  if (planNutricionRes.error && planNutricionRes.error.code !== 'PGRST116') throw new Error(planNutricionRes.error.message)
  if (planEntrenoRes.error && planEntrenoRes.error.code !== 'PGRST116') throw new Error(planEntrenoRes.error.message)
  if (perfilEntrenoRes.error && perfilEntrenoRes.error.code !== 'PGRST116') throw new Error(perfilEntrenoRes.error.message)
  if (clienteRes.error && clienteRes.error.code !== 'PGRST116') throw new Error(clienteRes.error.message)
  if (onboardingRes.error && onboardingRes.error.code !== 'PGRST116') throw new Error(onboardingRes.error.message)
  if (perfilProfundoRes.error && perfilProfundoRes.error.code !== 'PGRST116') throw new Error(perfilProfundoRes.error.message)

  const actividad = await cargarActividadCoach(db, clienteId, 14).catch(() => null)
  const sesiones7 = new Set((registros7Res.data ?? []).map(r => r.fecha)).size
  const rpeValues = (registros7Res.data ?? [])
    .map(r => r.esfuerzo_percibido)
    .filter((v): v is number => typeof v === 'number')
  const rpeMedia7 = rpeValues.length ? Math.round((rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length) * 10) / 10 : null

  const perfilEntreno = perfilEntrenoRes.data as PerfilEntrenoCliente | null
  const planEntrenoRaw = planEntrenoRes.data as { id: string; nombre: string } | null
  const { count: sesionesPlan } = planEntrenoRaw?.id
    ? await db.from('sesiones_entrenamiento').select('id', { count: 'exact', head: true }).eq('plan_id', planEntrenoRaw.id)
    : { count: null }
  const planEntreno = planEntrenoRaw
    ? { nombre: planEntrenoRaw.nombre, sesiones_por_semana: sesionesPlan ?? null }
    : null
  const sesionesObjetivo = planEntreno?.sesiones_por_semana ?? perfilEntreno?.dias_disponibles ?? null
  const adherencia = sesionesObjetivo ? Math.round((sesiones7 / sesionesObjetivo) * 100) : null
  const tiposPendientes = new Set((pendientesRes.data ?? []).map(t => t.tipo))
  const cliente = clienteRes.data as { objetivo?: string | null; edad?: number | null; sexo?: 'hombre' | 'mujer' | 'otro' | null; restricciones_alimentarias?: string | null } | null
  const onboarding = onboardingRes.data as { objetivo?: string | null; tipo_entreno?: string[] | string | null } | null
  const perfilProfundo = perfilProfundoRes.data as { condiciones_salud?: string | null } | null
  const tipoEntreno = Array.isArray(onboarding?.tipo_entreno)
    ? onboarding?.tipo_entreno.join(', ')
    : onboarding?.tipo_entreno

  const evidencia = await seleccionarProtocolos(db, {
    objetivo: onboarding?.objetivo ?? cliente?.objetivo,
    tipo_entreno: perfilEntreno?.sport_modality ?? tipoEntreno,
    condiciones_salud: perfilProfundo?.condiciones_salud,
    restricciones_alimentarias: cliente?.restricciones_alimentarias,
    edad: cliente?.edad,
    sexo: cliente?.sexo,
  }, 5)

  const acciones = crearAccionesSupercoach({
    clienteId,
    planNutricion: planNutricionRes.data,
    planEntreno,
    perfilEntreno,
    actividad,
    evidencia,
    rendimiento: {
      sesiones_7d: sesiones7,
      sesiones_objetivo_semana: sesionesObjetivo,
      adherencia_7d_pct: adherencia,
      rpe_media_7d: rpeMedia7,
    },
  })

  let generadas = 0
  for (const accion of acciones) {
    if (tiposPendientes.has(accion.tipo)) continue
    const tarea = await guardarTareaAgente(accion.agente, accion, clienteId)
    if (tarea) generadas += 1
  }

  return { generadas }
}
