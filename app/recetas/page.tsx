'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Search, BookOpen, Clock, Users, Flame, Snowflake, CookingPot, Rotate3D, ChefHat, Microwave } from 'lucide-react'
import { StaggerList, StaggerItem } from '@/components/ui/Motion'

const CATEGORIAS = ['Todos', 'Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack', 'Postre']

const ICONOS_COCCION: Record<string, React.ReactNode> = {
  Horno: <Flame size={14} />,
  Airfryer: <Flame size={14} />,
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

export default function RecetasPage() {
  const [recetas, setRecetas] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('Todos')
  const [metodoCoccion, setMetodoCoccion] = useState('Todos')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('recetas')
        .select('*')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })
      setRecetas(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // Compatibilidad con ambos esquemas de columnas
  const normalizar = (r: any) => ({
    ...r,
    kcal: r.kcal ?? r.kcal_por_porcion ?? null,
    proteinas: r.proteinas ?? r.proteinas_por_porcion ?? null,
    carbohidratos: r.carbohidratos ?? r.carbohidratos_por_porcion ?? null,
    grasas: r.grasas ?? r.grasas_por_porcion ?? null,
    instrucciones: r.instrucciones ?? r.pasos ?? null,
    url_origen: r.url_origen ?? r.url ?? null,
  })

  const filtradas = recetas.map(normalizar).filter(r => {
    const matchBusqueda = r.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchCategoria = categoria === 'Todos' || r.categoria === categoria
    const matchCoccion = metodoCoccion === 'Todos' || r.tipo_coccion === metodoCoccion
    return matchBusqueda && matchCategoria && matchCoccion
  })

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
                  {r.porciones > 0 && (
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {r.porciones} {r.porciones === 1 ? 'porción' : 'porciones'}
                    </span>
                  )}
                  {r.kcal > 0 && (
                    <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{Math.round(r.kcal)} kcal</span>
                  )}
                </div>

                {(r.proteinas > 0 || r.carbohidratos > 0 || r.grasas > 0) && (
                  <div className="flex gap-1.5 mt-2">
                    {r.proteinas > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>P:{Math.round(r.proteinas)}g</span>}
                    {r.carbohidratos > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>C:{Math.round(r.carbohidratos)}g</span>}
                    {r.grasas > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: '#F5F3FF', color: '#7C3AED' }}>G:{Math.round(r.grasas)}g</span>}
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
