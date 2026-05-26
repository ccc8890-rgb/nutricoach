// lib/integraciones/normalizer.ts
// Persiste actividades normalizadas en actividad_externa_cliente y calcula resúmenes

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActividadExterna, ResumenActividadSemanal, Proveedor } from './types'

export async function persistirActividades(
  db: SupabaseClient,
  actividades: ActividadExterna[]
): Promise<number> {
  if (actividades.length === 0) return 0

  // Eliminar campos undefined para que upsert no sobreescriba con null
  const limpias = actividades.map(a => {
    const obj: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(a)) {
      if (v !== undefined) obj[k] = v
    }
    return obj
  })

  for (const actividad of limpias) {
    let deleteQuery = db
      .from('actividad_externa_cliente')
      .delete()
      .eq('cliente_id', actividad.cliente_id as string)
      .eq('proveedor', actividad.proveedor as string)

    if (actividad.proveedor_activity_id) {
      deleteQuery = deleteQuery.eq('proveedor_activity_id', actividad.proveedor_activity_id as string)
    } else {
      deleteQuery = deleteQuery
        .eq('fecha', actividad.fecha as string)
        .is('proveedor_activity_id', null)
    }

    const { error: deleteError } = await deleteQuery
    if (deleteError) throw new Error(`persistirActividades delete: ${deleteError.message}`)
  }

  const { error } = await db
    .from('actividad_externa_cliente')
    .insert(limpias)

  if (error) throw new Error(`persistirActividades insert: ${error.message}`)

  return actividades.length
}

export async function getSummaryLast7d(
  db: SupabaseClient,
  clienteId: string
): Promise<ResumenActividadSemanal> {
  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const { data } = await db
    .from('actividad_externa_cliente')
    .select('*')
    .eq('cliente_id', clienteId)
    .gte('fecha', hace7dias)
    .order('fecha', { ascending: false })

  const rows = data ?? []

  if (rows.length === 0) {
    return {
      pasos_media: 0, calorias_activas_total: 0, tdee_estimado: 0,
      tss_semanal: 0, hrv_media: null, sesiones_entreno: 0,
      minutos_alta_intensidad_total: 0, dia_mas_activo: null,
      fuentes: [], tiene_datos: false,
      body_battery_media: null, stress_avg_media: null,
      training_readiness_media: null, rhr_media: null,
    }
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const sum = (arr: (number | null | undefined)[]) =>
    arr.reduce((acc: number, b) => acc + (b ?? 0), 0)

  const pasos = rows.map(r => r.pasos).filter(Boolean) as number[]
  const hrv = rows.map(r => r.hrv).filter(Boolean) as number[]
  const tdee = rows.map(r => r.calorias_totales).filter(Boolean) as number[]

  // Día de la semana con más pasos
  const pasosPorDia: Record<string, number> = {}
  for (const r of rows) {
    if (r.pasos) {
      const dia = new Date(r.fecha).toLocaleDateString('es-ES', { weekday: 'long' })
      pasosPorDia[dia] = (pasosPorDia[dia] ?? 0) + r.pasos
    }
  }
  const diaMasActivo = Object.entries(pasosPorDia).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const bodyBattery = rows.map(r => r.body_battery_end).filter(v => v != null) as number[]
  const stressVals = rows.map(r => r.stress_avg).filter(v => v != null) as number[]
  const readiness = rows.map(r => r.training_readiness).filter(v => v != null) as number[]
  const rhrVals = rows.map(r => r.rhr).filter(v => v != null) as number[]

  return {
    pasos_media: Math.round(avg(pasos)),
    calorias_activas_total: sum(rows.map(r => r.calorias_activas)),
    tdee_estimado: tdee.length ? Math.round(avg(tdee)) : 0,
    tss_semanal: sum(rows.map(r => r.tss)),
    hrv_media: hrv.length ? parseFloat(avg(hrv).toFixed(1)) : null,
    sesiones_entreno: rows.filter(r => r.tipo_entreno).length,
    minutos_alta_intensidad_total: sum(rows.map(r => r.minutos_alta_intensidad)),
    dia_mas_activo: diaMasActivo,
    fuentes: [...new Set(rows.map(r => r.proveedor))] as Proveedor[],
    tiene_datos: true,
    body_battery_media: bodyBattery.length ? Math.round(avg(bodyBattery)) : null,
    stress_avg_media: stressVals.length ? Math.round(avg(stressVals)) : null,
    training_readiness_media: readiness.length ? Math.round(avg(readiness)) : null,
    rhr_media: rhrVals.length ? Math.round(avg(rhrVals)) : null,
  }
}
