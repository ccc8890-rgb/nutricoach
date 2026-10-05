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

const DISCIPLINAS_LARGAS = new Set([
  'running_hm', 'running_maraton', 'trail_corto', 'trail_largo', 'ultra',
  'ciclismo_fondo', 'triatlon_olimpico', 'triatlon_70_3', 'ironman',
])

/** Replica los umbrales de fase_deportiva_cliente usando fechas, incluidas fechas futuras. */
export function faseEnFecha(fechaCompeticion: string | Date, fecha: string | Date): FaseCompeticion {
  const dias = Math.floor((Date.UTC(...fechaPartes(fechaCompeticion)) - Date.UTC(...fechaPartes(fecha))) / 86_400_000)
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
  const larga = DISCIPLINAS_LARGAS.has(disciplina)
  if (fase === 'tapering') return {
    ajuste_kcal_pct: larga ? 0 : -5, ajuste_cho_pct: larga ? 10 : 0, ajuste_proteinas_pct: 0,
    label: 'Tapering', consejo: larga ? 'Aumenta moderadamente los hidratos para llegar con las reservas llenas.' : 'Mantén la alimentación habitual y ajusta ligeramente la energía a la menor carga.',
  }
  if (fase === 'carrera_inminente') return {
    ajuste_kcal_pct: larga ? 10 : 5, ajuste_cho_pct: larga ? 30 : 15, ajuste_proteinas_pct: 0,
    ...(larga && diasRestantes <= 2 ? { cho_g_kg: 10 } : {}),
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
