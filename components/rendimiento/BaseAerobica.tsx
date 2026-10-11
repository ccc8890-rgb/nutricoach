'use client'
import { useMemo } from 'react'
import Grafica, { type Fila } from './Grafica'
import { Bloque, COLOR, mmss } from './comun'
import type { PanelRendimiento } from '@/lib/rendimiento/panel'

const ETIQUETA = { mejora: 'Mejorando', estable: 'Estable', retrocede: 'Retrocede', sin_datos: 'Sin datos' } as const
const COLOR_VALORACION = { mejora: COLOR.fresc, estable: COLOR.carga, retrocede: COLOR.ambar, sin_datos: COLOR.carga } as const

const signo = (n: number) => (n > 0 ? '+' : '')

/** ¿Corre más rápido con el mismo pulso? Compara solo rodajes suaves de los últimos 28 días con los 28 anteriores. */
export default function BaseAerobica({ base }: { base: PanelRendimiento['baseAerobica'] }) {
  const filas = useMemo<Fila[]>(() => base.puntos.map(p => ({ fecha: p.fecha, ritmo: p.ritmoRef })), [base.puntos])
  const nota = 'Solo rodajes suaves continuos (pulso medio bajo el techo de la zona suave). Mide cuánto corre el atleta con el mismo pulso: si el ritmo baja, la base aeróbica mejora.'

  if (!base.fcRef) {
    return (
      <Bloque titulo="Base aeróbica" nota={nota}>
        <p className="py-3 text-xs" style={{ color: 'var(--text-muted)' }}>Sin pulso de umbral ni pulso máximo del reloj no se puede fijar el pulso de referencia.</p>
      </Bloque>
    )
  }

  const { reciente, previa } = base
  return (
    <Bloque titulo="Base aeróbica" nota={nota}>
      {reciente && previa && base.cambioPct !== null && base.cambioSeg !== null ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: COLOR_VALORACION[base.valoracion], border: `1px solid ${COLOR_VALORACION[base.valoracion]}` }}>{ETIQUETA[base.valoracion]}</span>
            <p className="text-sm" style={{ color: 'var(--text)' }}>
              A <span className="font-semibold tabular-nums">{base.fcRef} ppm</span> corre a <span className="font-semibold tabular-nums">{mmss(reciente.ritmoRef)}/km</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}> (antes {mmss(previa.ritmoRef)}/km · {signo(base.cambioSeg)}{Math.round(base.cambioSeg)} s/km · eficiencia {signo(base.cambioPct)}{base.cambioPct} %)</span>
            </p>
          </div>
          <dl className="mb-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs" style={{ color: 'var(--text-muted)' }}>Pulso medio en rodajes</dt>
              <dd className="font-semibold tabular-nums">{reciente.fcMedia} ppm <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>(antes {previa.fcMedia})</span></dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: 'var(--text-muted)' }}>Ritmo medio en rodajes</dt>
              <dd className="font-semibold tabular-nums">{reciente.ritmoMedio ? `${mmss(reciente.ritmoMedio)}/km` : '—'} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{previa.ritmoMedio ? `(antes ${mmss(previa.ritmoMedio)})` : ''}</span></dd>
            </div>
          </dl>
          <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>Medianas de {reciente.rodajes} rodajes (últimos 28 días) frente a {previa.rodajes} (los 28 anteriores).</p>
        </>
      ) : (
        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Hacen falta al menos 3 rodajes suaves en los últimos 28 días y otros 3 en los 28 anteriores para comparar{reciente ? ` (ahora: ${reciente.rodajes} recientes${previa ? '' : ', faltan previos'})` : ''}.
        </p>
      )}
      <Grafica datos={filas} alto={140} series={[{ key: 'ritmo', label: `Ritmo a ${base.fcRef} ppm`, color: COLOR.fresc }]} formato={v => `${mmss(v)}/km`} />
      <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>Un cambio de ±2 % es ruido: el calor, el sueño o las cuestas lo mueven. Valora la tendencia de varias semanas, no un rodaje suelto.</p>
    </Bloque>
  )
}
