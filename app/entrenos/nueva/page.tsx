'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Plus, Trash2, Search, X, ChevronDown, ChevronUp, Sparkles, GripVertical } from 'lucide-react'
import Link from 'next/link'
import PlantillaEntrenoSelector from '@/components/training/PlantillaEntrenoSelector'
import type { PlantillaEntrenamiento, PlantillaSesion, PlantillaSesionEjercicio, Ejercicio } from '@/types'
import { DIAS_SEMANA } from '@/lib/utils'

interface EjercicioLocal {
  id: string                  // id temporal (uuid aleatorio)
  ejercicio_id: string
  ejercicio_nombre: string
  ejercicio_grupo: string
  ejercicio_tipo: string
  series: number
  repeticiones: string
  descanso_segundos: number
  peso_sugerido: string
  notas: string
  orden: number
}

interface SesionLocal {
  id: string                  // id temporal
  nombre: string
  dia_semana: string
  orden: number
  notas: string
  expandida: boolean
  ejercicios: EjercicioLocal[]
}

let tempCounter = 0
function tempId(prefix = 'tmp'): string {
  tempCounter++
  return `${prefix}-${Date.now()}-${tempCounter}-${Math.random().toString(36).slice(2, 7)}`
}

export default function NuevoEntrenoPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" /></div>}>
      <NuevoEntrenoForm />
    </Suspense>
  )
}

function NuevoEntrenoForm() {
  const router = useRouter()
  const params = useSearchParams()
  const clientePreseleccionado = params.get('cliente')
  const [clientes, setClientes] = useState<{ id: string; profile: { nombre: string; apellidos: string } | null }[]>([])
  const [loading, setLoading] = useState(false)
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<PlantillaEntrenamiento | null>(null)
  const [sesionesLocal, setSesionesLocal] = useState<SesionLocal[]>([])
  const [form, setForm] = useState({
    cliente_id: clientePreseleccionado ?? '',
    nombre: '',
    descripcion: '',
    duracion_semanas: '',
  })

  // Búsqueda de ejercicios
  const [busquedaAbierta, setBusquedaAbierta] = useState<string | null>(null)
  const [queryEjercicio, setQueryEjercicio] = useState('')
  const [resultados, setResultados] = useState<Ejercicio[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('clientes').select('id, profile:profiles!profile_id(nombre, apellidos)').eq('coach_id', user.id).eq('activo', true)
      setClientes((data ?? []) as unknown as { id: string; profile: { nombre: string; apellidos: string } | null }[])
    }
    load()
  }, [])

  // Búsqueda de ejercicios con debounce
  useEffect(() => {
    if (!queryEjercicio || queryEjercicio.length < 2) { setResultados([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('ejercicios').select('*').ilike('nombre', `%${queryEjercicio}%`).limit(10)
      setResultados(data ?? [])
    }, 300)
    return () => clearTimeout(timer)
  }, [queryEjercicio])

  function set(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }

  function handleSeleccionarPlantilla(p: PlantillaEntrenamiento) {
    // Si ya está seleccionada, la deseleccionamos
    if (plantillaSeleccionada?.id === p.id) {
      setPlantillaSeleccionada(null)
      setSesionesLocal([])
      return
    }

    setPlantillaSeleccionada(p)

    // Rellenar formulario
    setForm(prev => ({
      ...prev,
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      duracion_semanas: p.duracion_semanas ? String(p.duracion_semanas) : '',
    }))

    // Cargar sesiones y ejercicios en estado local para poder editarlos
    const plantillaSesiones = (p.sesiones ?? []) as PlantillaSesion[]
    const nuevasSesiones: SesionLocal[] = plantillaSesiones.map(ps => ({
      id: tempId('sesion'),
      nombre: ps.nombre,
      dia_semana: ps.dia_semana ?? '',
      orden: ps.orden,
      notas: ps.notas ?? '',
      expandida: true,
      ejercicios: ((ps.ejercicios ?? []) as PlantillaSesionEjercicio[]).map(ej => ({
        id: tempId('ej'),
        ejercicio_id: ej.ejercicio_id,
        ejercicio_nombre: ej.ejercicio?.nombre ?? '',
        ejercicio_grupo: ej.ejercicio?.grupo_muscular ?? '',
        ejercicio_tipo: ej.ejercicio?.tipo ?? '',
        series: ej.series ?? 3,
        repeticiones: ej.repeticiones ?? '8-12',
        descanso_segundos: ej.descanso_segundos ?? 90,
        peso_sugerido: ej.peso_sugerido ?? '',
        notas: ej.notas ?? '',
        orden: ej.orden,
      })),
    }))

    setSesionesLocal(nuevasSesiones)
  }

  function toggleExpandir(sesionId: string) {
    setSesionesLocal(prev => prev.map(s => s.id === sesionId ? { ...s, expandida: !s.expandida } : s))
  }

  function actualizarSesion(sesionId: string, field: string, value: string) {
    setSesionesLocal(prev => prev.map(s => s.id === sesionId ? { ...s, [field]: value } : s))
  }

  function añadirSesion() {
    setSesionesLocal(prev => [...prev, {
      id: tempId('sesion'),
      nombre: `Día ${prev.length + 1}`,
      dia_semana: DIAS_SEMANA[prev.length % 7],
      orden: prev.length,
      notas: '',
      expandida: true,
      ejercicios: [],
    }])
  }

  function eliminarSesion(sesionId: string) {
    setSesionesLocal(prev => prev.filter(s => s.id !== sesionId))
  }

  function añadirEjercicioSesion(sesionId: string, ejercicio: Ejercicio) {
    setSesionesLocal(prev => prev.map(s => {
      if (s.id !== sesionId) return s
      return {
        ...s,
        ejercicios: [...s.ejercicios, {
          id: tempId('ej'),
          ejercicio_id: ejercicio.id,
          ejercicio_nombre: ejercicio.nombre,
          ejercicio_grupo: ejercicio.grupo_muscular ?? '',
          ejercicio_tipo: ejercicio.tipo ?? '',
          series: 3,
          repeticiones: '8-12',
          descanso_segundos: 90,
          peso_sugerido: '',
          notas: '',
          orden: s.ejercicios.length,
        }],
      }
    }))
    setBusquedaAbierta(null)
    setQueryEjercicio('')
    setResultados([])
  }

  function actualizarEjercicioCampo(sesionId: string, ejId: string, field: string, value: string | number) {
    setSesionesLocal(prev => prev.map(s => s.id === sesionId
      ? { ...s, ejercicios: s.ejercicios.map(e => e.id === ejId ? { ...e, [field]: value } : e) }
      : s
    ))
  }

  function eliminarEjercicioSesion(sesionId: string, ejId: string) {
    setSesionesLocal(prev => prev.map(s => s.id === sesionId
      ? { ...s, ejercicios: s.ejercicios.filter(e => e.id !== ejId) }
      : s
    ))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // 1. Crear el plan
    const { data: plan, error } = await supabase.from('planes_entrenamiento').insert({
      coach_id: user.id,
      cliente_id: form.cliente_id || null,
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      duracion_semanas: form.duracion_semanas ? parseInt(form.duracion_semanas) : null,
    }).select().single()

    if (error || !plan) {
      console.error('Error al crear plan:', error)
      setLoading(false)
      return
    }

    // 2. Crear sesiones y ejercicios desde el estado local
    for (const sesion of sesionesLocal) {
      const { data: nuevaSesion, error: sError } = await supabase
        .from('sesiones_entrenamiento')
        .insert({
          plan_id: plan.id,
          nombre: sesion.nombre,
          dia_semana: sesion.dia_semana || null,
          orden: sesion.orden,
          notas: sesion.notas || null,
        })
        .select('id')
        .single()

      if (sError || !nuevaSesion) {
        console.error('Error al crear sesión:', sError)
        continue
      }

      for (const ej of sesion.ejercicios) {
        const { error: ejError } = await supabase
          .from('sesion_ejercicios')
          .insert({
            sesion_id: nuevaSesion.id,
            ejercicio_id: ej.ejercicio_id,
            series: ej.series ?? null,
            repeticiones: ej.repeticiones || null,
            descanso_segundos: ej.descanso_segundos ?? null,
            peso_sugerido: ej.peso_sugerido || null,
            notas: ej.notas || null,
            orden: ej.orden,
          })

        if (ejError) {
          console.error(`Error al insertar ejercicio "${ej.ejercicio_nombre}":`, ejError)
        }
      }
    }

    router.push(`/entrenos/${plan.id}`)
    // no hace falta setLoading(false) porque redirige
  }

  const totalEjercicios = sesionesLocal.reduce((acc, s) => acc + s.ejercicios.length, 0)
  const TIPO_COLORS: Record<string, string> = {
    fuerza: 'badge-purple', cardio: 'badge-orange', flexibilidad: 'badge-blue', funcional: 'badge-green'
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/entrenos" className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo plan de entrenamiento</h1>
          <p className="text-gray-500 text-sm">Selecciona una plantilla o créalo desde cero</p>
        </div>
      </div>

      {/* Selector de plantillas */}
      <div className="mb-6">
        <PlantillaEntrenoSelector
          onSeleccionar={handleSeleccionarPlantilla}
          seleccionada={plantillaSeleccionada}
        />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Datos del plan */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Datos del plan</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block mb-1.5">Cliente</label>
              <select className="input" value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
                <option value="">Sin asignar (plantilla)</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.profile?.nombre} {c.profile?.apellidos}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5">Nombre del plan *</label>
              <input className="input" placeholder="Ej: Fuerza 4 días/semana" value={form.nombre} onChange={e => set('nombre', e.target.value)} required />
            </div>
            <div>
              <label className="block mb-1.5">Descripción (opcional)</label>
              <textarea className="input" rows={2} placeholder="Objetivo, metodología…" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5">Duración (semanas)</label>
              <input type="number" className="input" placeholder="8" value={form.duracion_semanas} onChange={e => set('duracion_semanas', e.target.value)} min={1} max={52} />
            </div>
          </div>
        </div>

        {/* Sesiones y ejercicios editables */}
        {sesionesLocal.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-800">
                  {sesionesLocal.length} {sesionesLocal.length === 1 ? 'sesión' : 'sesiones'} · {totalEjercicios} ejercicios
                </h2>
                <p className="text-xs text-gray-400">Modifica las sesiones antes de guardar</p>
              </div>
              {plantillaSeleccionada && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-600" />
                  <span className="text-xs font-medium text-purple-700">Plantilla aplicada</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {sesionesLocal.map((sesion) => (
                <div key={sesion.id} className="border border-gray-200 rounded-xl">
                  {/* Header sesión */}
                  <div className="flex items-center gap-3 p-4 pb-3">
                    <button onClick={() => toggleExpandir(sesion.id)}
                      className="text-gray-400 hover:text-gray-600">
                      {sesion.expandida ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    <input
                      className="font-semibold text-gray-800 bg-transparent border-none outline-none flex-1 text-base"
                      value={sesion.nombre}
                      onChange={e => actualizarSesion(sesion.id, 'nombre', e.target.value)}
                    />
                    <select
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none text-gray-600"
                      value={sesion.dia_semana}
                      onChange={e => actualizarSesion(sesion.id, 'dia_semana', e.target.value)}
                    >
                      <option value="">Sin día</option>
                      {DIAS_SEMANA.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <span className="text-sm text-gray-400">{sesion.ejercicios.length} ejercicios</span>
                    <button onClick={() => eliminarSesion(sesion.id)} className="text-gray-300 hover:text-red-400">
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {sesion.expandida && (
                    <div className="px-4 pb-4">
                      {/* Ejercicios */}
                      {sesion.ejercicios.length > 0 && (
                        <div className="mb-3 flex flex-col gap-2">
                          {sesion.ejercicios.map((ej, idx) => (
                            <div key={ej.id} className="border border-gray-100 rounded-lg p-3">
                              <div className="flex items-start gap-3">
                                <GripVertical size={16} className="text-gray-300 mt-1 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <span className="font-medium text-gray-800 text-sm">{ej.ejercicio_nombre}</span>
                                    {ej.ejercicio_grupo && (
                                      <span className="badge badge-gray text-xs">{ej.ejercicio_grupo}</span>
                                    )}
                                    {ej.ejercicio_tipo && (
                                      <span className={`badge ${TIPO_COLORS[ej.ejercicio_tipo] ?? 'badge-gray'} text-xs`}>{ej.ejercicio_tipo}</span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-4 gap-2">
                                    <div>
                                      <label className="text-xs text-gray-400 block mb-1">Series</label>
                                      <input type="number" className="input py-1 text-sm text-center" value={ej.series} min={1} max={20}
                                        onChange={e => actualizarEjercicioCampo(sesion.id, ej.id, 'series', parseInt(e.target.value) || 3)} />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-400 block mb-1">Reps</label>
                                      <input className="input py-1 text-sm text-center" placeholder="8-12" value={ej.repeticiones}
                                        onChange={e => actualizarEjercicioCampo(sesion.id, ej.id, 'repeticiones', e.target.value)} />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-400 block mb-1">Descanso</label>
                                      <input type="number" className="input py-1 text-sm text-center" placeholder="90" value={ej.descanso_segundos}
                                        onChange={e => actualizarEjercicioCampo(sesion.id, ej.id, 'descanso_segundos', parseInt(e.target.value) || 90)} />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-400 block mb-1">Peso sugerido</label>
                                      <input className="input py-1 text-sm" placeholder="ej: 60kg" value={ej.peso_sugerido}
                                        onChange={e => actualizarEjercicioCampo(sesion.id, ej.id, 'peso_sugerido', e.target.value)} />
                                    </div>
                                  </div>
                                  <input className="input py-1 text-sm mt-2" placeholder="Notas (opcional)…" value={ej.notas}
                                    onChange={e => actualizarEjercicioCampo(sesion.id, ej.id, 'notas', e.target.value)} />
                                </div>
                                <button onClick={() => eliminarEjercicioSesion(sesion.id, ej.id)} className="text-gray-300 hover:text-red-400 mt-1">
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
                          <div className="flex items-center border border-purple-400 rounded-lg overflow-hidden" style={{ boxShadow: '0 0 0 3px rgba(124,58,237,0.1)' }}>
                            <Search size={15} className="ml-3 text-gray-400 flex-shrink-0" />
                            <input
                              autoFocus
                              className="flex-1 px-3 py-2 outline-none text-sm"
                              placeholder="Buscar ejercicio… (ej: sentadilla, press banca)"
                              value={queryEjercicio}
                              onChange={e => setQueryEjercicio(e.target.value)}
                            />
                            <button onClick={() => { setBusquedaAbierta(null); setQueryEjercicio(''); setResultados([]) }} className="px-3 text-gray-400">
                              <X size={15} />
                            </button>
                          </div>
                          {resultados.length > 0 && (
                            <div className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
                              {resultados.map(ej => (
                                <button key={ej.id} onClick={() => añadirEjercicioSesion(sesion.id, ej)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-purple-50 transition-colors border-b border-gray-50 last:border-0">
                                  <span className="font-medium text-gray-800 text-sm">{ej.nombre}</span>
                                  {ej.grupo_muscular && <span className="text-xs text-gray-400 ml-2">{ej.grupo_muscular}</span>}
                                  {ej.tipo && <span className={`badge ${TIPO_COLORS[ej.tipo] ?? 'badge-gray'} text-xs ml-2`}>{ej.tipo}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setBusquedaAbierta(sesion.id); setQueryEjercicio('') }}
                          className="w-full border border-dashed border-gray-200 rounded-lg py-2.5 text-sm text-gray-400 hover:border-purple-300 hover:text-purple-600 transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus size={15} /> Añadir ejercicio
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={añadirSesion}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-gray-400 hover:border-purple-300 hover:text-purple-600 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Plus size={18} /> Añadir día de entrenamiento
              </button>
            </div>
          </div>
        )}

        {/* Botón submit */}
        <div className="flex gap-3 justify-end">
          <Link href="/entrenos" className="btn-secondary">Cancelar</Link>
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading || !form.nombre}>
            {loading ? (
              <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Creando…</>
            ) : (
              `Crear plan${sesionesLocal.length > 0 ? ` (${sesionesLocal.length} sesiones, ${totalEjercicios} ejercicios)` : ''} →`
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
