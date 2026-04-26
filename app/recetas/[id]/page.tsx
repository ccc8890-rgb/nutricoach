'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Clock, Users, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'

export default function DetalleRecetaPage() {
  const { id } = useParams()
  const router = useRouter()
  const [receta, setReceta] = useState<any>(null)
  const [ingredientes, setIngredientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [borrando, setBorrando] = useState(false)

  useEffect(() => {
    async function load() {
      const [recetaRes, ingRes] = await Promise.all([
        supabase.from('recetas').select('*').eq('id', id).single(),
        supabase.from('receta_ingredientes').select('*, alimento:alimentos(*)').eq('receta_id', id).order('orden'),
      ])
      setReceta(recetaRes.data)
      setIngredientes(ingRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  async function borrar() {
    if (!confirm('¿Borrar esta receta? Esta acción no se puede deshacer.')) return
    setBorrando(true)
    await supabase.from('recetas').delete().eq('id', id)
    window.location.href = '/recetas'
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
    </div>
  )

  if (!receta) return <div className="p-8 text-gray-500">Receta no encontrada</div>

  const macrosPorPorcion = (() => {
    const porciones = receta.porciones ?? 1
    const conAlimento = ingredientes.filter(i => i.alimento)
    if (!conAlimento.length) return null
    const total = sumarMacros(conAlimento.map(i =>
      calcularMacrosPorCantidad(i.alimento.calorias, i.alimento.proteinas, i.alimento.carbohidratos, i.alimento.grasas, i.alimento.fibra ?? 0, i.cantidad_gramos)
    ))
    return {
      kcal: total.calorias / porciones,
      proteinas: total.proteinas / porciones,
      carbohidratos: total.carbohidratos / porciones,
      grasas: total.grasas / porciones,
    }
  })()

  const tiempoTotal = (receta.tiempo_prep_min ?? 0) + (receta.tiempo_coccion_min ?? 0)

  return (
    <div className="p-6 max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/recetas" className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
        <div className="flex-1" />
        <Link href={`/recetas/${id}/editar`} className="btn-secondary flex items-center gap-1.5 text-sm">
          <Pencil size={14} /> Editar
        </Link>
        <button onClick={borrar} disabled={borrando} className="btn-secondary text-red-400 hover:text-red-600 flex items-center gap-1.5 text-sm">
          <Trash2 size={14} /> {borrando ? 'Borrando…' : 'Borrar'}
        </button>
      </div>

      {/* Imagen */}
      {receta.imagen_url && (
        <img src={receta.imagen_url} alt={receta.nombre} className="w-full h-56 object-cover rounded-2xl mb-6" />
      )}

      {/* Título y badges */}
      <div className="mb-4">
        <div className="flex items-start gap-3 flex-wrap mb-2">
          <h1 className="text-2xl font-bold text-gray-900 flex-1">{receta.nombre}</h1>
          {receta.categoria && <span className="badge badge-green">{receta.categoria}</span>}
          {receta.dificultad && <span className="badge badge-gray">{receta.dificultad}</span>}
        </div>
        {receta.descripcion && <p className="text-gray-500">{receta.descripcion}</p>}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-6 pb-6 border-b border-gray-100">
        {tiempoTotal > 0 && (
          <span className="flex items-center gap-1.5"><Clock size={15} /> {tiempoTotal} min</span>
        )}
        {receta.porciones && (
          <span className="flex items-center gap-1.5"><Users size={15} /> {receta.porciones} {receta.porciones === 1 ? 'porción' : 'porciones'}</span>
        )}
        {receta.tipo_coccion && <span>{receta.tipo_coccion}</span>}
        {receta.url_origen && (
          <a href={receta.url_origen} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-500 hover:underline">
            <ExternalLink size={13} /> Fuente original
          </a>
        )}
      </div>

      {/* Macros */}
      {macrosPorPorcion && (
        <div className="card mb-6" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', color: 'white' }}>
          <p className="text-green-100 text-sm mb-2">Macros por porción</p>
          <div className="flex gap-6 flex-wrap">
            <div>
              <p className="text-2xl font-bold">{Math.round(macrosPorPorcion.kcal)}</p>
              <p className="text-xs text-green-200">kcal</p>
            </div>
            {[
              { l: 'Proteínas', v: macrosPorPorcion.proteinas, c: '#bbf7d0' },
              { l: 'Carbos', v: macrosPorPorcion.carbohidratos, c: '#fef08a' },
              { l: 'Grasas', v: macrosPorPorcion.grasas, c: '#fed7aa' },
            ].map(({ l, v, c }) => (
              <div key={l}>
                <p className="text-xl font-bold" style={{ color: c }}>{Math.round(v)}g</p>
                <p className="text-xs text-green-200">{l}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intolerancias */}
      {receta.intolerancias?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {receta.intolerancias.map((t: string) => (
            <span key={t} className="text-xs px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">{t}</span>
          ))}
        </div>
      )}

      {/* Ingredientes */}
      {ingredientes.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-800 mb-3">Ingredientes</h2>
          <div className="flex flex-col gap-2">
            {ingredientes.map(ing => {
              const macros = ing.alimento
                ? calcularMacrosPorCantidad(ing.alimento.calorias, ing.alimento.proteinas, ing.alimento.carbohidratos, ing.alimento.grasas, ing.alimento.fibra ?? 0, ing.cantidad_gramos)
                : null
              return (
                <div key={ing.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{ing.alimento?.nombre ?? ing.nombre_libre}</p>
                    <p className="text-xs text-gray-400">{ing.cantidad_gramos}g</p>
                  </div>
                  {macros && (
                    <div className="text-right text-xs text-gray-500">
                      <p className="font-semibold text-gray-700">{Math.round(macros.calorias)} kcal</p>
                      <p>P:{Math.round(macros.proteinas)}g · C:{Math.round(macros.carbohidratos)}g · G:{Math.round(macros.grasas)}g</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Instrucciones */}
      {receta.instrucciones && (
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-800 mb-3">Preparación</h2>
          <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {receta.instrucciones}
          </div>
        </div>
      )}

      {/* Consejos */}
      {receta.consejos && (
        <div className="card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <h2 className="font-semibold text-yellow-800 mb-2">Consejos</h2>
          <p className="text-sm text-yellow-700 whitespace-pre-line">{receta.consejos}</p>
        </div>
      )}
    </div>
  )
}
