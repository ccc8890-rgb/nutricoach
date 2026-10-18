'use client'

import { useEffect, useState } from 'react'

interface Props {
  kcal: number
  p: number
  c: number
  g: number
  mostrarKcal?: boolean
  /** Sin borde ni fondo propios (cuando ya va dentro de otra tarjeta). */
  sinMarco?: boolean
}

/** Reparto de calorías de una receta en un diagrama ternario: el punto cae donde coinciden proteína, carbos y grasa. */
export default function MacroTriangulo({ kcal, p, c, g, mostrarKcal = true, sinMarco = false }: Props) {
  const kp = Math.max(p, 0) * 4, kc = Math.max(c, 0) * 4, kg = Math.max(g, 0) * 9
  const total = kp + kc + kg || 1
  const f = [kp / total, kc / total, kg / total]
  const pct = f.map(x => Math.round(x * 100))
  const dom = f.indexOf(Math.max(...f))

  // Entrada animada: el contorno se dibuja y el punto viaja desde el centro hasta su posición (como los anillos)
  const [t, setT] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setT(1); return }
    let raf = 0
    const ini = performance.now() + 150, dur = 900
    const paso = (ahora: number) => {
      const x = Math.min(Math.max((ahora - ini) / dur, 0), 1)
      setT(1 - Math.pow(1 - x, 3))
      if (x < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [])

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
  const punto = { x: centro.x + (destino.x - centro.x) * t, y: centro.y + (destino.y - centro.y) * t }
  const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  const rejilla: Array<[{ x: number; y: number }, { x: number; y: number }]> = []
  for (const t of [0.25, 0.5, 0.75]) {
    for (const [a, b, d] of [[V[0], V[1], V[2]], [V[1], V[2], V[0]], [V[2], V[0], V[1]]] as const) rejilla.push([lerp(a, b, t), lerp(a, d, t)])
  }
  const filas = [
    { l: 'Proteína', g: p, pc: pct[0], color: 'var(--macro-protein)' },
    { l: 'Carbos', g: c, pc: pct[1], color: 'var(--macro-carbs)' },
    { l: 'Grasas', g: g, pc: pct[2], color: 'var(--macro-fat)' },
  ]

  return (
    <div className={`flex items-center justify-between gap-3 ${sinMarco ? '' : 'rounded-[6px] p-4'}`} style={sinMarco ? undefined : { border: '1px solid var(--editorial-rule, var(--border))', background: 'var(--surface)' }}>
      <div className="min-w-0">
        {mostrarKcal && (
          <p className="text-4xl leading-none" style={{ color: 'var(--text)', fontFamily: 'var(--font-sora), var(--font-instrument), sans-serif', fontWeight: 200 }}>
            {Math.round(kcal)} <span className="text-[10px] font-semibold tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>KCAL</span>
          </p>
        )}
        <div className={mostrarKcal ? 'mt-4 flex flex-col gap-1.5' : 'flex flex-col gap-1.5'}>
          {filas.map(r => (
            <p key={r.l} className="flex items-baseline gap-2 whitespace-nowrap text-sm" style={{ color: 'var(--text)' }}>
              <span className="inline-block h-2 w-2 shrink-0" style={{ background: r.color }} />
              <span className="font-data">{Math.round(r.g)}&nbsp;g</span>
              <span className="font-data text-[10px] tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>{r.l.toUpperCase()} {r.pc}%</span>
            </p>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 210 200" style={{ width: '48%', maxWidth: 210, height: 'auto' }} role="img" aria-label={`Reparto de calorías: ${pct[0]} % proteína, ${pct[1]} % carbos, ${pct[2]} % grasa`} className="shrink-0">
        {rejilla.map(([a, b], i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--text-muted)" strokeOpacity="0.22" strokeWidth="1" />)}
        <path d={`M${V[0].x} ${V[0].y} L${V[1].x} ${V[1].y} L${V[2].x} ${V[2].y} Z`} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} fill="none" stroke="var(--text-muted)" strokeOpacity="0.7" strokeWidth="1.5" strokeLinejoin="round" />
        {V.map((v, i) => <line key={i} x1={punto.x} y1={punto.y} x2={v.x} y2={v.y} stroke="var(--text)" strokeOpacity={(i === dom ? 0.5 : 0.2) * t} strokeWidth={i === dom ? 1.6 : 1} strokeDasharray={i === dom ? undefined : '3 4'} />)}
        <circle cx={punto.x} cy={punto.y} r="9" fill="var(--text)" opacity="0.15" />
        <circle cx={punto.x} cy={punto.y} r="5.5" fill="var(--text)" />
        <text x={V[0].x} y={V[0].y - 8} textAnchor="middle" className="font-data" fontSize="10" fontWeight={dom === 0 ? 700 : 400} fill={dom === 0 ? 'var(--text)' : 'var(--text-muted)'}>P</text>
        <text x={V[1].x - 8} y={V[1].y + 4} textAnchor="end" className="font-data" fontSize="10" fontWeight={dom === 1 ? 700 : 400} fill={dom === 1 ? 'var(--text)' : 'var(--text-muted)'}>C</text>
        <text x={V[2].x + 8} y={V[2].y + 4} textAnchor="start" className="font-data" fontSize="10" fontWeight={dom === 2 ? 700 : 400} fill={dom === 2 ? 'var(--text)' : 'var(--text-muted)'}>G</text>
      </svg>
    </div>
  )
}
