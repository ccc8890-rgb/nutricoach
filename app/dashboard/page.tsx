'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import {
  Users,
  UtensilsCrossed,
  MessageSquareReply,
  TrendingUp,
  ArrowRight,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Heart,
  ClipboardCheck,
  Award,
  Target,
  Plus,
  Sparkles,
} from 'lucide-react'
// ── Dynamic imports (charts solo se cargan cuando se usan) ──
import { SkeletonChart } from '@/components/ui/Skeleton'
import { CountUp } from '@/components/ui/CountUp'
import { FadeIn, StaggerList, StaggerItem } from '@/components/ui/Motion'
import { StatCardPremium } from '@/components/premium'
import { MiniSparkline } from '@/components/dashboard/MiniSparkline'

const LineChart = dynamic(() => import('@/components/dashboard/LineChart'), {
  loading: () => <SkeletonChart height={120} />,
  ssr: false,
})

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

/** Resultado del SELECT con join a profiles */
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

// ── STAT CARDS ──

interface StatCardConfig {
  label: string
  key: keyof Stats
  icon: typeof Users
  accent: string
  /** Datos mock de tendencia para sparkline (simula variación sobre ~12 periodos) */
  trend?: number[]
}

const STAT_CARDS: StatCardConfig[] = [
  {
    label: 'Clientes', key: 'totalClientes' as const, icon: Users, accent: 'var(--accent)',
    trend: [4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 9, 10]
  },
  {
    label: 'Dietas activas', key: 'dietasActivas' as const, icon: UtensilsCrossed, accent: 'var(--accent-light)',
    trend: [2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8]
  },
  {
    label: 'Respuestas pendientes', key: 'respuestasPendientes' as const, icon: MessageSquareReply, accent: 'var(--accent)',
    trend: [1, 2, 1, 3, 2, 4, 3, 2, 5, 4, 3, 6]
  },
  {
    label: 'Nuevas hoy', key: 'respuestasNuevas' as const, icon: TrendingUp, accent: 'var(--info)',
    trend: [0, 1, 0, 2, 1, 0, 3, 1, 2, 0, 1, 2]
  },
]

// ── Página Principal ──

export default function DashboardPage() {
  const { addToast } = useToast()
  const [stats, setStats] = useState<Stats>({
    totalClientes: 0, totalDietas: 0,
    respuestasPendientes: 0, respuestasNuevas: 0,
    clientesConDieta: 0, clientesSinDieta: 0,
    dietasActivas: 0, dietasInactivas: 0,
  })
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [revisionesProximas, setRevisionesProximas] = useState<{ id: string; nombre: string; apellidos: string; fecha: string }[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) console.error('[dashboard] Error auth.getUser:', userError)
        if (!user) { console.warn('[dashboard] No hay usuario autenticado'); setLoading(false); return }

        const [resClientes, resDietas, resRespuestas] = await Promise.all([
          supabase.from('clientes').select('id, profile:profiles!profile_id(nombre, apellidos, email), fecha_proxima_revision, created_at', { count: 'exact' }).eq('coach_id', user.id),
          supabase.from('planes_nutricion').select('id, nombre, activo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo, kcal_objetivo, cliente_id, created_at', { count: 'exact' }).eq('coach_id', user.id),
          supabase.from('respuestas_clientes').select('id, estado, created_at').eq('coach_id', user.id),
        ])

        if (resClientes.error) console.error('[dashboard] Error clientes:', resClientes.error.message, resClientes.error.details)
        if (resDietas.error) console.error('[dashboard] Error dietas:', resDietas.error.message, resDietas.error.details)
        if (resRespuestas.error) console.error('[dashboard] Error respuestas:', resRespuestas.error.message, resRespuestas.error.details)

        const clientesData = resClientes.data ?? []
        const dietasData = resDietas.data ?? []
        const totalClientes = resClientes.count ?? 0
        const totalDietas = resDietas.count ?? 0
        const dietasActivas = dietasData.filter(d => d.activo).length
        const dietasInactivas = totalDietas - dietasActivas
        const clientesConDieta = new Set(dietasData.filter(d => d.cliente_id).map(d => d.cliente_id)).size
        const clientesSinDieta = totalClientes - clientesConDieta

        const resps = resRespuestas.data ?? []
        const respuestasPendientes = resps.filter(r => r.estado === 'nueva' || r.estado === 'dieta_rechazada').length

        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        const respuestasNuevas = resps.filter(r => {
          const d = new Date(r.created_at)
          return d >= hoy
        }).length

        setStats({ totalClientes, totalDietas, respuestasPendientes, respuestasNuevas, clientesConDieta, clientesSinDieta, dietasActivas, dietasInactivas })

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

        setClientes(clientesData as unknown as ClienteRow[])
      } catch (e) {
        console.error('[dashboard] Excepción en load:', e)
      }
      setLoading(false)
    }
    load()
  }, [])

  // ── Cargar analytics ──
  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await fetch('/api/dashboard/analytics')
        if (res.ok) {
          const data = await res.json()
          setAnalytics(data)
        }
      } catch (e) {
        console.error('Error loading analytics:', e)
        addToast({ type: 'error', title: 'Error', message: 'No se pudieron cargar las analíticas' })
      } finally {
        setAnalyticsLoading(false)
      }
    }
    loadAnalytics()
  }, [])

  const a = analytics?.totales
  const loadingA = analyticsLoading
  const analyticsData = analytics

  return (
    <main className="flex-1 p-8 max-w-7xl">
      {/* Header — premium con glow y Sparkles animado */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Dashboard</h1>
              <Sparkles size={18} className="animate-spin-slow" style={{ color: 'var(--accent)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Panel de control con analytics avanzados</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/clientes/nuevo" className="btn btn-primary btn-sm">
              + Nuevo cliente
            </Link>
            <Link href="/dietas/nueva" className="btn btn-ghost btn-sm">
              + Nueva dieta
            </Link>
          </div>
        </div>
      </header>

      {/* ═══ BENTO GRID — STATS CARDS PREMIUM con sparklines ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map(({ label, key, icon: Icon, accent, trend }) => {
          const value = stats[key]
          const idx = STAT_CARDS.findIndex(s => s.key === key)
          return (
            <div
              key={key}
              className="card-glass card-hoverable animate-fade-in"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--accent-bg)' }}
                >
                  <Icon size={20} style={{ color: accent }} />
                </div>
                {/* Mini sparkline de tendencia */}
                {trend && !loading && (
                  <MiniSparkline data={trend} width={64} height={24} color={accent} />
                )}
              </div>
              {loading ? (
                <div className="space-y-2">
                  <div className="skeleton h-8 w-16" />
                  <div className="skeleton h-4 w-24" />
                </div>
              ) : (
                <>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                    <CountUp to={value as number} />
                  </p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* ═══ BENTO GRID — FILA 1: Tendencia (span 2) + Quick stats ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Tendencia check-ins — span 2 columnas (destacado) */}
        <div className="lg:col-span-2 card-glass card-hoverable">
          <div className="flex items-center gap-2 mb-4">
            <Heart size={18} style={{ color: 'var(--error)' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Tendencia de check-ins</h2>
            {!loadingA && analyticsData && (
              <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                {analyticsData.tendenciaCheckins.reduce((s, d) => s + d.total, 0)} check-ins totales
              </span>
            )}
          </div>
          {loadingA ? (
            <div className="skeleton h-24 w-full" />
          ) : !analyticsData || analyticsData.tendenciaCheckins.every(d => d.total === 0) ? (
            <div className="text-center py-6">
              <Heart size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aún no hay check-ins registrados</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Los clientes harán check-in desde su portal
              </p>
            </div>
          ) : (
            <LineChart
              data={analyticsData.tendenciaCheckins.map(d => ({
                label: d.label,
                valor: d.adherenciaPromedio,
                valor2: d.energiaPromedio,
                valor3: d.suenoPromedio,
              }))}
              height={90}
              color="#30D158"
              color2="var(--accent)"
              color3="var(--info)"
              showDots={true}
              labels={{ label1: 'Adherencia', label2: 'Energía', label3: 'Sueño' }}
            />
          )}
        </div>

        {/* Quick stats — columna lateral */}
        <div className="flex flex-col gap-3">
          {!loadingA && analyticsData ? (
            <>
              <div className="card-glass flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-bg)' }}>
                  <ClipboardCheck size={17} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                    <CountUp to={a?.totalCheckins ?? 0} />
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Check-ins totales</p>
                </div>
              </div>
              <div className="card-glass flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--info-bg)' }}>
                  <MessageSquareReply size={17} style={{ color: 'var(--info)' }} />
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                    <CountUp to={a?.totalRespuestas ?? 0} />
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Respuestas totales</p>
                </div>
              </div>
              <div className="card-glass flex items-center gap-3"
                style={{ borderColor: a && a.clientesSinDieta > 0 ? 'rgba(255,69,58,0.2)' : undefined }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--error-bg)' }}>
                  <Users size={17} style={{ color: 'var(--error)' }} />
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: a && a.clientesSinDieta > 0 ? 'var(--error)' : 'var(--text)' }}>
                    {a?.clientesSinDieta ?? 0}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Clientes sin dieta</p>
                </div>
              </div>
            </>
          ) : loadingA ? (
            <>
              {[1, 2, 3].map(i => <div key={i} className="card-glass skeleton h-[60px]" />)}
            </>
          ) : null}
        </div>
      </div>

      {/* ═══ BENTO GRID — FILA 2: Nuevos clientes + Consultas ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Nuevos clientes por mes */}
        <div className="card-glass card-hoverable">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={17} style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Nuevos clientes</h2>
            </div>
            {!loadingA && analyticsData && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                +{analyticsData.nuevosClientesPorMes.reduce((s, d) => s + d.valor, 0)} total
              </span>
            )}
          </div>
          {loadingA ? (
            <div className="skeleton h-20 w-full" />
          ) : !analyticsData || analyticsData.nuevosClientesPorMes.every(d => d.valor === 0) ? (
            <div className="text-center py-6">
              <TrendingUp size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin clientes nuevos aún</p>
              <Link href="/clientes/nuevo" className="btn btn-ghost btn-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                <Plus size={14} /> Añadir cliente
              </Link>
            </div>
          ) : (
            <BarChart
              data={analyticsData.nuevosClientesPorMes.map(d => ({ label: d.mes, valor: d.valor }))}
              height={90}
              color="var(--accent)"
            />
          )}
        </div>

        {/* Consultas pendientes */}
        <div className="card-glass card-hoverable">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquareReply size={17} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Consultas pendientes</h2>
          </div>
          {loadingA ? (
            <div className="skeleton h-20 w-full" />
          ) : !analyticsData || analyticsData.distribucionRespuestas.every(d => d.valor === 0) ? (
            <div className="text-center py-6">
              <MessageSquareReply size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin respuestas de cuestionarios</p>
              <Link href="/cuestionarios" className="btn btn-ghost btn-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                <Plus size={14} /> Crear cuestionario
              </Link>
            </div>
          ) : (
            <StackedBar
              items={analyticsData.distribucionRespuestas.map(d => ({
                label: d.label,
                valor: d.valor,
                color: d.color,
              }))}
              total={analyticsData.distribucionRespuestas.reduce((s, d) => s + d.valor, 0)}
              height={20}
            />
          )}
          {/* Mini donut + leyenda compacta */}
          {!loadingA && analyticsData && analyticsData.distribucionRespuestas.some(d => d.valor > 0) && (
            <div className="flex items-center gap-4 mt-4 pt-3 border-t"
              style={{ borderColor: 'var(--border)' }}>
              <MiniDonut
                data={analyticsData.distribucionRespuestas.filter(d => d.valor > 0).map(d => ({
                  label: d.label,
                  valor: d.valor,
                  color: d.color,
                }))}
                size={36}
                innerRadius={12}
              />
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                {analyticsData.distribucionRespuestas.filter(d => d.valor > 0).map(d => (
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

      {/* ═══ BENTO GRID — FILA 3: Clientes dieta + Dietas por cliente ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Clientes con/sin dieta */}
        <div className="card-glass card-hoverable">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={17} style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Clientes con dieta asignada</h2>
            </div>
          </div>
          {loading ? (
            <div className="skeleton h-12 w-full" />
          ) : stats.totalClientes === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>Sin clientes todavía</p>
          ) : (
            <div className="space-y-3">
              <div className="flex rounded-full overflow-hidden h-4">
                <div className="transition-all duration-500"
                  style={{
                    width: `${(stats.clientesConDieta / stats.totalClientes) * 100}%`,
                    background: 'var(--accent)',
                  }} />
                <div className="transition-all duration-500"
                  style={{
                    width: `${(stats.clientesSinDieta / stats.totalClientes) * 100}%`,
                    background: 'var(--border)',
                  }} />
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Con dieta</span>
                  <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>{stats.clientesConDieta}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--border)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Sin dieta</span>
                  <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>{stats.clientesSinDieta}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Distribución de dietas por cliente */}
        <div className="card-glass card-hoverable">
          <div className="flex items-center gap-2 mb-4">
            <Target size={17} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Dietas por cliente</h2>
          </div>
          {loadingA ? (
            <div className="skeleton h-20 w-full" />
          ) : !analyticsData ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>Sin datos</p>
          ) : (
            <div className="space-y-4">
              <StackedBar
                items={[
                  { label: 'Sin dieta', valor: analyticsData.distribucionDietas.sinDietas, color: 'var(--border)' },
                  { label: '1 dieta', valor: analyticsData.distribucionDietas.con1Dieta, color: 'var(--text-secondary)' },
                  { label: '2-3 dietas', valor: analyticsData.distribucionDietas.con2a3Dietas, color: 'var(--accent)' },
                  { label: '+3 dietas', valor: analyticsData.distribucionDietas.conMasDe3, color: 'var(--accent-dark)' },
                ]}
                total={analyticsData.totales.totalClientes}
                height={16}
              />
              {analyticsData.totales.totalClientes === 0 && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Sin clientes</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ BENTO GRID — FILA 4: Top clientes + Sin actividad ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Top clientes por check-ins */}
        <div className="card-glass card-hoverable">
          <div className="flex items-center gap-2 mb-4">
            <Award size={17} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Top clientes más activos</h2>
          </div>
          {loadingA ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-8 w-full" />)}
            </div>
          ) : !analyticsData || analyticsData.topClientesCheckins.length === 0 ? (
            <div className="text-center py-6">
              <Award size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin check-ins registrados</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Disponible cuando los clientes usen su portal</p>
            </div>
          ) : (
            <div className="space-y-1">
              {analyticsData.topClientesCheckins.map((c, i) => (
                <Link key={c.id} href={`/clientes/${c.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg transition-colors"
                  style={{ background: 'transparent' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: i === 0 ? 'var(--accent)' : i === 1 ? 'var(--surface-hover)' : 'var(--surface-elevated)',
                        color: i === 0 ? '#1C1C1E' : 'var(--text-muted)',
                      }}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{c.nombre} {c.apellidos}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ClipboardCheck size={12} style={{ color: 'var(--accent)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{c.totalCheckins}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Clientes sin actividad reciente */}
        <div className="card-glass card-hoverable">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={17} style={{ color: 'var(--error)' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Clientes sin check-in (7 días)</h2>
            {!loadingA && analyticsData && (
              <span className="text-xs ml-auto font-semibold" style={{ color: 'var(--error)' }}>
                {analyticsData.clientesSinActividadReciente.length}
              </span>
            )}
          </div>
          {loadingA ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-8 w-full" />)}
            </div>
          ) : !analyticsData || analyticsData.clientesSinActividadReciente.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: 'var(--success)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>¡Todos los clientes han hecho check-in!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Ningún cliente inactivo en los últimos 7 días</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {analyticsData.clientesSinActividadReciente.map(c => (
                <Link key={c.id} href={`/clientes/${c.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg transition-colors"
                  style={{ background: 'transparent' }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--error)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{c.nombre} {c.apellidos}</p>
                  <ArrowRight size={12} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ BENTO GRID — FILA 5: Próximas revisiones + Clientes recientes ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Próximas revisiones */}
        <div className="card-glass card-hoverable">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={17} style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Próximas revisiones</h2>
            </div>
            <Link href="/clientes" className="btn btn-ghost btn-sm text-xs">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="skeleton h-10 w-full" />)}
            </div>
          ) : revisionesProximas.length === 0 ? (
            <div className="text-center py-6">
              <CalendarDays size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay revisiones programadas</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Establece una fecha de revisión en el perfil de cada cliente</p>
            </div>
          ) : (
            <div className="space-y-2">
              {revisionesProximas.map(r => {
                const fechaRev = new Date(r.fecha)
                const diasRestantes = Math.ceil((fechaRev.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                const esUrgente = diasRestantes <= 3
                const esHoy = diasRestantes <= 0
                return (
                  <Link key={r.id} href={`/clientes/${r.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg transition-colors"
                    style={{ background: 'transparent' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full"
                        style={{ background: esHoy ? 'var(--error)' : esUrgente ? 'var(--accent)' : 'var(--success)' }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{r.nombre} {r.apellidos}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {fechaRev.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold"
                      style={{ color: esHoy || esUrgente ? 'var(--error)' : 'var(--text-muted)' }}>
                      {esHoy ? 'Hoy' : `${diasRestantes}d`}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Clientes recientes */}
        <div className="card-glass card-hoverable">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Clientes recientes</h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Últimos registrados</p>
            </div>
            <Link href="/clientes" className="btn btn-ghost btn-sm">
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <div className="skeleton h-4 w-32" />
                    <div className="skeleton h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : clientes.length === 0 ? (
            <div className="text-center py-8">
              <Users size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Aún no tienes clientes</p>
              <Link href="/clientes/nuevo" className="btn btn-primary btn-sm">
                Añadir primer cliente
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {clientes.slice(0, 5).map(c => (
                <Link key={c.id} href={`/clientes/${c.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg transition-colors"
                  style={{ background: 'transparent' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
                      color: '#1C1C1E',
                    }}>
                    {(c.profile?.nombre?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {c.profile?.nombre || 'Sin nombre'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.profile?.email || ''}</p>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer info */}
      {analyticsData && (
        <div className="text-center text-[10px] pb-8" style={{ color: 'var(--text-muted)' }}>
          Última actualización: {new Date(analyticsData.timestamp).toLocaleString('es-ES')}
        </div>
      )}
    </main>
  )
}
