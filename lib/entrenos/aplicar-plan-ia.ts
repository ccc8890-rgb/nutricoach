// lib/entrenos/aplicar-plan-ia.ts
// Aprobación de una propuesta `plan_entreno_ia`: crea el plan real (sustituyendo al activo solo cuando está completo).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgenteTarea } from '@/lib/agentes/types'
import type { AplicarTareaResult } from '@/lib/agentes/aplicar'
import { guardarPlanEntreno, type SesionIA } from './guardar-plan'
import { pasosDeSesionCarrera } from './pasos-desde-plan-ia'
import { nombreSinCifras, progresionDeMacro } from './progresion-semanal'
import { comprobarCoherenciaPlan } from './coherencia-plan'
import type { PayloadPlanEntrenoIA } from './planificar-con-ia'

const MODOS = ['crear', 'siguiente_bloque']
const MAX_SESIONES = 14

export function validarPayloadPlanEntrenoIA(p: unknown): { ok: true; payload: PayloadPlanEntrenoIA } | { ok: false; motivo: string } {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, motivo: 'El payload debe ser un objeto' }
  const x = p as Record<string, unknown>
  if (typeof x.modo !== 'string' || !MODOS.includes(x.modo)) return { ok: false, motivo: 'Modo de propuesta no válido' }
  if (!x.plan || typeof x.plan !== 'object' || Array.isArray(x.plan)) return { ok: false, motivo: 'La propuesta no contiene un plan' }
  const sesiones = (x.plan as { sesiones?: unknown }).sesiones
  if (!Array.isArray(sesiones) || sesiones.length === 0) return { ok: false, motivo: 'El plan no tiene sesiones' }
  if (sesiones.length > MAX_SESIONES) return { ok: false, motivo: `El plan tiene demasiadas sesiones (máximo ${MAX_SESIONES})` }
  if (sesiones.some(s => !s || typeof s !== 'object' || typeof (s as { nombre?: unknown }).nombre !== 'string' || !(s as { nombre: string }).nombre.trim())) return { ok: false, motivo: 'Hay sesiones sin nombre' }
  if (x.duracion_semanas != null && (typeof x.duracion_semanas !== 'number' || x.duracion_semanas < 1 || x.duracion_semanas > 52)) return { ok: false, motivo: 'Duración del plan no válida' }
  return { ok: true, payload: x as unknown as PayloadPlanEntrenoIA }
}

export async function aplicarPlanEntrenoIA(db: SupabaseClient, tarea: AgenteTarea): Promise<AplicarTareaResult> {
  if (!tarea.cliente_id) return { ok: false, codigo: 'NO_CLIENT', mensaje: 'Sin cliente_id' }
  if (tarea.aplicado_at) return { ok: true, codigo: 'APPLIED', mensaje: 'La propuesta ya estaba aplicada' }
  const v = validarPayloadPlanEntrenoIA(tarea.payload)
  if (!v.ok) return { ok: false, codigo: 'INVALID_PAYLOAD', mensaje: v.motivo }

  const { data: cliente } = await db.from('clientes').select('coach_id').eq('id', tarea.cliente_id).maybeSingle()
  if (!cliente?.coach_id) return { ok: false, codigo: 'NO_CLIENT', mensaje: 'Cliente no encontrado' }

  // Reserva atómica: solo una aplicación puede pasar `aplicado_at` de null a una fecha (otra pestaña o un reintento no crean un segundo plan).
  const { data: reservada } = await db.from('agente_tareas').update({ aplicado_at: new Date().toISOString() }).eq('id', tarea.id).is('aplicado_at', null).select('id')
  if (!reservada?.length) return { ok: true, codigo: 'APPLIED', mensaje: 'La propuesta ya estaba aplicada' }

  const p = v.payload
  try {
    const g = await guardarPlanEntreno(db, {
      coachId: cliente.coach_id as string, clienteId: tarea.cliente_id, nombre: p.nombre_plan,
      descripcion: typeof p.plan.fundamentacion === 'string' ? p.plan.fundamentacion : null,
      duracionSemanas: p.duracion_semanas, faseBloque: p.fase_bloque,
      // Las sesiones de carrera salen con pasos (zonas) para el reloj y el portal.
      sesiones: (p.plan.sesiones as SesionIA[]).map(s => ({ ...s, nombre: s.nombre ? nombreSinCifras(s.nombre) : s.nombre, pasos: pasosDeSesionCarrera(s, p.macrociclo?.semanas?.[0]) ?? undefined })),
    })
    // Progresión semana a semana (minutos de carrera por sesión y descarga, del macrociclo): las semanas 2-4 ya no son copia de la 1.
    const progresion = progresionDeMacro(p.macrociclo?.semanas as never, p.duracion_semanas)
    let avisoCoherencia = ''
    if (progresion) {
      await db.from('planes_entrenamiento').update({ progresion }).eq('id', g.planId)
      // Regla: lista, pasos y rondas de todas las semanas deben coincidir; si no, se deja constancia en el resultado de la aplicación.
      try {
        const { data: ses } = await db.from('sesiones_entrenamiento').select('id, nombre, pasos').eq('plan_id', g.planId)
        const { data: ejs } = await db.from('sesion_ejercicios').select('sesion_id, orden, bloque, series, repeticiones, peso_sugerido, encadenado, ejercicio:ejercicios(nombre, tipo)').in('sesion_id', (ses ?? []).map(x => x.id))
        const plan = { created_at: new Date().toISOString(), duracion_semanas: p.duracion_semanas, progresion }
        const problemas = comprobarCoherenciaPlan(plan as never, (ses ?? []).map(x => ({ nombre: x.nombre, pasos: x.pasos, ejercicios: (ejs ?? []).filter(e => e.sesion_id === x.id) as never })))
        if (problemas.length) avisoCoherencia = ` · ⚠ ${problemas.length} desajuste(s) entre lista, pasos y rondas: ${problemas[0]}`
      } catch { /* la comprobación no debe impedir crear el plan */ }
    }
    // Historial de versiones (pantalla «revisar plan»).
    await db.from('registros_ia').insert({
      cliente_id: tarea.cliente_id, tipo: 'plan_entreno_ia',
      respuesta_json: { ...p.plan, ...(p.validacion ? { _validacion: p.validacion } : {}), ...(p.macrociclo ? { _macrociclo: p.macrociclo } : {}) },
    })
    const omitidos = g.ejerciciosOmitidos.length ? ` · sin ejercicio equivalente en la biblioteca, omitidos: ${g.ejerciciosOmitidos.join(', ')}` : ''
    const mensaje = `Plan creado: ${g.sesiones} sesiones, ${g.ejerciciosVinculados} ejercicios vinculados${omitidos}${avisoCoherencia}`
    // El resultado queda en la tarea (los ejercicios omitidos no se pierden) y la tarea pasa a aplicada.
    await db.from('agente_tareas').update({ estado: 'aplicado', payload: { ...tarea.payload, resultado_aplicacion: mensaje } }).eq('id', tarea.id)
    return { ok: true, codigo: 'APPLIED', mensaje }
  } catch {
    // Se libera la reserva para poder reintentar; el plan anterior sigue activo.
    await db.from('agente_tareas').update({ aplicado_at: null }).eq('id', tarea.id)
    return { ok: false, codigo: 'DB_ERROR', mensaje: 'No se pudo crear el plan; el plan anterior sigue activo.' }
  }
}
