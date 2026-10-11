// lib/integraciones/garmin-workouts.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { cifrarConexionGarmin, descifrarConexionGarmin } from './garmin-connect-perclient'
import { pasosAGarmin } from './garmin-workouts-formato'
import { validarPasos } from '@/lib/entrenos/pasos'
import { ritmosDesdeVdot } from '@/lib/entrenos/ritmos'
import { proximaFechaDia } from '@/lib/entrenos/proxima-fecha'
import { huellaPasos } from '@/lib/entrenos/garmin-auto'
import { zonasFcDesde } from '@/lib/entrenos/zonas-fc'
import { leerUmbrales } from '@/lib/rendimiento/garmin-entrenos'

export class ErrorGarmin extends Error {
  constructor(public mensaje: string, public status = 400) {
    super(mensaje)
  }
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

/** Envío por varias fechas (lo usa el cron): `recrear` crea el entreno y lo programa en todas; `anadir` programa fechas nuevas en el existente; `borrar` lo quita de Garmin. */
export interface OpcionesEnvioMulti {
  modo: 'recrear' | 'anadir' | 'borrar'
  fechas: string[]
}

export async function enviarSesionAGarmin(
  db: SupabaseClient,
  sesionId: string,
  fechaIso?: string,
  multi?: OpcionesEnvioMulti,
): Promise<{ workoutId: string; fecha: string | null }> {
  if (fechaIso !== undefined && !FECHA_RE.test(fechaIso)) throw new ErrorGarmin('Fecha inválida')
  if (multi && !multi.fechas.every(f => FECHA_RE.test(f))) throw new ErrorGarmin('Fecha inválida')

  const { data: sesion } = await db
    .from('sesiones_entrenamiento')
    .select('id, nombre, dia_semana, notas, pasos, garmin_workout_id, garmin_programado_fecha, garmin_fechas, plan_id')
    .eq('id', sesionId)
    .single()
  if (!sesion) throw new ErrorGarmin('Sesión no encontrada', 404)

  const validacion = validarPasos(sesion.pasos)
  if (!validacion.ok) throw new ErrorGarmin(`Esta sesión no tiene pasos de carrera válidos: ${validacion.error}`)

  const { data: plan } = await db.from('planes_entrenamiento').select('cliente_id').eq('id', sesion.plan_id).single()
  if (!plan) throw new ErrorGarmin('Plan no encontrado', 404)
  const clienteId = plan.cliente_id as string

  const { data: perfil } = await db.from('perfil_entreno_cliente').select('vdot').eq('cliente_id', clienteId).maybeSingle()
  const ritmos = perfil?.vdot ? ritmosDesdeVdot(Number(perfil.vdot)) : null
  const fc = zonasFcDesde(await leerUmbrales(db, clienteId))

  const { data: integ } = await db
    .from('integraciones_cliente')
    .select('credenciales_json')
    .eq('cliente_id', clienteId)
    .eq('proveedor', 'garmin_connect')
    .maybeSingle()
  if (!integ?.credenciales_json) throw new ErrorGarmin('Este atleta no tiene Garmin Connect conectado', 409)

  let conexion
  try {
    conexion = descifrarConexionGarmin(integ.credenciales_json)
  } catch {
    throw new ErrorGarmin('No se pudo leer la conexión de Garmin; vuelve a conectarla', 409)
  }

  const { GarminConnect } = await import('garmin-connect')
  let gc = new GarminConnect({ username: conexion.email, password: conexion.password })
  try {
    if (conexion.oauth1 && conexion.oauth2) {
      gc.loadToken(conexion.oauth1, conexion.oauth2)
      try {
        await gc.getUserProfile()
      } catch {
        gc = new GarminConnect({ username: conexion.email, password: conexion.password })
        await gc.login()
      }
    } else {
      await gc.login()
    }
  } catch {
    throw new ErrorGarmin('No se pudo iniciar sesión en Garmin; reconecta la cuenta', 409)
  }

  const api = () => (gc as unknown as { url: { GC_API: string } }).url.GC_API // `url` es privado en los tipos de la librería, pero existe en runtime.
  const huella = huellaPasos(sesion.pasos, perfil?.vdot ? Number(perfil.vdot) : null, fc?.E?.max ?? null)
  const programar = (workoutId: string, fecha: string) => gc.client.post(`${api()}/workout-service/schedule/${workoutId}`, { date: fecha })
  const borrarAnterior = async () => {
    if (!sesion.garmin_workout_id) return
    try { await gc.deleteWorkout({ workoutId: sesion.garmin_workout_id }) } catch { /* ya borrado en Garmin: no es un error */ }
  }
  const guardarTokens = async () => {
    try {
      const { oauth1, oauth2 } = gc.exportToken()
      await db.from('integraciones_cliente')
        .update({ credenciales_json: cifrarConexionGarmin({ email: conexion.email, password: conexion.password, oauth1, oauth2 }) })
        .eq('cliente_id', clienteId)
        .eq('proveedor', 'garmin_connect')
    } catch { /* no crítico */ }
  }
  const crear = async (): Promise<string> => {
    const payload = pasosAGarmin(sesion.nombre, validacion.pasos, ritmos, sesion.notas ?? undefined, fc)
    try {
      const creado = await gc.addWorkout(payload as never)
      return String((creado as unknown as { workoutId: number | string }).workoutId)
    } catch {
      throw new ErrorGarmin('Garmin rechazó el entreno. Inténtalo de nuevo; si persiste, avisa para revisar el formato', 502)
    }
  }

  if (multi) {
    // Incluye la fecha única del envío antiguo (garmin_programado_fecha) para no perderla ni duplicarla.
    const previas = [...new Set([...(Array.isArray(sesion.garmin_fechas) ? (sesion.garmin_fechas as string[]) : []), ...(sesion.garmin_programado_fecha ? [sesion.garmin_programado_fecha as string] : [])])]
    if (multi.modo === 'borrar') {
      await borrarAnterior()
      await db.from('sesiones_entrenamiento').update({ garmin_workout_id: null, garmin_programado_fecha: null, garmin_fechas: [], garmin_pasos_hash: null }).eq('id', sesionId)
      await guardarTokens()
      return { workoutId: '', fecha: null }
    }
    let workoutId = sesion.garmin_workout_id as string | null
    let programadas = previas
    if (multi.modo === 'recrear' || !workoutId) {
      await borrarAnterior()
      workoutId = await crear()
      programadas = []
    }
    const hechas: string[] = []
    try {
      for (const f of multi.fechas) { await programar(workoutId, f); hechas.push(f) }
    } finally {
      // Se guarda lo que sí quedó programado aunque una fecha falle, para no duplicar en el siguiente intento.
      const todas = [...new Set([...programadas, ...hechas])].sort()
      await db.from('sesiones_entrenamiento')
        .update({ garmin_workout_id: workoutId, garmin_fechas: todas, garmin_programado_fecha: todas[0] ?? null, garmin_pasos_hash: huella })
        .eq('id', sesionId)
    }
    await guardarTokens()
    return { workoutId, fecha: hechas[0] ?? null }
  }

  // Reenvío: borrar el entreno anterior para no duplicar.
  await borrarAnterior()
  const workoutId = await crear()

  const fecha = fechaIso ?? proximaFechaDia(sesion.dia_semana)
  if (fecha) {
    try {
      await programar(workoutId, fecha)
    } catch {
      // El entreno existe en Garmin pero no se pudo poner en el calendario.
      await db.from('sesiones_entrenamiento').update({ garmin_workout_id: workoutId, garmin_programado_fecha: null, garmin_fechas: [] }).eq('id', sesionId)
      throw new ErrorGarmin('El entreno se creó en Garmin pero no se pudo programar en el calendario; búscalo en Entrenamientos → Mis entrenamientos', 502)
    }
  }

  await db.from('sesiones_entrenamiento')
    .update({ garmin_workout_id: workoutId, garmin_programado_fecha: fecha, garmin_fechas: fecha ? [fecha] : [], garmin_pasos_hash: huella })
    .eq('id', sesionId)

  await guardarTokens()
  return { workoutId, fecha }
}
