'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CheckCircle2, Circle, RotateCcw, ChevronDown, ChevronUp, Play, Pause, Trophy, Loader2, Info, X } from 'lucide-react'
import Link from 'next/link'

interface EjercicioSesion {
  id: string
  orden: number
  series: number
  repeticiones: string
  descanso_segundos: number
  peso_sugerido: string
  notas: string
  ejercicio: {
    id: string
    nombre: string
    grupo_muscular: string
    tipo: string
    video_url?: string
  }
}

interface SesionInfo {
  id: string
  nombre: string
  dia_semana: string
  notas: string
  ejercicios: EjercicioSesion[]
  plan: {
    nombre: string
    cliente_id: string
  }
}

interface SetState {
  reps: string
  carga: string
  hecho: boolean
}

const TIMER_RING_R = 26
const RING_CIRCUMFERENCE = 2 * Math.PI * TIMER_RING_R

export default function EjecucionSesionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [sesion, setSesion] = useState<SesionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)

  // Progress: which exercise is expanded / done
  const [ejercicioActivo, setEjercicioActivo] = useState<string | null>(null)
  const [ejerciciosDone, setEjerciciosDone] = useState<Set<string>>(new Set())

  // Per-exercise set state: ejId → SetState[]
  const [sets, setSets] = useState<Record<string, SetState[]>>({})

  // Rest timer
  const [timerTotal, setTimerTotal] = useState(0)
  const [timerLeft, setTimerLeft] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Completion screen + save state
  const [showCompletion, setShowCompletion] = useState(false)
  const [esfuerzoPercibido, setEsfuerzoPercibido] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const sesionStartRef = useRef(Date.now())
  const [demoEjId, setDemoEjId] = useState<string | null>(null)

  useEffect(() => { loadSesion() }, [id])

  async function loadSesion() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAuthError(true); setLoading(false); return }

    const { data, error } = await supabase
      .from('sesiones_entrenamiento')
      .select(`
        id, nombre, dia_semana, notas,
        plan:planes_entrenamiento(nombre, cliente_id),
        ejercicios:sesion_ejercicios(
          id, orden, series, repeticiones, descanso_segundos, peso_sugerido, notas,
          ejercicio:ejercicios(id, nombre, grupo_muscular, tipo, video_url)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) { setLoading(false); return }

    // Verify session belongs to this client's plan
    const plan = Array.isArray(data.plan) ? data.plan[0] : data.plan
    if (plan?.cliente_id !== user.id) {
      // Try matching via profile
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('id')
        .eq('profile_id', user.id)
        .single()
      if (!clienteData || plan?.cliente_id !== clienteData.id) {
        setAuthError(true)
        setLoading(false)
        return
      }
    }

    const ejerciciosSorted = ((data.ejercicios as unknown as EjercicioSesion[]) ?? [])
      .sort((a, b) => a.orden - b.orden)

    const sesionData: SesionInfo = {
      ...data,
      plan: Array.isArray(data.plan) ? data.plan[0] : data.plan,
      ejercicios: ejerciciosSorted,
    }
    setSesion(sesionData)

    // Init set state for each exercise
    const setsInit: Record<string, SetState[]> = {}
    for (const ej of ejerciciosSorted) {
      setsInit[ej.id] = Array.from({ length: ej.series ?? 3 }, () => ({
        reps: '',
        carga: ej.peso_sugerido ?? '',
        hecho: false,
      }))
    }
    setSets(setsInit)
    if (ejerciciosSorted.length > 0) setEjercicioActivo(ejerciciosSorted[0].id)
    setLoading(false)
  }

  // Timer logic
  useEffect(() => {
    if (timerRunning && timerLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimerLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!)
            setTimerRunning(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerRunning, timerLeft])

  function startTimer(seconds: number) {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerTotal(seconds)
    setTimerLeft(seconds)
    setTimerRunning(true)
  }

  function toggleTimer() {
    setTimerRunning(r => !r)
  }

  function resetTimer() {
    setTimerRunning(false)
    setTimerLeft(timerTotal)
  }

  function extractYouTubeId(url: string): string | null {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?\/\s]+)/)
    return match ? match[1] : null
  }

  function marcarSet(ejId: string, setIdx: number) {
    setSets(prev => {
      const ejSets = [...(prev[ejId] ?? [])]
      ejSets[setIdx] = { ...ejSets[setIdx], hecho: !ejSets[setIdx].hecho }
      const allDone = ejSets.every(s => s.hecho)
      // Auto-start rest timer when set is completed (not un-completed)
      if (!prev[ejId][setIdx].hecho) {
        const ej = sesion?.ejercicios.find(e => e.id === ejId)
        if (ej?.descanso_segundos) startTimer(ej.descanso_segundos)
      }
      return { ...prev, [ejId]: ejSets }
    })
  }

  function actualizarSet(ejId: string, setIdx: number, field: 'reps' | 'carga', value: string) {
    setSets(prev => {
      const ejSets = [...(prev[ejId] ?? [])]
      ejSets[setIdx] = { ...ejSets[setIdx], [field]: value }
      return { ...prev, [ejId]: ejSets }
    })
  }

  function completarEjercicio(ejId: string) {
    setEjerciciosDone(prev => new Set([...prev, ejId]))
    // Find next uncompleted exercise
    if (!sesion) return
    const idx = sesion.ejercicios.findIndex(e => e.id === ejId)
    const next = sesion.ejercicios.slice(idx + 1).find(e => !ejerciciosDone.has(e.id))
    if (next) {
      setEjercicioActivo(next.id)
      // Auto-scroll hint
      setTimeout(() => {
        document.getElementById(`ej-${next.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    } else {
      // All done
      setShowCompletion(true)
    }
  }

  async function guardarSesion() {
    if (!sesion) return
    setGuardando(true)
    const duracion_sesion_s = Math.round((Date.now() - sesionStartRef.current) / 1000)
    const ejerciciosPayload = sesion.ejercicios.map(ej => ({
      sesion_ejercicio_id: ej.id,
      ejercicio_id: ej.ejercicio?.id,
      sets_ejecutados: (sets[ej.id] ?? []).map((s, idx) => ({
        set_num: idx + 1,
        reps: s.reps ? parseInt(s.reps) : undefined,
        peso_kg: s.carga ? parseFloat(s.carga) : undefined,
      })).filter(s => s.reps != null || s.peso_kg != null),
    })).filter(ej => ej.ejercicio_id)
    try {
      await fetch('/api/entrenos/registrar-sesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sesion_id: id,
          ejercicios: ejerciciosPayload,
          duracion_sesion_s,
          esfuerzo_percibido: esfuerzoPercibido ?? undefined,
        }),
      })
      setGuardadoOk(true)
    } catch {
      // silent — session still shown as complete
    } finally {
      setGuardando(false)
    }
  }

  const setsHechos = (ejId: string) => (sets[ejId] ?? []).filter(s => s.hecho).length
  const totalEjercicios = sesion?.ejercicios.length ?? 0
  const completados = ejerciciosDone.size
  const progressPct = totalEjercicios > 0 ? (completados / totalEjercicios) * 100 : 0

  const timerPct = timerTotal > 0 ? timerLeft / timerTotal : 0
  const ringOffset = RING_CIRCUMFERENCE * (1 - timerPct)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'rgba(168,85,247,0.3)', borderTopColor: 'rgb(168,85,247)' }} />
    </div>
  )

  if (authError) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
      <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Sesión no encontrada</p>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Esta sesión no pertenece a tu plan.</p>
      <Link href="/cliente" className="btn-primary">Volver al portal</Link>
    </div>
  )

  if (!sesion) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
      <p style={{ color: 'var(--text-muted)' }}>No se encontró la sesión.</p>
      <Link href="/cliente" className="btn-secondary">Volver</Link>
    </div>
  )

  // Completion screen
  if (showCompletion) {
    const totalVolumen = sesion.ejercicios.reduce((acc, ej) => {
      const ejSets = sets[ej.id] ?? []
      return acc + ejSets.reduce((s, set) => {
        const kg = parseFloat(set.carga) || 0
        const reps = parseInt(set.reps) || 0
        return s + (kg * reps)
      }, 0)
    }, 0)
    const durMin = Math.round((Date.now() - sesionStartRef.current) / 60000)

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--bg)' }}>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: 'rgba(168,85,247,0.15)', border: '2px solid rgba(168,85,247,0.3)' }}
        >
          <Trophy size={36} style={{ color: 'rgb(192,132,252)' }} />
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>¡Sesión completada!</h1>
        <p className="text-base mb-4" style={{ color: 'var(--text-muted)' }}>{sesion.nombre}</p>

        {/* Stats */}
        <div className="flex gap-4 mb-6">
          {[
            { label: 'Ejercicios', value: totalEjercicios },
            { label: 'Duración', value: `${durMin} min` },
            ...(totalVolumen > 0 ? [{ label: 'Volumen', value: `${Math.round(totalVolumen)} kg` }] : []),
          ].map(stat => (
            <div key={stat.label} className="flex flex-col items-center">
              <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>{stat.value}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{stat.label}</span>
            </div>
          ))}
        </div>

        {/* RPE selector */}
        {!guardadoOk && (
          <div className="w-full max-w-xs mb-6">
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>
              ¿Cómo fue el esfuerzo? <span style={{ color: 'var(--text-muted)' }}>(opcional)</span>
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  onClick={() => setEsfuerzoPercibido(esfuerzoPercibido === n ? null : n)}
                  className="rounded-xl py-2.5 text-sm font-bold transition-all"
                  style={esfuerzoPercibido === n
                    ? { background: 'rgb(168,85,247)', color: 'white' }
                    : { background: 'rgba(128,128,128,0.1)', color: 'var(--text-muted)' }
                  }
                >
                  {n}
                </button>
              ))}
            </div>
            {esfuerzoPercibido && (
              <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
                {esfuerzoPercibido <= 3 ? 'Muy ligero' : esfuerzoPercibido <= 5 ? 'Moderado' : esfuerzoPercibido <= 7 ? 'Intenso' : esfuerzoPercibido <= 9 ? 'Muy intenso' : 'Máximo esfuerzo'}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 w-full max-w-xs">
          {!guardadoOk ? (
            <button
              onClick={async () => { await guardarSesion(); router.push('/cliente') }}
              disabled={guardando}
              className="btn-primary flex items-center justify-center gap-2"
            >
              {guardando ? <><Loader2 size={16} className="animate-spin" />Guardando…</> : 'Guardar y volver'}
            </button>
          ) : (
            <Link href="/cliente" className="btn-primary text-center">Volver al portal</Link>
          )}
          <button
            onClick={() => { setShowCompletion(false); setEjerciciosDone(new Set()); setEjercicioActivo(sesion.ejercicios[0]?.id ?? null); sesionStartRef.current = Date.now() }}
            className="btn-secondary"
          >
            Repetir sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 pt-safe-top"
        style={{
          background: 'rgba(168,85,247,0.08)',
          borderBottom: '1px solid rgba(168,85,247,0.18)',
          backdropFilter: 'blur(12px)',
          paddingTop: 'max(env(safe-area-inset-top), 12px)',
          paddingBottom: 12,
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <Link href="/cliente" className="p-2 rounded-lg transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base truncate" style={{ color: 'var(--text)' }}>{sesion.nombre}</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {sesion.plan?.nombre}
              {sesion.dia_semana ? ` · ${sesion.dia_semana}` : ''}
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums" style={{ color: 'rgb(192,132,252)' }}>
            {completados}/{totalEjercicios}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(168,85,247,0.15)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, background: 'rgb(168,85,247)' }}
          />
        </div>
      </div>

      {/* Exercise list */}
      <div className="px-4 pt-4 flex flex-col gap-3 max-w-lg mx-auto">
        {sesion.ejercicios.map((ej, idx) => {
          const isDone = ejerciciosDone.has(ej.id)
          const isActive = ej.id === ejercicioActivo
          const ejSets = sets[ej.id] ?? []
          const setsCompletados = ejSets.filter(s => s.hecho).length
          const todosSets = ejSets.every(s => s.hecho) && ejSets.length > 0

          return (
            <div
              key={ej.id}
              id={`ej-${ej.id}`}
              className="rounded-2xl overflow-hidden transition-all"
              style={{
                background: 'var(--surface)',
                border: isDone
                  ? '1px solid rgba(34,197,94,0.25)'
                  : isActive
                    ? '1px solid rgba(168,85,247,0.3)'
                    : '1px solid var(--border)',
                opacity: isDone ? 0.7 : 1,
              }}
            >
              {/* Exercise header */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                onClick={() => setEjercicioActivo(isActive ? null : ej.id)}
              >
                {/* Status icon */}
                {isDone ? (
                  <CheckCircle2 size={20} style={{ color: 'rgb(34,197,94)', flexShrink: 0 }} />
                ) : (
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold"
                    style={{
                      background: isActive ? 'rgba(168,85,247,0.18)' : 'rgba(128,128,128,0.12)',
                      color: isActive ? 'rgb(192,132,252)' : 'var(--text-muted)',
                    }}
                  >
                    {idx + 1}
                  </span>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p
                      className="font-semibold text-sm"
                      style={{ color: isDone ? 'var(--text-muted)' : 'var(--text)' }}
                    >
                      {ej.ejercicio?.nombre}
                    </p>
                    {ej.ejercicio?.video_url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDemoEjId(ej.id)
                        }}
                        className="p-0.5 rounded transition-opacity hover:opacity-70"
                        style={{ color: 'rgb(168,85,247)' }}
                      >
                        <Info size={14} />
                      </button>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {[
                      ej.ejercicio?.grupo_muscular,
                      `${ej.series} series`,
                      ej.repeticiones,
                    ].filter(Boolean).join(' · ')}
                    {!isDone && ejSets.length > 0 && setsCompletados > 0 && (
                      <span style={{ color: 'rgb(168,85,247)' }}> · {setsCompletados}/{ejSets.length} sets</span>
                    )}
                  </p>
                </div>

                {isActive && !isDone ? (
                  <ChevronUp size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                ) : (
                  <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
              </button>

              {/* Expanded content */}
              {isActive && !isDone && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {/* Coach note */}
                  {ej.notas && (
                    <div className="px-4 py-2.5" style={{ background: 'rgba(168,85,247,0.05)' }}>
                      <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>💬 {ej.notas}</p>
                    </div>
                  )}

                  {/* Sets table */}
                  <div className="px-4 py-3">
                    {/* Column headers */}
                    <div className="grid grid-cols-[32px_1fr_1fr_36px] gap-2 mb-2 px-1">
                      <span />
                      <p className="text-[10px] uppercase tracking-wide text-center" style={{ color: 'var(--text-muted)' }}>
                        Reps
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-center" style={{ color: 'var(--text-muted)' }}>
                        Carga
                      </p>
                      <span />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {ejSets.map((s, si) => (
                        <div
                          key={si}
                          className="grid grid-cols-[32px_1fr_1fr_36px] gap-2 items-center rounded-lg px-1 py-1.5 transition-colors"
                          style={{
                            background: s.hecho ? 'rgba(34,197,94,0.07)' : 'transparent',
                          }}
                        >
                          <span
                            className="text-xs font-bold text-center"
                            style={{ color: s.hecho ? 'rgb(34,197,94)' : 'var(--text-muted)' }}
                          >
                            {si + 1}
                          </span>
                          <input
                            className="input py-1.5 text-sm text-center"
                            placeholder={ej.repeticiones || '—'}
                            value={s.reps}
                            onChange={e => actualizarSet(ej.id, si, 'reps', e.target.value)}
                            style={s.hecho ? { opacity: 0.6 } : {}}
                          />
                          <input
                            className="input py-1.5 text-sm text-center"
                            placeholder={ej.peso_sugerido || '—'}
                            value={s.carga}
                            onChange={e => actualizarSet(ej.id, si, 'carga', e.target.value)}
                            style={s.hecho ? { opacity: 0.6 } : {}}
                          />
                          <button
                            onClick={() => marcarSet(ej.id, si)}
                            className="flex items-center justify-center"
                          >
                            {s.hecho ? (
                              <CheckCircle2 size={20} style={{ color: 'rgb(34,197,94)' }} />
                            ) : (
                              <Circle size={20} style={{ color: 'var(--text-muted)' }} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Complete exercise button */}
                  <div className="px-4 pb-4 pt-2">
                    <button
                      onClick={() => completarEjercicio(ej.id)}
                      disabled={!todosSets && ejSets.length > 0}
                      className="w-full rounded-xl py-3 text-sm font-semibold transition-all"
                      style={{
                        background: todosSets ? 'rgba(168,85,247,0.9)' : 'rgba(128,128,128,0.12)',
                        color: todosSets ? 'white' : 'var(--text-muted)',
                        cursor: todosSets ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {todosSets ? '✓ Ejercicio completado' : `Completa los ${ejSets.length - setsCompletados} sets restantes`}
                    </button>
                    {!todosSets && ejSets.length > 0 && (
                      <button
                        onClick={() => completarEjercicio(ej.id)}
                        className="w-full mt-1.5 text-xs py-1.5 transition-opacity hover:opacity-70"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Saltar ejercicio →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── REST TIMER — sticky bottom ─────────────────── */}
      {timerTotal > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 flex items-center justify-center gap-5 px-6 py-4"
          style={{
            background: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* SVG ring */}
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={TIMER_RING_R} fill="none" stroke="rgba(168,85,247,0.15)" strokeWidth="4" />
              <circle
                cx="32" cy="32" r={TIMER_RING_R}
                fill="none"
                stroke={timerLeft <= 5 ? 'rgb(248,113,113)' : 'rgb(168,85,247)'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
              />
            </svg>
            <span
              className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums"
              style={{ color: timerLeft <= 5 ? 'rgb(248,113,113)' : 'var(--text)' }}
            >
              {timerLeft}
            </span>
          </div>

          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {timerRunning ? 'Descansando…' : timerLeft > 0 ? 'Temporizador en pausa' : '¡Listo para el siguiente set!'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {timerLeft} s restantes · {timerTotal} s total
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={resetTimer}
              className="p-2.5 rounded-xl transition-colors"
              style={{ background: 'rgba(128,128,128,0.1)', color: 'var(--text-muted)' }}
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={toggleTimer}
              className="p-2.5 rounded-xl transition-colors"
              style={{ background: 'rgba(168,85,247,0.15)', color: 'rgb(168,85,247)' }}
            >
              {timerRunning ? <Pause size={16} /> : <Play size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* Demo modal */}
      {demoEjId && (() => {
        const ej = sesion.ejercicios.find(e => e.id === demoEjId)
        const ejercicio = ej?.ejercicio
        if (!ejercicio) return null
        const videoUrl = ejercicio.video_url
        const youtubeId = videoUrl ? extractYouTubeId(videoUrl) : null
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" onClick={() => setDemoEjId(null)}>
            <div className="fixed inset-0 bg-black/70" />
            <div
              className="relative rounded-2xl max-w-lg w-full overflow-hidden"
              style={{ background: 'var(--surface)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{ejercicio.nombre}</p>
                  {ejercicio.grupo_muscular && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ejercicio.grupo_muscular}</p>
                  )}
                </div>
                <button
                  onClick={() => setDemoEjId(null)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X size={18} />
                </button>
              </div>
              {/* Body */}
              <div className="p-4">
                {youtubeId ? (
                  <iframe
                    width="100%"
                    height="250"
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    frameBorder="0"
                    allowFullScreen
                    className="rounded-lg"
                  />
                ) : videoUrl ? (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 underline text-sm"
                  >
                    {videoUrl}
                  </a>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin video disponible</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
