'use client'
import { useMemo } from 'react'
import Grafica, { type Fila } from './Grafica'
import { Bloque, COLOR, mmss } from './comun'
import { lecturaCambio, type LecturaCambio, type MetricaTecnica } from '@/lib/rendimiento/tecnica'
import type { PanelRendimiento } from '@/lib/rendimiento/panel'

const METRICAS: { key: MetricaTecnica; titulo: string; unidad: string; decimales: number; ayuda: string }[] = [
  { key: 'contacto_ms', titulo: 'Contacto con el suelo', unidad: 'ms', decimales: 0, ayuda: 'Tiempo que el pie está apoyado. Menos = zancada más elástica.' },
  { key: 'ratio_vertical', titulo: 'Ratio vertical', unidad: '%', decimales: 1, ayuda: 'Oscilación entre zancada. Menos = menos energía gastada en rebotar.' },
  { key: 'cadencia', titulo: 'Cadencia', unidad: 'ppm', decimales: 0, ayuda: 'Pasos por minuto. Sin un valor ideal único: depende del ritmo y del atleta.' },
  { key: 'zancada_cm', titulo: 'Zancada', unidad: 'cm', decimales: 0, ayuda: 'Longitud media del paso. Sube con el ritmo.' },
]

const LECTURA: Record<LecturaCambio, { texto: string; color: string }> = {
  mejora: { texto: 'Mejora', color: COLOR.fresc },
  empeora: { texto: 'Empeora', color: COLOR.fatiga },
  cambio: { texto: 'Cambia', color: COLOR.forma },
  estable: { texto: 'Sin cambio', color: COLOR.carga },
}

/** Técnica de carrera: dónde está hoy y cómo ha cambiado a igual ritmo respecto a los meses anteriores. */
export default function TecnicaCarrera({ tecnica }: { tecnica: PanelRendimiento['tecnica'] }) {
  const { puntos, resumen } = tecnica
  const filas = useMemo<Fila[]>(() => puntos.map(p => ({
    fecha: p.fecha, contacto: p.contacto_ms, ratio: p.ratio_vertical, cadencia: p.cadencia, zancada: p.zancada_cm,
  })), [puntos])

  if (puntos.length === 0) {
    return (
      <Bloque titulo="Técnica de carrera" nota="Cadencia, zancada, contacto con el suelo y oscilación vertical medidos por el reloj.">
        <p className="py-3 text-xs" style={{ color: 'var(--text-muted)' }}>Aún no hay carreras al aire libre de 20+ min con estos datos (el reloj necesita pulsera o pod de dinámica de carrera).</p>
      </Bloque>
    )
  }

  const graficas: { key: string; label: string; color: string; fmt: (v: number) => string }[] = [
    { key: 'contacto', label: 'Contacto (ms)', color: COLOR.fatiga, fmt: v => `${Math.round(v)} ms` },
    { key: 'ratio', label: 'Ratio vertical (%)', color: COLOR.ambar, fmt: v => `${v.toFixed(1)} %` },
    { key: 'cadencia', label: 'Cadencia (ppm)', color: COLOR.forma, fmt: v => `${Math.round(v)} ppm` },
    { key: 'zancada', label: 'Zancada (cm)', color: COLOR.fresc, fmt: v => `${Math.round(v)} cm` },
  ]

  return (
    <Bloque titulo="Técnica de carrera" nota="Estas métricas cambian con el ritmo, así que la comparación se hace a igual ritmo: se ajusta cada una contra el ritmo de todas sus carreras y se mira cuánto se desvían las recientes.">
      {resumen ? (
        <>
          <p className="mb-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Últimas 6 semanas ({resumen.carrerasRecientes} carreras) frente a los 4 meses anteriores ({resumen.carrerasPrevias}), a {mmss(resumen.ritmoReferencia)}/km.
          </p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {METRICAS.map(m => {
              const c = resumen.metricas[m.key]
              const l = LECTURA[lecturaCambio(m.key, c.delta)]
              const f = (n: number) => (Math.round(n * 10 ** m.decimales) / 10 ** m.decimales).toFixed(m.decimales)
              return (
                <div key={m.key} className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }} title={m.ayuda}>
                  <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{m.titulo}</p>
                  <p className="mt-0.5 text-2xl font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{f(c.reciente)} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{m.unidad}</span></p>
                  <p className="text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>antes {f(c.previo)} ({c.delta > 0 ? '+' : ''}{f(c.delta)})</p>
                  <span className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: l.color, border: `1px solid ${l.color}` }}>{l.texto}</span>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>Para comparar a igual ritmo hacen falta al menos 4 carreras en las últimas 6 semanas y 4 en los 4 meses anteriores.</p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {graficas.map(g => (
          <div key={g.key}>
            <p className="mb-1 text-xs" style={{ color: 'var(--text-muted)' }}>{g.label} por salida</p>
            <Grafica datos={filas} alto={110} series={[{ key: g.key, label: g.label, color: g.color }]} formato={g.fmt} />
          </div>
        ))}
      </div>
    </Bloque>
  )
}
