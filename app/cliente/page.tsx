'use client'
import { useEffect, useState, Suspense, type ComponentType } from 'react'
import useSWR, { SWRConfig, useSWRConfig } from 'swr'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { proveedorCachePersistente, borrarCachePortal, fetchJson } from '@/lib/cliente/cache-swr'
import {
  House, BookOpenText, ClipboardText, ChartLineUp, SignOut,
  ForkKnife, Barbell, Scales, Trophy, Sun, Moon, Gear,
  CaretRight, CaretLeft, X, TrendDown, TrendUp,
  ShoppingCart, ChatCircleDots, DeviceMobile,
} from '@phosphor-icons/react'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import { comidasDelDia, diaActualIndex } from '@/lib/nutricion/comidas-dia'
import type { Profile, Cliente, PlanNutricion, PlanEntrenamiento, ComidaAlimento, SeguimientoPeso } from '@/types'
import InstallBanner from '@/components/PortalCliente/InstallBanner'
// Un fallo de render en una pestaña no tumba el portal entero: muestra el error con botón de reintentar.
function aislar<P extends object>(Componente: ComponentType<P>): ComponentType<P> {
  return function Aislado(props: P) {
    return <ErrorBoundary><Componente {...props} /></ErrorBoundary>
  }
}

const GraficoPeso = aislar(dynamic(() => import('@/components/PortalCliente/GraficoPeso')))
const GaleriaFotosProgreso = aislar(dynamic(() => import('@/components/PortalCliente/GaleriaFotosProgreso')))
const MilestonesLogros = aislar(dynamic(() => import('@/components/PortalCliente/MilestonesLogros')))
const CheckInForm = aislar(dynamic(() => import('@/components/PortalCliente/CheckInForm')))
const HistorialCheckins = aislar(dynamic(() => import('@/components/PortalCliente/HistorialCheckins')))
const NotasCoach = aislar(dynamic(() => import('@/components/PortalCliente/NotasCoach')))
const TLSGauge = aislar(dynamic(() => import('@/components/PortalCliente/TLSGauge')))
const MiPlan = aislar(dynamic(() => import('@/components/PortalCliente/MiPlan')))
const EntrenoSubTabs = aislar(dynamic(() => import('@/components/training/EntrenoSubTabs')))
const ListaCompraPortal = aislar(dynamic(() => import('@/components/PortalCliente/ListaCompraPortal')))
const MisPlatos = aislar(dynamic(() => import('@/components/PortalCliente/MisPlatos')))
const RecetarioExplorador = aislar(dynamic(() => import('@/components/PortalCliente/RecetarioExplorador')))
const ChatPanel = aislar(dynamic(() => import('@/components/PortalCliente/ChatPanel')))
const AjustesTabs = aislar(dynamic(() => import('@/components/PortalCliente/AjustesTabs')))
import { useTheme } from '@/components/ThemeProvider'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

type Tab = 'hoy' | 'dieta' | 'entreno' | 'checkin' | 'progreso' | 'compra' | 'recetas' | 'chat' | 'perfil'
const TABS_VALIDOS: Tab[] = ['hoy', 'dieta', 'entreno', 'checkin', 'progreso', 'compra', 'recetas', 'chat', 'perfil']

function VolverAHoy({ setTab }: { setTab: (t: Tab) => void }) {
  return (
    <button
      onClick={() => setTab('hoy')}
      className="flex items-center gap-1.5 text-xs font-semibold"
      style={{ color: 'var(--text-muted)' }}
    >
      <CaretLeft size={14} /> Hoy
    </button>
  )
}

/* ── Macro ring SVG ─────────────────────────────── */
function MacroRing({
  value, max, color, size = 56, stroke = 5,
}: { value: number; max: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const dash = circ * pct
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.23,1,0.32,1)' }}
      />
    </svg>
  )
}

/* ── Macro pill ─────────────────────────────────── */
function MacroPill({ label, value, target, color, unit = 'g' }: {
  label: string; value: number; target: number; color: string; unit?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 cursor-default">
      <div className="relative">
        <MacroRing value={value} max={target} color={color} size={60} stroke={5} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-bold" style={{ color: 'var(--text)' }}>
            {value > 0 ? value.toFixed(0) : '—'}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] font-semibold tracking-wide uppercase" style={{ color }}>
          {label}
        </p>
        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
          / {target > 0 ? target.toFixed(0) : '—'}{unit}
        </p>
      </div>
    </div>
  )
}

/* ── Stat badge ─────────────────────────────────── */
function StatBadge({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--surface)' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="font-bold text-sm leading-tight" style={{ color: 'var(--text)' }}>{value}</p>
        {sub && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
  )
}

/* ── Empty state ────────────────────────────────── */
function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--surface)' }}>
        <Icon size={22} style={{ color: 'var(--text-muted)' }} />
      </div>
      <p className="text-sm max-w-[220px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{text}</p>
    </div>
  )
}

function LoadingPortal() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl animate-pulse" style={{ background: 'var(--surface-elevated)' }} />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 rounded-full animate-pulse" style={{ background: 'var(--surface-elevated)' }} />
            <div className="h-2 w-20 rounded-full animate-pulse" style={{ background: 'var(--surface)' }} />
          </div>
        </div>
        <div className="rounded-[1.75rem] p-5 space-y-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="h-3 w-36 rounded-full animate-pulse" style={{ background: 'var(--surface-elevated)' }} />
          <div className="h-12 w-40 rounded-2xl animate-pulse" style={{ background: 'var(--surface-elevated)' }} />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--bg-subtle)' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Carga inicial (SWR: se pinta desde caché y se revalida en segundo plano) ── */
interface PortalBootstrap {
  profile: Profile
  cliente: Cliente | null
  dieta: PlanNutricion | null
  entreno: PlanEntrenamiento | null
  peso: SeguimientoPeso[]
}

async function cargarPortal(): Promise<PortalBootstrap | null> {
  // getSession lee el token local (sin ida y vuelta a Auth); cada dato va por RLS o por API que
  // vuelve a validar al usuario. Todo lo demás se pide en paralelo en vez de en cascada.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) { window.location.replace('/login'); return null }

  fetch('/api/cliente/registrar-acceso', { method: 'POST' }).catch(() => {})

  // Bug real (revisión 27-09-2026): plan de dieta/entreno van por API con service role porque RLS
  // silencia los joins anidados desde el cliente (arrays vacíos sin error). No volver a joins directos.
  const [profRes, cliRes, dietaRes, entrenoRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('clientes').select('*').eq('profile_id', user.id).single().then(async r => ({
      ...r,
      peso: r.data
        ? await supabase.from('seguimiento_peso').select('*').eq('cliente_id', r.data.id)
            .order('fecha', { ascending: false }).limit(15)
        : null,
    })),
    fetch('/api/cliente/plan-nutricion-activo').then(r => r.ok ? r.json() : { plan: null }).catch(() => ({ plan: null })),
    fetch('/api/cliente/plan-entrenamiento-activo').then(r => r.ok ? r.json() : { plan: null }).catch(() => ({ plan: null })),
  ])

  const prof = profRes.data
  if (prof?.role === 'coach') { window.location.replace('/dashboard'); return null }

  const cli = cliRes.data
  if (cli && !cli.onboarding_completado) { window.location.replace('/onboarding'); return null }

  let dieta: PlanNutricion | null = null
  let entreno: PlanEntrenamiento | null = null
  if (cli && dietaRes.plan) {
    const ordenadas = ((dietaRes.plan as PlanNutricion).comidas ?? []).sort((a, b) => a.orden - b.orden)
    dieta = { ...dietaRes.plan as PlanNutricion, comidas: ordenadas }
  }
  if (cli && entrenoRes.plan) {
    const ordenadas = ((entrenoRes.plan as PlanEntrenamiento).sesiones ?? []).sort((a, b) => a.orden - b.orden)
    entreno = { ...entrenoRes.plan as PlanEntrenamiento, sesiones: ordenadas }
  }
  return {
    profile: prof as Profile,
    cliente: cli as Cliente | null,
    dieta,
    entreno,
    peso: cli ? (cliRes.peso?.data as SeguimientoPeso[] ?? []) : [],
  }
}

/* ── Main component ─────────────────────────────── */
function PortalClientePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme, toggleTheme } = useTheme()
  const [showBienvenida, setShowBienvenida] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [dieta, setDieta] = useState<PlanNutricion | null>(null)
  const [entreno, setEntreno] = useState<PlanEntrenamiento | null>(null)
  const [tab, setTab] = useState<Tab>(() => {
    const tabParam = searchParams.get('tab')
    return TABS_VALIDOS.includes(tabParam as Tab) ? (tabParam as Tab) : 'hoy'
  })
  const [subRecetas, setSubRecetas] = useState<'plan' | 'recetario' | null>(null)
  const [peso, setPeso] = useState('')
  const [notaPeso, setNotaPeso] = useState('')
  const [guardandoPeso, setGuardandoPeso] = useState(false)
  const [historialPeso, setHistorialPeso] = useState<SeguimientoPeso[]>([])
  const [checkinKey, setCheckinKey] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (searchParams.get('onboarding') === 'completo') {
      const visto = localStorage.getItem('bienvenida_vista')
      if (!visto) {
        setShowBienvenida(true)
        localStorage.setItem('bienvenida_vista', '1')
      }
    }
  }, [searchParams])

  // Cambiar de pestaña (barra inferior) solo movía el estado de React, nunca
  // la URL — el botón "Volver" de páginas como /cliente/receta/[id] sí
  // codifica `returnTo=/cliente?tab=X` y funciona, pero el gesto nativo de
  // "atrás" del móvil (o el botón del navegador) ignora ese returnTo y va a
  // la última URL real del historial, que siempre era /cliente sin `tab`
  // (o con el tab de cuando se cargó la app) — por eso aterrizaba en "Hoy"
  // aunque el cliente estuviera en Dieta/Entreno/Recetas. Mantener la URL
  // sincronizada con la pestaña activa hace que ese "atrás" nativo vuelva
  // al sitio correcto.
  // Pestañas ya visitadas: se quedan montadas (ocultas) para volver a ellas al instante, sin repetir peticiones.
  const [visitadas, setVisitadas] = useState<Set<Tab>>(() => new Set([tab]))
  useEffect(() => {
    setVisitadas(prev => (prev.has(tab) ? prev : new Set(prev).add(tab)))
  }, [tab])

  // Con el portal ya pintado, se descarga en segundo plano el código de las pestañas pesadas.
  useEffect(() => {
    if (loading) return
    const precargar = () => {
      import('@/components/PortalCliente/MiPlan')
      import('@/components/training/EntrenoSubTabs')
      import('@/components/PortalCliente/RecetarioExplorador')
      import('@/components/PortalCliente/AjustesTabs')
    }
    const id = window.setTimeout(precargar, 600)
    return () => window.clearTimeout(id)
  }, [loading])

  useEffect(() => {
    window.history.replaceState(window.history.state, '', `/cliente?tab=${tab}`)
  }, [tab])

  // `montado` evita desajuste de hidratación: el servidor pinta la pantalla de carga, y la caché
  // (localStorage) solo existe en el cliente.
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  const { mutate } = useSWRConfig()
  const { data: boot } = useSWR('portal:bootstrap', cargarPortal)

  useEffect(() => {
    if (!boot) return
    setProfile(boot.profile)
    setCliente(boot.cliente)
    setDieta(boot.dieta)
    setEntreno(boot.entreno)
    setHistorialPeso(boot.peso)
    setLoading(false)
  }, [boot])

  // Sesión cerrada o caducada: no puede quedar nada del cliente en el dispositivo.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(evento => {
      if (evento === 'SIGNED_OUT') borrarCachePortal()
    })
    return () => subscription.unsubscribe()
  }, [])

  // Con el portal pintado se calientan en segundo plano los datos de las pestañas pesadas,
  // para que la primera visita a cada una también sea instantánea.
  const codigoPlan = dieta?.codigo_publico ?? ''
  const hayEntreno = Boolean(entreno)
  useEffect(() => {
    if (loading) return
    const id = window.setTimeout(() => {
      const claves = [
        ...(hayEntreno ? ['/api/entrenos/semana-completa'] : []),
        ...(codigoPlan ? [`/api/cliente/${codigoPlan}/recetario?page=0`] : []),
      ]
      claves.forEach(k => {
        fetchJson(k).then(d => mutate(k, d, { revalidate: false })).catch(() => {})
      })
    }, 600)
    return () => window.clearTimeout(id)
  }, [loading, hayEntreno, codigoPlan, mutate])

  function comidasHoyDeDieta() {
    return comidasDelDia(dieta?.comidas, diaActualIndex())
  }

  // `Comida`/`PlanNutricion` en types/index.ts no declaran `receta` (el
  // embed que trae /api/cliente/plan-nutricion-activo) — mismo patrón ya
  // usado en MiPlan.tsx: tipo local en vez de tocar el tipo compartido.
  function recetasDelPlan(): { id: string; nombre: string; imagen_url: string | null; kcal: number | null; proteinas: number | null }[] {
    const comidas = (dieta?.comidas ?? []) as unknown as {
      receta_id?: string | null
      receta?: { id: string; nombre: string; imagen_url: string | null; kcal: number; proteinas: number } | null
    }[]
    const vistas = new Set<string>()
    const resultado: { id: string; nombre: string; imagen_url: string | null; kcal: number | null; proteinas: number | null }[] = []
    for (const c of comidas) {
      if (c.receta && !vistas.has(c.receta.id)) {
        vistas.add(c.receta.id)
        resultado.push(c.receta)
      }
    }
    return resultado
  }

  const recetaHref = (recetaId: string) =>
    `/cliente/receta/${recetaId}?codigo=${encodeURIComponent(codigo)}&returnTo=${encodeURIComponent('/cliente?tab=recetas')}`

  function calcMacrosDia() {
    if (!dieta) return null
    return sumarMacros(comidasHoyDeDieta().map(c =>
      sumarMacros((c.alimentos ?? []).map((a: ComidaAlimento) =>
        calcularMacrosPorCantidad(
          a.alimento?.calorias ?? 0, a.alimento?.proteinas ?? 0,
          a.alimento?.carbohidratos ?? 0, a.alimento?.grasas ?? 0,
          a.alimento?.fibra ?? 0, a.cantidad_gramos
        )
      ))
    ))
  }

  async function guardarPeso() {
    if (!peso || !cliente) return
    setGuardandoPeso(true)
    const { data } = await supabase.from('seguimiento_peso').insert({
      cliente_id: cliente.id,
      peso: parseFloat(peso),
      notas: notaPeso || null,
      fecha: new Date().toISOString().split('T')[0],
    }).select().single()
    if (data) setHistorialPeso(prev => [data, ...prev])
    setPeso('')
    setNotaPeso('')
    setGuardandoPeso(false)
  }

  async function handleLogout() {
    borrarCachePortal()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!montado || loading) return <LoadingPortal />

  const totalDia = calcMacrosDia()
  const codigo = dieta?.codigo_publico ?? ''
  const iniciales = profile?.nombre?.[0]?.toUpperCase() ?? '?'
  const primerNombre = profile?.nombre?.split(' ')[0] ?? 'cliente'
  const ultimoPeso = historialPeso[0]?.peso
  const penultimoPeso = historialPeso[1]?.peso
  const diffPeso = ultimoPeso && penultimoPeso ? ultimoPeso - penultimoPeso : null
  const sesionesSemana = entreno?.sesiones?.length ?? 0
  const comidasDia = comidasHoyDeDieta().length
  const fechaHoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'hoy',     label: 'Hoy',      icon: House },
    { key: 'dieta',   label: 'Dieta',    icon: ForkKnife },
    { key: 'entreno', label: 'Entreno',  icon: Barbell },
    { key: 'recetas', label: 'Recetas',  icon: BookOpenText },
    { key: 'perfil',  label: 'Ajustes',  icon: Gear },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 px-4 pt-safe"
        style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between h-16">
          {/* Avatar + name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'var(--surface-elevated)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              {iniciales}
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text)' }}>
                {profile?.nombre}
              </p>
              <p className="text-[11px] leading-tight first-letter:uppercase" style={{ color: 'var(--text-muted)' }}>
                {fechaHoy}
              </p>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Cerrar sesión"
            >
              <SignOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Bienvenida banner ── */}
      {showBienvenida && (
        <div className="px-4 pt-3 max-w-2xl mx-auto">
          <div className="flex items-start justify-between gap-3 px-4 py-3 rounded-2xl text-sm"
            style={{ background: 'var(--success-bg)', border: '1px solid rgba(48,209,88,0.22)' }}>
            <p style={{ color: 'var(--success)' }} className="font-medium text-sm leading-relaxed">
              Tu plan ya está listo. Carlos ha preparado la dieta, el entrenamiento y el seguimiento semanal.
            </p>
            <button onClick={() => setShowBienvenida(false)} className="flex-shrink-0 cursor-pointer"
              style={{ color: 'var(--success)' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28">

        {/* ─── HOY ─── */}
        {visitadas.has('hoy') && (
          <div className="flex flex-col gap-4" style={tab !== 'hoy' ? { display: 'none' } : undefined}>

            {/* Hero: Calorías */}
            {totalDia ? (
              <section className="rounded-[1.75rem] p-5 overflow-hidden relative"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-md)',
                }}>
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                      Plan de hoy
                    </p>
                    <h1 className="text-2xl font-extrabold leading-tight tracking-tight" style={{ color: 'var(--text)' }}>
                      {primerNombre}, foco en cumplir lo básico
                    </h1>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-4xl font-black leading-none font-data" style={{ color: 'var(--text)' }}>
                      {totalDia.calorias.toFixed(0)}
                    </p>
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                      kcal/día
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-5">
                  <div className="rounded-2xl px-3 py-3" style={{ background: 'var(--bg-subtle)' }}>
                    <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Comidas</p>
                    <p className="font-data text-xl font-bold" style={{ color: 'var(--text)' }}>{comidasDia}</p>
                  </div>
                  <div className="rounded-2xl px-3 py-3" style={{ background: 'var(--bg-subtle)' }}>
                    <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Entrenos</p>
                    <p className="font-data text-xl font-bold" style={{ color: 'var(--text)' }}>{sesionesSemana}</p>
                  </div>
                  <div className="rounded-2xl px-3 py-3" style={{ background: 'var(--bg-subtle)' }}>
                    <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Peso</p>
                    <p className="font-data text-xl font-bold" style={{ color: 'var(--text)' }}>{ultimoPeso ? `${ultimoPeso}` : '—'}</p>
                  </div>
                </div>

                {/* Macro rings */}
                <div className="grid grid-cols-3 gap-3">
                  <MacroPill
                    label="Proteínas"
                    value={totalDia.proteinas}
                    target={dieta?.proteinas_objetivo ?? totalDia.proteinas}
                    color="#52B788"
                  />
                  <MacroPill
                    label="Carbos"
                    value={totalDia.carbohidratos}
                    target={dieta?.carbohidratos_objetivo ?? totalDia.carbohidratos}
                    color="#4A9FCC"
                  />
                  <MacroPill
                    label="Grasas"
                    value={totalDia.grasas}
                    target={dieta?.grasas_objetivo ?? totalDia.grasas}
                    color="#E07C3A"
                  />
                </div>
              </section>
            ) : (
              <EmptyState icon={ForkKnife} text="Tu coach aún no ha asignado un plan de dieta" />
            )}

            {/* Bento: peso + entreno de hoy */}
            {(ultimoPeso || entreno) && (
              <div className="grid grid-cols-2 gap-3">
                {ultimoPeso && (
                  <StatBadge
                    icon={Scales}
                    label="Último peso"
                    value={`${ultimoPeso} kg`}
                    sub={diffPeso !== null
                      ? `${diffPeso > 0 ? '+' : ''}${diffPeso.toFixed(1)} kg`
                      : undefined}
                    color={diffPeso !== null ? (diffPeso < 0 ? '#52B788' : '#F4A261') : 'var(--accent)'}
                  />
                )}
                {entreno && (
                  <button
                    onClick={() => setTab('entreno')}
                    className="flex items-center gap-3 p-3 rounded-2xl text-left cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'var(--surface)' }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(116,185,224,0.12)' }}>
                      <Barbell size={16} style={{ color: '#74B9E0' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Entreno</p>
                      <p className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--text)' }}>{entreno.nombre}</p>
                      <p className="text-[10px]" style={{ color: '#74B9E0' }}>Ver plan</p>
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* Accesos rápidos: solo lo que NO vive ya en la barra inferior (Hoy/Dieta/Entreno/Recetas) */}
            {codigo && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
                  Accesos rápidos
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTab('checkin')}
                    className="rounded-2xl px-2 py-3 text-left transition-all active:scale-[0.98]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <ClipboardText size={17} style={{ color: '#52B788' }} />
                    <p className="mt-2 text-[11px] font-semibold" style={{ color: 'var(--text)' }}>Check-in</p>
                  </button>
                  <button
                    onClick={() => setTab('progreso')}
                    className="rounded-2xl px-2 py-3 text-left transition-all active:scale-[0.98]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <ChartLineUp size={17} style={{ color: '#4A9FCC' }} />
                    <p className="mt-2 text-[11px] font-semibold" style={{ color: 'var(--text)' }}>Progreso</p>
                  </button>
                  <button
                    onClick={() => setTab('compra')}
                    className="rounded-2xl px-2 py-3 text-left transition-all active:scale-[0.98]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <ShoppingCart size={17} style={{ color: '#D9A441' }} />
                    <p className="mt-2 text-[11px] font-semibold" style={{ color: 'var(--text)' }}>Compra</p>
                  </button>
                  <button
                    onClick={() => setTab('chat')}
                    className="rounded-2xl px-2 py-3 text-left transition-all active:scale-[0.98]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <ChatCircleDots size={17} style={{ color: '#EF4444' }} />
                    <p className="mt-2 text-[11px] font-semibold" style={{ color: 'var(--text)' }}>Chat</p>
                  </button>
                </div>
              </div>
            )}

            {/* TLS Gauge */}
            {codigo && (
              <TLSGauge codigo={codigo} onRegistrar={() => setTab('checkin')} />
            )}

            {/* Notas del coach */}
            {codigo && (
              <NotasCoach codigo={codigo} />
            )}

            {/* CTA check-in */}
            {codigo && (
              <button
                onClick={() => setTab('checkin')}
                className="w-full flex items-center justify-between px-5 py-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, rgba(82,183,136,0.12) 0%, rgba(82,183,136,0.06) 100%)',
                  border: '1px solid rgba(82,183,136,0.2)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(82,183,136,0.15)' }}>
                    <ClipboardText size={16} style={{ color: '#52B788' }} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Check-in semanal</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Registra tu progreso</p>
                  </div>
                </div>
                <CaretRight size={16} style={{ color: '#52B788' }} />
              </button>
            )}
          </div>
        )}

        {/* ─── DIETA ─── */}
        {visitadas.has('dieta') && (
          <div className="flex flex-col gap-4" style={tab !== 'dieta' ? { display: 'none' } : undefined}>
            {dieta ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <MiPlan codigo={codigo} plan={dieta as any} />
            ) : (
              <EmptyState icon={ForkKnife} text="Tu coach aún no ha asignado un plan de dieta" />
            )}
          </div>
        )}

        {/* ─── ENTRENO ─── */}
        {visitadas.has('entreno') && (
          <div className="flex flex-col gap-4" style={tab !== 'entreno' ? { display: 'none' } : undefined}>
            {entreno ? (
              <EntrenoSubTabs planId={entreno.id} planNombre={entreno.nombre} />
            ) : (
              <EmptyState icon={Barbell} text="Tu coach aún no ha asignado un plan de entrenamiento" />
            )}
          </div>
        )}

        {/* ─── CHECK-IN ─── */}
        {tab === 'checkin' && (
          <div className="flex flex-col gap-4">
            <VolverAHoy setTab={setTab} />
            {codigo ? (
              <>
                <CheckInForm codigo={codigo} onCheckinCreado={() => setCheckinKey(k => k + 1)} />
                <HistorialCheckins key={checkinKey} codigo={codigo} />
              </>
            ) : (
              <EmptyState icon={ClipboardText} text="Necesitas tener un plan activo para hacer check-ins" />
            )}
          </div>
        )}

        {/* ─── PROGRESO ─── */}
        {tab === 'progreso' && (
          <div className="flex flex-col gap-4">
            <VolverAHoy setTab={setTab} />

            {/* Registrar peso */}
            <div className="rounded-3xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <Scales size={15} style={{ color: 'var(--accent)' }} />
                Registrar peso
              </h2>
              <div className="flex gap-2 mb-3">
                <input
                  type="number" step="0.1" inputMode="decimal"
                  className="input flex-1 rounded-xl"
                  placeholder="74.5"
                  value={peso}
                  onChange={e => setPeso(e.target.value)}
                />
                <span className="flex items-center font-semibold px-2 text-sm" style={{ color: 'var(--text-secondary)' }}>kg</span>
              </div>
              <input
                className="input mb-3 rounded-xl w-full"
                placeholder="Nota (opcional)…"
                value={notaPeso}
                onChange={e => setNotaPeso(e.target.value)}
              />
              <button
                className="btn btn-primary w-full justify-center rounded-xl cursor-pointer"
                onClick={guardarPeso}
                disabled={!peso || guardandoPeso}
              >
                {guardandoPeso ? 'Guardando…' : 'Guardar registro'}
              </button>
            </div>

            {/* Gráfico */}
            {historialPeso.length >= 2 && (
              <div className="rounded-3xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <GraficoPeso
                  datos={historialPeso.map(h => ({ fecha: h.fecha, peso: h.peso ?? 0 })).filter(d => d.peso > 0)}
                />
              </div>
            )}

            {/* Historial peso */}
            {historialPeso.length > 0 && (
              <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="px-5 pt-4 pb-2">
                  <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Historial de peso</h2>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {historialPeso.map((r, idx) => {
                    const ant = historialPeso[idx + 1]
                    const diff = ant && r.peso && ant.peso ? r.peso - ant.peso : null
                    return (
                      <div key={r.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            {new Date(r.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                          {r.notas && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.notas}</p>}
                        </div>
                        <div className="text-right flex items-center gap-2">
                          {diff !== null && (
                            diff < 0
                              ? <TrendDown size={13} style={{ color: '#52B788' }} />
                              : diff > 0
                              ? <TrendUp size={13} style={{ color: '#F4A261' }} />
                              : null
                          )}
                          <div>
                            <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{r.peso} kg</p>
                            {diff !== null && (
                              <p className="text-[10px]" style={{ color: diff < 0 ? '#52B788' : diff > 0 ? '#F4A261' : 'var(--text-muted)' }}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Fotos de progreso */}
            {codigo && <GaleriaFotosProgreso codigo={codigo} />}

            {/* Logros */}
            {codigo ? (
              <MilestonesLogros codigo={codigo} />
            ) : (
              <EmptyState icon={Trophy} text="Activa un plan para ver tus logros" />
            )}

          </div>
        )}

        {tab === 'compra' && (
          <div className="flex flex-col gap-4">
            <VolverAHoy setTab={setTab} />
            {codigo ? (
              <ListaCompraPortal codigo={codigo} />
            ) : (
              <EmptyState icon={ShoppingCart} text="Activa un plan de dieta para ver tu lista de la compra" />
            )}
          </div>
        )}

        {visitadas.has('recetas') && (
          <div className="flex flex-col gap-6" style={tab !== 'recetas' ? { display: 'none' } : undefined}>
            {codigo && cliente ? (
              <>
                {(() => {
                  const activa = subRecetas ?? (recetasDelPlan().length > 0 ? 'plan' : 'recetario')
                  return (
                    <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                      {([['plan', 'En tu plan'], ['recetario', 'Recetario completo']] as const).map(([k, t]) => (
                        <button key={k} onClick={() => setSubRecetas(k)} className="flex-1 px-3 py-2.5 text-xs font-semibold"
                          style={{ background: activa === k ? 'var(--primary)' : 'transparent', color: activa === k ? 'var(--bg)' : 'var(--text-muted)' }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )
                })()}

                {(subRecetas ?? (recetasDelPlan().length > 0 ? 'plan' : 'recetario')) === 'plan' && recetasDelPlan().length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>En tu plan</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {recetasDelPlan().map(r => (
                        <a
                          key={r.id}
                          href={recetaHref(r.id)}
                          className="rounded-2xl overflow-hidden"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                        >
                          <div className="relative w-full h-28" style={{ background: 'var(--surface-elevated)' }}>
                            {r.imagen_url ? (
                              <Image src={r.imagen_url} alt={r.nombre} fill className="object-cover" sizes="(max-width: 768px) 50vw, 300px" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <BookOpenText size={24} style={{ color: 'var(--text-muted)' }} />
                              </div>
                            )}
                          </div>
                          <div className="p-2.5">
                            <p className="text-xs font-semibold line-clamp-2" style={{ color: 'var(--text)' }}>{r.nombre}</p>
                            {r.kcal ? (
                              <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{r.kcal} kcal · {r.proteinas}g P</p>
                            ) : null}
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {(subRecetas ?? (recetasDelPlan().length > 0 ? 'plan' : 'recetario')) === 'plan' && (
                  <>
                    {recetasDelPlan().length === 0 && (
                      <EmptyState icon={BookOpenText} text="Aún no tienes recetas en tu plan. Mira el recetario completo." />
                    )}
                    <MisPlatos codigo={codigo} clienteId={cliente.id} />
                  </>
                )}

                {(subRecetas ?? (recetasDelPlan().length > 0 ? 'plan' : 'recetario')) === 'recetario' && (
                  <RecetarioExplorador codigo={codigo} recetaHref={recetaHref} />
                )}
              </>
            ) : (
              <EmptyState icon={BookOpenText} text="Activa un plan de dieta para ver tus recetas" />
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="flex flex-col gap-4">
            <VolverAHoy setTab={setTab} />
            {codigo ? (
              <ChatPanel codigo={codigo} />
            ) : (
              <EmptyState icon={ChatCircleDots} text="Activa un plan para poder escribir a tu coach" />
            )}
          </div>
        )}

        {visitadas.has('perfil') && (
          <div className="flex flex-col gap-4" style={tab !== 'perfil' ? { display: 'none' } : undefined}>
            {cliente ? (
              <AjustesTabs codigo={codigo} clienteId={cliente.id} profile={profile} cliente={cliente} />
            ) : (
              <EmptyState icon={DeviceMobile} text="Activa un plan para ver tus ajustes" />
            )}
          </div>
        )}
      </div>

      {/* ── Bottom navigation ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--glass-border)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
        <div className="max-w-2xl mx-auto flex">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-3 cursor-pointer transition-all"
                style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                <div className="relative">
                  {active && (
                    <div className="absolute inset-0 rounded-full scale-[2.5] opacity-10"
                      style={{ background: 'var(--accent)' }} />
                  )}
                  <Icon size={20} weight={active ? 'fill' : 'regular'} />
                </div>
                <span className="text-[10px] font-medium tracking-tight">{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <InstallBanner />
    </div>
  )
}

export default function PortalClientePage() {
  return (
    <SWRConfig value={{
      provider: proveedorCachePersistente,
      shouldRetryOnError: false,
      focusThrottleInterval: 30000,
    }}>
      <Suspense fallback={
        <LoadingPortal />
      }>
        <PortalClientePageContent />
      </Suspense>
    </SWRConfig>
  )
}
