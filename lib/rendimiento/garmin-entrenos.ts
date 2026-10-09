// lib/rendimiento/garmin-entrenos.ts
// Trae los entrenos individuales de Garmin Connect (ritmo, pulso, zonas, carga) a entrenos_realizados.
import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularTss, velocidadUmbralMs, type UmbralesAtleta } from './carga'

/* eslint-disable @typescript-eslint/no-explicit-any */
type ActividadGarmin = Record<string, any>

/** Umbrales del atleta: los últimos que Garmin ha medido (resumen diario) y el pulso máximo visto. */
export async function leerUmbrales(db: SupabaseClient, clienteId: string): Promise<UmbralesAtleta> {
  const { data: dias } = await db
    .from('actividad_externa_cliente')
    .select('raw_data')
    .eq('cliente_id', clienteId)
    .eq('proveedor', 'garmin_connect')
    .order('fecha', { ascending: false })
    .limit(30)
  const raw = (dias ?? []).map(d => d.raw_data as Record<string, any> | null).find(r => r?.lactate_threshold_hr)
  const { data: max } = await db
    .from('entrenos_realizados')
    .select('fc_max')
    .eq('cliente_id', clienteId)
    .not('fc_max', 'is', null)
    .order('fc_max', { ascending: false })
    .limit(1)
  return {
    fcUmbral: raw?.lactate_threshold_hr ? Number(raw.lactate_threshold_hr) : null,
    velUmbralMs: velocidadUmbralMs(raw?.lactate_threshold_speed),
    fcMax: max?.[0]?.fc_max ?? null,
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function mapearActividadGarmin(a: ActividadGarmin, clienteId: string, u: UmbralesAtleta) {
  const tipo: string | null = a.activityType?.typeKey ?? null
  const duracion = num(a.duration)
  const velocidadMedia = num(a.averageSpeed)
  const velocidadGap = num(a.avgGradeAdjustedSpeed)
  const zonas = [1, 2, 3, 4, 5].map(i => Math.round(num(a[`hrTimeInZone_${i}`]) ?? 0))
  const tieneZonas = zonas.some(z => z > 0)
  const tss = calcularTss(
    {
      tipo,
      duracion_s: duracion,
      velocidadMs: velocidadGap ?? velocidadMedia,
      fc_media: num(a.averageHR),
      tiempo_zona_fc: tieneZonas ? zonas : null,
    },
    u,
  )
  const fecha = String(a.startTimeLocal ?? '').slice(0, 10)
  return {
    cliente_id: clienteId,
    fuente: 'garmin_connect',
    actividad_id: String(a.activityId),
    fecha,
    inicio_local: a.startTimeLocal ? String(a.startTimeLocal).replace(' ', 'T') : null,
    tipo,
    nombre: a.activityName ?? null,
    duracion_s: duracion ? Math.round(duracion) : null,
    distancia_m: num(a.distance),
    ritmo_medio_s_km: velocidadMedia && velocidadMedia > 0 ? Math.round((1000 / velocidadMedia) * 10) / 10 : null,
    fc_media: num(a.averageHR) ? Math.round(a.averageHR) : null,
    fc_max: num(a.maxHR) ? Math.round(a.maxHR) : null,
    desnivel_m: num(a.elevationGain),
    carga_garmin: num(a.activityTrainingLoad) !== null ? Math.round(a.activityTrainingLoad * 10) / 10 : null,
    efecto_aerobico: num(a.aerobicTrainingEffect),
    efecto_anaerobico: num(a.anaerobicTrainingEffect),
    vo2max: num(a.vO2MaxValue),
    tiempo_zona_fc: tieneZonas ? zonas : null,
    mejores_parciales: {
      s1000: num(a.fastestSplit_1000),
      s1609: num(a.fastestSplit_1609),
      s5000: num(a.fastestSplit_5000),
    },
    tss: tss?.tss ?? null,
    tss_metodo: tss?.metodo ?? null,
    raw: {
      gap_ms: velocidadGap,
      cadencia: num(a.averageRunningCadenceInStepsPerMinute),
      zancada_m: num(a.avgStrideLength),
      contacto_suelo_ms: num(a.avgGroundContactTime),
      oscilacion_vertical_cm: num(a.avgVerticalOscillation),
      etiqueta_efecto: a.trainingEffectLabel ?? null,
      vueltas: num(a.lapCount),
      workout_id: a.workoutId ?? null,
    },
  }
}

/** Pide a Garmin los últimos `limite` entrenos y los guarda (upsert por actividad). Devuelve cuántos. */
export async function sincronizarEntrenosGarmin(
  db: SupabaseClient,
  clienteId: string,
  gc: { getActivities(start?: number, limit?: number): Promise<unknown[]> },
  limite = 20,
): Promise<number> {
  const acts: ActividadGarmin[] = []
  const pagina = 100
  for (let inicio = 0; inicio < limite; inicio += pagina) {
    const lote = (await gc.getActivities(inicio, Math.min(pagina, limite - inicio))) as ActividadGarmin[]
    acts.push(...lote)
    if (lote.length < Math.min(pagina, limite - inicio)) break
  }
  if (!acts.length) return 0

  const u = await leerUmbrales(db, clienteId)
  if (!u.fcMax) {
    const visto = Math.max(0, ...acts.map(a => num(a.maxHR) ?? 0))
    u.fcMax = visto > 0 ? visto : null
  }
  const filas = acts.filter(a => a.activityId && a.startTimeLocal).map(a => mapearActividadGarmin(a, clienteId, u))
  const { error } = await db.from('entrenos_realizados').upsert(filas, { onConflict: 'cliente_id,fuente,actividad_id' })
  if (error) throw new Error(`sincronizarEntrenosGarmin: ${error.message}`)
  return filas.length
}

export interface VueltaEntreno {
  tipo: string | null
  paso: number | null
  distancia_m: number
  duracion_s: number
  fc_media: number | null
  velocidad_ms: number | null
}

/** Convierte las vueltas que devuelve Garmin al formato compacto que guardamos. */
export function mapearVueltasGarmin(respuesta: unknown): VueltaEntreno[] {
  const laps = (respuesta as { lapDTOs?: ActividadGarmin[] } | null)?.lapDTOs
  if (!Array.isArray(laps)) return []
  return laps
    .filter(l => num(l.distance) !== null && num(l.duration) !== null)
    .map(l => ({
      tipo: typeof l.intensityType === 'string' ? l.intensityType : null,
      paso: num(l.wktStepIndex),
      distancia_m: Math.round(l.distance),
      duracion_s: Math.round(l.duration * 10) / 10,
      fc_media: num(l.averageHR) !== null ? Math.round(l.averageHR) : null,
      velocidad_ms: num(l.averageSpeed) !== null ? Math.round(l.averageSpeed * 1000) / 1000 : null,
    }))
}

const TIPOS_CON_VUELTAS = ['running', 'track_running', 'trail_running']

/**
 * Descarga las vueltas de los entrenos de carrera que aún no las tienen (más recientes primero).
 * Una llamada a Garmin por entreno; `maximo` acota cuántos por pasada.
 */
export async function sincronizarVueltasGarmin(
  db: SupabaseClient,
  clienteId: string,
  gc: { client: { get<T>(url: string): Promise<T> } },
  maximo = 10,
): Promise<number> {
  const { data: pendientes } = await db
    .from('entrenos_realizados')
    .select('id,actividad_id')
    .eq('cliente_id', clienteId)
    .eq('fuente', 'garmin_connect')
    .in('tipo', TIPOS_CON_VUELTAS)
    .is('vueltas', null)
    .order('fecha', { ascending: false })
    .limit(maximo)
  let hechas = 0
  for (const p of pendientes ?? []) {
    try {
      const r = await gc.client.get<unknown>(`https://connectapi.garmin.com/activity-service/activity/${p.actividad_id}/splits`)
      const vueltas = mapearVueltasGarmin(r)
      // Si Garmin no devuelve vueltas se guarda [] para no volver a pedirlas cada día.
      await db.from('entrenos_realizados').update({ vueltas }).eq('id', p.id)
      hechas++
    } catch (e) {
      console.error('[garmin] vueltas', p.actividad_id, e instanceof Error ? e.message : e)
    }
  }
  return hechas
}
