// lib/entrenos/copiar-plan.ts
// Copia completa de sesiones entre plantillas y planes de clientes (ejercicios, pasos de Garmin, fase, notas del coach…).
import type { SupabaseClient } from '@supabase/supabase-js'

const CAMPOS_SESION = ['nombre', 'notas', 'instruccion_coach', 'fase_bloque', 'duracion_estimada_min', 'pasos'] as const
const CAMPOS_EJERCICIO = ['ejercicio_id', 'series', 'repeticiones', 'descanso_segundos', 'peso_sugerido', 'notas', 'orden', 'sets_config', 'instruccion_ejercicio', 'tempo', 'rpe'] as const

type Fila = Record<string, unknown>

function sesionBase(s: Fila): Fila {
  const out: Fila = {}
  for (const c of CAMPOS_SESION) out[c] = s[c] ?? null
  return out
}

function ejercicioBase(e: Fila): Fila {
  const out: Fila = {}
  for (const c of CAMPOS_EJERCICIO) out[c] = e[c] ?? null
  out.encadenado = e.encadenado === true
  // Las plantillas pueden guardar la carga en otros campos.
  if (out.peso_sugerido == null && e.carga_valor != null) out.peso_sugerido = String(e.carga_valor)
  if (out.notas == null && e.notas_tecnicas != null) out.notas = e.notas_tecnicas
  return out
}

/** Copia las sesiones de una plantilla a un plan de cliente. Devuelve false si algo falla (el llamador decide si deshace). */
export async function copiarSesionesPlantillaAPlan(admin: SupabaseClient, plantillaId: string, planId: string): Promise<{ ok: boolean; sesiones: number }> {
  const { data: sesiones } = await admin.from('plantilla_sesiones').select('*, ejercicios:plantilla_sesion_ejercicios(*)').eq('plantilla_id', plantillaId).order('orden')
  if (!sesiones?.length) return { ok: false, sesiones: 0 }
  for (const s of sesiones as Fila[]) {
    const { data: nueva, error } = await admin.from('sesiones_entrenamiento')
      .insert({ ...sesionBase(s), notas: s.notas ?? s.descripcion ?? null, plan_id: planId, dia_semana: s.dia_semana ?? null, orden: s.orden ?? null })
      .select('id').single()
    if (error || !nueva) return { ok: false, sesiones: 0 }
    const ejercicios = ((s.ejercicios ?? []) as Fila[]).map(e => ({ ...ejercicioBase(e), sesion_id: nueva.id }))
    if (ejercicios.length > 0) {
      const { error: e2 } = await admin.from('sesion_ejercicios').insert(ejercicios)
      if (e2) return { ok: false, sesiones: 0 }
    }
  }
  return { ok: true, sesiones: sesiones.length }
}

/** Copia la estructura semanal (sesiones con día de la semana) de un plan a una plantilla. */
export async function copiarSesionesPlanAPlantilla(admin: SupabaseClient, planId: string, plantillaId: string): Promise<{ ok: boolean; sesiones: number }> {
  const { data: sesiones } = await admin.from('sesiones_entrenamiento').select('*, ejercicios:sesion_ejercicios(*)').eq('plan_id', planId).not('dia_semana', 'is', null).order('orden')
  if (!sesiones?.length) return { ok: false, sesiones: 0 }
  for (const s of sesiones as Fila[]) {
    const { data: nueva, error } = await admin.from('plantilla_sesiones')
      .insert({ ...sesionBase(s), plantilla_id: plantillaId, dia_semana: s.dia_semana, orden: s.orden ?? null })
      .select('id').single()
    if (error || !nueva) return { ok: false, sesiones: 0 }
    const ejercicios = ((s.ejercicios ?? []) as Fila[]).map(e => ({ ...ejercicioBase(e), sesion_id: nueva.id }))
    if (ejercicios.length > 0) {
      const { error: e2 } = await admin.from('plantilla_sesion_ejercicios').insert(ejercicios)
      if (e2) return { ok: false, sesiones: 0 }
    }
  }
  return { ok: true, sesiones: sesiones.length }
}
