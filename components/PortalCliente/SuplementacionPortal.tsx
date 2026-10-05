'use client'

import useSWR from 'swr'
import { CaretDown } from '@phosphor-icons/react'
import { fetchJson } from '@/lib/cliente/cache-swr'

type Ambito = 'diaria' | 'sesion' | 'carrera'

type SuplementacionItem = {
  id: string
  nombre: string
  ambito: Ambito
  dosis: string
  timing: string
  notas: string
  precauciones: string[]
  fuentes: string[]
  evidencia: string
}

type SuplementacionResponse = { items: SuplementacionItem[] }

const GRUPOS: { ambito: Ambito; titulo: string }[] = [
  { ambito: 'diaria', titulo: 'Día a día' },
  { ambito: 'sesion', titulo: 'Antes y durante el entreno' },
  { ambito: 'carrera', titulo: 'Día de carrera' },
]

export default function SuplementacionPortal() {
  const { data } = useSWR<SuplementacionResponse>('/api/cliente/suplementacion', fetchJson)
  const items = data?.items ?? []

  if (!data || items.length === 0) return null

  return (
    <details
      className="group rounded-2xl border p-4 sm:p-5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>Tu suplementación</h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Pautas revisadas y aprobadas para ti
          </p>
        </div>
        <CaretDown
          aria-hidden="true"
          className="shrink-0 transition-transform group-open:rotate-180"
          size={18}
          style={{ color: 'var(--text-secondary)' }}
        />
      </summary>

      <div className="mt-4 space-y-5">
        <p
          className="rounded-xl border px-3 py-2.5 text-xs leading-relaxed"
          style={{ background: 'var(--primary-bg)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Pautas aprobadas por tu coach. Si tienes alguna condición médica, consúltalo antes de tomar nada.
        </p>

        {GRUPOS.map(grupo => {
          const elementos = items.filter(item => item.ambito === grupo.ambito)
          if (elementos.length === 0) return null

          return (
            <section key={grupo.ambito} aria-labelledby={`suplementacion-${grupo.ambito}`}>
              <h3
                id={`suplementacion-${grupo.ambito}`}
                className="mb-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: 'var(--text-secondary)' }}
              >
                {grupo.titulo}
              </h3>
              <div className="space-y-2">
                {elementos.map(item => (
                  <article
                    key={item.id}
                    className="rounded-xl border p-3.5"
                    style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h4 className="text-sm font-bold" style={{ color: 'var(--text)' }}>{item.nombre}</h4>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}
                      >
                        Evidencia {item.evidencia}
                      </span>
                    </div>

                    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold" style={{ color: 'var(--text-muted)' }}>Dosis</dt>
                        <dd className="mt-0.5" style={{ color: 'var(--text)' }}>{item.dosis || 'Según la pauta del coach'}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold" style={{ color: 'var(--text-muted)' }}>Cuándo tomarlo</dt>
                        <dd className="mt-0.5" style={{ color: 'var(--text)' }}>{item.timing || 'Según la pauta del coach'}</dd>
                      </div>
                    </dl>

                    {item.notas && (
                      <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Nota del coach</p>
                        <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{item.notas}</p>
                      </div>
                    )}

                    <details className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                      <summary className="cursor-pointer text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Precauciones y fuentes
                      </summary>
                      <div className="mt-2 space-y-3 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {item.precauciones.length > 0 && (
                          <ul className="list-disc space-y-1 pl-4">
                            {item.precauciones.map(precaucion => <li key={precaucion}>{precaucion}</li>)}
                          </ul>
                        )}
                        {item.fuentes.length > 0 && (
                          <div>
                            <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Fuentes</p>
                            <ul className="mt-1 list-disc space-y-1 pl-4">
                              {item.fuentes.map(fuente => <li key={fuente}>{fuente}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </details>
  )
}
