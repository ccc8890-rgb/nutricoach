// lib/training/ejercicio-texto.ts
// Texto mínimo de cada ejercicio: solo lo esencial a la vista y el resto, más corto, detrás de un toque.

/** «120» → «2:00»; menos de un minuto → «45s». */
export function pausa(seg: number): string {
  return seg >= 60 ? `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}` : `${seg}s`
}

/** Ritmo objetivo («4:15/km») si la nota lo dice: es lo único de la nota que hace falta ver sin abrirla. */
export function ritmoDeLaNota(nota: string | null | undefined): string | null {
  const m = nota?.match(/\b(\d{1,2}:\d{2})\s*\/\s*km\b/)
  return m ? `${m[1]}/km` : null
}

/** «RPE 6-7 (sem 1-2) · 7-8 (sem 3) — texto» → «Esfuerzo 6-7 de 10. texto»: solo el esfuerzo de ahora, sin variantes ni siglas. */
export function notaLegible(nota: string): string {
  const m = nota.match(/^RPE\s+(\d+(?:-\d+)?)[^—]*—\s*([\s\S]*)$/)
  return m ? `Esfuerzo ${m[1]} de 10. ${m[2]}` : nota
}
