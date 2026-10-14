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
  marcasEsquina(ctx, w, h)
  return { canvas, ctx, sans, mono }
}

const aBlob = (c: HTMLCanvasElement) => new Promise<Blob>((ok, ko) => c.toBlob(b => (b ? ok(b) : ko(new Error('canvas'))), 'image/png'))

/** Marcas de registro en las cuatro esquinas, como un instrumento de medida. */
function marcasEsquina(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const m = 22, l = 16
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(201,204,211,0.5)'; ctx.lineCap = 'butt'
  for (const [x, y, dx, dy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]] as const) {
    ctx.beginPath(); ctx.moveTo(x + dx * l, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * l); ctx.stroke()
  }
}

/** Símbolo de la app: aro con marcas y un trazo que acaba en un punto luminoso. Sin nombre. */
function glifo(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const TAU = Math.PI * 2
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(201,204,211,0.6)'; ctx.stroke()
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r + 3), cy + Math.sin(a) * (r + 3)); ctx.lineTo(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6))
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(201,204,211,0.4)'; ctx.stroke()
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, 0.9); ctx.lineWidth = 3; ctx.strokeStyle = '#FFFFFF'; ctx.stroke()
  ctx.save(); ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 10
  ctx.beginPath(); ctx.arc(cx + Math.cos(0.9) * r, cy + Math.sin(0.9) * r, 3.2, 0, TAU); ctx.fillStyle = '#FFF'; ctx.fill(); ctx.restore()
}

/** Firma: símbolo del aro + «RATIO» en mono espaciado, centrada. */
function firma(ctx: CanvasRenderingContext2D, w: number, y: number, mono: string) {
  ctx.font = `600 15px ${mono}`
  ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '6px'
  const texto = 'RATIO'
  const ancho = ctx.measureText(texto).width - 6
  const total = 22 + 16 + ancho
  const x0 = (w - total) / 2
  glifo(ctx, x0 + 11, y, 9)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#C9CCD3'
  ctx.fillText(texto, x0 + 38, y + 5)
  ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px'
}


/** Sticker de la sesión: filas «01 · nombre · 4×6 · 80 kg» separadas por líneas finas. Sin títulos. */
export async function dibujarTarjeta(d: DatosTarjeta): Promise<Blob> {
  const filas = d.ejercicios.slice(0, 6)
  const W = 640
  const P = 48
  const rowH = 62
  const H = P + rowH * filas.length + 74
  const { canvas, ctx, sans, mono } = await prepararCanvas(W, H)
  filas.forEach((e, i) => {
    const y = P + rowH * i
    const base = y + 38
    ctx.textAlign = 'left'
    ctx.font = `600 14px ${mono}`
    ctx.fillStyle = MUTED
    ctx.fillText(String(i + 1).padStart(2, '0'), P, base - 2)
    const [grande, unidad] = partesSeries(e)
    const der = [`${grande}${unidad ? ' ' + unidad.toLowerCase() : ''}`, e.peso].filter(Boolean).join(' · ')
    ctx.font = `600 18px ${mono}`
    const anchoDer = ctx.measureText(der).width
    ctx.fillStyle = METAL
    ctx.textAlign = 'right'
    ctx.fillText(der, W - P, base - 2)
    ctx.textAlign = 'left'
    ctx.font = `500 22px ${sans}`
    ctx.fillStyle = INK
    ctx.fillText(recortar(ctx, e.nombre, W - P * 2 - 48 - anchoDer - 20), P + 46, base)
    ctx.fillStyle = 'rgba(201,204,211,0.16)'
    if (i < filas.length - 1) ctx.fillRect(P, y + rowH - 4, W - P * 2, 1.5)
  })
  firma(ctx, W, H - 40, mono)
  return aBlob(canvas)
}

export interface DatosPlato { nombre: string; kcal: number; p: number; c: number; g: number; detalle?: string | null }

/** Anillo limpio (sin marcas de reloj): aro tenue, trazos proporcionales y punto luminoso al final. */
function anilloLimpio(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, tramos: Array<{ frac: number; color: string }>) {
  const TAU = Math.PI * 2
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(201,204,211,0.14)'; ctx.stroke()
  const total = tramos.reduce((acc, t) => acc + t.frac, 0)
  const hueco = tramos.length > 1 ? 0.12 : 0
  let ang = -Math.PI / 2 + hueco / 2
  let fin = ang
  tramos.forEach(t => {
    const sweep = Math.max(0.05, t.frac * (tramos.length > 1 ? (TAU - hueco * tramos.length) / (total || 1) : TAU))
    ctx.beginPath(); ctx.arc(cx, cy, R, ang, ang + sweep); ctx.lineWidth = 8; ctx.strokeStyle = t.color; ctx.stroke()
    fin = ang + sweep
    ang += sweep + hueco
  })
  ctx.save(); ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 14
  ctx.beginPath(); ctx.arc(cx + Math.cos(fin) * R, cy + Math.sin(fin) * R, 5.5, 0, TAU); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.restore()
}

/** Sticker rectangular del plato: cuatro anillos (kcal repartidas + proteína, carbos y grasa). Sin nombre. */
export async function dibujarTarjetaPlato(d: DatosPlato): Promise<Blob> {
  const W = 720
  const H = 296
  const { canvas, ctx, sans, mono } = await prepararCanvas(W, H)
  const kp = Math.max(d.p, 0) * 4, kc = Math.max(d.c, 0) * 4, kg = Math.max(d.g, 0) * 9
  const totalK = kp + kc + kg || 1
  const PROT = '#FFFFFF', CARB = '#979BA5', GRASA = '#5C5E67'
  const R = 46
  const cy = 112
  const colW = (W - 88) / 4
  const cols: Array<{ valor: string; sub: string; etiqueta: string; tramos: Array<{ frac: number; color: string }> }> = [
    { valor: String(Math.round(d.kcal)), sub: '', etiqueta: 'KCAL', tramos: [{ frac: kp, color: PROT }, { frac: kc, color: CARB }, { frac: kg, color: GRASA }] },
    { valor: String(Math.round(d.p)), sub: 'g', etiqueta: 'PROTEÍNA', tramos: [{ frac: kp / totalK, color: PROT }] },
    { valor: String(Math.round(d.c)), sub: 'g', etiqueta: 'CARBOS', tramos: [{ frac: kc / totalK, color: CARB }] },
    { valor: String(Math.round(d.g)), sub: 'g', etiqueta: 'GRASA', tramos: [{ frac: kg / totalK, color: GRASA }] },
  ]
  cols.forEach((c, i) => {
    const cx = 44 + colW * i + colW / 2
    anilloLimpio(ctx, cx, cy, R, c.tramos)
    ctx.textAlign = 'center'
    ctx.font = `300 ${i === 0 ? 38 : 36}px ${sans}`
    ctx.fillStyle = INK
    ctx.fillText(c.valor, cx, cy + 13)
    ctx.textAlign = 'center'
    ctx.font = `600 14px ${mono}`
    ctx.fillStyle = MUTED
    ctx.fillText(c.etiqueta, cx, cy + R + 36)
    if (i > 0) { ctx.fillStyle = METAL; ctx.fillText(`${Math.round(c.tramos[0].frac * 100)}%`, cx, cy + R + 58) }
  })
  firma(ctx, W, H - 34, mono)
  return aBlob(canvas)
}
