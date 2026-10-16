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

const ESCALA_PNG = 3

async function prepararCanvas(w: number, h: number) {
  const css = getComputedStyle(document.documentElement)
  const sans = css.getPropertyValue('--font-instrument').trim() || 'system-ui, sans-serif'
  const mono = css.getPropertyValue('--font-geist-mono').trim() || 'ui-monospace, monospace'
  try {
    await Promise.all([document.fonts.load(`300 80px ${sans}`), document.fonts.load(`700 40px ${sans}`), document.fonts.load(`600 30px ${mono}`)])
  } catch { /* fuente de respaldo */ }
  // Se dibuja a 3× para que no pierda definición cuando Instagram la reescala y comprime
  const canvas = document.createElement('canvas')
  canvas.width = w * ESCALA_PNG
  canvas.height = h * ESCALA_PNG
  const ctx = canvas.getContext('2d')!
  ctx.scale(ESCALA_PNG, ESCALA_PNG)
  // Panel opaco y rectangular (sin transparencia: Instagram rellena de negro lo transparente)
  ctx.fillStyle = '#0B0B0C'
  ctx.fillRect(0, 0, w, h)
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(201,204,211,0.38)'
  ctx.strokeRect(1, 1, w - 2, h - 2)
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

export type VarianteMarca = '1' | '3' | 'h'
let varianteMarca: VarianteMarca = '3'
/** Para probar variantes del símbolo de la firma. */
export function usarVarianteMarca(v: VarianteMarca) { varianteMarca = v }

/** Símbolo: triángulo (proteína · carbos · grasa) con un punto luminoso que marca el equilibrio. */
function marcaTriangulo(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, v: VarianteMarca) {
  const TAU = Math.PI * 2
  const vert = [0, 1, 2].map(i => ({ x: cx + Math.sin((i * TAU) / 3) * r, y: cy - Math.cos((i * TAU) / 3) * r + r * 0.12 }))
  const F = [0.36, 0.34, 0.3]
  const px = vert.reduce((a, q, i) => a + q.x * F[i], 0), py = vert.reduce((a, q, i) => a + q.y * F[i], 0)
  const tonos = ['#FFFFFF', '#979BA5', '#5C5E67']
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  if (v === '1') {
    ctx.beginPath(); vert.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath()
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#C9CCD3'; ctx.stroke()
  }
  if (v === '1' || v === 'h') {
    const m = vert.map((q, i) => ({ x: (q.x + vert[(i + 1) % 3].x) / 2, y: (q.y + vert[(i + 1) % 3].y) / 2 }))
    ctx.beginPath(); m.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath()
    ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(201,204,211,0.35)'; ctx.stroke()
  }
  if (v === '3' || v === 'h') {
    for (let i = 0; i < 3; i++) {
      const a = vert[i], b = vert[(i + 1) % 3]
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, g = r * 0.2
      ctx.beginPath(); ctx.moveTo(a.x + ux * g, a.y + uy * g); ctx.lineTo(b.x - ux * g, b.y - uy * g)
      ctx.lineWidth = 2; ctx.strokeStyle = tonos[i]; ctx.stroke()
    }
  }
  ctx.save(); ctx.shadowColor = 'rgba(255,255,255,0.95)'; ctx.shadowBlur = 8
  ctx.beginPath(); ctx.arc(px, py, 2.8, 0, TAU); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.restore()
}

/** Firma: solo el símbolo del triángulo, centrado (sin nombre mientras no esté decidido). */
function firma(ctx: CanvasRenderingContext2D, w: number, y: number, _mono: string) {
  void _mono
  marcaTriangulo(ctx, w / 2, y - 1, 15, varianteMarca)
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

// ── Variantes no circulares del plato (a elegir) ─────────────────────────────
const C_PROT = '#FFFFFF'
const C_CARB = '#979BA5'
const C_GRASA = '#5C5E67'

function repartoPlato(d: DatosPlato) {
  const kp = Math.max(d.p, 0) * 4, kc = Math.max(d.c, 0) * 4, kg = Math.max(d.g, 0) * 9
  const t = kp + kc + kg || 1
  return { fp: kp / t, fc: kc / t, fg: kg / t, pp: Math.round((kp / t) * 100), pc: Math.round((kc / t) * 100), pg: Math.round((kg / t) * 100) }
}

/** V1 «Regla»: una barra proporcional con escala de medición y el ratio escrito P : C : G. */
export async function dibujarPlatoRegla(d: DatosPlato): Promise<Blob> {
  const W = 720, H = 300, P = 48
  const { canvas, ctx, sans, mono } = await prepararCanvas(W, H)
  const r = repartoPlato(d)
  ctx.textAlign = 'left'
  ctx.font = `200 72px ${sans}`; ctx.fillStyle = INK
  const k = String(Math.round(d.kcal)); ctx.fillText(k, P, 112)
  const wk = ctx.measureText(k).width
  ctx.font = `600 15px ${mono}`; ctx.fillStyle = MUTED; ctx.fillText('KCAL', P + wk + 8, 112)
  ctx.textAlign = 'right'
  ctx.font = `600 30px ${mono}`; ctx.fillStyle = INK; ctx.fillText(`${r.pp} : ${r.pc} : ${r.pg}`, W - P, 94)
  ctx.font = `600 13px ${mono}`; ctx.fillStyle = MUTED; ctx.fillText('PROT : CARB : GRASA', W - P, 116)
  // barra
  const bw = W - P * 2, by = 150, bh = 16, gap = 5
  const anchos = [r.fp, r.fc, r.fg].map(f => f * (bw - gap * 2))
  let x = P
  ;[C_PROT, C_CARB, C_GRASA].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x, by, anchos[i], bh); x += anchos[i] + gap })
  // escala: marca cada 2 %, más larga cada 10 %
  for (let i = 0; i <= 50; i++) {
    const tx = P + (bw * i) / 50
    ctx.fillStyle = i % 5 === 0 ? 'rgba(201,204,211,0.6)' : 'rgba(201,204,211,0.25)'
    ctx.fillRect(tx - 0.75, by + bh + 8, 1.5, i % 5 === 0 ? 12 : 6)
  }
  // etiquetas al inicio de cada tramo
  x = P
  ctx.textAlign = 'left'
  ;[[d.p, 'PROT', C_PROT], [d.c, 'CARB', C_CARB], [d.g, 'GRASA', C_GRASA]].forEach(([g, l, c], i) => {
    ctx.font = `300 28px ${sans}`; ctx.fillStyle = INK; ctx.fillText(`${Math.round(g as number)}`, x, by + bh + 58)
    const wn = ctx.measureText(`${Math.round(g as number)}`).width
    ctx.font = `600 13px ${mono}`; ctx.fillStyle = c as string; ctx.fillText(`g ${l}`, x + wn + 6, by + bh + 58)
    x += anchos[i] + gap
  })
  firma(ctx, W, H - 28, mono)
  return aBlob(canvas)
}

/** V2 «Ternario»: un punto en un triángulo (proteína · carbos · grasa); su posición ES el ratio del plato. */
export async function dibujarPlatoTernario(d: DatosPlato): Promise<Blob> {
  const W = 720, H = 300
  const { canvas, ctx, sans, mono } = await prepararCanvas(W, H)
  const r = repartoPlato(d)
  const side = 200, hgt = side * Math.sqrt(3) / 2
  const cx = W - 150, top = 52
  const vp = { x: cx, y: top }, vc = { x: cx - side / 2, y: top + hgt }, vg = { x: cx + side / 2, y: top + hgt }
  // rejilla al 25 / 50 / 75 %
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(201,204,211,0.16)'
  for (const f of [0.25, 0.5, 0.75]) {
    const lerp = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })
    for (const [a, b, c] of [[vp, vc, vg], [vc, vg, vp], [vg, vp, vc]] as const) {
      const p1 = lerp(a, b), p2 = lerp(a, c)
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke()
    }
  }
  ctx.beginPath(); ctx.moveTo(vp.x, vp.y); ctx.lineTo(vc.x, vc.y); ctx.lineTo(vg.x, vg.y); ctx.closePath()
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(201,204,211,0.5)'; ctx.stroke()
  const px = vp.x * r.fp + vc.x * r.fc + vg.x * r.fg
  const py = vp.y * r.fp + vc.y * r.fc + vg.y * r.fg
  ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  for (const v of [vp, vc, vg]) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(v.x, v.y); ctx.stroke() }
  ctx.setLineDash([])
  ctx.save(); ctx.shadowColor = 'rgba(255,255,255,0.95)'; ctx.shadowBlur = 20
  ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fillStyle = '#FFF'; ctx.fill(); ctx.restore()
  ctx.font = `600 14px ${mono}`; ctx.fillStyle = MUTED; ctx.textAlign = 'center'
  ctx.fillText('P', vp.x, vp.y - 10); ctx.fillText('C', vc.x - 14, vc.y + 5); ctx.fillText('G', vg.x + 14, vg.y + 5)
  // lectura a la izquierda
  ctx.textAlign = 'left'
  ctx.font = `200 84px ${sans}`; ctx.fillStyle = INK
  const k = String(Math.round(d.kcal)); ctx.fillText(k, 48, 118)
  ctx.font = `600 15px ${mono}`; ctx.fillStyle = MUTED; ctx.fillText('KCAL', 48, 146)
  ;[[d.p, 'PROT', r.pp, C_PROT], [d.c, 'CARB', r.pc, C_CARB], [d.g, 'GRASA', r.pg, C_GRASA]].forEach(([g, l, pc, c], i) => {
    const y = 188 + i * 26
    ctx.fillStyle = c as string; ctx.fillRect(48, y - 12, 10, 10)
    ctx.font = `300 22px ${sans}`; ctx.fillStyle = INK; ctx.fillText(`${Math.round(g as number)} g`, 70, y)
    ctx.font = `600 13px ${mono}`; ctx.fillStyle = MUTED; ctx.fillText(`${l}  ${pc}%`, 146, y)
  })
  ctx.textAlign = 'left'
  firma(ctx, W, H - 30, mono)
  return aBlob(canvas)
}

/** V3 «Medidor»: tres columnas de 20 segmentos (5 % cada uno), encendidas según el reparto de kcal. */
export async function dibujarPlatoMedidor(d: DatosPlato): Promise<Blob> {
  const W = 720, H = 300
  const { canvas, ctx, sans, mono } = await prepararCanvas(W, H)
  const r = repartoPlato(d)
  ctx.textAlign = 'left'
  ctx.font = `200 84px ${sans}`; ctx.fillStyle = INK
  ctx.fillText(String(Math.round(d.kcal)), 48, 122)
  ctx.font = `600 15px ${mono}`; ctx.fillStyle = MUTED; ctx.fillText('KCAL POR RACIÓN', 48, 152)
  firma(ctx, 330, H - 34, mono)
  const cols: Array<[number, number, string, string]> = [[r.pp, d.p, 'PROT', C_PROT], [r.pc, d.c, 'CARB', C_CARB], [r.pg, d.g, 'GRASA', C_GRASA]]
  const x0 = 380, colW = 100, seg = 20, sh = 6, sg = 3
  cols.forEach(([pc, g, l, c], i) => {
    const x = x0 + i * colW
    const enc = Math.max(1, Math.round(pc / 5))
    for (let s = 0; s < seg; s++) {
      const y = 44 + (seg - 1 - s) * (sh + sg)
      ctx.fillStyle = s < enc ? c : 'rgba(201,204,211,0.12)'
      ctx.fillRect(x, y, 56, sh)
    }
    ctx.textAlign = 'left'
    ctx.font = `300 26px ${sans}`; ctx.fillStyle = INK; ctx.fillText(`${Math.round(g)}`, x, 44 + seg * (sh + sg) + 26)
    ctx.font = `600 12px ${mono}`; ctx.fillStyle = MUTED; ctx.fillText(`${l} ${pc}%`, x, 44 + seg * (sh + sg) + 44)
  })
  return aBlob(canvas)
}
