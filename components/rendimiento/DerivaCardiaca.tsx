'use client'
import { useMemo } from 'react'
import Grafica, { type Fila } from './Grafica'
import { Bloque, COLOR, mmss } from './comun'
import type { PanelRendimiento } from '@/lib/rendimiento/panel'

const ETIQUETA = { estable: 'Estable', moderada: 'Moderada', alta: 'Alta' } as const
const COLOR_VALORACION = { estable: COLOR.fresc, moderada: COLOR.ambar, alta: COLOR.fatiga } as const

const fechaCorta = (f: string) => { const d = new Date(`${f}T12:00:00Z`); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}` }
const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length

/** Deriva cardiaca (Pa:Hr) de las carreras continuas: cuánto sube el pulso para el mismo ritmo entre la 1ª y la 2ª mitad. */
export default function DerivaCardiaca({ deriva }: { deriva: PanelRendimiento['deriva'] }) {
  const filas = useMemo<Fila[]>(() => deriva.map(d => ({ fecha: d.fecha, deriva: d.derivaPct })), [deriva])

  if (deriva.length === 0) {
    return (
      <Bloque titulo="Deriva cardiaca" nota="Cuánto sube el pulso, a igual ritmo, entre la primera y la segunda mitad de una carrera continua.">
        <p className="py-3 text-xs" style={{ color: 'var(--text-muted)' }}>Aún no hay carreras continuas de 30+ min con pulso y vueltas para calcularla.</p>
      </Bloque>
    )
  }

  const ultimas = deriva.slice(-5)
  const previas = deriva.slice(-10, -5)
  const mediaUltimas = media(ultimas.map(d => d.derivaPct))
  const mediaPrevias = previas.length >= 3 ? media(previas.map(d => d.derivaPct)) : null
  const recientes = deriva.slice(-6).reverse()

  return (
    <Bloque titulo="Deriva cardiaca" nota="Cuánto sube el pulso, a igual ritmo, entre la 1ª y la 2ª mitad de una carrera continua. Menos de 5 % es base aeróbica sólida; más de 10 % indica que ese ritmo le exige demasiado al atleta.">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p><span className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{mediaUltimas.toFixed(1)} %</span> <span className="text-xs" style={{ color: 'var(--text-muted)' }}>media de las últimas {ultimas.length} carreras continuas</span></p>
        {mediaPrevias !== null && (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {mediaPrevias.toFixed(1)} % en las {previas.length} anteriores ({mediaUltimas - mediaPrevias <= 0 ? '' : '+'}{(mediaUltimas - mediaPrevias).toFixed(1)} puntos)
          </p>
        )}
      </div>

      <Grafica datos={filas} alto={140} referencia={5}
        zonas={[{ desde: -50, hasta: 5, color: COLOR.fresc }, { desde: 5, hasta: 10, color: COLOR.ambar }, { desde: 10, hasta: 100, color: COLOR.fatiga }]}
        series={[{ key: 'deriva', label: 'Deriva (%)', color: COLOR.forma }]} formato={v => `${v.toFixed(1)} %`} />

      <ul className="mt-3 space-y-1.5">
        {recientes.map(d => (
          <li key={d.fecha} className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span style={{ color: 'var(--text-secondary)' }}>
              <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>{fechaCorta(d.fecha)}</span> · {d.minutos} min · pulso {d.fc1}→{d.fc2} ppm · ritmo {mmss(d.ritmo1_s_km)}→{mmss(d.ritmo2_s_km)}
            </span>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums" style={{ color: COLOR_VALORACION[d.valoracion], border: `1px solid ${COLOR_VALORACION[d.valoracion]}` }}>
              {d.derivaPct.toFixed(1)} % · {ETIQUETA[d.valoracion]}
            </span>
          </li>
        ))}
      </ul>
    </Bloque>
  )
}
