'use client'
import { useState } from 'react'
import type { TuBloque as Datos } from '@/lib/entrenos/tu-bloque'

const dia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

/** Parte el mensaje del coach en frases cortas para leerlo de un vistazo. */
const frases = (texto: string) => texto.split(/\n+|(?<=[.!?])\s+/).map(f => f.trim()).filter(Boolean)

/** «Tu bloque» (cliente): qué se busca, cómo evolucionan las próximas semanas y el mensaje del coach. Plegada por defecto. */
export default function TuBloque({ datos, fase, semanaActual, semanasTotales }: { datos: Datos; fase?: string; semanaActual?: number; semanasTotales?: number }) {
  const [abierto, setAbierto] = useState(false)
  const titulo = fase && semanaActual && semanasTotales ? `Tu bloque · ${fase}, semana ${semanaActual} de ${semanasTotales}` : 'Tu bloque'
  return (
    <section className="training-sheet">
      <button type="button" onClick={() => setAbierto(a => !a)} aria-expanded={abierto} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block font-mono text-[10px] font-semibold tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>TU BLOQUE</span>
          <span className="mt-1 block font-bold leading-tight" style={{ color: 'var(--text)' }}>{titulo.replace('Tu bloque · ', '').replace('Tu bloque', 'Tu plan')}</span>
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{abierto ? 'Ocultar' : 'Ver'}</span>
      </button>
      {abierto && (
        <div className="mt-4 flex flex-col gap-4">
          {datos.mensaje && (() => {
            const f = frases(datos.mensaje)
            if (f.length < 3) return <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{datos.mensaje}</p>
            return (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>{f[0]}</p>
                <ul className="flex flex-col gap-1.5 text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {f.slice(1).map((x, i) => <li key={i} className="flex gap-2"><span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>·</span><span>{x}</span></li>)}
                </ul>
              </div>
            )
          })()}
          {datos.semanas.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Próximas semanas · carrera</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {datos.semanas.map(s => (
                  <li key={s.n} className="flex items-center justify-between text-sm" style={{ color: 'var(--text)' }}>
                    <span>{s.actual ? 'Esta semana' : `Semana del ${dia(s.lunes)}`}{s.descarga ? ' · descarga' : ''}{s.prevision ? ' · previsión' : ''}</span>
                    <span className="tabular-nums font-semibold">{s.km ? `≈ ${s.km} km · ${s.minutos} min` : `${s.minutos} min`}</span>
                  </li>
                ))}
              </ul>
              {datos.semanas.some(s => s.prevision) && <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>Las semanas de previsión son orientativas: tu coach las confirma y crea las sesiones al terminar este bloque.</p>}
              {datos.semanas.some(s => s.descarga) && <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>Las semanas de descarga bajan el volumen a propósito: ahí es donde el cuerpo asimila el trabajo.</p>}
            </div>
          )}
          {datos.mejoras.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Qué debería mejorar</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm" style={{ color: 'var(--text)' }}>
                {datos.mejoras.map((m, i) => <li key={i}>· {m}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
