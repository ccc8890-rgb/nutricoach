// Qué comida cae antes (pre) y después (post) del entrenamiento de cada día, a partir de la hora habitual
// de entreno del cuestionario. Con tres comidas al día no hay hueco para un snack: se elige la comida
// adecuada y el motor la compone con recetas y complementos de pre o post entreno.
import type { SlotComida } from '@/lib/tipos-comida'
import type { TipoDiaNutricional } from '@/lib/periodizacion/dia-entreno-nutricion'

export type MomentoDia = { hora: string; pre: SlotComida | null; post: SlotComida | null; nota: string | null }

// Horas habituales de cada franja (minutos desde medianoche) cuando el plan no fija otras
const HORA_FRANJA: Record<SlotComida, number> = { 'Desayuno': 8 * 60, 'Media mañana': 11 * 60, 'Comida': 14 * 60 + 30, 'Merienda': 17 * 60 + 30, 'Cena': 21 * 60 }
const DURACION_MIN = 75

export function parsearHora(h: unknown): number | null {
  const m = typeof h === 'string' ? h.match(/^(\d{1,2}):(\d{2})/) : null
  if (!m) return null
  const min = Number(m[1]) * 60 + Number(m[2])
  return min >= 0 && min < 24 * 60 ? min : null
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export function momentoDeEntreno(hora: unknown, tipo: TipoDiaNutricional, franjas: SlotComida[]): MomentoDia | null {
  const ini = parsearHora(hora)
  if (ini == null || tipo === 'descanso_activo' || tipo === 'descanso_total' || franjas.length === 0) return null
  const fin = ini + DURACION_MIN
  // Una comida que caería durante el entreno se retrasa a después de entrenar
  const efectiva = franjas.map(f => {
    const t = HORA_FRANJA[f]
    return { f, t: t > ini - 60 && t < fin ? fin + 20 : t }
  }).sort((a, b) => a.t - b.t)
  const antes = efectiva.filter(e => e.t <= ini - 30)
  const despues = efectiva.filter(e => e.t >= fin && e.t <= fin + 180)
  const pre = antes.length ? antes[antes.length - 1] : null
  const post = despues.length ? despues[0] : null
  let nota: string | null = null
  if (!pre) nota = 'Entrena casi en ayunas: una fruta ligera 30 min antes si lo necesita.'
  else if (ini - pre.t > 240) nota = `La comida previa queda lejos (${hhmm(pre.t)}): un tentempié de hidratos 30-60 min antes (plátano, dátiles) evita llegar sin energía.`
  return { hora: hhmm(ini), pre: pre?.f ?? null, post: post?.f ?? null, nota }
}
