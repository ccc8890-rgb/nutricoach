'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Search, BookOpen, Clock, Users, Inbox, AlertTriangle, Calendar, Sparkles } from 'lucide-react'
import { StaggerList, StaggerItem, FadeIn, PageTransition } from '@/components/ui/Motion'
import { CATEGORIAS, TIPOS_COCCION, ICONOS_COCCION, normalizarReceta, type RecetaNormalizada } from '@/lib/recetas-constants'
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
        .eq('coach_id', user.id).in('estado', ['borrador', 'en_revision'])
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
  kcal_por_porcion?: number | null
  proteinas_por_porcion?: number | null
  carbohidratos_por_porcion?: number | null
  grasas_por_porcion?: number | null
  pasos?: string | null
  url?: string | null
  instrucciones?: string | null
  created_at?: string | null
}

export default function RecetasPage() {
  const { addToast } = useToast()
  const [recetas, setRecetas] = useState<RecetaRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('Todos')
  const [metodoCoccion, setMetodoCoccion] = useState('Todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [orden, setOrden] = useState<'reciente' | 'antiguo'>('reciente')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) console.error('[recetas] Error auth.getUser:', userError)
        if (!user) { console.warn('[recetas] No hay usuario autenticado'); setLoading(false); return }

        const { data, error } = await supabase
          .from('recetas')
          .select('id, nombre, descripcion, imagen_url, categoria, tipo_coccion, dificultad, porciones, descripcion_porcion, tiempo_prep_min, tiempo_coccion_min, kcal, proteinas, carbohidratos, grasas, url_origen, tipo_plato, estado, created_at')
          .eq('coach_id', user.id)
          .eq('estado', 'aprobada')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('[recetas] Error en query recetas:', error.message, error.details, error.hint)
        } else {
          console.log(`[recetas] ${data?.length ?? 0} recetas cargadas`)
        }

        setRecetas(data ?? [])
      } catch (e) {
        console.error('[recetas] Excepción inesperada:', e)
      }
      setLoading(false)
    }
    load()
  }, [])


  const filtradas = useMemo(() => {
    return recetas.map(r => ({ ...r, ...normalizarReceta(r) })).filter(r => {
      const matchBusqueda = r.nombre.toLowerCase().includes(busqueda.toLowerCase())
      const matchCategoria = categoria === 'Todos' || r.categoria === categoria
      const matchCoccion = metodoCoccion === 'Todos' || r.tipo_coccion === metodoCoccion

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
      return matchBusqueda && matchCategoria && matchCoccion && matchFecha
    })
      .sort((a, b) => {
        if (!a.created_at || !b.created_at) return 0
        const da = new Date(a.created_at).getTime()
        const db = new Date(b.created_at).getTime()
        return orden === 'reciente' ? db - da : da - db
      })
  }, [recetas, busqueda, categoria, metodoCoccion, fechaDesde, fechaHasta, orden])

  const coccionEnUso = new Set(recetas.map(r => r.tipo_coccion).filter(Boolean))

  const btnStyle = (active: boolean) => active
    ? { background: 'var(--accent)', color: '#1C1C1E', fontWeight: 600, borderColor: 'var(--accent)' }
    : { color: 'var(--text-secondary)', borderColor: 'var(--border)' }

  // Estadísticas rápidas
  const totalKcal = recetas.reduce((acc, r) => acc + (r.kcal ?? 0), 0)
  const totalProtein = recetas.reduce((acc, r) => acc + (r.proteinas ?? 0), 0)

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

          {/* Stats rápidas */}
          <FadeIn delay={0.05}>
            <div className="flex gap-4 mb-5">
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--macro-calories)' }} />
                {totalKcal > 0 && <span className="tabular-nums">{Math.round(totalKcal).toLocaleString()} kcal totales</span>}
              </div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--macro-protein)' }} />
                {totalProtein > 0 && <span className="tabular-nums">{Math.round(totalProtein).toLocaleString()}g proteína</span>}
              </div>
            </div>
          </FadeIn>

          {/* Buscador */}
          <FadeIn delay={0.1}>
            <div className="relative max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all duration-200"
                placeholder="Buscar receta…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-ring)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>
          </FadeIn>
        </div>
      </div>

      <div className="px-6 max-w-6xl mx-auto pb-safe">
        {/* ═══════ FILTROS ═══════ */}
        <FadeIn delay={0.15}>
          {/* Categorías — chips scrollables */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIAS.map(c => (
              <button
                key={c}
                onClick={() => setCategoria(c)}
                className="text-xs whitespace-nowrap px-3 py-1.5 rounded-full border font-medium transition-all duration-150"
                style={btnStyle(categoria === c)}
                onMouseEnter={e => { if (categoria !== c) { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--accent)' } }}
                onMouseLeave={e => { if (categoria !== c) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Método cocción */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            {METODOS_COCCION.filter(m => m.value === 'Todos' || coccionEnUso.has(m.value)).map(m => (
              <button
                key={m.value}
                onClick={() => setMetodoCoccion(m.value)}
                className="text-xs whitespace-nowrap px-3 py-1.5 rounded-full border font-medium transition-all duration-150 flex items-center gap-1"
                style={btnStyle(metodoCoccion === m.value)}
                onMouseEnter={e => { if (metodoCoccion !== m.value) { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--accent)' } }}
                onMouseLeave={e => { if (metodoCoccion !== m.value) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
              >
                {m.value !== 'Todos' && ICONOS_COCCION[m.value]}
                {m.label}
              </button>
            ))}
          </div>

          {/* Filtros extra: fecha + orden */}
          <div className="flex items-center gap-2 text-xs flex-wrap mb-6">
            <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Creada entre</span>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              className="text-xs py-1.5 px-2 rounded-lg border outline-none transition-all duration-200"
              style={{ color: 'var(--text)', background: 'var(--surface)', borderColor: 'var(--border)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
            <span style={{ color: 'var(--text-muted)' }}>y</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              className="text-xs py-1.5 px-2 rounded-lg border outline-none transition-all duration-200"
              style={{ color: 'var(--text)', background: 'var(--surface)', borderColor: 'var(--border)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
            {(fechaDesde || fechaHasta) && (
              <button
                onClick={() => { setFechaDesde(''); setFechaHasta('') }}
                className="text-xs underline hover:no-underline"
                style={{ color: 'var(--text-muted)' }}
              >
                Limpiar
              </button>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <span style={{ color: 'var(--text-muted)' }}>Orden</span>
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
