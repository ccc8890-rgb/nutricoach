'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { ArrowLeft, Pencil, Trash2, ExternalLink, CheckCircle, XCircle, Loader2, Brain, AlertTriangle, Clock, Users, ChevronLeft, Euro, Sparkles, ArrowRight } from 'lucide-react'
import EscandalloReceta from '@/components/EscandalloReceta'
import { normalizarReceta } from '@/lib/recetas-constants'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import { FadeIn, PageTransition, ScaleIn } from '@/components/ui/Motion'
import { MacroRing, IngredientChecklist, StepByStep } from '@/components/premium'
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
  receta_original_id?: string | null
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

/** Divide instrucciones en pasos numerados */
function parsePasos(text: string | null | undefined): { number: number; content: string; title?: string }[] {
  if (!text) return []
  const lines = text.split('\n').filter(l => l.trim())
  // Intenta detectar si ya está numerado (1. / Paso 1: / 1-)
  const numbered = lines.filter(l => /^\s*(?:Paso\s*)?\d+[.)\-:]/.test(l))
  if (numbered.length >= 2) {
    // Ya tiene numeración — usar las numbered lines
    return numbered.map((l, i) => {
      const clean = l.replace(/^\s*(?:Paso\s*)?\d+[.)\-:]\s*/, '').trim()
      // Detectar si hay un título antes de :
      const colonIdx = clean.indexOf(':')
      if (colonIdx > 0 && colonIdx < 40) {
        return { number: i + 1, title: clean.slice(0, colonIdx).trim(), content: clean.slice(colonIdx + 1).trim() }
      }
      return { number: i + 1, content: clean }
    })
  }
  // No numerado — split por saltos de línea, cada línea es un paso
  return lines.map((l, i) => ({ number: i + 1, content: l.trim() }))
}

export default function DetalleRecetaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [receta, setReceta] = useState<RecetaDetalle | null>(null)
  const [ingredientes, setIngredientes] = useState<IngredienteConAlimento[]>([])
  const [loading, setLoading] = useState(true)
  const [borrando, setBorrando] = useState(false)
  const [accionando, setAccionando] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [versionFit, setVersionFit] = useState<{ id: string; nombre: string; kcal: number | null } | null>(null)
  const [recetaOriginalNombre, setRecetaOriginalNombre] = useState<string | null>(null)
  const [generandoFit, setGenerandoFit] = useState(false)
  const [specs, setSpecs] = useState('')
  const [showSpecs, setShowSpecs] = useState(false)

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
      const r = recetaRes.data as RecetaDetalle | null
      setReceta(r)
      setIngredientes(ingRes.data ?? [])
      setLoading(false)

      if (r) {
        // Buscar versión fit de esta receta (si esta es la original)
        const { data: fit } = await supabase.from('recetas')
          .select('id, nombre, kcal').eq('receta_original_id', id).eq('estado', 'aprobada').maybeSingle()
        if (fit) setVersionFit(fit as { id: string; nombre: string; kcal: number | null })

        // Si esta receta es una versión fit, cargar nombre del original
        if (r.receta_original_id) {
          const { data: orig } = await supabase.from('recetas')
            .select('nombre').eq('id', r.receta_original_id).single()
          if (orig) setRecetaOriginalNombre(orig.nombre)
        }
      }
    }
    load()
  }, [id])

  async function crearVersionFit() {
    setGenerandoFit(true)
    try {
      const res = await fetch(`/api/recetas/${id}/healthify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specs }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error generando versión fit')
      router.push(`/recetas/${data.id}`)
    } catch (err) {
      console.error(err)
      alert('Error al generar versión fit. Inténtalo de nuevo.')
      setGenerandoFit(false)
    }
  }

  async function borrar() {
    if (!confirm('¿Borrar esta receta? Esta acción no se puede deshacer.')) return
    setBorrando(true)
    await supabase.from('recetas').delete().eq('id', id)
    window.location.href = '/recetas'
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando receta…</span>
      </div>
    </div>
  )

  if (!receta) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>Receta no encontrada</p>
      <Link href="/recetas" className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>
        <ChevronLeft size={16} /> Volver al recetario
      </Link>
    </div>
  )

  const r = normalizarReceta(receta as unknown as Record<string, any>)

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

  const pesoTotal = ingredientes.reduce((s, i) => s + (i.cantidad_gramos ?? 0), 0)
  const pesoPorPorcion = pesoTotal > 0 ? Math.round(pesoTotal / (receta.porciones ?? 1)) : null

  const macrosPor100g = (() => {
    if (pesoTotal <= 0 || !macrosPorPorcion) return null
    const porciones = receta.porciones ?? 1
    const totalKcal = macrosPorPorcion.kcal * porciones
    const totalProt = macrosPorPorcion.proteinas * porciones
    const totalCarbs = macrosPorPorcion.carbohidratos * porciones
    const totalGrasa = macrosPorPorcion.grasas * porciones
    return {
      kcal: Math.round((totalKcal / pesoTotal) * 100),
      proteinas: Math.round((totalProt / pesoTotal) * 100 * 10) / 10,
      carbohidratos: Math.round((totalCarbs / pesoTotal) * 100 * 10) / 10,
      grasas: Math.round((totalGrasa / pesoTotal) * 100 * 10) / 10,
    }
  })()

  const tiempoTotal = (receta.tiempo_prep_min ?? 0) + (receta.tiempo_coccion_min ?? 0)
  const intolerancias = receta.intolerancias ?? []

  // Ingredientes para el checklist
  const checklistItems = ingredientes.map(ing => ({
    id: ing.id,
    nombre: ing.alimento?.nombre ?? ing.nombre_libre ?? 'Ingrediente',
    cantidad: `${ing.cantidad_gramos}g`,
    kcal: ing.alimento ? calcularMacrosPorCantidad(
      ing.alimento.calorias, ing.alimento.proteinas, ing.alimento.carbohidratos, ing.alimento.grasas, ing.alimento.fibra ?? 0, ing.cantidad_gramos
    ).calorias : undefined,
  }))

  // Pasos para StepByStep
  const pasos = parsePasos(r.instrucciones ?? receta.instrucciones)

  return (
    <>
      <BackButton href="/recetas" />
      <PageTransition>
        {/* ═══════ HERO FULL-BLEED ═══════ */}
        <div className="relative w-full">
          {receta.imagen_url ? (
            <div className="relative w-full h-[45vh] min-h-[320px] max-h-[500px] overflow-hidden">
              <img
                src={receta.imagen_url}
                alt={receta.nombre}
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${imgLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
                onLoad={() => setImgLoaded(true)}
              />
              {/* Skeleton */}
              {!imgLoaded && <div className="absolute inset-0 skeleton" />}
              {/* Overlay gradiente */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to top, var(--bg) 0%, rgba(10,10,11,0.6) 40%, rgba(10,10,11,0.2) 70%, transparent 100%)',
                }}
              />
              {/* Overlay radial para dar profundidad */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(ellipse at center bottom, transparent 40%, var(--bg) 100%)',
                }}
              />
            </div>
          ) : (
            <div
              className="w-full h-[30vh] min-h-[240px] flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--accent-bg), var(--bg-subtle))' }}
            >
              <span className="text-7xl">🥗</span>
            </div>
          )}

          {/* Navegación flotante sobre la imagen */}
          <div className="absolute top-4 left-4 right-4 flex items-center gap-2 z-10">
            <Link
              href="/recetas"
              className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', color: '#FFFFFF' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.7)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.5)' }}
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex-1" />
            <Link
              href={`/recetas/${id}/editar`}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', color: '#FFFFFF' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.7)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.5)' }}
            >
              <Pencil size={12} /> Editar
            </Link>
            <button onClick={borrar} disabled={borrando}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200"
              style={{ background: 'rgba(255,69,58,0.3)', backdropFilter: 'blur(12px)', color: '#FF453A' }}
            >
              <Trash2 size={12} /> {borrando ? '…' : 'Borrar'}
            </button>
          </div>
        </div>

        {/* ═══════ CONTENIDO PRINCIPAL ═══════ */}
        <div className="max-w-3xl mx-auto px-6 -mt-16 relative z-20 pb-safe">
          {/* Banner de revisión */}
          {(receta.estado === 'en_revision' || receta.estado === 'borrador') && (
            <ScaleIn delay={0.05}>
              <div
                className="mb-6 p-4 rounded-2xl flex items-center justify-between gap-4"
                style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}
              >
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--warning)' }}>Pendiente de revisión</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Revisa los datos antes de aprobar</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button disabled={accionando} onClick={() => handleEstado('aprobada')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-all duration-200"
                    style={{ background: 'var(--success)' }}>
                    {accionando ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Aprobar
                  </button>
                  <button disabled={accionando} onClick={() => handleEstado('descartada')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-all duration-200"
                    style={{ background: 'var(--error)' }}>
                    {accionando ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} Descartar
                  </button>
                </div>
              </div>
            </ScaleIn>
          )}
          {receta.estado === 'descartada' && (
            <FadeIn delay={0.05}>
              <div className="mb-6 p-4 rounded-2xl" style={{ background: 'var(--error-bg)', border: '1px solid var(--error)' }}>
                <p className="font-semibold text-sm" style={{ color: 'var(--error)' }}>Receta descartada</p>
                <button onClick={() => handleEstado('aprobada')} className="text-xs mt-1 underline" style={{ color: 'var(--error)' }}>
                  Restaurar como aprobada
                </button>
              </div>
            </FadeIn>
          )}

          {/* ═══════ TÍTULO + META ═══════ */}
          <FadeIn delay={0.1}>
            <div className="mb-6">
              <div className="flex items-start gap-3 flex-wrap mb-2">
                <h1 className="text-3xl font-bold tracking-tight flex-1" style={{ color: 'var(--text)' }}>{receta.nombre}</h1>
              </div>
              {receta.descripcion && (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{receta.descripcion}</p>
              )}

              {/* Badges + tags */}
              <div className="flex flex-wrap gap-2 mt-3">
                {receta.categoria && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                    {receta.categoria}
                  </span>
                )}
                {receta.tipo_coccion && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                    {receta.tipo_coccion}
                  </span>
                )}
                {receta.dificultad && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
                    {receta.dificultad}
                  </span>
                )}
              </div>
            </div>
          </FadeIn>

          {/* ═══════ MACRO RING + STATS ROW ═══════ */}
          <FadeIn delay={0.15}>
            <div
              className="rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-center gap-6"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              {/* MacroRing */}
              <div className="flex-shrink-0">
                {macrosPorPorcion ? (
                  <MacroRing
                    kcal={macrosPorPorcion.kcal}
                    proteinas={macrosPorPorcion.proteinas}
                    carbohidratos={macrosPorPorcion.carbohidratos}
                    grasas={macrosPorPorcion.grasas}
                    size={130}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center" style={{ width: 130, height: 130 }}>
                    <span className="text-2xl font-bold" style={{ color: 'var(--text-muted)' }}>—</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>sin datos</span>
                  </div>
                )}
              </div>

              {/* Stats detalle */}
              <div className="flex-1 flex flex-col gap-3 w-full">

                {/* Fila 1 — Tiempo y porciones */}
                <div className="flex flex-wrap gap-4">
                  {tiempoTotal > 0 && (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
                        <Clock size={12} /> Tiempo
                      </div>
                      <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--text)' }}>{tiempoTotal} min</span>
                    </div>
                  )}
                  {receta.porciones && (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
                        <Users size={12} /> Porciones
                      </div>
                      <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--text)' }}>
                        {receta.porciones}{receta.descripcion_porcion ? ` · ${receta.descripcion_porcion}` : ''}
                      </span>
                      {pesoPorPorcion && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>~{pesoPorPorcion}g / porción</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Fila 2 — Macros por porción */}
                {macrosPorPorcion && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Por porción{receta.porciones && receta.porciones > 1 ? ` (1 de ${receta.porciones})` : ''}
                    </span>
                    <div className="flex flex-wrap gap-3">
                      <div className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: 'var(--bg-subtle)', minWidth: 56 }}>
                        <span className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>kcal</span>
                        <span className="text-base font-bold tabular-nums" style={{ color: 'var(--macro-calories)' }}>
                          {Math.round(macrosPorPorcion.kcal)}
                        </span>
                      </div>
                      <div className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: 'var(--bg-subtle)', minWidth: 56 }}>
                        <span className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>prot</span>
                        <span className="text-base font-bold tabular-nums" style={{ color: 'var(--macro-protein)' }}>
                          {Math.round(macrosPorPorcion.proteinas)}g
                        </span>
                      </div>
                      <div className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: 'var(--bg-subtle)', minWidth: 56 }}>
                        <span className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>carbs</span>
                        <span className="text-base font-bold tabular-nums" style={{ color: 'var(--macro-carbs)' }}>
                          {Math.round(macrosPorPorcion.carbohidratos)}g
                        </span>
                      </div>
                      <div className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: 'var(--bg-subtle)', minWidth: 56 }}>
                        <span className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>grasas</span>
                        <span className="text-base font-bold tabular-nums" style={{ color: 'var(--macro-fat)' }}>
                          {Math.round(macrosPorPorcion.grasas)}g
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fila 3 — Totales receta completa (si hay más de 1 porción) */}
                {macrosPorPorcion && receta.porciones && receta.porciones > 1 && (
                  <div className="flex gap-3 flex-wrap items-center">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Receta completa</span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-semibold" style={{ color: 'var(--macro-calories)' }}>{Math.round(macrosPorPorcion.kcal * receta.porciones)}</span> kcal
                    </span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-semibold" style={{ color: 'var(--macro-protein)' }}>{Math.round(macrosPorPorcion.proteinas * receta.porciones)}g</span> P
                    </span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-semibold" style={{ color: 'var(--macro-carbs)' }}>{Math.round(macrosPorPorcion.carbohidratos * receta.porciones)}g</span> C
                    </span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-semibold" style={{ color: 'var(--macro-fat)' }}>{Math.round(macrosPorPorcion.grasas * receta.porciones)}g</span> G
                    </span>
                  </div>
                )}

                {/* Fila 4 — Por 100g */}
                {macrosPor100g && (
                  <div className="flex gap-3 flex-wrap items-center">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/ 100g</span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-semibold" style={{ color: 'var(--macro-calories)' }}>{macrosPor100g.kcal}</span> kcal
                    </span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-semibold" style={{ color: 'var(--macro-protein)' }}>{macrosPor100g.proteinas}g</span> P
                    </span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-semibold" style={{ color: 'var(--macro-carbs)' }}>{macrosPor100g.carbohidratos}g</span> C
                    </span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-semibold" style={{ color: 'var(--macro-fat)' }}>{macrosPor100g.grasas}g</span> G
                    </span>
                  </div>
                )}

                {/* Fuente */}
                {r.url_origen && (
                  <a href={r.url_origen} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs hover:underline w-fit" style={{ color: 'var(--info)' }}>
                    <ExternalLink size={12} /> Fuente original
                  </a>
                )}
              </div>
            </div>
          </FadeIn>

          {/* ═══════ VIDEO (si existe) ═══════ */}
          {receta.video_url && (
            <FadeIn delay={0.2}>
              <div className="mb-6 overflow-hidden rounded-2xl" style={{ border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-subtle)' }}>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>🎬 Video receta</span>
                  <a href={receta.video_url} target="_blank" rel="noopener noreferrer"
                    className="ml-auto text-xs hover:underline" style={{ color: 'var(--info)' }}>Ver original ↗</a>
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
                    <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg)' }}>
                      <a href={receta.video_url} target="_blank" rel="noopener noreferrer"
                        className="text-sm hover:underline flex items-center gap-2" style={{ color: 'var(--info)' }}>
                        ▶ Ver video en la web original
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </FadeIn>
          )}

          {/* ═══════ INGREDIENTES (Checklist estilo Crouton) ═══════ */}
          <FadeIn delay={0.25}>
            {ingredientes.length > 0 && (
              <div
                className="rounded-2xl p-5 mb-6"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <IngredientChecklist ingredientes={checklistItems} />
              </div>
            )}
          </FadeIn>

          {/* ═══════ INTOLERANCIAS ═══════ */}
          {intolerancias.length > 0 && (
            <FadeIn delay={0.3}>
              <div className="flex flex-wrap gap-2 mb-6">
                {intolerancias.map((t: string) => (
                  <span
                    key={t}
                    className="text-xs px-3 py-1 rounded-full border"
                    style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent-dark)', borderColor: 'var(--accent-ring)' }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </FadeIn>
          )}

          {/* ═══════ PASOS (StepByStep estilo Crouton) ═══════ */}
          <FadeIn delay={0.35}>
            {pasos.length > 0 && (
              <div
                className="rounded-2xl p-5 mb-6"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <StepByStep pasos={pasos} />
              </div>
            )}
          </FadeIn>

          {/* ═══════ CONSEJOS ═══════ */}
          {receta.consejos && (
            <FadeIn delay={0.4}>
              <div
                className="rounded-2xl p-5 mb-6"
                style={{
                  background: 'var(--accent-bg)',
                  border: '1px solid var(--accent-ring)',
                }}
              >
                <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--accent)' }}>💡 Consejos</h2>
                <p className="text-sm whitespace-pre-line leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{receta.consejos}</p>
              </div>
            </FadeIn>
          )}

          {/* ═══════ VERSIÓN FIT ═══════ */}
          <FadeIn delay={0.41}>
            {/* Esta receta ES una versión fit → mostrar enlace al original */}
            {receta.receta_original_id && recetaOriginalNombre && (
              <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-ring)' }}>
                <Sparkles size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Versión fit de</span>
                <Link href={`/recetas/${receta.receta_original_id}`} className="text-sm font-semibold flex items-center gap-1 hover:underline" style={{ color: 'var(--accent)' }}>
                  {recetaOriginalNombre} <ArrowRight size={13} />
                </Link>
              </div>
            )}

            {/* Existe versión fit de esta receta → mostrar card con enlace */}
            {!receta.receta_original_id && versionFit && (
              <Link href={`/recetas/${versionFit.id}`}
                className="mb-6 flex items-center justify-between gap-4 px-5 py-4 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 block"
                style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-ring)', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
              >
                <div className="flex items-center gap-3">
                  <Sparkles size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--accent)' }}>Versión fit disponible</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{versionFit.nombre}</p>
                    {versionFit.kcal && macrosPorPorcion && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {Math.round(versionFit.kcal)} kcal/p. · {macrosPorPorcion.kcal > 0 ? `${Math.round(((macrosPorPorcion.kcal - versionFit.kcal) / macrosPorPorcion.kcal) * 100)}% menos kcal` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <ArrowRight size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              </Link>
            )}

            {/* No hay versión fit y esta no ES una versión fit → mostrar botón crear */}
            {!receta.receta_original_id && !versionFit && (
              <div className="mb-6 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <button
                  onClick={() => setShowSpecs(s => !s)}
                  className="w-full flex items-center gap-3 px-5 py-4 transition-all duration-200 text-left"
                  style={{ background: 'var(--surface)' }}
                >
                  <Sparkles size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-secondary)' }}>Crear versión fit de esta receta</span>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>IA</span>
                </button>
                {showSpecs && (
                  <div className="px-5 pb-5 pt-3" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                    <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                      Especificaciones opcionales — DeepSeek generará una versión fit siguiendo las reglas de healthificación.
                    </p>
                    <textarea
                      value={specs}
                      onChange={e => setSpecs(e.target.value)}
                      placeholder="Ej: usar Air Fryer, salsa a base de yogur griego, reducir azúcar…"
                      className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
                      rows={2}
                      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                    />
                    <button
                      onClick={crearVersionFit}
                      disabled={generandoFit}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60"
                      style={{ background: generandoFit ? 'var(--text-muted)' : 'var(--accent)' }}
                    >
                      {generandoFit ? <><Loader2 size={14} className="animate-spin" /> Generando versión fit…</> : <><Sparkles size={14} /> Generar versión fit</>}
                    </button>
                  </div>
                )}
              </div>
            )}
          </FadeIn>

          {/* ═══════ ESCANDALLO DE COSTES ═══════ */}
          <FadeIn delay={0.42}>
            <div
              className="rounded-2xl p-5 mb-6"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <Euro size={15} /> Coste de la receta
              </h2>
              <EscandalloReceta recetaId={id as string} />
            </div>
          </FadeIn>

          {/* ═══════ FOOTER ═══════ */}
          <FadeIn delay={0.45}>
            <div className="flex items-center justify-between py-6 border-t" style={{ borderColor: 'var(--border)' }}>
              <Link
                href="/recetas"
                className="flex items-center gap-1.5 text-sm font-medium transition-all duration-200"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                <ChevronLeft size={16} /> Volver al recetario
              </Link>
              <div className="flex gap-2">
                <Link href={`/recetas/${id}/editar`}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                >
                  <Pencil size={12} /> Editar
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </PageTransition>
    </>)
}
