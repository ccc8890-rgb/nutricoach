'use client'
import { useCallback, useEffect, useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Barbell, Brain, CheckCircle, CircleNotch, Clock, Play, Target, Trophy } from '@phosphor-icons/react'
import SesionCardMobile, { type SetData, type EjercicioCard } from '@/components/training/SesionCardMobile'
import EjercicioDemoModal from '@/components/training/EjercicioDemoModal'
import { crearSesionGuidance } from '@/lib/training/workspace'

type Modo = 'registrar' | 'solo-ver'

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
  plan?: {
    nombre: string
    cliente_id: string
  } | null
}

export default function EjecucionSesionPage() {
  const { id } = useParams<{ id: string }>()
  const sesionStartRef = useRef(Date.now())

  const [sesion, setSesion] = useState<SesionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [modo, setModo] = useState<Modo>('registrar')
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [prsDetectados, setPrsDetectados] = useState<Array<{
    ejercicio_id: string
    ejercicio_nombre: string
    peso_anterior_kg: number | null
    peso_nuevo_kg: number
    reps: number
  }>>([])
  const [historialPesos, setHistorialPesos] = useState<Map<string, number>>(new Map())
  const [demoEjercicio, setDemoEjercicio] = useState<{
    nombre: string
    grupo_muscular: string
    video_url?: string | null
    foto_url?: string | null
    instruccion_ejercicio?: string | null
  } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('modo') === 'solo-ver') setModo('solo-ver')
  }, [])

  const loadSesion = useCallback(async () => {
    // Usar API route con service role para evitar problemas de RLS en joins anidados
    const res = await fetch(`/api/cliente/sesion/${id}`)
    if (!res.ok) {
      if (res.status === 401) { setAuthError(true) }
      else if (res.status === 403 || res.status === 404) { setAuthError(true) }
      setLoading(false)
      return
    }

    const json = await res.json().catch(() => null)
    if (!json?.sesion) { setLoading(false); return }

    const { sesion: data } = json
    const ejerciciosSorted = ((data.ejercicios as unknown as EjercicioSesion[]) ?? [])
      .sort((a: EjercicioSesion, b: EjercicioSesion) => a.orden - b.orden)

    // Pre-rellenar historial de pesos
    const ejercicioIds = ejerciciosSorted
      .map((e: EjercicioSesion) => e.ejercicio?.id)
      .filter((v: unknown): v is string => Boolean(v))
    if (ejercicioIds.length > 0) {
      try {
        const pwRes = await fetch(`/api/entrenos/historial-pesos?ejercicio_ids=${ejercicioIds.join(',')}`)
        if (pwRes.ok) {
          const histData = await pwRes.json()
          const map = new Map<string, number>()
          for (const p of histData.pesos ?? []) {
            if (p.ultimo_peso_kg != null) map.set(p.ejercicio_id, p.ultimo_peso_kg)
          }
          setHistorialPesos(map)
        }
      } catch { /* silencioso */ }
    }

    setSesion({ ...data, ejercicios: ejerciciosSorted })
    setLoading(false)
  }, [id])

  useEffect(() => { loadSesion() }, [loadSesion])

  async function registrarSesion(
    setsMap: Record<string, SetData[]>,
    meta?: { esfuerzo_percibido: number; notas: string; duracion_sesion_s: number }
  ) {
    if (!sesion) return
    setGuardando(true)
    const ejerciciosPayload = sesion.ejercicios.map(ej => ({
      sesion_ejercicio_id: ej.id,
      ejercicio_id: ej.ejercicio?.id,
      sets_ejecutados: (setsMap[ej.id] ?? []).map((s, i) => ({
        set_num: i + 1,
        peso_kg: s.kg,
        reps: s.reps,
        rpe: s.rpe,
      })),
    })).filter(ej => ej.ejercicio_id)

    try {
      const res = await fetch('/api/entrenos/registrar-sesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sesion_id: sesion.id,
          ejercicios: ejerciciosPayload,
          duracion_sesion_s: meta?.duracion_sesion_s ?? Math.floor((Date.now() - sesionStartRef.current) / 1000),
          esfuerzo_percibido: meta?.esfuerzo_percibido,
          notas: meta?.notas,
        }),
      })
      const data = await res.json().catch(() => ({ ok: false, error: 'Error al guardar la sesión' }))
      if (data.ok) {
        setPrsDetectados(data.prs ?? [])
        setGuardadoOk(true)
      } else {
        setErrorGuardado(data.error ?? 'No se pudo guardar la sesión. Inténtalo de nuevo.')
      }
    } catch {
      setErrorGuardado('Error de conexión. Comprueba tu red e inténtalo de nuevo.')
    }
    setGuardando(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <CircleNotch size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
    </div>
  )

  if (authError || !sesion) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
      <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Sesión no encontrada</p>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Esta sesión no pertenece a tu plan o ha sido eliminada.</p>
      <Link href="/cliente" replace className="glass-btn mt-4">Volver al portal</Link>
    </div>
  )

  if (guardadoOk) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: prsDetectados.length > 0 ? 'var(--semantic-active-bg)' : 'var(--bg)', animation: 'fadeIn 0.4s var(--ease-out-strong, ease-out) both' }}>
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'var(--semantic-active-bg)', border: '2px solid var(--semantic-active-border)' }}
      >
        <Trophy size={36} style={{ color: 'var(--semantic-active)' }} />
      </div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>Sesión completada</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>{sesion.nombre}</p>

      {prsDetectados.length > 0 && (
        <div className="w-full max-w-sm mb-8">
          <p className="text-xs font-bold uppercase tracking-widest mb-3 text-center" style={{ color: 'var(--semantic-active)' }}>
            Nuevos récords personales
          </p>
          <div className="flex flex-col gap-2">
            {prsDetectados.map((pr, i) => (
              <div
                key={pr.ejercicio_id}
                className="px-4 py-3 rounded-xl flex justify-between items-center"
                style={{ background: 'var(--semantic-active-bg)', border: '1px solid var(--semantic-active-border)', animation: `fadeIn 0.3s var(--ease-out-strong, ease-out) ${i * 80}ms both` }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{pr.ejercicio_nombre}</span>
                <div className="text-right">
                  <span className="text-base font-bold" style={{ color: 'var(--semantic-active)' }}>{pr.peso_nuevo_kg} kg</span>
                  {pr.peso_anterior_kg != null && (
                    <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                      (+{(pr.peso_nuevo_kg - pr.peso_anterior_kg).toFixed(1)})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/cliente"
        replace
        className="w-full max-w-sm py-3 rounded-xl text-sm font-semibold text-center block transition-transform active:scale-[0.98]"
        style={{ background: 'var(--accent)', color: 'var(--bg)' }}
      >
        Volver al portal
      </Link>
    </div>
  )

  const ejerciciosCard: EjercicioCard[] = sesion.ejercicios.map(ej => ({
    id: ej.id,
    nombre: ej.ejercicio?.nombre ?? '',
    grupo_muscular: ej.ejercicio?.grupo_muscular ?? '',
    series: ej.series ?? 3,
    repeticiones: ej.repeticiones ?? '',
    descanso_segundos: ej.descanso_segundos ?? 90,
    peso_sugerido: ej.peso_sugerido ?? '',
    instruccion_ejercicio: ej.notas ?? '',
    contexto_ia: ej.contexto_ia ?? null,
    ultimo_peso_kg: ej.ejercicio?.id ? (historialPesos.get(ej.ejercicio.id) ?? null) : null,
    video_url: ej.ejercicio?.video_url ?? null,
    foto_url: ej.ejercicio?.foto_url ?? null,
    tipo: ej.ejercicio?.tipo ?? null,
  }))

  const totalSets = sesion.ejercicios.reduce((acc, ej) => acc + (ej.series ?? 0), 0)
  const guidance = crearSesionGuidance({
    nombre: sesion.nombre,
    planNombre: sesion.plan?.nombre,
    ejerciciosCount: sesion.ejercicios.length,
    totalSets,
    hasContextoIa: Boolean(sesion.contexto_ia || sesion.ejercicios.some(ej => ej.contexto_ia)),
    hasMedia: sesion.ejercicios.some(ej => ej.ejercicio?.video_url || ej.ejercicio?.foto_url),
  })

  return (
    <div className="min-h-screen flex flex-col pb-6" style={{ background: 'var(--bg)' }}>
      <div
        className="sticky top-0 z-10 px-4 py-3"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
          paddingTop: 'max(env(safe-area-inset-top), 12px)',
        }}
      >
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              href="/cliente"
              replace
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-transform active:scale-[0.96]"
              style={{ color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}
              aria-label="Volver al portal"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
                Portal cliente · Entreno
              </p>
              <p className="truncate text-sm font-bold" style={{ color: 'var(--text)' }}>{sesion.nombre}</p>
            </div>
          </div>

          <div
            className="flex shrink-0 overflow-hidden rounded-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {(['registrar', 'solo-ver'] as const).map(m => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className="px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98]"
                style={{
                  background: modo === m ? 'var(--accent)' : 'transparent',
                  color: modo === m ? 'var(--bg)' : 'var(--text-muted)',
                }}
              >
                {m === 'registrar' ? 'Registrar' : 'Ver'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1">
        <section className="mx-auto w-full max-w-md px-4 pt-4">
          <div className="overflow-hidden rounded-[1.75rem] border" style={{ borderColor: 'var(--border)', background: 'linear-gradient(135deg, var(--surface), var(--bg-subtle))' }}>
            <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                  Sesión guiada por tu coach
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight" style={{ color: 'var(--text)' }}>{sesion.nombre}</h1>
                {sesion.plan?.nombre && (
                  <p className="mt-1 truncate text-xs" style={{ color: 'var(--text-muted)' }}>{sesion.plan.nombre}</p>
                )}
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                <Barbell size={22} />
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{guidance.coachNote}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <GuideMetric icon={<Target size={13} />} label="Bloques" value={sesion.ejercicios.length} />
              <GuideMetric icon={<CheckCircle size={13} />} label="Sets" value={totalSets} />
              <GuideMetric icon={<Clock size={13} />} label="Modo" value={modo === 'registrar' ? 'registro' : 'vista'} />
            </div>
            <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
                Cómo ejecutarlo
              </p>
              <div className="space-y-1.5">
              {guidance.clientSteps.slice(0, 3).map(step => (
                <p key={step} className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{step}</p>
              ))}
              </div>
            </div>
            </div>
            <div className="grid grid-cols-3 border-t" style={{ borderColor: 'var(--border)' }}>
              {sesion.ejercicios.slice(0, 3).map((ej, index) => (
                <div key={ej.id} className="min-w-0 border-r px-3 py-3 last:border-r-0" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-[10px] font-bold" style={{ color: 'var(--accent)' }}>Bloque {index + 1}</p>
                  <p className="mt-1 truncate text-xs font-semibold" style={{ color: 'var(--text)' }}>{ej.ejercicio?.nombre}</p>
                  <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{ej.series}×{ej.repeticiones}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {modo === 'registrar' ? (
          guardando ? (
            <div className="flex items-center justify-center py-20">
              <CircleNotch size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : errorGuardado ? (
            <div className="mx-auto mt-6 w-full max-w-md px-4">
              <div className="rounded-2xl border p-4 text-center" style={{ borderColor: 'var(--semantic-alert-border)', background: 'var(--semantic-alert-bg)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--semantic-alert)' }}>No se pudo guardar la sesión</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{errorGuardado}</p>
                <button
                  onClick={() => setErrorGuardado('')}
                  className="mt-3 rounded-xl px-4 py-2 text-xs font-semibold"
                  style={{ background: 'var(--semantic-alert)', color: 'var(--bg)' }}
                >
                  Reintentar
                </button>
              </div>
            </div>
          ) : (
            <SesionCardMobile
              ejercicios={ejerciciosCard}
              onEjercicioComplete={() => {}}
              onTodosCompletos={registrarSesion}
            />
          )
        ) : (
          /* Solo ver — flat list */
          <div className="px-4 pt-4 flex flex-col gap-3 max-w-md mx-auto">
            {sesion.contexto_ia && (
              <div
                className="p-3 rounded-xl text-xs flex gap-2"
                style={{ background: 'var(--semantic-info-bg)', border: '1px solid var(--semantic-info-border)' }}
              >
                <Brain size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--semantic-info)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>{sesion.contexto_ia}</span>
              </div>
            )}
            {sesion.ejercicios.map((ej, i) => (
              <div
                key={ej.id}
                className="rounded-xl p-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'var(--semantic-info-bg)', color: 'var(--semantic-info)', border: '1px solid var(--semantic-info-border)' }}
                    >{i + 1}</span>
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{ej.ejercicio?.nombre}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {(ej.ejercicio?.video_url || ej.ejercicio?.foto_url) && (
                      <button
                        onClick={() => setDemoEjercicio({
                          nombre: ej.ejercicio?.nombre ?? '',
                          grupo_muscular: ej.ejercicio?.grupo_muscular ?? '',
                          video_url: ej.ejercicio?.video_url,
                          foto_url: ej.ejercicio?.foto_url,
                          instruccion_ejercicio: ej.notas ?? '',
                        })}
                        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-semibold"
                        style={{ background: 'var(--semantic-info-bg)', color: 'var(--semantic-info)', border: '1px solid var(--semantic-info-border)' }}
                      >
                        <Play size={10} fill="currentColor" /> Demo
                      </button>
                    )}
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {ej.series}×{ej.repeticiones}
                    </span>
                  </div>
                </div>
                {ej.ejercicio?.grupo_muscular && (
                  <p className="text-xs mb-1 ml-7" style={{ color: 'var(--text-muted)' }}>{ej.ejercicio.grupo_muscular}</p>
                )}
                {ej.peso_sugerido && (
                  <p className="text-xs ml-7" style={{ color: 'var(--text-muted)' }}>Sugerido: {ej.peso_sugerido}</p>
                )}
                {ej.notas && (
                  <p className="text-xs mt-2 ml-7" style={{ color: 'var(--text-secondary)' }}>{ej.notas}</p>
                )}
                {ej.contexto_ia && (
                  <p className="text-xs mt-2 ml-7 flex gap-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <Brain size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--semantic-info)' }} />
                    <span>{ej.contexto_ia}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal demo — disponible en ambos modos */}
      {demoEjercicio && (
        <EjercicioDemoModal
          nombre={demoEjercicio.nombre}
          grupo_muscular={demoEjercicio.grupo_muscular}
          video_url={demoEjercicio.video_url}
          foto_url={demoEjercicio.foto_url}
          instruccion_ejercicio={demoEjercicio.instruccion_ejercicio}
          onCerrar={() => setDemoEjercicio(null)}
        />
      )}
    </div>
  )
}

function GuideMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border px-2 py-2" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>{icon}{label}</p>
      <p className="font-data mt-1 text-sm font-semibold" style={{ color: 'var(--text)' }}>{value}</p>
    </div>
  )
}
