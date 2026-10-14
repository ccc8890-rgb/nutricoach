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

const INK = '#EDEDF0'
const MUTED = '#9A9AA4'
const METAL = '#C9CCD3'

async function prepararCanvas(w: number, h: number) {
  const css = getComputedStyle(document.documentElement)
  const sans = css.getPropertyValue('--font-instrument').trim() || 'system-ui, sans-serif'
  const mono = css.getPropertyValue('--font-geist-mono').trim() || 'ui-monospace, monospace'
  try {
    await Promise.all([document.fonts.load(`300 80px ${sans}`), document.fonts.load(`700 40px ${sans}`), document.fonts.load(`600 30px ${mono}`)])
  } catch { /* fuente de respaldo */ }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  // Panel oscuro translúcido con borde fino: se lee sobre cualquier foto o vídeo
  ctx.beginPath()
  ctx.roundRect(2, 2, w - 4, h - 4, 36)
  ctx.fillStyle = 'rgba(7,7,8,0.74)'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(201,204,211,0.38)'
  ctx.stroke()
  return { canvas, ctx, sans, mono }
}

const aBlob = (c: HTMLCanvasElement) => new Promise<Blob>((ok, ko) => c.toBlob(b => (b ? ok(b) : ko(new Error('canvas'))), 'image/png'))

/** Anillo de la app: aro fino con marcas y trazos de metal que acaban en un punto luminoso. */
function dibujarAnillo(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, tramos: Array<{ frac: number; color: string }>) {
  const TAU = Math.PI * 2
  ctx.lineCap = 'round'
  // aro fino
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(201,204,211,0.28)'; ctx.stroke()
  // marcas alrededor
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU
    const largo = i % 5 === 0 ? 14 : 7
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * (R + 16), cy + Math.sin(a) * (R + 16))
    ctx.lineTo(cx + Math.cos(a) * (R + 16 + largo), cy + Math.sin(a) * (R + 16 + largo))
    ctx.lineWidth = 2; ctx.strokeStyle = i % 5 === 0 ? 'rgba(201,204,211,0.55)' : 'rgba(201,204,211,0.22)'; ctx.stroke()
  }
  // trazos
  const total = tramos.reduce((a, t) => a + t.frac, 0) || 1
  const hueco = tramos.length > 1 ? 0.045 : 0
  const barrido = 0.92 * TAU
  let ang = -Math.PI / 2 + 0.04 * TAU
  let fin = ang
  tramos.forEach(t => {
    const sweep = Math.max(0.02, (t.frac / total) * (barrido - hueco * TAU * tramos.length))
    ctx.beginPath(); ctx.arc(cx, cy, R, ang, ang + sweep); ctx.lineWidth = 12; ctx.strokeStyle = t.color; ctx.stroke()
    fin = ang + sweep
    ang += sweep + hueco * TAU
  })
  // punto luminoso al final
  ctx.save()
  ctx.shadowColor = 'rgba(237,237,240,0.9)'; ctx.shadowBlur = 24
  ctx.beginPath(); ctx.arc(cx + Math.cos(fin) * R, cy + Math.sin(fin) * R, 9, 0, TAU); ctx.fillStyle = '#FFFFFF'; ctx.fill()
  ctx.restore()
}

const W_TARJETA = 440

/** Sticker de la sesión: solo «4×500» grande y el nombre pequeño debajo. Fondo transparente fuera del panel. */
export async function dibujarTarjeta(d: DatosTarjeta): Promise<Blob> {
  const filas = d.ejercicios.slice(0, 6)
  const W = 520
  const P = 40
  const rowH = 104
  const H = P * 2 + rowH * filas.length - 20
  const { canvas, ctx, sans, mono } = await prepararCanvas(W, H)
  filas.forEach((e, i) => {
    const y = P + rowH * i
    const [grande, unidad] = partesSeries(e)
    const base = y + 58
    ctx.fillStyle = METAL
    ctx.fillRect(P, y + 8, 4, 58)
    ctx.textAlign = 'left'
    ctx.font = `300 66px ${sans}`
    let x = P + 24
    for (const ch of grande) {
      ctx.fillStyle = ch === '×' ? METAL : INK
      ctx.fillText(ch, x, base)
      x += ctx.measureText(ch).width
    }
    if (unidad) { ctx.font = `600 20px ${mono}`; ctx.fillStyle = METAL; ctx.fillText(unidad, x + 8, base) }
    ctx.font = `600 16px ${mono}`
    ctx.fillStyle = MUTED
    ctx.fillText(recortar(ctx, [e.nombre, e.peso].filter(Boolean).join('  ·  ').toUpperCase(), W - P * 2 - 24), P + 24, base + 28)
  })
  return aBlob(canvas)
}

export interface DatosPlato { nombre: string; kcal: number; p: number; c: number; g: number; detalle?: string | null }

/** Sticker del plato: anillo con el reparto de kcal entre proteína, carbos y grasa y las kcal en el centro. */
export async function dibujarTarjetaPlato(d: DatosPlato): Promise<Blob> {
  const W = W_TARJETA
  const R = 96
  const H = 56 + (R + 40) * 2 + 24 + 64 + 28
  const { canvas, ctx, sans, mono } = await prepararCanvas(W, H)
  const cx = W / 2
  const cy = 56 + R + 40
  dibujarAnillo(ctx, cx, cy, R, [
    { frac: Math.max(d.p, 0) * 4, color: '#FFFFFF' },
    { frac: Math.max(d.c, 0) * 4, color: METAL },
    { frac: Math.max(d.g, 0) * 9, color: '#6E7079' },
  ])
  ctx.textAlign = 'center'
  ctx.font = `200 80px ${sans}`
  ctx.fillStyle = INK
  ctx.fillText(String(Math.round(d.kcal)), cx, cy + 20)
  ctx.font = `600 16px ${mono}`
  ctx.fillStyle = MUTED
  ctx.fillText('KCAL', cx, cy + 50)
  const col = (W - 100) / 3
  const macros: Array<[number, string, string]> = [[d.p, 'P', '#FFFFFF'], [d.c, 'C', METAL], [d.g, 'G', '#8A8C95']]
  const y = cy + R + 40 + 24 + 40
  macros.forEach(([v, l, color], i) => {
    const x = 50 + col * i + col / 2
    ctx.font = `300 42px ${sans}`
    ctx.fillStyle = INK
    const t = String(Math.round(v))
    ctx.fillText(t, x - 6, y)
    ctx.textAlign = 'left'
    ctx.font = `600 16px ${mono}`
    ctx.fillStyle = color
    ctx.fillText(l, x - 6 + ctx.measureText(t).width / 2 + 8, y - 22)
    ctx.textAlign = 'center'
  })
  return aBlob(canvas)
}
