'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Search, X, ChevronDown, ChevronUp, Download, Power, PowerOff, Copy, Check, BookOpen } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { calcularMacrosPorCantidad, sumarMacros, COMIDAS_PREDEFINIDAS } from '@/lib/utils'
import type { Macros, PlanNutricion, Alimento } from '@/types'

type ResultadoBusqueda = Alimento & { imagen?: string; _fuente?: string }

interface RecetaConIngredientes {
  id: string
  nombre: string
  categoria: string | null
  imagen_url: string | null
  porciones: number
  ingredientes: {
    alimento_id: string | null
    nombre_libre: string | null
    cantidad_gramos: number
    alimento?: Alimento | null
  }[]
}
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import ListaCompra from '@/components/ListaCompra'

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

type Fuente = 'local' | 'off' | 'recetas'

export default function EditarDietaPage() {
  const { id } = useParams<{ id: string }>()
  const { addToast } = useToast()
  const [plan, setPlan] = useState<PlanNutricion | null>(null)
  const [comidas, setComidas] = useState<ComidaLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [copiadoId, setCopiadoId] = useState(false)
  const [porcionesVis, setPorcionesVis] = useState(1)

  const [nombreCustomComida, setNombreCustomComida] = useState('')
  const [mostrarInputCustom, setMostrarInputCustom] = useState(false)

  // Buscador
  const [busquedaAbierta, setBusquedaAbierta] = useState<string | null>(null)
  const [fuente, setFuente] = useState<Fuente>('local')
  const [recetasIngredientes, setRecetasIngredientes] = useState<{ [recetaId: string]: RecetaConIngredientes }>({})
  const [queryReceta, setQueryReceta] = useState('')
  const [resultadosRecetas, setResultadosRecetas] = useState<{ id: string; nombre: string; categoria: string | null; imagen_url: string | null; porciones: number | null }[]>([])
  const [buscandoRecetas, setBuscandoRecetas] = useState(false)
  const [queryAlimento, setQueryAlimento] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [descargandoPDF, setDescargandoPDF] = useState(false)

  useEffect(() => { loadPlan() }, [id])

  async function toggleActivo() {
    if (!plan) return
    setToggling(true)
    const nuevoEstado = !plan.activo
    const { error } = await supabase
      .from('planes_nutricion')
      .update({ activo: nuevoEstado })
      .eq('id', id)
    if (!error) {
      setPlan((prev: PlanNutricion | null) => ({ ...prev!, activo: nuevoEstado }))
      addToast({
        type: 'success',
        title: nuevoEstado ? 'Plan activado' : 'Plan desactivado',
        message: nuevoEstado ? 'Este plan ahora está activo para el cliente' : 'El plan ha sido desactivado'
      })
    } else {
      addToast({ type: 'error', title: 'Error', message: 'No se pudo cambiar el estado' })
    }
    setToggling(false)
  }

  async function copiarEnlacePublico() {
    if (!plan?.codigo_publico) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/cliente/${plan.codigo_publico}`)
      setCopiadoId(true)
      addToast({ type: 'success', title: 'Enlace copiado', message: 'Enlace público copiado al portapapeles' })
      setTimeout(() => setCopiadoId(false), 2000)
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'No se pudo copiar el enlace' })
    }
  }


  async function descargarPDF() {
    setDescargandoPDF(true)
    try {
      const response = await fetch(`/api/dietas/${id}/pdf`)
      if (!response.ok) throw new Error('Error al generar PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Plan-${plan?.cliente?.profile?.nombre}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error(error)
      addToast({ type: 'error', title: 'Error', message: 'Error al descargar PDF' })
    } finally {
      setDescargandoPDF(false)
    }
  }

  async function loadPlan() {
    const [planRes, comidasRes] = await Promise.all([
      supabase.from('planes_nutricion').select('*, cliente:clientes(id, profile:profiles!profile_id(nombre, apellidos))').eq('id', id).single(),
      supabase.from('comidas').select('*, alimentos:comida_alimentos(id, cantidad_gramos, alimento:alimentos(*))').eq('plan_id', id).order('orden'),
    ])
    setPlan(planRes.data)
    setComidas((comidasRes.data ?? []).map(c => ({ ...c, expandida: true })))
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

  // Búsqueda de recetas (solo cuando fuente === 'recetas')
  useEffect(() => {
    if (fuente !== 'recetas') return
    if (!queryReceta || queryReceta.length < 2) { setResultadosRecetas([]); return }
    setBuscandoRecetas(true)
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('recetas').select('id, nombre, categoria, imagen_url, porciones')
        .ilike('nombre', `%${queryReceta}%`).order('nombre').limit(12)
      setResultadosRecetas(data ?? [])
      setBuscandoRecetas(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [queryReceta, fuente])

  async function seleccionarReceta(receta: { id: string; nombre: string; categoria: string | null; imagen_url: string | null; porciones: number | null }) {
    // Si ya la tenemos en caché, reusar
    if (recetasIngredientes[receta.id]) {
      await añadirIngredientesReceta(receta.id, recetasIngredientes[receta.id])
      return
    }

    // Fetch ingredientes de la receta
    const { data: ingredientes } = await supabase
      .from('receta_ingredientes')
      .select('*, alimento:alimentos(*)')
      .eq('receta_id', receta.id)
      .order('orden')

    if (!ingredientes || ingredientes.length === 0) {
      addToast({ type: 'error', title: 'Sin ingredientes', message: 'Esta receta no tiene ingredientes vinculados' })
      return
    }

    const recetaCompleta: RecetaConIngredientes = {
      id: receta.id,
      nombre: receta.nombre,
      categoria: receta.categoria,
      imagen_url: receta.imagen_url,
      porciones: receta.porciones || 1,
      ingredientes: ingredientes.map(ing => ({
        alimento_id: ing.alimento_id,
        nombre_libre: ing.nombre_libre,
        cantidad_gramos: ing.cantidad_gramos,
        alimento: ing.alimento,
      })),
    }

    setRecetasIngredientes(prev => ({ ...prev, [receta.id]: recetaCompleta }))
    await añadirIngredientesReceta(receta.id, recetaCompleta)
  }

  async function añadirIngredientesReceta(recetaId: string, recetaCompleta: RecetaConIngredientes) {
    if (!busquedaAbierta) return
    const comidaId = busquedaAbierta

    // Cerrar buscador inmediatamente para mejor UX
    setBusquedaAbierta(null)
    setQueryAlimento('')
    setQueryReceta('')
    setResultados([])
    setResultadosRecetas([])

    const ingredientesValidos = recetaCompleta.ingredientes.filter(ing => ing.alimento_id && ing.cantidad_gramos > 0)
    const sinAlimento = recetaCompleta.ingredientes.filter(ing => !ing.alimento_id)

    if (ingredientesValidos.length === 0) {
      addToast({
        type: 'error',
        title: 'No se pudo añadir',
        message: `Ningún ingrediente de "${recetaCompleta.nombre}" está vinculado a la base de datos`,
      })
      return
    }

    // Insertar cada ingrediente como comida_alimento
    let insertados = 0
    for (const ing of ingredientesValidos) {
      const { data } = await supabase.from('comida_alimentos').insert({
        comida_id: comidaId,
        alimento_id: ing.alimento_id!,
        cantidad_gramos: ing.cantidad_gramos,
      }).select().single()

      if (data && ing.alimento) {
        setComidas(prev => prev.map(c =>
          c.id === comidaId
            ? {
              ...c,
              alimentos: [...c.alimentos, {
                id: data.id,
                cantidad_gramos: ing.cantidad_gramos,
                alimento: {
                  id: ing.alimento!.id,
                  nombre: ing.alimento!.nombre,
                  calorias: ing.alimento!.calorias,
                  proteinas: ing.alimento!.proteinas,
                  carbohidratos: ing.alimento!.carbohidratos,
                  grasas: ing.alimento!.grasas,
                  fibra: ing.alimento!.fibra ?? 0,
                },
              }],
            }
            : c
        ))
        insertados++
      }
    }

    const msgPartes = [`${insertados} ingredientes de "${recetaCompleta.nombre}" añadidos`]
    if (sinAlimento.length > 0) {
      msgPartes.push(`${sinAlimento.length} sin vincular (añádelos manualmente)`)
    }
    addToast({ type: 'success', title: 'Receta añadida', message: msgPartes.join('. ') })
  }

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

  async function añadirAlimento(comidaId: string, alimento: Alimento & { imagen?: string }) {
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

  const totalDiaBase = sumarMacros(comidas.map(c => calcMacrosComida(c.alimentos)))
  const totalDia = {
    calorias: totalDiaBase.calorias * porcionesVis,
    proteinas: totalDiaBase.proteinas * porcionesVis,
    carbohidratos: totalDiaBase.carbohidratos * porcionesVis,
    grasas: totalDiaBase.grasas * porcionesVis,
    fibra: totalDiaBase.fibra * porcionesVis,
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" /></div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dietas" className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{plan?.nombre}</h1>
            <span className={`badge ${plan?.activo ? 'badge-green' : 'badge-gray'}`}>
              {plan?.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{plan?.cliente?.profile?.nombre} {plan?.cliente?.profile?.apellidos}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle activo */}
          <button
            onClick={toggleActivo}
            disabled={toggling}
            className={`btn-secondary flex items-center gap-1.5 text-sm ${plan?.activo ? 'text-[#8E8E93]' : 'text-green-600'}`}
            title={plan?.activo ? 'Desactivar plan' : 'Activar plan'}
          >
            {toggling ? (
              <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : plan?.activo ? (
              <PowerOff size={14} />
            ) : (
              <Power size={14} />
            )}
            {plan?.activo ? 'Desactivar' : 'Activar'}
          </button>

          {/* Copiar enlace público */}
          {plan?.codigo_publico && (
            <button
              onClick={copiarEnlacePublico}
              className="btn-secondary flex items-center gap-1.5 text-sm"
              title="Copiar enlace público"
            >
              {copiadoId ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              Enlace
            </button>
          )}

          <button
            onClick={descargarPDF}
            disabled={descargandoPDF}
            className="btn-primary flex items-center gap-2 px-4 py-2"
          >
            <Download size={16} />
            {descargandoPDF ? 'Descargando...' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Totales del día */}
      <div className="card mb-6" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', border: 'none', color: 'white' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-green-100 text-sm mb-1">Total del día</p>
            <p className="text-3xl font-bold">{totalDia.calorias.toFixed(0)} <span className="text-xl font-normal" style={{ color: 'var(--primary-bg)' }}>kcal</span></p>
            {plan?.kcal_objetivo && (
              <p className="text-sm mt-1" style={{ color: 'var(--primary-bg)' }}>Objetivo: {plan.kcal_objetivo} kcal</p>
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
                <p className="text-xs" style={{ color: 'var(--primary-bg)' }}>{label}</p>
                {obj && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>/ {obj}g</p>}
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
            <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--primary-bg)' }}>
              <span>🟢 Proteínas</span><span>🟡 Carbos</span><span>🟠 Grasas</span>
            </div>
          </div>
        )}
      </div>

      {/* Recalculadora de porciones */}
      <div className="card mb-4 flex items-center gap-3 py-3 px-4">
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>🍽️ Porciones:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPorcionesVis(p => Math.max(0.25, p - 0.25))}
            className="w-7 h-7 flex items-center justify-center rounded text-sm font-bold"
            style={{ background: 'var(--bg)', color: 'var(--text)' }}
          >−</button>
          <input
            type="number"
            min={0.25}
            max={20}
            step={0.25}
            value={porcionesVis}
            onChange={e => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v) && v >= 0.25 && v <= 20) setPorcionesVis(v)
            }}
            className="w-16 text-center text-sm font-semibold border rounded"
            style={{
              background: 'var(--bg)',
              color: 'var(--text)',
              borderColor: 'var(--border)',
            }}
          />
          <button
            onClick={() => setPorcionesVis(p => Math.min(20, p + 0.25))}
            className="w-7 h-7 flex items-center justify-center rounded text-sm font-bold"
            style={{ background: 'var(--bg)', color: 'var(--text)' }}
          >+</button>
        </div>
        {porcionesVis !== 1 && (
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            Mostrando ×{porcionesVis.toFixed(2).replace(/\.?0+$/, '')} &middot; Base: {totalDiaBase.calorias.toFixed(0)} kcal
          </span>
        )}
      </div>

      {/* Comidas */}
      {guardando && (
        <div className="fixed bottom-4 right-4 text-sm px-4 py-2 rounded-lg flex items-center gap-2 z-50" style={{ backgroundColor: 'var(--text)', color: 'var(--bg)' }}>
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
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                  {comida.expandida ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <select
                  className="font-semibold bg-transparent border-none outline-none cursor-pointer text-base flex-1"
                  style={{ color: 'var(--text)' }}
                  value={comida.nombre}
                  onChange={e => actualizarNombreComida(comida.id, e.target.value)}
                >
                  {COMIDAS_PREDEFINIDAS.map(n => <option key={n} value={n}>{n}</option>)}
                  {!COMIDAS_PREDEFINIDAS.includes(comida.nombre) && <option value={comida.nombre}>{comida.nombre}</option>}
                </select>
                <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{macrosComida.calorias.toFixed(0)} kcal</span>
                  <span>P:{macrosComida.proteinas.toFixed(0)}g</span>
                  <span>C:{macrosComida.carbohidratos.toFixed(0)}g</span>
                  <span>G:{macrosComida.grasas.toFixed(0)}g</span>
                </div>
                <button onClick={() => eliminarComida(comida.id)} className="ml-2"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
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
                          <tr style={{ background: 'var(--bg)' }}>
                            <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Alimento</th>
                            <th className="text-right px-3 py-2 font-medium w-24" style={{ color: 'var(--text-secondary)' }}>Gramos</th>
                            <th className="text-right px-3 py-2 font-medium w-20" style={{ color: 'var(--text-secondary)' }}>Kcal</th>
                            <th className="text-right px-3 py-2 font-medium w-16" style={{ color: 'var(--text-secondary)' }}>Prot</th>
                            <th className="text-right px-3 py-2 font-medium w-16" style={{ color: 'var(--text-secondary)' }}>Carb</th>
                            <th className="text-right px-3 py-2 font-medium w-16" style={{ color: 'var(--text-secondary)' }}>Gras</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {comida.alimentos.map((af, idx) => {
                            const m = calcularMacrosPorCantidad(af.alimento.calorias, af.alimento.proteinas, af.alimento.carbohidratos, af.alimento.grasas, af.alimento.fibra, af.cantidad_gramos)
                            return (
                              <tr key={af.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : undefined }}>
                                <td className="px-3 py-2" style={{ color: 'var(--text)' }}>{af.alimento.nombre}</td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    className="w-20 text-right rounded px-2 py-1 text-sm outline-none"
                                    style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
                                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)' }}
                                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                                    value={af.cantidad_gramos}
                                    min={1}
                                    onChange={e => actualizarGramos(comida.id, af.id, parseFloat(e.target.value) || 0)}
                                  />
                                  <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>g</span>
                                </td>
                                <td className="px-3 py-2 text-right font-medium" style={{ color: 'var(--text)' }}>{m.calorias.toFixed(0)}</td>
                                <td className="px-3 py-2 text-right" style={{ color: 'var(--text-secondary)' }}>{m.proteinas.toFixed(1)}g</td>
                                <td className="px-3 py-2 text-right" style={{ color: 'var(--text-secondary)' }}>{m.carbohidratos.toFixed(1)}g</td>
                                <td className="px-3 py-2 text-right" style={{ color: 'var(--text-secondary)' }}>{m.grasas.toFixed(1)}g</td>
                                <td className="px-3 py-2">
                                  <button onClick={() => eliminarAlimento(comida.id, af.id)}
                                    style={{ color: 'var(--text-muted)' }}
                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)' }}
                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
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
                        {([['local', '📋 Mi base de datos'], ['off', '🛒 Supermercado'], ['recetas', '🍳 Recetas']] as [Fuente, string][]).map(([f, label]) => (
                          <button
                            key={f}
                            onClick={() => setFuente(f as Fuente)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors`}
                            style={fuente === f
                              ? { backgroundColor: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }
                              : { color: 'var(--text-secondary)', borderColor: 'var(--border)' }
                            }
                            onMouseEnter={e => {
                              if (fuente !== f) {
                                e.currentTarget.style.borderColor = 'var(--primary-light)'
                                e.currentTarget.style.color = 'var(--primary)'
                              }
                            }}
                            onMouseLeave={e => {
                              if (fuente !== f) {
                                e.currentTarget.style.borderColor = 'var(--border)'
                                e.currentTarget.style.color = 'var(--text-secondary)'
                              }
                            }}
                          >
                            {label}
                          </button>
                        ))}
                        <button
                          onClick={() => { setBusquedaAbierta(null); setQueryAlimento(''); setQueryReceta(''); setResultados([]); setResultadosRecetas([]) }}
                          className="ml-auto p-1"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                        >
                          <X size={15} />
                        </button>
                      </div>

                      {/* Input */}
                      <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--primary)', boxShadow: '0 0 0 3px var(--primary-ring)' }}>
                        <Search size={15} className="ml-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        <input
                          autoFocus
                          className="flex-1 px-3 py-2 outline-none text-sm"
                          placeholder={fuente === 'local' ? 'Buscar en mi base de datos…' : fuente === 'off' ? 'Buscar producto de supermercado…' : 'Buscar receta…'}
                          value={fuente === 'recetas' ? queryReceta : queryAlimento}
                          onChange={e => {
                            if (fuente === 'recetas') setQueryReceta(e.target.value)
                            else setQueryAlimento(e.target.value)
                          }}
                        />
                        {(fuente === 'recetas' ? queryReceta : queryAlimento) && (
                          <button onClick={() => {
                            if (fuente === 'recetas') { setQueryReceta(''); setResultadosRecetas([]) }
                            else { setQueryAlimento(''); setResultados([]) }
                          }} className="px-3"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                            <X size={15} />
                          </button>
                        )}
                      </div>

                      {/* Resultados */}
                      {fuente === 'recetas' ? (
                        <>
                          {/* Resultados de recetas */}
                          {(resultadosRecetas.length > 0 || buscandoRecetas || queryReceta.length >= 2) && (
                            <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg border max-h-72 overflow-y-auto"
                              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                              {buscandoRecetas && (
                                <p className="px-4 py-3 text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                  <span className="w-3 h-3 rounded-full border-t-transparent animate-spin inline-block" style={{ border: '1px solid var(--text-muted)', borderTopColor: 'transparent' }} />
                                  Buscando recetas…
                                </p>
                              )}
                              {!buscandoRecetas && resultadosRecetas.map(r => (
                                <button
                                  key={r.id}
                                  onClick={() => seleccionarReceta(r)}
                                  className="w-full text-left px-3 py-2.5 transition-colors flex items-center gap-3"
                                  style={{ borderBottom: '1px solid var(--border)' }}
                                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--primary-bg)' }}
                                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                                >
                                  {r.imagen_url ? (
                                    <img src={r.imagen_url} alt="" className="w-10 h-10 object-cover rounded flex-shrink-0" style={{ backgroundColor: 'var(--bg)' }} />
                                  ) : (
                                    <div className="w-10 h-10 rounded flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--primary-bg)' }}>
                                      <BookOpen size={16} style={{ color: 'var(--primary)' }} />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{r.nombre}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                      {r.categoria && <span className="mr-2">{r.categoria}</span>}
                                      {(r.porciones ?? 0) > 0 && <span>{r.porciones} porciones</span>}
                                    </p>
                                  </div>
                                  <span className="text-xs flex-shrink-0 rounded-full px-2 py-0.5" style={{ color: 'var(--primary)', borderColor: 'var(--primary-ring)', backgroundColor: 'var(--primary-bg)' }}>
                                    Receta
                                  </span>
                                </button>
                              ))}
                              {!buscandoRecetas && resultadosRecetas.length === 0 && queryReceta.length >= 2 && (
                                <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                                  Sin recetas para &ldquo;{queryReceta}&rdquo;
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Resultados de alimentos locales / OFF */}
                          {(resultados.length > 0 || buscando || queryAlimento.length >= 2) && (
                            <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg border max-h-72 overflow-y-auto"
                              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                              {buscando && (
                                <p className="px-4 py-3 text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                  <span className="w-3 h-3 rounded-full border-t-transparent animate-spin inline-block" style={{ border: '1px solid var(--text-muted)', borderTopColor: 'transparent' }} />
                                  {fuente === 'off' ? 'Buscando en Open Food Facts…' : 'Buscando…'}
                                </p>
                              )}
                              {!buscando && resultados.map((a, i) => (
                                <button
                                  key={i}
                                  onClick={() => añadirAlimento(comida.id, a)}
                                  className="w-full text-left px-3 py-2.5 transition-colors flex items-center gap-3"
                                  style={{ borderBottom: '1px solid var(--border)' }}
                                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--primary-bg)' }}
                                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                                >
                                  {a.imagen && (
                                    <img src={a.imagen} alt="" className="w-10 h-10 object-contain rounded flex-shrink-0" style={{ backgroundColor: 'var(--bg)' }} />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{a.nombre}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                      {Number(a.calorias).toFixed(0)} kcal · P:{Number(a.proteinas).toFixed(1)}g · C:{Number(a.carbohidratos).toFixed(1)}g · G:{Number(a.grasas).toFixed(1)}g
                                      <span className="ml-1" style={{ color: 'var(--text-muted)' }}>por 100g</span>
                                    </p>
                                  </div>
                                  {a._fuente === 'off' && (
                                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--info)' }}>OFF</span>
                                  )}
                                </button>
                              ))}
                              {!buscando && resultados.length === 0 && queryAlimento.length >= 2 && (
                                <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                                  Sin resultados para &ldquo;{queryAlimento}&rdquo;
                                  {fuente === 'local' && (
                                    <button
                                      onClick={() => setFuente('off')}
                                      className="ml-2 underline"
                                      style={{ color: 'var(--primary)' }}
                                    >
                                      buscar en supermercado
                                    </button>
                                  )}
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setBusquedaAbierta(comida.id); setQueryAlimento(''); setQueryReceta(''); setResultados([]); setResultadosRecetas([]); setFuente('local') }}
                      className="w-full border border-dashed rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
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
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Añadir comida</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {COMIDAS_PREDEFINIDAS.filter(p => !comidas.find(c => c.nombre === p)).map(p => (
              <button
                key={p}
                onClick={() => añadirComida(p)}
                className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'var(--primary-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                + {p}
              </button>
            ))}
            <button
              onClick={() => setMostrarInputCustom(v => !v)}
              className="text-xs px-3 py-1.5 rounded-full border border-dashed transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
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

        {/* ─── Lista de la Compra ─── */}
        <div className="mt-4">
          <ErrorBoundary>
            <ListaCompra comidas={comidas} nombrePlan={plan?.nombre} />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
