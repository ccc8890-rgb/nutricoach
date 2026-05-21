'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Home, BookOpen, ClipboardCheck, BarChart2, LogOut, UtensilsCrossed, Dumbbell, Weight, Trophy } from 'lucide-react'
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

type Tab = 'hoy' | 'plan' | 'checkin' | 'progreso'

function PortalClientePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
    </div>
  )

  const totalDia = calcMacrosDia()
  const codigo = dieta?.codigo_publico ?? ''

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'hoy',     label: 'Hoy',      icon: Home },
    { key: 'plan',    label: 'Mi Plan',  icon: BookOpen },
    { key: 'checkin', label: 'Check-in', icon: ClipboardCheck },
    { key: 'progreso',label: 'Progreso', icon: BarChart2 },
  ]

  return (
    <div className="min-h-screen pb-safe" style={{ background: '#f9fafb' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-safe pb-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm sm:text-base">
              {profile?.nombre?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">{profile?.nombre}</p>
              <p className="text-[10px] sm:text-xs text-gray-400">Mi plan de coaching</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 p-2 touch-manipulation">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Banner bienvenida */}
      {showBienvenida && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="flex items-start justify-between gap-3 px-4 py-3 rounded-xl text-sm"
            style={{ background: '#dcfce7', color: '#15803d' }}>
            <p className="font-medium">¡Bienvenido/a! Tu plan ya está listo. Tu coach ha preparado todo para ti.</p>
            <button onClick={() => setShowBienvenida(false)} className="text-green-600 flex-shrink-0 font-bold text-base leading-none">×</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
                tab === key ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={14} className="sm:size-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 pb-8">

        {/* ─── TAB: HOY ─── */}
        {tab === 'hoy' && (
          <div className="flex flex-col gap-4">

            {/* Macros del día */}
            {totalDia ? (
              <div className="card" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', color: 'white' }}>
                <p className="text-green-100 text-sm mb-1">{dieta?.nombre}</p>
                <p className="text-3xl font-bold">{totalDia.calorias.toFixed(0)} <span className="text-lg font-normal text-green-200">kcal/día</span></p>
                <div className="flex gap-6 mt-3">
                  {[
                    { l: 'Proteínas', v: totalDia.proteinas, c: '#bbf7d0' },
                    { l: 'Carbos', v: totalDia.carbohidratos, c: '#fef08a' },
                    { l: 'Grasas', v: totalDia.grasas, c: '#fed7aa' },
                  ].map(({ l, v, c }) => (
                    <div key={l}>
                      <p className="text-xl font-bold" style={{ color: c }}>{v.toFixed(0)}g</p>
                      <p className="text-xs text-green-200">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card text-center py-8">
                <UtensilsCrossed size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">Tu coach aún no te ha asignado un plan de dieta</p>
              </div>
            )}

            {/* Carga de entrenamiento */}
            {codigo && (
              <TLSGauge codigo={codigo} onRegistrar={() => setTab('checkin')} />
            )}

            {/* Notas del coach */}
            {codigo && (
              <NotasCoach codigo={codigo} />
            )}

            {/* Acceso rápido al entreno de hoy */}
            {entreno && (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Dumbbell size={16} className="text-green-600" />
                    <span className="font-semibold text-sm text-gray-800">Entreno de hoy</span>
                  </div>
                  <button onClick={() => setTab('plan')} className="text-xs text-green-600 font-medium">Ver plan →</button>
                </div>
                <p className="text-xs text-gray-500">{entreno.nombre}</p>
              </div>
            )}

          </div>
        )}

        {/* ─── TAB: MI PLAN ─── */}
        {tab === 'plan' && (
          <div className="flex flex-col gap-4">
            {dieta ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <MiPlan codigo={codigo} plan={dieta as any} entreno={null} />
            ) : (
              <div className="card text-center py-12">
                <UtensilsCrossed size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Tu coach aún no te ha asignado un plan de dieta</p>
              </div>
            )}

            {/* Separador entrenamiento */}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 border-t border-gray-200" />
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                <Dumbbell size={12} />
                Entrenamiento
              </div>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            {entreno ? (
              <SemanaEntrenoCard planId={entreno.id} planNombre={entreno.nombre} />
            ) : (
              <div className="rounded-xl text-center py-12" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <Dumbbell size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                <p style={{ color: 'var(--text-muted)' }}>Tu coach aún no te ha asignado un plan de entrenamiento</p>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: CHECK-IN ─── */}
        {tab === 'checkin' && (
          <div className="flex flex-col gap-4">
            {codigo ? (
              <>
                <CheckInForm
                  codigo={codigo}
                  onCheckinCreado={() => setCheckinKey(k => k + 1)}
                />
                <HistorialCheckins key={checkinKey} codigo={codigo} />
              </>
            ) : (
              <div className="card text-center py-12">
                <ClipboardCheck size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Necesitas tener un plan activo para hacer check-ins</p>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: PROGRESO ─── */}
        {tab === 'progreso' && (
          <div className="flex flex-col gap-4">

            {/* Registrar peso */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Weight size={16} className="text-green-600" />
                Registrar peso de hoy
              </h2>
              <div className="flex gap-2 mb-2">
                <input type="number" step="0.1" className="input flex-1" placeholder="Ej: 74.5"
                  value={peso} onChange={e => setPeso(e.target.value)} />
                <span className="flex items-center text-gray-500 font-medium px-1">kg</span>
              </div>
              <input className="input mb-3" placeholder="Nota (opcional)…"
                value={notaPeso} onChange={e => setNotaPeso(e.target.value)} />
              <button className="btn-primary w-full justify-center" onClick={guardarPeso}
                disabled={!peso || guardandoPeso}>
                {guardandoPeso ? 'Guardando…' : 'Guardar registro'}
              </button>
            </div>

            {/* Gráfico */}
            {historialPeso.length >= 2 && (
              <div className="card">
                <GraficoPeso
                  datos={historialPeso.map(h => ({ fecha: h.fecha, peso: h.peso ?? 0 })).filter(d => d.peso > 0)}
                />
              </div>
            )}

            {/* Historial peso */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Historial de peso</h2>
              {historialPeso.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Aún no hay registros</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {historialPeso.map((r, idx) => {
                    const ant = historialPeso[idx + 1]
                    const diff = ant && r.peso && ant.peso ? r.peso - ant.peso : null
                    return (
                      <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {new Date(r.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                          {r.notas && <p className="text-xs text-gray-400">{r.notas}</p>}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{r.peso} kg</p>
                          {diff !== null && (
                            <p className={`text-xs ${diff < 0 ? 'text-green-500' : diff > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                              {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Fotos de progreso */}
            {codigo && <GaleriaFotosProgreso codigo={codigo} />}

            {/* Logros */}
            {codigo ? (
              <MilestonesLogros codigo={codigo} />
            ) : (
              <div className="card text-center py-8">
                <Trophy size={36} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">Activa un plan para ver tus logros</p>
              </div>
            )}

          </div>
        )}

      </div>

      <InstallBanner />
    </div>
  )
}

export default function PortalClientePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
      </div>
    }>
      <PortalClientePageContent />
    </Suspense>
  )
}
