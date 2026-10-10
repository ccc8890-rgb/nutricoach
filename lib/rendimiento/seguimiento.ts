// lib/rendimiento/seguimiento.ts
// Seguimiento de resultados: qué pasó con el atleta después de cada cambio que se aplicó al plan.
// Compara las 4 semanas anteriores con las posteriores en indicadores sacados de los entrenos reales (reloj).
// Es un «antes y después», no una prueba de causa: el calor, el descanso o una carrera también mueven estas cifras.
import { calcularDeriva } from './deriva'
import { repartoEntreFechas } from './intensidad'
import { eficienciaDe, type EntrenoPanel } from './panel'
import { esCarrera } from './carga'

export type ClaveMetrica = 'pct_suave' | 'deriva' | 'eficiencia' | 'carga_semana' | 'km_semana'
export const CLAVES_METRICA: readonly ClaveMetrica[] = ['pct_suave', 'deriva', 'eficiencia', 'carga_semana', 'km_semana']
export type Direccion = 'sube' | 'baja'

export type Lectura = 'mejora' | 'empeora' | 'igual' | 'sube' | 'baja' | 'sin_datos'
export type EstadoEvaluacion = 'en_curso' | 'avance' | 'evaluable'
export type Veredicto = 'pendiente' | 'sin_datos' | 'funciona' | 'no_se_nota' | 'empeora'

interface DefMetrica {
  nombre: string
  unidad: string
  /** Qué sentido es «mejor»; null = métrica informativa (sube o baja sin juicio). */
  mejor: Direccion | null
  /** Cambio mínimo para considerarlo real (misma unidad; relativo si `relativo`). */
  umbral: number
  relativo: boolean
  decimales: number
}

export const METRICAS: Record<ClaveMetrica, DefMetrica> = {
  pct_suave: { nombre: 'Tiempo suave', unidad: '%', mejor: 'sube', umbral: 5, relativo: false, decimales: 0 },
  deriva: { nombre: 'Deriva cardiaca', unidad: '%', mejor: 'baja', umbral: 1.5, relativo: false, decimales: 1 },
  eficiencia: { nombre: 'Eficiencia aeróbica', unidad: 'm/min por ppm', mejor: 'sube', umbral: 0.02, relativo: true, decimales: 2 },
  carga_semana: { nombre: 'Carga semanal', unidad: 'TSS', mejor: null, umbral: 0.1, relativo: true, decimales: 0 },
  km_semana: { nombre: 'Carrera por semana', unidad: 'km', mejor: null, umbral: 0.1, relativo: true, decimales: 1 },
}

export const VENTANA_DIAS = 28
/** Menos días que esto desde el cambio y es pronto para decir nada. */
const DIAS_AVANCE = 14
/** Mínimo de carreras con dato en cada ventana para comparar deriva y eficiencia. */
const MIN_CARRERAS = 2

export interface ResultadoMetrica {
  clave: ClaveMetrica
  nombre: string
  unidad: string
  antes: number | null
  despues: number | null
  delta: number | null
  lectura: Lectura
  esObjetivo: boolean
}

export interface Evaluacion {
  fecha: string
  dias: number
  estado: EstadoEvaluacion
  metricas: ResultadoMetrica[]
  veredicto: Veredicto
}

export type EntrenoSeguimiento = EntrenoPanel

const sumarDias = (f: string, n: number) => {
  const d = new Date(`${f}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const diasEntre = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000)
const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)
const redondear = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d

/** Indicadores de una ventana [desde, hasta] (ambas incluidas). */
export function indicadoresVentana(entrenos: EntrenoSeguimiento[], desde: string, hasta: string, fcUmbral: number | null): Record<ClaveMetrica, number | null> {
  const enVentana = entrenos.filter(e => e.fecha >= desde && e.fecha <= hasta)
  const semanas = (diasEntre(desde, hasta) + 1) / 7
  const carreras = enVentana.filter(e => esCarrera(e.tipo))

  const reparto = repartoEntreFechas(entrenos, desde, hasta, fcUmbral)
  const derivas = carreras.flatMap(e => { const d = calcularDeriva(e.vueltas); return d && e.tipo !== 'treadmill_running' ? [d.derivaPct] : [] })
  const eficiencias = carreras.flatMap(e => { const v = eficienciaDe(e); return v === null ? [] : [v] })

  return {
    pct_suave: reparto.valoracion === 'sin_datos' ? null : reparto.pctSuave,
    deriva: derivas.length >= MIN_CARRERAS ? media(derivas) : null,
    eficiencia: eficiencias.length >= MIN_CARRERAS ? media(eficiencias) : null,
    carga_semana: enVentana.length ? enVentana.reduce((a, e) => a + (e.tss ?? 0), 0) / semanas : null,
    km_semana: carreras.length ? carreras.reduce((a, e) => a + (e.distancia_m ?? 0) / 1000, 0) / semanas : null,
  }
}

function leer(def: DefMetrica, antes: number | null, despues: number | null): { delta: number | null; lectura: Lectura } {
  if (antes === null || despues === null) return { delta: null, lectura: 'sin_datos' }
  const delta = despues - antes
  const cambio = def.relativo ? (antes !== 0 ? Math.abs(delta / antes) : Math.abs(delta)) : Math.abs(delta)
  if (cambio < def.umbral) return { delta, lectura: 'igual' }
  const sube = delta > 0
  if (def.mejor === null) return { delta, lectura: sube ? 'sube' : 'baja' }
  return { delta, lectura: (def.mejor === 'sube') === sube ? 'mejora' : 'empeora' }
}

export interface OpcionesEvaluacion {
  /** Métrica que el cambio buscaba mejorar (si se declaró) y en qué sentido. */
  objetivo?: { clave: ClaveMetrica; direccion?: Direccion } | null
}

/** Compara las 4 semanas anteriores a `fecha` con las posteriores (hasta 4 semanas, o hasta hoy). */
export function evaluarCambio(entrenos: EntrenoSeguimiento[], fecha: string, hoy: string, fcUmbral: number | null, opciones: OpcionesEvaluacion = {}): Evaluacion {
  const dias = Math.max(0, diasEntre(fecha, hoy))
  const estado: EstadoEvaluacion = dias < DIAS_AVANCE ? 'en_curso' : dias < VENTANA_DIAS ? 'avance' : 'evaluable'

  const antes = indicadoresVentana(entrenos, sumarDias(fecha, -VENTANA_DIAS), sumarDias(fecha, -1), fcUmbral)
  const finDespues = dias >= VENTANA_DIAS ? sumarDias(fecha, VENTANA_DIAS - 1) : hoy
  const despues = indicadoresVentana(entrenos, fecha, finDespues, fcUmbral)

  const obj = opciones.objetivo ?? null
  const metricas: ResultadoMetrica[] = CLAVES_METRICA.map(clave => {
    const def = METRICAS[clave]
    const { delta, lectura } = leer(def, antes[clave], despues[clave])
    return {
      clave,
      nombre: def.nombre,
      unidad: def.unidad,
      antes: antes[clave] === null ? null : redondear(antes[clave]!, def.decimales),
      despues: despues[clave] === null ? null : redondear(despues[clave]!, def.decimales),
      delta: delta === null ? null : redondear(delta, def.decimales),
      lectura,
      esObjetivo: obj?.clave === clave,
    }
  })

  return { fecha, dias, estado, metricas, veredicto: veredicto(estado, metricas, obj) }
}

function veredicto(estado: EstadoEvaluacion, metricas: ResultadoMetrica[], obj: OpcionesEvaluacion['objetivo']): Veredicto {
  if (estado === 'en_curso') return 'pendiente'

  if (obj) {
    const m = metricas.find(x => x.clave === obj.clave)
    if (!m || m.lectura === 'sin_datos') return 'sin_datos'
    if (m.lectura === 'igual') return 'no_se_nota'
    if (m.lectura === 'mejora') return 'funciona'
    if (m.lectura === 'empeora') return 'empeora'
    // Métrica informativa: se compara con el sentido que buscaba el cambio.
    if (!obj.direccion) return 'no_se_nota'
    return (m.lectura === 'sube') === (obj.direccion === 'sube') ? 'funciona' : 'empeora'
  }

  const con = metricas.filter(m => METRICAS[m.clave].mejor !== null && m.lectura !== 'sin_datos')
  if (con.length === 0) return 'sin_datos'
  const mejoran = con.filter(m => m.lectura === 'mejora').length
  const empeoran = con.filter(m => m.lectura === 'empeora').length
  if (mejoran > empeoran) return 'funciona'
  if (empeoran > mejoran) return 'empeora'
  return 'no_se_nota'
}
