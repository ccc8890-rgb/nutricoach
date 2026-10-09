// lib/rendimiento/carga.ts
// Carga de entrenamiento por sesión (TSS) a partir de ritmo y pulso, al estilo TrainingPeaks.
// TSS = horas × IF² × 100, con IF = intensidad relativa al umbral (Coggan).

export interface UmbralesAtleta {
  /** Pulso en el umbral de lactato (ppm). */
  fcUmbral: number | null
  /** Pulso máximo conocido (ppm). */
  fcMax: number | null
  /** Velocidad en el umbral de lactato (m/s). */
  velUmbralMs: number | null
}

export interface EntrenoParaCarga {
  tipo: string | null
  duracion_s: number | null
  /** Velocidad media ajustada por pendiente (m/s) si existe; si no, la media simple. */
  velocidadMs: number | null
  fc_media: number | null
  /** Segundos en cada zona de pulso Z1..Z5. */
  tiempo_zona_fc: number[] | null
}

export type MetodoTss = 'ritmo' | 'pulso' | 'duracion'

const TIPOS_CARRERA = ['running', 'track_running', 'treadmill_running', 'trail_running', 'virtual_run']
/** En cinta la velocidad depende de una calibración que suele fallar: solo se fía del pulso. */
const TIPOS_SIN_RITMO_FIABLE = ['treadmill_running', 'virtual_run']
const IF_MAX = 1.3
/** Punto medio de cada zona de pulso Garmin, en % del pulso máximo. */
const PUNTO_MEDIO_ZONA = [0.55, 0.65, 0.75, 0.85, 0.95]
/** Carga por hora cuando no hay ritmo ni pulso (equivale a IF≈0,63). */
const TSS_HORA_SIN_DATOS = 40

/** Garmin guarda la velocidad de umbral en décimas de m/s (0,369 → 3,69 m/s). */
export function velocidadUmbralMs(valorGarmin: number | null | undefined): number | null {
  if (typeof valorGarmin !== 'number' || !Number.isFinite(valorGarmin) || valorGarmin <= 0) return null
  return valorGarmin < 1 ? valorGarmin * 10 : valorGarmin
}

export function esCarrera(tipo: string | null | undefined): boolean {
  return !!tipo && TIPOS_CARRERA.includes(tipo)
}

function tssDe(horas: number, intensidad: number): number {
  const i = Math.min(Math.max(intensidad, 0), IF_MAX)
  return horas * i * i * 100
}

function tssPorZonas(zonas: number[], u: UmbralesAtleta): number | null {
  if (!u.fcUmbral || !u.fcMax || zonas.length !== 5) return null
  const umbralRel = u.fcUmbral / u.fcMax
  let total = 0
  for (let z = 0; z < 5; z++) {
    const horas = (zonas[z] || 0) / 3600
    total += tssDe(horas, PUNTO_MEDIO_ZONA[z] / umbralRel)
  }
  return total
}

export function calcularTss(
  e: EntrenoParaCarga,
  u: UmbralesAtleta,
): { tss: number; metodo: MetodoTss } | null {
  if (!e.duracion_s || e.duracion_s <= 0) return null
  const horas = e.duracion_s / 3600

  const candidatos: { tss: number; metodo: MetodoTss }[] = []

  if (esCarrera(e.tipo) && !TIPOS_SIN_RITMO_FIABLE.includes(e.tipo!) && e.velocidadMs && u.velUmbralMs) {
    candidatos.push({ tss: tssDe(horas, e.velocidadMs / u.velUmbralMs), metodo: 'ritmo' })
  }
  const porZonas = e.tiempo_zona_fc ? tssPorZonas(e.tiempo_zona_fc, u) : null
  if (porZonas !== null) {
    candidatos.push({ tss: porZonas, metodo: 'pulso' })
  } else if (e.fc_media && u.fcUmbral) {
    candidatos.push({ tss: tssDe(horas, e.fc_media / u.fcUmbral), metodo: 'pulso' })
  }

  // En carrera el ritmo medio infravalora las series con pausas: se toma la mayor de las dos lecturas.
  if (candidatos.length) {
    const mejor = candidatos.reduce((a, b) => (b.tss > a.tss ? b : a))
    return { tss: Math.round(mejor.tss * 10) / 10, metodo: mejor.metodo }
  }
  return { tss: Math.round(horas * TSS_HORA_SIN_DATOS * 10) / 10, metodo: 'duracion' }
}
