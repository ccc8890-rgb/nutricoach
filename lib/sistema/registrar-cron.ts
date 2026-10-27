import type { SupabaseClient } from '@supabase/supabase-js'

export type NombreCron = 'enviar-garmin' | 'avisos-rendimiento' | 'proponer-bloques' | 'recordatorio-checkin' | 'analisis-rendimiento' | 'revisor-recetas'

/** Anota que un cron ha terminado. Nunca lanza: registrar no debe romper la tarea. */
export async function registrarCron(db: SupabaseClient, cron: NombreCron, errores: number, detalle?: string) {
  try {
    await db.from('cron_ejecuciones').insert({
      cron,
      estado: errores > 0 ? 'error' : 'ok',
      detalle: detalle ? detalle.slice(0, 300) : null,
    })
  } catch (e) {
    console.error('[registrarCron]', cron, e instanceof Error ? e.message : e)
  }
}
