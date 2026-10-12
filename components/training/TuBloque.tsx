'use client'
import { useState } from 'react'
import type { TuBloque as Datos } from '@/lib/entrenos/tu-bloque'

const dia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

/** «Tu bloque» (cliente): qué se busca, cómo evolucionan las próximas semanas y el mensaje del coach. Plegada por defecto. */
export default function TuBloque({ datos, fase, semanaActual, semanasTotales }: { datos: Datos; fase?: string; semanaActual?: number; semanasTotales?: number }) {
  const [abierto, setAbierto] = useState(false)
  const titulo = fase && semanaActual && semanasTotales ? `Tu bloque · ${fase}, semana ${semanaActual} de ${semanasTotales}` : 'Tu bloque'
  return (
    <section className="rounded-3xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <button type="button" onClick={() => setAbierto(a => !a)} aria-expanded={abierto} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{titulo}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{abierto ? 'Ocultar' : 'Ver'}</span>
      </button>
      {abierto && (
        <div className="mt-4 flex flex-col gap-4">
          {datos.mensaje && <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{datos.mensaje}</p>}
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
