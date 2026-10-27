'use client'

import Link from 'next/link'
import { estudioVacio, rendimientoEscalado, resumenConservacion, validarEstudio } from '@/lib/recetas/estudio'

const mono = { fontFamily: 'var(--font-mono, monospace)' } as const

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-4 py-2.5">
      <dt className="text-[11px] uppercase tracking-[0.14em]" style={{ ...mono, color: 'var(--text-muted)' }}>{etiqueta}</dt>
      <dd className="text-base leading-snug whitespace-pre-line" style={{ color: 'var(--text)' }}>{children}</dd>
    </div>
  )
}

const minutos = (m: number) => (m >= 120 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`)

/** Capa «Estudio» de la ficha (cocina profesional). Solo para el coach. El rendimiento sigue el selector de raciones. */
export default function PanelEstudio({ estudio, factor, editarHref }: { estudio: unknown; factor: number; editarHref: string }) {
  const e = validarEstudio(estudio)
  if (estudioVacio(e)) {
    return (
      <div className="coach-recipe-detail__section mb-6 p-5 text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        Sin datos de estudio todavía (rendimiento, mise en place, conservación…). <Link href={editarHref} className="underline decoration-dotted underline-offset-4" style={{ color: 'var(--text)' }}>Añadirlos en Editar</Link>
      </div>
    )
  }
  const rendimiento = rendimientoEscalado(e, factor)
  const conservacion = resumenConservacion(e.conservacion)
  return (
    <div className="coach-recipe-detail__section mb-6 p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <dl className="mx-auto max-w-xl divide-y" style={{ borderColor: 'var(--border)' }}>
        {rendimiento && <Fila etiqueta="Rinde">{rendimiento}</Fila>}
        {e.tiempo_activo_min !== undefined && <Fila etiqueta="Tiempo activo">{minutos(e.tiempo_activo_min)}</Fila>}
        {e.tiempo_total_min !== undefined && <Fila etiqueta="Tiempo total">{minutos(e.tiempo_total_min)}</Fila>}
        {e.mise_en_place && <Fila etiqueta="Mise en place">{e.mise_en_place}</Fila>}
        {e.porcionado && <Fila etiqueta="Porcionado">{e.porcionado}</Fila>}
        {conservacion && <Fila etiqueta="Conservación">{conservacion}</Fila>}
        {e.equipo && <Fila etiqueta="Equipo">{e.equipo}</Fila>}
        {e.variantes && <Fila etiqueta="Variantes">{e.variantes}</Fila>}
        {e.origen && <Fila etiqueta="Origen">{e.origen}</Fila>}
      </dl>
    </div>
  )
}
