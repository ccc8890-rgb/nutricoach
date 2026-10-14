// lib/entrenos/tarjeta-story.ts
// Tarjeta vertical (1080×1920) con el resumen de una sesión para compartir en Instagram Stories.
// Se dibuja en un canvas (sin dependencias) y sale como PNG.
import { normalizarBloqueSesion } from '@/lib/training/session-blocks'

export interface DatosTarjeta {
  fecha: string // YYYY-MM-DD
  tipo: string // «HÍBRIDO», «CARRERA»…
  titulo: string
  semana?: string | null // «SEMANA 2/4»
  duracionMin?: number | null
  km?: number | null
  ejercicios: Array<{
    nombre: string
    series: number | null
    repeticiones: string | null
    peso: string | null
    bloque?: string | null
  }>
}

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

export function etiquetaFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DIAS[dt.getDay()]} · ${d} ${MESES[m - 1]} ${y}`
}

/** Solo lo que se entrena de verdad: sin movilidad, calentamiento ni vuelta a la calma. */
export function ejerciciosPrincipales<T extends { bloque?: string | null }>(items: T[]): T[] {
  const fuertes = items.filter(e => ['principal', 'accesorios', 'pliometria'].includes(normalizarBloqueSesion(e.bloque)))
  return fuertes.length ? fuertes : items
}

function recortar(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string {
  if (ctx.measureText(texto).width <= ancho) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

/** «4×500» grande y la unidad pequeña aparte: «20 m» → ['4×20', 'M']. */
function partesSeries(e: DatosTarjeta['ejercicios'][number]): [string, string] {
  const reps = (e.repeticiones ?? '').trim()
  const m = reps.match(/^(\d+(?:[-–]\d+)?)\s*(.*)$/)
  const num = m ? m[1] : reps
  const unidad = m ? m[2].toUpperCase() : ''
  const grande = e.series && e.series > 1 && num ? `${e.series}×${num}` : num || String(e.series ?? '')
  return [grande, unidad]
}

export async function dibujarTarjeta(d: DatosTarjeta): Promise<Blob> {
  const W = 1080
  const H = 1920
  const M = 110
  const css = getComputedStyle(document.documentElement)
  const sans = css.getPropertyValue('--font-instrument').trim() || 'system-ui, sans-serif'
  const mono = css.getPropertyValue('--font-geist-mono').trim() || 'ui-monospace, monospace'
  try {
    await Promise.all([
      document.fonts.load(`300 80px ${sans}`),
      document.fonts.load(`600 30px ${mono}`),
    ])
  } catch { /* se dibuja con la fuente de respaldo */ }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const INK = '#EDEDF0'
  const MUTED = '#7E7E88'
  const METAL = '#C9CCD3'

  ctx.fillStyle = '#070708'
  ctx.fillRect(0, 0, W, H)
  const halo = ctx.createRadialGradient(W * 0.85, 400, 0, W * 0.85, 400, 1000)
  halo.addColorStop(0, 'rgba(201,204,211,0.09)')
  halo.addColorStop(1, 'rgba(201,204,211,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, W, H)

  const filas = d.ejercicios.slice(0, 6)
  const rowH = 200
  // Centrado dentro de la zona que no tapa la interfaz de Stories (≈ 250 arriba, 300 abajo)
  const zonaTop = 250
  const zonaH = H - 250 - 300
  let y = zonaTop + (zonaH - rowH * filas.length) / 2

  filas.forEach(e => {
    const [grande, unidad] = partesSeries(e)
    const base = y + 112
    // Marca fina de metal a la izquierda
    ctx.fillStyle = METAL
    ctx.fillRect(M, y + 20, 6, 110)

    ctx.textAlign = 'left'
    ctx.font = `300 132px ${sans}`
    ctx.fillStyle = INK
    let x = M + 40
    for (const ch of grande) {
      ctx.fillStyle = ch === '×' ? METAL : INK
      ctx.fillText(ch, x, base)
      x += ctx.measureText(ch).width
    }
    if (unidad) {
      ctx.font = `600 34px ${mono}`
      ctx.fillStyle = METAL
      ctx.fillText(unidad, x + 14, base)
    }
    const detalle = [e.nombre, e.peso].filter(Boolean).join('  ·  ').toUpperCase()
    ctx.font = `600 28px ${mono}`
    ctx.fillStyle = MUTED
    ctx.fillText(recortar(ctx, detalle, W - M * 2 - 40), M + 40, base + 52)
    y += rowH
  })

  return new Promise((ok, ko) => canvas.toBlob(b => (b ? ok(b) : ko(new Error('canvas'))), 'image/png'))
}
