// lib/entrenos/tarjeta-story.ts
// Tarjeta vertical (1080×1920) con el resumen de una sesión para compartir en Instagram Stories.
// Se dibuja en un canvas (sin dependencias) y sale como PNG.
import { normalizarBloqueSesion } from '@/lib/training/session-blocks'
import { textoKm } from '@/lib/entrenos/km-sesion'

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
const MAX_FILAS = 5

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

function textoSeries(e: DatosTarjeta['ejercicios'][number]): string {
  const sr = e.series && e.series > 1 && e.repeticiones ? `${e.series}×${e.repeticiones}` : (e.repeticiones ?? '')
  return [sr, e.peso].filter(Boolean).join(' · ')
}

function partir(ctx: CanvasRenderingContext2D, texto: string, ancho: number, maxLineas: number): string[] {
  const palabras = texto.split(/\s+/)
  const lineas: string[] = []
  let actual = ''
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p
    if (ctx.measureText(prueba).width > ancho && actual) { lineas.push(actual); actual = p } else actual = prueba
  }
  if (actual) lineas.push(actual)
  if (lineas.length > maxLineas) {
    const resto = lineas.slice(0, maxLineas)
    resto[maxLineas - 1] = resto[maxLineas - 1].replace(/\s*\S*$/, '…')
    return resto
  }
  return lineas
}

function recortar(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string {
  if (ctx.measureText(texto).width <= ancho) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

export async function dibujarTarjeta(d: DatosTarjeta): Promise<Blob> {
  const W = 1080
  const H = 1920
  const M = 96
  const css = getComputedStyle(document.documentElement)
  const sans = css.getPropertyValue('--font-instrument').trim() || 'system-ui, sans-serif'
  const mono = css.getPropertyValue('--font-geist-mono').trim() || 'ui-monospace, monospace'
  try {
    await Promise.all([
      document.fonts.load(`700 80px ${sans}`),
      document.fonts.load(`600 30px ${mono}`),
    ])
  } catch { /* se dibuja con la fuente de respaldo */ }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const INK = '#E9E9EC'
  const MUTED = '#8C8C95'
  const RULE = '#2B2B31'
  const METAL = '#C9CCD3'

  // Fondo: carbón con un halo suave arriba
  ctx.fillStyle = '#070708'
  ctx.fillRect(0, 0, W, H)
  const halo = ctx.createRadialGradient(W * 0.8, 260, 0, W * 0.8, 260, 900)
  halo.addColorStop(0, 'rgba(201,204,211,0.10)')
  halo.addColorStop(1, 'rgba(201,204,211,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, W, H)

  ctx.textBaseline = 'alphabetic'
  const linea = (y: number, color = RULE) => { ctx.fillStyle = color; ctx.fillRect(M, y, W - M * 2, 2) }

  // Cabecera (por debajo de la zona que tapa la interfaz de Stories)
  let y = 240
  ctx.font = `600 30px ${mono}`
  ctx.fillStyle = MUTED
  ctx.textAlign = 'left'
  ctx.fillText(etiquetaFecha(d.fecha), M, y)
  if (d.semana) { ctx.textAlign = 'right'; ctx.fillText(d.semana, W - M, y); ctx.textAlign = 'left' }
  y += 36
  linea(y, METAL)

  // Tipo + título
  y += 110
  ctx.font = `600 30px ${mono}`
  ctx.fillStyle = METAL
  ctx.fillText(d.tipo.toUpperCase(), M, y)
  y += 40
  ctx.font = `700 104px ${sans}`
  ctx.fillStyle = INK
  const titulo = partir(ctx, d.titulo, W - M * 2, 3)
  for (const l of titulo) { y += 112; ctx.fillText(l, M, y) }

  // Cifras
  const cifras: Array<[string, string]> = []
  if (d.duracionMin) cifras.push([`${d.duracionMin}'`, 'DURACIÓN'])
  const km = textoKm(d.km)
  if (km) cifras.push([km.replace(' km', ''), 'KM'])
  const totalSeries = d.ejercicios.reduce((a, e) => a + (e.series ?? 0), 0)
  if (!km && totalSeries) cifras.push([String(totalSeries), 'SERIES'])
  cifras.push([String(d.ejercicios.length), 'EJERCICIOS'])
  y += 90
  linea(y)
  const colW = (W - M * 2) / cifras.length
  cifras.forEach(([valor, rotulo], i) => {
    const x = M + colW * i
    ctx.font = `600 96px ${mono}`
    ctx.fillStyle = INK
    ctx.fillText(valor, x, y + 130)
    ctx.font = `600 26px ${mono}`
    ctx.fillStyle = MUTED
    ctx.fillText(rotulo, x, y + 176)
  })
  y += 230
  linea(y)

  // Lista de ejercicios
  const filas = d.ejercicios.slice(0, MAX_FILAS)
  const resto = d.ejercicios.length - filas.length
  const rowH = 98
  filas.forEach((e, i) => {
    const base = y + rowH * i + 66
    ctx.font = `600 26px ${mono}`
    ctx.fillStyle = MUTED
    ctx.textAlign = 'left'
    ctx.fillText(String(i + 1).padStart(2, '0'), M, base)
    const der = textoSeries(e)
    ctx.font = `600 32px ${mono}`
    const anchoDer = der ? ctx.measureText(der).width : 0
    ctx.fillStyle = METAL
    ctx.textAlign = 'right'
    if (der) ctx.fillText(der, W - M, base)
    ctx.textAlign = 'left'
    ctx.font = `600 40px ${sans}`
    ctx.fillStyle = INK
    ctx.fillText(recortar(ctx, e.nombre, W - M * 2 - 90 - anchoDer - 24), M + 90, base)
    linea(y + rowH * (i + 1))
  })
  if (resto > 0) {
    ctx.font = `600 28px ${mono}`
    ctx.fillStyle = MUTED
    ctx.fillText(`+ ${resto} MÁS`, M + 90, y + rowH * filas.length + 60)
  }

  // Firma (por encima de la zona de respuesta de Stories)
  ctx.font = `600 28px ${mono}`
  ctx.fillStyle = MUTED
  ctx.textAlign = 'left'
  ctx.fillText('CASANOVA NUTRITION', M, H - 250)

  return new Promise((ok, ko) => canvas.toBlob(b => (b ? ok(b) : ko(new Error('canvas'))), 'image/png'))
}
