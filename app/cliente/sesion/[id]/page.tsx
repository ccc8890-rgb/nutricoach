'use client'
import { useCallback, useEffect, useState, useRef } from 'react'
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
  contexto_ia?: string | null
  ejercicio: {
    id: string
    nombre: string
    grupo_muscular: string
    tipo: string
    video_url?: string
    foto_url?: string
  }
}

interface SesionInfo {
  id: string
  nombre: string
  dia_semana: string
  notas: string
  contexto_ia?: string | null
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

  const [ejercicioActivo, setEjercicioActivo] = useState<string | null>(null)
  const [ejerciciosDone, setEjerciciosDone] = useState<Set<string>>(new Set())

  const [sets, setSets] = useState<Record<string, SetState[]>>({})

  const [timerTotal, setTimerTotal] = useState(0)
  const [timerLeft, setTimerLeft] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [showCompletion, setShowCompletion] = useState(false)
  const [esfuerzoPercibido, setEsfuerzoPercibido] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [prsDetectados, setPrsDetectados] = useState<Array<{
    ejercicio_id: string
    ejercicio_nombre: string
    peso_anterior_kg: number | null
    peso_nuevo_kg: number
    reps: number
  }>>([])
  const [duracionCompletadaMin, setDuracionCompletadaMin] = useState<number | null>(null)
  const sesionStartRef = useRef(Date.now())
  const [demoEjId, setDemoEjId] = useState<string | null>(null)

  const loadSesion = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAuthError(true); setLoading(false); return }

    const { data, error } = await supabase
      .from('sesiones_entrenamiento')
      .select(`
        id, nombre, dia_semana, notas, contexto_ia,
        plan:planes_entrenamiento(nombre, cliente_id),
        ejercicios:sesion_ejercicios(
          id, orden, series, repeticiones, descanso_segundos, peso_sugerido, notas, contexto_ia,
          ejercicio:ejercicios(id, nombre, grupo_muscular, tipo, video_url, foto_url)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) { setLoading(false); return }

    const plan = Array.isArray(data.plan) ? data.plan[0] : data.plan
    if (plan?.cliente_id !== user.id) {
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

    const ejIds = ejerciciosSorted
      .map(e => e.ejercicio?.id)
      .filter((id): id is string => Boolean(id))

    let pesoHistorial: Record<string, number | null> = {}
    if (ejIds.length > 0) {
      try {
        const res = await fetch(`/api/entrenos/historial-pesos?ejercicio_ids=${ejIds.join(',')}`)
        if (res.ok) {
          const resData = await res.json()
          for (const item of resData.pesos ?? []) {
            pesoHistorial[item.ejercicio_id] = item.ultimo_peso_kg
          }
        }
      } catch {}
    }

    const setsInit: Record<string, SetState[]> = {}
    for (const ej of ejerciciosSorted) {
      const pesoReal = ej.ejercicio?.id ? pesoHistorial[ej.ejercicio.id] : null
      const cargaInicial = pesoReal !== null && pesoReal !== undefined
        ? String(pesoReal)
        : ej.peso_sugerido ?? ''
      setsInit[ej.id] = Array.from({ length: ej.series ?? 3 }, () => ({
        reps: '',
        carga: cargaInicial,
        hecho: false,
      }))
    }
    setSets(setsInit)
    if (ejerciciosSorted.length > 0) setEjercicioActivo(ejerciciosSorted[0].id)
    setLoading(false)
  }, [id])

  useEffect(() => { loadSesion() }, [loadSesion])

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
    if (!sesion) return
    const idx = sesion.ejercicios.findIndex(e => e.id === ejId)
    const next = sesion.ejercicios.slice(idx + 1).find(e => !ejerciciosDone.has(e.id))
    if (next) {
      setEjercicioActivo(next.id)
      setTimeout(() => {
        document.getElementById(`ej-${next.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    } else {
      setDuracionCompletadaMin(Math.round((Date.now() - sesionStartRef.current) / 60000))
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
      const saveRes = await fetch('/api/entrenos/registrar-sesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sesion_id: id,
          ejercicios: ejerciciosPayload,
          duracion_sesion_s,
          esfuerzo_percibido: esfuerzoPercibido ?? undefined,
        }),
      })
      if (saveRes.ok) {
        const saveData = await saveRes.json()
        if (saveData.prs?.length) setPrsDetectados(saveData.prs)
      }
      setGuardadoOk(true)
    } catch {} finally {
      setGuardando(false)
    }
  }

  const totalEjercicios = sesion?.ejercicios.length ?? 0
  const completados = ejerciciosDone.size
  const progressPct = totalEjercicios > 0 ? (completados / totalEjercicios) * 100 : 0

  const timerPct = timerTotal > 0 ? timerLeft / timerTotal : 0
  const ringOffset = RING_CIRCUMFERENCE * (1 - timerPct)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
    </div>
  )

  if (authError || !sesion) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center animate-fade-in">
      <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Sesión no encontrada</p>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Esta sesión no pertenece a tu plan o ha sido eliminada.</p>
      <Link href="/cliente" className="glass-btn mt-4">Volver al portal</Link>
    </div>
  )

  if (showCompletion) {
    const totalVolumen = sesion.ejercicios.reduce((acc, ej) => {
      const ejSets = sets[ej.id] ?? []
      return acc + ejSets.reduce((s, set) => s + ((parseFloat(set.carga) || 0) * (parseInt(set.reps) || 0)), 0)
    }, 0)
    const durMin = duracionCompletadaMin ?? 0

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center animate-slide-up" style={{ background: 'var(--bg)' }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-glow" style={{ background: 'var(--surface-hover)', border: '2px solid var(--border-accent)' }}>
          <Trophy size={40} style={{ color: 'var(--semantic-active)' }} />
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>¡Sesión completada!</h1>
        <p className="text-base mb-8 font-medium" style={{ color: 'var(--text-secondary)' }}>{sesion.nombre}</p>

        <div className="grid grid-cols-3 gap-3 mb-8 w-full max-w-sm">
          {[
            { label: 'Ejercicios', value: totalEjercicios },
            { label: 'Duración', value: `${durMin} min` },
            ...(totalVolumen > 0 ? [{ label: 'Volumen', value: `${Math.round(totalVolumen)} kg` }] : []),
          ].map(stat => (
            <div key={stat.label} className="glass-card flex flex-col items-center p-4">
              <span className="text-2xl font-bold font-data" style={{ color: 'var(--text)' }}>{stat.value}</span>
              <span className="text-xs uppercase tracking-widest mt-1 font-bold" style={{ color: 'var(--text-muted)' }}>{stat.label}</span>
            </div>
          ))}
        </div>

        {prsDetectados.length > 0 && (
          <div className="w-full max-w-sm mb-8 animate-fade-in">
            <p className="text-xs font-bold uppercase tracking-widest mb-3 text-center" style={{ color: 'var(--semantic-warn)' }}>
              Nuevos récords personales
            </p>
            <div className="flex flex-col gap-2">
              {prsDetectados.map(pr => (
                <div key={pr.ejercicio_id} className="glass-card px-4 py-3 flex justify-between items-center" style={{ background: 'var(--semantic-warn-bg)', borderColor: 'var(--semantic-warn-border)' }}>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{pr.ejercicio_nombre}</span>
                  <div className="text-right">
                    <span className="text-base font-bold font-data" style={{ color: 'var(--semantic-warn)' }}>{pr.peso_nuevo_kg} kg</span>
                    {pr.peso_anterior_kg && (
                      <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>(+{(pr.peso_nuevo_kg - pr.peso_anterior_kg).toFixed(1)})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!guardadoOk && (
          <div className="w-full max-w-sm mb-10">
            <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>RPE - Esfuerzo Percibido</p>
            <div className="grid grid-cols-5 gap-2">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  onClick={() => setEsfuerzoPercibido(esfuerzoPercibido === n ? null : n)}
                  className="rounded-xl py-3 text-sm font-bold transition-all font-data"
                  style={esfuerzoPercibido === n
                    ? { background: 'var(--text)', color: 'var(--bg)', transform: 'scale(1.05)' }
                    : { background: 'var(--surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                  }
                >
                  {n}
                </button>
              ))}
            </div>
            {esfuerzoPercibido && (
              <p className="text-sm font-medium mt-4 text-center animate-fade-in" style={{ color: 'var(--semantic-info)' }}>
                {esfuerzoPercibido <= 3 ? 'Muy ligero' : esfuerzoPercibido <= 5 ? 'Moderado' : esfuerzoPercibido <= 7 ? 'Intenso' : esfuerzoPercibido <= 9 ? 'Muy intenso' : 'Máximo esfuerzo'}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 w-full max-w-sm">
          {!guardadoOk ? (
            <button
              onClick={async () => { await guardarSesion(); router.push('/cliente') }}
              disabled={guardando}
              className="btn-primary w-full py-4 text-base"
            >
              {guardando ? <><Loader2 size={18} className="animate-spin" /> Guardando…</> : 'Terminar sesión'}
            </button>
          ) : (
            <Link href="/cliente" className="btn-primary w-full py-4 text-base text-center">Volver al portal</Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-nav-safe" style={{ background: 'var(--bg)' }}>
      {/* Immersive Header */}
      <div
        className="sticky top-0 z-10 px-5 pt-safe-top"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--border)',
          paddingTop: 'max(env(safe-area-inset-top), 16px)',
          paddingBottom: 16,
        }}
      >
        <div className="flex items-center gap-4 mb-4">
          <Link href="/cliente" className="p-2 -ml-2 rounded-xl transition-colors glass-btn shadow-none" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg truncate leading-tight" style={{ color: 'var(--text)' }}>{sesion.nombre}</p>
            <p className="text-xs truncate font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
              {sesion.plan?.nombre} {sesion.dia_semana ? `· ${sesion.dia_semana}` : ''}
            </p>
          </div>
          <span className="text-base font-bold font-data" style={{ color: 'var(--text)' }}>
            {completados}<span style={{ color: 'var(--text-muted)' }}>/{totalEjercicios}</span>
          </span>
        </div>

        {sesion?.contexto_ia && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--accent-bg)', border: '1px solid var(--border-accent)' }}>
            <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{sesion.contexto_ia}</p>
          </div>
        )}

        {/* Progress Bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-hover)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, background: 'var(--text)' }}
          />
        </div>
      </div>

      {/* Exercise List */}
      <div className="px-5 pt-6 flex flex-col gap-4 max-w-lg mx-auto pb-40">
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
              className="glass-card overflow-hidden transition-all duration-300"
              style={{
                border: isDone
                  ? '1px solid var(--semantic-active-border)'
                  : isActive
                    ? '1px solid var(--border-strong)'
                    : '1px solid var(--border)',
                opacity: isDone ? 0.7 : 1,
                transform: isActive ? 'scale(1.01)' : 'scale(1)',
                boxShadow: isActive ? 'var(--shadow-md)' : 'none',
              }}
            >
              <button
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
                onClick={() => setEjercicioActivo(isActive ? null : ej.id)}
              >
                {isDone ? (
                  <CheckCircle2 size={24} style={{ color: 'var(--semantic-active)', flexShrink: 0 }} />
                ) : (
                  <span
                    className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-[11px] font-bold"
                    style={{
                      background: isActive ? 'var(--text)' : 'var(--surface-hover)',
                      color: isActive ? 'var(--bg)' : 'var(--text-muted)',
                    }}
                  >
                    {idx + 1}
                  </span>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-base truncate" style={{ color: isDone ? 'var(--text-muted)' : 'var(--text)' }}>
                      {ej.ejercicio?.nombre}
                    </p>
                    {ej.ejercicio?.video_url && (
                      <div
                        onClick={(e) => { e.stopPropagation(); setDemoEjId(ej.id) }}
                        className="p-1 rounded-md transition-opacity hover:opacity-70 bg-transparent border border-dashed"
                        style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-strong)' }}
                      >
                        <Info size={14} />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
                    {[
                      `${ej.series} series`,
                      ej.repeticiones,
                    ].filter(Boolean).join(' · ')}
                    {!isDone && ejSets.length > 0 && setsCompletados > 0 && (
                      <span style={{ color: 'var(--text)' }}> · {setsCompletados}/{ejSets.length} sets</span>
                    )}
                  </p>
                </div>

                {isActive && !isDone ? (
                  <ChevronUp size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                ) : (
                  <ChevronDown size={18} style={{ color: 'var(--border-strong)', flexShrink: 0 }} />
                )}
              </button>

              {isActive && !isDone && (
                <div className="px-5 pb-5 animate-slide-up" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                  {ej.notas && (
                    <div className="p-3 rounded-lg mb-4" style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>💬 {ej.notas}</p>
                    </div>
                  )}
                  {ej.contexto_ia && (
                    <div className="p-3 rounded-lg mb-4" style={{ background: 'var(--accent-bg)', border: '1px solid var(--border-accent)' }}>
                      <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--text)' }}>✨ {ej.contexto_ia}</p>
                    </div>
                  )}

                  {/* Sets table */}
                  <div className="grid grid-cols-[36px_1fr_1fr_40px] gap-2 mb-2 px-1">
                    <span />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: 'var(--text-muted)' }}>Reps</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: 'var(--text-muted)' }}>Carga</p>
                    <span />
                  </div>

                  <div className="flex flex-col gap-2">
                    {ejSets.map((s, si) => (
                      <div
                        key={si}
                        className="grid grid-cols-[36px_1fr_1fr_40px] gap-2 items-center rounded-xl px-1 py-1 transition-all duration-200"
                        style={{ background: s.hecho ? 'var(--semantic-active-bg)' : 'transparent', border: s.hecho ? '1px solid var(--semantic-active-border)' : '1px solid transparent' }}
                      >
                        <span className="text-xs font-bold text-center font-data" style={{ color: s.hecho ? 'var(--semantic-active)' : 'var(--text-muted)' }}>
                          {si + 1}
                        </span>
                        <input
                          className="input font-data text-sm font-semibold text-center py-2 bg-transparent border-transparent shadow-none"
                          placeholder={ej.repeticiones || '—'}
                          value={s.reps}
                          onChange={e => actualizarSet(ej.id, si, 'reps', e.target.value)}
                          style={s.hecho ? { opacity: 0.6 } : {}}
                          onFocus={e => e.currentTarget.style.borderBottom = '1px solid var(--accent)'}
                          onBlur={e => e.currentTarget.style.borderBottom = '1px solid transparent'}
                        />
                        <input
                          className="input font-data text-sm font-semibold text-center py-2 bg-transparent border-transparent shadow-none"
                          placeholder={ej.peso_sugerido || '—'}
                          value={s.carga}
                          onChange={e => actualizarSet(ej.id, si, 'carga', e.target.value)}
                          style={s.hecho ? { opacity: 0.6 } : {}}
                          onFocus={e => e.currentTarget.style.borderBottom = '1px solid var(--accent)'}
                          onBlur={e => e.currentTarget.style.borderBottom = '1px solid transparent'}
                        />
                        <button onClick={() => marcarSet(ej.id, si)} className="flex items-center justify-center p-2 transition-transform active:scale-90">
                          {s.hecho ? <CheckCircle2 size={24} style={{ color: 'var(--semantic-active)' }} /> : <Circle size={24} style={{ color: 'var(--border-strong)' }} />}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    <button
                      onClick={() => completarEjercicio(ej.id)}
                      disabled={!todosSets && ejSets.length > 0}
                      className="w-full rounded-2xl py-3.5 text-sm font-bold transition-all disabled:opacity-40"
                      style={{
                        background: todosSets ? 'var(--text)' : 'var(--surface-hover)',
                        color: todosSets ? 'var(--bg)' : 'var(--text-muted)',
                        cursor: todosSets ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {todosSets ? 'Siguiente Ejercicio' : `Completa los ${ejSets.length - setsCompletados} sets restantes`}
                    </button>
                    {!todosSets && ejSets.length > 0 && (
                      <button
                        onClick={() => completarEjercicio(ej.id)}
                        className="w-full mt-3 text-xs font-semibold py-2 transition-opacity hover:opacity-70"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Saltar ejercicio
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── REST TIMER (Floating Island) ─────────────────── */}
      {timerTotal > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 px-5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
        >
          <div className="max-w-lg mx-auto glass-card flex items-center justify-between gap-4 p-4 rounded-3xl shadow-lg border border-white/10" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(32px)' }}>
            <div className="relative w-14 h-14 flex-shrink-0">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r={TIMER_RING_R} fill="none" stroke="var(--surface-hover)" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r={TIMER_RING_R}
                  fill="none"
                  stroke={timerLeft <= 5 ? 'var(--semantic-alert)' : 'var(--text)'}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={ringOffset}
                  style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold font-data" style={{ color: timerLeft <= 5 ? 'var(--semantic-alert)' : 'var(--text)' }}>
                {timerLeft}
              </span>
            </div>

            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                {timerRunning ? 'Descansando…' : timerLeft > 0 ? 'En pausa' : '¡A por ello!'}
              </p>
              <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {timerLeft}s restantes
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={resetTimer} className="p-3 rounded-full transition-colors bg-transparent border" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
                <RotateCcw size={16} />
              </button>
              <button onClick={toggleTimer} className="p-3 rounded-full transition-colors shadow-glow" style={{ background: 'var(--text)', color: 'var(--bg)' }}>
                {timerRunning ? <Pause size={16} /> : <Play size={16} />}
              </button>
            </div>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center px-5 animate-fade-in" onClick={() => setDemoEjId(null)}>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
            <div className="relative rounded-3xl max-w-lg w-full overflow-hidden glass-card shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <p className="font-bold text-base" style={{ color: 'var(--text)' }}>{ejercicio.nombre}</p>
                  {ejercicio.grupo_muscular && <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{ejercicio.grupo_muscular}</p>}
                </div>
                <button onClick={() => setDemoEjId(null)} className="p-2 rounded-full transition-colors glass-btn shadow-none" style={{ color: 'var(--text-muted)' }}>
                  <X size={16} />
                </button>
              </div>
              <div className="p-6">
                {youtubeId ? (
                  <iframe width="100%" height="220" src={`https://www.youtube.com/embed/${youtubeId}`} frameBorder="0" allowFullScreen className="rounded-2xl" />
                ) : videoUrl ? (
                  <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline font-medium" style={{ color: 'var(--text)' }}>{videoUrl}</a>
                ) : ejercicio.foto_url ? (
                  <img src={ejercicio.foto_url} alt={ejercicio.nombre} className="w-full rounded-2xl object-cover max-h-64" />
                ) : (
                  <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>Sin demo disponible</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
