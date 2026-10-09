'use client'
import { useMemo, useRef, useState } from 'react'

export type Fila = { fecha: string } & Record<string, number | string | null | undefined>

export interface SerieGrafica {
  key: string
  label: string
  color: string
  tipo?: 'linea' | 'barras' | 'area'
  /** Línea discontinua. */
  discontinua?: boolean
}

interface Props {
  datos: Fila[]
  series: SerieGrafica[]
  alto?: number
  formato?: (v: number, key: string) => string
  /** Banda sombreada (p. ej. rango normal de HRV). */
  banda?: { min: number; max: number } | null
  /** Línea horizontal de referencia (p. ej. 0 en frescura). */
  referencia?: number
  /** Zonas de fondo [desde, hasta, color]. */
  zonas?: { desde: number; hasta: number; color: string }[]
}

const W = 600
const PAD = { l: 38, r: 8, t: 8, b: 20 }

const dia = (f: string) => Math.round(new Date(`${f}T12:00:00Z`).getTime() / 86_400_000)
const etiqueta = (f: string) => {
  const d = new Date(`${f}T12:00:00Z`)
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
}

export default function Grafica({ datos, series, alto = 170, formato, banda, referencia, zonas }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const fmt = formato ?? ((v: number) => String(Math.round(v * 10) / 10))

  const g = useMemo(() => {
    const filas = datos.filter(d => d.fecha)
    if (filas.length < 2) return null
    const x0 = dia(filas[0].fecha)
    const x1 = dia(filas[filas.length - 1].fecha)
    const span = Math.max(x1 - x0, 1)
    const vals: number[] = []
    for (const f of filas) for (const s of series) {
      const v = f[s.key]
      if (typeof v === 'number' && Number.isFinite(v)) vals.push(v)
    }
    if (banda) vals.push(banda.min, banda.max)
    if (referencia !== undefined) vals.push(referencia)
    if (zonas) for (const z of zonas) { vals.push(z.desde) ; vals.push(z.hasta) }
    if (!vals.length) return null
    // Con zonas de fondo no se fuerza el rango a sus extremos "infinitos".
    const finitos = vals.filter(v => Math.abs(v) < 1e6)
    let min = Math.min(...finitos)
    let max = Math.max(...finitos)
    if (series.some(s => s.tipo === 'barras')) min = Math.min(min, 0)
    if (max === min) { max += 1; min -= 1 }
    const holgura = (max - min) * 0.08
    max += holgura
    if (min !== 0 || !series.some(s => s.tipo === 'barras')) min -= holgura
    const cw = W - PAD.l - PAD.r
    const ch = alto - PAD.t - PAD.b
    const X = (f: string) => PAD.l + ((dia(f) - x0) / span) * cw
    const Y = (v: number) => PAD.t + ch - ((v - min) / (max - min)) * ch
    return { filas, X, Y, min, max, cw, ch, ancho: Math.max(2, (cw / span) * 0.7) }
  }, [datos, series, alto, banda, referencia, zonas])

  if (!g) return <p className="py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Sin datos suficientes todavía</p>

  const ticks = [g.min + (g.max - g.min) * 0.1, (g.min + g.max) / 2, g.max - (g.max - g.min) * 0.1]
  const activo = hover ?? g.filas.length - 1
  const filaActiva = g.filas[activo]

  const mover = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX
    const px = ((cx - r.left) / r.width) * W
    let mejor = 0
    let dist = Infinity
    g.filas.forEach((f, i) => { const d = Math.abs(g.X(f.fecha) - px); if (d < dist) { dist = d; mejor = i } })
    setHover(mejor)
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span style={{ color: 'var(--text-muted)' }}>{etiqueta(filaActiva.fecha)}</span>
        {series.map(s => {
          const v = filaActiva[s.key]
          return (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
              <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                {typeof v === 'number' ? fmt(v, s.key) : '—'}
              </span>
            </span>
          )
        })}
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${alto}`}
        className="w-full touch-pan-y select-none"
        role="img"
        onMouseMove={mover}
        onMouseLeave={() => setHover(null)}
        onTouchMove={mover}
        onTouchEnd={() => setHover(null)}
      >
        {zonas?.map((z, i) => {
          const y1 = g.Y(Math.min(z.hasta, g.max))
          const y2 = g.Y(Math.max(z.desde, g.min))
          return <rect key={i} x={PAD.l} y={y1} width={g.cw} height={Math.max(0, y2 - y1)} fill={z.color} opacity={0.1} />
        })}
        {banda && (
          <rect x={PAD.l} y={g.Y(banda.max)} width={g.cw} height={Math.max(0, g.Y(banda.min) - g.Y(banda.max))} fill="var(--text-muted)" opacity={0.14} />
        )}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={g.Y(t)} y2={g.Y(t)} stroke="var(--border-light)" strokeWidth={1} />
            <text x={PAD.l - 5} y={g.Y(t) + 3} textAnchor="end" fontSize={9} fill="var(--text-muted)">{fmt(t, '')}</text>
          </g>
        ))}
        {referencia !== undefined && (
          <line x1={PAD.l} x2={W - PAD.r} y1={g.Y(referencia)} y2={g.Y(referencia)} stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="3 3" />
        )}
        {series.filter(s => s.tipo === 'barras').map(s => g.filas.map(f => {
          const v = f[s.key]
          if (typeof v !== 'number' || v === 0) return null
          const y = g.Y(v)
          const y0 = g.Y(Math.max(g.min, 0))
          return <rect key={s.key + f.fecha} x={g.X(f.fecha) - g.ancho / 2} y={Math.min(y, y0)} width={g.ancho} height={Math.abs(y0 - y)} fill={s.color} opacity={0.5} rx={1} />
        }))}
        {series.filter(s => s.tipo !== 'barras').map(s => {
          const pts = g.filas.filter(f => typeof f[s.key] === 'number').map(f => [g.X(f.fecha), g.Y(f[s.key] as number)] as const)
          if (pts.length < 1) return null
          const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
          return (
            <g key={s.key}>
              {s.tipo === 'area' && pts.length > 1 && (
                <path d={`${d} L${pts[pts.length - 1][0].toFixed(1)},${g.Y(Math.max(g.min, 0))} L${pts[0][0].toFixed(1)},${g.Y(Math.max(g.min, 0))} Z`} fill={s.color} opacity={0.18} />
              )}
              <path d={d} fill="none" stroke={s.color} strokeWidth={1.8} strokeLinejoin="round" strokeDasharray={s.discontinua ? '4 3' : undefined} />
              {pts.length <= 40 && pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.2} fill={s.color} />)}
            </g>
          )
        })}
        {hover !== null && (
          <line x1={g.X(filaActiva.fecha)} x2={g.X(filaActiva.fecha)} y1={PAD.t} y2={alto - PAD.b} stroke="var(--text-muted)" strokeWidth={1} opacity={0.6} />
        )}
        <text x={PAD.l} y={alto - 5} fontSize={9} fill="var(--text-muted)">{etiqueta(g.filas[0].fecha)}</text>
        <text x={W - PAD.r} y={alto - 5} fontSize={9} textAnchor="end" fill="var(--text-muted)">{etiqueta(g.filas[g.filas.length - 1].fecha)}</text>
      </svg>
    </div>
  )
}
