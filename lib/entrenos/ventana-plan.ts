// lib/entrenos/ventana-plan.ts
// Ventana en la que la plantilla semanal de un plan «está activa»: desde el día en que se creó
// hasta el final de su bloque (duración en semanas). Fuera de ella el calendario no proyecta sesiones.
import { fechaFinBloque } from './bloques'

function aISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function estadoVentanaPlan(createdAt: string, duracionSemanas: number | null) {
  const inicio = aISO(new Date(createdAt))
  return (fecha: string): { antesDeInicio: boolean; bloquePendiente: boolean } => {
    const [y, m, d] = fecha.split('-').map(Number)
    const dia = new Date(y, m - 1, d)
    return {
      antesDeInicio: fecha < inicio,
      bloquePendiente: duracionSemanas ? dia.getTime() >= fechaFinBloque(createdAt, duracionSemanas).getTime() : false,
    }
  }
}

export function plantillaActivaEn(createdAt: string, duracionSemanas: number | null): (fecha: string) => boolean {
  const estado = estadoVentanaPlan(createdAt, duracionSemanas)
  return fecha => {
    const e = estado(fecha)
    return !e.antesDeInicio && !e.bloquePendiente
  }
}
