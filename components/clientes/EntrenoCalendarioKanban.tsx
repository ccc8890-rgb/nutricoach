'use client'

import { useEffect, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, Dumbbell, GripVertical, Loader2, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'

const DIAS: string[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_ABREV: Record<string, string> = { Lunes: 'L', Martes: 'M', Miércoles: 'X', Jueves: 'J', Viernes: 'V', Sábado: 'S', Domingo: 'D' }

interface Ejercicio {
  id: string
  series: number | null
  repeticiones: string | null
  peso_sugerido: string | null
  rpe: string | null
  orden: number | null
  ejercicio: { nombre: string } | null
}

interface SesionKanban {
  id: string
  nombre: string
  dia_semana: string | null
  hora_inicio: string | null
  duracion_estimada_min: number | null
  fase_bloque: string | null
  contexto_ia: string | null
  ejercicios: Ejercicio[]
}

// Tarjeta arrastrable Y desplegable: un clic (sin arrastrar) expande la
// sesión para revisar los ejercicios ahí mismo, sin salir del calendario.
// El PointerSensor con activationConstraint de distancia hace que un clic
// simple no dispare el drag, así que ambos gestos conviven sin conflicto.
function SesionCard({ sesion, expandida, onToggle }: { sesion: SesionKanban; expandida: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: sesion.id })
  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 10 }
    : undefined

  return (
    <div ref={setNodeRef} style={style} className="mb-2.5 touch-none select-none">
      <div
        className="rounded-xl overflow-hidden transition-shadow"
        style={{
          background: 'var(--surface-elevated,var(--border))',
          border: '1px solid var(--border-strong,var(--border))',
          boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
          opacity: isDragging ? 0.6 : 1,
        }}
      >
        <div className="p-3 flex items-start gap-2.5 cursor-grab active:cursor-grabbing" {...listeners} {...attributes}>
          <GripVertical size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <button onClick={onToggle} className="min-w-0 flex-1 text-left">
            <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>{sesion.nombre}</p>
            {sesion.contexto_ia && (
              <p className="text-xs mt-1 font-medium" style={{ color: 'var(--semantic-info-text)' }}>{sesion.contexto_ia}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {sesion.hora_inicio ? (
                <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{sesion.hora_inicio}</span>
              ) : null}
              {sesion.duracion_estimada_min ? (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{sesion.duracion_estimada_min} min</span>
              ) : null}
              {sesion.fase_bloque ? (
                <span
                  className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--semantic-info-bg)', color: 'var(--semantic-info-text)', border: '1px solid var(--semantic-info-border)' }}
                >
                  {sesion.fase_bloque}
                </span>
              ) : null}
            </div>
          </button>
          {sesion.ejercicios.length > 0 && (
            <button onClick={onToggle} className="flex-shrink-0 mt-0.5">
              <ChevronDown size={14} className="transition-transform" style={{ color: 'var(--text-muted)', transform: expandida ? 'rotate(180deg)' : 'none' }} />
            </button>
          )}
        </div>

        {expandida && sesion.ejercicios.length > 0 && (
          <div className="px-3 pb-3 space-y-1.5" style={{ borderTop: '1px solid var(--border)' }}>
            {[...sesion.ejercicios].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map(ej => {
              const stats = [ej.series && `${ej.series}x${ej.repeticiones ?? '?'}`, ej.peso_sugerido, ej.rpe && `RPE ${ej.rpe}`].filter(Boolean)
              return (
                <div key={ej.id} className="pt-2.5 first:pt-3">
                  <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>{ej.ejercicio?.nombre ?? 'Ejercicio'}</p>
                  {stats.length > 0 && <p className="text-[11px] mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>{stats.join(' · ')}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function DiaColumna({ dia, sesiones, expandidaId, onToggle, onAñadir }: {
  dia: string
  sesiones: SesionKanban[]
  expandidaId: string | null
  onToggle: (id: string) => void
  onAñadir: (dia: string, nombre: string) => Promise<void>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dia })
  const [añadiendo, setAñadiendo] = useState(false)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function confirmar() {
    if (!nombre.trim()) return
    setGuardando(true)
    await onAñadir(dia, nombre.trim())
    setGuardando(false)
    setNombre('')
    setAñadiendo(false)
  }

  return (
    <div
      ref={setNodeRef}
      className="rounded-xl p-2.5 min-h-[120px] flex-1 min-w-[144px] transition-colors"
      style={{
        background: isOver ? 'var(--semantic-info-bg)' : 'var(--bg)',
        border: `1px dashed ${isOver ? 'var(--semantic-info-border)' : 'var(--border)'}`,
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider mb-2.5 px-1" style={{ color: 'var(--text-muted)' }}>
        <span className="sm:hidden">{DIAS_ABREV[dia]}</span>
        <span className="hidden sm:inline">{dia}</span>
      </p>
      {sesiones.length === 0 && !añadiendo ? (
        <p className="text-xs px-1 mb-2" style={{ color: 'var(--text-disabled)' }}>Descanso</p>
      ) : (
        sesiones.map(s => (
          <SesionCard key={s.id} sesion={s} expandida={expandidaId === s.id} onToggle={() => onToggle(s.id)} />
        ))
      )}

      {añadiendo ? (
        <div className="rounded-lg p-2" style={{ background: 'var(--surface-elevated,var(--border))' }}>
          <input
            autoFocus
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setAñadiendo(false) }}
            placeholder="Nombre de la sesión"
            className="w-full text-sm px-2.5 py-2 rounded-md mb-2"
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
          <div className="flex gap-1.5">
            <button onClick={confirmar} disabled={guardando || !nombre.trim()} className="flex-1 text-xs font-medium py-1.5 rounded-md" style={{ background: 'var(--primary)', color: 'var(--bg)' }}>
              {guardando ? '…' : 'Añadir'}
            </button>
            <button onClick={() => { setAñadiendo(false); setNombre('') }} className="px-2.5 rounded-md" style={{ color: 'var(--text-muted)' }}><X size={13} /></button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAñadiendo(true)}
          className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)', border: '1px dashed var(--border)' }}
        >
          <Plus size={12} /> Sesión
        </button>
      )}
    </div>
  )
}

export default function EntrenoCalendarioKanban({ planId }: { planId: string }) {
  const [sesiones, setSesiones] = useState<SesionKanban[] | null>(null)
  const [expandidaId, setExpandidaId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const { addToast } = useToast()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    let cancelado = false
    fetch(`/api/entrenos/${planId}`)
      .then(r => r.json())
      .then(data => { if (!cancelado) setSesiones(data.sesiones ?? []) })
      .catch(() => { if (!cancelado) setSesiones([]) })
    return () => { cancelado = true }
  }, [planId])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || !sesiones) return
    const nuevoDia = String(over.id)
    const sesion = sesiones.find(s => s.id === active.id)
    if (!sesion || sesion.dia_semana === nuevoDia) return

    const anterior = sesion.dia_semana
    setSesiones(prev => prev!.map(s => s.id === sesion.id ? { ...s, dia_semana: nuevoDia } : s))
    setGuardando(true)
    const { error } = await supabase.from('sesiones_entrenamiento').update({ dia_semana: nuevoDia }).eq('id', sesion.id)
    setGuardando(false)
    if (error) {
      setSesiones(prev => prev!.map(s => s.id === sesion.id ? { ...s, dia_semana: anterior } : s))
      addToast({ type: 'error', title: 'No se pudo mover la sesión' })
    } else {
      addToast({ type: 'success', title: `"${sesion.nombre}" movida a ${nuevoDia}` })
    }
  }

  async function handleAñadirSesion(dia: string, nombre: string) {
    const ordenMax = Math.max(0, ...(sesiones ?? []).map(s => (s as SesionKanban & { orden?: number }).orden ?? 0))
    const { data, error } = await supabase
      .from('sesiones_entrenamiento')
      .insert({ plan_id: planId, nombre, dia_semana: dia, orden: ordenMax + 1 })
      .select('id, nombre, dia_semana, hora_inicio, duracion_estimada_min, fase_bloque, contexto_ia')
      .single()
    if (error || !data) {
      addToast({ type: 'error', title: 'No se pudo crear la sesión' })
      return
    }
    setSesiones(prev => [...(prev ?? []), { ...data, ejercicios: [] }])
    addToast({ type: 'success', title: `"${nombre}" añadida a ${dia}` })
  }

  if (sesiones === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  if (sesiones.length === 0) {
    return (
      <div className="rounded-2xl px-4 py-8 text-center" style={{ background: 'var(--bg)', border: '1px dashed var(--border)' }}>
        <Dumbbell size={30} className="mx-auto mb-3 opacity-40" style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Sin sesiones programadas</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Asigna una plantilla o genera un plan para ver aquí la semana.</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Plantilla semanal del bloque activo — se repite cada semana hasta el siguiente bloque. Pulsa una sesión para ver sus ejercicios, o arrástrala a otro día.
        {guardando && <span className="ml-2 inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Guardando…</span>}
      </p>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {DIAS.map(dia => (
            <DiaColumna
              key={dia}
              dia={dia}
              sesiones={sesiones.filter(s => s.dia_semana === dia)}
              expandidaId={expandidaId}
              onToggle={id => setExpandidaId(prev => prev === id ? null : id)}
              onAñadir={handleAñadirSesion}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
