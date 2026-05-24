import type { SupabaseClient } from '@supabase/supabase-js'

export type ActividadFlagTipo =
  | 'sync_inactiva'
  | 'recuperacion_baja'
  | 'carga_alta'
  | 'tdee_alto'
  | 'actividad_baja'
  | 'entreno_detectado_sin_registro'

export interface ActividadFlag {
  tipo: ActividadFlagTipo
  severidad: 'alta' | 'media' | 'baja'
  titulo: string
  descripcion: string
  accion: string
  valor?: number | string | null
}

export interface ActividadResumen {
  dias: number
  tiene_datos: boolean
  sesiones: number
  pasos_media: number
  calorias_activas_total: number
  tdee_media: number | null
  tss_total: number
  minutos_alta_intensidad_total: number
  hrv_media: number | null
  rhr_media: number | null
  fc_media_entreno: number | null
  body_battery_media: number | null
  stress_media: number | null
  readiness_media: number | null
  distancia_entreno_km_total: number
  proveedores: string[]
}

export interface ActividadCoachData {
  integraciones: Array<Record<string, unknown>>
  resumen: ActividadResumen
  actividades: Array<Record<string, unknown>>
  flags: ActividadFlag[]
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function avg(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v !== null)
  if (!valid.length) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

function sum(values: Array<number | null>): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0)
}

function round(value: number | null, digits = 0): number | null {
  if (value === null) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function calcularResumenActividad(rows: Array<Record<string, unknown>>, dias: number): ActividadResumen {
  const pasos = rows.map(r => asNumber(r.pasos))
  const tdee = rows.map(r => asNumber(r.calorias_totales))
  const hrv = rows.map(r => asNumber(r.hrv))
  const rhr = rows.map(r => asNumber(r.rhr))
  const fcMedia = rows.map(r => asNumber(r.fc_media))
  const bodyBattery = rows.map(r => asNumber(r.body_battery_end))
  const stress = rows.map(r => asNumber(r.stress_avg))
  const readiness = rows.map(r => asNumber(r.training_readiness))

  return {
    dias,
    tiene_datos: rows.length > 0,
    sesiones: rows.filter(r => Boolean(r.tipo_entreno)).length,
    pasos_media: Math.round(avg(pasos) ?? 0),
    calorias_activas_total: Math.round(sum(rows.map(r => asNumber(r.calorias_activas)))),
    tdee_media: round(avg(tdee)),
    tss_total: round(sum(rows.map(r => asNumber(r.tss))), 1) ?? 0,
    minutos_alta_intensidad_total: Math.round(sum(rows.map(r => asNumber(r.minutos_alta_intensidad)))),
    hrv_media: round(avg(hrv), 1),
    rhr_media: round(avg(rhr)),
    fc_media_entreno: round(avg(fcMedia)),
    body_battery_media: round(avg(bodyBattery)),
    stress_media: round(avg(stress)),
    readiness_media: round(avg(readiness)),
    distancia_entreno_km_total: round(sum(rows.map(r => asNumber(r.distancia_entreno_km))), 1) ?? 0,
    proveedores: [...new Set(rows.map(r => String(r.proveedor)).filter(Boolean))],
  }
}

export function calcularFlagsActividad(params: {
  resumen: ActividadResumen
  integraciones: Array<Record<string, unknown>>
  planKcalObjetivo?: number | null
  registrosApp7d?: number
}): ActividadFlag[] {
  const { resumen, integraciones, planKcalObjetivo, registrosApp7d = 0 } = params
  const flags: ActividadFlag[] = []

  const integracionesActivas = integraciones.filter(i => i.activa !== false)
  const ultimaSyncMs = Math.max(
    0,
    ...integracionesActivas
      .map(i => i.ultima_sync ? new Date(String(i.ultima_sync)).getTime() : 0)
      .filter(Number.isFinite)
  )
  const diasSinSync = ultimaSyncMs ? Math.floor((Date.now() - ultimaSyncMs) / 86_400_000) : null

  if (integracionesActivas.length > 0 && (diasSinSync === null || diasSinSync >= 3)) {
    flags.push({
      tipo: 'sync_inactiva',
      severidad: 'media',
      titulo: 'Sin sincronización reciente',
      descripcion: diasSinSync === null ? 'Hay integraciones activas sin una sincronización registrada.' : `La última sincronización fue hace ${diasSinSync} días.`,
      accion: 'Revisar conexión antes de interpretar carga o recuperación.',
      valor: diasSinSync,
    })
  }

  if ((resumen.hrv_media !== null && resumen.hrv_media < 45) || (resumen.readiness_media !== null && resumen.readiness_media < 45) || (resumen.body_battery_media !== null && resumen.body_battery_media < 35)) {
    flags.push({
      tipo: 'recuperacion_baja',
      severidad: 'alta',
      titulo: 'Recuperación comprometida',
      descripcion: `HRV ${resumen.hrv_media ?? 'sin dato'} · readiness ${resumen.readiness_media ?? 'sin dato'} · body battery ${resumen.body_battery_media ?? 'sin dato'}.`,
      accion: 'Valorar descarga, reducir intensidad y no recortar calorías de forma agresiva.',
      valor: resumen.readiness_media ?? resumen.body_battery_media ?? resumen.hrv_media,
    })
  }

  if (resumen.tss_total >= 400 || resumen.minutos_alta_intensidad_total >= 180) {
    flags.push({
      tipo: 'carga_alta',
      severidad: 'alta',
      titulo: 'Carga semanal alta',
      descripcion: `TSS ${resumen.tss_total} · ${resumen.minutos_alta_intensidad_total} min de alta intensidad.`,
      accion: 'Ajustar recuperación y subir carbohidratos en sesiones clave si el objetivo lo permite.',
      valor: resumen.tss_total,
    })
  }

  if (planKcalObjetivo && resumen.tdee_media && resumen.tdee_media - planKcalObjetivo >= 450) {
    flags.push({
      tipo: 'tdee_alto',
      severidad: 'media',
      titulo: 'TDEE real por encima del plan',
      descripcion: `TDEE medio ${resumen.tdee_media} kcal frente a objetivo ${planKcalObjetivo} kcal.`,
      accion: 'Revisar déficit real, hambre, rendimiento y timing de carbohidratos.',
      valor: resumen.tdee_media - planKcalObjetivo,
    })
  }

  if (resumen.tiene_datos && resumen.pasos_media > 0 && resumen.pasos_media < 4500 && resumen.sesiones === 0) {
    flags.push({
      tipo: 'actividad_baja',
      severidad: 'media',
      titulo: 'Actividad semanal baja',
      descripcion: `Media de ${resumen.pasos_media} pasos/día y sin sesiones detectadas.`,
      accion: 'Priorizar adherencia mínima antes de subir carga o endurecer dieta.',
      valor: resumen.pasos_media,
    })
  }

  if (resumen.sesiones > 0 && registrosApp7d === 0) {
    flags.push({
      tipo: 'entreno_detectado_sin_registro',
      severidad: 'baja',
      titulo: 'Entreno detectado fuera de la app',
      descripcion: `${resumen.sesiones} sesiones externas detectadas sin registros internos esta semana.`,
      accion: 'Usar Garmin/Strava como fuente de adherencia y simplificar el registro manual.',
      valor: resumen.sesiones,
    })
  }

  return flags
}

export async function cargarActividadCoach(
  db: SupabaseClient,
  clienteId: string,
  dias = 14
): Promise<ActividadCoachData> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().split('T')[0]

  const [integracionesRes, actividadRes, planRes, registrosRes] = await Promise.all([
    db
      .from('integraciones_cliente')
      .select('id, proveedor, activa, ultima_sync, error_ultimo, created_at')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false }),
    db
      .from('actividad_externa_cliente')
      .select('*')
      .eq('cliente_id', clienteId)
      .gte('fecha', desde)
      .order('fecha', { ascending: false })
      .limit(120),
    db
      .from('planes_nutricion')
      .select('kcal_objetivo')
      .eq('cliente_id', clienteId)
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('registros_sets')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .gte('fecha', desde),
  ])

  if (integracionesRes.error) throw new Error(integracionesRes.error.message)
  if (actividadRes.error) throw new Error(actividadRes.error.message)

  const actividades = (actividadRes.data ?? []) as Array<Record<string, unknown>>
  const integraciones = (integracionesRes.data ?? []) as Array<Record<string, unknown>>
  const resumen = calcularResumenActividad(actividades, dias)
  const flags = calcularFlagsActividad({
    resumen,
    integraciones,
    planKcalObjetivo: asNumber(planRes.data?.kcal_objetivo),
    registrosApp7d: registrosRes.count ?? 0,
  })

  return { integraciones, resumen, actividades, flags }
}
