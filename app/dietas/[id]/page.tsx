'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Search, X, ChevronDown, ChevronUp } from 'lucide-react'
import { calcularMacrosPorCantidad, sumarMacros, COMIDAS_PREDEFINIDAS } from '@/lib/utils'
import type { Macros } from '@/types'

interface AlimentoEnComida {
  id: string
  cantidad_gramos: number
  alimento: { id: string; nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number }
}

interface ComidaLocal {
  id: string
  nombre: string
  orden: number
  hora_sugerida: string
  alimentos: AlimentoEnComida[]
  expandida: boolean
}

type Fuente = 'local' | 'off'

export default function EditarDietaPage() {
  const { id } = useParams()
  const [plan, setPlan] = useState<any>(null)
  const [comidas, setComidas] = useState<ComidaLocal[]>([])
  const [loading, setLoading] = useState(true)

  const [nombreCustomComida, setNombreCustomComida] = useState('')
  const [mostrarInputCustom, setMostrarInputCustom] = useState(false)

  // Buscador
  const [busquedaAbierta, setBusquedaAbierta] = useState<string | null>(null)
  const [fuente, setFuente] = useState<Fuente>('local')
  const [queryAlimento, setQueryAlimento] = useState('')
  const [resultados, setResultados] = useState<any[]>([])
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { loadPlan() }, [id])

  async function loadPlan() {
    const [planRes, comidasRes] = await Promise.all([
      supabase.from('planes_nutricion').select('*, cliente:clientes(id, profile:profiles!profile_id(nombre, apellidos))').eq('id', id).single(),
      supabase.from('comidas').select('*, alimentos:comida_alimentos(id, cantidad_gramos, alimento:alimentos(*))').eq('plan_id', id).order('orden'),
    ])
    setPlan(planRes.data)
    setComidas((comidasRes.data ?? []).map((c: any) => ({ ...c, expandida: true })))
    setLoading(false)
  }

  // Buscar — local o OFF según fuente activa
  useEffect(() => {
    if (!queryAlimento || queryAlimento.length < 2) { setResultados([]); return }
    setBuscando(true)
    const timer = setTimeout(async () => {
      if (fuente === 'local') {
        const { data } = await supabase.from('alimentos').select('*').ilike('nombre', `%${queryAlimento}%`).limit(12)
        setResultados(data ?? [])
      } else {
        const res = await fetch(`/api/off?q=${encodeURIComponent(queryAlimento)}`)
        setResultados(res.ok ? await res.json() : [])
      }
      setBuscando(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [queryAlimento, fuente])

  // Limpiar resultados al cambiar fuente
  useEffect(() => { setResultados([]); setQueryAlimento('') }, [fuente])

  async function añadirComida(nombre?: string) {
    const nombreFinal = nombre?.trim() || 'Comida ' + (comidas.length + 1)
    const { data } = await supabase.from('comidas').insert({
      plan_id: id, nombre: nombreFinal, orden: comidas.length, hora_sugerida: null,
    }).select().single()
    if (data) setComidas(prev => [...prev, { ...data, alimentos: [], expandida: true }])
    setNombreCustomComida('')
    setMostrarInputCustom(false)
  }

  async function eliminarComida(comidaId: string) {
    await supabase.from('comidas').delete().eq('id', comidaId)
    setComidas(prev => prev.filter(c => c.id !== comidaId))
  }

  async function actualizarNombreComida(comidaId: string, nombre: string) {
    setComidas(prev => prev.map(c => c.id === comidaId ? { ...c, nombre } : c))
    await supabase.from('comidas').update({ nombre }).eq('id', comidaId)
  }

  async function añadirAlimento(comidaId: string, alimento: any) {
    setBusquedaAbierta(null)
    setQueryAlimento('')
    setResultados([])

    let alimentoId = alimento.id

    // Si viene de OFF (no tiene id), guardarlo primero en Supabase
    if (!alimentoId) {
      setGuardando(true)
      const res = await fetch('/api/guardar-alimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alimento),
      })
      const json = await res.json()
      setGuardando(false)
      if (!json.id) return
      alimentoId = json.id
    }

    const { data } = await supabase.from('comida_alimentos').insert({
      comida_id: comidaId, alimento_id: alimentoId, cantidad_gramos: 100,
    }).select().single()

    if (data) {
      const alimentoCompleto = alimento.id ? alimento : { ...alimento, id: alimentoId }
      setComidas(prev => prev.map(c => c.id === comidaId
        ? { ...c, alimentos: [...c.alimentos, { id: data.id, cantidad_gramos: 100, alimento: alimentoCompleto }] }
        : c
      ))
    }
  }

  async function actualizarGramos(comidaId: string, alimentoEnComidaId: string, gramos: number) {
    setComidas(prev => prev.map(c => c.id === comidaId
      ? { ...c, alimentos: c.alimentos.map(a => a.id === alimentoEnComidaId ? { ...a, cantidad_gramos: gramos } : a) }
      : c
    ))
    await supabase.from('comida_alimentos').update({ cantidad_gramos: gramos }).eq('id', alimentoEnComidaId)
  }

  async function eliminarAlimento(comidaId: string, alimentoEnComidaId: string) {
    await supabase.from('comida_alimentos').delete().eq('id', alimentoEnComidaId)
    setComidas(prev => prev.map(c => c.id === comidaId
      ? { ...c, alimentos: c.alimentos.filter(a => a.id !== alimentoEnComidaId) }
      : c
    ))
  }

  function calcMacrosComida(alimentos: AlimentoEnComida[]): Macros {
    return sumarMacros(alimentos.map(a =>
      calcularMacrosPorCantidad(a.alimento.calorias, a.alimento.proteinas, a.alimento.carbohidratos, a.alimento.grasas, a.alimento.fibra, a.cantidad_gramos)
    ))
  }

  const totalDia = sumarMacros(comidas.map(c => calcMacrosComida(c.alimentos)))

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" /></div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dietas" className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{plan?.nombre}</h1>
          <p className="text-sm text-gray-400">{plan?.cliente?.profile?.nombre} {plan?.cliente?.profile?.apellidos}</p>
        </div>
      </div>

      {/* Totales del día */}
      <div className="card mb-6" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', color: 'white' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-green-100 text-sm mb-1">Total del día</p>
            <p className="text-3xl font-bold">{totalDia.calorias.toFixed(0)} <span className="text-xl font-normal text-green-200">kcal</span></p>
            {plan?.kcal_objetivo && (
              <p className="text-green-200 text-sm mt-1">Objetivo: {plan.kcal_objetivo} kcal</p>
            )}
          </div>
          <div className="flex gap-6">
            {[
              { label: 'Proteínas', value: totalDia.proteinas, obj: plan?.proteinas_objetivo, color: '#bbf7d0' },
              { label: 'Carbos', value: totalDia.carbohidratos, obj: plan?.carbohidratos_objetivo, color: '#fef08a' },
              { label: 'Grasas', value: totalDia.grasas, obj: plan?.grasas_objetivo, color: '#fed7aa' },
            ].map(({ label, value, obj, color }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold" style={{ color }}>{value.toFixed(0)}g</p>
                <p className="text-xs text-green-200">{label}</p>
                {obj && <p className="text-xs text-green-300">/ {obj}g</p>}
              </div>
            ))}
          </div>
        </div>
        {plan?.kcal_objetivo && totalDia.calorias > 0 && (
          <div className="mt-4">
            <div className="flex rounded-full overflow-hidden h-2" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <div style={{ width: `${Math.min((totalDia.proteinas * 4 / totalDia.calorias) * 100, 100)}%`, background: '#86efac' }} />
              <div style={{ width: `${Math.min((totalDia.carbohidratos * 4 / totalDia.calorias) * 100, 100)}%`, background: '#fde047' }} />
              <div style={{ width: `${Math.min((totalDia.grasas * 9 / totalDia.calorias) * 100, 100)}%`, background: '#fb923c' }} />
            </div>
            <div className="flex gap-4 mt-2 text-xs text-green-200">
              <span>🟢 Proteínas</span><span>🟡 Carbos</span><span>🟠 Grasas</span>
            </div>
          </div>
        )}
      </div>

      {/* Comidas */}
      {guardando && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          Guardando producto…
        </div>
      )}

      <div className="flex flex-col gap-4">
        {comidas.map((comida) => {
          const macrosComida = calcMacrosComida(comida.alimentos)
          return (
            <div key={comida.id} className="card">
              {/* Header comida */}
              <div className="flex items-center gap-3 mb-3">
                <button onClick={() => setComidas(prev => prev.map(c => c.id === comida.id ? { ...c, expandida: !c.expandida } : c))}
                  className="text-gray-400 hover:text-gray-600">
                  {comida.expandida ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <select
                  className="font-semibold text-gray-800 bg-transparent border-none outline-none cursor-pointer text-base flex-1"
                  value={comida.nombre}
                  onChange={e => actualizarNombreComida(comida.id, e.target.value)}
                >
                  {COMIDAS_PREDEFINIDAS.map(n => <option key={n} value={n}>{n}</option>)}
                  {!COMIDAS_PREDEFINIDAS.includes(comida.nombre) && <option value={comida.nombre}>{comida.nombre}</option>}
                </select>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <span className="font-semibold text-gray-600">{macrosComida.calorias.toFixed(0)} kcal</span>
                  <span>P:{macrosComida.proteinas.toFixed(0)}g</span>
                  <span>C:{macrosComida.carbohidratos.toFixed(0)}g</span>
                  <span>G:{macrosComida.grasas.toFixed(0)}g</span>
                </div>
                <button onClick={() => eliminarComida(comida.id)} className="text-gray-300 hover:text-red-400 ml-2">
                  <Trash2 size={15} />
                </button>
              </div>

              {comida.expandida && (
                <>
                  {/* Tabla de alimentos */}
                  {comida.alimentos.length > 0 && (
                    <div className="mb-3 border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium">Alimento</th>
                            <th className="text-right px-3 py-2 text-gray-500 font-medium w-24">Gramos</th>
                            <th className="text-right px-3 py-2 text-gray-500 font-medium w-20">Kcal</th>
                            <th className="text-right px-3 py-2 text-gray-500 font-medium w-16">Prot</th>
                            <th className="text-right px-3 py-2 text-gray-500 font-medium w-16">Carb</th>
                            <th className="text-right px-3 py-2 text-gray-500 font-medium w-16">Gras</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {comida.alimentos.map((af, idx) => {
                            const m = calcularMacrosPorCantidad(af.alimento.calorias, af.alimento.proteinas, af.alimento.carbohidratos, af.alimento.grasas, af.alimento.fibra, af.cantidad_gramos)
                            return (
                              <tr key={af.id} style={{ borderTop: idx > 0 ? '1px solid #f3f4f6' : undefined }}>
                                <td className="px-3 py-2 text-gray-800">{af.alimento.nombre}</td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    className="w-20 text-right border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-green-400"
                                    value={af.cantidad_gramos}
                                    min={1}
                                    onChange={e => actualizarGramos(comida.id, af.id, parseFloat(e.target.value) || 0)}
                                  />
                                  <span className="text-gray-400 text-xs ml-1">g</span>
                                </td>
                                <td className="px-3 py-2 text-right text-gray-700 font-medium">{m.calorias.toFixed(0)}</td>
                                <td className="px-3 py-2 text-right text-gray-500">{m.proteinas.toFixed(1)}g</td>
                                <td className="px-3 py-2 text-right text-gray-500">{m.carbohidratos.toFixed(1)}g</td>
                                <td className="px-3 py-2 text-right text-gray-500">{m.grasas.toFixed(1)}g</td>
                                <td className="px-3 py-2">
                                  <button onClick={() => eliminarAlimento(comida.id, af.id)} className="text-gray-300 hover:text-red-400">
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Buscador */}
                  {busquedaAbierta === comida.id ? (
                    <div className="relative">
                      {/* Tabs fuente */}
                      <div className="flex gap-1 mb-2">
                        {([['local', '📋 Mi base de datos'], ['off', '🛒 Supermercado']] as [Fuente, string][]).map(([f, label]) => (
                          <button
                            key={f}
                            onClick={() => setFuente(f)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${fuente === f
                              ? 'bg-green-600 text-white border-green-600'
                              : 'text-gray-500 border-gray-200 hover:border-green-300'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                        <button
                          onClick={() => { setBusquedaAbierta(null); setQueryAlimento(''); setResultados([]) }}
                          className="ml-auto text-gray-400 hover:text-gray-600 p-1"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      {/* Input */}
                      <div className="flex items-center border border-green-400 rounded-lg overflow-hidden" style={{ boxShadow: '0 0 0 3px rgba(22,163,74,0.1)' }}>
                        <Search size={15} className="ml-3 text-gray-400 flex-shrink-0" />
                        <input
                          autoFocus
                          className="flex-1 px-3 py-2 outline-none text-sm"
                          placeholder={fuente === 'local' ? 'Buscar en mi base de datos…' : 'Buscar producto de supermercado…'}
                          value={queryAlimento}
                          onChange={e => setQueryAlimento(e.target.value)}
                        />
                        {queryAlimento && (
                          <button onClick={() => { setQueryAlimento(''); setResultados([]) }} className="px-3 text-gray-400 hover:text-gray-600">
                            <X size={15} />
                          </button>
                        )}
                      </div>

                      {/* Resultados */}
                      {(resultados.length > 0 || buscando || queryAlimento.length >= 2) && (
                        <div className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-72 overflow-y-auto">
                          {buscando && (
                            <p className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full border border-gray-400 border-t-transparent animate-spin inline-block" />
                              {fuente === 'off' ? 'Buscando en Open Food Facts…' : 'Buscando…'}
                            </p>
                          )}
                          {!buscando && resultados.map((a, i) => (
                            <button
                              key={i}
                              onClick={() => añadirAlimento(comida.id, a)}
                              className="w-full text-left px-3 py-2.5 hover:bg-green-50 transition-colors border-b border-gray-50 last:border-0 flex items-center gap-3"
                            >
                              {a.imagen && (
                                <img src={a.imagen} alt="" className="w-10 h-10 object-contain rounded flex-shrink-0 bg-gray-50" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800 text-sm truncate">{a.nombre}</p>
                                <p className="text-xs text-gray-400">
                                  {Number(a.calorias).toFixed(0)} kcal · P:{Number(a.proteinas).toFixed(1)}g · C:{Number(a.carbohidratos).toFixed(1)}g · G:{Number(a.grasas).toFixed(1)}g
                                  <span className="ml-1 text-gray-300">por 100g</span>
                                </p>
                              </div>
                              {a._fuente === 'off' && (
                                <span className="text-xs text-blue-400 flex-shrink-0">OFF</span>
                              )}
                            </button>
                          ))}
                          {!buscando && resultados.length === 0 && queryAlimento.length >= 2 && (
                            <p className="px-4 py-3 text-sm text-gray-400">
                              Sin resultados para &ldquo;{queryAlimento}&rdquo;
                              {fuente === 'local' && (
                                <button
                                  onClick={() => setFuente('off')}
                                  className="ml-2 text-green-600 underline"
                                >
                                  buscar en supermercado
                                </button>
                              )}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setBusquedaAbierta(comida.id); setQueryAlimento('') }}
                      className="w-full border border-dashed border-gray-200 rounded-lg py-2.5 text-sm text-gray-400 hover:border-green-300 hover:text-green-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus size={15} /> Añadir alimento
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}

        {/* Añadir comida */}
        <div className="card">
          <p className="text-sm font-medium text-gray-600 mb-3">Añadir comida</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {COMIDAS_PREDEFINIDAS.filter(p => !comidas.find(c => c.nombre === p)).map(p => (
              <button
                key={p}
                onClick={() => añadirComida(p)}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 hover:bg-green-50 transition-colors"
              >
                + {p}
              </button>
            ))}
            <button
              onClick={() => setMostrarInputCustom(v => !v)}
              className="text-xs px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors"
            >
              + Personalizado…
            </button>
          </div>
          {mostrarInputCustom && (
            <div className="flex gap-2">
              <input
                autoFocus
                className="input flex-1 text-sm"
                placeholder="Nombre de la comida…"
                value={nombreCustomComida}
                onChange={e => setNombreCustomComida(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') añadirComida(nombreCustomComida) }}
              />
              <button onClick={() => añadirComida(nombreCustomComida)} disabled={!nombreCustomComida.trim()} className="btn-primary">
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
