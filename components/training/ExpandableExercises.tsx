'use client'
import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { TechnicalRow } from '@/components/PortalCliente/editorial'
import { descansoVisible } from '@/lib/entrenos/descanso-visible'
import { notaLegible, pausa, ritmoDeLaNota } from '@/lib/training/ejercicio-texto'
import { parseExerciseChecklist, toggleExerciseChecklist } from '@/lib/training/exercise-checklist'
import { crearPresentacionEjercicios } from '@/lib/training/session-blocks'

export interface EjercicioDetalle {
  id: string
  orden: number
  bloque?: string | null
  series: number | null
  repeticiones: string | null
  descanso_segundos: number | null
  peso_sugerido: string | null
  notas: string | null
  contexto_ia: string | null
  ejercicio: { id: string; nombre: string; grupo_muscular: string | null; tipo: string | null } | null
}

/** Descanso entre series: con una sola serie no hay nada que descansar (calentamiento de 1 × 5 min), así que no se muestra. */
function descansoDe(ej: EjercicioDetalle): number {
  return descansoVisible(ej.ejercicio?.tipo, ej.descanso_segundos, ej.series)
}

/** Descanso compartido por todos los ejercicios del bloque (2+), para mostrarlo una sola vez. */
function descansoComun(items: EjercicioDetalle[]): number | null {
  if (items.length < 2) return null
  const valores = items.map(ej => (descansoDe(ej) ? ej.descanso_segundos : null))
  const primero = valores[0]
  return primero && valores.every(v => v === primero) ? primero : null
}

/** Fila de ejercicio: nombre + series/reps/descanso siempre visibles,
 * la explicación (RPE, técnica, contexto) se despliega solo si se toca. */
export default function ListaEjerciciosExpandible({ ejercicios, checklistKey }: { ejercicios: EjercicioDetalle[]; checklistKey?: string }) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const [completados, setCompletados] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!checklistKey || typeof window === 'undefined') return
    setCompletados(parseExerciseChecklist(window.localStorage.getItem(checklistKey), ejercicios.map(ej => ej.id)))
  }, [checklistKey, ejercicios])

  function toggleCompletado(ejercicioId: string) {
    if (!checklistKey || typeof window === 'undefined') return
    setCompletados(current => {
      const marcando = !current.has(ejercicioId)
      const next = toggleExerciseChecklist(current, ejercicioId)
      window.localStorage.setItem(checklistKey, JSON.stringify([...next]))
      if (marcando && navigator.vibrate) navigator.vibrate(24)
      return next
    })
  }

  if (ejercicios.length === 0) {
    return <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>Sin ejercicios cargados.</p>
  }

  const grupos = crearPresentacionEjercicios(ejercicios)

  return (
    <div className="training-exercise-list">
      {grupos.map(grupo => (
        <section key={grupo.bloque} className="training-exercise-group">
          <p className="mb-2 mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] first:mt-0" style={{ color: 'var(--text-muted)' }}>
            {grupo.label}{descansoComun(grupo.items) ? ` · pausa ${pausa(descansoComun(grupo.items) as number)}` : ''}
          </p>
          {grupo.items.map(ej => {
            const comun = descansoComun(grupo.items)
            const open = abierto === ej.id
            const detalle = ej.notas || ej.contexto_ia
            const completado = completados.has(ej.id)
            const nombre = ej.ejercicio?.nombre ?? 'Ejercicio'
            return (
              <TechnicalRow
                key={ej.id}
                index={checklistKey ? (
                  <button
                    type="button"
                    className={`training-exercise-index-toggle ${completado ? 'is-checked' : ''}`}
                    onClick={() => toggleCompletado(ej.id)}
                    aria-label={`${completado ? 'Desmarcar' : 'Marcar'} ${nombre} como completado`}
                    aria-pressed={completado}
                  >
                    {String(ej.indiceGlobal).padStart(2, '0')}
                  </button>
                ) : String(ej.indiceGlobal).padStart(2, '0')}
                interactiveIndex={Boolean(checklistKey)}
                label={<span className="training-exercise-name">{nombre}</span>}
                meta={ej.series ? `${ej.series}\u00a0×\u00a0${ej.repeticiones ?? '-'}` : undefined}
                className={`training-exercise-row ${completado ? 'is-checked' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => detalle && setAbierto(open ? null : ej.id)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="sr-only">{ej.ejercicio?.nombre ?? 'Ejercicio'}</p>
                    {(() => {
                      const chips: string[] = []
                      if (!comun && descansoDe(ej)) chips.push(`pausa ${pausa(ej.descanso_segundos as number)}`)
                      const ritmo = ritmoDeLaNota(detalle)
                      if (ritmo) chips.push(ritmo)
                      if (ej.peso_sugerido) chips.push(ej.peso_sugerido)
                      return chips.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                          {chips.map(c => <span key={c}>{c}</span>)}
                        </div>
                      ) : null
                    })()}
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
                  <p className="px-3 pb-2.5 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{notaLegible(detalle)}</p>
                )}
              </TechnicalRow>
            )
          })}
        </section>
      ))}
    </div>
  )
}
