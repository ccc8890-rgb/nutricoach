'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Search, BookOpen, Clock, Users } from 'lucide-react'

const CATEGORIAS = ['Todos', 'Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack', 'Postre']

export default function RecetasPage() {
  const [recetas, setRecetas] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('Todos')
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

  const filtradas = recetas.filter(r => {
    const matchBusqueda = r.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchCategoria = categoria === 'Todos' || r.categoria === categoria
    return matchBusqueda && matchCategoria
  })

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recetas</h1>
          <p className="text-gray-500 mt-0.5">{recetas.length} recetas en tu base de datos</p>
        </div>
        <Link href="/recetas/nueva" className="btn-primary">
          <Plus size={16} /> Nueva receta
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
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
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                categoria === c
                  ? 'bg-green-600 text-white border-green-600'
                  : 'text-gray-500 border-gray-200 hover:border-green-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card text-center py-16">
          <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-medium">
            {recetas.length === 0 ? 'Aún no hay recetas' : 'No hay recetas con ese filtro'}
          </p>
          {recetas.length === 0 && (
            <p className="text-sm text-gray-300 mt-1">Crea tu primera receta o importa una desde una URL</p>
          )}
          <Link href="/recetas/nueva" className="btn-primary mt-4 inline-flex">
            <Plus size={16} /> Añadir receta
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtradas.map(r => (
            <Link
              key={r.id}
              href={`/recetas/${r.id}`}
              className="card hover:border-green-200 hover:shadow-sm transition-all overflow-hidden p-0"
            >
              {/* Imagen */}
              {r.imagen_url ? (
                <img
                  src={r.imagen_url}
                  alt={r.nombre}
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
                  <span className="text-5xl">🥗</span>
                </div>
              )}

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 leading-tight">{r.nombre}</h3>
                  {r.categoria && (
                    <span className="badge badge-green flex-shrink-0">{r.categoria}</span>
                  )}
                </div>

                {r.descripcion && (
                  <p className="text-xs text-gray-400 mb-3 line-clamp-2">{r.descripcion}</p>
                )}

                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {(r.tiempo_prep_min || r.tiempo_coccion_min) && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {(r.tiempo_prep_min ?? 0) + (r.tiempo_coccion_min ?? 0)} min
                    </span>
                  )}
                  {r.porciones && (
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {r.porciones} {r.porciones === 1 ? 'porción' : 'porciones'}
                    </span>
                  )}
                  {r.kcal && (
                    <span className="font-medium text-gray-600">{Math.round(r.kcal)} kcal</span>
                  )}
                </div>

                {(r.proteinas || r.carbohidratos || r.grasas) && (
                  <div className="flex gap-2 mt-2">
                    {r.proteinas && <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">P:{Math.round(r.proteinas)}g</span>}
                    {r.carbohidratos && <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">C:{Math.round(r.carbohidratos)}g</span>}
                    {r.grasas && <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded">G:{Math.round(r.grasas)}g</span>}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
