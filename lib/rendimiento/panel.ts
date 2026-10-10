// lib/rendimiento/panel.ts
// Datos del panel de rendimiento del coach: carga, forma, semanas, bienestar y evolución.
import { serieCarga, resumenCarga, type PuntoPmc, type ResumenCarga } from './pmc'
import { esCarrera } from './carga'
import { lunesDe } from './fechas'
import { distribucionIntensidad, type DistribucionIntensidad } from './intensidad'
import { DEPORTES_CON_PANEL, deporteDe, type DeporteConPanel } from './deportes'
import { calcularDeriva, type Deriva } from './deriva'
import { puntosTecnica, resumenTecnica, type PuntoTecnica, type ResumenTecnica } from './tecnica'
import type { VueltaEntreno } from './garmin-entrenos'

export interface EntrenoPanel {
  fecha: string
  tipo: string | null
  nombre: string | null
  duracion_s: number | null
  distancia_m: number | null
  ritmo_medio_s_km: number | null
  fc_media: number | null
  tss: number | null
  tss_metodo: string | null
  carga_garmin: number | null
  vo2max: number | null
  tiempo_zona_fc: number[] | null
  mejores_parciales: { s1000: number | null; s1609: number | null; s5000: number | null } | null
  raw: { gap_ms?: number | null; cadencia?: number | null; zancada_m?: number | null; contacto_suelo_ms?: number | null; oscilacion_vertical_cm?: number | null; potencia_media?: number | null; potencia_normalizada?: number | null } | null
  /** Solo para calcular la deriva; no se devuelve en `entrenos` del panel. */
  vueltas?: VueltaEntreno[] | null
}

export interface DiaBienestar {
  fecha: string
  rhr: number | null
  readiness: number | null
  body_battery_max: number | null
  sueno_h: number | null
  stress_avg: number | null
}

export interface SemanaCarga {
  /** Lunes de la semana. */
  semana: string
  tss: number
  km: number
  sesiones: number
  minutos: number
}

export interface ResumenDeporte {
  deporte: DeporteConPanel
  sesiones: number
  ultimaFecha: string | null
  /** Últimas 12 semanas de ese deporte (km de cualquier actividad con distancia). */
  semanas: SemanaCarga[]
  /** Últimos 20 entrenos de ese deporte, del más reciente al más antiguo. */
  entrenos: EntrenoPanel[]
}

export interface PanelRendimiento {
  serie: PuntoPmc[]
  resumen: ResumenCarga | null
  semanas: SemanaCarga[]
  bienestar: DiaBienestar[]
  /** Mejores parciales (1 km y 5 km) de cada carrera con ese dato, para ver la evolución. */
  parciales: { fecha: string; s1000: number | null; s5000: number | null }[]
  /** Eficiencia aeróbica: m/min por latido en carreras continuas de 25+ min. Sube = más forma. */
  eficiencia: { fecha: string; valor: number }[]
  /** Deriva cardiaca de cada carrera continua de 30+ min (positivo = el pulso se disparó). */
  deriva: ({ fecha: string } & Deriva)[]
  /** Técnica de carrera por salida (cadencia, zancada, contacto, oscilación) y su comparación a igual ritmo. */
  tecnica: { puntos: PuntoTecnica[]; resumen: ResumenTecnica | null }
  vo2max: { fecha: string; valor: number }[]
  /** Un resumen por deporte con apartado propio (siempre los 4, aunque estén a cero). */
  deportes: ResumenDeporte[]
  /** Reparto del tiempo de carrera entre suave, medio y duro (zonas de pulso de Garmin). */
  intensidad: DistribucionIntensidad
  entrenos: EntrenoPanel[]
}

export { lunesDe }

/** Eficiencia aeróbica: metros por minuto por cada latido en una carrera continua de 25+ min (al aire libre). Null si no aplica. */
export function eficienciaDe(e: EntrenoPanel): number | null {
  if (!esCarrera(e.tipo) || e.tipo === 'treadmill_running' || (e.duracion_s ?? 0) < 25 * 60 || !e.fc_media || !e.distancia_m) return null
  const ms = e.raw?.gap_ms ?? (e.distancia_m / e.duracion_s!)
  return Math.round(((ms * 60) / e.fc_media) * 1000) / 1000
}

/** `kmDeTodo`: contar la distancia de cualquier actividad (por defecto solo la de carrera). */
export function agruparSemanas(entrenos: EntrenoPanel[], semanasAtras: number, hoy: string, kmDeTodo = false): SemanaCarga[] {
  const porSemana = new Map<string, SemanaCarga>()
  for (const e of entrenos) {
    const s = lunesDe(e.fecha)
    const acc = porSemana.get(s) ?? { semana: s, tss: 0, km: 0, sesiones: 0, minutos: 0 }
    acc.tss += e.tss ?? 0
    acc.km += kmDeTodo || esCarrera(e.tipo) ? (e.distancia_m ?? 0) / 1000 : 0
    acc.sesiones += 1
    acc.minutos += (e.duracion_s ?? 0) / 60
    porSemana.set(s, acc)
  }
  const salida: SemanaCarga[] = []
  let cursor = lunesDe(hoy)
  for (let i = 0; i < semanasAtras; i++) {
    const a = porSemana.get(cursor) ?? { semana: cursor, tss: 0, km: 0, sesiones: 0, minutos: 0 }
    salida.unshift({ ...a, tss: Math.round(a.tss), km: Math.round(a.km * 10) / 10, minutos: Math.round(a.minutos) })
    const d = new Date(`${cursor}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 7)
    cursor = d.toISOString().slice(0, 10)
  }
  return salida
}

export function construirPanel(
  entrenos: EntrenoPanel[],
  bienestar: DiaBienestar[],
  hoy: string,
  diasVista = 180,
  fcUmbral: number | null = null,
): PanelRendimiento {
  const ordenados = [...entrenos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const primera = ordenados[0]?.fecha ?? hoy
  // La curva arranca en el primer entreno para que la forma "caliente" bien; se recorta a la vista pedida.
  const completa = serieCarga(ordenados.map(e => ({ fecha: e.fecha, tss: e.tss ?? 0 })), primera, hoy)
  const serie = completa.slice(-diasVista)

  const parciales = ordenados
    .filter(e => esCarrera(e.tipo) && (e.mejores_parciales?.s1000 || e.mejores_parciales?.s5000))
    .map(e => ({ fecha: e.fecha, s1000: e.mejores_parciales?.s1000 ?? null, s5000: e.mejores_parciales?.s5000 ?? null }))

  const eficiencia = ordenados.flatMap(e => {
    const valor = eficienciaDe(e)
    return valor === null ? [] : [{ fecha: e.fecha, valor }]
  })

  const deriva = ordenados.flatMap(e => {
    if (!esCarrera(e.tipo) || e.tipo === 'treadmill_running') return []
    const d = calcularDeriva(e.vueltas)
    return d ? [{ fecha: e.fecha, ...d }] : []
  })

  const tecnicaPuntos = puntosTecnica(ordenados)

  const sinVueltas = (e: EntrenoPanel): EntrenoPanel => {
    const copia = { ...e }
    delete copia.vueltas
    return copia
  }
  const deportes: ResumenDeporte[] = DEPORTES_CON_PANEL.map(d => {
    const suyos = ordenados.filter(e => deporteDe(e.tipo) === d)
    return {
      deporte: d,
      sesiones: suyos.length,
      ultimaFecha: suyos[suyos.length - 1]?.fecha ?? null,
      semanas: agruparSemanas(suyos, 12, hoy, true),
      entrenos: suyos.slice(-20).reverse().map(sinVueltas),
    }
  })

  return {
    serie,
    resumen: resumenCarga(completa),
    semanas: agruparSemanas(ordenados, 12, hoy),
    bienestar,
    parciales,
    eficiencia,
    deriva,
    deportes,
    intensidad: distribucionIntensidad(ordenados, hoy, fcUmbral),
    tecnica: { puntos: tecnicaPuntos, resumen: resumenTecnica(tecnicaPuntos, hoy) },
    vo2max: ordenados.filter(e => e.vo2max).map(e => ({ fecha: e.fecha, valor: e.vo2max! })),
    entrenos: ordenados.slice(-25).reverse().map(sinVueltas),
  }
}
