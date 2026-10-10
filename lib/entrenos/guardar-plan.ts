// lib/entrenos/guardar-plan.ts
// Guarda un plan de entreno generado por IA sin dejar nunca al cliente sin plan (ver guardarPlanEntreno).
import type { SupabaseClient } from '@supabase/supabase-js'
import { bloqueEjercicioGenerado } from '@/lib/training/generated-session-blocks'

// Palabras genéricas que no aportan al matching
const STOP_WORDS = new Set(['con', 'de', 'en', 'el', 'la', 'los', 'las', 'y', 'a', 'al', 'del'])

// Ejercicios de otra disciplina que NO deben colarse en una sesión de
// carrera pura solo porque comparten una palabra genérica del nombre IA
// (ej. "continuo", "series", "intervalos"). Bug real detectado por Carlos:
// "Tirada Larga Z2" (rodaje de 90min) se vinculó a "SkiErg Continuo" y
// "Carrera Series Cortas" (8x400m) se vinculó a "Series de crol 50m" —
// ambos con `tipo` inconsistente o de otra disciplina, y el nivel 3
// devolvía el primer resultado de Postgres sin ninguna preferencia.
const OTRA_DISCIPLINA_RE = /crol|natación|natacion|nado\b|ski\s?erg|sled|wall\s?ball|remo\b|rowing|bici|kettlebell|mancuerna|dominada|sentadilla|press\s|peso muerto|farmer|granjero/i

export async function matchEjercicio(sb: SupabaseClient, nombre: string, tipoPreferido?: 'cardio' | 'fuerza'): Promise<string | null> {
  const normalizado = nombre.toLowerCase().trim()

  function elegirMejor(candidatos: { id: string; nombre: string; tipo: string | null }[]): string | null {
    if (candidatos.length === 0) return null
    if (!tipoPreferido) return candidatos[0].id
    // Entre varios candidatos para la misma palabra, prioriza: tipo
    // correcto Y sin pinta de ser de otra disciplina (SkiErg, natación...).
    const buenos = candidatos.filter(c => c.tipo === tipoPreferido && !OTRA_DISCIPLINA_RE.test(c.nombre))
    if (buenos.length > 0) return buenos[0].id
    // Ningún candidato de ESTA palabra es de fiar (todos son de otra
    // disciplina, ej. la única "series..." de la BD es de natación) — mejor
    // devolver null y dejar que el nivel de arriba pruebe la siguiente
    // palabra ("800m" en vez de "series") que si busca directamente sin
    // ella habría encontrado "Intervalos 800m". Aceptar aquí el primer
    // candidato malo bloqueaba esa segunda oportunidad.
    return null
  }

  // Nivel 1: match exacto (case-insensitive)
  const { data: exacto } = await sb.from('ejercicios').select('id, nombre, tipo').ilike('nombre', normalizado).limit(5)
  if (exacto?.length) return elegirMejor(exacto)

  // Nivel 2: match parcial — nombre del ejercicio contiene la búsqueda
  const { data: parcial } = await sb.from('ejercicios').select('id, nombre, tipo').ilike('nombre', `%${normalizado}%`).limit(5)
  if (parcial?.length) return elegirMejor(parcial)

  // Nivel 3: buscar por palabras significativas (>3 chars, sin stop words)
  const palabras = normalizado.split(/\s+/).filter(p => p.length > 3 && !STOP_WORDS.has(p))
  for (const palabra of palabras) {
    const { data: porPalabra } = await sb.from('ejercicios').select('id, nombre, tipo').ilike('nombre', `%${palabra}%`).limit(5)
    if (porPalabra?.length) return elegirMejor(porPalabra)
  }

  return null
}

export interface EjercicioIA {
  nombre?: string; bloque?: unknown; series?: unknown; repeticiones?: unknown
  descanso_segundos?: unknown; rpe_objetivo?: unknown; notas?: unknown; peso_estimado_kg?: unknown
}
export interface SesionIA { nombre?: string; dia_semana?: string | null; ritmo_objetivo?: unknown; ejercicios?: EjercicioIA[] }
export interface DatosGuardadoPlan {
  coachId: string; clienteId: string; nombre: string; descripcion: string | null
  duracionSemanas: number | null
  faseBloque: string | null
  sesiones: SesionIA[]
}
/** La IA a veces devuelve la duración como texto («8-12 semanas»): se reduce a un entero de 1 a 52 o a null. */
export function normalizarDuracionSemanas(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number((v.match(/\d+/) ?? [])[0]) : NaN
  if (!Number.isFinite(n)) return null
  const r = Math.round(n)
  return r >= 1 && r <= 52 ? r : null
}

export interface ResultadoGuardadoPlan { planId: string; sesiones: number; ejerciciosVinculados: number; ejerciciosOmitidos: string[] }

/**
 * Guarda un plan de entreno generado por IA sin dejar nunca al cliente sin plan:
 * el nuevo nace inactivo, se rellena entero y solo entonces sustituye al activo.
 * Si algo falla se borra lo creado y el plan anterior no se toca.
 */
export async function guardarPlanEntreno(sb: SupabaseClient, d: DatosGuardadoPlan): Promise<ResultadoGuardadoPlan> {
  if (!d.sesiones.length) throw new Error('El plan no tiene sesiones: no se guarda (plan sin sesiones)')

  const { data: plan, error: errPlan } = await sb.from('planes_entrenamiento').insert({
    coach_id: d.coachId, cliente_id: d.clienteId, nombre: d.nombre, descripcion: d.descripcion,
    duracion_semanas: d.duracionSemanas, activo: false,
  }).select('id').single()
  if (errPlan || !plan) throw new Error('No se pudo guardar el plan')
  const planId = plan.id as string

  const sesionesCreadas: string[] = []
  const omitidos: string[] = []
  let previos: string[] = []
  let desactivando = false
  let vinculados = 0

  try {
    for (let i = 0; i < d.sesiones.length; i++) {
      const s = d.sesiones[i]
      const { data: sesion, error: errSes } = await sb.from('sesiones_entrenamiento').insert({
        plan_id: planId,
        nombre: s.nombre ?? `Sesión ${i + 1}`,
        dia_semana: s.dia_semana ?? null,
        orden: i + 1,
        notas: null,
        fase_bloque: d.faseBloque,
        contexto_ia: d.faseBloque && s.ritmo_objetivo ? String(s.ritmo_objetivo) : null,
      }).select('id').single()
      if (errSes || !sesion) throw new Error('sesión')
      sesionesCreadas.push(sesion.id as string)

      // Una sesión de carrera pura debe vincularse a ejercicios de carrera, nunca a un aparato de otra disciplina.
      const nombreSesion = (s.nombre ?? '').toLowerCase()
      const esSesionCarrera = /carrera|tirada|rodaje|running|tempo run/i.test(nombreSesion) && !/híbrid|hibrid|hyrox/i.test(nombreSesion)
      const tipoPreferido: 'cardio' | 'fuerza' | undefined = esSesionCarrera ? 'cardio' : undefined

      const ejercicios = s.ejercicios ?? []
      for (let j = 0; j < ejercicios.length; j++) {
        const ej = ejercicios[j]
        const nombreEj = (ej.nombre ?? '').trim()
        if (!nombreEj) continue
        const ejercicioId = await matchEjercicio(sb, nombreEj, tipoPreferido)
        if (!ejercicioId) { omitidos.push(nombreEj); continue }
        const { error: errEj } = await sb.from('sesion_ejercicios').insert({
          sesion_id: sesion.id,
          ejercicio_id: ejercicioId,
          bloque: bloqueEjercicioGenerado(ej.bloque),
          series: typeof ej.series === 'number' ? ej.series : null,
          repeticiones: ej.repeticiones != null ? String(ej.repeticiones) : null,
          descanso_segundos: typeof ej.descanso_segundos === 'number' ? ej.descanso_segundos : null,
          notas: [ej.rpe_objetivo ? `RPE ${ej.rpe_objetivo}` : null, ej.notas].filter(Boolean).join(' — ') || null,
          orden: j + 1,
          peso_sugerido: typeof ej.peso_estimado_kg === 'number' ? `${ej.peso_estimado_kg}kg` : null,
        })
        if (errEj) throw new Error('ejercicio')
        vinculados++
      }
    }

    // Solo ahora el plan nuevo sustituye al activo.
    const { data: activos } = await sb.from('planes_entrenamiento').select('id').eq('cliente_id', d.clienteId).eq('activo', true)
    previos = (activos ?? []).map(p => p.id as string).filter(id => id !== planId)
    if (previos.length) {
      desactivando = true
      const { error: errDes } = await sb.from('planes_entrenamiento').update({ activo: false }).in('id', previos)
      if (errDes) throw new Error('desactivar')
    }
    const { error: errAct } = await sb.from('planes_entrenamiento').update({ activo: true }).eq('id', planId)
    if (errAct) throw new Error('activar')
  } catch (e) {
    // Si ya se habían desactivado los planes anteriores, se reactivan: el cliente nunca se queda sin plan.
    if (desactivando && previos.length) await sb.from('planes_entrenamiento').update({ activo: true }).in('id', previos)
    // Limpieza: ejercicios → sesiones → plan.
    if (sesionesCreadas.length) {
      await sb.from('sesion_ejercicios').delete().in('sesion_id', sesionesCreadas)
      await sb.from('sesiones_entrenamiento').delete().in('id', sesionesCreadas)
    }
    await sb.from('planes_entrenamiento').delete().eq('id', planId)
    console.error('guardarPlanEntreno:', e instanceof Error ? e.message : e)
    throw new Error('No se pudo guardar el plan')
  }

  return { planId, sesiones: sesionesCreadas.length, ejerciciosVinculados: vinculados, ejerciciosOmitidos: omitidos }
}
