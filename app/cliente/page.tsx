'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { UtensilsCrossed, Dumbbell, Weight, LogOut, ChevronDown, ChevronUp, Trophy } from 'lucide-react'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import type { Macros, Profile, Cliente, PlanNutricion, PlanEntrenamiento, ComidaAlimento, Comida, SesionEntrenamiento, SesionEjercicio, SeguimientoPeso } from '@/types'
import GaleriaFotosProgreso from '@/components/PortalCliente/GaleriaFotosProgreso'
import ListaCompraPortal from '@/components/PortalCliente/ListaCompraPortal'
import InstallBanner from '@/components/PortalCliente/InstallBanner'
import GraficoPeso from '@/components/PortalCliente/GraficoPeso'
import MilestonesLogros from '@/components/PortalCliente/MilestonesLogros'
import SemanaEntrenoCard from '@/components/training/SemanaEntrenoCard'

function PortalClientePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showBienvenida, setShowBienvenida] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [dieta, setDieta] = useState<PlanNutricion | null>(null)
  const [entreno, setEntreno] = useState<PlanEntrenamiento | null>(null)
  const [tab, setTab] = useState<'dieta' | 'entreno' | 'progreso' | 'logros'>('dieta')
  const [peso, setPeso] = useState('')
  const [notaPeso, setNotaPeso] = useState('')
  const [guardandoPeso, setGuardandoPeso] = useState(false)
  const [historialPeso, setHistorialPeso] = useState<SeguimientoPeso[]>([])
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({})
  const [mostrarListaCompra, setMostrarListaCompra] = useState(false)
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

      // Registrar acceso al portal (fire-and-forget)
      fetch('/api/cliente/registrar-acceso', { method: 'POST' }).catch(() => {})

      const { data: cli } = await supabase.from('clientes').select('*').eq('profile_id', user.id).single()
      setCliente(cli as Cliente)

      if (cli) {
        const [dietaRes, entrenoRes, histRes] = await Promise.all([
          supabase.from('planes_nutricion').select('*, comidas(*, alimentos:comida_alimentos(*, alimento:alimentos(*)))').eq('cliente_id', cli.id).eq('activo', true).order('created_at', { ascending: false }).limit(1).single(),
          supabase.from('planes_entrenamiento').select('*, sesiones:sesiones_entrenamiento(*, ejercicios:sesion_ejercicios(*, ejercicio:ejercicios(*)))').eq('cliente_id', cli.id).eq('activo', true).order('created_at', { ascending: false }).limit(1).single(),
          supabase.from('seguimiento_peso').select('*').eq('cliente_id', cli.id).order('fecha', { ascending: false }).limit(15),
        ])
        if (dietaRes.data) {
          const comidasOrdenadas = ((dietaRes.data as PlanNutricion).comidas ?? []).sort((a, b) => a.orden - b.orden)
          setDieta({ ...dietaRes.data as PlanNutricion, comidas: comidasOrdenadas })
          const exp: Record<string, boolean> = {}
          comidasOrdenadas.forEach(c => { exp[c.id] = true })
          setExpandidas(exp)
        }
        if (entrenoRes.data) {
          const sesionesOrdenadas = ((entrenoRes.data as PlanEntrenamiento).sesiones ?? []).sort((a, b) => a.orden - b.orden)
          setEntreno({ ...entrenoRes.data as PlanEntrenamiento, sesiones: sesionesOrdenadas })
        }
        setHistorialPeso(histRes.data as SeguimientoPeso[] ?? [])
      }
      setLoading(false)
    }
    load()
  }, [router])

  function calcMacrosComida(alimentos: ComidaAlimento[]): Macros {
    return sumarMacros((alimentos ?? []).map(a =>
      calcularMacrosPorCantidad(a.alimento?.calorias ?? 0, a.alimento?.proteinas ?? 0, a.alimento?.carbohidratos ?? 0, a.alimento?.grasas ?? 0, a.alimento?.fibra ?? 0, a.cantidad_gramos)
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

  const totalDia = dieta ? sumarMacros((dieta.comidas ?? []).map(c => calcMacrosComida(c.alimentos ?? []))) : null

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

      {/* Banner bienvenida onboarding */}
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
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex">
          {[
            { key: 'dieta', label: 'Dieta', icon: UtensilsCrossed },
            { key: 'entreno', label: 'Entreno', icon: Dumbbell },
            { key: 'progreso', label: 'Progreso', icon: Weight },
            { key: 'logros', label: 'Logros', icon: Trophy },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key as 'dieta' | 'entreno' | 'progreso' | 'logros')}
              className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
              <Icon size={14} className="sm:size-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 pb-8">
        {/* TAB: DIETA */}
        {tab === 'dieta' && (
          dieta ? (
            <div>
              {/* Resumen macros */}
              {totalDia && (
                <div className="card mb-4" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', color: 'white' }}>
                  <p className="text-green-100 text-sm mb-1">{dieta.nombre}</p>
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
              )}

              {/* Comidas */}
              <div className="flex flex-col gap-3">
                {(dieta.comidas ?? []).map(comida => {
                  const macros = calcMacrosComida(comida.alimentos ?? [])
                  const expanded = expandidas[comida.id]
                  return (
                    <div key={comida.id} className="card">
                      <button onClick={() => setExpandidas(prev => ({ ...prev, [comida.id]: !prev[comida.id] }))}
                        className="w-full flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">{comida.nombre}</span>
                          {comida.hora_sugerida && <span className="text-xs text-gray-400">{comida.hora_sugerida.slice(0, 5)}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="font-medium text-gray-700">{macros.calorias.toFixed(0)} kcal</span>
                          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </button>

                      {expanded && (comida.alimentos ?? []).length > 0 && (
                        <div className="mt-3 border-t border-gray-50 pt-3">
                          <div className="flex flex-col gap-2">
                            {(comida.alimentos ?? []).map(af => {
                              const m = calcularMacrosPorCantidad(af.alimento?.calorias ?? 0, af.alimento?.proteinas ?? 0, af.alimento?.carbohidratos ?? 0, af.alimento?.grasas ?? 0, af.alimento?.fibra ?? 0, af.cantidad_gramos)
                              return (
                                <div key={af.id} className="flex items-center justify-between py-1.5">
                                  <div>
                                    <p className="text-sm font-medium text-gray-800">{af.alimento?.nombre}</p>
                                    <p className="text-xs text-gray-400">{af.cantidad_gramos}g</p>
                                  </div>
                                  <div className="text-right text-xs text-gray-500">
                                    <p className="font-semibold text-gray-700">{m.calorias.toFixed(0)} kcal</p>
                                    <p>P:{m.proteinas.toFixed(1)} C:{m.carbohidratos.toFixed(1)} G:{m.grasas.toFixed(1)}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <div className="mt-3 pt-2 border-t border-gray-50 flex justify-between text-sm">
                            <span className="text-gray-500">Total comida</span>
                            <span className="font-semibold text-gray-700">
                              {macros.calorias.toFixed(0)} kcal · P:{macros.proteinas.toFixed(1)}g · C:{macros.carbohidratos.toFixed(1)}g · G:{macros.grasas.toFixed(1)}g
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Lista de la compra */}
              <div className="card mt-4">
                <button
                  onClick={() => setMostrarListaCompra(!mostrarListaCompra)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🛒</span>
                    <span className="font-semibold text-sm text-gray-800">Lista de la compra</span>
                  </div>
                  <span className="text-xs text-gray-400">{mostrarListaCompra ? 'Ocultar' : 'Ver'}</span>
                </button>

                {mostrarListaCompra && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <ListaCompraPortal codigo={dieta.codigo_publico ?? ''} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <UtensilsCrossed size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Tu coach aún no te ha asignado un plan de dieta</p>
            </div>
          )
        )}

        {/* TAB: ENTRENO */}
        {tab === 'entreno' && (
          entreno ? (
            <SemanaEntrenoCard planId={entreno.id} planNombre={entreno.nombre} />
          ) : (
            <div className="rounded-xl text-center py-12" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Dumbbell size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <p style={{ color: 'var(--text-muted)' }}>Tu coach aún no te ha asignado un plan de entrenamiento</p>
            </div>
          )
        )}

        {/* TAB: PROGRESO */}
        {tab === 'progreso' && (
          <div>
            {/* Registrar peso */}
            <div className="card mb-4">
              <h2 className="font-semibold text-gray-800 mb-3">Registrar peso de hoy</h2>
              <div className="flex gap-2 mb-2">
                <input type="number" step="0.1" className="input" placeholder="Ej: 74.5" value={peso}
                  onChange={e => setPeso(e.target.value)} />
                <span className="flex items-center text-gray-500 font-medium">kg</span>
              </div>
              <input className="input mb-3" placeholder="Nota (opcional)…" value={notaPeso} onChange={e => setNotaPeso(e.target.value)} />
              <button className="btn-primary w-full justify-center" onClick={guardarPeso} disabled={!peso || guardandoPeso}>
                {guardandoPeso ? 'Guardando…' : 'Guardar registro'}
              </button>
            </div>

            {/* Gráfico de evolución */}
            {historialPeso.length >= 2 && (
              <div className="card mb-4">
                <GraficoPeso
                  datos={historialPeso.map(h => ({ fecha: h.fecha, peso: h.peso ?? 0 })).filter(d => d.peso > 0)}
                />
              </div>
            )}

            {/* Historial */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Historial de peso</h2>
              {historialPeso.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Aún no hay registros</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {historialPeso.map((r, idx) => {
                    const anterior = historialPeso[idx + 1]
                    const diff = anterior && r.peso && anterior.peso ? r.peso - anterior.peso : null
                    return (
                      <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{new Date(r.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
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

            {/* Galería de fotos de progreso */}
            {dieta?.codigo_publico && (
              <GaleriaFotosProgreso codigo={dieta.codigo_publico} />
            )}
          </div>
        )}

        {/* TAB: LOGROS */}
        {tab === 'logros' && (
          <div>
            {dieta?.codigo_publico ? (
              <MilestonesLogros codigo={dieta.codigo_publico} />
            ) : (
              <div className="card text-center py-12">
                <Trophy size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Activa un plan de nutrición para ver tus logros</p>
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
