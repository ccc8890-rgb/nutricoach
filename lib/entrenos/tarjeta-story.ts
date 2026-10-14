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

function partir(ctx: CanvasRenderingContext2D, texto: string, ancho: number, maxLineas: number): string[] {
  const lineas: string[] = []
  let actual = ''
  for (const p of texto.split(/\s+/)) {
    const prueba = actual ? `${actual} ${p}` : p
    if (ctx.measureText(prueba).width > ancho && actual) { lineas.push(actual); actual = p } else actual = prueba
  }
  if (actual) lineas.push(actual)
  if (lineas.length > maxLineas) {
    const t = lineas.slice(0, maxLineas)
    t[maxLineas - 1] = t[maxLineas - 1].replace(/\s*\S*$/, '…')
    return t
  }
  return lineas
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
  ctx.roundRect(2, 2, w - 4, h - 4, 40)
  ctx.fillStyle = 'rgba(7,7,8,0.74)'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(201,204,211,0.38)'
  ctx.stroke()
  return { canvas, ctx, sans, mono }
}

const aBlob = (c: HTMLCanvasElement) => new Promise<Blob>((ok, ko) => c.toBlob(b => (b ? ok(b) : ko(new Error('canvas'))), 'image/png'))

/** Sticker de la sesión: solo «4×500» grande y el nombre pequeño debajo. Fondo transparente fuera del panel. */
export async function dibujarTarjeta(d: DatosTarjeta): Promise<Blob> {
  const filas = d.ejercicios.slice(0, 6)
  const W = 720
  const P = 54
  const rowH = 132
  const H = P * 2 + rowH * filas.length - 14
  const { canvas, ctx, sans, mono } = await prepararCanvas(W, H)
  filas.forEach((e, i) => {
    const y = P + rowH * i
    const [grande, unidad] = partesSeries(e)
    const base = y + 74
    ctx.fillStyle = METAL
    ctx.fillRect(P, y + 10, 5, 76)
    ctx.textAlign = 'left'
    ctx.font = `300 88px ${sans}`
    let x = P + 30
    for (const ch of grande) {
      ctx.fillStyle = ch === '×' ? METAL : INK
      ctx.fillText(ch, x, base)
      x += ctx.measureText(ch).width
    }
    if (unidad) { ctx.font = `600 26px ${mono}`; ctx.fillStyle = METAL; ctx.fillText(unidad, x + 10, base) }
    ctx.font = `600 21px ${mono}`
    ctx.fillStyle = MUTED
    ctx.fillText(recortar(ctx, [e.nombre, e.peso].filter(Boolean).join('  ·  ').toUpperCase(), W - P * 2 - 30), P + 30, base + 34)
  })
  return aBlob(canvas)
}

export interface DatosPlato { nombre: string; kcal: number; p: number; c: number; g: number; detalle?: string | null }

/** Sticker del plato: nombre, kcal por ración y macros. Sin foto: se pone encima de la del usuario. */
export async function dibujarTarjetaPlato(d: DatosPlato): Promise<Blob> {
  const W = 720
  const P = 54
  const medir = document.createElement('canvas').getContext('2d')!
  medir.font = '700 40px system-ui, sans-serif'
  const nLineas = Math.min(2, partir(medir, d.nombre, W - P * 2, 2).length)
  const H = P + 30 + nLineas * 48 + 4 + 112 + 36 + 130 + P - 20
  const { canvas, ctx, sans, mono } = await prepararCanvas(W, H)
  ctx.textAlign = 'left'
  ctx.font = `700 40px ${sans}`
  const nombre = partir(ctx, d.nombre, W - P * 2, 2)
  let y = P + 30
  ctx.fillStyle = INK
  for (const l of nombre) { ctx.fillText(l, P, y); y += 48 }
  y += 4
  ctx.font = `600 20px ${mono}`
  ctx.fillStyle = MUTED
  ctx.fillText(`POR RACIÓN${d.detalle ? '  ·  ' + d.detalle.toUpperCase() : ''}`, P, y)
  y += 112
  const kcal = String(Math.round(d.kcal))
  ctx.font = `200 120px ${sans}`
  ctx.fillStyle = INK
  ctx.fillText(kcal, P, y)
  const wK = ctx.measureText(kcal).width
  ctx.font = `600 26px ${mono}`
  ctx.fillStyle = METAL
  ctx.fillText('KCAL', P + wK + 14, y)
  y += 36
  ctx.fillStyle = 'rgba(201,204,211,0.38)'
  ctx.fillRect(P, y, W - P * 2, 2)
  const col = (W - P * 2) / 3
  const macros: Array<[number, string]> = [[d.p, 'PROTEÍNA'], [d.c, 'CARBOS'], [d.g, 'GRASA']]
  macros.forEach(([v, r], i) => {
    const x = P + col * i
    const t = String(Math.round(v))
    ctx.font = `300 64px ${sans}`
    ctx.fillStyle = INK
    ctx.fillText(t, x, y + 78)
    const wv = ctx.measureText(t).width
    ctx.font = `600 22px ${mono}`
    ctx.fillStyle = METAL
    ctx.fillText('g', x + wv + 6, y + 78)
    ctx.fillStyle = MUTED
    ctx.font = `600 18px ${mono}`
    ctx.fillText(r, x, y + 112)
  })
  return aBlob(canvas)
}
