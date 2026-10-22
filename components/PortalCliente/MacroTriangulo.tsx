'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { repartoKcal } from '@/lib/nutricion/reparto-macros'

interface Props {
  kcal: number
  p: number
  c: number
  g: number
  mostrarKcal?: boolean
  /** Sin borde ni fondo propios (cuando ya va dentro de otra tarjeta). */
  sinMarco?: boolean
}

const SORA = 'var(--font-sora), var(--font-instrument), sans-serif'
const DURACION_MS = 2600
const clamp = (x: number) => Math.min(Math.max(x, 0), 1)
const suave = (x: number) => 1 - Math.pow(1 - clamp(x), 3) // salida suave
const muySuave = (x: number) => 1 - Math.pow(1 - clamp(x), 4)

/**
 * Reparto de calorías de una receta en un diagrama ternario: el punto cae donde coinciden proteína, carbos y grasa.
 * La animación de entrada arranca al llegar a la tarjeta al hacer scroll (no al montar la página).
 */
export default function MacroTriangulo({ kcal, p, c, g, mostrarKcal = true, sinMarco = false }: Props) {
  const { f, pct, dom } = repartoKcal(p, c, g)
  const uid = useId().replace(/:/g, '')

  // Entrada: arranca cuando la tarjeta se ve (≥ 45 %) y solo una vez
  const [t, setT] = useState(0)
  const [llegado, setLlegado] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = raiz.current
    if (typeof window === 'undefined' || !el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') { setT(1); setLlegado(true); return }
    let raf = 0
    const arrancar = () => {
      const ini = performance.now() + 120
      const paso = (ahora: number) => {
        const x = clamp((ahora - ini) / DURACION_MS)
        setT(x)
        if (x < 1) raf = requestAnimationFrame(paso)
        else setLlegado(true)
      }
      raf = requestAnimationFrame(paso)
    }
    const obs = new IntersectionObserver(entradas => {
      if (entradas.some(e => e.isIntersecting)) { obs.disconnect(); arrancar() }
    }, { threshold: 0.45 })
    obs.observe(el)
    return () => { obs.disconnect(); cancelAnimationFrame(raf) }
  }, [])

  // Fases (todas dentro de la misma línea de tiempo 0 → 1)
  const rejillaOp = 0.45 + 0.55 * suave(t / 0.2) // el triángulo ya está ahí antes de llegar; lo que se anima es el reparto
  const viaje = muySuave((t - 0.08) / 0.55)          // el punto viaja desde el centro hasta su sitio
  const crece = muySuave((t - 0.55) / 0.35)          // la línea del macro predominante crece desde el punto hacia su vértice
  const lineas = suave((t - 0.75) / 0.25)            // las otras dos aparecen al final, tenues
  const cuentas = suave((t - 0.05) / 0.75)

  const side = 170
  const h = (side * Math.sqrt(3)) / 2
  const ox = 20, oy = 22
  const V = [
    { x: ox + side / 2, y: oy },          // P
    { x: ox, y: oy + h },                  // C
    { x: ox + side, y: oy + h },           // G
  ]
  const destino = { x: V.reduce((a, v, i) => a + v.x * f[i], 0), y: V.reduce((a, v, i) => a + v.y * f[i], 0) }
  const centro = { x: (V[0].x + V[1].x + V[2].x) / 3, y: (V[0].y + V[1].y + V[2].y) / 3 }
  const punto = { x: centro.x + (destino.x - centro.x) * viaje, y: centro.y + (destino.y - centro.y) * viaje }
  const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, k: number) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })
  const rejilla: Array<[{ x: number; y: number }, { x: number; y: number }]> = []
  for (const k of [0.25, 0.5, 0.75]) {
    for (const [a, b, d] of [[V[0], V[1], V[2]], [V[1], V[2], V[0]], [V[2], V[0], V[1]]] as const) rejilla.push([lerp(a, b, k), lerp(a, d, k)])
  }
  const filas = [
    { l: 'Proteína', v: 'P', g: p, pc: pct[0] },
    { l: 'Carbos', v: 'C', g: c, pc: pct[1] },
    { l: 'Grasas', v: 'G', g: g, pc: pct[2] },
  ]

  return (
    <div ref={raiz} className={`flex items-center justify-between gap-3 ${sinMarco ? '' : 'rounded-[6px] p-4'}`} style={sinMarco ? undefined : { border: '1px solid var(--editorial-rule, var(--border))', background: 'var(--surface)' }}>
      <div className="min-w-0">
        {mostrarKcal && (
          <p className="text-5xl leading-none" style={{ color: 'var(--text)', fontFamily: SORA, fontWeight: 200, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(kcal * cuentas)} <span className="font-data text-xs font-semibold tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>KCAL</span>
          </p>
        )}
        <div className={mostrarKcal ? 'mt-5 flex flex-col gap-2' : 'flex flex-col gap-2'}>
          {filas.map((r, i) => (
            <p key={r.l} className="flex items-baseline gap-2.5 whitespace-nowrap" style={{ color: 'var(--text)' }}>
              <span className="w-[3.1rem] text-[1.55rem] leading-none" style={{ fontFamily: SORA, fontWeight: 300, fontVariantNumeric: 'tabular-nums' }}>{Math.round(r.pc * cuentas)}%</span>
              {/* La letra enlaza cada fila con su vértice del triángulo; el macro predominante se enciende */}
              <span className="font-data w-4 shrink-0 text-xs font-bold" style={{ color: i === dom ? 'var(--text)' : 'var(--text-muted)' }}>{r.v}</span>
              <span className="font-data text-xs font-medium tracking-[0.14em]" style={{ color: i === dom ? 'var(--text)' : 'var(--text-muted)' }}>{r.l.toUpperCase()}</span>
              <span className="font-data text-xs" style={{ color: 'var(--text-muted)', opacity: 0.85, fontVariantNumeric: 'tabular-nums' }}>{Math.round(r.g * cuentas)} g</span>
            </p>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 210 200" style={{ width: '48%', maxWidth: 210, height: 'auto', overflow: 'visible' }} role="img" aria-label={`Reparto de calorías: ${pct[0]} % proteína, ${pct[1]} % carbos, ${pct[2]} % grasas`} className="shrink-0">
        <defs>
          {/* Halo suave alrededor del punto y velo de luz dentro del triángulo */}
          <radialGradient id={`${uid}-halo`}>
            <stop offset="0%" stopColor="var(--text)" stopOpacity="0.55" />
            <stop offset="45%" stopColor="var(--text)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--text)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}-velo`} cx={punto.x} cy={punto.y} r={side * 0.75} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--text)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="var(--text)" stopOpacity="0" />
          </radialGradient>
          <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d={`M${V[0].x} ${V[0].y} L${V[1].x} ${V[1].y} L${V[2].x} ${V[2].y} Z`} fill={`url(#${uid}-velo)`} opacity={rejillaOp} />
        {rejilla.map(([a, b], i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--text-muted)" strokeOpacity={0.22 * rejillaOp} strokeWidth="1" />)}
        <path d={`M${V[0].x} ${V[0].y} L${V[1].x} ${V[1].y} L${V[2].x} ${V[2].y} Z`} fill="none" stroke="var(--text-muted)" strokeOpacity={0.7 * rejillaOp} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {V.map((v, i) => (
          <line key={i} x1={punto.x} y1={punto.y} x2={i === dom ? punto.x + (v.x - punto.x) * crece : v.x} y2={i === dom ? punto.y + (v.y - punto.y) * crece : v.y} stroke="var(--text)"
            strokeOpacity={i === dom ? 0.5 * clamp(crece * 4) : 0.2 * lineas} strokeWidth={i === dom ? 1.6 : 1} strokeDasharray={i === dom ? undefined : '3 4'}
            filter={i === dom && crece > 0.3 ? `url(#${uid}-glow)` : undefined} />
        ))}
        {/* Halo: respira muy despacio una vez llegado; un anillo se expande al aterrizar */}
        <circle cx={punto.x} cy={punto.y} r="22" fill={`url(#${uid}-halo)`} opacity={suave((t - 0.4) / 0.4)} className={llegado ? 'macro-tri-respira' : undefined} />
        {llegado && <circle cx={punto.x} cy={punto.y} r="6" fill="none" stroke="var(--text)" strokeWidth="1" className="macro-tri-onda" />}
        <circle cx={punto.x} cy={punto.y} r="5.5" fill="var(--text)" filter={`url(#${uid}-glow)`} opacity={viaje > 0.02 ? 1 : 0} />
        {V.map((v, i) => (
          <text key={i} x={v.x + (i === 1 ? -8 : i === 2 ? 8 : 0)} y={v.y + (i === 0 ? -8 : 4)} textAnchor={i === 0 ? 'middle' : i === 1 ? 'end' : 'start'}
            className="font-data" fontSize="10" fontWeight={dom === i ? 700 : 400} fill={dom === i ? 'var(--text)' : 'var(--text-muted)'} opacity={rejillaOp}>
            {['P', 'C', 'G'][i]}
          </text>
        ))}
      </svg>
      <style>{`
        @keyframes macro-tri-respira { 0%,100% { transform: scale(1); opacity: .9 } 50% { transform: scale(1.18); opacity: 1 } }
        @keyframes macro-tri-onda { 0% { transform: scale(1); opacity: .7 } 100% { transform: scale(5); opacity: 0 } }
        .macro-tri-respira { transform-box: fill-box; transform-origin: center; animation: macro-tri-respira 5.5s ease-in-out infinite }
        .macro-tri-onda { transform-box: fill-box; transform-origin: center; animation: macro-tri-onda 2s cubic-bezier(.2,.7,.2,1) 1 both }
        @media (prefers-reduced-motion: reduce) { .macro-tri-respira, .macro-tri-onda { animation: none } }
      `}</style>
    </div>
  )
}
