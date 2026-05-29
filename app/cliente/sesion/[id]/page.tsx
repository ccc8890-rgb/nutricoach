'use client'
import { useCallback, useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Trophy, Loader2 } from 'lucide-react'
import SesionCardMobile, { type SetData, type EjercicioCard } from '@/components/training/SesionCardMobile'

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
  plan: {
    nombre: string
    cliente_id: string
  }
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
  const [prsDetectados, setPrsDetectados] = useState<Array<{
    ejercicio_id: string
    ejercicio_nombre: string
    peso_anterior_kg: number | null
    peso_nuevo_kg: number
    reps: number
  }>>([])

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

    setSesion({
      ...data,
      plan: Array.isArray(data.plan) ? data.plan[0] : data.plan,
      ejercicios: ejerciciosSorted,
    } as SesionInfo)
    setLoading(false)
  }, [id])

  useEffect(() => { loadSesion() }, [loadSesion])

  async function registrarSesion(setsMap: Record<string, SetData[]>) {
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
          duracion_sesion_s: Math.floor((Date.now() - sesionStartRef.current) / 1000),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setPrsDetectados(data.prs ?? [])
        setGuardadoOk(true)
      }
    } catch {}
    setGuardando(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
    </div>
  )

  if (authError || !sesion) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
      <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Sesión no encontrada</p>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Esta sesión no pertenece a tu plan o ha sido eliminada.</p>
      <Link href="/cliente" className="glass-btn mt-4">Volver al portal</Link>
    </div>
  )

  if (guardadoOk) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--bg)' }}>
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'rgba(168,85,247,0.12)', border: '2px solid rgba(168,85,247,0.4)' }}
      >
        <Trophy size={36} style={{ color: 'rgb(168,85,247)' }} />
      </div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>¡Sesión completada!</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>{sesion.nombre}</p>

      {prsDetectados.length > 0 && (
        <div className="w-full max-w-sm mb-8">
          <p className="text-xs font-bold uppercase tracking-widest mb-3 text-center" style={{ color: 'rgb(168,85,247)' }}>
            🏆 Nuevos récords personales
          </p>
          <div className="flex flex-col gap-2">
            {prsDetectados.map(pr => (
              <div
                key={pr.ejercicio_id}
                className="px-4 py-3 rounded-xl flex justify-between items-center"
                style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)' }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{pr.ejercicio_nombre}</span>
                <div className="text-right">
                  <span className="text-base font-bold" style={{ color: 'rgb(168,85,247)' }}>{pr.peso_nuevo_kg} kg</span>
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
        className="w-full max-w-sm py-3 rounded-xl text-sm font-semibold text-white text-center block"
        style={{ background: 'rgb(168,85,247)' }}
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
    peso_sugerido: ej.peso_sugerido ?? '',
    instruccion_ejercicio: ej.notas ?? '',
    contexto_ia: ej.contexto_ia ?? null,
  }))

  return (
    <div className="min-h-screen flex flex-col pb-4" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
          paddingTop: 'max(env(safe-area-inset-top), 12px)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link href="/cliente" style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-label="Volver">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>{sesion.nombre}</p>
            {sesion.plan?.nombre && (
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{sesion.plan.nombre}</p>
            )}
          </div>
        </div>

        {/* Toggle pill */}
        <div
          className="flex rounded-xl overflow-hidden ml-3 flex-shrink-0"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {(['registrar', 'solo-ver'] as const).map(m => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className="px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: modo === m ? 'rgb(168,85,247)' : 'transparent',
                color: modo === m ? '#fff' : 'var(--text-muted)',
              }}
            >
              {m === 'registrar' ? 'Registrar' : 'Solo ver'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {modo === 'registrar' ? (
          guardando ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin" style={{ color: 'rgb(168,85,247)' }} />
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
                className="p-3 rounded-xl text-xs"
                style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: 'rgb(168,85,247)' }}
              >
                🤖 {sesion.contexto_ia}
              </div>
            )}
            {sesion.ejercicios.map((ej, i) => (
              <div
                key={ej.id}
                className="rounded-xl p-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'rgba(168,85,247,0.12)', color: 'rgb(168,85,247)' }}
                    >{i + 1}</span>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{ej.ejercicio?.nombre}</p>
                  </div>
                  <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {ej.series}×{ej.repeticiones}
                  </span>
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
                  <p className="text-xs mt-1 ml-7 italic" style={{ color: 'rgb(168,85,247)' }}>🤖 {ej.contexto_ia}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
