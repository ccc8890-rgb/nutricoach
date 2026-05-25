'use client'
import { useEffect, useState } from 'react'
import type { ElementType } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { ArrowLeft, Plus, Trash2, Search, X, ChevronDown, ChevronUp, Download, Power, PowerOff, Copy, Check, BookOpen, UtensilsCrossed, RefreshCw, Target, Flame, Beef, Wheat, Droplets, Loader2, ExternalLink, CalendarDays } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { calcularMacrosPorCantidad, sumarMacros, COMIDAS_PREDEFINIDAS } from '@/lib/utils'
import { KNOWN_TAGS } from '@/lib/auto-tag'
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
  alimento: Alimento
}

interface RecetaAsignada {
  id: string
  nombre: string
  imagen_url: string | null
  kcal: number
  proteinas: number
  carbohidratos: number
  grasas: number
  tiempo_prep_min: number | null
}

interface ComidaLocal {
  id: string
  nombre: string
  orden: number
  hora_sugerida: string
  dia_semana?: string | null
  receta_id?: string | null
  kcal_target?: number | null
  proteinas_target?: number | null
  carbos_target?: number | null
  grasas_target?: number | null
  alternativas_receta_ids?: string[] | null
  receta?: RecetaAsignada | null
  alimentos: AlimentoEnComida[]
  expandida: boolean
}

type RecetaEquivalente = RecetaAsignada & {
  tipo_plato?: string | null
}

type Fuente = 'local' | 'off' | 'recetas'

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
const DIA_DEFAULT = DIAS_SEMANA[0]
const DIA_ABR: Record<string, string> = {
  Lunes: 'L',
  Martes: 'M',
  Miércoles: 'X',
  Jueves: 'J',
  Viernes: 'V',
  Sábado: 'S',
  Domingo: 'D',
}

function diaComida(comida: Pick<ComidaLocal, 'dia_semana'>) {
  return comida.dia_semana || DIA_DEFAULT
}

function macroStatus(value: number, target?: number | null) {
  const t = Number(target ?? 0)
  if (t <= 0) return { pct: 0, delta: 0, label: 'sin objetivo', tone: 'neutral' as const }
  const delta = Math.round(value - t)
  const pct = Math.round((value / t) * 100)
  const abs = Math.abs(delta)
  const unit = t > 999 ? 'kcal' : 'g'
  const tolerance = Math.max(5, t * 0.05)
  return {
    pct,
    delta,
    label: abs <= tolerance ? 'en rango' : `${abs}${unit} ${delta > 0 ? 'sobre' : 'faltan'}`,
    tone: abs <= tolerance ? 'ok' as const : delta > 0 ? 'over' as const : 'under' as const,
  }
}

function MacroDial({ label, value, target, color, icon: Icon, unit }: {
  label: string
  value: number
  target?: number | null
  color: string
  icon: ElementType
  unit: 'kcal' | 'g'
}) {
  const s = macroStatus(value, target)
  const pctCapped = Math.min(Math.max(s.pct, 0), 125)
  const barWidth = Math.min(pctCapped, 100)
  const toneColor = s.tone === 'ok' ? '#10B981' : s.tone === 'over' ? '#F59E0B' : s.tone === 'under' ? '#64748B' : 'var(--text-muted)'
  return (
    <div className="rounded-2xl p-3" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon size={14} style={{ color }} />
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{label}</span>
        </div>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: toneColor }}>{s.pct || '—'}%</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>{Math.round(value)}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{unit}</span>
        {target ? <span className="text-xs ml-auto tabular-nums" style={{ color: 'var(--text-muted)' }}>/ {Math.round(target)}</span> : null}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, background: color }} />
      </div>
      <p className="text-[11px] mt-1.5 truncate" style={{ color: toneColor }}>{s.label}</p>
    </div>
  )
}

export default function EditarDietaPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const backHref = searchParams.get('returnTo') ?? '/dietas'
  const { addToast } = useToast()
  const [plan, setPlan] = useState<PlanNutricion | null>(null)
  const [comidas, setComidas] = useState<ComidaLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [copiadoId, setCopiadoId] = useState(false)
  const [porcionesVis, setPorcionesVis] = useState(1)
  const [diaActivo, setDiaActivo] = useState<string>(DIA_DEFAULT)
  const [copiandoDia, setCopiandoDia] = useState<string | null>(null)

  const [nombreCustomComida, setNombreCustomComida] = useState('')
  const [mostrarInputCustom, setMostrarInputCustom] = useState(false)

  // Buscador
  const [busquedaAbierta, setBusquedaAbierta] = useState<string | null>(null)
  const [fuente, setFuente] = useState<Fuente>('local')
  const [recetasIngredientes, setRecetasIngredientes] = useState<{ [recetaId: string]: RecetaConIngredientes }>({})
  const [queryReceta, setQueryReceta] = useState('')
  const [tagReceta, setTagReceta] = useState<string | null>(null)
  const [resultadosRecetas, setResultadosRecetas] = useState<{ id: string; nombre: string; categoria: string | null; imagen_url: string | null; porciones: number | null }[]>([])
  const [buscandoRecetas, setBuscandoRecetas] = useState(false)
  const [queryAlimento, setQueryAlimento] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [descargandoPDF, setDescargandoPDF] = useState(false)
  const [alternativasPorComida, setAlternativasPorComida] = useState<Record<string, RecetaEquivalente[]>>({})
  const [cargandoAlternativas, setCargandoAlternativas] = useState<Record<string, boolean>>({})
  const [recetaAplicando, setRecetaAplicando] = useState<string | null>(null)
  const [exploradorComida, setExploradorComida] = useState<string | null>(null)
  const [queryAlternativas, setQueryAlternativas] = useState('')
  const [resultadosAlternativas, setResultadosAlternativas] = useState<RecetaEquivalente[]>([])
  const [buscandoAlternativas, setBuscandoAlternativas] = useState(false)

  async function loadPlan() {
    const [planRes, comidasRes] = await Promise.all([
      supabase.from('planes_nutricion').select('*, cliente:clientes(id, profile:profiles!profile_id(nombre, apellidos))').eq('id', id).single(),
      supabase
        .from('comidas')
        .select('*, receta:recetas(id, nombre, imagen_url, kcal, proteinas, carbohidratos, grasas, tiempo_prep_min), alimentos:comida_alimentos(id, cantidad_gramos, alimento:alimentos(*))')
        .eq('plan_id', id)
        .order('orden'),
    ])
    setPlan(planRes.data)
    setComidas((comidasRes.data ?? []).map(c => ({ ...c, dia_semana: c.dia_semana ?? DIA_DEFAULT, expandida: true })))
    setLoading(false)
  }

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

  // Buscar — local o OFF según fuente activa
  useEffect(() => {
    if (!queryAlimento || queryAlimento.length < 2) { setResultados([]); return }
    setBuscando(true)
    const timer = setTimeout(async () => {
      if (fuente === 'local') {
        const { data } = await supabase.from('alimentos').select('*').eq('es_comestible', true).ilike('nombre', `%${queryAlimento}%`).limit(12)
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
  useEffect(() => { setResultados([]); setQueryAlimento(''); setQueryReceta(''); setTagReceta(null); setResultadosRecetas([]) }, [fuente])

  // Búsqueda de recetas (solo cuando fuente === 'recetas')
  useEffect(() => {
    if (fuente !== 'recetas') return
    if (!tagReceta && queryReceta.length < 2) { setResultadosRecetas([]); return }
    setBuscandoRecetas(true)
    const timer = setTimeout(async () => {
      let q = supabase.from('recetas').select('id, nombre, categoria, imagen_url, porciones')
        .eq('estado', 'aprobada')
      if (tagReceta) q = q.contains('tags', [tagReceta])
      if (queryReceta.length >= 2) q = q.ilike('nombre', `%${queryReceta}%`)
      const { data } = await q.order('nombre').limit(20)
      setResultadosRecetas(data ?? [])
      setBuscandoRecetas(false)
    }, tagReceta && !queryReceta ? 0 : 300)
    return () => clearTimeout(timer)
  }, [queryReceta, tagReceta, fuente])

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
    await aplicarRecetaAComida(comidaId, recetaId, recetaCompleta.nombre)
  }

  async function aplicarRecetaAComida(comidaId: string, recetaId: string, recetaNombre: string) {
    setRecetaAplicando(recetaId)

    // Cerrar buscador inmediatamente para mejor UX
    setBusquedaAbierta(null)
    setQueryAlimento('')
    setQueryReceta('')
    setTagReceta(null)
    setResultados([])
    setResultadosRecetas([])

    try {
      const res = await fetch(`/api/comidas/${comidaId}/receta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receta_id: recetaId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo aplicar la receta')

      setComidas(prev => prev.map(c =>
        c.id === comidaId
          ? {
            ...c,
            receta_id: data.receta?.id ?? recetaId,
            receta: data.receta ?? c.receta,
            alimentos: data.ingredientes,
            alternativas_receta_ids: (c.alternativas_receta_ids ?? []).filter(id => id !== recetaId),
          }
          : c
      ))
      setAlternativasPorComida(prev => {
        const next = { ...prev }
        delete next[comidaId]
        return next
      })

      const msg = data.sin_vincular > 0
        ? `${data.ingredientes.length} ingredientes aplicados. ${data.sin_vincular} sin vincular.`
        : `${data.ingredientes.length} ingredientes aplicados.`
      addToast({ type: 'success', title: 'Plato reemplazado', message: msg })
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo reemplazar',
        message: error instanceof Error ? error.message : `Error aplicando "${recetaNombre}"`,
      })
    } finally {
      setRecetaAplicando(null)
    }
  }

  async function añadirComida(nombre?: string) {
    const nombreFinal = nombre?.trim() || 'Comida ' + (comidas.length + 1)
    const { data } = await supabase.from('comidas').insert({
      plan_id: id, nombre: nombreFinal, orden: comidas.length, hora_sugerida: null, dia_semana: diaActivo,
    }).select().single()
    if (data) setComidas(prev => [...prev, { ...data, dia_semana: data.dia_semana ?? diaActivo, alimentos: [], expandida: true }])
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

  async function copiarDiaADestino(diaDestino: string) {
    const origen = comidas.filter(c => diaComida(c) === diaActivo)
    if (!origen.length || diaDestino === diaActivo) return

    setCopiandoDia(diaDestino)
    try {
      const comidasExistentesDestino = comidas.filter(c => diaComida(c) === diaDestino)
      const offsetOrden = comidas.length + comidasExistentesDestino.length
      const nuevasComidas: ComidaLocal[] = []

      for (const [idx, comida] of origen.entries()) {
        const { data: nuevaComida, error: comidaError } = await supabase
          .from('comidas')
          .insert({
            plan_id: id,
            nombre: comida.nombre,
            orden: offsetOrden + idx,
            hora_sugerida: comida.hora_sugerida || null,
            dia_semana: diaDestino,
            receta_id: comida.receta_id ?? null,
            kcal_target: comida.kcal_target ?? null,
            proteinas_target: comida.proteinas_target ?? null,
            carbos_target: comida.carbos_target ?? null,
            grasas_target: comida.grasas_target ?? null,
            alternativas_receta_ids: comida.alternativas_receta_ids ?? [],
          })
          .select('*, receta:recetas(id, nombre, imagen_url, kcal, proteinas, carbohidratos, grasas, tiempo_prep_min)')
          .single()

        if (comidaError || !nuevaComida) throw new Error(comidaError?.message ?? 'No se pudo copiar la comida')

        let alimentosCopiados: AlimentoEnComida[] = []
        if (comida.alimentos.length > 0) {
          const { data: nuevosAlimentos, error: alimentosError } = await supabase
            .from('comida_alimentos')
            .insert(comida.alimentos.map(af => ({
              comida_id: nuevaComida.id,
              alimento_id: af.alimento.id,
              cantidad_gramos: af.cantidad_gramos,
            })))
            .select('id, cantidad_gramos, alimento:alimentos(*)')

          if (alimentosError) throw new Error(alimentosError.message)
          alimentosCopiados = (nuevosAlimentos ?? []) as unknown as AlimentoEnComida[]
        }

        nuevasComidas.push({
          ...nuevaComida,
          dia_semana: diaDestino,
          alimentos: alimentosCopiados,
          expandida: true,
        } as ComidaLocal)
      }

      setComidas(prev => [...prev, ...nuevasComidas])
      setDiaActivo(diaDestino)
      addToast({ type: 'success', title: 'Día copiado', message: `${origen.length} comidas copiadas a ${diaDestino}` })
    } catch (error) {
      addToast({ type: 'error', title: 'No se pudo copiar el día', message: error instanceof Error ? error.message : 'Error copiando comidas' })
    } finally {
      setCopiandoDia(null)
    }
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

  function inferirTipoPlato(nombreComida: string): string | null {
    const n = nombreComida.toLowerCase()
    if (n.includes('desayuno')) return 'Desayuno'
    if (n.includes('almuerzo') || n.includes('media mañana')) return 'Almuerzo'
    if (n.includes('comida')) return 'Comida'
    if (n.includes('merienda') || n.includes('snack')) return 'Merienda'
    if (n.includes('cena')) return 'Cena'
    return null
  }

  async function cargarAlternativasComida(comida: ComidaLocal, macros: Macros) {
    setCargandoAlternativas(prev => ({ ...prev, [comida.id]: true }))
    try {
      const existentesParams = new URLSearchParams({
        comida_id: comida.id,
        ...(plan?.cliente_id ? { cliente_id: plan.cliente_id } : {}),
      })
      const existentesRes = await fetch(`/api/recetas/alternativas?${existentesParams}`)
      const existentesData = existentesRes.ok ? await existentesRes.json() as { alternativas?: RecetaEquivalente[] } : { alternativas: [] }

      const tipo = inferirTipoPlato(comida.nombre)
      const params = new URLSearchParams({
        kcal: String(Math.round(macros.calorias || comida.kcal_target || 0)),
        proteinas: String(Math.round(macros.proteinas || comida.proteinas_target || 0)),
        limite: '4',
        ...(plan?.cliente_id ? { cliente_id: plan.cliente_id } : {}),
        ...(tipo ? { tipo_plato: tipo } : {}),
      })
      const res = await fetch(`/api/recetas/sugeridas?${params}`)
      const data = await res.json() as { recetas?: RecetaEquivalente[] }
      const merged = [...(existentesData.alternativas ?? []), ...(data.recetas ?? [])]
      const unique = Array.from(new Map(merged.map(r => [r.id, r])).values())
      setAlternativasPorComida(prev => ({
        ...prev,
        [comida.id]: unique.filter(r => r.id !== comida.receta_id).slice(0, 8),
      }))
    } finally {
      setCargandoAlternativas(prev => ({ ...prev, [comida.id]: false }))
    }
  }

  async function guardarAlternativasCliente(comida: ComidaLocal, ids: string[]) {
    const idsLimpios = [...new Set(ids.filter(id => id && id !== comida.receta_id))].slice(0, 3)
    const res = await fetch(`/api/comidas/${comida.id}/alternativas`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alternativa_ids: idsLimpios }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      addToast({ type: 'error', title: 'No se pudieron guardar las opciones', message: data?.error ?? 'Error guardando alternativas' })
      return
    }
    setComidas(prev => prev.map(c => c.id === comida.id ? { ...c, alternativas_receta_ids: idsLimpios } : c))
    addToast({ type: 'success', title: 'Opciones del cliente actualizadas', message: `${idsLimpios.length}/3 opciones asignadas` })
  }

  async function buscarMasAlternativas(comida: ComidaLocal, macros: Macros, query?: string) {
    setBuscandoAlternativas(true)
    try {
      const tipo = inferirTipoPlato(comida.nombre)
      const params = new URLSearchParams({
        kcal: String(Math.round(macros.calorias || comida.kcal_target || 0)),
        proteinas: String(Math.round(macros.proteinas || comida.proteinas_target || 0)),
        limite: '7',
        ...(query?.trim() ? { q: query.trim() } : {}),
        ...(plan?.cliente_id ? { cliente_id: plan.cliente_id } : {}),
        ...(tipo ? { tipo_plato: tipo } : {}),
      })
      const res = await fetch(`/api/recetas/sugeridas?${params}`)
      const data = await res.json() as { recetas?: RecetaEquivalente[] }
      setResultadosAlternativas((data.recetas ?? []).filter(r => r.id !== comida.receta_id))
    } finally {
      setBuscandoAlternativas(false)
    }
  }

  // IDR de referencia (adulto general, EFSA / RDA estándar)
  const IDR: Record<string, { label: string; idr: number; unit: string; color: string }> = {
    vitamina_d_ug: { label: 'Vit D', idr: 15, unit: 'µg', color: '#F59E0B' },
    vitamina_c_mg: { label: 'Vit C', idr: 80, unit: 'mg', color: '#F97316' },
    vitamina_b12_ug: { label: 'B12', idr: 2.4, unit: 'µg', color: '#10B981' },
    vitamina_a_ug: { label: 'Vit A', idr: 800, unit: 'µg', color: '#6366F1' },
    vitamina_e_mg: { label: 'Vit E', idr: 12, unit: 'mg', color: '#8B5CF6' },
    calcio_mg: { label: 'Calcio', idr: 1000, unit: 'mg', color: '#3B82F6' },
    hierro_mg: { label: 'Hierro', idr: 14, unit: 'mg', color: '#EF4444' },
    zinc_mg: { label: 'Zinc', idr: 10, unit: 'mg', color: '#A855F7' },
    magnesio_mg: { label: 'Magnesio', idr: 375, unit: 'mg', color: '#06B6D4' },
    potasio_mg: { label: 'Potasio', idr: 3500, unit: 'mg', color: '#22C55E' },
    sodio_mg: { label: 'Sodio', idr: 2000, unit: 'mg', color: '#F43F5E' },
    poliinsaturados_g: { label: 'Ω-3/6', idr: 2, unit: 'g', color: '#0EA5E9' },
    saturados_g: { label: 'Sat', idr: 20, unit: 'g', color: '#EF4444' },
  }

  function calcMicrosTotales() {
    const totales: Record<string, number> = {}
    for (const comida of comidasDia) {
      for (const a of comida.alimentos) {
        const factor = a.cantidad_gramos / 100
        for (const key of Object.keys(IDR)) {
          const val = (a.alimento as unknown as Record<string, number>)[key]
          if (val && val > 0) {
            totales[key] = (totales[key] ?? 0) + val * factor
          }
        }
      }
    }
    return totales
  }

  const comidasDia = comidas.filter(c => diaComida(c) === diaActivo)
  const resumenSemana = DIAS_SEMANA.map(dia => {
    const comidasDelDia = comidas.filter(c => diaComida(c) === dia)
    const macros = sumarMacros(comidasDelDia.map(c => calcMacrosComida(c.alimentos)))
    return { dia, comidas: comidasDelDia, macros }
  })
  const diasConComidas = resumenSemana.filter(d => d.comidas.length > 0).length
  const promedioSemana = diasConComidas > 0
    ? resumenSemana.reduce((acc, d) => ({
      calorias: acc.calorias + d.macros.calorias / diasConComidas,
      proteinas: acc.proteinas + d.macros.proteinas / diasConComidas,
      carbohidratos: acc.carbohidratos + d.macros.carbohidratos / diasConComidas,
      grasas: acc.grasas + d.macros.grasas / diasConComidas,
      fibra: acc.fibra + d.macros.fibra / diasConComidas,
    }), { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 })
    : { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 }
  const microsTotales = calcMicrosTotales()
  const tieneMicrosDieta = Object.values(microsTotales).some(v => v > 0)

  const totalDiaBase = sumarMacros(comidasDia.map(c => calcMacrosComida(c.alimentos)))
  const totalDia = {
    calorias: totalDiaBase.calorias * porcionesVis,
    proteinas: totalDiaBase.proteinas * porcionesVis,
    carbohidratos: totalDiaBase.carbohidratos * porcionesVis,
    grasas: totalDiaBase.grasas * porcionesVis,
    fibra: totalDiaBase.fibra * porcionesVis,
  }

  useEffect(() => {
    if (!plan || comidas.length === 0) return
    for (const comida of comidasDia) {
      if (alternativasPorComida[comida.id] || cargandoAlternativas[comida.id]) continue
      cargarAlternativasComida(comida, calcMacrosComida(comida.alimentos))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, diaActivo, comidasDia.length])

  const macroObjetivos = {
    calorias: plan?.kcal_objetivo ?? 0,
    proteinas: plan?.proteinas_objetivo ?? 0,
    carbohidratos: plan?.carbohidratos_objetivo ?? 0,
    grasas: plan?.grasas_objetivo ?? 0,
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" /></div>

  return (
    <>
      <BackButton href={backHref} />
      <div className="p-6 max-w-4xl mx-auto pt-16 lg:pt-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href={backHref} className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
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
        <section className="rounded-3xl p-4 sm:p-5 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Plan nutricional</p>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Objetivo diario vs dieta aplicada</h2>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
              <Target size={13} />
              {comidasDia.length} comidas · {diaActivo}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MacroDial label="Kcal" value={totalDia.calorias} target={macroObjetivos.calorias} color="#34C759" icon={Flame} unit="kcal" />
            <MacroDial label="Proteína" value={totalDia.proteinas} target={macroObjetivos.proteinas} color="#FF3B30" icon={Beef} unit="g" />
            <MacroDial label="Carbos" value={totalDia.carbohidratos} target={macroObjetivos.carbohidratos} color="#FF9500" icon={Wheat} unit="g" />
            <MacroDial label="Grasas" value={totalDia.grasas} target={macroObjetivos.grasas} color="#0A84FF" icon={Droplets} unit="g" />
          </div>
          <div className="mt-4 rounded-2xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between text-xs mb-2">
              <span style={{ color: 'var(--text-muted)' }}>Distribución calórica aplicada</span>
              <span className="tabular-nums font-semibold" style={{ color: 'var(--text)' }}>{totalDia.calorias.toFixed(0)} kcal</span>
            </div>
            <div className="flex rounded-full overflow-hidden h-2" style={{ background: 'var(--border)' }}>
              <div style={{ width: `${Math.min((totalDia.proteinas * 4 / Math.max(totalDia.calorias, 1)) * 100, 100)}%`, background: '#FF3B30' }} />
              <div style={{ width: `${Math.min((totalDia.carbohidratos * 4 / Math.max(totalDia.calorias, 1)) * 100, 100)}%`, background: '#FF9500' }} />
              <div style={{ width: `${Math.min((totalDia.grasas * 9 / Math.max(totalDia.calorias, 1)) * 100, 100)}%`, background: '#0A84FF' }} />
            </div>
          </div>
        </section>

        {/* Vista semanal */}
        <section className="rounded-3xl p-4 sm:p-5 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Semana nutricional</p>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Construcción por días</h2>
            </div>
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full w-fit" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
              <CalendarDays size={13} />
              Media días creados: {Math.round(promedioSemana.calorias)} kcal
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {resumenSemana.map(({ dia, comidas: comidasDelDia, macros }) => {
              const activo = dia === diaActivo
              const pct = macroObjetivos.calorias ? Math.round((macros.calorias / macroObjetivos.calorias) * 100) : 0
              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => setDiaActivo(dia)}
                  className="text-left rounded-2xl p-3 border transition-all active:scale-[0.98]"
                  style={{
                    borderColor: activo ? 'var(--primary)' : 'var(--border)',
                    background: activo ? 'var(--primary-bg)' : 'var(--bg)',
                    boxShadow: activo ? '0 12px 28px -18px var(--primary)' : 'none',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold" style={{ color: activo ? 'var(--primary)' : 'var(--text)' }}>{DIA_ABR[dia]}</span>
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{pct || '—'}%</span>
                  </div>
                  <p className="text-sm font-semibold mt-1 truncate" style={{ color: 'var(--text)' }}>{dia}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {comidasDelDia.length ? `${comidasDelDia.length} comidas · ${Math.round(macros.calorias)} kcal` : 'vacío'}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Trabajando {diaActivo}. Puedes copiar este día a otro y después cambiar platos concretos.
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              {DIAS_SEMANA.filter(dia => dia !== diaActivo).map(dia => (
                <button
                  key={dia}
                  type="button"
                  onClick={() => copiarDiaADestino(dia)}
                  disabled={copiandoDia !== null || comidasDia.length === 0}
                  className="text-xs font-semibold rounded-full px-3 py-1.5 border whitespace-nowrap disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}
                >
                  {copiandoDia === dia ? 'Copiando…' : `Copiar a ${dia}`}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Panel micronutrientes */}
        {tieneMicrosDieta && (
          <div className="card mb-4 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Micronutrientes del plan · % IDR
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {Object.entries(IDR).map(([key, { label, idr, unit, color }]) => {
                const val = microsTotales[key]
                if (!val || val === 0) return null
                const pct = Math.min((val / idr) * 100, 150)
                const pctDisplay = Math.round((val / idr) * 100)
                const barColor = pctDisplay >= 80 ? '#22C55E' : pctDisplay >= 50 ? '#F97316' : '#EF4444'
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      </span>
                      <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {val.toFixed(1)}{unit} <span className="font-semibold" style={{ color: barColor }}>{pctDisplay}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%`, background: barColor }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] mt-3" style={{ color: 'var(--text-muted)' }}>
              IDR adulto general (EFSA) · Solo alimentos con datos nutricionales completos
            </p>
          </div>
        )}

        {/* Recalculadora de porciones */}
        <div className="card mb-4 flex items-center gap-3 py-3 px-4">
          <span className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}><UtensilsCrossed size={15} /> Porciones:</span>
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
          {comidasDia.map((comida) => {
            const macrosComida = calcMacrosComida(comida.alimentos)
            const kcalDelta = macroStatus(macrosComida.calorias, comida.kcal_target)
            const recetaNombre = comida.receta?.nombre ?? 'Sin receta asignada'
            const alternativas = alternativasPorComida[comida.id] ?? []
            const opcionesCliente = comida.alternativas_receta_ids ?? []
            return (
              <div key={comida.id} className="card">
                {/* Header comida */}
                <div className="flex items-start gap-3 mb-4">
                  <button onClick={() => setComidas(prev => prev.map(c => c.id === comida.id ? { ...c, expandida: !c.expandida } : c))}
                    className="mt-1"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                    {comida.expandida ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  <Link
                    href={comida.receta_id ? `/recetas/${comida.receta_id}?returnTo=/dietas/${id}` : '#'}
                    className={`w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 block ${comida.receta_id ? 'transition-transform active:scale-[0.98]' : 'pointer-events-none'}`}
                    style={{ background: 'var(--bg)' }}
                    title={comida.receta_id ? 'Ver receta completa' : undefined}
                  >
                    {comida.receta?.imagen_url ? (
                      <img src={comida.receta.imagen_url} alt={recetaNombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                        <UtensilsCrossed size={22} />
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <select
                          className="text-[11px] font-semibold uppercase tracking-wide bg-transparent border-none outline-none cursor-pointer"
                          style={{ color: 'var(--text-muted)' }}
                          value={comida.nombre}
                          onChange={e => actualizarNombreComida(comida.id, e.target.value)}
                        >
                          {COMIDAS_PREDEFINIDAS.map(n => <option key={n} value={n}>{n}</option>)}
                          {!COMIDAS_PREDEFINIDAS.includes(comida.nombre) && <option value={comida.nombre}>{comida.nombre}</option>}
                        </select>
                        {comida.receta_id ? (
                          <Link
                            href={`/recetas/${comida.receta_id}?returnTo=/dietas/${id}`}
                            className="group inline-flex items-start gap-1.5 mt-0.5"
                            title="Ver receta completa"
                          >
                            <h3 className="font-bold leading-tight line-clamp-2 group-hover:underline" style={{ color: 'var(--text)' }}>{recetaNombre}</h3>
                            <ExternalLink size={13} className="mt-0.5 shrink-0 opacity-60" style={{ color: 'var(--text-muted)' }} />
                          </Link>
                        ) : (
                          <h3 className="font-bold leading-tight line-clamp-2 mt-0.5" style={{ color: 'var(--text)' }}>{recetaNombre}</h3>
                        )}
                      </div>
                      <button onClick={() => eliminarComida(comida.id)} className="p-1 shrink-0"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      {[
                        { label: 'Kcal', value: macrosComida.calorias, target: comida.kcal_target, color: '#34C759', unit: '' },
                        { label: 'P', value: macrosComida.proteinas, target: comida.proteinas_target, color: '#FF3B30', unit: 'g' },
                        { label: 'C', value: macrosComida.carbohidratos, target: comida.carbos_target, color: '#FF9500', unit: 'g' },
                        { label: 'G', value: macrosComida.grasas, target: comida.grasas_target, color: '#0A84FF', unit: 'g' },
                      ].map(m => {
                        const st = macroStatus(m.value, m.target)
                        return (
                          <div key={m.label} className="rounded-xl px-2.5 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold" style={{ color: m.color }}>{m.label}</span>
                              <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{st.pct || '—'}%</span>
                            </div>
                            <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--text)' }}>{Math.round(m.value)}{m.unit}</p>
                            <p className="text-[9px] truncate" style={{ color: st.tone === 'ok' ? '#10B981' : st.tone === 'over' ? '#F59E0B' : 'var(--text-muted)' }}>{st.label}</p>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[11px] mt-2" style={{ color: kcalDelta.tone === 'ok' ? '#10B981' : kcalDelta.tone === 'over' ? '#F59E0B' : 'var(--text-muted)' }}>
                      {comida.kcal_target ? `Objetivo comida: ${Math.round(comida.kcal_target)} kcal, ${kcalDelta.label}` : 'Sin objetivo específico por comida'}
                    </p>
                  </div>
                </div>

                {comida.expandida && (
                  <>
                    <div className="mb-4 rounded-2xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Opciones del cliente</p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{opcionesCliente.length}/3 visibles como equivalentes en el portal</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setExploradorComida(exploradorComida === comida.id ? null : comida.id)
                              setQueryAlternativas('')
                              setResultadosAlternativas([])
                            }}
                            className="text-xs font-semibold"
                            style={{ color: 'var(--primary)' }}
                          >
                            Explorar más
                          </button>
                          <button
                            type="button"
                            onClick={() => cargarAlternativasComida(comida, macrosComida)}
                            disabled={!!cargandoAlternativas[comida.id]}
                            className="text-xs font-semibold flex items-center gap-1.5"
                            style={{ color: 'var(--primary)' }}
                          >
                            {cargandoAlternativas[comida.id] ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            Sugerir
                          </button>
                        </div>
                      </div>
                      {alternativas.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {alternativas.map(r => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                const next = opcionesCliente.includes(r.id)
                                  ? opcionesCliente.filter(id => id !== r.id)
                                  : [...opcionesCliente, r.id]
                                guardarAlternativasCliente(comida, next)
                              }}
                              className="min-w-[190px] max-w-[220px] text-left rounded-xl border p-2.5 transition-colors"
                              style={{
                                borderColor: opcionesCliente.includes(r.id) ? 'var(--primary)' : 'var(--border)',
                                background: opcionesCliente.includes(r.id) ? 'var(--primary-bg)' : 'var(--surface)',
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'var(--bg)' }}>
                                  {r.imagen_url ? <img src={r.imagen_url} alt={r.nombre} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><BookOpen size={14} /></div>}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold line-clamp-2" style={{ color: 'var(--text)' }}>{r.nombre}</p>
                                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{Math.round(r.kcal)} kcal · P {Math.round(r.proteinas)}g</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-2">
                                <span className="text-[10px] font-semibold" style={{ color: opcionesCliente.includes(r.id) ? 'var(--primary)' : 'var(--text-muted)' }}>
                                  {opcionesCliente.includes(r.id) ? 'Asignada' : 'Asignar opción'}
                                </span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={e => {
                                    e.stopPropagation()
                                    aplicarRecetaAComida(comida.id, r.id, r.nombre)
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.stopPropagation()
                                      aplicarRecetaAComida(comida.id, r.id, r.nombre)
                                    }
                                  }}
                                  className="text-[10px] font-semibold underline"
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  usar como principal
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Carga sugerencias para ver platos compatibles por kcal, proteína y tipo de comida.
                        </p>
                      )}

                      {exploradorComida === comida.id && (
                        <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1 min-w-0">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                              <input
                                value={queryAlternativas}
                                onChange={e => setQueryAlternativas(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') buscarMasAlternativas(comida, macrosComida, queryAlternativas)
                                }}
                                className="input w-full pl-9 text-sm"
                                placeholder="Buscar receta equivalente por nombre"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => buscarMasAlternativas(comida, macrosComida, queryAlternativas)}
                              className="btn-secondary text-sm"
                              disabled={buscandoAlternativas}
                            >
                              {buscandoAlternativas ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                              Buscar
                            </button>
                          </div>
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {resultadosAlternativas.map(r => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  const next = opcionesCliente.includes(r.id)
                                    ? opcionesCliente.filter(id => id !== r.id)
                                    : [...opcionesCliente, r.id]
                                  guardarAlternativasCliente(comida, next)
                                }}
                                className="text-left rounded-xl border p-2 transition-colors"
                                style={{
                                  borderColor: opcionesCliente.includes(r.id) ? 'var(--primary)' : 'var(--border)',
                                  background: opcionesCliente.includes(r.id) ? 'var(--primary-bg)' : 'var(--bg)',
                                }}
                              >
                                <p className="text-xs font-semibold line-clamp-2" style={{ color: 'var(--text)' }}>{r.nombre}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                  {Math.round(r.kcal)} kcal · P {Math.round(r.proteinas)}g · C {Math.round(r.carbohidratos)}g · G {Math.round(r.grasas)}g
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

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
                          {([['local', 'Base de datos'], ['off', 'Supermercado'], ['recetas', 'Recetas']] as [Fuente, string][]).map(([f, label]) => (
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
                            onClick={() => { setBusquedaAbierta(null); setQueryAlimento(''); setQueryReceta(''); setTagReceta(null); setResultados([]); setResultadosRecetas([]) }}
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
                          {/* Chip de tag activo */}
                          {fuente === 'recetas' && tagReceta && (
                            <span className="flex items-center gap-1 ml-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                              style={{ background: '#A3E635', color: '#1C1C1E' }}>
                              {tagReceta}
                              <button onMouseDown={e => { e.preventDefault(); setTagReceta(null); setResultadosRecetas([]) }}
                                className="rounded-full p-0.5 hover:bg-black/10">
                                <X size={11} />
                              </button>
                            </span>
                          )}
                          <input
                            autoFocus
                            className="flex-1 px-3 py-2 outline-none text-sm"
                            placeholder={tagReceta ? `Filtrar dentro de ${tagReceta}…` : fuente === 'local' ? 'Buscar en mi base de datos…' : fuente === 'off' ? 'Buscar producto de supermercado…' : 'Buscar receta o tipo…'}
                            value={fuente === 'recetas' ? queryReceta : queryAlimento}
                            onChange={e => {
                              if (fuente === 'recetas') setQueryReceta(e.target.value)
                              else setQueryAlimento(e.target.value)
                            }}
                          />
                          {(fuente === 'recetas' ? (queryReceta || tagReceta) : queryAlimento) && (
                            <button onClick={() => {
                              if (fuente === 'recetas') { setQueryReceta(''); setTagReceta(null); setResultadosRecetas([]) }
                              else { setQueryAlimento(''); setResultados([]) }
                            }} className="px-3"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                              <X size={15} />
                            </button>
                          )}
                        </div>

                        {/* Sugerencias de tags al escribir */}
                        {fuente === 'recetas' && !tagReceta && queryReceta.length >= 2 && (() => {
                          const q = queryReceta.toLowerCase()
                          const matches = KNOWN_TAGS.filter(t => t.toLowerCase().includes(q))
                          if (!matches.length) return null
                          return (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <span className="text-xs w-full" style={{ color: 'var(--text-muted)' }}>Filtrar por tipo:</span>
                              {matches.slice(0, 6).map(tag => (
                                <button key={tag}
                                  onMouseDown={e => { e.preventDefault(); setTagReceta(tag); setQueryReceta('') }}
                                  className="text-xs px-2.5 py-1 rounded-full border transition-all"
                                  style={{ background: 'rgba(163,230,53,0.12)', color: '#A3E635', borderColor: 'rgba(163,230,53,0.3)' }}>
                                  {tag}
                                </button>
                              ))}
                            </div>
                          )
                        })()}

                        {/* Resultados */}
                        {fuente === 'recetas' ? (
                          <>
                            {/* Resultados de recetas */}
                            {(resultadosRecetas.length > 0 || buscandoRecetas || queryReceta.length >= 2 || !!tagReceta) && (
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
                                {!buscandoRecetas && resultadosRecetas.length === 0 && (queryReceta.length >= 2 || tagReceta) && (
                                  <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                                    Sin recetas {tagReceta ? `de tipo ${tagReceta}` : `para "${queryReceta}"`}
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
                        onClick={() => { setBusquedaAbierta(comida.id); setQueryAlimento(''); setQueryReceta(''); setTagReceta(null); setResultados([]); setResultadosRecetas([]); setFuente('local') }}
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
              {COMIDAS_PREDEFINIDAS.filter(p => !comidasDia.find(c => c.nombre === p)).map(p => (
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
              <ListaCompra planId={id} clienteId={plan?.cliente_id ?? ''} nombrePlan={plan?.nombre} rol="coach" />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </>)
}
