'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { ArrowLeft, Plus, Trash2, Search, X, StickyNote, Calendar, Video } from 'lucide-react'
import { DIAS_SEMANA } from '@/lib/utils'
import { PlanEntrenamiento, Ejercicio } from '@/types'

const DIA_ABR: Record<string, string> = {
  'Lunes': 'L', 'Martes': 'M', 'Miércoles': 'X', 'Jueves': 'J',
  'Viernes': 'V', 'Sábado': 'S', 'Domingo': 'D',
}

const TIPO_COLORS: Record<string, string> = {
  fuerza: 'badge-purple', cardio: 'badge-orange', flexibilidad: 'badge-blue', funcional: 'badge-green',
}

interface EjercicioEnSesion {
  id: string
  ejercicio_id: string
  series: number
  repeticiones: string
  descanso_segundos: number
  peso_sugerido: string
  notas: string
  instruccion_ejercicio: string
  orden: number
  contexto_ia: string
  ejercicio: { id: string; nombre: string; grupo_muscular: string; tipo: string; foto_url?: string | null; video_url?: string | null }
}

interface SesionLocal {
  id: string
  nombre: string
  dia_semana: string
  orden: number
  notas: string
  instruccion_coach: string
  contexto_ia: string
  ejercicios: EjercicioEnSesion[]
}

export default function EditarEntrenoPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const backHref = searchParams.get('returnTo') ?? '/entrenos'
  const [plan, setPlan] = useState<PlanEntrenamiento | null>(null)
  const [sesiones, setSesiones] = useState<SesionLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [sesionActiva, setSesionActiva] = useState<string | null>(null)
  const [searchAbierto, setSearchAbierto] = useState(false)
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Ejercicio[]>([])
  const [notasAbiertas, setNotasAbiertas] = useState<Set<string>>(new Set())
  const [instruccionesAbiertas, setInstruccionesAbiertas] = useState<Set<string>>(new Set())
  const [generandoCtx, setGenerandoCtx] = useState<string | null>(null)

  useEffect(() => { loadPlan() }, [id])

  async function loadPlan() {
    const [planRes, sesionesRes] = await Promise.all([
      supabase.from('planes_entrenamiento')
        .select('*, cliente:clientes(id, profile:profiles!profile_id(nombre, apellidos))')
        .eq('id', id).single(),
      supabase.from('sesiones_entrenamiento')
        .select('*, ejercicios:sesion_ejercicios(*, ejercicio:ejercicios(*))')
        .eq('plan_id', id).order('orden'),
    ])
    setPlan(planRes.data)
    const data = (sesionesRes.data ?? []).map(s => ({
      ...s,
      instruccion_coach: (s as Record<string, unknown>).instruccion_coach as string ?? '',
      contexto_ia: (s as Record<string, unknown>).contexto_ia as string ?? '',
      ejercicios: ((s as { ejercicios: SesionLocal['ejercicios'] }).ejercicios ?? [])
        .sort((a, b) => a.orden - b.orden)
        .map(e => ({
          ...e,
          contexto_ia: ((e as unknown as Record<string, unknown>).contexto_ia as string) ?? '',
          instruccion_ejercicio: ((e as unknown as Record<string, unknown>).instruccion_ejercicio as string) ?? '',
        })),
    }))
    setSesiones(data)
    if (data.length > 0) setSesionActiva(data[0].id)
    setLoading(false)
  }

  useEffect(() => {
    if (!query || query.length < 2) { setResultados([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('ejercicios').select('*').ilike('nombre', `%${query}%`).limit(12)
      setResultados(data ?? [])
    }, 280)
    return () => clearTimeout(t)
  }, [query])

  async function añadirSesion() {
    const { data } = await supabase.from('sesiones_entrenamiento').insert({
      plan_id: id,
      nombre: `Día ${sesiones.length + 1}`,
      orden: sesiones.length,
      dia_semana: DIAS_SEMANA[sesiones.length % 7],
    }).select().single()
    if (data) {
      const nueva = { ...data, ejercicios: [] }
      setSesiones(prev => [...prev, nueva])
      setSesionActiva(data.id)
    }
  }

  async function eliminarSesion(sesionId: string) {
    await supabase.from('sesiones_entrenamiento').delete().eq('id', sesionId)
    setSesiones(prev => {
      const next = prev.filter(s => s.id !== sesionId)
      if (sesionActiva === sesionId) setSesionActiva(next[0]?.id ?? null)
      return next
    })
  }

  async function actualizarSesion(sesionId: string, field: string, value: string) {
    setSesiones(prev => prev.map(s => s.id === sesionId ? { ...s, [field]: value } : s))
    await supabase.from('sesiones_entrenamiento').update({ [field]: value }).eq('id', sesionId)
  }

  async function generarContexto(sesionId: string) {
    setGenerandoCtx(sesionId)
    try {
      const res = await fetch('/api/entrenos/generar-contexto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesion_id: sesionId }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.contexto_sesion) {
        setSesiones(prev => prev.map(s =>
          s.id === sesionId ? { ...s, contexto_ia: data.contexto_sesion } : s
        ))
      }
      if (data.contextos_ejercicios?.length) {
        const ctxMap = new Map<string, string>(
          data.contextos_ejercicios.map((c: { id: string; contexto: string }) => [c.id, c.contexto])
        )
        setSesiones(prev => prev.map(s =>
          s.id === sesionId
            ? {
                ...s,
                ejercicios: s.ejercicios.map(e =>
                  ctxMap.has(e.id) ? { ...e, contexto_ia: ctxMap.get(e.id)! } : e
                ),
              }
            : s
        ))
      }
    } finally {
      setGenerandoCtx(null)
    }
  }

  async function añadirEjercicio(ejercicio: Ejercicio) {
    if (!sesionActiva) return
    const sesion = sesiones.find(s => s.id === sesionActiva)!
    const { data } = await supabase.from('sesion_ejercicios').insert({
      sesion_id: sesionActiva,
      ejercicio_id: ejercicio.id,
      series: 3, repeticiones: '8-12', descanso_segundos: 90, peso_sugerido: '', notas: '',
      orden: sesion.ejercicios.length,
    }).select().single()
    if (data) {
      setSesiones(prev => prev.map(s => s.id === sesionActiva
        ? { ...s, ejercicios: [...s.ejercicios, { ...data, ejercicio }] }
        : s
      ))
    }
    setSearchAbierto(false)
    setQuery('')
    setResultados([])
  }

  async function actualizarEjercicio(ejId: string, field: string, value: string | number) {
    if (!sesionActiva) return
    setSesiones(prev => prev.map(s => s.id === sesionActiva
      ? { ...s, ejercicios: s.ejercicios.map(e => e.id === ejId ? { ...e, [field]: value } : e) }
      : s
    ))
    await supabase.from('sesion_ejercicios').update({ [field]: value }).eq('id', ejId)
  }

  async function eliminarEjercicio(ejId: string) {
    if (!sesionActiva) return
    await supabase.from('sesion_ejercicios').delete().eq('id', ejId)
    setSesiones(prev => prev.map(s => s.id === sesionActiva
      ? { ...s, ejercicios: s.ejercicios.filter(e => e.id !== ejId) }
      : s
    ))
  }

  function toggleNotas(ejId: string) {
    setNotasAbiertas(prev => {
      const n = new Set(prev)
      n.has(ejId) ? n.delete(ejId) : n.add(ejId)
      return n
    })
  }

  function toggleInstruccion(ejId: string) {
    setInstruccionesAbiertas(prev => {
      const n = new Set(prev)
      n.has(ejId) ? n.delete(ejId) : n.add(ejId)
      return n
    })
  }

  async function moverEjercicio(ejId: string, direction: 'up' | 'down') {
    if (!sesionActiva) return
    const sesion = sesiones.find(s => s.id === sesionActiva)
    if (!sesion) return
    const idx = sesion.ejercicios.findIndex(e => e.id === ejId)
    if (idx === -1) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= sesion.ejercicios.length) return
    const reordenados = [...sesion.ejercicios]
    const [moved] = reordenados.splice(idx, 1)
    reordenados.splice(newIdx, 0, moved)
    const actualizados = reordenados.map((e, i) => ({ ...e, orden: i }))
    setSesiones(prev => prev.map(s =>
      s.id === sesionActiva ? { ...s, ejercicios: actualizados } : s
    ))
    await Promise.all(
      actualizados.map(e => supabase.from('sesion_ejercicios').update({ orden: e.orden }).eq('id', e.id))
    )
  }

  const sesionActual = sesiones.find(s => s.id === sesionActiva) ?? null

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
    </div>
  )

  return (
    <>
      <BackButton href={backHref} />

      {/* Two-panel layout — fills viewport below the mobile nav */}
      <div
        className="flex overflow-hidden pt-16 lg:pt-0 animate-fade-in"
        style={{ height: '100dvh' }}
      >
        {/* ── SIDEBAR ─────────────────────────────────────── */}
        <aside
          className="hidden lg:flex flex-col flex-shrink-0"
          style={{
            width: 248,
            borderRight: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          {/* Plan header */}
          <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <Link
              href={backHref}
              className="flex items-center gap-1.5 text-xs mb-3 opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
            >
              <ArrowLeft size={12} /> Entrenamientos
            </Link>
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
              {plan?.nombre ?? '—'}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
              {plan?.cliente?.profile?.nombre} {plan?.cliente?.profile?.apellidos}
              {plan?.duracion_semanas ? ` · ${plan.duracion_semanas}s` : ''}
            </p>
          </div>

          {/* Session list */}
          <nav className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-1">
            {sesiones.map(sesion => {
              const active = sesion.id === sesionActiva
              const diaAbr = sesion.dia_semana ? (DIA_ABR[sesion.dia_semana] ?? sesion.dia_semana[0]) : String(sesion.orden + 1)
              return (
                <button
                  key={sesion.id}
                  onClick={() => setSesionActiva(sesion.id)}
                  className="w-full text-left rounded-xl px-3 py-2.5 transition-all"
                  style={{
                    background: active ? 'var(--surface-hover)' : 'transparent',
                    border: active ? '1px solid var(--border-accent)' : '1px solid transparent',
                    boxShadow: active ? 'var(--shadow-sm)' : 'none',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-hover)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: active ? 'var(--accent-bg)' : 'var(--surface-hover)',
                        color: active ? 'var(--text)' : 'var(--text-muted)',
                        border: '1px solid ' + (active ? 'var(--border-accent)' : 'var(--border-light)'),
                      }}
                    >
                      {diaAbr}
                    </span>
                    <span
                      className="text-sm font-semibold truncate flex-1"
                      style={{ color: active ? 'var(--text)' : 'var(--text-secondary)' }}
                    >
                      {sesion.nombre}
                    </span>
                  </div>
                  <p className="text-[11px] mt-1 pl-[36px]" style={{ color: 'var(--text-muted)' }}>
                    {sesion.ejercicios.length === 0
                      ? 'Sin ejercicios'
                      : `${sesion.ejercicios.length} ejercicio${sesion.ejercicios.length !== 1 ? 's' : ''}`}
                  </p>
                </button>
              )
            })}
          </nav>

          {/* Add session */}
          <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={añadirSesion}
              className="w-full rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              style={{ border: '1px dashed var(--border-strong)', color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <Plus size={14} /> Añadir día
            </button>
          </div>
        </aside>

        {/* ── MAIN PANEL ─────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
          {/* Mobile: horizontal session scroll */}
          <div className="lg:hidden flex gap-2 px-4 py-3 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
            {sesiones.map(sesion => {
              const active = sesion.id === sesionActiva
              return (
                <button
                  key={sesion.id}
                  onClick={() => setSesionActiva(sesion.id)}
                  className="flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all"
                  style={{
                    background: active ? 'var(--accent-bg)' : 'var(--surface)',
                    border: active ? '1px solid var(--border-accent)' : '1px solid var(--border)',
                    color: active ? 'var(--text)' : 'var(--text-muted)',
                  }}
                >
                  {sesion.dia_semana ? `${DIA_ABR[sesion.dia_semana] ?? sesion.dia_semana[0]} · ${sesion.nombre}` : sesion.nombre}
                </button>
              )
            })}
            <button
              onClick={añadirSesion}
              className="flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold flex items-center gap-1"
              style={{ border: '1px dashed var(--border-strong)', color: 'var(--text-muted)' }}
            >
              <Plus size={12} /> Día
            </button>
          </div>

          {sesionActual ? (
            <div className="p-5 lg:p-8 max-w-3xl mx-auto">
              {/* Session header */}
              <div className="flex items-start justify-between mb-8">
                <div className="flex-1 min-w-0 pr-6">
                  <input
                    className="text-2xl lg:text-3xl font-bold bg-transparent border-none outline-none w-full leading-tight placeholder-opacity-40"
                    style={{ color: 'var(--text)' }}
                    value={sesionActual.nombre}
                    onChange={e => actualizarSesion(sesionActual.id, 'nombre', e.target.value)}
                    placeholder="Nombre de la sesión"
                  />
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                      <select
                        className="text-sm rounded-md px-2 py-1 outline-none font-medium appearance-none"
                        style={{ border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--surface)' }}
                        value={sesionActual.dia_semana ?? ''}
                        onChange={e => actualizarSesion(sesionActual.id, 'dia_semana', e.target.value)}
                      >
                        <option value="">Sin día fijo</option>
                        {DIAS_SEMANA.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {sesionActual.ejercicios.length} ejercicio{sesionActual.ejercicios.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => eliminarSesion(sesionActual.id)}
                  className="p-2.5 rounded-xl mt-1 transition-colors glass-btn shadow-none"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--semantic-alert)'; e.currentTarget.style.borderColor = 'rgba(192,80,80,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                  title="Eliminar sesión"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* IA Context block */}
              <div className="glass-card mb-8">
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                  Intención del Coach (Contexto IA)
                </p>
                <textarea
                  className="w-full text-sm rounded-xl px-4 py-3 resize-none outline-none mb-4 transition-colors"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: 72 }}
                  placeholder="Instrucciones para la sesión (ej: semana de descarga, foco en técnica excéntrica…)"
                  value={sesionActual.instruccion_coach}
                  onChange={e => {
                    setSesiones(prev => prev.map(s => s.id === sesionActual.id ? { ...s, instruccion_coach: e.target.value } : s))
                    supabase.from('sesiones_entrenamiento').update({ instruccion_coach: e.target.value }).eq('id', sesionActual.id)
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
                <button
                  onClick={() => generarContexto(sesionActual.id)}
                  disabled={generandoCtx === sesionActual.id}
                  className="glass-btn flex items-center gap-2 text-xs font-semibold"
                >
                  {generandoCtx === sesionActual.id ? (
                    <><span className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--text)' }} /> Generando…</>
                  ) : (
                    <>✨ Enriquecer con IA</>
                  )}
                </button>
                {sesionActual.contexto_ia && (
                  <p className="text-sm mt-4 leading-relaxed p-3 rounded-lg" style={{ color: 'var(--text-secondary)', background: 'var(--accent-bg)', border: '1px solid var(--border-accent)' }}>
                    {sesionActual.contexto_ia}
                  </p>
                )}
              </div>

              {/* Exercise cards */}
              <div className="flex flex-col gap-3 mb-6">
                {sesionActual.ejercicios.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed rounded-2xl" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-base font-medium" style={{ color: 'var(--text)' }}>El plan está vacío</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Usa el buscador para añadir tu primer ejercicio.</p>
                  </div>
                )}
                {sesionActual.ejercicios.map((ej, idx) => (
                  <div
                    key={ej.id}
                    className="glass-card group transition-all"
                    style={{ padding: '1rem 1.25rem' }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Number */}
                      <span
                        className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold mt-1"
                        style={{ background: 'var(--accent-bg)', color: 'var(--text)', border: '1px solid var(--border-accent)' }}
                      >
                        {idx + 1}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Name + tags */}
                        <div className="flex items-center gap-2.5 flex-wrap mb-3">
                          <span className="font-bold text-base" style={{ color: 'var(--text)' }}>
                            {ej.ejercicio?.nombre}
                          </span>
                          {ej.ejercicio?.grupo_muscular && (
                            <span className="badge" style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{ej.ejercicio.grupo_muscular}</span>
                          )}
                          {ej.ejercicio?.video_url && (
                            <a
                              href={ej.ejercicio.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity"
                              style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                              title="Ver demostración"
                            >
                              <Video size={12} /> Demo
                            </a>
                          )}
                        </div>

                        {/* Fields */}
                        <div
                          className="grid gap-3"
                          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}
                        >
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Series</p>
                            <input
                              type="number" min={1} max={20}
                              className="input font-data text-base font-semibold py-1.5 px-2 bg-transparent border-transparent shadow-none w-full"
                              value={ej.series ?? 3}
                              onChange={e => actualizarEjercicio(ej.id, 'series', parseInt(e.target.value) || 1)}
                              onFocus={e => e.currentTarget.style.borderBottom = '1px solid var(--accent)'}
                              onBlur={e => e.currentTarget.style.borderBottom = '1px solid transparent'}
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Reps / Tiempo</p>
                            <input
                              className="input font-data text-base font-semibold py-1.5 px-2 bg-transparent border-transparent shadow-none w-full"
                              placeholder="8-12 · 30s"
                              value={ej.repeticiones ?? ''}
                              onChange={e => actualizarEjercicio(ej.id, 'repeticiones', e.target.value)}
                              onFocus={e => e.currentTarget.style.borderBottom = '1px solid var(--accent)'}
                              onBlur={e => e.currentTarget.style.borderBottom = '1px solid transparent'}
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Descanso (s)</p>
                            <input
                              type="number" min={0}
                              className="input font-data text-base font-semibold py-1.5 px-2 bg-transparent border-transparent shadow-none w-full"
                              placeholder="90"
                              value={ej.descanso_segundos ?? 90}
                              onChange={e => actualizarEjercicio(ej.id, 'descanso_segundos', parseInt(e.target.value) || 0)}
                              onFocus={e => e.currentTarget.style.borderBottom = '1px solid var(--accent)'}
                              onBlur={e => e.currentTarget.style.borderBottom = '1px solid transparent'}
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Carga / RPE</p>
                            <input
                              className="input font-data text-base font-semibold py-1.5 px-2 bg-transparent border-transparent shadow-none w-full"
                              placeholder="60kg"
                              value={ej.peso_sugerido ?? ''}
                              onChange={e => actualizarEjercicio(ej.id, 'peso_sugerido', e.target.value)}
                              onFocus={e => e.currentTarget.style.borderBottom = '1px solid var(--accent)'}
                              onBlur={e => e.currentTarget.style.borderBottom = '1px solid transparent'}
                            />
                          </div>
                        </div>

                        {/* Notes — toggled */}
                        {notasAbiertas.has(ej.id) && (
                          <input
                            className="input py-2 text-sm w-full mt-4 bg-transparent"
                            placeholder="Técnica, cues, sustituciones…"
                            value={ej.notas ?? ''}
                            onChange={e => actualizarEjercicio(ej.id, 'notas', e.target.value)}
                            autoFocus
                          />
                        )}
                        {instruccionesAbiertas.has(ej.id) && (
                          <input
                            className="input py-2 text-sm w-full mt-4 bg-transparent border-dashed"
                            style={{ borderColor: 'var(--border-strong)' }}
                            placeholder="Nota para IA (ej: técnica estricta, controlar excéntrica…)"
                            value={ej.instruccion_ejercicio ?? ''}
                            onChange={e => actualizarEjercicio(ej.id, 'instruccion_ejercicio', e.target.value)}
                            autoFocus
                          />
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => moverEjercicio(ej.id, 'up')}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg transition-colors disabled:opacity-20 text-xs font-bold"
                          title="Subir"
                          style={{ color: 'var(--text-muted)', background: 'var(--surface-hover)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moverEjercicio(ej.id, 'down')}
                          disabled={idx === sesionActual.ejercicios.length - 1}
                          className="p-1.5 rounded-lg transition-colors disabled:opacity-20 text-xs font-bold"
                          title="Bajar"
                          style={{ color: 'var(--text-muted)', background: 'var(--surface-hover)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => toggleInstruccion(ej.id)}
                          className="p-1.5 rounded-lg transition-colors text-sm"
                          title="Nota para IA"
                          style={{
                            color: (ej.instruccion_ejercicio || instruccionesAbiertas.has(ej.id)) ? 'var(--text)' : 'var(--text-muted)',
                            background: instruccionesAbiertas.has(ej.id) ? 'var(--accent-bg)' : 'transparent',
                          }}
                        >
                          ✨
                        </button>
                        <button
                          onClick={() => toggleNotas(ej.id)}
                          className="p-1.5 rounded-lg transition-colors"
                          title="Notas técnicas"
                          style={{
                            color: (ej.notas || notasAbiertas.has(ej.id)) ? 'var(--text)' : 'var(--text-muted)',
                            background: notasAbiertas.has(ej.id) ? 'var(--accent-bg)' : 'transparent',
                          }}
                        >
                          <StickyNote size={14} />
                        </button>
                        <button
                          onClick={() => eliminarEjercicio(ej.id)}
                          className="p-1.5 rounded-lg transition-colors mt-2"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--semantic-alert)', e.currentTarget.style.background = 'var(--semantic-alert-bg)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)', e.currentTarget.style.background = 'transparent')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add exercise — search */}
              {searchAbierto ? (
                <div className="relative mb-20 animate-slide-up">
                  <div
                    className="flex items-center rounded-2xl overflow-hidden glass-card"
                    style={{
                      border: '1px solid var(--border-strong)',
                      boxShadow: '0 0 0 3px var(--accent-ring)',
                    }}
                  >
                    <Search size={16} className="ml-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <input
                      autoFocus
                      className="flex-1 px-4 py-3.5 outline-none text-base bg-transparent font-medium"
                      style={{ color: 'var(--text)' }}
                      placeholder="Buscar ejercicio — sentadilla, swing, HYROX…"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                    />
                    <button
                      onClick={() => { setSearchAbierto(false); setQuery(''); setResultados([]) }}
                      className="px-4 py-3.5 hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {resultados.length > 0 && (
                    <div
                      className="absolute z-20 left-0 right-0 mt-2 rounded-2xl overflow-hidden glass-card p-2"
                    >
                      {resultados.map(ej => (
                        <button
                          key={ej.id}
                          onClick={() => añadirEjercicio(ej)}
                          className="w-full text-left px-4 py-3 rounded-xl transition-colors flex items-center gap-3"
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span className="font-semibold text-sm flex-1" style={{ color: 'var(--text)' }}>{ej.nombre}</span>
                          {ej.grupo_muscular && (
                            <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{ej.grupo_muscular}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => { setSearchAbierto(true); setQuery('') }}
                  className="w-full rounded-2xl py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 mb-20"
                  style={{ border: '1.5px dashed var(--border-strong)', color: 'var(--text-muted)', background: 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                >
                  <Plus size={16} /> Añadir Ejercicio
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-64 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}>
                <Calendar size={24} style={{ color: 'var(--text-muted)' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Crea tu primer día</h2>
              <p className="text-sm mb-6 max-w-xs text-center leading-relaxed" style={{ color: 'var(--text-secondary)' }}>Estructura las sesiones de tu atleta por días. Puedes ordenarlas fácilmente desde la barra lateral.</p>
              <button onClick={añadirSesion} className="glass-btn flex items-center gap-2">
                <Plus size={15} /> Añadir sesión
              </button>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
