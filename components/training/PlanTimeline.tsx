'use client'
import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'

export interface EjercicioTimeline {
  id: string
  ejercicio_id: string
  nombre: string
  grupo_muscular: string
  series: number
  repeticiones: string
  descanso_segundos: number
  peso_sugerido: string
  rpe: string
  notas: string
  instruccion_ejercicio: string
  contexto_ia: string | null
  orden: number
}

export interface SesionTimeline {
  id: string
  nombre: string
  dia_semana: string
  orden: number
  duracion_estimada_min?: number
  ejercicios: EjercicioTimeline[]
}

export interface SemanaTimeline {
  numero: number
  sesiones: SesionTimeline[]
}

interface MoverDestino {
  ejercicioId: string
  sesionActualId: string
}

interface PlanTimelineProps {
  semanas: SemanaTimeline[]
  onReorder: (sesionId: string, ejerciciosOrdenados: string[]) => Promise<void>
  onMover: (ejercicioId: string, destSesionId: string) => Promise<void>
  onToggleContextoIA: (sesionId: string, ejercicioId: string) => void
  sesionesDisponibles: { id: string; nombre: string; dia_semana: string; semana: number }[]
}

function SortableEjercicioCard({
  ej,
  sesionId,
  onMoverClick,
  onToggleIA,
}: {
  ej: EjercicioTimeline
  sesionId: string
  onMoverClick: (info: MoverDestino) => void
  onToggleIA: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ej.id })
  const [expanded, setExpanded] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2.5 mb-1.5 border transition-colors"
        style={{
          background: isDragging ? 'var(--surface)' : 'var(--bg)',
          borderColor: isDragging ? 'rgb(168,85,247)' : 'var(--border)',
          boxShadow: isDragging ? '0 4px 16px rgba(168,85,247,0.15)' : 'none',
        }}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
          style={{ color: 'var(--border-strong)', padding: '2px' }}
          aria-label="Arrastrar para reordenar"
        >
          <GripVertical size={14} />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{ej.nombre}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {ej.series}×{ej.repeticiones}
            {ej.rpe ? ` @RPE${ej.rpe}` : ''}
            {ej.descanso_segundos > 0 ? ` · ${ej.descanso_segundos}s` : ''}
          </p>
        </div>

        {ej.grupo_muscular && (
          <span className="hidden sm:inline text-xs px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ background: 'rgba(168,85,247,0.1)', color: 'rgb(168,85,247)' }}>
            {ej.grupo_muscular}
          </span>
        )}

        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-shrink-0 p-1 rounded"
          style={{ color: 'var(--text-muted)' }}
          aria-label={expanded ? 'Colapsar' : 'Expandir'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <button
          onClick={() => onMoverClick({ ejercicioId: ej.id, sesionActualId: sesionId })}
          className="flex-shrink-0 p-1 rounded"
          style={{ color: 'var(--text-muted)' }}
          title="Mover a otro día o semana"
          aria-label="Mover a otro día o semana"
        >
          <ArrowUpDown size={14} />
        </button>
      </div>

      {expanded && (
        <div className="ml-6 mb-2 pl-3 py-2 rounded-lg border-l-2 text-xs"
          style={{ borderColor: 'rgba(168,85,247,0.3)', color: 'var(--text-secondary)' }}>
          {ej.instruccion_ejercicio && <p className="mb-1">{ej.instruccion_ejercicio}</p>}
          {ej.contexto_ia ? (
            <p className="italic" style={{ color: 'rgb(168,85,247)' }}>🤖 {ej.contexto_ia}</p>
          ) : (
            <button onClick={onToggleIA} className="text-xs underline" style={{ color: 'rgb(168,85,247)' }}>
              + Generar contexto IA
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function PlanTimeline({ semanas, onReorder, onMover, onToggleContextoIA, sesionesDisponibles }: PlanTimelineProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [moverInfo, setMoverInfo] = useState<MoverDestino | null>(null)

  function handleDragEnd(event: DragEndEvent, sesion: SesionTimeline) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = sesion.ejercicios.findIndex(e => e.id === active.id)
    const newIdx = sesion.ejercicios.findIndex(e => e.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const reordenados = arrayMove(sesion.ejercicios, oldIdx, newIdx)
    onReorder(sesion.id, reordenados.map(e => e.id))
  }

  return (
    <div>
      {semanas.map(semana => (
        <div key={semana.numero} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider flex-shrink-0"
              style={{ color: 'rgb(168,85,247)' }}>
              Semana {semana.numero}
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {semana.sesiones.map(sesion => (
            <div key={sesion.id} className="mb-5 pl-3" style={{ borderLeft: '2px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'rgb(168,85,247)', marginLeft: -5 }} />
                <span className="text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>
                  {sesion.dia_semana}
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{sesion.nombre}</span>
                {sesion.duracion_estimada_min && (
                  <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>~{sesion.duracion_estimada_min} min</span>
                )}
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={e => handleDragEnd(e, sesion)}
              >
                <SortableContext items={sesion.ejercicios.map(e => e.id)} strategy={verticalListSortingStrategy}>
                  {sesion.ejercicios.map(ej => (
                    <SortableEjercicioCard
                      key={ej.id}
                      ej={ej}
                      sesionId={sesion.id}
                      onMoverClick={setMoverInfo}
                      onToggleIA={() => onToggleContextoIA(sesion.id, ej.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          ))}
        </div>
      ))}

      {moverInfo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setMoverInfo(null)}>
          <div className="rounded-xl p-5 w-full max-w-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <p className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Mover ejercicio a…</p>
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
              {sesionesDisponibles
                .filter(s => s.id !== moverInfo.sesionActualId)
                .map(s => (
                  <button
                    key={s.id}
                    onClick={() => { onMover(moverInfo.ejercicioId, s.id); setMoverInfo(null) }}
                    className="text-left px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgb(168,85,247)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                  >
                    <span style={{ color: 'rgb(168,85,247)' }}>Sem {s.semana} · {s.dia_semana}</span>
                    {' '}— {s.nombre}
                  </button>
                ))}
            </div>
            <button onClick={() => setMoverInfo(null)} className="mt-3 text-xs w-full text-center"
              style={{ color: 'var(--text-muted)' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
