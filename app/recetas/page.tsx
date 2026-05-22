'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Search, BookOpen, Inbox, AlertTriangle, Sparkles, SlidersHorizontal } from 'lucide-react'
import { StaggerList, StaggerItem, FadeIn, PageTransition } from '@/components/ui/Motion'
import { CATEGORIAS, TIPOS_COCCION, ICONOS_COCCION, INTOLERANCIAS, SUBCATEGORIAS, ALERGENOS_POSITIVOS, ALERGENOS_NEGATIVOS, DIETETICOS, normalizarReceta, normalizarIntolerancias, type RecetaNormalizada } from '@/lib/recetas-constants'
import { KNOWN_TAGS } from '@/lib/auto-tag'
import { useToast } from '@/components/ui/Toast'
import { RecipeCardPremium } from '@/components/premium'

const METODOS_COCCION = [
  { value: 'Todos', label: 'Todos' },
  ...TIPOS_COCCION.map(k => ({ value: k, label: k })),
]

function BotonCola() {
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      supabase.from('recetas').select('id', { count: 'exact', head: true })
        .or(`coach_id.eq.${user.id},coach_id.is.null`).in('estado', ['borrador', 'en_revision'])
        .then(({ count: c }) => { setCount(c ?? 0); setLoading(false) })
    })
  }, [])
  if (loading) return <div className="flex items-center gap-2 opacity-50 text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}><Inbox size={14} /> Cola</div>
  if (count === null || count === 0) return null
  return (
    <Link href='/recetas/cola'
      className="relative flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-all duration-200"
      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--accent)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
    >
      <Inbox size={14} />
      Cola
      <span className='absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold'
        style={{ background: 'var(--accent)' }}>{count}</span>
    </Link>
  )
}

type RecetaRow = {
  id: string
  nombre: string
  descripcion?: string | null
  imagen_url?: string | null
  categoria?: string | null
  tipo_coccion?: string | null
  dificultad?: string | null
  porciones?: number | null
  descripcion_porcion?: string | null
  tiempo_prep_min?: number | null
  tiempo_coccion_min?: number | null
  kcal?: number | null
  proteinas?: number | null
  carbohidratos?: number | null
  grasas?: number | null
  url_origen?: string | null
  tipo_plato?: string | null
  estado?: string | null
  intolerancias?: string[] | null
  kcal_por_porcion?: number | null
  proteinas_por_porcion?: number | null
  carbohidratos_por_porcion?: number | null
  grasas_por_porcion?: number | null
  pasos?: string | null
  url?: string | null
  instrucciones?: string | null
  tags?: string[] | null
  created_at?: string | null
  receta_ingredientes?: Array<{
    nombre_libre?: string | null
    alimento?: { nombre?: string | null } | Array<{ nombre?: string | null }> | null
  }> | null
}

export default function RecetasPage() {
  const { addToast } = useToast()
  const [recetas, setRecetas] = useState<RecetaRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('Todos')
  const [metodoCoccion, setMetodoCoccion] = useState('Todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [rangoKcal, setRangoKcal] = useState<string | null>(null)
  const [tiempoPrep, setTiempoPrep] = useState<string | null>(null)
  const [intoleranciaFilter, setIntoleranciaFilter] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [orden, setOrden] = useState<'reciente' | 'antiguo'>('reciente')
  const [loading, setLoading] = useState(true)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [showSearchDrop, setShowSearchDrop] = useState(false)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // Filtros rápidos: negativo (ej. "Sin Gluten") y dietético (ej. "Vegano")
  const [filtroRapido, setFiltroRapido] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) console.error('[recetas] Error auth.getUser:', userError)
        if (!user) { console.warn('[recetas] No hay usuario autenticado'); setLoading(false); return }

        const { data, error } = await supabase
          .from('recetas')
          .select('id, nombre, descripcion, imagen_url, categoria, tipo_coccion, dificultad, porciones, descripcion_porcion, tiempo_prep_min, tiempo_coccion_min, kcal, proteinas, carbohidratos, grasas, url_origen, tipo_plato, estado, tags, intolerancias, created_at, receta_ingredientes(nombre_libre, alimento:alimentos(nombre))')
          .or(`coach_id.eq.${user.id},coach_id.is.null`)
          .eq('estado', 'aprobada')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('[recetas] Error en query recetas:', error.message, error.details, error.hint)
        } else {
          console.log(`[recetas] ${data?.length ?? 0} recetas cargadas`)
        }

        // Normalizar intolerancias al cargar (tolerar "sin gluten" → "Sin Gluten")
        const normalizadas = (data ?? []).map(r => ({
          ...r,
          intolerancias: r.intolerancias ? normalizarIntolerancias(r.intolerancias) : null,
        }))
        setRecetas(normalizadas)
      } catch (e) {
        console.error('[recetas] Excepción inesperada:', e)
      }
      setLoading(false)
    }
    load()
  }, [])


  const filtradas = useMemo(() => {
    return recetas.map(r => ({ ...r, ...normalizarReceta(r) })).filter(r => {
      const q = busqueda.toLowerCase()
      const matchBusqueda = !q || r.nombre.toLowerCase().includes(q)
        || (Array.isArray(r.tags) && r.tags.some((t: string) => t.toLowerCase().includes(q)))
        || (r.descripcion?.toLowerCase().includes(q) ?? false)
        || (Array.isArray(r.receta_ingredientes) && r.receta_ingredientes.some(ing => {
          const alimento = Array.isArray(ing.alimento) ? ing.alimento[0] : ing.alimento
          return (ing.nombre_libre?.toLowerCase().includes(q) ?? false)
            || (alimento?.nombre?.toLowerCase().includes(q) ?? false)
        }))
      const tagLower = tagFilter?.toLowerCase() ?? ''
      const matchTag = !tagFilter || (
        (Array.isArray(r.tags) && r.tags.some(t => t.toLowerCase() === tagLower)) ||
        r.nombre.toLowerCase().includes(tagLower)
      )
      // Cuando hay sub-tag activo, el tag es la clasificación real → ignorar categoría principal
      const matchCategoria = categoria === 'Todos' || tagFilter !== null || r.categoria === categoria
      const matchCoccion = metodoCoccion === 'Todos' || r.tipo_coccion === metodoCoccion

      // Filtro rango kcal
      let matchKcal = true
      if (rangoKcal && r.kcal != null) {
        if (rangoKcal === '<300') matchKcal = r.kcal < 300
        else if (rangoKcal === '300-600') matchKcal = r.kcal >= 300 && r.kcal <= 600
        else if (rangoKcal === '>600') matchKcal = r.kcal > 600
      } else if (rangoKcal) {
        matchKcal = false // si el filtro está activo pero la receta no tiene kcal, no pasa
      }

      // Filtro tiempo preparación
      let matchTiempo = true
      if (tiempoPrep) {
        const totalMin = (r.tiempo_prep_min ?? 0) + (r.tiempo_coccion_min ?? 0)
        if (tiempoPrep === '<15') matchTiempo = totalMin > 0 && totalMin < 15
        else if (tiempoPrep === '15-30') matchTiempo = totalMin >= 15 && totalMin <= 30
        else if (tiempoPrep === '>30') matchTiempo = totalMin > 30
      }

      // Filtro intolerancia — soporta etiquetas positivas (ej. "Gluten") y negativas (ej. "Sin Gluten")
      let matchIntolerancia = true
      // El filtro rápido es un atajo: "Sin Gluten" busca recetas que tengan "Sin Gluten" en intolerancias
      const filtroActivo = filtroRapido || intoleranciaFilter
      if (filtroActivo) {
        const recetaIntolerancias = r.intolerancias ?? []
        matchIntolerancia = recetaIntolerancias.some(t => t.toLowerCase() === filtroActivo.toLowerCase())
      }

      let matchFecha = true
      if (r.created_at) {
        const fechaReceta = new Date(r.created_at)
        if (fechaDesde) {
          const desde = new Date(fechaDesde)
          matchFecha = matchFecha && fechaReceta >= desde
        }
        if (fechaHasta) {
          const hasta = new Date(fechaHasta + 'T23:59:59')
          matchFecha = matchFecha && fechaReceta <= hasta
        }
      }
      return matchBusqueda && matchCategoria && matchCoccion && matchTag && matchKcal && matchTiempo && matchIntolerancia && matchFecha
    })
      .sort((a, b) => {
        if (!a.created_at || !b.created_at) return 0
        const da = new Date(a.created_at).getTime()
        const db = new Date(b.created_at).getTime()
        return orden === 'reciente' ? db - da : da - db
      })
  }, [recetas, busqueda, categoria, metodoCoccion, fechaDesde, fechaHasta, tagFilter, orden, rangoKcal, tiempoPrep, intoleranciaFilter, filtroRapido])

  // Sugerencias de tags que coinciden con la búsqueda actual
  const tagSugeridos = useMemo(() => {
    if (!busqueda.trim() || busqueda.length < 2) return []
    const q = busqueda.toLowerCase()
    return KNOWN_TAGS
      .filter(tag => tag.toLowerCase().includes(q))
      .map(tag => ({
        tag,
        count: recetas.filter(r =>
          (Array.isArray(r.tags) && r.tags.some((t: string) => t.toLowerCase() === tag.toLowerCase())) ||
          r.nombre.toLowerCase().includes(tag.toLowerCase())
        ).length,
      }))
      .filter(s => s.count > 0)
      .slice(0, 5)
  }, [busqueda, recetas])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDrop(false)
      }
      if (
        showFilterPanel &&
        filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node) &&
        filterBtnRef.current && !filterBtnRef.current.contains(e.target as Node)
      ) {
        setShowFilterPanel(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showFilterPanel, showSearchDrop])

  const coccionEnUso = new Set(recetas.map(r => r.tipo_coccion).filter(Boolean))

  const chipActive = { background: '#A3E635', color: '#1C1C1E', fontWeight: 600, borderColor: '#A3E635' }
  const chipInactive = { color: 'var(--text-secondary)', borderColor: 'var(--border)' }
  const tagActive = { background: 'rgba(163,230,53,0.13)', color: '#A3E635', fontWeight: 600, borderColor: 'rgba(163,230,53,0.35)' }

  const activeFilterCount = [
    metodoCoccion !== 'Todos',
    rangoKcal !== null,
    tiempoPrep !== null,
    intoleranciaFilter !== null,
    filtroRapido !== null,
    !!(fechaDesde || fechaHasta),
  ].filter(Boolean).length

  return (
    <PageTransition>
      {/* ═══════ HERO SECTION ═══════ */}
      <div
        className="relative overflow-hidden pb-8 mb-6"
        style={{
          background: 'linear-gradient(180deg, var(--accent-bg) 0%, transparent 100%)',
        }}
      >
        {/* Grid decorativo */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--accent) 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative px-6 pt-8 pb-4 max-w-6xl mx-auto">
          <FadeIn delay={0}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
                  >
                    <Sparkles size={12} />
                    Recetario premium
                  </span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                  Recetas
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {recetas.length} receta{recetas.length !== 1 ? 's' : ''} en tu colección
                </p>
              </div>
              <div className="flex items-center gap-2">
                <BotonCola />
                <Link href="/recetas/auditoria" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 hide-mobile"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                >
                  <AlertTriangle size={13} /> Auditoría
                </Link>
                <Link href="/recetas/nueva"
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200"
                  style={{ background: 'var(--accent)', color: '#1C1C1E' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 20px var(--accent-glow)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
                >
                  <Plus size={15} /> Nueva
                </Link>
              </div>
            </div>
          </FadeIn>

          {/* Buscador */}
          <FadeIn delay={0.1}>
            <div ref={searchRef} className="relative max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all duration-200"
                placeholder="Buscar por nombre, ingrediente o tipo…"
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setShowSearchDrop(true) }}
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-ring)'; setShowSearchDrop(true) }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
                autoComplete="off"
              />
              {/* Dropdown sugerencias de tags */}
              {showSearchDrop && tagSugeridos.length > 0 && (
                <div
                  className="absolute z-30 left-0 right-0 mt-1 rounded-xl shadow-xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', minWidth: '260px' }}
                >
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Filtrar por tipo
                  </p>
                  {tagSugeridos.map(({ tag, count }) => (
                    <button
                      key={tag}
                      type="button"
                      onMouseDown={e => {
                        e.preventDefault()
                        setTagFilter(tag)
                        setCategoria('Todos')
                        setBusqueda('')
                        setShowSearchDrop(false)
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm transition-colors"
                      style={{ color: 'var(--text)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium truncate max-w-[180px]"
                          style={{ background: 'rgba(163,230,53,0.15)', color: '#A3E635' }}
                        >
                          {tag}
                        </span>
                      </span>
                      <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{count} recetas</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FadeIn>
        </div>
      </div>

      <div className="px-6 max-w-6xl mx-auto pb-safe">
        {/* ═══════ FILTROS ═══════ */}
        <FadeIn delay={0.15}>
          {/* Fila utilidad: botón Filtros + Orden */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="relative">
              <button
                ref={filterBtnRef}
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all duration-150"
                style={activeFilterCount > 0
                  ? { borderColor: 'rgba(163,230,53,0.4)', color: '#A3E635', background: 'rgba(163,230,53,0.07)' }
                  : { borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}
              >
                <SlidersHorizontal size={13} />
                Filtros
                {activeFilterCount > 0 && (
                  <span
                    className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                    style={{ background: '#A3E635', color: '#1C1C1E' }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {showFilterPanel && (
                <div
                  ref={filterPanelRef}
                  className="absolute top-full left-0 mt-2 rounded-2xl border p-5 z-50"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    minWidth: 300,
                    maxWidth: 'calc(100vw - 2rem)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                  }}
                >
                  {/* Cocción */}
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
                      Método de cocción
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {METODOS_COCCION.filter(m => m.value === 'Todos' || coccionEnUso.has(m.value)).map(m => (
                        <button
                          key={m.value}
                          onClick={() => setMetodoCoccion(m.value)}
                          className="text-xs whitespace-nowrap px-2.5 py-1 rounded-full border font-medium transition-all duration-150 flex items-center gap-1"
                          style={metodoCoccion === m.value ? chipActive : chipInactive}
                        >
                          {m.value !== 'Todos' && ICONOS_COCCION[m.value]}
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kcal */}
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
                      Kcal por porción
                    </p>
                    <div className="flex gap-1.5">
                      {[
                        { value: '<300', label: '< 300' },
                        { value: '300-600', label: '300–600' },
                        { value: '>600', label: '> 600' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setRangoKcal(rangoKcal === opt.value ? null : opt.value)}
                          className="text-xs px-2.5 py-1 rounded-full border font-medium transition-all duration-150"
                          style={rangoKcal === opt.value ? chipActive : chipInactive}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tiempo */}
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
                      Tiempo de preparación
                    </p>
                    <div className="flex gap-1.5">
                      {[
                        { value: '<15', label: '< 15 min' },
                        { value: '15-30', label: '15–30 min' },
                        { value: '>30', label: '> 30 min' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setTiempoPrep(tiempoPrep === opt.value ? null : opt.value)}
                          className="text-xs px-2.5 py-1 rounded-full border font-medium transition-all duration-150"
                          style={tiempoPrep === opt.value ? chipActive : chipInactive}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Contiene (alérgenos positivos) */}
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
                      Contiene
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {ALERGENOS_POSITIVOS.map(i => (
                        <button
                          key={i}
                          onClick={() => setIntoleranciaFilter(intoleranciaFilter === i ? null : i)}
                          className="text-xs whitespace-nowrap px-2.5 py-1 rounded-full border font-medium transition-all duration-150"
                          style={intoleranciaFilter === i
                            ? { background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)', color: 'rgb(185,28,28)' }
                            : chipInactive}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Libre de (alérgenos negativos) */}
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
                      Libre de
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {ALERGENOS_NEGATIVOS.map(i => (
                        <button
                          key={i}
                          onClick={() => setIntoleranciaFilter(intoleranciaFilter === i ? null : i)}
                          className="text-xs whitespace-nowrap px-2.5 py-1 rounded-full border font-medium transition-all duration-150"
                          style={intoleranciaFilter === i
                            ? { background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.3)', color: 'rgb(21,128,61)' }
                            : chipInactive}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clasificación dietética */}
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
                      Dieta
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {DIETETICOS.map(i => (
                        <button
                          key={i}
                          onClick={() => setIntoleranciaFilter(intoleranciaFilter === i ? null : i)}
                          className="text-xs whitespace-nowrap px-2.5 py-1 rounded-full border font-medium transition-all duration-150"
                          style={intoleranciaFilter === i
                            ? { background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.3)', color: 'rgb(21,128,61)' }
                            : chipInactive}
                        >
                          ✓ {i}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fecha */}
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
                      Fecha de creación
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={fechaDesde}
                        onChange={e => setFechaDesde(e.target.value)}
                        className="text-xs py-1.5 px-2 rounded-lg border outline-none transition-all duration-200"
                        style={{ color: 'var(--text)', background: 'var(--bg)', borderColor: 'var(--border)' }}
                      />
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                      <input
                        type="date"
                        value={fechaHasta}
                        onChange={e => setFechaHasta(e.target.value)}
                        className="text-xs py-1.5 px-2 rounded-lg border outline-none transition-all duration-200"
                        style={{ color: 'var(--text)', background: 'var(--bg)', borderColor: 'var(--border)' }}
                      />
                    </div>
                  </div>

                  {/* Limpiar filtros avanzados */}
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => {
                        setMetodoCoccion('Todos')
                        setRangoKcal(null)
                        setTiempoPrep(null)
                        setIntoleranciaFilter(null)
                        setFechaDesde('')
                        setFechaHasta('')
                        setFiltroRapido(null)
                      }}
                      className="w-full text-xs py-2 rounded-xl border font-medium transition-all duration-150 mt-1"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(163,230,53,0.4)'; e.currentTarget.style.color = '#A3E635' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                    >
                      Limpiar filtros avanzados
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Orden */}
            <select
              value={orden}
              onChange={e => setOrden(e.target.value as 'reciente' | 'antiguo')}
              className="text-xs py-1.5 px-2 rounded-lg border outline-none transition-all duration-200"
              style={{ color: 'var(--text)', background: 'var(--surface)', borderColor: 'var(--border)' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#A3E635' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <option value="reciente">Más reciente</option>
              <option value="antiguo">Más antiguo</option>
            </select>
          </div>

          {/* Tipo de plato */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIAS.map(c => (
              <button
                key={c}
                onClick={() => { setCategoria(c); setTagFilter(null) }}
                className="text-xs whitespace-nowrap px-3 py-1.5 rounded-full border font-medium transition-all duration-150"
                style={categoria === c ? chipActive : chipInactive}
                onMouseEnter={e => { if (categoria !== c) { e.currentTarget.style.borderColor = 'rgba(163,230,53,0.4)'; e.currentTarget.style.color = '#A3E635' } }}
                onMouseLeave={e => { if (categoria !== c) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Sub-categorías contextuales — solo cuando hay categoría activa */}
          {categoria !== 'Todos' && SUBCATEGORIAS[categoria] && (
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-5 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
              {SUBCATEGORIAS[categoria]!.map(sub => (
                <button
                  key={sub}
                  onClick={() => setTagFilter(tagFilter === sub ? null : sub)}
                  className="text-xs whitespace-nowrap px-2.5 py-1 rounded-lg border font-medium transition-all duration-150"
                  style={tagFilter === sub ? tagActive : chipInactive}
                  onMouseEnter={e => { if (tagFilter !== sub) { e.currentTarget.style.borderColor = 'rgba(163,230,53,0.35)'; e.currentTarget.style.color = '#A3E635' } }}
                  onMouseLeave={e => { if (tagFilter !== sub) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
          {/* ═══════ FILTROS RÁPIDOS ═══════ */}
          {/* Atajos prominentes para las búsquedas más comunes */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-5 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            {[
              { label: '🌾 Sin Gluten', value: 'Sin Gluten' },
              { label: '🥛 Sin Lactosa', value: 'Sin Lactosa' },
              { label: '🥚 Sin Huevo', value: 'Sin Huevo' },
              { label: '🌱 Vegano', value: 'Vegano' },
              { label: '🥬 Vegetariano', value: 'Vegetariano' },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => {
                  const nuevo = filtroRapido === f.value ? null : f.value
                  setFiltroRapido(nuevo)
                  setIntoleranciaFilter(null)
                }}
                className="text-xs whitespace-nowrap px-3 py-1.5 rounded-full border font-semibold transition-all duration-150 flex items-center gap-1"
                style={filtroRapido === f.value
                  ? {
                    background: f.value === 'Sin Gluten' || f.value === 'Sin Lactosa' || f.value === 'Sin Huevo'
                      ? 'rgba(34,197,94,0.12)'
                      : 'rgba(34,197,94,0.12)',
                    borderColor: 'rgba(34,197,94,0.3)',
                    color: 'rgb(21,128,61)',
                  }
                  : chipInactive}
                onMouseEnter={e => { if (filtroRapido !== f.value) { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.4)'; e.currentTarget.style.color = 'rgb(21,128,61)' } }}
                onMouseLeave={e => { if (filtroRapido !== f.value) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </FadeIn>

        {/* ═══════ CONTENIDO ═══════ */}
        <FadeIn delay={0.2}>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="rounded-2xl overflow-hidden" style={{ aspectRatio: '3/4', background: 'var(--surface)' }}>
                  <div className="w-full h-full skeleton" />
                </div>
              ))}
            </div>
          ) : filtradas.length === 0 ? (
            /* Empty state premium */
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
                style={{ background: 'var(--accent-bg)' }}
              >
                <BookOpen size={32} style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                {recetas.length === 0 ? 'Tu recetario está vacío' : 'Sin resultados'}
              </p>
              <p className="text-sm mt-1 mb-6 text-center max-w-xs" style={{ color: 'var(--text-muted)' }}>
                {recetas.length === 0
                  ? 'Crea tu primera receta o importa una desde una URL'
                  : 'Prueba con otros filtros o términos de búsqueda'}
              </p>
              {recetas.length === 0 && (
                <Link href="/recetas/nueva"
                  className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200"
                  style={{ background: 'var(--accent)', color: '#1C1C1E' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 20px var(--accent-glow)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
                >
                  <Plus size={16} /> Crear primera receta
                </Link>
              )}
            </div>
          ) : (
            /* Grid de cards premium — tarjetas verticales full-bleed estilo Mela */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtradas.map(r => (
                <RecipeCardPremium
                  key={r.id}
                  id={r.id}
                  nombre={r.nombre}
                  imagen_url={r.imagen_url}
                  tiempoTotal={(r.tiempo_prep_min ?? 0) + (r.tiempo_coccion_min ?? 0)}
                  porciones={r.porciones ?? undefined}
                  kcal={r.kcal}
                  categoria={r.categoria}
                  proteinas={r.proteinas ?? 0}
                  carbohidratos={r.carbohidratos ?? 0}
                  grasas={r.grasas ?? 0}
                />
              ))}
            </div>
          )}
        </FadeIn>
      </div>
    </PageTransition>
  )
}
