// lib/entrenos/sesion-semana.ts
// Lo que de verdad toca en una FECHA: la semana tipo del plan con la progresión de esa semana del bloque aplicada.
import { ejercicioDeCarreraDeLaSemana, ejercicioDeLaSemana, nombreSinCifras, pasosDeLaSemana, semanaDelBloque, type ProgresionPlan } from './progresion-semanal'

export interface PlanConProgresion { created_at: string; duracion_semanas: number | null; progresion?: unknown }

const esProg = (x: unknown): x is ProgresionPlan => !!x && typeof x === 'object' && (x as ProgresionPlan).version === 1 && Array.isArray((x as ProgresionPlan).semanas)

export interface EjercicioCrudo {
  series: number | null; repeticiones: string | null; peso_sugerido: string | null; bloque?: string | null; encadenado?: boolean | null
  ejercicio?: { nombre?: string | null; tipo?: string | null } | null
}

export function semanaDeFecha(plan: PlanConProgresion, fecha: string) {
  const n = semanaDelBloque(plan, fecha)
  const prog = esProg(plan.progresion) ? plan.progresion : null
  const descarga = !!(prog && n && prog.semanas.find(s => s.n === n)?.descarga)
  return { n, prog, descarga }
}

/** Pasos de una sesión de carrera en la semana de esa fecha (la base si el plan no tiene progresión). */
export function pasosParaFecha(plan: PlanConProgresion, sesion: { nombre: string; pasos: unknown }, fecha: string): unknown {
  const { n, prog } = semanaDeFecha(plan, fecha)
  return (prog && n ? pasosDeLaSemana(sesion.pasos, sesion.nombre, prog, n) : null) ?? sesion.pasos
}

/** Ejercicios de una sesión en la semana de esa fecha; mantiene el resto de campos y añade `objetivo_open` y `cambio_semana`. */
export function ejerciciosParaFecha<E extends EjercicioCrudo>(plan: PlanConProgresion, ejercicios: E[], fecha: string, nombreSesion = ''): (E & { objetivo_open: string | null; cambio_semana: boolean })[] {
  const { n, prog, descarga } = semanaDeFecha(plan, fecha)
  const salida = ejercicios.map(e => {
    const carrera = ejercicioDeCarreraDeLaSemana({ nombre: e.ejercicio?.nombre ?? '', bloque: e.bloque, series: e.series, repeticiones: e.repeticiones }, nombreSesion, prog, n)
    if (carrera.series !== e.series || carrera.repeticiones !== e.repeticiones) return { ...e, series: carrera.series, repeticiones: carrera.repeticiones, objetivo_open: null, cambio_semana: true }
    const r = ejercicioDeLaSemana({ nombre: e.ejercicio?.nombre ?? '', bloque: e.bloque, tipo: e.ejercicio?.tipo, series: e.series, repeticiones: e.repeticiones, peso_sugerido: e.peso_sugerido }, prog && n ? n : 1, prog ? descarga : false)
    return { ...e, series: r.series, repeticiones: r.repeticiones, peso_sugerido: r.peso_sugerido, objetivo_open: r.objetivo_open, cambio_semana: r.cambio }
  })
  // Los ejercicios encadenados («sin parar») son rondas: comparten series. Si uno progresa, el resto de la cadena lo sigue.
  for (let i = 0; i < salida.length; i++) {
    if (!ejercicios[i].encadenado) continue
    let fin = i
    while (fin + 1 < salida.length && ejercicios[fin].encadenado) fin++
    const series = Math.max(...salida.slice(i, fin + 1).map(x => x.series ?? 0))
    for (let j = i; j <= fin; j++) if (salida[j].series !== series) salida[j] = { ...salida[j], series, cambio_semana: true }
    i = fin
  }
  return salida
}

export { nombreSinCifras }
