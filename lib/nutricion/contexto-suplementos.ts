// Contexto de suplementación de un cliente: peso, objetivo, prueba próxima, sesión de hoy y analíticas.
// Lo usan el GET (propuestas) y el PATCH (completar dosis al aprobar) de /api/clientes/[id]/suplementacion.
import type { SupabaseClient } from '@supabase/supabase-js'
import { faseEnFecha } from './competicion'
import { DIAS_SEMANA } from './comidas-dia'
import { clasificarDiaNutricional } from '@/lib/periodizacion/dia-entreno-nutricion'
import type { ContextoSuplementos } from './suplementos'

// Analítica del onboarding (analisis_valores: { vitamina_d, ferritina } en ng/mL); solo valores numéricos válidos
export function analiticaDe(valores: unknown): ContextoSuplementos['analitica'] {
  if (!valores || typeof valores !== 'object') return undefined
  const v = valores as Record<string, unknown>
  const num = (x: unknown) => { const n = typeof x === 'string' ? Number(x.replace(',', '.')) : typeof x === 'number' ? x : NaN; return Number.isFinite(n) && n > 0 ? n : undefined }
  const vitamina_d_ngml = num(v.vitamina_d)
  const ferritina_ngml = num(v.ferritina)
  return vitamina_d_ngml === undefined && ferritina_ngml === undefined ? undefined : { vitamina_d_ngml, ferritina_ngml }
}

// Intensidad de la sesión de hoy a partir de su tipo y nombre (para la cafeína «de sesión»; no cambia las pautas diarias)
export function intensidadDeSesion(nombre: string | undefined, tipo: string | null): ContextoSuplementos['intensidad_sesion'] {
  if (!nombre || !tipo) return undefined
  if (tipo === 'entreno_hibrido' || /series|intervalos|vo2|sprint|hiit|wod|metcon/i.test(nombre)) return 'alta'
  if (/z2|rodaje|suave|recuper|movilidad|calentamiento/i.test(nombre)) return 'baja'
  return 'media'
}

// El onboarding guarda texto libre: «Ninguna», «no» o «-» no son condiciones
export function condicionesDe(texto: unknown): string[] | undefined {
  if (typeof texto !== 'string') return undefined
  const t = texto.trim()
  return t && !/^(ning[uú]n[oa]?|no|n\/a|-+)\.?$/i.test(t) ? [t] : undefined
}

export async function construirContexto(db: SupabaseClient, id: string): Promise<ContextoSuplementos | null> {
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const limite = new Date(`${hoy}T00:00:00Z`)
    limite.setUTCDate(limite.getUTCDate() - 10)
    const [clienteRes, pesoRes, competicionRes, planRes, onboardingRes] = await Promise.all([
      db.from('clientes').select('objetivo,peso_inicial,edad,sexo').eq('id', id).single(),
      db.from('checkins').select('peso').eq('cliente_id', id).not('peso', 'is', null).order('fecha', { ascending: false }).limit(1).maybeSingle(),
      db.from('competiciones').select('disciplina,fecha_competicion,tiempo_objetivo_min').eq('cliente_id', id).eq('activo', true).gte('fecha_competicion', limite.toISOString().slice(0, 10)).order('fecha_competicion', { ascending: true }).limit(1).maybeSingle(),
      db.from('planes_entrenamiento').select('id').eq('cliente_id', id).eq('activo', true).limit(1).maybeSingle(),
      db.from('onboarding_perfil_profundo').select('hora_entreno,condiciones_salud,analisis_valores').eq('cliente_id', id).maybeSingle(),
    ])
    if (clienteRes.error || pesoRes.error || competicionRes.error || planRes.error || onboardingRes.error || !clienteRes.data) throw new Error('Error al consultar contexto de suplementacion')
    const peso = Number(pesoRes.data?.peso ?? clienteRes.data.peso_inicial)
    if (!Number.isFinite(peso) || peso <= 0) return null

    const dia = DIAS_SEMANA[(new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7]
    const sesionesRes = planRes.data
      ? await db.from('sesiones_entrenamiento').select('nombre,duracion_estimada_min,hora_inicio').eq('plan_id', planRes.data.id).eq('dia_semana', dia)
      : null
    if (sesionesRes?.error) throw new Error('Error al consultar sesiones')
    const prioridad = { entreno_hibrido: 3, entreno_cardio: 2, entreno_fuerza: 1, descanso_activo: 0, descanso_total: 0 }
    const sesion = (sesionesRes?.data ?? []).slice().sort((a, b) => {
      const tipoA = clasificarDiaNutricional(a.nombre, true)
      const tipoB = clasificarDiaNutricional(b.nombre, true)
      return prioridad[tipoB] - prioridad[tipoA] || (b.duracion_estimada_min ?? 0) - (a.duracion_estimada_min ?? 0)
    })[0]
    const tipo = sesion ? clasificarDiaNutricional(sesion.nombre, true) : null
    const sexo = clienteRes.data.sexo
    const ctx: ContextoSuplementos = {
      peso_kg: peso,
      ...(sexo === 'hombre' || sexo === 'mujer' || sexo === 'otro' ? { sexo } : {}),
      edad: clienteRes.data.edad ?? undefined,
      objetivo: clienteRes.data.objetivo ?? undefined,
      disciplina: competicionRes.data?.disciplina ?? undefined,
      duracion_prueba_min: competicionRes.data?.tiempo_objetivo_min ?? undefined,
      fase_competicion: competicionRes.data ? faseEnFecha(competicionRes.data.fecha_competicion, hoy, competicionRes.data.disciplina) : undefined,
      duracion_min: sesion?.duracion_estimada_min ?? undefined,
      tipo_sesion: tipo === 'entreno_hibrido' ? 'hibrido' : tipo === 'entreno_cardio' ? 'cardio' : tipo === 'entreno_fuerza' ? 'fuerza' : undefined,
      // La hora propia de la sesión manda sobre la habitual del cuestionario (igual que en el planificador)
      hora_inicio: sesion?.hora_inicio ?? onboardingRes.data?.hora_entreno ?? undefined,
      intensidad_sesion: intensidadDeSesion(sesion?.nombre, tipo),
      condiciones: condicionesDe(onboardingRes.data?.condiciones_salud),
      analitica: analiticaDe(onboardingRes.data?.analisis_valores),
    }
    return ctx
}


