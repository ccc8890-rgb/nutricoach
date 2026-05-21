'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Home, BookOpen, ClipboardCheck, BarChart2, LogOut,
  UtensilsCrossed, Dumbbell, Weight, Trophy, Sun, Moon,
  Flame, Zap, ChevronRight, X, TrendingDown, TrendingUp,
} from 'lucide-react'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import type { Profile, Cliente, PlanNutricion, PlanEntrenamiento, ComidaAlimento, SeguimientoPeso } from '@/types'
import InstallBanner from '@/components/PortalCliente/InstallBanner'
import GraficoPeso from '@/components/PortalCliente/GraficoPeso'
import GaleriaFotosProgreso from '@/components/PortalCliente/GaleriaFotosProgreso'
import MilestonesLogros from '@/components/PortalCliente/MilestonesLogros'
import CheckInForm from '@/components/PortalCliente/CheckInForm'
import HistorialCheckins from '@/components/PortalCliente/HistorialCheckins'
import NotasCoach from '@/components/PortalCliente/NotasCoach'
import TLSGauge from '@/components/PortalCliente/TLSGauge'
import MiPlan from '@/components/PortalCliente/MiPlan'
import SemanaEntrenoCard from '@/components/training/SemanaEntrenoCard'
import { useTheme } from '@/components/ThemeProvider'

type Tab = 'hoy' | 'plan' | 'checkin' | 'progreso'

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
  const [tab, setTab] = useState<Tab>('hoy')
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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof?.role === 'coach') { window.location.href = '/dashboard'; return }
      setProfile(prof as Profile)

      fetch('/api/cliente/registrar-acceso', { method: 'POST' }).catch(() => {})

      const { data: cli } = await supabase.from('clientes').select('*').eq('profile_id', user.id).single()
      setCliente(cli as Cliente)

      if (cli && !cli.onboarding_completado) {
        window.location.href = '/onboarding'
        return
      }

      if (cli) {
        const [dietaRes, entrenoRes, histRes] = await Promise.all([
          supabase.from('planes_nutricion')
            .select('*, comidas(*, alimentos:comida_alimentos(*, alimento:alimentos(*)))')
            .eq('cliente_id', cli.id).eq('activo', true)
            .order('created_at', { ascending: false }).limit(1).single(),
          supabase.from('planes_entrenamiento')
            .select('*, sesiones:sesiones_entrenamiento(*, ejercicios:sesion_ejercicios(*, ejercicio:ejercicios(*)))')
            .eq('cliente_id', cli.id).eq('activo', true)
            .order('created_at', { ascending: false }).limit(1).single(),
          supabase.from('seguimiento_peso')
            .select('*').eq('cliente_id', cli.id)
            .order('fecha', { ascending: false }).limit(15),
        ])
        if (dietaRes.data) {
          const ordenadas = ((dietaRes.data as PlanNutricion).comidas ?? []).sort((a, b) => a.orden - b.orden)
          setDieta({ ...dietaRes.data as PlanNutricion, comidas: ordenadas })
        }
        if (entrenoRes.data) {
          const ordenadas = ((entrenoRes.data as PlanEntrenamiento).sesiones ?? []).sort((a, b) => a.orden - b.orden)
          setEntreno({ ...entrenoRes.data as PlanEntrenamiento, sesiones: ordenadas })
        }
        setHistorialPeso(histRes.data as SeguimientoPeso[] ?? [])
      }
      setLoading(false)
    }
    load()
  }, [router])

  function calcMacrosDia() {
    if (!dieta) return null
    return sumarMacros((dieta.comidas ?? []).map(c =>
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
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', boxShadow: '0 0 30px var(--accent-glow)' }}>
          <span className="text-sm font-bold" style={{ color: '#1C1C1E' }}>CN</span>
        </div>
        <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    </div>
  )

  const totalDia = calcMacrosDia()
  const codigo = dieta?.codigo_publico ?? ''
  const iniciales = profile?.nombre?.[0]?.toUpperCase() ?? '?'
  const ultimoPeso = historialPeso[0]?.peso
  const penultimoPeso = historialPeso[1]?.peso
  const diffPeso = ultimoPeso && penultimoPeso ? ultimoPeso - penultimoPeso : null

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'hoy',      label: 'Hoy',      icon: Home },
    { key: 'plan',     label: 'Mi Plan',  icon: BookOpen },
    { key: 'checkin',  label: 'Check-in', icon: ClipboardCheck },
    { key: 'progreso', label: 'Progreso', icon: BarChart2 },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 px-4 pt-safe"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-xl mx-auto flex items-center justify-between h-14">
          {/* Avatar + name */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#1C1C1E' }}>
              {iniciales}
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text)' }}>
                {profile?.nombre}
              </p>
              <p className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                Portal de cliente
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
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Cerrar sesión"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Bienvenida banner ── */}
      {showBienvenida && (
        <div className="px-4 pt-3 max-w-xl mx-auto">
          <div className="flex items-start justify-between gap-3 px-4 py-3 rounded-2xl text-sm"
            style={{ background: 'var(--success-bg)', border: '1px solid rgba(48,209,88,0.2)' }}>
            <p style={{ color: 'var(--success)' }} className="font-medium text-sm">
              ¡Bienvenido/a! Tu plan ya está listo. Tu coach ha preparado todo para ti. 🎉
            </p>
            <button onClick={() => setShowBienvenida(false)} className="flex-shrink-0 cursor-pointer"
              style={{ color: 'var(--success)' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="max-w-xl mx-auto px-4 pt-4 pb-28">

        {/* ─── HOY ─── */}
        {tab === 'hoy' && (
          <div className="flex flex-col gap-3">

            {/* Hero: Calorías */}
            {totalDia ? (
              <div className="rounded-3xl p-5 overflow-hidden relative"
                style={{
                  background: 'linear-gradient(135deg, #1a1a1f 0%, #0f1117 100%)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}>
                {/* Glow orb */}
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20"
                  style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }} />

                <div className="relative">
                  <p className="text-xs font-medium uppercase tracking-widest mb-1"
                    style={{ color: 'var(--text-muted)' }}>
                    Plan: {dieta?.nombre ?? 'Mi dieta'}
                  </p>
                  <div className="flex items-end gap-2 mb-5">
                    <span className="text-5xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
                      {totalDia.calorias.toFixed(0)}
                    </span>
                    <span className="text-base mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                      kcal / día
                    </span>
                  </div>

                  {/* Macro rings */}
                  <div className="flex justify-around">
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
                      color="#74B9E0"
                    />
                    <MacroPill
                      label="Grasas"
                      value={totalDia.grasas}
                      target={dieta?.grasas_objetivo ?? totalDia.grasas}
                      color="#F4A261"
                    />
                    {totalDia.fibra > 0 && (
                      <MacroPill
                        label="Fibra"
                        value={totalDia.fibra}
                        target={30}
                        color="#C47AC0"
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState icon={UtensilsCrossed} text="Tu coach aún no ha asignado un plan de dieta" />
            )}

            {/* Bento grid: stats rápidos */}
            {(ultimoPeso || entreno) && (
              <div className="grid grid-cols-2 gap-3">
                {ultimoPeso && (
                  <StatBadge
                    icon={Weight}
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
                    onClick={() => setTab('plan')}
                    className="flex items-center gap-3 p-3 rounded-2xl text-left cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'var(--surface)' }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(116,185,224,0.12)' }}>
                      <Dumbbell size={16} style={{ color: '#74B9E0' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Entreno</p>
                      <p className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--text)' }}>{entreno.nombre}</p>
                      <p className="text-[10px]" style={{ color: '#74B9E0' }}>Ver plan →</p>
                    </div>
                  </button>
                )}
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
                    <ClipboardCheck size={16} style={{ color: '#52B788' }} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Check-in semanal</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Registra tu progreso</p>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: '#52B788' }} />
              </button>
            )}
          </div>
        )}

        {/* ─── MI PLAN ─── */}
        {tab === 'plan' && (
          <div className="flex flex-col gap-4">
            {dieta ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <MiPlan codigo={codigo} plan={dieta as any} entreno={entreno} />
            ) : (
              <EmptyState icon={UtensilsCrossed} text="Tu coach aún no ha asignado un plan de dieta" />
            )}

            {/* Separador */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                <Dumbbell size={11} />
                Entrenamiento
              </div>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            {entreno ? (
              <SemanaEntrenoCard planId={entreno.id} planNombre={entreno.nombre} />
            ) : (
              <EmptyState icon={Dumbbell} text="Tu coach aún no ha asignado un plan de entrenamiento" />
            )}
          </div>
        )}

        {/* ─── CHECK-IN ─── */}
        {tab === 'checkin' && (
          <div className="flex flex-col gap-4">
            {codigo ? (
              <>
                <CheckInForm codigo={codigo} onCheckinCreado={() => setCheckinKey(k => k + 1)} />
                <HistorialCheckins key={checkinKey} codigo={codigo} />
              </>
            ) : (
              <EmptyState icon={ClipboardCheck} text="Necesitas tener un plan activo para hacer check-ins" />
            )}
          </div>
        )}

        {/* ─── PROGRESO ─── */}
        {tab === 'progreso' && (
          <div className="flex flex-col gap-4">

            {/* Registrar peso */}
            <div className="rounded-3xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <Weight size={15} style={{ color: 'var(--accent)' }} />
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
                              ? <TrendingDown size={13} style={{ color: '#52B788' }} />
                              : diff > 0
                              ? <TrendingUp size={13} style={{ color: '#F4A261' }} />
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
        <div className="max-w-xl mx-auto flex">
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
                  <Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    }>
      <PortalClientePageContent />
    </Suspense>
  )
}
