'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import {
  Users,
  ForkKnife,
  ChatCircle,
  TrendUp,
  ArrowRight,
  CalendarBlank,
  Warning,
  CheckCircle,
  Lightning,
  Plus,
  Sparkle,
  UserPlus,
  BookOpen,
  Trophy,
  ClipboardText,
} from '@phosphor-icons/react'
import { SkeletonChart } from '@/components/ui/Skeleton'
import { CountUp } from '@/components/ui/CountUp'
import { MiniSparkline } from '@/components/dashboard/MiniSparkline'
import CheckinsPendientes from '@/components/dashboard/CheckinsPendientes'
import AutoCoachPanel from '@/components/dashboard/AutoCoachPanel'

const BarChart = dynamic(() => import('@/components/dashboard/BarChart'), {
  loading: () => <SkeletonChart height={100} />,
  ssr: false,
})

const StackedBar = dynamic(() => import('@/components/dashboard/BarChart').then(m => ({ default: m.StackedBar })), {
  loading: () => <div className="skeleton h-6 w-full rounded-full" />,
  ssr: false,
})

const MiniDonut = dynamic(() => import('@/components/dashboard/MiniDonut'), {
  loading: () => <div className="skeleton w-6 h-6 rounded-full" />,
  ssr: false,
})

// ── Interfaces ──

type ClienteRow = {
  id: string
  profile: { nombre: string; apellidos: string; email: string } | null
  fecha_proxima_revision: string | null
  created_at: string
}

interface Stats {
  totalClientes: number
  totalDietas: number
  respuestasPendientes: number
  respuestasNuevas: number
  clientesConDieta: number
  clientesSinDieta: number
  dietasActivas: number
  dietasInactivas: number
  clientesSinOnboarding: number
}

interface AnalyticsData {
  totales: {
    totalClientes: number
    totalDietasActivas: number
    totalDietasInactivas: number
    clientesConDieta: number
    clientesSinDieta: number
    totalCheckins: number
    totalRespuestas: number
    respuestasPendientes: number
  }
  nuevosClientesPorMes: { mes: string; key: string; valor: number }[]
  distribucionRespuestas: { estado: string; label: string; color: string; valor: number }[]
  tendenciaCheckins: { fecha: string; label: string; adherenciaPromedio: number; energiaPromedio: number; suenoPromedio: number; total: number }[]
  evolucionPeso: { fecha: string; label: string; pesoPromedio: number; minimo: number; maximo: number; total: number }[]
  topClientesCheckins: { id: string; nombre: string; apellidos: string; totalCheckins: number }[]
  clientesSinActividadReciente: { id: string; nombre: string; apellidos: string }[]
  distribucionDietas: { con1Dieta: number; con2a3Dietas: number; conMasDe3: number; sinDietas: number }
  actividadDiaria: { label: string; dietas: number; respuestas: number; checkins: number; total: number }[]
  timestamp: string
}

interface StatCardConfig {
  label: string
  key: keyof Stats
  icon: React.ElementType
  accent: string
  trend?: number[]
}

// ── Config ──

const STAT_CARDS: StatCardConfig[] = [
  { label: 'Clientes', key: 'totalClientes', icon: Users, accent: 'var(--accent)', trend: [4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 9, 10] },
  { label: 'Dietas activas', key: 'dietasActivas', icon: ForkKnife, accent: 'var(--accent-light)', trend: [2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8] },
  { label: 'Respuestas pendientes', key: 'respuestasPendientes', icon: ChatCircle, accent: 'var(--accent)', trend: [1, 2, 1, 3, 2, 4, 3, 2, 5, 4, 3, 6] },
  { label: 'Nuevas hoy', key: 'respuestasNuevas', icon: TrendUp, accent: 'var(--info)', trend: [0, 1, 0, 2, 1, 0, 3, 1, 2, 0, 1, 2] },
]

const QUICK_ACTIONS = [
  { label: 'Nuevo cliente', href: '/clientes/nuevo', icon: UserPlus, bg: 'var(--accent-bg)', color: 'var(--accent)' },
  { label: 'Nueva dieta', href: '/dietas/nueva', icon: ForkKnife, bg: 'var(--accent-bg)', color: 'var(--accent-light)' },
  { label: 'Consultas', href: '/respuestas', icon: ChatCircle, bg: 'var(--info-bg)', color: 'var(--info)' },
  { label: 'Recetario', href: '/recetas', icon: BookOpen, bg: 'var(--surface-elevated)', color: 'var(--text-secondary)' },
]

// ── Página ──

export default function DashboardPage() {
  const { addToast } = useToast()
  const [stats, setStats] = useState<Stats>({
    totalClientes: 0, totalDietas: 0,
    respuestasPendientes: 0, respuestasNuevas: 0,
    clientesConDieta: 0, clientesSinDieta: 0,
    dietasActivas: 0, dietasInactivas: 0,
    clientesSinOnboarding: 0,
  })
  const [loading, setLoading] = useState(true)
  const [revisionesProximas, setRevisionesProximas] = useState<{ id: string; nombre: string; apellidos: string; fecha: string }[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [competicionesProximas, setCompeticionesProximas] = useState<{
    id: string
    nombre: string
    disciplina: string
    fecha_competicion: string
    cliente_id: string
    clienteNombre: string
  }[]>([])

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) console.error('[dashboard] Error auth.getUser:', userError)
        if (!user) { console.warn('[dashboard] No hay usuario autenticado'); setLoading(false); return }

        const [resClientes, resDietas, resRespuestas] = await Promise.all([
          supabase.from('clientes').select('id, onboarding_completado, profile:profiles!profile_id(nombre, apellidos, email), fecha_proxima_revision, created_at', { count: 'exact' }).eq('coach_id', user.id),
          supabase.from('planes_nutricion').select('id, nombre, activo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo, kcal_objetivo, cliente_id, created_at', { count: 'exact' }).eq('coach_id', user.id),
          supabase.from('respuestas_clientes').select('id, estado, created_at').eq('coach_id', user.id),
        ])

        if (resClientes.error) console.error('[dashboard] Error clientes:', resClientes.error.message)
        if (resDietas.error) console.error('[dashboard] Error dietas:', resDietas.error.message)
        if (resRespuestas.error) console.error('[dashboard] Error respuestas:', resRespuestas.error.message)

        const clientesData = resClientes.data ?? []
        const dietasData = resDietas.data ?? []
        const totalClientes = resClientes.count ?? 0
        const totalDietas = resDietas.count ?? 0
        const dietasActivas = dietasData.filter(d => d.activo).length
        const dietasInactivas = totalDietas - dietasActivas
        const clientesConDieta = new Set(dietasData.filter(d => d.cliente_id).map(d => d.cliente_id)).size
        const clientesSinDieta = totalClientes - clientesConDieta
        const clientesSinOnboarding = clientesData.filter((c: { onboarding_completado?: boolean }) => c.onboarding_completado === false).length

        const resps = resRespuestas.data ?? []
        const respuestasPendientes = resps.filter(r => r.estado === 'nueva' || r.estado === 'dieta_rechazada').length

        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        const respuestasNuevas = resps.filter(r => new Date(r.created_at) >= hoy).length

        setStats({ totalClientes, totalDietas, respuestasPendientes, respuestasNuevas, clientesConDieta, clientesSinDieta, dietasActivas, dietasInactivas, clientesSinOnboarding })

        const treintaDias = new Date()
        treintaDias.setDate(treintaDias.getDate() + 30)
        const proxRevisiones = (clientesData as unknown as ClienteRow[])
          .filter(c => c.fecha_proxima_revision)
          .map(c => ({
            id: c.id,
            nombre: c.profile?.nombre || 'Sin nombre',
            apellidos: c.profile?.apellidos || '',
            fecha: c.fecha_proxima_revision!,
          }))
          .filter(c => new Date(c.fecha) <= treintaDias)
          .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
          .slice(0, 5)
        setRevisionesProximas(proxRevisiones)

        // Próximas competiciones (todas las activas a futuro)
        const hoyStr = new Date().toISOString().slice(0, 10)
        const { data: comps } = await supabase
          .from('competiciones')
          .select('id, nombre, disciplina, fecha_competicion, cliente_id, clientes!inner(profile:profiles!profile_id(nombre, apellidos))')
          .eq('activo', true)
          .gte('fecha_competicion', hoyStr)
          .order('fecha_competicion', { ascending: true })
          .limit(6)
        if (comps) {
          setCompeticionesProximas(comps.map((c: any) => ({
            id: c.id,
            nombre: c.nombre,
            disciplina: c.disciplina,
            fecha_competicion: c.fecha_competicion,
            cliente_id: c.cliente_id,
            clienteNombre: `${c.clientes?.profile?.nombre ?? ''} ${c.clientes?.profile?.apellidos ?? ''}`.trim() || 'Cliente',
          })))
        }
      } catch (e) {
        console.error('[dashboard] Excepción:', e)
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await fetch('/api/dashboard/analytics')
        if (res.ok) setAnalytics(await res.json())
      } catch (e) {
        console.error('Error loading analytics:', e)
        addToast({ type: 'error', title: 'Error', message: 'No se pudieron cargar las analíticas' })
      } finally {
        setAnalyticsLoading(false)
      }
    }
    loadAnalytics()
  }, [])

  return (
    <main className="flex-1 p-6 sm:p-8 max-w-7xl">

      {/* ── Header ── */}
      <header className="mb-6 sm:mb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text)' }}>Dashboard</h1>
              <Sparkle size={16} weight="fill" style={{ color: 'var(--accent)' }} />
            </div>
            <p className="text-xs sm:text-sm capitalize" style={{ color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/clientes/nuevo" className="btn btn-primary btn-sm">
              <Plus size={13} weight="bold" />
              <span className="hidden sm:inline">Nuevo cliente</span>
              <span className="sm:hidden">+ Cliente</span>
            </Link>
            <Link href="/dietas/nueva" className="btn btn-ghost btn-sm hidden sm:flex">
              + Dieta
            </Link>
          </div>
        </div>
      </header>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {STAT_CARDS.map(({ label, key, icon: Icon, accent, trend }) => {
          const value = stats[key]
          const idx = STAT_CARDS.findIndex(s => s.key === key)
          return (
            <div
              key={key}
              className="card-glass card-hoverable animate-fade-in"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--accent-bg)' }}>
                  <Icon size={18} weight="fill" style={{ color: accent }} />
                </div>
                {trend && !loading && (
                  <MiniSparkline data={trend} width={56} height={22} color={accent} />
                )}
              </div>
              {loading ? (
                <div className="space-y-1.5">
                  <div className="skeleton h-7 w-12" />
                  <div className="skeleton h-3.5 w-20" />
                </div>
              ) : (
                <>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                    <CountUp to={value as number} />
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Quick actions ── */}
      <div className="card-glass mb-6">
        <div className="flex items-center gap-1.5 mb-3.5">
          <Lightning size={13} weight="fill" style={{ color: 'var(--accent)' }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Acciones rápidas
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {QUICK_ACTIONS.map(({ label, href, icon: Icon, bg, color }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 active:scale-95"
              style={{ background: 'var(--surface-hover)' }}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: bg }}>
                <Icon size={14} weight="fill" style={{ color }} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            </Link>
          ))}
        </div>
      </div>

      <AutoCoachPanel />
      <CheckinsPendientes />

      {/* ── Nuevos clientes + Consultas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

        {/* Nuevos clientes */}
        <div className="card-glass card-hoverable">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendUp size={16} weight="fill" style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Nuevos clientes</h2>
            </div>
            {!analyticsLoading && analytics && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                +{analytics.nuevosClientesPorMes.reduce((s, d) => s + d.valor, 0)} total
              </span>
            )}
          </div>
          {analyticsLoading ? (
            <div className="skeleton h-20 w-full" />
          ) : !analytics || analytics.nuevosClientesPorMes.every(d => d.valor === 0) ? (
            <div className="text-center py-6">
              <TrendUp size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin clientes nuevos aún</p>
              <Link href="/clientes/nuevo" className="btn btn-ghost btn-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                <Plus size={14} /> Añadir cliente
              </Link>
            </div>
          ) : (
            <BarChart
              data={analytics.nuevosClientesPorMes.map(d => ({ label: d.mes, valor: d.valor }))}
              height={90}
              color="var(--accent)"
            />
          )}
        </div>

        {/* Consultas pendientes */}
        <div className="card-glass card-hoverable">
          <div className="flex items-center gap-2 mb-4">
            <ChatCircle size={16} weight="fill" style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Consultas pendientes</h2>
          </div>
          {analyticsLoading ? (
            <div className="skeleton h-20 w-full" />
          ) : !analytics || analytics.distribucionRespuestas.every(d => d.valor === 0) ? (
            <div className="text-center py-6">
              <ChatCircle size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin respuestas de cuestionarios</p>
              <Link href="/cuestionarios" className="btn btn-ghost btn-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                <Plus size={14} /> Crear cuestionario
              </Link>
            </div>
          ) : (
            <StackedBar
              items={analytics.distribucionRespuestas.map(d => ({ label: d.label, valor: d.valor, color: d.color }))}
              total={analytics.distribucionRespuestas.reduce((s, d) => s + d.valor, 0)}
              height={20}
            />
          )}
          {!analyticsLoading && analytics && analytics.distribucionRespuestas.some(d => d.valor > 0) && (
            <div className="flex items-center gap-4 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <MiniDonut
                data={analytics.distribucionRespuestas.filter(d => d.valor > 0).map(d => ({ label: d.label, valor: d.valor, color: d.color }))}
                size={36}
                innerRadius={12}
              />
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                {analytics.distribucionRespuestas.filter(d => d.valor > 0).map(d => (
                  <div key={d.estado} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
                    <span style={{ color: 'var(--text-muted)' }}>{d.label}</span>
                    <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{d.valor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Próximas revisiones + Estado ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">

        {/* Próximas revisiones — span 2 */}
        <div className="lg:col-span-2 card-glass card-hoverable">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarBlank size={16} weight="fill" style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Próximas revisiones</h2>
            </div>
            <Link href="/clientes" className="btn btn-ghost btn-sm text-xs">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-12 w-full rounded-xl" />)}
            </div>
          ) : revisionesProximas.length === 0 ? (
            <div className="text-center py-8">
              <CalendarBlank size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay revisiones programadas</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Establece la fecha en el perfil de cada cliente
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {revisionesProximas.map(r => {
                const fechaRev = new Date(r.fecha)
                const diasRestantes = Math.ceil((fechaRev.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                const esUrgente = diasRestantes <= 3
                const esHoy = diasRestantes <= 0
                return (
                  <Link
                    key={r.id}
                    href={`/clientes/${r.id}`}
                    className="flex items-center justify-between p-3 rounded-xl transition-all duration-150"
                    style={{ background: 'var(--surface-hover)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: esHoy ? 'var(--error)' : esUrgente ? '#FF9F0A' : 'var(--success)' }}
                      />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                          {r.nombre} {r.apellidos}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {fechaRev.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: esHoy ? 'var(--error-bg)' : esUrgente ? 'rgba(255,159,10,0.1)' : 'var(--surface-elevated)',
                          color: esHoy ? 'var(--error)' : esUrgente ? '#FF9F0A' : 'var(--text-muted)',
                        }}
                      >
                        {esHoy ? 'Hoy' : `${diasRestantes}d`}
                      </span>
                      <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Estado — span 1 */}
        <div className="card-glass">
          <div className="flex items-center gap-1.5 mb-4">
            <Warning size={13} weight="fill" style={{ color: 'var(--text-muted)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Estado
            </span>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-2.5">

              {/* Clientes sin dieta */}
              <Link
                href="/clientes"
                className="flex items-center gap-3 p-3 rounded-xl transition-all duration-150"
                style={{ background: stats.clientesSinDieta > 0 ? 'var(--error-bg)' : 'var(--surface-hover)' }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: stats.clientesSinDieta > 0 ? 'rgba(255,69,58,0.15)' : 'var(--surface-elevated)' }}
                >
                  <Users
                    size={15}
                    weight="fill"
                    style={{ color: stats.clientesSinDieta > 0 ? 'var(--error)' : 'var(--text-muted)' }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate"
                    style={{ color: stats.clientesSinDieta > 0 ? 'var(--error)' : 'var(--text-secondary)' }}>
                    {stats.clientesSinDieta} sin dieta
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {stats.clientesSinDieta > 0 ? 'Asigna un plan' : 'Todos con plan'}
                  </p>
                </div>
              </Link>

              {/* Respuestas pendientes */}
              <Link
                href="/respuestas"
                className="flex items-center gap-3 p-3 rounded-xl transition-all duration-150"
                style={{ background: stats.respuestasPendientes > 0 ? 'rgba(255,159,10,0.08)' : 'var(--surface-hover)' }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: stats.respuestasPendientes > 0 ? 'rgba(255,159,10,0.12)' : 'var(--surface-elevated)' }}
                >
                  <ChatCircle
                    size={15}
                    weight="fill"
                    style={{ color: stats.respuestasPendientes > 0 ? '#FF9F0A' : 'var(--text-muted)' }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate"
                    style={{ color: stats.respuestasPendientes > 0 ? '#FF9F0A' : 'var(--text-secondary)' }}>
                    {stats.respuestasPendientes} pendientes
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {stats.respuestasPendientes > 0 ? 'Revisar consultas' : 'Al día'}
                  </p>
                </div>
              </Link>

              {/* Sin onboarding */}
              {stats.clientesSinOnboarding > 0 && (
                <Link
                  href="/clientes"
                  className="flex items-center gap-3 p-3 rounded-xl transition-all duration-150"
                  style={{ background: 'rgba(245,158,11,0.08)' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,0.12)' }}>
                    <ClipboardText size={15} weight="fill" style={{ color: '#d97706' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#d97706' }}>
                      {stats.clientesSinOnboarding} sin onboarding
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Perfil incompleto</p>
                  </div>
                </Link>
              )}

              {/* Todo al día */}
              {stats.clientesSinDieta === 0 && stats.respuestasPendientes === 0 && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl"
                  style={{ background: 'rgba(48,209,88,0.08)' }}>
                  <CheckCircle size={16} weight="fill" style={{ color: 'var(--success)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>Todo al día</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Próximas competiciones ── */}
      {!loading && competicionesProximas.length > 0 && (
        <div className="card-glass mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy size={16} weight="fill" style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Próximas competiciones</h2>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
              {competicionesProximas.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {competicionesProximas.map(c => {
              const dias = Math.ceil((new Date(c.fecha_competicion).getTime() - Date.now()) / 86400000)
              const tapering = dias <= 7
              return (
                <Link
                  key={c.id}
                  href={`/clientes/${c.cliente_id}`}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all duration-150"
                  style={{ background: tapering ? 'rgba(255,159,10,0.07)' : 'var(--surface-hover)' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: tapering ? 'rgba(255,159,10,0.15)' : 'var(--surface-elevated)' }}>
                    <Trophy size={14} weight="fill"
                      style={{ color: tapering ? '#FF9F0A' : 'var(--text-muted)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                      {c.nombre}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {c.clienteNombre}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: tapering ? 'rgba(255,159,10,0.15)' : 'var(--surface-elevated)',
                      color: tapering ? '#FF9F0A' : 'var(--text-muted)',
                    }}>
                    {dias === 0 ? '¡Hoy!' : `${dias}d`}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {analytics && (
        <div className="text-center text-[10px] pb-8" style={{ color: 'var(--text-muted)' }}>
          Actualizado {new Date(analytics.timestamp).toLocaleString('es-ES')}
        </div>
      )}
    </main>
  )
}
