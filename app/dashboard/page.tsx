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
} from 'lucide-react'
// ── Dynamic imports (charts solo se cargan cuando se usan) ──
import { SkeletonChart } from '@/components/ui/Skeleton'
import { CountUp } from '@/components/ui/CountUp'
import { FadeIn, StaggerList, StaggerItem } from '@/components/ui/Motion'

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

// ── StatCard reutilizable (para analytics) ──

function StatCard({ label, value, icon: Icon, color, sublabel }: {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
  sublabel?: string
}) {
  return (
    <div className="card flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}15` }}>
        <Icon size={21} style={{ color }} />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">
          {typeof value === 'number' ? <CountUp to={value} /> : value}
        </p>
        <p className="text-xs text-gray-500">{label}</p>
        {sublabel && <p className="text-[10px] text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  )
}

// ── STAT CARDS (definición de las 4 cards principales) ──

const STAT_CARDS = [
  { label: 'Clientes', key: 'totalClientes' as const, icon: Users, iconColor: '#1C1C1E' },
  { label: 'Dietas activas', key: 'dietasActivas' as const, icon: UtensilsCrossed, iconColor: '#3A3A3C' },
  { label: 'Respuestas pendientes', key: 'respuestasPendientes' as const, icon: MessageSquareReply, iconColor: '#F59E0B' },
  { label: 'Nuevas hoy', key: 'respuestasNuevas' as const, icon: TrendingUp, iconColor: '#3B82F6' },
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

        // Log errores individuales
        if (resClientes.error) console.error('[dashboard] Error clientes:', resClientes.error.message, resClientes.error.details)
        if (resDietas.error) console.error('[dashboard] Error dietas:', resDietas.error.message, resDietas.error.details)
        if (resRespuestas.error) console.error('[dashboard] Error respuestas:', resRespuestas.error.message, resRespuestas.error.details)

        console.log(`[dashboard] Clientes: ${resClientes.count ?? 0}, Dietas: ${resDietas.count ?? 0}, Respuestas: ${resRespuestas.count ?? 0}`)

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
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Panel de control completo con analytics avanzados</p>
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

      {/* ═══ STATS CARDS (2 filas) ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map(({ label, key, icon: Icon, iconColor }) => {
          const value = stats[key]
          return (
            <div key={key} className="card animate-fade-in"
              style={{ animationDelay: `${STAT_CARDS.findIndex(s => s.key === key) * 80}ms` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F2F2F7' }}>
                  <Icon size={20} style={{ color: iconColor }} />
                </div>
              </div>
              {loading ? (
                <div className="space-y-2">
                  <div className="skeleton h-8 w-16" />
                  <div className="skeleton h-4 w-24" />
                </div>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-900"><CountUp to={value as number} /></p>
                  <p className="text-sm text-gray-500 mt-1">{label}</p>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* ═══ QUICK STATS (analytics) ═══ */}
      {!loadingA && analyticsData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Check-ins totales" value={a?.totalCheckins ?? 0} icon={ClipboardCheck} color="#1C1C1E" />
          <StatCard label="Respuestas totales" value={a?.totalRespuestas ?? 0} icon={MessageSquareReply} color="#8B5CF6" />
          <StatCard label="Dietas inactivas" value={a?.totalDietasInactivas ?? 0} icon={UtensilsCrossed} color="#F59E0B" />
          <StatCard label="Clientes sin dieta" value={a?.clientesSinDieta ?? 0} icon={Users} color="#EF4444" sublabel={a ? `de ${a.totalClientes} totales` : undefined} />
        </div>
      )}

      {/* ═══ FILA 1: Tendencia check-ins (full width) ═══ */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        {/* Tendencia de check-ins (adherencia, energía, sueño) */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Heart size={18} style={{ color: '#EF4444' }} />
            <h2 className="text-sm font-bold text-gray-900">Tendencia de check-ins</h2>
            {!loadingA && analyticsData && (
              <span className="text-xs text-gray-400 ml-auto">
                {analyticsData.tendenciaCheckins.reduce((s, d) => s + d.total, 0)} check-ins
              </span>
            )}
          </div>
          {loadingA ? (
            <div className="skeleton h-24 w-full" />
          ) : !analyticsData || analyticsData.tendenciaCheckins.every(d => d.total === 0) ? (
            <div className="text-center py-6">
              <Heart size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Aún no hay check-ins registrados</p>
              <p className="text-xs text-gray-300 mt-1">Los clientes harán check-in desde su portal: <span className="font-mono bg-gray-100 px-1 rounded text-gray-700">/cliente/[código]</span></p>
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
              color="#10B981"
              color2="#F59E0B"
              color3="#8B5CF6"
              showDots={true}
              labels={{ label1: 'Adherencia', label2: 'Energía', label3: 'Sueño' }}
            />
          )}
        </div>
      </div>

      {/* ═══ FILA 3: Nuevos clientes por mes + Estado respuestas ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Nuevos clientes por mes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} style={{ color: '#1C1C1E' }} />
              <h2 className="text-sm font-bold text-gray-900">Nuevos clientes</h2>
            </div>
            {!loadingA && analyticsData && (
              <span className="text-xs text-gray-400">
                +{analyticsData.nuevosClientesPorMes.reduce((s, d) => s + d.valor, 0)} total
              </span>
            )}
          </div>
          {loadingA ? (
            <div className="skeleton h-20 w-full" />
          ) : !analyticsData || analyticsData.nuevosClientesPorMes.every(d => d.valor === 0) ? (
            <div className="text-center py-6">
              <TrendingUp size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Sin clientes nuevos aún</p>
              <Link href="/clientes/nuevo" className="btn btn-ghost btn-sm mt-2 text-gray-700">
                <Plus size={14} /> Añadir cliente
              </Link>
            </div>
          ) : (
            <BarChart
              data={analyticsData.nuevosClientesPorMes.map(d => ({ label: d.mes, valor: d.valor }))}
              height={90}
              color="#1C1C1E"
            />
          )}
        </div>

        {/* Consultas pendientes */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquareReply size={18} style={{ color: '#8B5CF6' }} />
            <h2 className="text-sm font-bold text-gray-900">Consultas pendientes</h2>
          </div>
          {loadingA ? (
            <div className="skeleton h-20 w-full" />
          ) : !analyticsData || analyticsData.distribucionRespuestas.every(d => d.valor === 0) ? (
            <div className="text-center py-6">
              <MessageSquareReply size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Sin respuestas de cuestionarios</p>
              <Link href="/cuestionarios" className="btn btn-ghost btn-sm mt-2 text-gray-700">
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
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
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
                    <span className="text-gray-500">{d.label}</span>
                    <span className="font-medium text-gray-700">{d.valor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ FILA 4: Clientes con/sin dieta + Distribución dietas por cliente ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Clientes con/sin dieta (existente) */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={18} style={{ color: '#1C1C1E' }} />
              <h2 className="text-sm font-bold text-gray-900">Clientes con dieta asignada</h2>
            </div>
          </div>
          {loading ? (
            <div className="skeleton h-12 w-full" />
          ) : stats.totalClientes === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin clientes todavía</p>
          ) : (
            <div className="space-y-3">
              <div className="flex rounded-full overflow-hidden h-4">
                <div className="transition-all duration-500"
                  style={{
                    width: `${(stats.clientesConDieta / stats.totalClientes) * 100}%`,
                    background: 'linear-gradient(135deg, #1C1C1E, #3A3A3C)',
                  }} />
                <div className="transition-all duration-500"
                  style={{
                    width: `${(stats.clientesSinDieta / stats.totalClientes) * 100}%`,
                    background: '#E2E8F0',
                  }} />
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#1C1C1E' }} />
                  <span className="text-gray-500">Con dieta</span>
                  <span className="font-bold text-gray-800">{stats.clientesConDieta}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#E2E8F0' }} />
                  <span className="text-gray-500">Sin dieta</span>
                  <span className="font-bold text-gray-800">{stats.clientesSinDieta}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Distribución de dietas por cliente */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} style={{ color: '#1C1C1E' }} />
            <h2 className="text-sm font-bold text-gray-900">Dietas por cliente</h2>
          </div>
          {loadingA ? (
            <div className="skeleton h-20 w-full" />
          ) : !analyticsData ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin datos</p>
          ) : (
            <div className="space-y-4">
              <StackedBar
                items={[
                  { label: 'Sin dieta', valor: analyticsData.distribucionDietas.sinDietas, color: '#E2E8F0' },
                  { label: '1 dieta', valor: analyticsData.distribucionDietas.con1Dieta, color: '#1C1C1E' },
                  { label: '2-3 dietas', valor: analyticsData.distribucionDietas.con2a3Dietas, color: '#3A3A3C' },
                  { label: '+3 dietas', valor: analyticsData.distribucionDietas.conMasDe3, color: '#000000' },
                ]}
                total={analyticsData.totales.totalClientes}
                height={16}
              />
              {analyticsData.totales.totalClientes === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin clientes</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ FILA 5: Top clientes check-ins + Clientes sin actividad ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top clientes por check-ins */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} style={{ color: '#F59E0B' }} />
            <h2 className="text-sm font-bold text-gray-900">Top clientes más activos</h2>
          </div>
          {loadingA ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-8 w-full" />)}
            </div>
          ) : !analyticsData || analyticsData.topClientesCheckins.length === 0 ? (
            <div className="text-center py-6">
              <Award size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Sin check-ins registrados</p>
              <p className="text-xs text-gray-300 mt-1">Disponible cuando los clientes usen su portal</p>
            </div>
          ) : (
            <div className="space-y-2">
              {analyticsData.topClientesCheckins.map((c, i) => (
                <Link key={c.id} href={`/clientes/${c.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white
                      ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-gray-300' : i === 2 ? 'bg-amber-700' : 'bg-gray-400'}`}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.nombre} {c.apellidos}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ClipboardCheck size={12} className="text-gray-500" />
                    <span className="text-xs font-semibold text-gray-700">{c.totalCheckins}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Clientes sin actividad reciente */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} style={{ color: '#EF4444' }} />
            <h2 className="text-sm font-bold text-gray-900">Clientes sin check-in (7 días)</h2>
            {!loadingA && analyticsData && (
              <span className="text-xs text-red-400 ml-auto font-semibold">
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
              <CheckCircle2 size={32} className="mx-auto text-green-400 mb-2" />
              <p className="text-sm text-green-600 font-medium">¡Todos los clientes han hecho check-in!</p>
              <p className="text-xs text-gray-400 mt-1">Ningún cliente inactivo en los últimos 7 días</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {analyticsData.clientesSinActividadReciente.map(c => (
                <Link key={c.id} href={`/clientes/${c.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-red-50 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  <p className="text-sm text-gray-700">{c.nombre} {c.apellidos}</p>
                  <ArrowRight size={12} className="text-gray-300 ml-auto" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ FILA 5: Próximas revisiones (full width) ═══ */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        {/* Próximas revisiones (existente) */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} style={{ color: '#7C3AED' }} />
              <h2 className="text-sm font-bold text-gray-900">Próximas revisiones</h2>
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
              <CalendarDays size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No hay revisiones programadas</p>
              <p className="text-xs text-gray-300 mt-1">Establece una fecha de revisión en el perfil de cada cliente</p>
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
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${esHoy ? 'bg-red-500' : esUrgente ? 'bg-amber-500' : 'bg-green-500'}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{r.nombre} {r.apellidos}</p>
                        <p className="text-xs text-gray-400">
                          {fechaRev.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold ${esHoy ? 'text-red-600' : esUrgente ? 'text-amber-600' : 'text-gray-400'}`}>
                      {esHoy ? 'Hoy' : `${diasRestantes}d`}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ FILA 7: Clientes recientes (full width, existente) ═══ */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Clientes recientes</h2>
            <p className="text-sm text-gray-500 mt-0.5">Últimos clientes registrados</p>
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
          <div className="text-center py-12">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 mb-3">Aún no tienes clientes</p>
            <Link href="/clientes/nuevo" className="btn btn-primary btn-sm">
              Añadir primer cliente
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {clientes.slice(0, 5).map(c => (
              <Link key={c.id} href={`/clientes/${c.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #1C1C1E, #3A3A3C)' }}>
                  {(c.profile?.nombre?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.profile?.nombre || 'Sin nombre'}</p>
                  <p className="text-xs text-gray-400">{c.profile?.email || ''}</p>
                </div>
                <ArrowRight size={14} className="text-gray-300" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer info */}
      {analyticsData && (
        <div className="text-center text-[10px] text-gray-400 pb-8">
          Última actualización: {new Date(analyticsData.timestamp).toLocaleString('es-ES')}
        </div>
      )}
    </main>
  )
}
