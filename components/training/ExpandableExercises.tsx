'use client'
import { useState } from 'react'
import { ChevronDown, Clock, Repeat } from 'lucide-react'

export interface EjercicioDetalle {
  id: string
  orden: number
  series: number | null
  repeticiones: string | null
  descanso_segundos: number | null
  peso_sugerido: string | null
  notas: string | null
  contexto_ia: string | null
  ejercicio: { id: string; nombre: string; grupo_muscular: string | null; tipo: string | null } | null
}

/** Fila de ejercicio: nombre + series/reps/descanso siempre visibles,
 * la explicación (RPE, técnica, contexto) se despliega solo si se toca. */
export default function ListaEjerciciosExpandible({ ejercicios }: { ejercicios: EjercicioDetalle[] }) {
  const [abierto, setAbierto] = useState<string | null>(null)

  if (ejercicios.length === 0) {
    return <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>Sin ejercicios cargados.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {ejercicios.map(ej => {
        const open = abierto === ej.id
        const detalle = ej.notas || ej.contexto_ia
        return (
          <div key={ej.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg)' }}>
            <button
              type="button"
              onClick={() => detalle && setAbierto(open ? null : ej.id)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{ej.ejercicio?.nombre ?? 'Ejercicio'}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {ej.series && (
                    <span className="inline-flex items-center gap-1"><Repeat size={11} /> {ej.series}×{ej.repeticiones ?? '-'}</span>
                  )}
                  {ej.descanso_segundos ? (
                    <span className="inline-flex items-center gap-1"><Clock size={11} /> {ej.descanso_segundos}s</span>
                  ) : null}
                  {ej.peso_sugerido && <span>{ej.peso_sugerido}</span>}
                </div>
              </div>
              {detalle && (
                <ChevronDown
                  size={14}
                  className="shrink-0"
                  style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                />
              )}
            </button>
            {open && detalle && (
              <p className="px-3 pb-2.5 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{detalle}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
