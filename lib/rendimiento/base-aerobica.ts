// lib/rendimiento/base-aerobica.ts
// Progreso de la base aeróbica comparando solo rodajes suaves (como hace un entrenador): a igual esfuerzo, ¿corre más rápido o con menos pulso?
import { sumarDias } from '@/lib/entrenos/calendario-ajustes'

export interface RodajeSuave {
  fecha: string
  /** Eficiencia: metros por minuto por cada latido. */
  ef: number
  fc_media: number
  ritmo_s_km: number | null
}

export interface PuntoBase { fecha: string; ritmoRef: number; fcMedia: number }

export interface VentanaBase {
  rodajes: number
  ef: number
  /** Ritmo (s/km) al pulso de referencia, deducido de la eficiencia. */
  ritmoRef: number
  fcMedia: number
  ritmoMedio: number | null
}

export type ValoracionBase = 'mejora' | 'estable' | 'retrocede' | 'sin_datos'

export interface BaseAerobica {
  /** Pulso de referencia (techo de la zona suave), ppm. Null si no se conocen los umbrales. */
  fcRef: number | null
  puntos: PuntoBase[]
  reciente: VentanaBase | null
  previa: VentanaBase | null
  /** Cambio de eficiencia reciente frente a la previa (%; positivo = mejor). */
  cambioPct: number | null
  /** Cambio del ritmo al pulso de referencia (s/km; negativo = más rápido). */
  cambioSeg: number | null
  valoracion: ValoracionBase
}

const DIAS_VENTANA = 28
const MIN_RODAJES = 3
/** Por debajo de este cambio de eficiencia es ruido (calor, sueño, cuestas). */
const UMBRAL_CAMBIO_PCT = 2

const mediana = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function ventana(rodajes: RodajeSuave[], fcRef: number): VentanaBase | null {
  if (rodajes.length < MIN_RODAJES) return null
  const ef = mediana(rodajes.map(r => r.ef))
  const ritmos = rodajes.flatMap(r => (r.ritmo_s_km ? [r.ritmo_s_km] : []))
  return {
    rodajes: rodajes.length,
    ef,
    ritmoRef: ritmoAlPulso(ef, fcRef),
    fcMedia: Math.round(mediana(rodajes.map(r => r.fc_media))),
    ritmoMedio: ritmos.length ? Math.round(mediana(ritmos)) : null,
  }
}

/** Ritmo (s/km) al que se corre a `fc` ppm con una eficiencia dada (m/min por ppm). */
export function ritmoAlPulso(ef: number, fc: number): number {
  return Math.round(1000 / ((ef * fc) / 60))
}

/** `rodajes`: carreras continuas al aire libre ya filtradas a esfuerzo suave (pulso medio bajo el techo). */
export function calcularBaseAerobica(rodajes: RodajeSuave[], fcRef: number | null, hoy: string): BaseAerobica {
  const vacio: BaseAerobica = { fcRef, puntos: [], reciente: null, previa: null, cambioPct: null, cambioSeg: null, valoracion: 'sin_datos' }
  if (!fcRef) return vacio
  const ordenados = [...rodajes].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const puntos = ordenados.map(r => ({ fecha: r.fecha, ritmoRef: ritmoAlPulso(r.ef, fcRef), fcMedia: r.fc_media }))
  const iniReciente = sumarDias(hoy, -(DIAS_VENTANA - 1))
  const iniPrevia = sumarDias(iniReciente, -DIAS_VENTANA)
  const reciente = ventana(ordenados.filter(r => r.fecha >= iniReciente && r.fecha <= hoy), fcRef)
  const previa = ventana(ordenados.filter(r => r.fecha >= iniPrevia && r.fecha < iniReciente), fcRef)
  if (!reciente || !previa) return { ...vacio, puntos, reciente, previa }
  const cambioPct = Math.round(((reciente.ef / previa.ef - 1) * 100) * 10) / 10
  const cambioSeg = reciente.ritmoRef - previa.ritmoRef
  const valoracion: ValoracionBase = cambioPct >= UMBRAL_CAMBIO_PCT ? 'mejora' : cambioPct <= -UMBRAL_CAMBIO_PCT ? 'retrocede' : 'estable'
  return { fcRef, puntos, reciente, previa, cambioPct, cambioSeg, valoracion }
}
