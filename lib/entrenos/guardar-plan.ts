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

export type TipoPreferido = 'cardio' | 'fuerza' | 'cardio_funcional'

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const OTRA_GLOBAL = new RegExp(OTRA_DISCIPLINA_RE.source, 'gi')
const clave = (t: string) => sinAcentos(t.trim().toLowerCase()).replace(/\s+/g, '')
const terminosAjenos = (texto: string) => (sinAcentos(texto).match(OTRA_GLOBAL) ?? []).map(clave)

/**
 * Empareja el nombre que escribió la IA con un ejercicio del catálogo.
 * - `tipoPreferido`: cardio (sesión de carrera), fuerza, o cardio_funcional (ejercicio medido en metros/minutos dentro de una híbrida).
 * - Un término de otra disciplina (remo, SkiErg, natación…) solo descarta un candidato si la petición NO lo pide (salvo en carrera pura, donde siempre descarta):
 *   «Remo en ergómetro» pide remo, así que «Remo ergómetro» vale; «Carrera continua» no pide SkiErg, así que «Carrera + SkiErg combinado» no.
 */
// Nombres habituales de la IA que son otro ejercicio del catálogo (la búsqueda por palabras empataría con ejercicios distintos).
const SINONIMOS: Record<string, string> = {
  'sentadilla trasera': 'sentadilla con barra',
  'sentadilla trasera con barra': 'sentadilla con barra',
  'back squat': 'sentadilla con barra',
}

export async function matchEjercicio(sb: SupabaseClient, nombre: string, tipoPreferido?: TipoPreferido): Promise<string | null> {
  const normalizado = SINONIMOS[sinAcentos(nombre.toLowerCase().trim())] ?? nombre.toLowerCase().trim()
  // En sesiones de carrera, «rodaje/tirada continuo Z2» es la «Carrera continua» del catálogo (no comparten ninguna palabra útil).
  if (tipoPreferido === 'cardio' && /^(rodaje|tirada)\b/.test(normalizado) && /continu[oa]/.test(normalizado)) {
    const idContinua = await matchEjercicio(sb, 'carrera continua', tipoPreferido)
    if (idContinua) return idContinua
  }

  // En una sesión de carrera pura no vale ningún aparato de otra disciplina, ni siquiera si la IA lo escribe.
  const pedidos = new Set(tipoPreferido === 'cardio' ? [] : terminosAjenos(normalizado))
  const tiposOk: string[] | null = tipoPreferido === 'cardio' ? ['cardio', 'flexibilidad']
    : tipoPreferido === 'cardio_funcional' ? ['cardio', 'funcional']
    : tipoPreferido ? [tipoPreferido] : null
  type Cand = { id: string; nombre: string; tipo: string | null }
  const esBueno = (c: Cand) => (!tiposOk || (c.tipo != null && tiposOk.includes(c.tipo))) && !terminosAjenos(c.nombre).some(t => !pedidos.has(t))

  function elegirMejor(candidatos: Cand[]): string | null {
    if (candidatos.length === 0) return null
    if (!tipoPreferido) return candidatos[0].id
    // Ningún candidato de fiar → null, para que el nivel de arriba pruebe la siguiente palabra
    // (aceptar el primero malo bloqueaba esa segunda oportunidad).
    return candidatos.find(esBueno)?.id ?? null
  }

  // Nivel 1: match exacto (case-insensitive)
  const { data: exacto } = await sb.from('ejercicios').select('id, nombre, tipo').ilike('nombre', normalizado).limit(5)
  const idExacto = exacto?.length ? elegirMejor(exacto) : null
  if (idExacto) return idExacto

  // Nivel 2: match parcial — nombre del ejercicio contiene la búsqueda
  const { data: parcial } = await sb.from('ejercicios').select('id, nombre, tipo').ilike('nombre', `%${normalizado}%`).limit(5)
  const idParcial = parcial?.length ? elegirMejor(parcial) : null
  if (idParcial) return idParcial

  // Nivel 3: candidatos de TODAS las palabras significativas (>3 chars, sin stop words); gana el que más palabras comparte
  // (antes mandaba la primera palabra: «Remo en ergómetro» acababa en «Remo con barra»).
  const palabras = normalizado.split(/\s+/).filter(p => p.length > 3 && !STOP_WORDS.has(p))
  const pool = new Map<string, Cand>()
  for (const palabra of palabras) {
    const { data } = await sb.from('ejercicios').select('id, nombre, tipo').ilike('nombre', `%${palabra}%`).limit(40)
    for (const c of data ?? []) pool.set(c.id, c)
  }
  const aptos = [...pool.values()].filter(c => !tipoPreferido || esBueno(c))
  if (aptos.length === 0) return null
  const puntos = (c: Cand) => palabras.filter(p => sinAcentos(c.nombre.toLowerCase()).includes(sinAcentos(p))).length
  aptos.sort((x, y) => puntos(y) - puntos(x) || x.nombre.length - y.nombre.length)
  return aptos[0].id
}

/** «Carrera continua» con series de distancia (4 × 400 m) son intervalos: el catálogo tiene «Intervalos 400m». */
export function nombreCatalogoPorDistancia(nombre: string, series: unknown, repeticiones: unknown): string | null {
  const m = String(repeticiones ?? '').trim().match(/^(\d{3,4})\s*m$/i)
  if (!m || typeof series !== 'number' || series < 2) return null
  return /^(carrera|rodaje|trote)\s+continu[oa]$/i.test(nombre.trim()) ? `Intervalos ${m[1]}m` : null
}

/** Ejercicio medido en metros o minutos (SkiErg 500 m, remo 5 min…): se busca entre cardio y funcional. */
export const midePorDistanciaOTiempo = (repeticiones: unknown) => /^\s*\d+([.,]\d+)?\s*(m|km|min|s|seg)\b/i.test(String(repeticiones ?? ''))

/** Una sesión de carrera pura debe vincularse a ejercicios de carrera, nunca a un aparato de otra disciplina. */
export function tipoPreferidoDeSesion(s: SesionIA): TipoPreferido | undefined {
  const nombreSesion = (s.nombre ?? '').toLowerCase()
  // El ritmo objetivo solo lo trae una sesión de carrera (series, tempo…), aunque su nombre no diga «carrera».
  const esSesionCarrera = (/carrera|tirada|rodaje|running|tempo run|^series\b|intervalos|fartlek/i.test(nombreSesion) || (typeof s.ritmo_objetivo === 'string' && s.ritmo_objetivo.trim() !== '')) && !/híbrid|hibrid|hyrox/i.test(nombreSesion)
  return esSesionCarrera ? 'cardio' : undefined
}

/** Ejercicio del catálogo que corresponde a un ejercicio escrito por la IA (null si no hay uno fiable). */
export async function idEjercicioDeLaIA(sb: SupabaseClient, sesion: SesionIA, ej: EjercicioIA): Promise<string | null> {
  const nombreEj = (ej.nombre ?? '').trim()
  if (!nombreEj) return null
  const tipo: TipoPreferido | undefined = tipoPreferidoDeSesion(sesion) ?? (midePorDistanciaOTiempo(ej.repeticiones) ? 'cardio_funcional' : undefined)
  const nombreIntervalos = nombreCatalogoPorDistancia(nombreEj, ej.series, ej.repeticiones)
  return (nombreIntervalos ? await matchEjercicio(sb, nombreIntervalos, tipo) : null) ?? await matchEjercicio(sb, nombreEj, tipo)
}

export interface EjercicioIA {
  nombre?: string; bloque?: unknown; series?: unknown; repeticiones?: unknown
  descanso_segundos?: unknown; rpe_objetivo?: unknown; notas?: unknown; peso_estimado_kg?: unknown
}
export interface SesionIA { nombre?: string; dia_semana?: string | null; ritmo_objetivo?: unknown; ejercicios?: EjercicioIA[]; /** Pasos estructurados de carrera (zonas), calculados al aplicar el plan. */ pasos?: unknown }
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
        ...(Array.isArray(s.pasos) && s.pasos.length ? { pasos: s.pasos } : {}),
      }).select('id').single()
      if (errSes || !sesion) throw new Error('sesión')
      sesionesCreadas.push(sesion.id as string)

      const ejercicios = s.ejercicios ?? []
      for (let j = 0; j < ejercicios.length; j++) {
        const ej = ejercicios[j]
        const nombreEj = (ej.nombre ?? '').trim()
        if (!nombreEj) continue
        const ejercicioId = await idEjercicioDeLaIA(sb, s, ej)
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
          peso_sugerido: typeof ej.peso_estimado_kg === 'number' && ej.peso_estimado_kg > 0 ? `${ej.peso_estimado_kg}kg` : null,
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
