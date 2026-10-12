// lib/entrenos/marcas.ts
// «Mis marcas» (peso con el que el atleta hace 5 repeticiones buenas) y «cierre de bloque» (cómo fueron las cargas).
// Son datos que solo el atleta sabe: sin ellos los pesos del plan son estimaciones. Todo es opcional.

export const MARCAS = [
  { clave: 'sentadilla_5rm', etiqueta: 'Sentadilla (5 reps)', unidad: 'kg', min: 10, max: 400, rm: 'rm_sentadilla_kg' },
  { clave: 'banca_5rm', etiqueta: 'Press banca (5 reps)', unidad: 'kg', min: 10, max: 300, rm: 'rm_banca_kg' },
  { clave: 'peso_muerto_5rm', etiqueta: 'Peso muerto (5 reps)', unidad: 'kg', min: 10, max: 450, rm: 'rm_peso_muerto_kg' },
  { clave: 'dominadas_max', etiqueta: 'Dominadas seguidas (máx.)', unidad: 'reps', min: 0, max: 60, rm: 'dominadas_max_reps' },
  { clave: 'sled_push_kg', etiqueta: 'Sled push cómodo (20-25 m)', unidad: 'kg', min: 10, max: 400, rm: null },
] as const
export type ClaveMarca = typeof MARCAS[number]['clave']
export type Marcas = Partial<Record<ClaveMarca, number>>

/** 1RM estimada desde un 5RM (Epley: peso × (1 + reps/30)), redondeada a 0,5 kg. Es una estimación, no un test máximo. */
export const rmDesdeCincoReps = (kg: number) => Math.round(kg * (1 + 5 / 30) * 2) / 2

/** Solo claves conocidas, números dentro de rango; lo demás se descarta. null = quitar la marca. */
export function validarMarcas(entrada: unknown): { ok: true; marcas: Record<string, number | null> } | { ok: false; error: string } {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return { ok: false, error: 'Formato no válido' }
  const out: Record<string, number | null> = {}
  for (const m of MARCAS) {
    const v = (entrada as Record<string, unknown>)[m.clave]
    if (v === undefined) continue
    if (v === null || v === '') { out[m.clave] = null; continue }
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
    if (!Number.isFinite(n) || n < m.min || n > m.max) return { ok: false, error: `${m.etiqueta}: valor fuera de rango (${m.min}-${m.max} ${m.unidad})` }
    out[m.clave] = Math.round(n * 2) / 2
  }
  return { ok: true, marcas: out }
}

// ───────────────────────── Cierre de bloque ─────────────────────────
export type Valoracion = 'flojo' | 'justo' | 'pesado'
export const VALORACIONES: { valor: Valoracion; etiqueta: string }[] = [{ valor: 'flojo', etiqueta: 'Floja' }, { valor: 'justo', etiqueta: 'Justa' }, { valor: 'pesado', etiqueta: 'Pesada' }]

export const PREGUNTAS_CIERRE = [
  { clave: 'sentadilla', etiqueta: 'Sentadilla', patron: /sentadilla (con barra|trasera)/i },
  { clave: 'press_banca', etiqueta: 'Press banca', patron: /press banca/i },
  { clave: 'sled_push', etiqueta: 'Sled push', patron: /sled push/i },
  { clave: 'carrera', etiqueta: 'Carrera', patron: null },
] as const
export type ClaveCierre = typeof PREGUNTAS_CIERRE[number]['clave']

/** Qué preguntar según lo que hubo en el plan (no se pregunta por un ejercicio que no estaba). */
export function preguntasDelPlan(nombresEjercicios: string[], haySesionesDeCarrera: boolean) {
  return PREGUNTAS_CIERRE.filter(p => (p.patron ? nombresEjercicios.some(n => p.patron!.test(n)) : haySesionesDeCarrera))
}

export const esValoracion = (x: unknown): x is Valoracion => x === 'flojo' || x === 'justo' || x === 'pesado'

const INSTRUCCION: Record<Valoracion, string> = {
  flojo: 'iba floja: subir la carga inicial del siguiente bloque (+5 % o un escalón extra)',
  justo: 'iba justa: mantener la progresión normal',
  pesado: 'iba pesada: mantener o bajar un 5 % la carga inicial y no acelerar la progresión',
}

/** Texto para el generador de planes con lo que el atleta ha dicho de sí mismo. Vacío si no hay nada. */
export function textoMarcasYFeedback(marcas: Marcas | null | undefined, feedback: { clave: string; valoracion: Valoracion }[]): string {
  const l: string[] = []
  for (const m of MARCAS) { const v = marcas?.[m.clave]; if (v != null) l.push(`- ${m.etiqueta}: ${v} ${m.unidad}${m.clave === 'sled_push_kg' ? ' (peso con el que se siente cómodo)' : ''}`) }
  const etiqueta = (c: string) => PREGUNTAS_CIERRE.find(p => p.clave === c)?.etiqueta ?? c
  const fb = feedback.map(f => `- ${etiqueta(f.clave)} del bloque anterior: ${INSTRUCCION[f.valoracion]}`)
  if (!l.length && !fb.length) return ''
  return `\n## LO QUE EL ATLETA HA DICHO DE SÍ MISMO (dato real, manda sobre tus estimaciones)\n${[...l, ...fb].join('\n')}\n`
}
