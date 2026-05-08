'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Search, BookOpen, Clock, Users, Flame, Snowflake, CookingPot, Rotate3D, ChefHat, Microwave, Inbox, AlertTriangle, Calendar } from 'lucide-react'
import { StaggerList, StaggerItem } from '@/components/ui/Motion'

const CATEGORIAS = ['Todos', 'Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack', 'Postre']

const ICONOS_COCCION: Record<string, React.ReactNode> = {
  'Horno/Airfryer': <Flame size={14} />,
  'Sartén': <CookingPot size={14} />,
  Plancha: <ChefHat size={14} />,
  Microondas: <Microwave size={14} />,
  'No Bake': <Snowflake size={14} />,
  Parrilla: <Rotate3D size={14} />,
  Hervido: <CookingPot size={14} />,
  Olla: <CookingPot size={14} />,
}

const METODOS_COCCION = [
  { value: 'Todos', label: 'Todos' },
  ...Object.keys(ICONOS_COCCION).map(k => ({ value: k, label: k })),
]

function BotonCola() {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('recetas').select('id', { count: 'exact', head: true })
        .eq('coach_id', user.id).in('estado', ['borrador', 'en_revision'])
        .then(({ count: c }) => setCount(c ?? 0))
    })
  }, [])
  if (count === null || count === 0) return null
  return (
    <Link href='/recetas/cola'
      className='btn-secondary flex items-center gap-2 relative'>
      <Inbox size={16} />
      Cola
      <span className='absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center font-bold'
        style={{ background: 'var(--primary)', fontSize: '10px' }}>{count}</span>
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

  // Compatibilidad con ambos esquemas de columnas
  const normalizar = (r: RecetaRow) => ({
    ...r,
    kcal: r.kcal ?? r.kcal_por_porcion ?? null,
    proteinas: r.proteinas ?? r.proteinas_por_porcion ?? null,
    carbohidratos: r.carbohidratos ?? r.carbohidratos_por_porcion ?? null,
    grasas: r.grasas ?? r.grasas_por_porcion ?? null,
    instrucciones: r.instrucciones ?? r.pasos ?? null,
    url_origen: r.url_origen ?? r.url ?? null,
  })

  const filtradas = useMemo(() => {
    return recetas.map(normalizar).filter(r => {
      const matchBusqueda = r.nombre.toLowerCase().includes(busqueda.toLowerCase())
      const matchCategoria = categoria === 'Todos' || r.categoria === categoria
      const matchCoccion = metodoCoccion === 'Todos' || r.tipo_coccion === metodoCoccion

      // Filtro por rango de fechas
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

  // Count distinct tipo_coccion values for context
  const coccionEnUso = new Set(recetas.map(r => r.tipo_coccion).filter(Boolean))

  const btnStyle = (active: boolean) => active
    ? { background: 'var(--primary)', borderColor: 'var(--primary)', color: 'white' }
    : { color: 'var(--text-secondary)', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Recetas</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{recetas.length} recetas en tu base de datos</p>
        </div>
        <BotonCola />
        <Link href="/recetas/auditoria" className="btn-secondary flex items-center gap-2 text-sm" title="Auditoría de ingredientes">
          <AlertTriangle size={15} /> Auditoría
        </Link>
        <Link href="/recetas/nueva" className="btn btn-primary">
          <Plus size={16} /> Nueva receta
        </Link>
      </header>

      {/* Filtros */}
      <div className="space-y-3 mb-6">
        {/* Buscador + Categorías */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              className="input search-input"
              placeholder="Buscar receta…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIAS.map(c => (
              <button
                key={c}
                onClick={() => setCategoria(c)}
                className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all duration-150"
                style={btnStyle(categoria === c)}
                onMouseEnter={e => {
                  if (categoria !== c) {
                    e.currentTarget.style.borderColor = 'var(--primary-light)'
                    e.currentTarget.style.color = 'var(--primary)'
                  }
                }}
                onMouseLeave={e => {
                  if (categoria !== c) {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro por fecha de creación */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Creada entre</span>
          <input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            className="input text-xs py-1 px-2 rounded border max-w-[150px]"
            style={{ color: 'var(--text)', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          />
          <span style={{ color: 'var(--text-muted)' }}>y</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            className="input text-xs py-1 px-2 rounded border max-w-[150px]"
            style={{ color: 'var(--text)', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
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
            <span style={{ color: 'var(--text-muted)' }}>Ordenar</span>
            <select
              value={orden}
              onChange={e => setOrden(e.target.value as 'reciente' | 'antiguo')}
              className="input text-xs py-1 px-2 rounded border"
              style={{ color: 'var(--text)', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <option value="reciente">Más reciente</option>
              <option value="antiguo">Más antiguo</option>
            </select>
          </div>
        </div>

        {/* Método de cocción */}
        <div className="flex gap-1.5 flex-wrap">
          {METODOS_COCCION.filter(m => m.value === 'Todos' || coccionEnUso.has(m.value)).map(m => (
            <button
              key={m.value}
              onClick={() => setMetodoCoccion(m.value)}
              className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all duration-150 flex items-center gap-1"
              style={btnStyle(metodoCoccion === m.value)}
            >
              {m.value !== 'Todos' && ICONOS_COCCION[m.value]}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card-hoverable overflow-hidden !p-0 border animate-pulse">
              <div className="w-full h-40 skeleton" />
              <div className="p-4 space-y-3">
                <div className="h-4 skeleton rounded w-3/4" />
                <div className="h-3 skeleton rounded w-full" />
                <div className="flex gap-2">
                  <div className="h-3 skeleton rounded w-16" />
                  <div className="h-3 skeleton rounded w-12" />
                </div>
                <div className="flex gap-1.5">
                  <div className="h-5 skeleton rounded w-14" />
                  <div className="h-5 skeleton rounded w-14" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card text-center py-16">
          <BookOpen size={40} style={{ color: 'var(--text-muted)' }} className="mx-auto mb-3" />
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
            {recetas.length === 0 ? 'Aún no hay recetas' : 'No hay recetas con ese filtro'}
          </p>
          {recetas.length === 0 && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Crea tu primera receta o importa una desde una URL</p>
          )}
          <Link href="/recetas/nueva" className="btn btn-primary mt-4">
            <Plus size={16} /> Añadir receta
          </Link>
        </div>
      ) : (
        <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtradas.map(r => (
            <StaggerItem key={r.id}>
              <Link
                href={`/recetas/${r.id}`}
                className="card-hoverable overflow-hidden !p-0 border transition-all block"
              >
                {/* Imagen */}
                {r.imagen_url ? (
                  <img src={r.imagen_url} alt={r.nombre} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--primary-bg), #E5E5EA)' }}>
                    <span className="text-5xl">🥗</span>
                  </div>
                )}

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold leading-tight" style={{ color: 'var(--text)' }}>{r.nombre}</h3>
                    <div className="flex gap-1 flex-shrink-0">
                      {r.categoria && (
                        <span className="badge badge-teal">{r.categoria}</span>
                      )}
                      {r.tipo_coccion && (
                        <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 font-medium"
                          style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }}>
                          {ICONOS_COCCION[r.tipo_coccion]}
                          {r.tipo_coccion}
                        </span>
                      )}
                    </div>
                  </div>

                  {r.descripcion && (
                    <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{r.descripcion}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {(r.tiempo_prep_min || r.tiempo_coccion_min) && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {(r.tiempo_prep_min ?? 0) + (r.tiempo_coccion_min ?? 0)} min
                      </span>
                    )}
                    {(r.porciones ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {r.porciones} {r.porciones === 1 ? 'porción' : 'porciones'}
                        {r.descripcion_porcion && <span className="opacity-70">({r.descripcion_porcion})</span>}
                      </span>
                    )}
                    {(r.kcal ?? 0) > 0 && (
                      <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{Math.round(r.kcal ?? 0)} kcal</span>
                    )}
                  </div>

                  {((r.proteinas ?? 0) > 0 || (r.carbohidratos ?? 0) > 0 || (r.grasas ?? 0) > 0) && (
                    <div className="flex gap-1.5 mt-2">
                      {(r.proteinas ?? 0) > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>P:{Math.round(r.proteinas ?? 0)}g</span>}
                      {(r.carbohidratos ?? 0) > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>C:{Math.round(r.carbohidratos ?? 0)}g</span>}
                      {(r.grasas ?? 0) > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: '#F5F3FF', color: '#7C3AED' }}>G:{Math.round(r.grasas ?? 0)}g</span>}
                    </div>
                  )}
                </div>
              </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  )
}
