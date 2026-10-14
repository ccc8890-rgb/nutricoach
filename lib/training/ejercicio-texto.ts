import { duracionCorta } from '@/lib/entrenos/duracion'
// lib/training/ejercicio-texto.ts
// Texto mínimo de cada ejercicio: solo lo esencial a la vista y el resto, más corto, detrás de un toque.

/** «120» → «2'»; «90» → «90''»; «45» → «45''». */
export function pausa(seg: number): string {
  return duracionCorta(seg)
}

/** Ritmo objetivo («4:15/km») si la nota lo dice: es lo único de la nota que hace falta ver sin abrirla. */
export function ritmoDeLaNota(nota: string | null | undefined): string | null {
  const m = nota?.match(/\b(\d{1,2}:\d{2})\s*\/\s*km\b/)
  return m ? `${m[1]}/km` : null
}

/** «RPE 6-7 (sem 1-2) · 7-8 (sem 3) — texto» → «Esfuerzo 6-7 de 10. texto»: solo el esfuerzo de ahora, sin variantes ni siglas. */
export function notaLegible(nota: string): string {
  const m = nota.match(/^RPE\s+(\d+(?:-\d+)?)[^—]*—\s*([\s\S]*)$/)
  return ritmoPorKm(m ? `Esfuerzo ${m[1]} de 10. ${m[2]}` : nota)
}

/** «1:42 por 400» (tiempo de la serie) → «4:15/km»: el ritmo orienta más que el tiempo parcial. */
export function ritmoPorKm(texto: string): string {
  return texto.replace(/\b(\d{1,2}):(\d{2})\s+por\s+(\d{3,4})(?:\s*m\b)?/gi, (orig, min, seg, dist) => {
    const total = Math.round((Number(min) * 60 + Number(seg)) * 1000 / Number(dist))
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}/km`
  })
}
