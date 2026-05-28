// lib/integraciones/types.ts

export type Proveedor = 'strava' | 'garmin' | 'garmin_connect' | 'google_fit' | 'whoop' | 'coros' | 'manual'

export interface IntegracionCliente {
  id: string
  cliente_id: string
  proveedor: Proveedor
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  proveedor_user_id: string | null
  scope: string | null
  activa: boolean
  ultima_sync: string | null
  error_ultimo: string | null
}

// Schema normalizado — lo que entra en actividad_externa_cliente
export interface ActividadExterna {
  cliente_id: string
  proveedor: Proveedor
  fecha: string                        // 'YYYY-MM-DD'
  pasos?: number
  distancia_km?: number
  calorias_activas?: number
  calorias_totales?: number
  minutos_activo?: number
  minutos_alta_intensidad?: number
  tipo_entreno?: string
  duracion_min?: number
  distancia_entreno_km?: number
  tss?: number
  ftp_potencia?: number
  pace_min_km?: number
  fc_media?: number
  fc_max?: number
  hrv?: number
  sueno_h?: number
  sueno_calidad?: number
  rhr?: number
  raw_data?: Record<string, unknown>
  proveedor_activity_id?: string
}

// Resumen 7 días para los agentes IA
export interface ResumenActividadSemanal {
  pasos_media: number
  calorias_activas_total: number
  tdee_estimado: number              // media de calorias_totales o estimado
  tss_semanal: number               // Training Stress Score acumulado
  hrv_media: number | null
  sesiones_entreno: number
  minutos_alta_intensidad_total: number
  dia_mas_activo: string | null      // 'lunes', 'martes', etc.
  fuentes: Proveedor[]
  tiene_datos: boolean
  // Garmin Connect específicos
  body_battery_media: number | null  // promedio body battery end-of-day
  stress_avg_media: number | null    // promedio estrés diario
  training_readiness_media: number | null  // promedio training readiness score
  rhr_media: number | null           // promedio resting heart rate
}

// Contrato que cada conector debe implementar
export interface ProveedorIntegracion {
  proveedor: Proveedor
  /** URL a la que redirigir al usuario para autorizar */
  getAuthUrl(clienteId: string, coachId: string): string
  /** Intercambiar code por tokens; devuelve la integración actualizada */
  handleCallback(code: string, state: string): Promise<Partial<IntegracionCliente>>
  /** Revocar token en el proveedor */
  revokeToken(integracion: IntegracionCliente): Promise<void>
  /** Sincronizar últimas N horas; devuelve actividades normalizadas */
  syncActivities(integracion: IntegracionCliente, desde: Date): Promise<ActividadExterna[]>
}
