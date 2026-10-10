// lib/rendimiento/fechas.ts
export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7 // lunes = 0
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}
