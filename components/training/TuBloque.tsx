'use client'
import { useState } from 'react'
import type { TuBloque as Datos } from '@/lib/entrenos/tu-bloque'

const dia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

/** Parte el mensaje del coach en frases cortas para leerlo de un vistazo. */
const frases = (texto: string) => texto.split(/\n+|(?<=[.!?])\s+/).map(f => f.trim()).filter(Boolean)

/** «Tu bloque» (cliente): qué se busca, cómo evolucionan las próximas semanas y el mensaje del coach. Plegada por defecto. */
export default function TuBloque({ datos, fase, semanaActual, semanasTotales }: { datos: Datos; fase?: string; semanaActual?: number; semanasTotales?: number }) {
  const [abierto, setAbierto] = useState(false)
  const conBloque = !!(fase && semanaActual && semanasTotales)
  return (
    <section className="training-sheet">
      <button type="button" onClick={() => setAbierto(a => !a)} aria-expanded={abierto} className="tu-bloque__head">
        <span className="editorial-kicker">Tu bloque</span>
        <span className="tu-bloque__row">
          <span className="tu-bloque__fase">{conBloque ? fase : 'Tu plan'}</span>
          {conBloque && <span className="tu-bloque__semana">Semana <b>{semanaActual}</b>/{semanasTotales}</span>}
          <span className="tu-bloque__toggle" aria-hidden="true">{abierto ? '−' : '+'}</span>
        </span>
        {conBloque && (
          <span className="tu-bloque__pasos" aria-hidden="true">
            {Array.from({ length: semanasTotales! }, (_, i) => <span key={i} data-estado={i + 1 < semanaActual! ? 'hecha' : i + 1 === semanaActual ? 'actual' : 'pendiente'} />)}
          </span>
        )}
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
              <p className="editorial-kicker">Próximas semanas · carrera</p>
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
              <p className="editorial-kicker">Qué debería mejorar</p>
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
