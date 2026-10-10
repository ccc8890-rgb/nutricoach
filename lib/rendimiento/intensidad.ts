// lib/rendimiento/intensidad.ts
// Distribución de intensidad (modelo de 3 zonas de Seiler) a partir del pulso medio de cada vuelta y del umbral de lactato del atleta.
// No se usan las zonas del reloj: dependen de cómo estén configuradas (p. ej. por % del pulso máximo) y pueden quedar
// por debajo del umbral real, lo que haría pasar por «duro» lo que en realidad es esfuerzo moderado.
import { esCarrera } from './carga'
import { lunesDe } from './fechas'
import type { VueltaEntreno } from './garmin-entrenos'

/** Por debajo de este % del pulso de umbral el esfuerzo es suave (aeróbico, conversacional). */
const FRACCION_SUAVE = 0.9

/** Tiempo en segundos por intensidad: suave < 90 % del umbral, media hasta el umbral, dura por encima. */
export interface TiempoIntensidad { suave: number; media: number; dura: number }

export interface SemanaIntensidad extends TiempoIntensidad {
  /** Lunes de la semana. */
  semana: string
}

export type ValoracionIntensidad = 'sin_datos' | 'bien' | 'zona_gris' | 'muy_duro' | 'mejorable'

export interface ResumenIntensidad {
  /** Minutos con datos de pulso en la ventana. */
  minutos: number
  pctSuave: number
  pctMedia: number
  pctDura: number
  valoracion: ValoracionIntensidad
}

/** Daniels fija el esfuerzo fácil (E) en ≤79 % del pulso máximo; Pfitzinger llega al 81 % en su carrera aeróbica general. */
export const FRACCION_FACIL_DANIELS = 0.79

export interface DistribucionIntensidad {
  /** Para contrastar con los entrenadores: % del tiempo (últimas 4 semanas) por debajo del techo de Daniels, o null si no se conoce el pulso máximo. */
  suaveDaniels: { techo: number; pct: number } | null
  /** Pulsos (ppm) que separan las tres intensidades; null si no se conoce el umbral del atleta. */
  limites: { suaveHasta: number; mediaHasta: number } | null
  /** Últimas 12 semanas, de la más antigua a la actual. */
  semanas: SemanaIntensidad[]
  /** Últimos 28 días. */
  reciente: ResumenIntensidad
  /** Los 56 días anteriores a esos 28. */
  previo: ResumenIntensidad
}

export interface EntrenoIntensidad {
  fecha: string
  tipo: string | null
  vueltas?: VueltaEntreno[] | null
}

/** Con menos tiempo que esto con pulso, la distribución no es representativa. */
const MINUTOS_MINIMOS = 60
const SEMANAS = 12

/** Reparte el tiempo de las vueltas según su pulso medio. Devuelve null si no hay vueltas con pulso. */
function sumaVueltas(vueltas: VueltaEntreno[] | null | undefined, suaveHasta: number, mediaHasta: number): TiempoIntensidad | null {
  if (!Array.isArray(vueltas)) return null
  const t: TiempoIntensidad = { suave: 0, media: 0, dura: 0 }
  let hay = false
  for (const l of vueltas) {
    if (!l.fc_media || !(l.duracion_s > 0)) continue
    hay = true
    if (l.fc_media < suaveHasta) t.suave += l.duracion_s
    else if (l.fc_media < mediaHasta) t.media += l.duracion_s
    else t.dura += l.duracion_s
  }
  return hay ? t : null
}

export function valorarIntensidad(pctSuave: number, pctMedia: number, pctDura: number): ValoracionIntensidad {
  if (pctSuave >= 75) return 'bien'
  if (pctMedia >= 30) return 'zona_gris'
  if (pctDura > 25) return 'muy_duro'
  return 'mejorable'
}

function resumir(t: TiempoIntensidad): ResumenIntensidad {
  const total = t.suave + t.media + t.dura
  if (total < MINUTOS_MINIMOS * 60) return { minutos: Math.round(total / 60), pctSuave: 0, pctMedia: 0, pctDura: 0, valoracion: 'sin_datos' }
  const pct = (s: number) => Math.round((s / total) * 100)
  const pctSuave = pct(t.suave)
  const pctMedia = pct(t.media)
  // La dura se calcula por diferencia para que los tres sumen siempre 100.
  const pctDura = 100 - pctSuave - pctMedia
  return { minutos: Math.round(total / 60), pctSuave, pctMedia, pctDura, valoracion: valorarIntensidad(pctSuave, pctMedia, pctDura) }
}

function diasEntre(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000)
}

/** Reparto de intensidad de las carreras entre dos fechas (ambas incluidas). */
export function repartoEntreFechas(entrenos: EntrenoIntensidad[], desde: string, hasta: string, fcUmbral: number | null): ResumenIntensidad {
  const t: TiempoIntensidad = { suave: 0, media: 0, dura: 0 }
  if (fcUmbral && fcUmbral > 0) {
    const suaveHasta = Math.round(fcUmbral * FRACCION_SUAVE)
    const mediaHasta = Math.round(fcUmbral)
    for (const e of entrenos) {
      if (!esCarrera(e.tipo) || e.fecha < desde || e.fecha > hasta) continue
      const x = sumaVueltas(e.vueltas, suaveHasta, mediaHasta)
      if (x) { t.suave += x.suave; t.media += x.media; t.dura += x.dura }
    }
  }
  return resumir(t)
}

export function distribucionIntensidad(entrenos: EntrenoIntensidad[], hoy: string, fcUmbral: number | null, fcMax: number | null = null): DistribucionIntensidad {
  const limites = fcUmbral && fcUmbral > 0 ? { suaveHasta: Math.round(fcUmbral * FRACCION_SUAVE), mediaHasta: Math.round(fcUmbral) } : null
  const vacio = (): TiempoIntensidad => ({ suave: 0, media: 0, dura: 0 })
  const reciente = vacio()
  const previo = vacio()
  const porSemana = new Map<string, TiempoIntensidad>()
  const techoDaniels = fcMax && fcMax > 0 ? Math.round(fcMax * FRACCION_FACIL_DANIELS) : null
  let bajoDaniels = 0
  let totalDaniels = 0

  for (const e of entrenos) {
    if (!esCarrera(e.tipo)) continue
    const t = limites ? sumaVueltas(e.vueltas, limites.suaveHasta, limites.mediaHasta) : null
    const d = diasEntre(e.fecha, hoy)
    if (!t || d < 0) continue
    const destino = d < 28 ? reciente : d < 84 ? previo : null
    if (d < 28 && techoDaniels) for (const l of e.vueltas ?? []) if (l.fc_media && l.duracion_s > 0) { totalDaniels += l.duracion_s; if (l.fc_media < techoDaniels) bajoDaniels += l.duracion_s }
    if (destino) { destino.suave += t.suave; destino.media += t.media; destino.dura += t.dura }
    const s = lunesDe(e.fecha)
    const acc = porSemana.get(s) ?? vacio()
    acc.suave += t.suave; acc.media += t.media; acc.dura += t.dura
    porSemana.set(s, acc)
  }

  const semanas: SemanaIntensidad[] = []
  let cursor = lunesDe(hoy)
  for (let i = 0; i < SEMANAS; i++) {
    const a = porSemana.get(cursor) ?? vacio()
    semanas.unshift({ semana: cursor, suave: Math.round(a.suave), media: Math.round(a.media), dura: Math.round(a.dura) })
    const f = new Date(`${cursor}T12:00:00Z`)
    f.setUTCDate(f.getUTCDate() - 7)
    cursor = f.toISOString().slice(0, 10)
  }

  const resumenReciente = resumir(reciente)
  return {
    suaveDaniels: techoDaniels && resumenReciente.valoracion !== 'sin_datos' && totalDaniels > 0 ? { techo: techoDaniels, pct: Math.round((bajoDaniels / totalDaniels) * 100) } : null,
    limites, semanas, reciente: resumenReciente, previo: resumir(previo),
  }
}
