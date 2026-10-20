/**
 * Tendencia de peso frente a la meta del cliente. Hasta ahora el árbol de periodización no miraba el peso: si alguien que quería
 * ganar no subía, o alguien que quería bajar no bajaba, nada lo corregía. Esta regla propone (nunca aplica sola) un ajuste del 5 %.
 *
 * Base: ritmo de pérdida 0,7 % del peso/semana conserva más masa y fuerza que 1,4 % (Garthe 2011, doi:10.1123/ijsnem.21.2.97);
 * fase de pérdida ≈ 0,5-1 %/semana (Helms 2014, doi:10.1186/1550-2783-11-20); ganancia ≈ 0,25-0,5 %/semana en principiantes e
 * intermedios (Iraki 2019, doi:10.3390/sports7070154). Los umbrales concretos de «estancado» y el 5 % son criterio de dietista.
 */
export type MetaPeso = 'perder' | 'ganar' | 'mantener'
export type EstadoTendencia = 'perdida_rapida' | 'estancamiento' | 'ganancia_lenta' | 'ganancia_rapida' | 'deriva' | 'en_rango' | 'sin_datos'

export interface PuntoPeso { fecha: string; peso: number }

export const UMBRALES_TENDENCIA = {
  perdida_rapida_pct: 1.0,   // pierde ≥ 1 % del peso/semana → avisar
  estancado_pct: 0.15,       // se mueve < 0,15 %/semana en la dirección de la meta → estancado
  ganancia_min_pct: 0.25,    // ganar: por debajo → ganancia lenta
  ganancia_max_pct: 0.5,     // ganar: por encima → ganancia rápida
  deriva_pct: 0.5,           // mantener: se mueve > 0,5 %/semana → deriva
  dias_rapido: 14,           // para avisar de un ritmo rápido basta con 2 semanas
  dias_estancado: 21,        // para declarar estancamiento/lentitud hacen falta 3 semanas
  ajuste_kcal_pct: 0.05,     // ajuste propuesto: ±5 % de las kcal
  enfriamiento_dias: 14,     // no volver a proponer hasta ver el efecto del cambio
  adherencia_minima: 7,      // adherencia media (1-10) por debajo de la cual NO se mueven las calorías para «hacer más» (criterio)
} as const

export interface ResultadoTendencia {
  estado: EstadoTendencia
  ritmo_pct_semana: number | null
  dias: number
  kcal_pct: number          // + sube calorías, − las baja, 0 = sin cambio
  descripcion: string
}

/** Meta a partir del objetivo del onboarding («perder_grasa», «ganar_musculo», «mantener»…). Desconocido → null (sin regla). */
export function metaDesdeObjetivo(objetivo: string | null | undefined): MetaPeso | null {
  const o = (objetivo ?? '').toLowerCase()
  if (/perd|grasa|defin|adelgaz/.test(o)) return 'perder'
  if (/gan|musc|volum|masa/.test(o)) return 'ganar'
  if (/mant/.test(o)) return 'mantener'
  return null
}

/** Pendiente por mínimos cuadrados (kg/semana) y % sobre el peso medio; resiste el ruido de un pesaje aislado (agua, tránsito). */
export function ritmoSemanal(puntos: PuntoPeso[]): { pct: number; kg: number; dias: number } | null {
  const p = [...puntos].filter(x => Number.isFinite(x.peso) && x.peso > 0).sort((a, b) => a.fecha.localeCompare(b.fecha))
  if (p.length < 3) return null
  const t0 = new Date(`${p[0].fecha}T12:00:00Z`).getTime()
  const xs = p.map(x => (new Date(`${x.fecha}T12:00:00Z`).getTime() - t0) / 86_400_000)
  const dias = xs[xs.length - 1]
  if (dias < 7) return null
  const n = p.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = p.reduce((a, b) => a + b.peso, 0) / n
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  if (den === 0) return null
  const kgDia = xs.reduce((a, x, i) => a + (x - mx) * (p[i].peso - my), 0) / den
  return { kg: kgDia * 7, pct: ((kgDia * 7) / my) * 100, dias }
}

const r2 = (x: number) => Math.round(x * 100) / 100

/**
 * `adherenciaMedia` (1-10, media de los check-ins recientes): si es baja, un peso que no se mueve se explica por no seguir el plan y
 * tocar las calorías no arregla nada (subir a quien no come lo pautado, bajar a quien ya se pasa); se avisa pero no se propone cambio.
 */
export function evaluarTendenciaPeso(puntos: PuntoPeso[], meta: MetaPeso | null, adherenciaMedia: number | null = null, u = UMBRALES_TENDENCIA): ResultadoTendencia {
  const r0 = evaluarTendenciaBruta(puntos, meta, u)
  const pideMasPlan = r0.estado === 'estancamiento' || r0.estado === 'ganancia_lenta'
  if (pideMasPlan && adherenciaMedia != null && adherenciaMedia < u.adherencia_minima)
    return { ...r0, kcal_pct: 0, descripcion: `${r0.descripcion.split(' Se propone')[0]} Con adherencia media de ${Math.round(adherenciaMedia * 10) / 10}/10 no se propone cambiar calorías: primero hay que resolver la adherencia.` }
  return r0
}

function evaluarTendenciaBruta(puntos: PuntoPeso[], meta: MetaPeso | null, u = UMBRALES_TENDENCIA): ResultadoTendencia {
  const sin = (descripcion: string): ResultadoTendencia => ({ estado: 'sin_datos', ritmo_pct_semana: null, dias: 0, kcal_pct: 0, descripcion })
  if (!meta) return sin('Sin meta de peso conocida: no se evalúa la tendencia.')
  const r = ritmoSemanal(puntos)
  if (!r) return sin('Hacen falta al menos 3 pesajes en 7 días o más para ver una tendencia.')
  const pct = r2(r.pct)
  const base = { ritmo_pct_semana: pct, dias: Math.round(r.dias) }
  const ok = (): ResultadoTendencia => ({ ...base, estado: 'en_rango', kcal_pct: 0, descripcion: `Ritmo de ${pct} %/semana dentro de lo esperado.` })

  if (meta === 'perder') {
    if (r.dias >= u.dias_rapido && pct <= -u.perdida_rapida_pct)
      return { ...base, estado: 'perdida_rapida', kcal_pct: u.ajuste_kcal_pct, descripcion: `Pierde ${Math.abs(pct)} % del peso por semana (≥ ${u.perdida_rapida_pct} %): riesgo de perder masa muscular y rendimiento (Garthe 2011). Se propone subir ${u.ajuste_kcal_pct * 100} % las calorías.` }
    if (r.dias >= u.dias_estancado && pct > -u.estancado_pct)
      return { ...base, estado: 'estancamiento', kcal_pct: -u.ajuste_kcal_pct, descripcion: `Lleva ${Math.round(r.dias)} días sin bajar de forma apreciable (${pct} %/semana). Se propone bajar ${u.ajuste_kcal_pct * 100} % las calorías o revisar adherencia antes.` }
    return ok()
  }
  if (meta === 'ganar') {
    if (r.dias >= u.dias_rapido && pct > u.ganancia_max_pct)
      return { ...base, estado: 'ganancia_rapida', kcal_pct: -u.ajuste_kcal_pct, descripcion: `Gana ${pct} % del peso por semana (> ${u.ganancia_max_pct} %): parte será grasa (Iraki 2019). Se propone bajar ${u.ajuste_kcal_pct * 100} % las calorías.` }
    if (r.dias >= u.dias_estancado && pct < u.ganancia_min_pct)
      return { ...base, estado: 'ganancia_lenta', kcal_pct: u.ajuste_kcal_pct, descripcion: `Gana solo ${pct} % por semana en ${Math.round(r.dias)} días (< ${u.ganancia_min_pct} %). Se propone subir ${u.ajuste_kcal_pct * 100} % las calorías.` }
    return ok()
  }
  if (r.dias >= u.dias_estancado && Math.abs(pct) > u.deriva_pct) {
    const sube = pct > 0
    return { ...base, estado: 'deriva', kcal_pct: sube ? -u.ajuste_kcal_pct : u.ajuste_kcal_pct, descripcion: `Quería mantener y ${sube ? 'sube' : 'baja'} ${Math.abs(pct)} %/semana. Se propone ${sube ? 'bajar' : 'subir'} ${u.ajuste_kcal_pct * 100} % las calorías.` }
  }
  return ok()
}
