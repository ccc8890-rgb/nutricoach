'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import SetRegistroSheet from './SetRegistroSheet'

export interface SetData {
  kg: number
  reps: number
  rpe: number
  hecho: boolean
}

export interface EjercicioCard {
  id: string
  nombre: string
  grupo_muscular: string
  series: number
  repeticiones: string
  peso_sugerido: string
  instruccion_ejercicio: string
  contexto_ia: string | null
}

interface Props {
  ejercicios: EjercicioCard[]
  onEjercicioComplete: (ejId: string, sets: SetData[]) => void
  onTodosCompletos: (setsMap: Record<string, SetData[]>) => void
}

export default function SesionCardMobile({ ejercicios, onEjercicioComplete, onTodosCompletos }: Props) {
  const [ejIdx, setEjIdx] = useState(0)
  const [setsMap, setSetsMap] = useState<Record<string, SetData[]>>(() =>
    Object.fromEntries(
      ejercicios.map(e => [
        e.id,
        Array.from({ length: e.series }, () => ({ kg: 0, reps: 0, rpe: 7, hecho: false })),
      ])
    )
  )
  const [setActivo, setSetActivo] = useState<{ ejId: string; setIdx: number } | null>(null)

  const ej = ejercicios[ejIdx]
  if (!ej) return null

  const sets = setsMap[ej.id] ?? []
  const primerSetPendiente = sets.findIndex(s => !s.hecho)
  const todosEjHechos = sets.every(s => s.hecho)

  const totalSets = ejercicios.reduce((a, e) => a + e.series, 0)
  const hechos = Object.values(setsMap).flatMap(s => s).filter(s => s.hecho).length
  const progreso = totalSets > 0 ? hechos / totalSets : 0

  function guardarSet(kg: number, reps: number, rpe: number) {
    if (!setActivo) return
    const ejId = setActivo.ejId
    const idx = setActivo.setIdx
    setSetsMap(prev => {
      const nuevosSets = prev[ejId].map((s, i) =>
        i === idx ? { kg, reps, rpe, hecho: true } : s
      )
      const nuevo = { ...prev, [ejId]: nuevosSets }
      if (nuevosSets.every(s => s.hecho)) onEjercicioComplete(ejId, nuevosSets)
      return nuevo
    })
    setSetActivo(null)
  }

  function avanzar() {
    if (ejIdx < ejercicios.length - 1) {
      setEjIdx(ejIdx + 1)
    } else {
      onTodosCompletos(setsMap)
    }
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100%' }}>
      {/* Barra progreso global */}
      <div className="h-1 rounded-full mx-4 mt-2 mb-1 overflow-hidden" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${progreso * 100}%`, background: 'rgb(168,85,247)' }}
        />
      </div>
      <p className="text-center text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Ejercicio {ejIdx + 1} / {ejercicios.length}
      </p>

      {/* Card del ejercicio */}
      <div className="mx-4 rounded-2xl p-5 flex-1 flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between mb-1">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{ej.grupo_muscular}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.12)', color: 'rgb(168,85,247)' }}>
            {ej.series}×{ej.repeticiones}
          </span>
        </div>
        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>{ej.nombre}</h2>
        {ej.peso_sugerido && (
          <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Sugerido: {ej.peso_sugerido}</p>
        )}
        {ej.contexto_ia && (
          <p className="text-xs italic mb-3" style={{ color: 'rgb(168,85,247)' }}>🤖 {ej.contexto_ia}</p>
        )}
        {ej.instruccion_ejercicio && (
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{ej.instruccion_ejercicio}</p>
        )}

        {/* Grid de sets */}
        <div
          className="grid gap-2 flex-1"
          style={{ gridTemplateColumns: sets.length <= 3 ? `repeat(${sets.length}, 1fr)` : 'repeat(2, 1fr)' }}
        >
          {sets.map((set, i) => {
            const isActive = !set.hecho && i === primerSetPendiente
            return (
              <button
                key={i}
                onClick={() => { if (!set.hecho) setSetActivo({ ejId: ej.id, setIdx: i }) }}
                className="rounded-xl py-3 flex flex-col items-center justify-center transition-all"
                style={{
                  background: set.hecho ? 'rgba(168,85,247,0.1)' : isActive ? 'rgba(168,85,247,0.08)' : 'var(--bg)',
                  border: `1.5px solid ${set.hecho ? 'rgba(168,85,247,0.5)' : isActive ? 'rgb(168,85,247)' : 'var(--border)'}`,
                }}
                aria-label={`Set ${i + 1}${set.hecho ? ` completado: ${set.kg}kg × ${set.reps} reps` : ''}`}
              >
                <span className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Set {i + 1}</span>
                {set.hecho ? (
                  <>
                    <span className="text-base font-bold" style={{ color: 'rgb(168,85,247)' }}>{set.kg}kg</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{set.reps} reps</span>
                  </>
                ) : (
                  <span className="text-lg" style={{ color: isActive ? 'rgb(168,85,247)' : 'var(--border-strong)' }}>
                    {isActive ? '▶' : '○'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Navegación inferior */}
      <div className="flex gap-3 px-4 py-4">
        <button
          onClick={() => setEjIdx(i => Math.max(0, i - 1))}
          disabled={ejIdx === 0}
          className="flex items-center gap-1 px-4 py-3 rounded-xl text-sm font-medium"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: ejIdx === 0 ? 'var(--text-muted)' : 'var(--text)',
          }}
        >
          <ChevronLeft size={16} /> Anterior
        </button>
        <button
          onClick={avanzar}
          disabled={!todosEjHechos}
          className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: todosEjHechos ? 'rgb(168,85,247)' : 'rgba(168,85,247,0.3)' }}
        >
          {ejIdx === ejercicios.length - 1 ? 'Finalizar sesión' : 'Siguiente'} <ChevronRight size={16} />
        </button>
      </div>

      {/* Modal registro set */}
      {setActivo && (
        <SetRegistroSheet
          setNum={setActivo.setIdx + 1}
          totalSets={sets.length}
          ejercicioNombre={ej.nombre}
          pesoSugerido={ej.peso_sugerido}
          repsSugeridas={ej.repeticiones}
          onGuardar={guardarSet}
          onCerrar={() => setSetActivo(null)}
        />
      )}
    </div>
  )
}
