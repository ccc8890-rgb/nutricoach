'use client'
import { useEffect, useRef, useState } from 'react'
import { Brain, CheckCircle2, ChevronLeft, ChevronRight, Circle, History, Pause, Play, RotateCcw, Save } from 'lucide-react'
import SetRegistroSheet from './SetRegistroSheet'
import EjercicioDemoModal from './EjercicioDemoModal'
import { crearSessionExecutionSummary, crearSessionProgressSummary } from '@/lib/training/session-progress'

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
  descanso_segundos?: number
  peso_sugerido: string
  instruccion_ejercicio: string
  contexto_ia: string | null
  ultimo_peso_kg?: number | null
  video_url?: string | null
  foto_url?: string | null
}

interface Props {
  ejercicios: EjercicioCard[]
  onEjercicioComplete: (ejId: string, sets: SetData[]) => void
  onTodosCompletos: (setsMap: Record<string, SetData[]>, meta?: { esfuerzo_percibido: number; notas: string; duracion_sesion_s: number }) => void
}

export default function SesionCardMobile({ ejercicios, onEjercicioComplete, onTodosCompletos }: Props) {
  const inicioRef = useRef(Date.now())
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
  const [demoAbierto, setDemoAbierto] = useState(false)
  const [restLeft, setRestLeft] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [rpeGlobal, setRpeGlobal] = useState(7)
  const [notasFinales, setNotasFinales] = useState('')
  const [duracionFinalS, setDuracionFinalS] = useState(0)

  useEffect(() => {
    if (!timerRunning || restLeft <= 0) return
    const t = window.setInterval(() => {
      setRestLeft(v => {
        if (v <= 1) {
          setTimerRunning(false)
          return 0
        }
        return v - 1
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [timerRunning, restLeft])

  const ej = ejercicios[ejIdx]
  if (!ej) return null

  const sets = setsMap[ej.id] ?? []
  const primerSetPendiente = sets.findIndex(s => !s.hecho)
  const todosEjHechos = sets.every(s => s.hecho)
  const ejerciciosEstado = ejercicios.map((ejercicio, index) => {
    const setsEjercicio = setsMap[ejercicio.id] ?? []
    const hechosEjercicio = setsEjercicio.filter(s => s.hecho).length
    return {
      ...ejercicio,
      index,
      hechosEjercicio,
      totalEjercicio: setsEjercicio.length,
      completado: setsEjercicio.length > 0 && hechosEjercicio === setsEjercicio.length,
      activo: index === ejIdx,
    }
  })

  const totalSets = ejercicios.reduce((a, e) => a + e.series, 0)
  const hechos = Object.values(setsMap).flatMap(s => s).filter(s => s.hecho).length
  const progreso = totalSets > 0 ? hechos / totalSets : 0
  const progressSummary = crearSessionProgressSummary({
    totalExercises: ejercicios.length,
    currentExerciseIndex: ejIdx,
    totalSets,
    completedSets: hechos,
  })
  const descanso = ej.descanso_segundos ?? 90
  const executionSummary = crearSessionExecutionSummary({
    sets,
    descansoSegundos: descanso,
    pesoSugerido: ej.peso_sugerido,
    ultimoPesoKg: ej.ultimo_peso_kg,
  })
  const setsCompletados = Object.values(setsMap).flatMap(s => s).filter(s => s.hecho)
  const volumenTotal = Math.round(setsCompletados.reduce((acc, set) => acc + (set.kg * set.reps), 0))

  function guardarSet(kg: number, reps: number, rpe: number) {
    if (!setActivo) return
    const ejId = setActivo.ejId
    const idx = setActivo.setIdx
    const esUltimoSetEjercicio = idx >= sets.length - 1
    setSetsMap(prev => {
      const nuevosSets = prev[ejId].map((s, i) =>
        i === idx ? { kg, reps, rpe, hecho: true } : s
      )
      const nuevo = { ...prev, [ejId]: nuevosSets }
      if (nuevosSets.every(s => s.hecho)) onEjercicioComplete(ejId, nuevosSets)
      return nuevo
    })
    setSetActivo(null)
    if (!esUltimoSetEjercicio && descanso > 0) {
      setRestLeft(descanso)
      setTimerRunning(true)
    }
    if (esUltimoSetEjercicio && ejIdx < ejercicios.length - 1) {
      window.setTimeout(() => setEjIdx(i => Math.min(ejercicios.length - 1, i + 1)), 350)
    }
  }

  function avanzar() {
    if (ejIdx < ejercicios.length - 1) {
      setEjIdx(ejIdx + 1)
    } else {
      setDuracionFinalS(Math.max(1, Math.floor((Date.now() - inicioRef.current) / 1000)))
      setFinalizando(true)
    }
  }

  if (finalizando) {
    return (
      <div className="min-h-full px-4 py-5 flex flex-col">
        <div className="h-1 rounded-full mb-5 overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full" style={{ width: '100%', background: 'var(--semantic-active)' }} />
        </div>

        <div className="glass-card p-5 flex-1 flex flex-col">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--semantic-active-bg)', border: '1px solid var(--semantic-active-border)' }}>
            <CheckCircle2 size={26} style={{ color: 'var(--semantic-active)' }} />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>Cerrar sesión</h2>
          <p className="text-sm mt-1 mb-5" style={{ color: 'var(--text-muted)' }}>
            Revisa cómo ha ido antes de enviarlo al coach.
          </p>

          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>Sets</p>
              <p className="font-data text-2xl mt-1" style={{ color: 'var(--text)' }}>{setsCompletados.length}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>Volumen</p>
              <p className="font-data text-2xl mt-1" style={{ color: 'var(--text)' }}>{volumenTotal}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>Min</p>
              <p className="font-data text-2xl mt-1" style={{ color: 'var(--text)' }}>{Math.round(duracionFinalS / 60)}</p>
            </div>
          </div>

          <div className="mb-5">
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>RPE global de la sesión</p>
            <div className="grid grid-cols-5 gap-1.5">
              {[6, 7, 8, 9, 10].map(n => (
                <button
                  key={n}
                  onClick={() => setRpeGlobal(n)}
                  className="h-11 rounded-xl text-sm font-semibold active:scale-[0.97]"
                  style={{
                    background: rpeGlobal === n ? 'var(--accent)' : 'var(--bg)',
                    color: rpeGlobal === n ? 'var(--bg)' : 'var(--text-muted)',
                    border: `1px solid ${rpeGlobal === n ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                  aria-pressed={rpeGlobal === n}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <label className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }} htmlFor="notas-sesion">
            Notas para el coach
          </label>
          <textarea
            id="notas-sesion"
            className="input min-h-24"
            value={notasFinales}
            onChange={e => setNotasFinales(e.target.value)}
            placeholder="Sensaciones, molestias, cambios de peso, sueño..."
          />

          <div className="mt-auto pt-5 flex gap-3">
            <button
              onClick={() => setFinalizando(false)}
              className="px-4 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              Volver
            </button>
            <button
              onClick={() => onTodosCompletos(setsMap, { esfuerzo_percibido: rpeGlobal, notas: notasFinales, duracion_sesion_s: duracionFinalS })}
              className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              <Save size={16} /> Guardar sesión
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100%' }}>
      {/* Barra progreso global */}
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        <div className="overflow-hidden rounded-3xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="px-4 pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
                  Bloques de entrenamiento
                </p>
                <p className="mt-0.5 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {progressSummary.percent}% completado
                </p>
              </div>
              <p className="font-data text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {hechos}/{totalSets} sets
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--bg-subtle)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progreso * 100}%`, background: 'var(--semantic-active)' }}
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none]">
            {ejerciciosEstado.map(item => (
              <button
                key={item.id}
                onClick={() => setEjIdx(item.index)}
                className="min-w-[154px] rounded-2xl border px-3 py-3 text-left transition-all active:scale-[0.98]"
                style={{
                  borderColor: item.activo
                    ? 'var(--accent)'
                    : item.completado
                      ? 'var(--semantic-active-border)'
                      : 'var(--border)',
                  background: item.activo
                    ? 'rgba(201,169,110,0.12)'
                    : item.completado
                      ? 'var(--semantic-active-bg)'
                      : 'var(--bg)',
                }}
                aria-current={item.activo ? 'step' : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-xl text-xs font-bold"
                    style={{
                      background: item.completado ? 'var(--semantic-active-border)' : item.activo ? 'var(--accent)' : 'var(--surface)',
                      color: item.completado ? 'var(--semantic-active)' : item.activo ? 'var(--bg)' : 'var(--text-muted)',
                      border: `1px solid ${item.activo ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    {item.completado ? <CheckCircle2 size={14} /> : item.index + 1}
                  </span>
                  <span className="font-data text-[11px]" style={{ color: item.completado ? 'var(--semantic-active)' : 'var(--text-muted)' }}>
                    {item.hechosEjercicio}/{item.totalEjercicio}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-semibold leading-snug" style={{ color: 'var(--text)' }}>
                  {item.nombre}
                </p>
                <p className="mt-1 truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {item.grupo_muscular || 'Ejercicio'} · {item.series}×{item.repeticiones}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Card del ejercicio */}
      <div className="mx-auto mt-4 w-full max-w-md px-4">
        <div className="rounded-3xl p-5 flex-1 flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="mb-4 rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                {progressSummary.phase.replace('_', ' ')}
              </p>
              <p className="font-data text-xs font-semibold" style={{ color: 'var(--text)' }}>
                {progressSummary.percent}% · {hechos}/{totalSets} sets
              </p>
            </div>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {progressSummary.message}
            </p>
          </div>
          <div className="flex items-start justify-between mb-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{ej.grupo_muscular}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--semantic-info-bg)', color: 'var(--semantic-info)', border: '1px solid var(--semantic-info-border)' }}>
              {ej.series}×{ej.repeticiones}
            </span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{ej.nombre}</h2>
            {(ej.video_url || ej.foto_url) && (
              <button
                onClick={() => setDemoAbierto(true)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full flex-shrink-0 ml-2 font-semibold transition-transform active:scale-[0.97]"
                style={{ background: 'var(--semantic-info-bg)', color: 'var(--semantic-info)', border: '1px solid var(--semantic-info-border)' }}
                aria-label="Ver demostración"
              >
                <Play size={11} fill="currentColor" /> Demo
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mb-1">
            {ej.ultimo_peso_kg != null && ej.ultimo_peso_kg > 0 && (
              <p className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--semantic-info)' }}>
                <History size={13} /> {ej.ultimo_peso_kg} kg última vez
              </p>
            )}
            {ej.peso_sugerido && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Coach: {ej.peso_sugerido}</p>
            )}
            {descanso > 0 && (
              <p className="text-sm ml-auto font-data" style={{ color: 'var(--text-muted)' }}>Desc. {descanso}s</p>
            )}
          </div>
          {ej.contexto_ia && (
            <div className="flex gap-2 rounded-xl px-3 py-2 mb-3" style={{ background: 'var(--semantic-info-bg)', border: '1px solid var(--semantic-info-border)' }}>
              <Brain size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--semantic-info)' }} />
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{ej.contexto_ia}</p>
            </div>
          )}
          {ej.instruccion_ejercicio && (
            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{ej.instruccion_ejercicio}</p>
          )}

          <div className="mb-3 grid grid-cols-2 gap-2">
            <ExecutionMetric label="Foco" value={executionSummary.focusLabel} />
            <ExecutionMetric label="Ahora" value={executionSummary.nextSetLabel} />
            <ExecutionMetric label="Volumen" value={`${executionSummary.volumeKg} kg`} />
            <ExecutionMetric label="RPE medio" value={executionSummary.averageRpe ?? '—'} />
          </div>

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
                  className="rounded-xl py-3 flex flex-col items-center justify-center transition-all active:scale-[0.98]"
                  style={{
                    background: set.hecho ? 'var(--semantic-active-bg)' : isActive ? 'var(--semantic-info-bg)' : 'var(--bg)',
                    border: `1.5px solid ${set.hecho ? 'var(--semantic-active-border)' : isActive ? 'var(--semantic-info)' : 'var(--border)'}`,
                  }}
                  aria-label={`Set ${i + 1}${set.hecho ? ` completado: ${set.kg}kg × ${set.reps} reps` : ''}`}
                >
                  <span className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Set {i + 1}</span>
                  {set.hecho ? (
                    <>
                      <span className="text-base font-bold" style={{ color: 'var(--semantic-active)' }}>{set.kg}kg</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{set.reps} reps</span>
                    </>
                  ) : (
                    isActive
                      ? <Play size={17} fill="currentColor" style={{ color: 'var(--semantic-info)' }} />
                      : <Circle size={17} style={{ color: 'var(--border-strong)' }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {restLeft > 0 && (
        <div className="sticky bottom-[88px] mx-4 mt-3 rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>
          <div className="relative h-12 w-12 rounded-full flex items-center justify-center" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <span className="font-data text-lg" style={{ color: 'var(--text)' }}>{restLeft}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Descanso entre sets</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Respira, prepara la carga y vuelve al set activo.</p>
          </div>
          <button
            onClick={() => setTimerRunning(v => !v)}
            className="h-10 w-10 rounded-xl flex items-center justify-center active:scale-[0.96]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            aria-label={timerRunning ? 'Pausar descanso' : 'Reanudar descanso'}
          >
            {timerRunning ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
          </button>
          <button
            onClick={() => { setRestLeft(0); setTimerRunning(false) }}
            className="h-10 w-10 rounded-xl flex items-center justify-center active:scale-[0.96]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            aria-label="Cerrar descanso"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      )}

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
          className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
          style={{
            background: todosEjHechos ? 'var(--accent)' : 'var(--surface)',
            color: todosEjHechos ? 'var(--bg)' : 'var(--text-muted)',
            border: `1px solid ${todosEjHechos ? 'var(--accent)' : 'var(--border)'}`,
          }}
        >
          {ejIdx === ejercicios.length - 1 ? <CheckCircle2 size={16} /> : null}
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
          pesoInicialKg={ej.ultimo_peso_kg ?? undefined}
          onGuardar={guardarSet}
          onCerrar={() => setSetActivo(null)}
        />
      )}

      {/* Modal demo */}
      {demoAbierto && (
        <EjercicioDemoModal
          nombre={ej.nombre}
          grupo_muscular={ej.grupo_muscular}
          video_url={ej.video_url}
          foto_url={ej.foto_url}
          onCerrar={() => setDemoAbierto(false)}
        />
      )}
    </div>
  )
}

function ExecutionMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border px-3 py-2" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{value}</p>
    </div>
  )
}
