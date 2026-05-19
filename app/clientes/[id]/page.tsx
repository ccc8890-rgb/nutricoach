'use client'
import { useEffect, useState, lazy, Suspense } from 'react'
import dynamic from 'next/dynamic'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ClienteEditar from '@/components/ClienteEditar'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { ArrowLeft, UtensilsCrossed, Dumbbell, Weight, CalendarDays, Info, Brain, Link2, MessageSquareText, ClipboardCheck, Loader2, Zap, Bot, Trophy, CopyPlus, X, Activity, PersonStanding } from 'lucide-react'
import type { Cliente, PlanNutricion, PlanEntrenamiento, SeguimientoPeso, CheckIn, PlantillaEntrenamiento, PlantillaSesion, PlantillaSesionEjercicio } from '@/types'
import PlantillaEntrenoSelector from '@/components/training/PlantillaEntrenoSelector'
import { OBJETIVO_LABELS, NIVEL_LABELS } from '@/lib/utils'
// ── Lazy load para tabs pesadas ──
const PlanificacionCalendario = dynamic(() => import('@/components/PlanificacionCalendario'), {
  loading: () => <div className="skeleton h-64 w-full rounded-xl" />,
  ssr: false,
})
const AjusteMacrosIA = dynamic(() => import('@/components/AjusteMacrosIA'), {
  loading: () => <div className="skeleton h-48 w-full rounded-xl" />,
  ssr: false,
})
const HistorialDietasIA = dynamic(() => import('@/components/HistorialDietasIA'), {
  loading: () => <div className="skeleton h-48 w-full rounded-xl" />,
  ssr: false,
})
const ConversacionesIA = dynamic(() => import('@/components/ConversacionesIA'), {
  loading: () => <div className="skeleton h-64 w-full rounded-xl" />,
  ssr: false,
})
const ProtocoloCompeticion = dynamic(() => import('@/components/ProtocoloCompeticion'), {
  loading: () => <div className="skeleton h-64 w-full rounded-xl" />,
  ssr: false,
})
const PerfilEntrenoForm = dynamic(() => import('@/components/training/PerfilEntrenoForm'), {
  loading: () => <div className="skeleton h-48 w-full rounded-xl" />,
  ssr: false,
})
const PeriodizacionPanel = dynamic(() => import('@/components/PeriodizacionPanel'), {
  loading: () => <div className="animate-pulse h-32 rounded-xl" style={{ background: 'var(--border)' }} />,
  ssr: false,
})
const HistorialEntreno = dynamic(() => import('@/components/training/HistorialEntreno'), {
  loading: () => <div className="skeleton h-48 w-full rounded-xl" />,
  ssr: false,
})
const CompeticionesManager = dynamic(() => import('@/components/CompeticionesManager'), {
  loading: () => <div className="skeleton h-48 w-full rounded-xl" />,
  ssr: false,
})
import { useToast } from '@/components/ui/Toast'

type NotaCoachRow = {
  id: string
  cliente_id: string
  mensaje: string
  created_at: string
}

type Tab = 'informacion' | 'planificacion' | 'historial_ia' | 'conversaciones_ia' | 'ajuste_macros' | 'competicion' | 'periodizacion' | 'perfil_atleta' | 'historial_entreno'

type ClienteConExtra = Cliente & {
  fecha_proxima_revision?: string
  profile?: {
    nombre?: string
    apellidos?: string
    email?: string
    telefono?: string
  }
}

export default function ClienteDetallePage() {
  const { id } = useParams<{ id: string }>()
  const { addToast } = useToast()
  const [cliente, setCliente] = useState<ClienteConExtra | null>(null)
  const [dietas, setDietas] = useState<PlanNutricion[]>([])
  const [entrenos, setEntrenos] = useState<PlanEntrenamiento[]>([])
  const [seguimiento, setSeguimiento] = useState<SeguimientoPeso[]>([])
  const [checkins, setCheckins] = useState<CheckIn[]>([])
  const [notasCoach, setNotasCoach] = useState<NotaCoachRow[]>([])
  const [nuevaNota, setNuevaNota] = useState('')
  const [guardandoNota, setGuardandoNota] = useState(false)
  const [respuestaCheckin, setRespuestaCheckin] = useState<Record<string, string>>({})
  const [guardandoRespuesta, setGuardandoRespuesta] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditando, setIsEditando] = useState(false)
  const [tabActiva, setTabActiva] = useState<Tab>('informacion')
  const [showSelectorPlantilla, setShowSelectorPlantilla] = useState(false)
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<PlantillaEntrenamiento | null>(null)
  const [creandoPlan, setCreandoPlan] = useState(false)

  async function loadData() {
    // Marcar como revisado si llegó por onboarding (silencioso, no bloquea carga)
    supabase.from('clientes').update({ revisado_por_coach: true }).eq('id', id).eq('revisado_por_coach', false).then(() => { })

    const [clienteRes, dietasRes, entrenosRes, seguRes, checkinsRes, notasRes] = await Promise.all([
      supabase.from('clientes').select('*, profile:profiles!profile_id(nombre, apellidos, email, telefono)').eq('id', id).single(),
      supabase.from('planes_nutricion').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
      supabase.from('planes_entrenamiento').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
      supabase.from('seguimiento_peso').select('*').eq('cliente_id', id).order('fecha', { ascending: false }).limit(10),
      supabase.from('checkins').select('*').eq('cliente_id', id).order('fecha', { ascending: false }).limit(10),
      supabase.from('notas_coach').select('*').eq('cliente_id', id).order('created_at', { ascending: false }).limit(20),
    ])
    setCliente(clienteRes.data)
    setDietas(dietasRes.data ?? [])
    setEntrenos(entrenosRes.data ?? [])
    setSeguimiento(seguRes.data ?? [])
    setCheckins(checkinsRes.data ?? [])
    setNotasCoach(notasRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [id])

  async function recargarCliente() {
    const { data } = await supabase
      .from('clientes')
      .select('*, profile:profiles!profile_id(nombre, apellidos, email, telefono)')
      .eq('id', id)
      .single()
    if (data) setCliente(data)
  }

  async function guardarRespuestaCheckin(checkinId: string) {
    const nota = respuestaCheckin[checkinId]?.trim()
    if (nota === undefined) return
    setGuardandoRespuesta(checkinId)
    try {
      const res = await fetch(`/api/checkins/${checkinId}/nota`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota }),
      })
      if (!res.ok) throw new Error()
      setCheckins(prev => prev.map(c => c.id === checkinId ? { ...c, nota_coach: nota || undefined } : c))
      addToast({ type: 'success', title: 'Respuesta guardada', message: 'El cliente verá tu nota en su historial' })
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'No se pudo guardar la respuesta' })
    } finally {
      setGuardandoRespuesta(null)
    }
  }

  async function crearPlanDesdePlantilla() {
    if (!plantillaSeleccionada) return
    setCreandoPlan(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreandoPlan(false); return }

    const { data: plan, error } = await supabase.from('planes_entrenamiento').insert({
      coach_id: user.id,
      cliente_id: id as string,
      nombre: plantillaSeleccionada.nombre,
      descripcion: plantillaSeleccionada.descripcion ?? null,
      duracion_semanas: plantillaSeleccionada.duracion_semanas ?? null,
    }).select().single()

    if (error || !plan) {
      addToast({ type: 'error', title: 'Error', message: 'No se pudo crear el plan' })
      setCreandoPlan(false)
      return
    }

    const sesiones = (plantillaSeleccionada.sesiones ?? []) as PlantillaSesion[]

    for (const sesion of sesiones) {
      const { data: nuevaSesion, error: sError } = await supabase
        .from('sesiones_entrenamiento')
        .insert({
          plan_id: plan.id,
          nombre: sesion.nombre,
          dia_semana: sesion.dia_semana ?? null,
          orden: sesion.orden,
          notas: sesion.notas ?? null,
        })
        .select('id')
        .single()

      if (sError || !nuevaSesion) continue

      const ejercicios = (sesion.ejercicios ?? []) as PlantillaSesionEjercicio[]

      for (const ej of ejercicios) {
        await supabase.from('sesion_ejercicios').insert({
          sesion_id: nuevaSesion.id,
          ejercicio_id: ej.ejercicio_id,
          series: ej.series ?? null,
          repeticiones: ej.repeticiones ?? null,
          descanso_segundos: ej.descanso_segundos ?? null,
          peso_sugerido: ej.peso_sugerido ?? null,
          notas: ej.notas ?? null,
          orden: ej.orden,
        })
      }
    }

    addToast({ type: 'success', title: 'Plan creado', message: `"${plan.nombre}" asignado correctamente` })
    setShowSelectorPlantilla(false)
    setPlantillaSeleccionada(null)
    setCreandoPlan(false)
    // Recargar la lista de entrenos
    const { data: nuevosEntrenos } = await supabase
      .from('planes_entrenamiento')
      .select('*')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
    setEntrenos(nuevosEntrenos ?? [])
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
    </div>
  )

  if (!cliente) return <div className="p-8 text-gray-500">Cliente no encontrado</div>

  const p: { nombre?: string; apellidos?: string; email?: string; telefono?: string } = cliente.profile ?? {}

  const handleSave = () => {
    setIsEditando(false)
    recargarCliente()
  }

  const TABS: { key: Tab; label: string; icon: typeof Info }[] = [
    { key: 'informacion', label: 'Información', icon: Info },
    { key: 'planificacion', label: 'Planificación', icon: CalendarDays },
    { key: 'competicion', label: 'Competición', icon: Trophy },
    { key: 'periodizacion', label: 'Periodización', icon: Activity },
    { key: 'historial_ia', label: 'Historial IA', icon: Brain },
    { key: 'conversaciones_ia', label: 'Conversaciones IA', icon: Bot },
    { key: 'perfil_atleta', label: 'Perfil Atleta', icon: PersonStanding },
    { key: 'historial_entreno', label: 'Historial Entreno', icon: Dumbbell },
    { key: 'ajuste_macros', label: 'Ajuste Macros', icon: Zap },
  ]

  return (
    <>
      <BackButton href="/clientes" />
      <div className="p-8 max-w-5xl mx-auto pt-16 lg:pt-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/clientes" className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{p.nombre} {p.apellidos}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-gray-500 text-sm">{p.email}</p>
              {cliente.onboarding_completado === false && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  Sin onboarding
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dietas.find(d => d.activo && d.codigo_publico) && (
              <button
                className="btn-secondary btn-sm"
                onClick={() => {
                  const dietaActiva = dietas.find(d => d.activo && d.codigo_publico)
                  if (dietaActiva?.codigo_publico) {
                    const url = `${window.location.origin}/cliente/${dietaActiva.codigo_publico}`
                    navigator.clipboard.writeText(url)
                    addToast({ type: 'success', title: 'Enlace copiado', message: 'Portal del cliente copiado al portapapeles' })
                  }
                }}
                title="Copiar enlace del portal cliente"
              >
                <Link2 size={16} />
                Portal
              </button>
            )}
            {!isEditando && tabActiva === 'informacion' && (
              <button className="btn-primary btn-sm" onClick={() => setIsEditando(true)}>
                Editar
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b" style={{ borderColor: '#E2E8F0' }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTabActiva(key); setIsEditando(false) }}
              className={`
              flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${tabActiva === key
                  ? 'text-gray-900 border-gray-900'
                  : 'text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-300'
                }
            `}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Contenido según tab */}
        {tabActiva === 'informacion' ? (
          <>
            {isEditando ? (
              <ClienteEditar
                cliente={cliente}
                onSave={handleSave}
                onCancel={() => setIsEditando(false)}
              />
            ) : (
              <>
                {/* Info física */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {[
                    { label: 'Objetivo', value: cliente.objetivo ? OBJETIVO_LABELS[cliente.objetivo] : '—' },
                    { label: 'Nivel', value: cliente.nivel ? NIVEL_LABELS[cliente.nivel] : '—' },
                    { label: 'Peso inicial', value: cliente.peso_inicial ? `${cliente.peso_inicial} kg` : '—' },
                    { label: 'Edad', value: cliente.edad ? `${cliente.edad} años` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="card">
                      <p className="text-xs text-gray-400 mb-1">{label}</p>
                      <p className="font-semibold text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Planes de nutrición */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                        <UtensilsCrossed size={18} className="text-green-600" /> Planes de nutrición
                      </h2>
                      <Link href={`/dietas/nueva?cliente=${id}`} className="btn-primary text-sm py-1.5 px-3">+ Nuevo</Link>
                    </div>
                    {dietas.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Sin planes asignados</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {dietas.map(d => (
                          <Link key={d.id} href={`/dietas/${d.id}`}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                            <div>
                              <p className="font-medium text-sm text-gray-800">{d.nombre}</p>
                              {d.kcal_objetivo && <p className="text-xs text-gray-400">{d.kcal_objetivo} kcal/día</p>}
                            </div>
                            <span className={`badge ${d.activo ? 'badge-green' : 'badge-gray'}`}>{d.activo ? 'Activo' : 'Inactivo'}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Planes de entrenamiento */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                        <Dumbbell size={18} className="text-purple-600" /> Planes de entrenamiento
                      </h2>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowSelectorPlantilla(true)}
                          className="btn-secondary text-sm py-1.5 px-3"
                          title="Asignar desde plantilla"
                        >
                          <CopyPlus size={15} className="mr-1" />
                          Plantilla
                        </button>
                        <Link href={`/entrenos/nueva?cliente=${id}`} className="btn-primary text-sm py-1.5 px-3">+ Nuevo</Link>
                      </div>
                    </div>
                    {entrenos.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Sin planes asignados</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {entrenos.map(e => (
                          <Link key={e.id} href={`/entrenos/${e.id}`}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                            <div>
                              <p className="font-medium text-sm text-gray-800">{e.nombre}</p>
                              {e.duracion_semanas && <p className="text-xs text-gray-400">{e.duracion_semanas} semanas</p>}
                            </div>
                            <span className={`badge ${e.activo ? 'badge-green' : 'badge-gray'}`}>{e.activo ? 'Activo' : 'Inactivo'}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Seguimiento de peso */}
                  <div className="card lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                        <Weight size={18} className="text-blue-600" /> Seguimiento de peso
                      </h2>
                    </div>
                    {seguimiento.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Sin registros de peso todavía</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-400 border-b">
                              <th className="pb-2 font-medium">Fecha</th>
                              <th className="pb-2 font-medium">Peso</th>
                              <th className="pb-2 font-medium">Notas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {seguimiento.map(s => (
                              <tr key={s.id} className="border-b border-gray-50">
                                <td className="py-2 text-gray-600">{new Date(s.fecha).toLocaleDateString('es-ES')}</td>
                                <td className="py-2 font-semibold text-gray-800">{s.peso ? `${s.peso} kg` : '—'}</td>
                                <td className="py-2 text-gray-400 truncate max-w-xs">{s.notas || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Check-ins recibidos */}
                  <div className="card lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                        <ClipboardCheck size={18} className="text-gray-500" /> Check-ins del cliente
                      </h2>
                      {checkins.length > 0 && (
                        <span className="badge badge-teal">{checkins.length} registros</span>
                      )}
                    </div>
                    {checkins.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">El cliente aún no ha hecho check-ins</p>
                    ) : (
                      <div className="space-y-3">
                        {checkins.slice(0, 5).map(c => (
                          <div key={c.id} className="p-3 rounded-lg border" style={{ borderColor: '#E2E8F0', background: '#FAFAFA' }}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">
                                {new Date(c.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                              </span>
                              {c.peso && <span className="font-semibold text-gray-800">{c.peso} kg</span>}
                            </div>
                            <div className="flex gap-3 text-xs text-gray-500">
                              {c.adherencia && <span>🥗 Adherencia: {c.adherencia}/10</span>}
                              {c.energia && <span>⚡ Energía: {c.energia}/10</span>}
                              {c.sueno && <span>😴 Sueño: {c.sueno}/10</span>}
                            </div>
                            {c.notas && (
                              <p className="text-sm text-gray-600 mt-2 italic border-t pt-2" style={{ borderColor: '#F1F5F9' }}>
                                &ldquo;{c.notas}&rdquo;
                              </p>
                            )}
                            {/* Nota del coach — respuesta al check-in */}
                            <div className="mt-2 pt-2 border-t" style={{ borderColor: '#F1F5F9' }}>
                              {c.nota_coach ? (
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 text-xs p-2 rounded-lg" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                                    <span className="font-semibold">Tu respuesta: </span>{c.nota_coach}
                                  </div>
                                  <button
                                    className="text-xs text-gray-400 hover:text-gray-600 mt-1 flex-shrink-0"
                                    onClick={() => setRespuestaCheckin(prev => ({ ...prev, [c.id]: c.nota_coach ?? '' }))}
                                  >
                                    Editar
                                  </button>
                                </div>
                              ) : (
                                respuestaCheckin[c.id] !== undefined ? null : (
                                  <button
                                    className="text-xs font-medium flex items-center gap-1"
                                    style={{ color: '#0D9488' }}
                                    onClick={() => setRespuestaCheckin(prev => ({ ...prev, [c.id]: '' }))}
                                  >
                                    <MessageSquareText size={12} /> Responder al cliente
                                  </button>
                                )
                              )}
                              {respuestaCheckin[c.id] !== undefined && (
                                <div className="flex gap-2 mt-1">
                                  <input
                                    className="input text-xs py-1.5"
                                    placeholder="Escribe tu feedback..."
                                    value={respuestaCheckin[c.id]}
                                    onChange={e => setRespuestaCheckin(prev => ({ ...prev, [c.id]: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') guardarRespuestaCheckin(c.id) }}
                                    autoFocus
                                  />
                                  <button
                                    className="btn btn-primary btn-sm flex-shrink-0"
                                    disabled={guardandoRespuesta === c.id}
                                    onClick={() => guardarRespuestaCheckin(c.id)}
                                  >
                                    {guardandoRespuesta === c.id ? <Loader2 size={12} className="animate-spin" /> : 'Guardar'}
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-sm flex-shrink-0"
                                    onClick={() => setRespuestaCheckin(prev => { const n = { ...prev }; delete n[c.id]; return n })}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notas del coach */}
                  <div className="card lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                        <MessageSquareText size={18} className="text-gray-500" /> Notas para el cliente
                      </h2>
                      {notasCoach.length > 0 && (
                        <span className="badge badge-teal">{notasCoach.length} notas</span>
                      )}
                    </div>

                    {/* Formulario nueva nota */}
                    <div className="flex gap-2 mb-4">
                      <input
                        className="input"
                        placeholder="Escribe una nota para el cliente..."
                        value={nuevaNota}
                        onChange={e => setNuevaNota(e.target.value)}
                      />
                      <button
                        className="btn-primary btn-sm"
                        disabled={!nuevaNota.trim() || guardandoNota}
                        onClick={async () => {
                          if (!nuevaNota.trim()) return
                          setGuardandoNota(true)
                          const { data } = await supabase.from('notas_coach').insert({
                            cliente_id: id,
                            mensaje: nuevaNota.trim(),
                          }).select().single()
                          if (data) {
                            setNotasCoach(prev => [data, ...prev])
                            setNuevaNota('')
                          }
                          setGuardandoNota(false)
                        }}
                      >
                        {guardandoNota ? <Loader2 size={14} className="animate-spin" /> : 'Enviar'}
                      </button>
                    </div>

                    {/* Historial de notas */}
                    {notasCoach.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-3">Aún no has escrito notas para este cliente</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {notasCoach.map(n => (
                          <div key={n.id} className="p-3 rounded-lg text-sm" style={{ background: '#F2F2F7', border: '1px solid #E5E5EA' }}>
                            <p className="text-gray-800">{n.mensaje}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(n.created_at).toLocaleDateString('es-ES', {
                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notas y restricciones */}
                  {(cliente.notas || cliente.restricciones_alimentarias) && (
                    <div className="card">
                      <h2 className="font-semibold text-gray-800 mb-3">Notas y restricciones</h2>
                      {cliente.restricciones_alimentarias && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-400 mb-1">Restricciones alimentarias</p>
                          <p className="text-sm text-gray-700">{cliente.restricciones_alimentarias}</p>
                        </div>
                      )}
                      {cliente.notas && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Notas privadas</p>
                          <p className="text-sm text-gray-700">{cliente.notas}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : tabActiva === 'planificacion' ? (
          <ErrorBoundary>
            <PlanificacionCalendario
              clienteId={id as string}
              fechaRevision={cliente.fecha_proxima_revision ?? null}
              dietas={dietas.map(d => ({ id: d.id, nombre: d.nombre, activo: d.activo, created_at: d.created_at }))}
              entrenos={entrenos.map(e => ({ id: e.id, nombre: e.nombre, activo: e.activo, duracion_semanas: e.duracion_semanas ?? 0, created_at: e.created_at }))}
              onUpdateRevision={recargarCliente}
            />
          </ErrorBoundary>
        ) : tabActiva === 'competicion' ? (
          <ErrorBoundary>
            <div className="space-y-4">
              <CompeticionesManager
                clienteId={id as string}
                pesoKg={cliente?.peso_inicial ?? undefined}
              />
              <ProtocoloCompeticion clienteId={id as string} />
            </div>
          </ErrorBoundary>
        ) : tabActiva === 'periodizacion' ? (
          <ErrorBoundary>
            <PeriodizacionPanel clienteId={id as string} />
          </ErrorBoundary>
        ) : tabActiva === 'perfil_atleta' ? (
          <ErrorBoundary>
            <PerfilEntrenoForm clienteId={id as string} />
          </ErrorBoundary>
        ) : tabActiva === 'historial_entreno' ? (
          <ErrorBoundary>
            <HistorialEntreno clienteId={id as string} />
          </ErrorBoundary>
        ) : tabActiva === 'historial_ia' ? (
          <HistorialDietasIA clienteId={id as string} />
        ) : tabActiva === 'conversaciones_ia' ? (
          <ConversacionesIA clienteId={id as string} />
        ) : (
          <div className="max-w-xl mx-auto">
            <AjusteMacrosIA clienteId={id as string} onApplied={loadData} />
          </div>
        )}

        {/* Modal selector de plantilla de entrenamiento */}
        {showSelectorPlantilla && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowSelectorPlantilla(false); setPlantillaSeleccionada(null) }} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-5 pb-3 border-b" style={{ borderColor: '#F1F5F9' }}>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Asignar desde plantilla</h2>
                  <p className="text-sm text-gray-500">Selecciona una plantilla y se creará el plan con todas sus sesiones y ejercicios</p>
                </div>
                <button
                  onClick={() => { setShowSelectorPlantilla(false); setPlantillaSeleccionada(null) }}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Selector */}
              <div className="flex-1 overflow-y-auto p-5">
                <PlantillaEntrenoSelector
                  onSeleccionar={setPlantillaSeleccionada}
                  seleccionada={plantillaSeleccionada}
                  clienteId={id}
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-5 pt-3 border-t" style={{ borderColor: '#F1F5F9' }}>
                <button
                  onClick={() => { setShowSelectorPlantilla(false); setPlantillaSeleccionada(null) }}
                  className="btn btn-ghost btn-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={crearPlanDesdePlantilla}
                  disabled={!plantillaSeleccionada || creandoPlan}
                  className="btn-primary btn-sm"
                >
                  {creandoPlan ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Creando…</>
                  ) : (
                    'Asignar plan'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>)
}
