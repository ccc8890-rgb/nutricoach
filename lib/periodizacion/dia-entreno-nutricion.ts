/**
 * Clasificador nutricional por tipo de día de entreno.
 * Pure helper — no hace llamadas a BD ni a APIs.
 * Se usa para ajustar macros del plan del día según la sesión prevista.
 */

export type TipoDiaNutricional =
  | 'entreno_fuerza'      // gym, pesos pesados, hipertrofia
  | 'entreno_cardio'      // running, ciclismo, natación >45 min
  | 'entreno_hibrido'     // HYROX, CrossFit, funcional
  | 'descanso_activo'     // movilidad, paseo, yoga
  | 'descanso_total'      // reposo completo

export interface AjusteDiaNutricional {
  tipo: TipoDiaNutricional
  /** Ajuste en % sobre el objetivo base de kcal (positivo = más, negativo = menos) */
  ajuste_kcal_pct: number
  /** Ajuste en % sobre el objetivo base de carbohidratos */
  ajuste_cho_pct: number
  /** Ajuste en % sobre el objetivo base de proteínas */
  ajuste_proteinas_pct: number
  /** Momento recomendado de mayor ingesta de CHO */
  timing_cho: string
  /** Etiqueta legible */
  label: string
  /** Consejo nutricional corto */
  consejo: string
}

const AJUSTES: Record<TipoDiaNutricional, AjusteDiaNutricional> = {
  entreno_fuerza: {
    tipo: 'entreno_fuerza',
    ajuste_kcal_pct: +8,
    ajuste_cho_pct: +15,
    ajuste_proteinas_pct: +5,
    timing_cho: 'Pre-entreno (1-2h antes) y post-entreno (30-60 min)',
    label: 'Día de fuerza',
    consejo: 'Prioriza carbos peri-entreno para rendimiento y recuperación muscular.',
  },
  entreno_cardio: {
    tipo: 'entreno_cardio',
    ajuste_kcal_pct: +10,
    ajuste_cho_pct: +20,
    ajuste_proteinas_pct: 0,
    timing_cho: 'Pre-entreno (2-3h antes) y durante si supera 75 min',
    label: 'Día de cardio',
    consejo: 'Sesión larga = mayor demanda de glucógeno. Añade carbos fácilmente digestibles antes.',
  },
  entreno_hibrido: {
    tipo: 'entreno_hibrido',
    ajuste_kcal_pct: +12,
    ajuste_cho_pct: +18,
    ajuste_proteinas_pct: +8,
    timing_cho: 'Pre-entreno (1-2h antes) y post-entreno inmediato',
    label: 'Día híbrido / HYROX',
    consejo: 'Alta demanda metabólica: sube tanto CHO como proteína respecto al día base.',
  },
  descanso_activo: {
    tipo: 'descanso_activo',
    ajuste_kcal_pct: -5,
    ajuste_cho_pct: -10,
    ajuste_proteinas_pct: 0,
    timing_cho: 'Distribuidos a lo largo del día sin necesidad de timing específico',
    label: 'Descanso activo',
    consejo: 'Mantén la proteína para síntesis muscular. Puedes reducir CHO ligeramente.',
  },
  descanso_total: {
    tipo: 'descanso_total',
    ajuste_kcal_pct: -10,
    ajuste_cho_pct: -15,
    ajuste_proteinas_pct: 0,
    timing_cho: 'Sin restricción de horario',
    label: 'Descanso total',
    consejo: 'Baja CHO moderadamente. Mantén proteína igual — la reparación muscular ocurre en reposo.',
  },
}

/**
 * Infiere el tipo de día nutricional a partir del nombre de la sesión.
 * Si no hay sesión, devuelve descanso_activo o descanso_total según el contexto.
 */
export function clasificarDiaNutricional(
  nombreSesion: string | null | undefined,
  tieneSesion: boolean
): TipoDiaNutricional {
  if (!tieneSesion || !nombreSesion) return 'descanso_activo'

  const n = nombreSesion.toLowerCase()

  if (/hyrox|crossfit|funcional|wod|hiit|metcon/.test(n)) return 'entreno_hibrido'
  if (/running|carrera|rodillo|bici|ciclismo|nataci[oó]n|nadar|cardio|aerobic/.test(n)) return 'entreno_cardio'
  if (/fuerza|gym|pecho|espalda|pierna|braz|hombro|pull|push|tier|hipert|peso/.test(n)) return 'entreno_fuerza'

  // Si hay sesión pero no encaja en ningún patrón, tratar como fuerza (más común)
  return 'entreno_fuerza'
}

/** Devuelve el ajuste nutricional para un tipo de día dado. */
export function getAjusteDiaNutricional(tipo: TipoDiaNutricional): AjusteDiaNutricional {
  return AJUSTES[tipo]
}

/**
 * Shortcut: dados nombre de sesión + flag de si hay sesión,
 * devuelve directamente el ajuste nutricional.
 */
export function getAjusteDesdeNombreSesion(
  nombreSesion: string | null | undefined,
  tieneSesion: boolean
): AjusteDiaNutricional {
  const tipo = clasificarDiaNutricional(nombreSesion, tieneSesion)
  return getAjusteDiaNutricional(tipo)
}
