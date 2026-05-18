'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { ArrowLeft, Plus, Trash2, Search, X, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { DIAS_SEMANA } from '@/lib/utils'
import { PlanEntrenamiento, Ejercicio } from '@/types'

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
  expandida: boolean
  ejercicios: EjercicioEnSesion[]
}

export default function EditarEntrenoPage() {
  const { id } = useParams<{ id: string }>()
  const [plan, setPlan] = useState<PlanEntrenamiento | null>(null)
  const [sesiones, setSesiones] = useState<SesionLocal[]>([])
  const [loading, setLoading] = useState(true)

  const [busquedaAbierta, setBusquedaAbierta] = useState<string | null>(null)
  const [queryEjercicio, setQueryEjercicio] = useState('')
  const [resultados, setResultados] = useState<Ejercicio[]>([])

  useEffect(() => { loadPlan() }, [id])

  async function loadPlan() {
    const [planRes, sesionesRes] = await Promise.all([
      supabase.from('planes_entrenamiento').select('*, cliente:clientes(id, profile:profiles!profile_id(nombre, apellidos))').eq('id', id).single(),
      supabase.from('sesiones_entrenamiento').select('*, ejercicios:sesion_ejercicios(*, ejercicio:ejercicios(*))').eq('plan_id', id).order('orden'),
    ])
    setPlan(planRes.data)
    setSesiones((sesionesRes.data ?? []).map(s => ({
      ...s,
      expandida: true,
      ejercicios: ((s as { ejercicios: SesionLocal['ejercicios'] }).ejercicios ?? []).sort((a, b) => a.orden - b.orden)
    })))
    setLoading(false)
  }

  useEffect(() => {
    if (!queryEjercicio || queryEjercicio.length < 2) { setResultados([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('ejercicios').select('*').ilike('nombre', `%${queryEjercicio}%`).limit(10)
      setResultados(data ?? [])
    }, 300)
    return () => clearTimeout(timer)
  }, [queryEjercicio])

  async function añadirSesion() {
    const { data } = await supabase.from('sesiones_entrenamiento').insert({
      plan_id: id, nombre: `Día ${sesiones.length + 1}`, orden: sesiones.length, dia_semana: DIAS_SEMANA[sesiones.length % 7],
    }).select().single()
    if (data) setSesiones(prev => [...prev, { ...data, expandida: true, ejercicios: [] }])
  }

  async function eliminarSesion(sesionId: string) {
    await supabase.from('sesiones_entrenamiento').delete().eq('id', sesionId)
    setSesiones(prev => prev.filter(s => s.id !== sesionId))
  }

  async function actualizarSesion(sesionId: string, field: string, value: string) {
    setSesiones(prev => prev.map(s => s.id === sesionId ? { ...s, [field]: value } : s))
    await supabase.from('sesiones_entrenamiento').update({ [field]: value }).eq('id', sesionId)
  }

  async function añadirEjercicio(sesionId: string, ejercicio: Ejercicio) {
    const sesion = sesiones.find(s => s.id === sesionId)!
    const { data } = await supabase.from('sesion_ejercicios').insert({
      sesion_id: sesionId, ejercicio_id: ejercicio.id,
      series: 3, repeticiones: '8-12', descanso_segundos: 90, peso_sugerido: '', notas: '',
      orden: sesion.ejercicios.length,
    }).select().single()
    if (data) {
      setSesiones(prev => prev.map(s => s.id === sesionId
        ? { ...s, ejercicios: [...s.ejercicios, { ...data, ejercicio }] }
        : s
      ))
    }
    setBusquedaAbierta(null)
    setQueryEjercicio('')
    setResultados([])
  }

  async function actualizarEjercicio(sesionId: string, ejId: string, field: string, value: string | number) {
    setSesiones(prev => prev.map(s => s.id === sesionId
      ? { ...s, ejercicios: s.ejercicios.map(e => e.id === ejId ? { ...e, [field]: value } : e) }
      : s
    ))
    await supabase.from('sesion_ejercicios').update({ [field]: value }).eq('id', ejId)
  }

  async function eliminarEjercicio(sesionId: string, ejId: string) {
    await supabase.from('sesion_ejercicios').delete().eq('id', ejId)
    setSesiones(prev => prev.map(s => s.id === sesionId
      ? { ...s, ejercicios: s.ejercicios.filter(e => e.id !== ejId) }
      : s
    ))
  }

  const TIPO_COLORS: Record<string, string> = {
    fuerza: 'badge-purple', cardio: 'badge-orange', flexibilidad: 'badge-blue', funcional: 'badge-green'
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" /></div>

  return (
    <>
      <BackButton href="/entrenos" />
      <div className="p-6 max-w-4xl mx-auto pt-16 lg:pt-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/entrenos" className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{plan?.nombre}</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {plan?.cliente?.profile?.nombre} {plan?.cliente?.profile?.apellidos}
              {plan?.duracion_semanas && ` · ${plan.duracion_semanas} semanas`}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {sesiones.map((sesion) => (
            <div key={sesion.id} className="card">
              {/* Header sesión */}
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => setSesiones(prev => prev.map(s => s.id === sesion.id ? { ...s, expandida: !s.expandida } : s))}
                  style={{ color: 'var(--text-muted)' }}
                >
                  {sesion.expandida ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <input
                  className="font-semibold bg-transparent border-none outline-none flex-1 text-base"
                  style={{ color: 'var(--text)' }}
                  value={sesion.nombre}
                  onChange={e => actualizarSesion(sesion.id, 'nombre', e.target.value)}
                  onBlur={e => supabase.from('sesiones_entrenamiento').update({ nombre: e.target.value }).eq('id', sesion.id)}
                />
                <select
                  className="text-sm rounded-lg px-2 py-1 outline-none"
                  style={{ border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--surface)' }}
                  value={sesion.dia_semana ?? ''}
                  onChange={e => actualizarSesion(sesion.id, 'dia_semana', e.target.value)}
                >
                  <option value="">Sin día</option>
                  {DIAS_SEMANA.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{sesion.ejercicios.length} ejercicios</span>
                <button onClick={() => eliminarSesion(sesion.id)} style={{ color: 'var(--text-muted)' }} className="hover:text-red-400 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>

              {sesion.expandida && (
                <>
                  {/* Ejercicios */}
                  {sesion.ejercicios.length > 0 && (
                    <div className="mb-3 flex flex-col gap-2">
                      {sesion.ejercicios.map((ej) => (
                        <div
                          key={ej.id}
                          className="rounded-lg p-3"
                          style={{ border: '1px solid var(--border)' }}
                        >
                          <div className="flex items-start gap-3">
                            <GripVertical size={16} className="mt-1 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>{ej.ejercicio?.nombre}</span>
                                {ej.ejercicio?.grupo_muscular && (
                                  <span className="badge badge-gray text-xs">{ej.ejercicio.grupo_muscular}</span>
                                )}
                                {ej.ejercicio?.tipo && (
                                  <span className={`badge ${TIPO_COLORS[ej.ejercicio.tipo] ?? 'badge-gray'} text-xs`}>{ej.ejercicio.tipo}</span>
                                )}
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                <div>
                                  <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Series</label>
                                  <input type="number" className="input py-1 text-sm text-center" value={ej.series ?? 3} min={1} max={20}
                                    onChange={e => actualizarEjercicio(sesion.id, ej.id, 'series', parseInt(e.target.value))} />
                                </div>
                                <div>
                                  <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Reps</label>
                                  <input className="input py-1 text-sm text-center" placeholder="8-12" value={ej.repeticiones ?? ''}
                                    onChange={e => actualizarEjercicio(sesion.id, ej.id, 'repeticiones', e.target.value)} />
                                </div>
                                <div>
                                  <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Descanso</label>
                                  <input className="input py-1 text-sm text-center" placeholder="90s" value={ej.descanso_segundos ? `${ej.descanso_segundos}s` : ''}
                                    onChange={e => actualizarEjercicio(sesion.id, ej.id, 'descanso_segundos', parseInt(e.target.value) || 90)} />
                                </div>
                                <div>
                                  <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Peso sugerido</label>
                                  <input className="input py-1 text-sm" placeholder="ej: 60kg" value={ej.peso_sugerido ?? ''}
                                    onChange={e => actualizarEjercicio(sesion.id, ej.id, 'peso_sugerido', e.target.value)} />
                                </div>
                              </div>
                              <input className="input py-1 text-sm mt-2" placeholder="Notas (opcional)…" value={ej.notas ?? ''}
                                onChange={e => actualizarEjercicio(sesion.id, ej.id, 'notas', e.target.value)} />
                            </div>
                            <button
                              onClick={() => eliminarEjercicio(sesion.id, ej.id)}
                              className="mt-1 hover:text-red-400 transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Buscador de ejercicios */}
                  {busquedaAbierta === sesion.id ? (
                    <div className="relative">
                      <div
                        className="flex items-center rounded-lg overflow-hidden"
                        style={{ border: '1px solid rgb(168,85,247)', boxShadow: '0 0 0 3px rgba(168,85,247,0.12)' }}
                      >
                        <Search size={15} className="ml-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        <input
                          autoFocus
                          className="flex-1 px-3 py-2 outline-none text-sm bg-transparent"
                          style={{ color: 'var(--text)' }}
                          placeholder="Buscar ejercicio… (ej: sentadilla, press banca)"
                          value={queryEjercicio}
                          onChange={e => setQueryEjercicio(e.target.value)}
                        />
                        <button
                          onClick={() => { setBusquedaAbierta(null); setQueryEjercicio(''); setResultados([]) }}
                          className="px-3"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                      {resultados.length > 0 && (
                        <div
                          className="absolute z-10 left-0 right-0 mt-1 rounded-lg max-h-60 overflow-y-auto"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
                        >
                          {resultados.map(ej => (
                            <button
                              key={ej.id}
                              onClick={() => añadirEjercicio(sesion.id, ej)}
                              className="w-full text-left px-4 py-2.5 transition-colors last:border-0"
                              style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.1)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <span className="font-medium text-sm">{ej.nombre}</span>
                              {ej.grupo_muscular && <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{ej.grupo_muscular}</span>}
                              {ej.tipo && <span className={`badge ${TIPO_COLORS[ej.tipo] ?? 'badge-gray'} text-xs ml-2`}>{ej.tipo}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setBusquedaAbierta(sesion.id); setQueryEjercicio('') }}
                      className="w-full rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                      style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgb(168,85,247)'; e.currentTarget.style.color = 'rgb(192,132,252)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                    >
                      <Plus size={15} /> Añadir ejercicio
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          <button
            onClick={añadirSesion}
            className="w-full rounded-xl py-4 transition-colors flex items-center justify-center gap-2 font-medium"
            style={{ border: '2px dashed var(--border)', color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgb(168,85,247)'; e.currentTarget.style.color = 'rgb(192,132,252)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <Plus size={18} /> Añadir día de entrenamiento
          </button>
        </div>
      </div>
    </>)
}
