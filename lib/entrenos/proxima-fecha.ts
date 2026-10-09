// lib/entrenos/proxima-fecha.ts
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function aIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function proximaFechaDia(diaSemana: string | null | undefined, desde: Date = new Date()): string | null {
  if (!diaSemana) return null
  const objetivo = DIAS.indexOf(normalizar(diaSemana))
  if (objetivo < 0) return null
  const dif = (objetivo - desde.getDay() + 7) % 7
  const fecha = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + dif)
  return aIso(fecha)
}
