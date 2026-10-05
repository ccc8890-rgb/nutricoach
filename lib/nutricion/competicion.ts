export type FaseCompeticion = 'base' | 'construccion' | 'pico' | 'pico_maximo' | 'tapering' | 'carrera_inminente' | 'race_day' | 'recuperacion' | 'finalizada'

export type AjusteCompeticion = {
  ajuste_kcal_pct: number
  ajuste_cho_pct: number
  ajuste_proteinas_pct: number
  /** Carga de hidratos en g/kg para las últimas 36-48 h de pruebas largas (Burke 2011: 10-12 g/kg); si hay peso sustituye al porcentaje */
  cho_g_kg?: number
  label: string
  consejo: string
}

// Perfil de esfuerzo de cada prueba (aficionado): decide carga de hidratos y duración del tapering.
//  corta <60 min · media 60-90 min · larga >90 min · muy_larga >4 h (Burke 2011; Thomas 2016)
export type PerfilPrueba = 'corta' | 'media' | 'larga' | 'muy_larga'
const PERFIL_PRUEBA: Record<string, PerfilPrueba> = {
  running_5k: 'corta', running_10k: 'corta', crossfit: 'corta', triatlon_sprint: 'media', hyrox: 'media',
  running_hm: 'larga', trail_corto: 'larga', triatlon_olimpico: 'larga', ciclismo_fondo: 'larga', running_maraton: 'larga', trail_largo: 'larga', triatlon_70_3: 'larga',
  ironman: 'muy_larga', ultra: 'muy_larga',
}
export const perfilPrueba = (disciplina?: string): PerfilPrueba => PERFIL_PRUEBA[disciplina ?? ''] ?? 'corta'
const esLarga = (disciplina?: string) => ['larga', 'muy_larga'].includes(perfilPrueba(disciplina))

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
export function ajusteCompeticion(fase: FaseCompeticion, diasRestantes: number, disciplina: string): AjusteCompeticion | null {
  if (['base', 'construccion', 'pico', 'pico_maximo', 'finalizada'].includes(fase)) return null
  const larga = esLarga(disciplina)
  const perfil = perfilPrueba(disciplina)
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
    // Carga de hidratos (Burke 2011): 10-12 g/kg en las últimas 36-48 h si pasa de 90 min; 8 g/kg el día previo en pruebas de ~60-90 min
    ...(perfil === 'muy_larga' && diasRestantes <= 2 ? { cho_g_kg: 12 } : perfil === 'larga' && diasRestantes <= 2 ? { cho_g_kg: 10 } : perfil === 'media' && diasRestantes === 1 ? { cho_g_kg: 8 } : {}),
    label: diasRestantes === 1 ? 'Víspera de competición' : 'Precompetición',
    consejo: diasRestantes === 1
      ? 'Prioriza alimentos ricos en hidratos y bajos en fibra y grasa; evita probar alimentos nuevos.'
      : 'Prioriza hidratos de carbono conocidos y fáciles de digerir para completar las reservas.',
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
