// lib/entrenos/coherencia-plan.ts
// REGLA: todo lo que ve el atleta de una sesión en una fecha (lista de ejercicios, pasos del reloj, km, series de las rondas) sale de
// `sesion-semana.ts` y TIENE QUE COINCIDIR entre sí. Esta comprobación cruza esas fuentes para cada semana del bloque y devuelve los
// desajustes; la usan `verificar:motor` (con un plan de ejemplo), el script de auditoría contra la BD y la aplicación de un plan nuevo.
import { validarPasos, resumenSesion } from './pasos'
import { ejerciciosParaFecha, pasosParaFecha, semanaDeFecha, type EjercicioCrudo, type PlanConProgresion } from './sesion-semana'
import { lunesDe, sumarDias } from './calendario-ajustes'
import { tipoCarreraDeNombre } from './progresion-semanal'

export interface SesionCoherencia { nombre: string; pasos: unknown; ejercicios: (EjercicioCrudo & { orden?: number | null })[] }

const minutosDeEjercicios = (ej: { series: number | null; repeticiones: string | null; bloque?: string | null }[]) =>
  ej.reduce((a, e) => {
    const m = (e.repeticiones ?? '').match(/^\s*(\d+)\s*min\s*$/i)
    return a + (m && (e.series ?? 1) <= 1 && ['calentamiento', 'principal', 'vuelta_calma'].includes(e.bloque ?? '') ? Number(m[1]) : 0)
  }, 0)

/** Desajustes de una sesión en una fecha concreta. Lista vacía = coherente. */
export function comprobarCoherenciaSesion(plan: PlanConProgresion, s: SesionCoherencia, fecha: string): string[] {
  const p: string[] = []
  const etiqueta = `«${s.nombre}» (${fecha}, semana ${semanaDeFecha(plan, fecha).n ?? '?'})`
  const ordenados = [...s.ejercicios].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  const lista = ejerciciosParaFecha(plan, ordenados, fecha, s.nombre)
  const pasos = validarPasos(pasosParaFecha(plan, { nombre: s.nombre, pasos: s.pasos }, fecha))
  const tipo = tipoCarreraDeNombre(s.nombre)

  if (pasos.ok && tipo) {
    const resumen = resumenSesion(pasos.pasos, null)
    const repetir = pasos.pasos.find(x => x.tipo === 'repetir')
    if (repetir && repetir.tipo === 'repetir') {
      const principal = lista.find(e => e.bloque === 'principal' && (e.series ?? 0) >= 2 && /^\s*\d{3,4}\s*m\s*$/i.test(e.repeticiones ?? ''))
      if (principal && principal.series !== repetir.veces) p.push(`${etiqueta}: la lista dice ${principal.series} repeticiones y los pasos del reloj ${repetir.veces}.`)
    } else {
      const enLista = minutosDeEjercicios(lista)
      const enPasos = Math.round((resumen.duracion_s ?? 0) / 60)
      if (enLista > 0 && Math.abs(enLista - enPasos) > 2) p.push(`${etiqueta}: la lista suma ${enLista} min y los pasos del reloj ${enPasos} min.`)
    }
  }
  // Rondas encadenadas: mismas series en toda la cadena.
  const crudos = ordenados
  for (let i = 0; i < lista.length; i++) {
    if (!crudos[i].encadenado) continue
    let fin = i
    while (fin + 1 < lista.length && crudos[fin].encadenado) fin++
    const series = new Set(lista.slice(i, fin + 1).map(e => e.series))
    if (series.size > 1) p.push(`${etiqueta}: ejercicios encadenados con series distintas (${[...series].join(' y ')}).`)
    i = fin
  }
  return p
}

/** Todas las semanas del bloque × todas las sesiones, más la regla de que la descarga siempre baja respecto a la semana anterior. */
export function comprobarCoherenciaPlan(plan: PlanConProgresion, sesiones: SesionCoherencia[]): string[] {
  const out: string[] = []
  const inicio = lunesDe(String((plan as { created_at: string }).created_at).slice(0, 10))
  const semanas = plan.duracion_semanas ?? 0
  const volumen: number[] = []
  for (let n = 1; n <= semanas; n++) {
    const fecha = sumarDias(inicio, (n - 1) * 7)
    let min = 0
    for (const s of sesiones) {
      out.push(...comprobarCoherenciaSesion(plan, s, fecha))
      const v = validarPasos(pasosParaFecha(plan, { nombre: s.nombre, pasos: s.pasos }, fecha))
      if (v.ok) min += (resumenSesion(v.pasos, null).duracion_s ?? 0) / 60
    }
    volumen.push(Math.round(min))
    const { descarga } = semanaDeFecha(plan, fecha)
    if (descarga && n > 1 && volumen[n - 1] >= volumen[n - 2]) out.push(`Semana ${n} es de descarga pero su carrera (${volumen[n - 1]} min) no baja respecto a la anterior (${volumen[n - 2]} min).`)
  }
  return out
}
