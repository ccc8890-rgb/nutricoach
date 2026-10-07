export type FaseCompeticion = 'base' | 'construccion' | 'pico' | 'pico_maximo' | 'tapering' | 'carrera_inminente' | 'race_day' | 'recuperacion' | 'finalizada'

export type AjusteCompeticion = {
  ajuste_kcal_pct: number
  ajuste_cho_pct: number
  ajuste_proteinas_pct: number
  /** Carga de hidratos en g/kg para las últimas 36-48 h; si hay peso sustituye al porcentaje.
   *  Metaanálisis 2026 (Sports Med / Scand J Med Sci Sports, doi 10.1111/sms.70379): >8 g/kg/día durante 36-48 h; guía clásica (Burke 2011): 10-12 g/kg en pruebas >90 min.
   *  Se usa 8 g/kg a partir de 90 min y 10 g/kg (extremo bajo de la guía) a partir de 150 min, por practicidad. */
  cho_g_kg?: number
  label: string
  consejo: string
}

// Perfil de esfuerzo de cada prueba: decide la carga de hidratos y la duración del tapering. Se clasifica por la duración
// (umbral de 90 min de Burke 2011 / Thomas 2016): corta ≤60 min · media 60-90 · larga 90-150 · muy_larga >150.
// Si la competición tiene tiempo objetivo se usa ese tiempo; si no, la duración típica de la disciplina (aficionado).
export type PerfilPrueba = 'corta' | 'media' | 'larga' | 'muy_larga'
const PERFIL_PRUEBA: Record<string, PerfilPrueba> = {
  running_5k: 'corta', running_10k: 'corta', crossfit: 'corta', triatlon_sprint: 'media', hyrox: 'media',
  running_hm: 'larga', trail_corto: 'larga', triatlon_olimpico: 'larga',
  running_maraton: 'muy_larga', trail_largo: 'muy_larga', triatlon_70_3: 'muy_larga', ciclismo_fondo: 'muy_larga', ironman: 'muy_larga', ultra: 'muy_larga',
}
export function perfilPorDuracion(minutos: number): PerfilPrueba {
  return minutos <= 60 ? 'corta' : minutos <= 90 ? 'media' : minutos <= 150 ? 'larga' : 'muy_larga'
}
export const perfilPrueba = (disciplina?: string, tiempoObjetivoMin?: number | null): PerfilPrueba =>
  tiempoObjetivoMin != null && Number.isFinite(tiempoObjetivoMin) && tiempoObjetivoMin > 0 ? perfilPorDuracion(tiempoObjetivoMin) : (PERFIL_PRUEBA[disciplina ?? ''] ?? 'corta')

// Días de tapering por disciplina. La evidencia sitúa el óptimo en 8-14 días con menos volumen y misma intensidad
// (Mujika & Padilla 2003, Med Sci Sports Exerc 35:1182; Bosquet et al. 2007, Med Sci Sports Exerc 39:1358).
const TAPER_DIAS: Record<string, number> = {
  running_5k: 7, running_10k: 7, crossfit: 7, triatlon_sprint: 7, hyrox: 7,
  running_hm: 10, trail_corto: 10, triatlon_olimpico: 10, ciclismo_fondo: 10,
  running_maraton: 14, trail_largo: 14, triatlon_70_3: 14, ironman: 14, ultra: 14,
}
export const diasTaper = (disciplina?: string) => TAPER_DIAS[disciplina ?? ''] ?? 7

/** Replica los umbrales de fase_deportiva_cliente usando fechas, incluidas fechas futuras. */
export function faseEnFecha(fechaCompeticion: string | Date, fecha: string | Date, disciplina?: string): FaseCompeticion {
  const dias = Math.floor((Date.UTC(...fechaPartes(fechaCompeticion)) - Date.UTC(...fechaPartes(fecha))) / 86_400_000)
  // El tapering empieza antes en pruebas largas (según la disciplina)
  if (disciplina && dias > 3 && dias <= diasTaper(disciplina)) return 'tapering'
  if (dias > 90) return 'base'
  if (dias > 60) return 'construccion'
  if (dias > 20) return 'pico'
  if (dias > 7) return 'pico_maximo'
  if (dias > 3) return 'tapering'
  if (dias > 0) return 'carrera_inminente'
  if (dias === 0) return 'race_day'
  if (dias >= -10) return 'recuperacion'
  return 'finalizada'
}

function fechaPartes(fecha: string | Date): [number, number, number] {
  if (fecha instanceof Date) return [fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()]
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number)
  return [y, m - 1, d]
}

/** Ajustes deportivos basados en Burke et al. 2011, J Sports Sci 29(S1), y Thomas/Erdman/Burke 2016 (ACSM/AND/DC). */
export function ajusteCompeticion(fase: FaseCompeticion, diasRestantes: number, disciplina: string, tiempoObjetivoMin?: number | null): AjusteCompeticion | null {
  if (['base', 'construccion', 'pico', 'pico_maximo', 'finalizada'].includes(fase)) return null
  const perfil = perfilPrueba(disciplina, tiempoObjetivoMin)
  const larga = perfil === 'larga' || perfil === 'muy_larga'
  // Más de una semana antes: menos volumen, así que baja algo la energía y se mantienen los hidratos en g/kg
  if (fase === 'tapering' && diasRestantes > 7) return {
    ajuste_kcal_pct: -5, ajuste_cho_pct: 0, ajuste_proteinas_pct: 0,
    label: 'Tapering', consejo: 'Con menos volumen de entreno, ajusta un poco la energía y mantén los hidratos por kilo de peso; la proteína no se toca.',
  }
  if (fase === 'tapering') return {
    ajuste_kcal_pct: larga ? 0 : -5, ajuste_cho_pct: larga ? 10 : 0, ajuste_proteinas_pct: 0,
    label: 'Tapering', consejo: larga ? 'Aumenta moderadamente los hidratos para llegar con las reservas llenas.' : 'Mantén la alimentación habitual y ajusta ligeramente la energía a la menor carga.',
  }
  if (fase === 'carrera_inminente') return {
    ajuste_kcal_pct: larga ? 10 : 5, ajuste_cho_pct: larga ? 30 : 15, ajuste_proteinas_pct: 0,
    // Carga de hidratos: 10 g/kg en las últimas 36-48 h si pasa de 150 min; 8 g/kg si dura 90-150 min; 8 g/kg solo el día previo en pruebas de 60-90 min
    ...(perfil === 'muy_larga' && diasRestantes <= 2 ? { cho_g_kg: 10 } : perfil === 'larga' && diasRestantes <= 2 ? { cho_g_kg: 8 } : perfil === 'media' && diasRestantes === 1 ? { cho_g_kg: 8 } : {}),
    label: diasRestantes === 1 ? 'Víspera de competición' : 'Precompetición',
    consejo: (diasRestantes === 1
      ? 'Prioriza alimentos ricos en hidratos y bajos en fibra y grasa; evita probar alimentos nuevos.'
      : 'Prioriza hidratos de carbono conocidos y fáciles de digerir para completar las reservas.')
      + (larga && diasRestantes <= 2 ? ' Reparte los hidratos en 5-6 tomas, con alimentos de poco residuo; una parte (25-40 %) puede ir en bebida de hidratos tipo drink mix de Maurten, más cómoda que comer sólido. Si no llegas a la cifra, manda la comodidad digestiva.' : ''),
  }
  if (fase === 'race_day') return {
    ajuste_kcal_pct: larga ? 10 : 5, ajuste_cho_pct: larga ? 20 : 10, ajuste_proteinas_pct: 0,
    label: 'Día de competición', consejo: 'Haz la comida previa 1–4 h antes, con 1–4 g/kg de hidratos; baja en fibra y grasa, y sin alimentos nuevos.',
  }
  if (fase === 'recuperacion') {
    const diasPost = Math.abs(diasRestantes)
    if (diasPost <= 2) return {
      ajuste_kcal_pct: 0, ajuste_cho_pct: 20, ajuste_proteinas_pct: 10,
      label: 'Recuperación', consejo: 'En la primera hora, toma 1,0–1,2 g/kg de hidratos y alrededor de 0,3 g/kg de proteína (Thomas et al., 2016).',
    }
    return { ajuste_kcal_pct: 0, ajuste_cho_pct: 0, ajuste_proteinas_pct: 5, label: 'Recuperación', consejo: 'Vuelve progresivamente a tu alimentación habitual y mantén un aporte suficiente de proteína.' }
  }
  return null
}
