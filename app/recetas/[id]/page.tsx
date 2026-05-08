'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Clock, Users, Pencil, Trash2, ExternalLink, CheckCircle, XCircle, Loader2, Brain, AlertTriangle } from 'lucide-react'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import type { Alimento } from '@/types'

interface RecetaDetalle {
  id: string
  nombre: string
  imagen_url?: string | null
  video_url?: string | null
  descripcion?: string | null
  instrucciones?: string | null
  consejos?: string | null
  categoria?: string | null
  tipo_coccion?: string | null
  dificultad?: string | null
  porciones?: number
  descripcion_porcion?: string | null
  kcal?: number | null
  proteinas?: number | null
  carbohidratos?: number | null
  grasas?: number | null
  kcal_por_porcion?: number | null
  proteinas_por_porcion?: number | null
  carbohidratos_por_porcion?: number | null
  grasas_por_porcion?: number | null
  url_origen?: string | null
  url?: string | null
  pasos?: string | null
  tipo_plato?: string | null
  tiempo_prep_min?: number | null
  tiempo_coccion_min?: number | null
  estado?: string
  intolerancias?: string[]
  coach_id?: string
  created_at: string
}

interface IngredienteConAlimento {
  id: string
  receta_id: string
  alimento_id?: string | null
  nombre_libre?: string | null
  cantidad_gramos: number
  orden?: number
  alimento?: Alimento | null
}

export default function DetalleRecetaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [receta, setReceta] = useState<RecetaDetalle | null>(null)
  const [ingredientes, setIngredientes] = useState<IngredienteConAlimento[]>([])
  const [loading, setLoading] = useState(true)
  const [borrando, setBorrando] = useState(false)
  const [accionando, setAccionando] = useState(false)

  async function handleEstado(nuevoEstado: 'aprobada' | 'descartada') {
    setAccionando(true)
    await fetch(`/api/recetas/${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    })
    setReceta((prev: RecetaDetalle | null) => prev ? { ...prev, estado: nuevoEstado } : prev)
    setAccionando(false)
  }

  useEffect(() => {
    async function load() {
      const [recetaRes, ingRes] = await Promise.all([
        supabase.from('recetas').select('*').eq('id', id).single(),
        supabase.from('receta_ingredientes').select('*, alimento:alimentos(*)').eq('receta_id', id).order('cantidad_gramos', { ascending: false }),
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

  if (!receta) return <div className="p-8" style={{ color: 'var(--text-secondary)' }}>Receta no encontrada</div>

  // Compatibilidad: soportar nombres de columna del esquema antiguo y nuevo
  const r = {
    kcal: receta.kcal ?? receta.kcal_por_porcion ?? null,
    proteinas: receta.proteinas ?? receta.proteinas_por_porcion ?? null,
    carbohidratos: receta.carbohidratos ?? receta.carbohidratos_por_porcion ?? null,
    grasas: receta.grasas ?? receta.grasas_por_porcion ?? null,
    instrucciones: receta.instrucciones ?? receta.pasos ?? null,
    url_origen: receta.url_origen ?? receta.url ?? null,
    tipo_coccion: receta.tipo_coccion ?? receta.tipo_plato ?? null,
  }

  const macrosPorPorcion = (() => {
    const porciones = receta.porciones ?? 1
    const conAlimento = ingredientes.filter(i => i.alimento)
    if (conAlimento.length) {
      const total = sumarMacros(conAlimento.map(i =>
        calcularMacrosPorCantidad(i.alimento!.calorias, i.alimento!.proteinas, i.alimento!.carbohidratos, i.alimento!.grasas, i.alimento!.fibra ?? 0, i.cantidad_gramos)
      ))
      return {
        kcal: total.calorias / porciones,
        proteinas: total.proteinas / porciones,
        carbohidratos: total.carbohidratos / porciones,
        grasas: total.grasas / porciones,
      }
    }
    // Fallback: usar valores almacenados directamente en la receta
    // NOTA: Los valores ya están calculados POR PORCIÓN (tanto del esquema nuevo
    // como del antiguo 'kcal_por_porcion'), así que NO dividir por porciones aquí
    if ((r.kcal ?? 0) > 0 || (r.proteinas ?? 0) > 0 || (r.carbohidratos ?? 0) > 0 || (r.grasas ?? 0) > 0) {
      return {
        kcal: r.kcal ?? 0,
        proteinas: r.proteinas ?? 0,
        carbohidratos: r.carbohidratos ?? 0,
        grasas: r.grasas ?? 0,
      }
    }
    return null
  })()

  const tiempoTotal = (receta.tiempo_prep_min ?? 0) + (receta.tiempo_coccion_min ?? 0)
  const intolerancias = receta.intolerancias ?? []

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

      {/* Banner de revisión */}
      {(receta.estado === 'en_revision' || receta.estado === 'borrador') && (
        <div className="mb-6 p-4 rounded-xl flex items-center justify-between gap-4"
          style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--warning)' }}>Receta pendiente de revisión</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Revisa los datos y decide si aprobar o descartar</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button disabled={accionando} onClick={() => handleEstado('aprobada')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--primary)' }}>
              {accionando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Aprobar
            </button>
            <button disabled={accionando} onClick={() => handleEstado('descartada')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: '#EF4444' }}>
              {accionando ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Descartar
            </button>
          </div>
        </div>
      )}
      {receta.estado === 'descartada' && (
        <div className="mb-6 p-4 rounded-xl" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          <p className="font-semibold text-sm" style={{ color: '#DC2626' }}>Receta descartada</p>
          <button onClick={() => handleEstado('aprobada')} className="text-xs mt-1 underline" style={{ color: '#DC2626' }}>
            Restaurar como aprobada
          </button>
        </div>
      )}

      {/* Imagen */}
      {receta.imagen_url && (
        <img src={receta.imagen_url} alt={receta.nombre} className="w-full h-64 object-cover rounded-2xl mb-6 shadow-md" />
      ) || (
          <div className="w-full h-64 rounded-2xl mb-6 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--primary-bg), #16a34a22)', border: '2px dashed var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin imagen disponible</p>
          </div>
        )}

      {/* Video embebido (Instagram/TikTok/YouTube) */}
      {receta.video_url && (
        <div className="mb-6 overflow-hidden rounded-2xl shadow-sm" style={{ border: '1px solid var(--border)' }}>
          <div className="p-3 flex items-center gap-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>🎬 Video receta</span>
            <a href={receta.video_url} target="_blank" rel="noopener noreferrer"
              className="ml-auto text-xs text-blue-500 hover:underline">Ver original ↗</a>
          </div>
          <div className="aspect-video w-full max-h-[500px]">
            {receta.video_url.includes('youtube.com/embed') || receta.video_url.includes('youtu.be') ? (
              <iframe
                src={receta.video_url.includes('youtube.com/embed') ? receta.video_url :
                  `https://www.youtube.com/embed/${new URL(receta.video_url).pathname.slice(1).split('?')[0]}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : receta.video_url.includes('instagram.com') ? (
              <iframe
                src={`${receta.video_url.includes('?') ? receta.video_url + '&' : receta.video_url + '?'}embed`}
                className="w-full h-full"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: '#f5f5f5' }}>
                <a href={receta.video_url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline flex items-center gap-2">
                  ▶ Ver video en la web original
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Título y badges */}
      <div className="mb-4">
        <div className="flex items-start gap-3 flex-wrap mb-2">
          <h1 className="text-2xl font-bold flex-1" style={{ color: 'var(--text)' }}>{receta.nombre}</h1>
          {receta.categoria && <span className="badge badge-green">{receta.categoria}</span>}
          {receta.tipo_coccion && (
            <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium"
              style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }}>
              {receta.tipo_coccion}
            </span>
          )}
          {receta.dificultad && <span className="badge badge-gray">{receta.dificultad}</span>}
        </div>
        {receta.descripcion && <p style={{ color: 'var(--text-secondary)' }}>{receta.descripcion}</p>}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-4 text-sm mb-6 pb-6" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
        {tiempoTotal > 0 && (
          <span className="flex items-center gap-1.5"><Clock size={15} /> {tiempoTotal} min</span>
        )}
        {receta.porciones && (
          <span className="flex items-center gap-1.5"><Users size={15} /> {receta.porciones} {receta.porciones === 1 ? 'porción' : 'porciones'}</span>
        )}
        {r.tipo_coccion && <span>{r.tipo_coccion}</span>}
        {r.url_origen && (
          <a href={r.url_origen} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-500 hover:underline">
            <ExternalLink size={13} /> Fuente original
          </a>
        )}
      </div>

      {/* Macros */}
      {macrosPorPorcion && (
        <div className="card mb-6" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', color: 'white' }}>
          <p className="text-green-100 text-sm mb-2">
            Macros por porción{receta.descripcion_porcion ? <span className="opacity-75"> · {receta.descripcion_porcion}</span> : ''}
          </p>
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
      {intolerancias.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {intolerancias.map((t: string) => (
            <span key={t} className="text-xs px-3 py-1 rounded-full border" style={{ backgroundColor: 'var(--primary-bg)', color: 'var(--primary-dark)', borderColor: 'var(--primary-ring)' }}>{t}</span>
          ))}
        </div>
      )}

      {/* Ingredientes */}
      {ingredientes.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Ingredientes</h2>
          <div className="flex flex-col gap-2">
            {ingredientes.map(ing => {
              const macros = ing.alimento
                ? calcularMacrosPorCantidad(ing.alimento.calorias, ing.alimento.proteinas, ing.alimento.carbohidratos, ing.alimento.grasas, ing.alimento.fibra ?? 0, ing.cantidad_gramos)
                : null
              return (
                <div key={ing.id} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{ing.alimento?.nombre ?? ing.nombre_libre}</p>
                      {!ing.alimento_id ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex items-center gap-0.5" style={{ color: '#DC2626', backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}>
                          <AlertTriangle size={10} /> Sin vínculo
                        </span>
                      ) : ing.alimento?.fuente === 'ia' ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex items-center gap-0.5" style={{ color: '#7C3AED', backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}>
                          <Brain size={10} /> IA
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex items-center gap-0.5" style={{ color: '#16A34A', backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                          <CheckCircle size={10} /> Vinculado
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ing.cantidad_gramos}g</p>
                  </div>
                  {macros && (
                    <div className="text-right text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <p className="font-semibold" style={{ color: 'var(--text)' }}>{Math.round(macros.calorias)} kcal</p>
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
      {r.instrucciones && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Preparación</h2>
          <div className="text-sm whitespace-pre-line leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {r.instrucciones}
          </div>
        </div>
      )}

      {/* Consejos */}
      {receta.consejos && (
        <div className="card" style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning)' }}>
          <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Consejos</h2>
          <p className="text-sm whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>{receta.consejos}</p>
        </div>
      )}
    </div>
  )
}
