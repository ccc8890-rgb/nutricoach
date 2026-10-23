'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, MagnifyingGlass, BookOpen, CheckSquare, Square, Sparkle, ChefHat, Package, Trophy, Lightning, CaretDown, Check, X } from '@phosphor-icons/react'
import { FadeIn, PageTransition } from '@/components/ui/Motion'
import { CATEGORIAS, TIPOS_COCCION, SUBCATEGORIAS, ALERGENOS_NEGATIVOS, APTA_PARA, nombreSin, recetaTieneEtiqueta, recetaLibreDe, normalizarReceta, normalizarIntolerancias } from '@/lib/recetas-constants'
import { KNOWN_TAGS } from '@/lib/auto-tag'
import { useToast } from '@/components/ui/Toast'
import { RecipeCardPremium } from '@/components/premium'
import ReportarProblema from '@/components/recetas/ReportarProblema'
import { useEstadoUrl, useRecordarLista, useRestaurarScroll } from '@/lib/useEstadoUrl'
import { palabrasDeBusqueda, coincidePalabras } from '@/lib/recetas/busqueda'
import { contieneCerdo, esHalalPorIngredientes } from '@/lib/recetas/halal'

const OPCIONES_APTA = [...APTA_PARA, { valor: 'Halal', etiqueta: 'Halal' }]
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const OPCIONES_SIN = [...ALERGENOS_NEGATIVOS, 'Sin Cacahuetes'] as const

const METODOS_COCCION = [
  { value: 'Todos', label: 'Todos' },
  ...TIPOS_COCCION.map(k => ({ value: k, label: k })),
]

/** Botón de filtro por categoría con su propio desplegable (un clic elige y cierra). */
function FiltroMenu({ etiqueta, valor, onLimpiar, children }: {
  etiqueta: string
  valor: string | null
  onLimpiar: () => void
  children: (cerrar: () => void) => React.ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])
  const activo = valor !== null
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all duration-150"
        style={activo
          ? { borderColor: 'var(--accent)', color: 'var(--text)', background: 'var(--accent-bg)' }
          : { borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}
      >
        {etiqueta}{activo && <span className="font-semibold">· {valor}</span>}
        {activo
          ? <span role="button" aria-label={`Quitar ${etiqueta}`} onClick={e => { e.stopPropagation(); onLimpiar(); setAbierto(false) }} className="-mr-1 flex items-center opacity-70 hover:opacity-100"><X size={11} weight="bold" /></span>
          : <CaretDown size={10} />}
      </button>
      {abierto && (
        <div className="absolute left-0 top-full z-40 mt-1.5 min-w-[11rem] max-h-72 overflow-y-auto rounded-lg border p-1" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
          {children(() => setAbierto(false))}
        </div>
      )}
    </div>
  )
}

function OpcionMenu({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors"
      style={{ color: activa ? 'var(--text)' : 'var(--text-secondary)', background: activa ? 'var(--accent-bg)' : 'transparent', fontWeight: activa ? 600 : 400 }}
      onMouseEnter={e => { if (!activa) e.currentTarget.style.background = 'var(--surface-hover)' }}
      onMouseLeave={e => { if (!activa) e.currentTarget.style.background = 'transparent' }}
    >
      <span>{children}</span>{activa && <Check size={12} weight="bold" />}
    </button>
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
  objetivos?: string[] | null
  deportes?: string[] | null
  momentos?: string[] | null
  estilos?: string[] | null
  premium_chef?: boolean | null
  batch_cooking?: boolean | null
  tupper?: boolean | null
  digestibilidad?: string | null
  adherencia_score?: number | null
  recipe_intelligence_score?: number | null
  recipe_intelligence_tier?: string | null
  macro_flex_score?: number | null
  planning_roles?: string[] | null
  coste_estimado_nivel?: string | null
  nivel_elaboracion?: number | null
  created_at?: string | null
  receta_ingredientes?: Array<{
    nombre_libre?: string | null
    alimento?: { nombre?: string | null } | Array<{ nombre?: string | null }> | null
  }> | null
}

export default function RecetasPage() {
  const { addToast } = useToast()
  const [recetas, setRecetas] = useState<RecetaRow[]>([])
  const [seleccionando, setSeleccionando] = useState(false)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [reportando, setReportando] = useState(false)
  // Filtros en la URL: al abrir una receta y volver atrás el listado reaparece igual
  useRecordarLista('recetas')
  const [busqueda, setBusqueda] = useEstadoUrl<string>('q', '')
  const [categoria, setCategoria] = useEstadoUrl<string>('cat', 'Todos')
  const [metodoCoccion, setMetodoCoccion] = useEstadoUrl<string>('metodo', 'Todos')
  const [rangoKcal, setRangoKcal] = useEstadoUrl<string | null>('kcal', null)
  const [tiempoPrep, setTiempoPrep] = useEstadoUrl<string | null>('tiempo', null)
  const [sinParam, setSinParam] = useEstadoUrl<string | null>('sin', null)
  const sinFiltros = useMemo(() => (sinParam ? sinParam.split(',').filter(Boolean) : []), [sinParam])
  const alternarSin = (v: string) => { const n = sinFiltros.includes(v) ? sinFiltros.filter(x => x !== v) : [...sinFiltros, v]; setSinParam(n.length ? n.join(',') : null) }
  const [aptaParam, setAptaParam] = useEstadoUrl<string | null>('apta', null)
  const aptaFiltros = useMemo(() => (aptaParam ? aptaParam.split(',').filter(Boolean) : []), [aptaParam])
  const alternarApta = (v: string) => { const n = aptaFiltros.includes(v) ? aptaFiltros.filter(x => x !== v) : [...aptaFiltros, v]; setAptaParam(n.length ? n.join(',') : null) }
  const [tagFilter, setTagFilter] = useEstadoUrl<string | null>('tag', null)
  const [curacionFilter, setCuracionFilter] = useEstadoUrl<string | null>('curacion', null)
  const [orden, setOrden] = useEstadoUrl<'reciente' | 'antiguo'>('orden', 'reciente', ['reciente', 'antiguo'])
  const [loading, setLoading] = useState(true)
  useRestaurarScroll(!loading)
  const [showSearchDrop, setShowSearchDrop] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Filtros rápidos: negativo (ej. "Sin Gluten") y dietético (ej. "Vegano")

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) console.error('[recetas] Error auth.getUser:', userError)
        if (!user) { console.warn('[recetas] No hay usuario autenticado'); setLoading(false); return }

        const { data, error } = await supabase
          .from('recetas')
          .select('id, nombre, descripcion, imagen_url, categoria, tipo_coccion, dificultad, porciones, descripcion_porcion, tiempo_prep_min, tiempo_coccion_min, kcal, proteinas, carbohidratos, grasas, url_origen, tipo_plato, estado, tags, objetivos, deportes, momentos, estilos, premium_chef, batch_cooking, tupper, digestibilidad, adherencia_score, recipe_intelligence_score, recipe_intelligence_tier, macro_flex_score, planning_roles, coste_estimado_nivel, nivel_elaboracion, intolerancias, created_at, receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre, alimento:alimentos(nombre))')
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


  const palabrasBusqueda = useMemo(() => palabrasDeBusqueda(busqueda), [busqueda])

  const filtradas = useMemo(() => {
    return recetas.map(r => ({ ...r, ...normalizarReceta(r) })).filter(r => {
      // Palabras sueltas y sin tildes sobre nombre, etiquetas, descripción e ingredientes juntos
      const matchBusqueda = palabrasBusqueda.length === 0 || coincidePalabras([
        r.nombre,
        Array.isArray(r.tags) ? r.tags.join(' ') : '',
        r.descripcion ?? '',
        Array.isArray(r.receta_ingredientes) ? r.receta_ingredientes.map(ing => {
          const alimento = Array.isArray(ing.alimento) ? ing.alimento[0] : ing.alimento
          return `${ing.nombre_libre ?? ''} ${alimento?.nombre ?? ''}`
        }).join(' ') : '',
      ].join(' '), palabrasBusqueda)
      const tagLower = tagFilter?.toLowerCase() ?? ''
      const matchTag = !tagFilter || (
        (Array.isArray(r.tags) && r.tags.some(t => t.toLowerCase() === tagLower)) ||
        r.nombre.toLowerCase().includes(tagLower)
      )
      // Cuando hay sub-tag activo, el tag es la clasificación real → ignorar categoría principal
      const matchCategoria = categoria === 'Todos' || tagFilter !== null || r.categoria === categoria
      const matchCoccion = metodoCoccion === 'Todos' || r.tipo_coccion === metodoCoccion
      // Las aparcadas (sin fuente real) solo se ven con el enfoque «Aparcadas»
      const esAparcada = Array.isArray(r.tags) && r.tags.includes('Aparcada')
      if (esAparcada !== (curacionFilter === 'aparcadas')) return false
      const matchCuracion = !curacionFilter
        || curacionFilter === 'aparcadas'
        || (curacionFilter === 'chef' && (r.premium_chef || r.estilos?.includes('chef_healthy') || r.estilos?.includes('comfort_healthy') || r.estilos?.includes('gourmet_simple')))
        || (curacionFilter === 'adherencia' && (r.adherencia_score ?? 0) >= 80)
        || (curacionFilter === 'batch' && (r.batch_cooking || r.tupper || r.estilos?.includes('batch_cooking') || r.estilos?.includes('tupper')))
        || (curacionFilter === 'prepost' && (r.momentos?.includes('pre_entreno') || r.momentos?.includes('post_entreno') || r.momentos?.includes('carga_cho')))
        || (curacionFilter === 'endurance' && (r.deportes?.includes('running') || r.deportes?.includes('hyrox') || r.deportes?.includes('endurance') || r.deportes?.includes('triatlon') || r.deportes?.includes('ciclismo')))

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
      const recetaIntolerancias = r.intolerancias ?? []
      const matchIntolerancia = aptaFiltros.every(v => v === 'Halal'
        ? esHalalPorIngredientes(r)
        : v === 'Sin Gluten' || v === 'Sin Lactosa'
          ? recetaLibreDe(recetaIntolerancias, v)
          : recetaTieneEtiqueta(recetaIntolerancias, v))

      const matchSin = sinFiltros.every(v => v === 'Sin Cerdo' ? !contieneCerdo(r) : recetaLibreDe(r.intolerancias ?? [], v))
      return matchBusqueda && matchCategoria && matchCoccion && matchTag && matchCuracion && matchKcal && matchTiempo && matchIntolerancia && matchSin
    })
      .sort((a, b) => {
        if (!a.created_at || !b.created_at) return 0
        const da = new Date(a.created_at).getTime()
        const db = new Date(b.created_at).getTime()
        return orden === 'reciente' ? db - da : da - db
      })
  }, [recetas, palabrasBusqueda, categoria, metodoCoccion, tagFilter, curacionFilter, orden, rangoKcal, tiempoPrep, aptaFiltros, sinFiltros])

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
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showSearchDrop])

  const coccionEnUso = new Set(recetas.map(r => r.tipo_coccion).filter(Boolean))

  const chipActive = { background: 'var(--accent-bg)', color: 'var(--text)', fontWeight: 600, borderColor: 'var(--accent)' }
  const chipInactive = { color: 'var(--text-secondary)', borderColor: 'var(--border)' }
  const tagActive = { background: 'var(--accent-bg)', color: 'var(--text)', fontWeight: 600, borderColor: 'var(--accent)' }

  const activeFilterCount = [
    metodoCoccion !== 'Todos',
    curacionFilter !== null,
    rangoKcal !== null,
    tiempoPrep !== null,
    aptaFiltros.length > 0,
    sinFiltros.length > 0,
  ].filter(Boolean).length

  const filtrosCuracion = [
    { id: 'batch', grupo: 'En la cocina', label: 'Para la semana (batch / tupper)', icon: Package },
    { id: 'prepost', grupo: 'Para entrenar', label: 'Antes y después de entrenar', icon: Lightning },
    { id: 'endurance', grupo: 'Para entrenar', label: 'Resistencia (running, Hyrox, ciclismo)', icon: Trophy },
    { id: 'chef', grupo: 'Calidad', label: 'Más elaboradas (chef healthy)', icon: ChefHat },
    { id: 'adherencia', grupo: 'Calidad', label: 'Fáciles de seguir (score 80+)', icon: Sparkle },
    { id: 'aparcadas', grupo: 'Estado', label: 'Aparcadas (sin fuente real)', icon: Package },
  ]

  return (
    <PageTransition className="coach-recipe-library">
      {/* ═══════ HERO SECTION ═══════ */}
      <div
        className="coach-recipe-hero relative overflow-hidden"
      >
        {/* Grid decorativo */}
        <div
          className="absolute inset-0 opacity-[0.018] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--accent) 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative px-6 pt-8 pb-4 max-w-[110rem] mx-auto">
          <FadeIn delay={0}>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="coach-recipe-title" style={{ color: 'var(--text)' }}>
                  Recetas
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {recetas.length} receta{recetas.length !== 1 ? 's' : ''} en tu colección
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setSeleccionando(v => !v); setSeleccion(new Set()) }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200"
                  style={{ borderColor: seleccionando ? 'var(--accent)' : 'var(--border)', color: seleccionando ? 'var(--accent)' : 'var(--text-muted)' }}>
                  <CheckSquare size={13} /> {seleccionando ? 'Cancelar selección' : 'Seleccionar'}
                </button>
              </div>
            </div>
          </FadeIn>


        </div>
      </div>

      <div className="px-6 max-w-[110rem] mx-auto pb-safe">
        {/* ═══════ FILTROS ═══════ */}
        <FadeIn delay={0.15}>
          {/* Fila utilidad: botón Filtros + Orden */}
          <div className="flex items-center gap-2 mb-4">
            <div ref={searchRef} className="relative flex-1 min-w-[12rem]">
              <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
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
                          style={{ background: 'var(--accent-bg)', color: 'var(--text)' }}
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
            {/* Orden */}
            <select
              value={orden}
              onChange={e => setOrden(e.target.value as 'reciente' | 'antiguo')}
              className="text-xs py-1.5 px-2 rounded-lg border outline-none transition-all duration-200"
              style={{ color: 'var(--text)', background: 'var(--surface)', borderColor: 'var(--border)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
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
                onMouseEnter={e => { if (categoria !== c) { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text)' } }}
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
                  onMouseEnter={e => { if (tagFilter !== sub) { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text)' } }}
                  onMouseLeave={e => { if (tagFilter !== sub) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}

          {/* ═══════ FILTROS POR CATEGORÍA (un botón por tipo, un clic) ═══════ */}
          <div className="flex flex-wrap items-center gap-1.5 mb-5">
            <FiltroMenu etiqueta="Uso" valor={filtrosCuracion.find(f => f.id === curacionFilter)?.label ?? null} onLimpiar={() => setCuracionFilter(null)}>
              {cerrar => filtrosCuracion.map((f, i) => (
                <div key={f.id}>
                  {filtrosCuracion[i - 1]?.grupo !== f.grupo && (
                    <p className="px-2.5 pt-2 pb-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{f.grupo}</p>
                  )}
                  <OpcionMenu activa={curacionFilter === f.id} onClick={() => { setCuracionFilter(curacionFilter === f.id ? null : f.id); cerrar() }}>
                    {f.label}
                  </OpcionMenu>
                </div>
              ))}
            </FiltroMenu>

            <FiltroMenu etiqueta="Apta para" valor={aptaFiltros.length ? aptaFiltros.map(v => OPCIONES_APTA.find(a => a.valor === v)?.etiqueta ?? v).join(', ') : null} onLimpiar={() => setAptaParam(null)}>
              {() => OPCIONES_APTA.map(({ valor, etiqueta }) => (
                <OpcionMenu key={valor} activa={aptaFiltros.includes(valor)} onClick={() => alternarApta(valor)}>{etiqueta}</OpcionMenu>
              ))}
            </FiltroMenu>

            <FiltroMenu etiqueta="Sin" valor={sinFiltros.length ? sinFiltros.map(v => mayuscula(nombreSin(v))).join(', ') : null} onLimpiar={() => setSinParam(null)}>
              {() => OPCIONES_SIN.map(valor => (
                <OpcionMenu key={valor} activa={sinFiltros.includes(valor)} onClick={() => alternarSin(valor)}>{mayuscula(nombreSin(valor))}</OpcionMenu>
              ))}
            </FiltroMenu>

            <FiltroMenu etiqueta="Cocción" valor={metodoCoccion !== 'Todos' ? metodoCoccion : null} onLimpiar={() => setMetodoCoccion('Todos')}>
              {cerrar => METODOS_COCCION.filter(m => m.value !== 'Todos' && coccionEnUso.has(m.value)).map(m => (
                <OpcionMenu key={m.value} activa={metodoCoccion === m.value} onClick={() => { setMetodoCoccion(metodoCoccion === m.value ? 'Todos' : m.value); cerrar() }}>{m.label}</OpcionMenu>
              ))}
            </FiltroMenu>

            <FiltroMenu etiqueta="Kcal" valor={rangoKcal ? { '<300': '< 300', '300-600': '300–600', '>600': '> 600' }[rangoKcal] ?? rangoKcal : null} onLimpiar={() => setRangoKcal(null)}>
              {cerrar => [['<300', '< 300'], ['300-600', '300–600'], ['>600', '> 600']].map(([v, l]) => (
                <OpcionMenu key={v} activa={rangoKcal === v} onClick={() => { setRangoKcal(rangoKcal === v ? null : v); cerrar() }}>{l} kcal / porción</OpcionMenu>
              ))}
            </FiltroMenu>

            <FiltroMenu etiqueta="Tiempo" valor={tiempoPrep ? { '<15': '< 15 min', '15-30': '15–30 min', '>30': '> 30 min' }[tiempoPrep] ?? tiempoPrep : null} onLimpiar={() => setTiempoPrep(null)}>
              {cerrar => [['<15', '< 15 min'], ['15-30', '15–30 min'], ['>30', '> 30 min']].map(([v, l]) => (
                <OpcionMenu key={v} activa={tiempoPrep === v} onClick={() => { setTiempoPrep(tiempoPrep === v ? null : v); cerrar() }}>{l}</OpcionMenu>
              ))}
            </FiltroMenu>

            {(activeFilterCount > 0 || tagFilter || categoria !== 'Todos') && (
              <button
                type="button"
                onClick={() => { setMetodoCoccion('Todos'); setRangoKcal(null); setTiempoPrep(null); setAptaParam(null); setCuracionFilter(null); setSinParam(null); setCategoria('Todos'); setTagFilter(null) }}
                className="px-2 py-1.5 text-xs underline-offset-2 hover:underline"
                style={{ color: 'var(--text-muted)' }}
              >
                Limpiar todo
              </button>
            )}
          </div>
        </FadeIn>

        {/* ═══════ CONTENIDO ═══════ */}
        <FadeIn delay={0.2}>
          {loading ? (
            <div className="coach-recipe-grid">
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
                  style={{ background: 'var(--accent)', color: '#ffffff' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 20px var(--accent-glow)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
                >
                  <Plus size={16} /> Crear primera receta
                </Link>
              )}
            </div>
          ) : (
            /* Grid de cards premium — tarjetas verticales full-bleed estilo Mela */
            <div className="coach-recipe-grid">
              {filtradas.map(r => (
                <div key={r.id} className="relative">
                {seleccionando && (
                  <button type="button" aria-label={seleccion.has(r.id) ? 'Quitar de la selección' : 'Seleccionar receta'}
                    onClick={() => setSeleccion(prev => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n })}
                    className="absolute inset-0 z-10 rounded-2xl flex items-start justify-end p-2"
                    style={{ background: seleccion.has(r.id) ? 'rgba(0,0,0,0.25)' : 'transparent', outline: seleccion.has(r.id) ? '2px solid var(--accent)' : 'none' }}>
                    {seleccion.has(r.id) ? <CheckSquare size={22} style={{ color: 'var(--accent)', background: 'var(--bg)', borderRadius: 4 }} /> : <Square size={22} style={{ color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: 4 }} />}
                  </button>
                )}
                <RecipeCardPremium
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
                  premium_chef={r.premium_chef}
                  objetivos={r.objetivos}
                  deportes={r.deportes}
                  momentos={r.momentos}
                  estilos={r.estilos}
                  adherencia_score={r.adherencia_score}
                  recipe_intelligence_score={r.recipe_intelligence_score}
                  recipe_intelligence_tier={r.recipe_intelligence_tier}
                  intolerancias={r.intolerancias}
                  macro_flex_score={r.macro_flex_score}
                  planning_roles={r.planning_roles}
                  digestibilidad={r.digestibilidad}
                />
                </div>
              ))}
            </div>
          )}
        </FadeIn>
      </div>
      {seleccionando && seleccion.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-between gap-3 px-4 py-3 pb-safe" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
          <span className="text-sm" style={{ color: 'var(--text)' }}>{seleccion.size} seleccionada{seleccion.size !== 1 ? 's' : ''}</span>
          <button onClick={() => setReportando(true)} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            Reportar {seleccion.size}
          </button>
        </div>
      )}
      <ReportarProblema ids={[...seleccion]} abierto={reportando} onCerrar={() => setReportando(false)}
        onHecho={r => {
          const fuera = new Set(r.reportadas)
          setRecetas(prev => prev.filter(x => !fuera.has(x.id)))
          setSeleccion(new Set()); setSeleccionando(false); setReportando(false)
          addToast({ type: 'warning', title: `${r.reportadas.length} receta${r.reportadas.length !== 1 ? 's' : ''} enviada${r.reportadas.length !== 1 ? 's' : ''} a Revisión → Reportadas` })
        }} />
    </PageTransition>
  )
}
