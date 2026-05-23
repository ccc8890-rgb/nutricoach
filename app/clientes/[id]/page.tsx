'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ClienteEditar from '@/components/ClienteEditar'
import Link from 'next/link'
import {
  ArrowLeft, UtensilsCrossed, Dumbbell, Weight, CalendarDays,
  Info, Brain, Link2, MessageSquareText, ClipboardCheck, Loader2,
  Zap, Bot, Trophy, CopyPlus, X, Activity, PersonStanding,
  ChevronRight, RefreshCw, Pencil, Flame, Beef, Wheat, Droplets,
  ExternalLink, Send, AlertTriangle,
} from 'lucide-react'
import type { Cliente, PlanNutricion, PlanEntrenamiento, SeguimientoPeso, CheckIn, PlantillaEntrenamiento, PlantillaSesion, PlantillaSesionEjercicio } from '@/types'
import PlantillaEntrenoSelector from '@/components/training/PlantillaEntrenoSelector'
import { OBJETIVO_LABELS, NIVEL_LABELS } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'

const PlanificacionCalendario = dynamic(() => import('@/components/PlanificacionCalendario'), { ssr: false, loading: () => <TabSkeleton /> })
const AjusteMacrosIA = dynamic(() => import('@/components/AjusteMacrosIA'), { ssr: false, loading: () => <TabSkeleton /> })
const HistorialDietasIA = dynamic(() => import('@/components/HistorialDietasIA'), { ssr: false, loading: () => <TabSkeleton /> })
const ConversacionesIA = dynamic(() => import('@/components/ConversacionesIA'), { ssr: false, loading: () => <TabSkeleton /> })
const ProtocoloCompeticion = dynamic(() => import('@/components/ProtocoloCompeticion'), { ssr: false, loading: () => <TabSkeleton /> })
const PerfilEntrenoForm = dynamic(() => import('@/components/training/PerfilEntrenoForm'), { ssr: false, loading: () => <TabSkeleton /> })
const PeriodizacionPanel = dynamic(() => import('@/components/PeriodizacionPanel'), { ssr: false, loading: () => <TabSkeleton /> })
const HistorialEntreno = dynamic(() => import('@/components/training/HistorialEntreno'), { ssr: false, loading: () => <TabSkeleton /> })
const CompeticionesManager = dynamic(() => import('@/components/CompeticionesManager'), { ssr: false, loading: () => <TabSkeleton /> })
const CosteSemanalCard = dynamic(() => import('@/components/clientes/CosteSemanal'), { ssr: false, loading: () => <div className="lg:col-span-2 h-12 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} /> })

function TabSkeleton() {
  return <div className="animate-pulse rounded-2xl h-48 w-full" style={{ background: 'var(--surface)' }} />
}

type NotaCoachRow = { id: string; cliente_id: string; mensaje: string; created_at: string }
type Tab = 'resumen' | 'planes' | 'checkins' | 'notas' | 'planificacion' | 'historial_ia' | 'conversaciones_ia' | 'ajuste_macros' | 'competicion' | 'periodizacion' | 'perfil_atleta' | 'historial_entreno'
type ClienteConExtra = Cliente & { fecha_proxima_revision?: string; revisado_por_coach?: boolean | null; profile?: { nombre?: string; apellidos?: string; email?: string; telefono?: string } }

// ── MacroBar ──────────────────────────────────────────────────────────────────
function MacroBar({ label, value, max, color, icon: Icon }: {
  label: string; value: number; max: number; color: string; icon: React.ElementType
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1 mb-1">
        <Icon size={11} style={{ color }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div className="text-base font-bold" style={{ color: 'var(--text)' }}>{value > 0 ? value : '—'}<span className="text-xs font-normal ml-0.5" style={{ color: 'var(--text-muted)' }}>{value > 0 ? (label === 'Kcal' ? '' : 'g') : ''}</span></div>
      <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ── StatPill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: 'var(--surface-elevated, var(--border))' }}>
      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-bold mt-0.5" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

export default function ClienteDetallePage() {
  const { id } = useParams<{ id: string }>()
  const { addToast } = useToast()
  const router = useRouter()

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
  const [tabActiva, setTabActiva] = useState<Tab>('resumen')
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [showSelectorPlantilla, setShowSelectorPlantilla] = useState(false)
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<PlantillaEntrenamiento | null>(null)
  const [creandoPlan, setCreandoPlan] = useState(false)

  async function loadData() {
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

  useEffect(() => { loadData() }, [id])

  async function recargarCliente() {
    const { data } = await supabase.from('clientes').select('*, profile:profiles!profile_id(nombre, apellidos, email, telefono)').eq('id', id).single()
    if (data) setCliente(data)
  }

  async function handleEliminarCliente() {
    setEliminando(true)
    try {
      const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' })
      if (!res.ok) { alert((await res.json()).error ?? 'Error al eliminar cliente'); return }
      router.push('/clientes')
    } finally { setEliminando(false) }
  }

  async function guardarRespuestaCheckin(checkinId: string) {
    const nota = respuestaCheckin[checkinId]?.trim()
    if (nota === undefined) return
    setGuardandoRespuesta(checkinId)
    try {
      const res = await fetch(`/api/checkins/${checkinId}/nota`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nota }) })
      if (!res.ok) throw new Error()
      setCheckins(prev => prev.map(c => c.id === checkinId ? { ...c, nota_coach: nota || undefined } : c))
      setRespuestaCheckin(prev => { const n = { ...prev }; delete n[checkinId]; return n })
      addToast({ type: 'success', title: 'Respuesta guardada', message: 'El cliente verá tu nota en su historial' })
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'No se pudo guardar la respuesta' })
    } finally { setGuardandoRespuesta(null) }
  }

  async function crearPlanDesdePlantilla() {
    if (!plantillaSeleccionada) return
    setCreandoPlan(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreandoPlan(false); return }
    const { data: plan, error } = await supabase.from('planes_entrenamiento').insert({
      coach_id: user.id, cliente_id: id as string,
      nombre: plantillaSeleccionada.nombre,
      descripcion: plantillaSeleccionada.descripcion ?? null,
      duracion_semanas: plantillaSeleccionada.duracion_semanas ?? null,
      activo: true,
    }).select().single()
    if (error || !plan) { addToast({ type: 'error', title: 'Error', message: 'No se pudo crear el plan' }); setCreandoPlan(false); return }
    for (const sesion of (plantillaSeleccionada.sesiones ?? []) as PlantillaSesion[]) {
      const { data: nuevaSesion } = await supabase.from('sesiones_entrenamiento').insert({ plan_id: plan.id, nombre: sesion.nombre, dia_semana: sesion.dia_semana ?? null, orden: sesion.orden, notas: sesion.notas ?? null }).select('id').single()
      if (!nuevaSesion) continue
      for (const ej of (sesion.ejercicios ?? []) as PlantillaSesionEjercicio[]) {
        await supabase.from('sesion_ejercicios').insert({ sesion_id: nuevaSesion.id, ejercicio_id: ej.ejercicio_id, series: ej.series ?? null, repeticiones: ej.repeticiones ?? null, descanso_segundos: ej.descanso_segundos ?? null, peso_sugerido: ej.peso_sugerido ?? null, notas: ej.notas ?? null, orden: ej.orden })
      }
    }
    addToast({ type: 'success', title: 'Plan creado', message: `"${plan.nombre}" asignado correctamente` })
    setShowSelectorPlantilla(false); setPlantillaSeleccionada(null); setCreandoPlan(false)
    const { data: nuevosEntrenos } = await supabase.from('planes_entrenamiento').select('*').eq('cliente_id', id).order('created_at', { ascending: false })
    setEntrenos(nuevosEntrenos ?? [])
  }

  if (loading) return (
    <div className="flex justify-center items-center py-24">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  )
  if (!cliente) return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Cliente no encontrado</div>

  const p = cliente.profile ?? {} as { nombre?: string; apellidos?: string; email?: string; telefono?: string }
  const nombre = [p.nombre, p.apellidos].filter(Boolean).join(' ') || 'Sin nombre'
  const initials = [p.nombre?.[0], p.apellidos?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const dietaActiva = dietas.find(d => d.activo)
  const entrenoActivo = entrenos.find(e => e.activo)
  const ultimoCheckin = checkins[0]
  const ultimoPeso = seguimiento[0]?.peso ?? cliente.peso_inicial

  const TABS: { key: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'resumen', label: 'Resumen', icon: Info },
    { key: 'planes', label: 'Planes', icon: UtensilsCrossed, badge: dietas.length + entrenos.length },
    { key: 'checkins', label: 'Check-ins', icon: ClipboardCheck, badge: checkins.length },
    { key: 'notas', label: 'Notas', icon: MessageSquareText, badge: notasCoach.length },
    { key: 'planificacion', label: 'Planificación', icon: CalendarDays },
    { key: 'competicion', label: 'Competición', icon: Trophy },
    { key: 'periodizacion', label: 'Periodización', icon: Activity },
    { key: 'historial_ia', label: 'Historial IA', icon: Brain },
    { key: 'conversaciones_ia', label: 'Chat IA', icon: Bot },
    { key: 'perfil_atleta', label: 'Perfil atleta', icon: PersonStanding },
    { key: 'historial_entreno', label: 'Entreno realizado', icon: Dumbbell },
    { key: 'ajuste_macros', label: 'Ajuste macros', icon: Zap },
  ]

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pt-16 lg:pt-6">

        {/* ── Back ── */}
        <Link href="/clientes" className="inline-flex items-center gap-1.5 text-sm mb-5 transition-colors hover:text-[var(--text)]" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={15} /> Clientes
        </Link>

        {/* ── Hero card ── */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0" style={{ background: 'var(--accent-bg)', color: 'var(--text-secondary)' }}>
              {initials}
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{nombre}</h1>
                {cliente.activo ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,199,89,0.12)', color: '#34C759' }}>Activo</span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-elevated,var(--border))', color: 'var(--text-muted)' }}>Inactivo</span>
                )}
                {cliente.onboarding_completado === false && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,159,10,0.12)', color: '#FF9F0A' }}>Sin onboarding</span>
                )}
                {cliente.revisado_por_coach === false && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,159,10,0.12)', color: '#FF9F0A' }}>Pendiente de revisión</span>
                )}
              </div>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.email}</p>

              {/* Stats row */}
              <div className="flex gap-2 flex-wrap mt-3">
                {cliente.objetivo && <StatPill label="Objetivo" value={OBJETIVO_LABELS[cliente.objetivo] ?? cliente.objetivo} />}
                {ultimoPeso && <StatPill label="Peso" value={`${ultimoPeso} kg`} />}
                {cliente.altura && <StatPill label="Altura" value={`${cliente.altura} cm`} />}
                {cliente.edad && <StatPill label="Edad" value={`${cliente.edad} a`} />}
                {cliente.sexo && <StatPill label="Sexo" value={cliente.sexo === 'hombre' ? '♂' : '♀'} />}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {dietaActiva?.codigo_publico && (
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/cliente/${dietaActiva.codigo_publico}`); addToast({ type: 'success', title: 'Enlace copiado', message: 'Portal del cliente copiado' }) }}
                  title="Copiar portal cliente"
                >
                  <Link2 size={14} />
                  <span className="hidden sm:inline">Portal</span>
                </button>
              )}
              <button className="btn-secondary btn-sm" onClick={() => setIsEditando(true)}>
                <Pencil size={14} />
                <span className="hidden sm:inline">Editar</span>
              </button>
            </div>
          </div>

          {/* ── Macros del plan activo ── */}
          {dietaActiva && (dietaActiva.kcal_objetivo || dietaActiva.proteinas_objetivo) ? (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Plan activo — {dietaActiva.nombre}
                </span>
                <div className="flex gap-2">
                  <Link href={`/dietas/${dietaActiva.id}`} className="text-xs flex items-center gap-1 transition-colors hover:text-[var(--text)]" style={{ color: 'var(--text-muted)' }}>
                    Ver dieta <ExternalLink size={11} />
                  </Link>
                  <span style={{ color: 'var(--border)' }}>·</span>
                  <Link href={`/clientes/${id}/revisar-plan`} className="text-xs flex items-center gap-1 transition-colors hover:text-[var(--text)]" style={{ color: 'var(--text-muted)' }}>
                    <RefreshCw size={11} /> Revisar / regenerar
                  </Link>
                </div>
              </div>
              <div className="flex gap-4">
                <MacroBar label="Kcal" value={dietaActiva.kcal_objetivo ?? 0} max={3500} color="var(--accent)" icon={Flame} />
                <MacroBar label="Prot" value={dietaActiva.proteinas_objetivo ?? 0} max={250} color="#30D158" icon={Beef} />
                <MacroBar label="Carbs" value={dietaActiva.carbohidratos_objetivo ?? 0} max={400} color="#FF9F0A" icon={Wheat} />
                <MacroBar label="Grasas" value={dietaActiva.grasas_objetivo ?? 0} max={150} color="#64D2FF" icon={Droplets} />
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-4 flex items-center justify-between gap-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div>
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Sin dieta activa</span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Genera o revisa el plan IA antes de activar el cliente.</p>
              </div>
              <Link href={`/clientes/${id}/revisar-plan`} className="btn-primary btn-sm">
                Generar dieta IA
              </Link>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-5 scrollbar-none">
          {TABS.map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => { setTabActiva(key); setIsEditando(false) }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0"
              style={tabActiva === key
                ? { background: 'var(--text)', color: 'var(--bg)' }
                : { background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
              }
            >
              <Icon size={13} />
              {label}
              {badge !== undefined && badge > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                  style={tabActiva === key
                    ? { background: 'rgba(255,255,255,0.2)', color: 'inherit' }
                    : { background: 'var(--border)', color: 'var(--text-secondary)' }
                  }>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {isEditando ? (
          <ClienteEditar cliente={cliente} onSave={() => { setIsEditando(false); recargarCliente() }} onCancel={() => setIsEditando(false)} />
        ) : tabActiva === 'resumen' ? (
          <div className="space-y-4">
            {/* Last check-in + weight snapshot */}
            {(ultimoCheckin || ultimoPeso) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ultimoPeso && (
                  <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Peso actual</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{ultimoPeso}<span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>kg</span></p>
                    {cliente.peso_inicial && ultimoPeso !== cliente.peso_inicial && (
                      <p className="text-xs mt-1" style={{ color: ultimoPeso < cliente.peso_inicial ? '#30D158' : '#FF453A' }}>
                        {ultimoPeso < cliente.peso_inicial ? '↓' : '↑'} {Math.abs(ultimoPeso - cliente.peso_inicial).toFixed(1)} kg desde inicio
                      </p>
                    )}
                  </div>
                )}
                {ultimoCheckin && (
                  <>
                    {ultimoCheckin.adherencia && (
                      <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Adherencia</p>
                        <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{ultimoCheckin.adherencia}<span className="text-sm font-normal ml-0.5" style={{ color: 'var(--text-muted)' }}>/10</span></p>
                      </div>
                    )}
                    {ultimoCheckin.energia && (
                      <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Energía</p>
                        <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{ultimoCheckin.energia}<span className="text-sm font-normal ml-0.5" style={{ color: 'var(--text-muted)' }}>/10</span></p>
                      </div>
                    )}
                    {ultimoCheckin.sueno && (
                      <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Sueño</p>
                        <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{ultimoCheckin.sueno}<span className="text-sm font-normal ml-0.5" style={{ color: 'var(--text-muted)' }}>/10</span></p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Notes + restrictions */}
            {(cliente.notas || cliente.restricciones_alimentarias) && (
              <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {cliente.restricciones_alimentarias && (
                  <div className="mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Restricciones</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{cliente.restricciones_alimentarias}</p>
                  </div>
                )}
                {cliente.notas && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Notas privadas</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{cliente.notas}</p>
                  </div>
                )}
              </div>
            )}

            {/* Eliminar cliente */}
            <div className="rounded-2xl p-4" style={{ border: '1px solid rgba(255,69,58,0.2)', background: 'rgba(255,69,58,0.04)' }}>
              {!confirmandoEliminar ? (
                <button className="text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors" style={{ borderColor: 'rgba(255,69,58,0.3)', color: '#FF453A' }} onClick={() => setConfirmandoEliminar(true)}>
                  Eliminar cliente
                </button>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>¿Seguro? No se puede deshacer.</span>
                  <button className="text-xs px-3 py-1.5 rounded-xl font-medium" style={{ background: '#FF453A', color: '#fff' }} disabled={eliminando} onClick={handleEliminarCliente}>
                    {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
                  </button>
                  <button className="text-xs px-3 py-1.5 rounded-xl" style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }} onClick={() => setConfirmandoEliminar(false)}>
                    Cancelar
                  </button>
                </div>
              )}
              <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Eliminar el cliente borrará su perfil, planes, check-ins y todos sus datos. Esta acción no se puede deshacer.</p>
            </div>
          </div>

        ) : tabActiva === 'planes' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Nutrición */}
            <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <UtensilsCrossed size={16} style={{ color: '#30D158' }} /> Nutrición
                </h2>
                <Link href={`/dietas/nueva?cliente=${id}`} className="btn-primary btn-sm">+ Nuevo</Link>
              </div>
              {dietas.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Sin planes asignados</p>
              ) : (
                <div className="space-y-2">
                  {dietas.map(d => (
                    <Link key={d.id} href={`/dietas/${d.id}`} className="flex items-center gap-3 p-3 rounded-xl transition-all" style={{ border: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-elevated, var(--border))')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{d.nombre}</p>
                        {d.kcal_objetivo && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{d.kcal_objetivo} kcal · {d.proteinas_objetivo ?? '?'}g prot</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${d.activo ? 'badge-green' : 'badge-gray'}`}>{d.activo ? 'Activo' : 'Inactivo'}</span>
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <Link href={`/clientes/${id}/revisar-plan`} className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--text)]" style={{ color: 'var(--text-muted)' }}>
                  <RefreshCw size={13} /> Revisar / regenerar plan IA
                </Link>
              </div>
            </div>

            {/* Entrenamiento */}
            <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <Dumbbell size={16} style={{ color: '#BF5AF2' }} /> Entrenamiento
                </h2>
                <div className="flex gap-2">
                  <button className="btn-secondary btn-sm" onClick={() => setShowSelectorPlantilla(true)}><CopyPlus size={13} /> Plantilla</button>
                  <Link href={`/entrenos/nueva?cliente=${id}`} className="btn-primary btn-sm">+ Nuevo</Link>
                </div>
              </div>
              {entrenos.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Sin planes asignados</p>
              ) : (
                <div className="space-y-2">
                  {entrenos.map(e => (
                    <Link key={e.id} href={`/entrenos/${e.id}`} className="flex items-center gap-3 p-3 rounded-xl transition-all" style={{ border: '1px solid var(--border)' }}
                      onMouseEnter={e2 => (e2.currentTarget.style.background = 'var(--surface-elevated, var(--border))')}
                      onMouseLeave={e2 => (e2.currentTarget.style.background = 'transparent')}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{e.nombre}</p>
                        {e.duracion_semanas && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{e.duracion_semanas} semanas</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${e.activo ? 'badge-green' : 'badge-gray'}`}>{e.activo ? 'Activo' : 'Inactivo'}</span>
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Coste semanal */}
            <div className="lg:col-span-2">
              <CosteSemanalCard clienteId={id} />
            </div>

            {/* Peso */}
            {seguimiento.length > 0 && (
              <div className="lg:col-span-2 rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <h2 className="font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--text)' }}>
                  <Weight size={16} style={{ color: '#64D2FF' }} /> Seguimiento de peso
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Fecha</th>
                        <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Peso</th>
                        <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seguimiento.map(s => (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="py-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>{new Date(s.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</td>
                          <td className="py-2.5 font-semibold" style={{ color: 'var(--text)' }}>{s.peso ? `${s.peso} kg` : '—'}</td>
                          <td className="py-2.5 text-sm truncate max-w-xs" style={{ color: 'var(--text-muted)' }}>{s.notas || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        ) : tabActiva === 'checkins' ? (
          <div className="space-y-3">
            {checkins.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                <ClipboardCheck size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">El cliente aún no ha hecho check-ins</p>
              </div>
            ) : checkins.map(c => (
              <div key={c.id} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {new Date(c.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' })}
                  </span>
                  {c.peso && <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{c.peso} kg</span>}
                </div>
                <div className="flex gap-4 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  {c.adherencia && <span>Adherencia <strong style={{ color: 'var(--text)' }}>{c.adherencia}/10</strong></span>}
                  {c.energia && <span>Energía <strong style={{ color: 'var(--text)' }}>{c.energia}/10</strong></span>}
                  {c.sueno && <span>Sueño <strong style={{ color: 'var(--text)' }}>{c.sueno}/10</strong></span>}
                </div>
                {c.notas && <p className="text-sm italic mb-2" style={{ color: 'var(--text-secondary)' }}>&ldquo;{c.notas}&rdquo;</p>}

                {/* Coach reply */}
                <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  {c.nota_coach && respuestaCheckin[c.id] === undefined ? (
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs px-3 py-2 rounded-xl flex-1" style={{ background: 'var(--accent-bg)', color: 'var(--text-secondary)' }}>
                        <span className="font-semibold">Tu respuesta: </span>{c.nota_coach}
                      </p>
                      <button className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }} onClick={() => setRespuestaCheckin(prev => ({ ...prev, [c.id]: c.nota_coach ?? '' }))}>Editar</button>
                    </div>
                  ) : respuestaCheckin[c.id] === undefined ? (
                    <button className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--accent)' }} onClick={() => setRespuestaCheckin(prev => ({ ...prev, [c.id]: '' }))}>
                      <MessageSquareText size={12} /> Responder al cliente
                    </button>
                  ) : null}
                  {respuestaCheckin[c.id] !== undefined && (
                    <div className="flex gap-2">
                      <input className="input text-sm py-1.5 flex-1" placeholder="Escribe tu feedback…" value={respuestaCheckin[c.id]}
                        onChange={e => setRespuestaCheckin(prev => ({ ...prev, [c.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') guardarRespuestaCheckin(c.id) }} autoFocus />
                      <button className="btn-primary btn-sm flex-shrink-0" disabled={guardandoRespuesta === c.id} onClick={() => guardarRespuestaCheckin(c.id)}>
                        {guardandoRespuesta === c.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      </button>
                      <button className="btn-secondary btn-sm flex-shrink-0" onClick={() => setRespuestaCheckin(prev => { const n = { ...prev }; delete n[c.id]; return n })}>
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

        ) : tabActiva === 'notas' ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Escribe una nota para el cliente…" value={nuevaNota} onChange={e => setNuevaNota(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && nuevaNota.trim()) document.getElementById('btn-nota')?.click() }} />
              <button id="btn-nota" className="btn-primary btn-sm flex-shrink-0" disabled={!nuevaNota.trim() || guardandoNota}
                onClick={async () => {
                  if (!nuevaNota.trim()) return
                  setGuardandoNota(true)
                  const { data } = await supabase.from('notas_coach').insert({ cliente_id: id, mensaje: nuevaNota.trim() }).select().single()
                  if (data) { setNotasCoach(prev => [data, ...prev]); setNuevaNota('') }
                  setGuardandoNota(false)
                }}>
                {guardandoNota ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
            {notasCoach.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Aún no hay notas para este cliente</p>
            ) : (
              <div className="space-y-2">
                {notasCoach.map(n => (
                  <div key={n.id} className="p-3.5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>{n.mensaje}</p>
                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                      {new Date(n.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        ) : tabActiva === 'planificacion' ? (
          <ErrorBoundary><PlanificacionCalendario clienteId={id as string} fechaRevision={cliente.fecha_proxima_revision ?? null} dietas={dietas.map(d => ({ id: d.id, nombre: d.nombre, activo: d.activo, created_at: d.created_at }))} entrenos={entrenos.map(e => ({ id: e.id, nombre: e.nombre, activo: e.activo, duracion_semanas: e.duracion_semanas ?? 0, created_at: e.created_at }))} onUpdateRevision={recargarCliente} /></ErrorBoundary>
        ) : tabActiva === 'competicion' ? (
          <ErrorBoundary><div className="space-y-4"><CompeticionesManager clienteId={id as string} pesoKg={cliente?.peso_inicial ?? undefined} /><ProtocoloCompeticion clienteId={id as string} /></div></ErrorBoundary>
        ) : tabActiva === 'periodizacion' ? (
          <ErrorBoundary><PeriodizacionPanel clienteId={id as string} /></ErrorBoundary>
        ) : tabActiva === 'perfil_atleta' ? (
          <ErrorBoundary><PerfilEntrenoForm clienteId={id as string} /></ErrorBoundary>
        ) : tabActiva === 'historial_entreno' ? (
          <ErrorBoundary><HistorialEntreno clienteId={id as string} /></ErrorBoundary>
        ) : tabActiva === 'historial_ia' ? (
          <HistorialDietasIA clienteId={id as string} />
        ) : tabActiva === 'conversaciones_ia' ? (
          <ConversacionesIA clienteId={id as string} />
        ) : (
          <div className="max-w-xl mx-auto"><AjusteMacrosIA clienteId={id as string} onApplied={loadData} /></div>
        )}

        {/* ── Modal plantilla entrenamiento ── */}
        {showSelectorPlantilla && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowSelectorPlantilla(false); setPlantillaSeleccionada(null) }} />
            <div className="relative rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between p-5 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Asignar desde plantilla</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Se creará el plan con todas sus sesiones y ejercicios</p>
                </div>
                <button onClick={() => { setShowSelectorPlantilla(false); setPlantillaSeleccionada(null) }} className="p-2 rounded-xl transition-colors hover:bg-opacity-10" style={{ color: 'var(--text-muted)' }}>
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <PlantillaEntrenoSelector onSeleccionar={setPlantillaSeleccionada} seleccionada={plantillaSeleccionada} clienteId={id} />
              </div>
              <div className="flex items-center justify-end gap-2 p-5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <button onClick={() => { setShowSelectorPlantilla(false); setPlantillaSeleccionada(null) }} className="btn-secondary btn-sm">Cancelar</button>
                <button onClick={crearPlanDesdePlantilla} disabled={!plantillaSeleccionada || creandoPlan} className="btn-primary btn-sm">
                  {creandoPlan ? <><div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'white', borderTopColor: 'transparent' }} /> Creando…</> : 'Asignar plan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
