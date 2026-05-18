'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { ArrowLeft, Plus, Trash2, Search, X, StickyNote, Calendar } from 'lucide-react'
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
  orden: number
  ejercicio: { id: string; nombre: string; grupo_muscular: string; tipo: string }
}

interface SesionLocal {
  id: string
  nombre: string
  dia_semana: string
  orden: number
  notas: string
  ejercicios: EjercicioEnSesion[]
}

export default function EditarEntrenoPage() {
  const { id } = useParams<{ id: string }>()
  const [plan, setPlan] = useState<PlanEntrenamiento | null>(null)
  const [sesiones, setSesiones] = useState<SesionLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [sesionActiva, setSesionActiva] = useState<string | null>(null)
  const [searchAbierto, setSearchAbierto] = useState(false)
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Ejercicio[]>([])
  const [notasAbiertas, setNotasAbiertas] = useState<Set<string>>(new Set())

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
      ejercicios: ((s as { ejercicios: SesionLocal['ejercicios'] }).ejercicios ?? []).sort((a, b) => a.orden - b.orden),
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

  const sesionActual = sesiones.find(s => s.id === sesionActiva) ?? null

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(168,85,247,0.3)', borderTopColor: 'rgb(168,85,247)' }} />
    </div>
  )

  return (
    <>
      <BackButton href="/entrenos" />

      {/* Two-panel layout — fills viewport below the mobile nav */}
      <div
        className="flex overflow-hidden pt-16 lg:pt-0"
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
              href="/entrenos"
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
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            {sesiones.map(sesion => {
              const active = sesion.id === sesionActiva
              const diaAbr = sesion.dia_semana ? (DIA_ABR[sesion.dia_semana] ?? sesion.dia_semana[0]) : String(sesion.orden + 1)
              return (
                <button
                  key={sesion.id}
                  onClick={() => setSesionActiva(sesion.id)}
                  className="w-full text-left rounded-lg px-3 py-2.5 mb-0.5 transition-all"
                  style={{
                    background: active ? 'rgba(168,85,247,0.11)' : 'transparent',
                    border: active ? '1px solid rgba(168,85,247,0.22)' : '1px solid transparent',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(168,85,247,0.05)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: active ? 'rgba(168,85,247,0.22)' : 'rgba(128,128,128,0.15)',
                        color: active ? 'rgb(192,132,252)' : 'var(--text-muted)',
                      }}
                    >
                      {diaAbr}
                    </span>
                    <span
                      className="text-sm font-medium truncate flex-1"
                      style={{ color: active ? 'rgb(192,132,252)' : 'var(--text)' }}
                    >
                      {sesion.nombre}
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5 pl-[30px]" style={{ color: active ? 'rgba(192,132,252,0.65)' : 'var(--text-muted)' }}>
                    {sesion.ejercicios.length === 0
                      ? 'Sin ejercicios'
                      : `${sesion.ejercicios.length} ejercicio${sesion.ejercicios.length !== 1 ? 's' : ''}`}
                  </p>
                </button>
              )
            })}
          </nav>

          {/* Add session */}
          <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={añadirSesion}
              className="w-full rounded-lg py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.45)'; e.currentTarget.style.color = 'rgb(192,132,252)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <Plus size={12} /> Añadir día
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
                  className="flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: active ? 'rgba(168,85,247,0.18)' : 'var(--surface)',
                    border: active ? '1px solid rgba(168,85,247,0.35)' : '1px solid var(--border)',
                    color: active ? 'rgb(192,132,252)' : 'var(--text-muted)',
                  }}
                >
                  {sesion.dia_semana ? `${DIA_ABR[sesion.dia_semana] ?? sesion.dia_semana[0]} · ${sesion.nombre}` : sesion.nombre}
                </button>
              )
            })}
            <button
              onClick={añadirSesion}
              className="flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium flex items-center gap-1"
              style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
            >
              <Plus size={11} /> Día
            </button>
          </div>

          {sesionActual ? (
            <div className="p-5 lg:p-7 max-w-2xl">
              {/* Session header */}
              <div className="flex items-start gap-3 mb-6">
                <div className="flex-1 min-w-0">
                  <input
                    className="text-xl font-bold bg-transparent border-none outline-none w-full leading-tight"
                    style={{ color: 'var(--text)' }}
                    value={sesionActual.nombre}
                    onChange={e => actualizarSesion(sesionActual.id, 'nombre', e.target.value)}
                    placeholder="Nombre de la sesión"
                  />
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                      <select
                        className="text-sm rounded-md px-2 py-1 outline-none"
                        style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'var(--surface)' }}
                        value={sesionActual.dia_semana ?? ''}
                        onChange={e => actualizarSesion(sesionActual.id, 'dia_semana', e.target.value)}
                      >
                        <option value="">Sin día fijo</option>
                        {DIAS_SEMANA.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {sesionActual.ejercicios.length} ejercicio{sesionActual.ejercicios.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => eliminarSesion(sesionActual.id)}
                  className="p-2 rounded-lg mt-1 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'rgb(248,113,113)'; e.currentTarget.style.background = 'rgba(239,68,68,0.07)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                  title="Eliminar sesión"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Exercise cards */}
              <div className="flex flex-col gap-2 mb-4">
                {sesionActual.ejercicios.length === 0 && (
                  <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                    Añade el primer ejercicio
                  </p>
                )}
                {sesionActual.ejercicios.map((ej, idx) => (
                  <div
                    key={ej.id}
                    className="rounded-xl"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start gap-3 px-4 py-3">
                      {/* Number */}
                      <span
                        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold mt-0.5"
                        style={{ background: 'rgba(168,85,247,0.12)', color: 'rgb(168,85,247)' }}
                      >
                        {idx + 1}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Name + tags */}
                        <div className="flex items-center gap-2 flex-wrap mb-2.5">
                          <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                            {ej.ejercicio?.nombre}
                          </span>
                          {ej.ejercicio?.grupo_muscular && (
                            <span className="badge badge-gray text-[11px]">{ej.ejercicio.grupo_muscular}</span>
                          )}
                          {ej.ejercicio?.tipo && (
                            <span className={`badge ${TIPO_COLORS[ej.ejercicio.tipo] ?? 'badge-gray'} text-[11px]`}>
                              {ej.ejercicio.tipo}
                            </span>
                          )}
                        </div>

                        {/* Fields */}
                        <div
                          className="grid gap-2"
                          style={{ gridTemplateColumns: '1fr 1.5fr 1.5fr 1.2fr' }}
                        >
                          <div>
                            <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Series</p>
                            <input
                              type="number" min={1} max={20}
                              className="input py-1 text-sm text-center w-full"
                              value={ej.series ?? 3}
                              onChange={e => actualizarEjercicio(ej.id, 'series', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Reps / Tiempo</p>
                            <input
                              className="input py-1 text-sm text-center w-full"
                              placeholder="8-12 · 30s"
                              value={ej.repeticiones ?? ''}
                              onChange={e => actualizarEjercicio(ej.id, 'repeticiones', e.target.value)}
                            />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Descanso (s)</p>
                            <input
                              type="number" min={0}
                              className="input py-1 text-sm text-center w-full"
                              placeholder="90"
                              value={ej.descanso_segundos ?? 90}
                              onChange={e => actualizarEjercicio(ej.id, 'descanso_segundos', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Carga / RPE</p>
                            <input
                              className="input py-1 text-sm w-full"
                              placeholder="60kg"
                              value={ej.peso_sugerido ?? ''}
                              onChange={e => actualizarEjercicio(ej.id, 'peso_sugerido', e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Notes — toggled */}
                        {notasAbiertas.has(ej.id) && (
                          <input
                            className="input py-1.5 text-sm w-full mt-2"
                            placeholder="Técnica, cues, sustituciones…"
                            value={ej.notas ?? ''}
                            onChange={e => actualizarEjercicio(ej.id, 'notas', e.target.value)}
                            autoFocus
                          />
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1 mt-0.5">
                        <button
                          onClick={() => toggleNotas(ej.id)}
                          className="p-1.5 rounded-md transition-colors"
                          title="Notas técnicas"
                          style={{
                            color: (ej.notas || notasAbiertas.has(ej.id)) ? 'rgb(168,85,247)' : 'var(--text-muted)',
                            background: notasAbiertas.has(ej.id) ? 'rgba(168,85,247,0.09)' : 'transparent',
                          }}
                        >
                          <StickyNote size={13} />
                        </button>
                        <button
                          onClick={() => eliminarEjercicio(ej.id)}
                          className="p-1.5 rounded-md transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'rgb(248,113,113)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add exercise — search */}
              {searchAbierto ? (
                <div className="relative">
                  <div
                    className="flex items-center rounded-xl overflow-hidden"
                    style={{
                      border: '1px solid rgb(168,85,247)',
                      boxShadow: '0 0 0 3px rgba(168,85,247,0.1)',
                      background: 'var(--surface)',
                    }}
                  >
                    <Search size={14} className="ml-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <input
                      autoFocus
                      className="flex-1 px-3 py-2.5 outline-none text-sm bg-transparent"
                      style={{ color: 'var(--text)' }}
                      placeholder="Buscar ejercicio — sentadilla, swing, HYROX…"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                    />
                    <button
                      onClick={() => { setSearchAbierto(false); setQuery(''); setResultados([]) }}
                      className="px-3 py-2.5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {resultados.length > 0 && (
                    <div
                      className="absolute z-20 left-0 right-0 mt-1.5 rounded-xl overflow-hidden"
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        boxShadow: '0 12px 36px rgba(0,0,0,0.22)',
                      }}
                    >
                      {resultados.map(ej => (
                        <button
                          key={ej.id}
                          onClick={() => añadirEjercicio(ej)}
                          className="w-full text-left px-4 py-3 transition-colors last:border-0 flex items-center gap-3"
                          style={{ borderBottom: '1px solid var(--border)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.07)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span className="font-medium text-sm flex-1" style={{ color: 'var(--text)' }}>{ej.nombre}</span>
                          {ej.grupo_muscular && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{ej.grupo_muscular}</span>
                          )}
                          {ej.tipo && (
                            <span className={`badge ${TIPO_COLORS[ej.tipo] ?? 'badge-gray'} text-xs`}>{ej.tipo}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => { setSearchAbierto(true); setQuery('') }}
                  className="w-full rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
                  style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.45)'; e.currentTarget.style.color = 'rgb(192,132,252)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                >
                  <Plus size={15} /> Añadir ejercicio
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-64">
              <div className="text-center">
                <p className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>Sin sesiones</p>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Crea el primer día de entrenamiento</p>
                <button onClick={añadirSesion} className="btn-primary flex items-center gap-2 mx-auto">
                  <Plus size={15} /> Añadir día
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
