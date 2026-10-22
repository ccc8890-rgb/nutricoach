'use client'
import ClasificacionEditor from '@/components/recetas/ClasificacionEditor'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, PencilSimple, Trash, ArrowSquareOut, CheckCircle, XCircle, SpinnerGap, Warning, Clock, Users, CaretLeft, CurrencyEur, PlayCircle, Lightbulb } from '@phosphor-icons/react'
import EscandalloReceta from '@/components/EscandalloReceta'
import { normalizarReceta, resumenAptitud, normalizarIntolerancias } from '@/lib/recetas-constants'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import { FadeIn, PageTransition, ScaleIn } from '@/components/ui/Motion'
import { IngredientChecklist, StepByStep } from '@/components/premium'
import { parsePasos, ordenarPorFases } from '@/lib/recetas/pasos'
import MacroTriangulo from '@/components/PortalCliente/MacroTriangulo'
import { listaRecordada } from '@/lib/useEstadoUrl'
import BarraRevision from '@/components/recetas/BarraRevision'
import ReportarProblema from '@/components/recetas/ReportarProblema'
import EdicionRapida from '@/components/recetas/EdicionRapida'
import { formatoCantidad } from '@/lib/recetas/equivalencia'
import { SelectorRaciones } from '@/components/premium/SelectorRaciones'
import { quitarCifras } from '@/lib/nutricion/quitar-cifras'
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
  tags?: string[]
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
  cantidad_original?: number | null
  unidad_display?: string | null
  orden?: number
  grupo?: string | null
  alimento?: Alimento | null
}

interface RecetaQuality {
  ok: boolean
  cobertura_pct: number
  ingredientes_sin_precio: number
  score_calidad: number
  banda_calidad: 'excelente' | 'buena' | 'revisar' | 'bloqueada'
  estado_sugerido: 'aprobada' | 'en_revision' | 'bloqueada'
  clasificacion: {
    nivel_fit: string
    tipo_uso: string
    contexto_uso: string
    apta_cliente: string
    alcohol_culinario: boolean
  }
  clasificacion_manual?: boolean
  issues: Array<{
    severity: 'bloqueante' | 'revisar' | 'aviso'
    codigo: string
    mensaje: string
  }>
}

/** Divide instrucciones en pasos numerados */
export default function DetalleRecetaPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || listaRecordada('ultima', listaRecordada('recetas', '/recetas'))
  const returnPath = (() => {
    try {
      return new URL(returnTo, 'http://localhost').pathname
    } catch {
      return returnTo.split('?')[0]
    }
  })()
  const isClientView = returnPath.startsWith('/cliente')
  const enBandeja = !isClientView && returnPath.startsWith('/recetas/revisar')
  const clienteCodigo = isClientView ? returnPath.split('/').filter(Boolean)[1] : null
  const [receta, setReceta] = useState<RecetaDetalle | null>(null)
  const [reportando, setReportando] = useState(false)
  const [ingredientes, setIngredientes] = useState<IngredienteConAlimento[]>([])
  const [loading, setLoading] = useState(true)
  const [borrando, setBorrando] = useState(false)
  const [accionando, setAccionando] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [editandoRapido, setEditandoRapido] = useState(false)
  const [racionesVista, setRacionesVista] = useState<number | null>(null)
  const [seccion, setSeccion] = useState<'ingredientes' | 'preparacion'>('ingredientes')
  const [quality, setQuality] = useState<RecetaQuality | null>(null)

  async function handleEstado(nuevoEstado: 'aprobada' | 'descartada'): Promise<boolean> {
    if (nuevoEstado === 'aprobada' && quality) {
      const bloqueantes = quality.issues.filter(i => i.severity === 'bloqueante')
      if (bloqueantes.length > 0) {
        alert(`No apruebes todavía: ${bloqueantes.map(i => i.mensaje).join(' ')}`)
        return false
      }

      const requiereRevision = quality.issues.filter(i => i.severity === 'revisar')
      if (requiereRevision.length > 0) {
        const ok = confirm(`Esta receta tiene avisos antes de aprobar:\n\n${requiereRevision.map(i => `- ${i.mensaje}`).join('\n')}\n\n¿Aprobar igualmente?`)
        if (!ok) return false
      }
    }

    setAccionando(true)
    try {
      const res = await fetch(`/api/recetas/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (!res.ok) {
        // antes se mostraba «aprobada» aunque el servidor la rechazara y la receta seguía pendiente en la lista
        const json = await res.json().catch(() => ({}))
        alert(`No se pudo ${nuevoEstado === 'aprobada' ? 'aprobar' : 'descartar'}: ${[json.error, ...(json.bloqueantes ?? [])].filter(Boolean).join(' · ') || `error ${res.status}`}`)
        return false
      }
      setReceta((prev: RecetaDetalle | null) => prev ? { ...prev, estado: nuevoEstado } : prev)
      try {
        const clave = 'nc:revision-resueltas'
        const actuales: string[] = JSON.parse(sessionStorage.getItem(clave) || '[]')
        sessionStorage.setItem(clave, JSON.stringify([...new Set([...actuales, id])]))
      } catch { /* sin almacenamiento */ }
      return true
    } finally {
      setAccionando(false)
    }
  }

  useEffect(() => {
    async function load() {
      if (isClientView && clienteCodigo) {
        const res = await fetch(`/api/cliente/${clienteCodigo}/recetas/${id}`)
        if (res.ok) {
          const json = await res.json()
          setReceta(json.receta)
          setIngredientes(json.ingredientes ?? [])
        } else {
          setReceta(null)
          setIngredientes([])
        }
        setLoading(false)
        return
      }

      const [recetaRes, ingRes] = await Promise.all([
        supabase.from('recetas').select('*').eq('id', id).single(),
        supabase.from('receta_ingredientes').select('*, alimento:alimentos(*)').eq('receta_id', id).order('cantidad_gramos', { ascending: false }),
      ])
      setReceta(recetaRes.data)
      setIngredientes(ingRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [clienteCodigo, id, isClientView])

  useEffect(() => {
    async function loadQuality() {
      if (isClientView) return
      try {
        const res = await fetch(`/api/recetas/${id}/quality`)
        const json = await res.json()
        if (res.ok) setQuality(json)
      } catch (err) {
        console.error('[DetalleRecetaPage] Error cargando quality:', err)
      }
    }
    loadQuality()
  }, [id, isClientView])

  async function borrar() {
    if (!confirm('¿Borrar esta receta? Esta acción no se puede deshacer.')) return
    setBorrando(true)
    await supabase.from('recetas').delete().eq('id', id)
    window.location.href = returnTo.startsWith('/') ? returnTo : '/recetas'
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
      <Link href={returnTo} className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>
        <CaretLeft size={16} /> {isClientView ? 'Volver al plan' : 'Volver al recetario'}
      </Link>
    </div>
  )

  const r = normalizarReceta(receta as Parameters<typeof normalizarReceta>[0])

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
  const intolerancias = receta.intolerancias ? normalizarIntolerancias(receta.intolerancias) : []

  // Raciones para las que se cocina: por defecto las de la receta original; el selector recalcula las cantidades
  const porcionesReceta = Math.max(1, receta.porciones ?? 1)
  const nVista = racionesVista ?? porcionesReceta
  const factorVista = nVista / porcionesReceta

  // Ingredientes para el checklist
  const checklistItems = ordenarPorFases(ingredientes.map(ing => ({
    id: ing.id,
    grupo: ing.grupo ?? null,
    nombre: ing.alimento?.nombre ?? ing.nombre_libre ?? 'Ingrediente',
    cantidad: formatoCantidad(ing.cantidad_gramos, factorVista, ing.cantidad_original, ing.unidad_display, ing.alimento?.nombre ?? ing.nombre_libre),
    kcal: ing.alimento ? Math.round(calcularMacrosPorCantidad(
      ing.alimento.calorias, ing.alimento.proteinas, ing.alimento.carbohidratos, ing.alimento.grasas, ing.alimento.fibra ?? 0, ing.cantidad_gramos
    ).calorias * factorVista) : undefined,
  })), parsePasos(r.instrucciones ?? receta.instrucciones))

  // Pasos para StepByStep: si se cambian las raciones, las cantidades escritas en los pasos ya no valen
  const pasos = parsePasos(r.instrucciones ?? receta.instrucciones).map(p =>
    nVista !== porcionesReceta ? { ...p, content: quitarCifras(p.content), title: p.title ? quitarCifras(p.title) : p.title } : p)

  const bloqueMacros = (
    <>
        {/* ═══════ MACRO RING + STATS ROW ═══════ */}
        <FadeIn delay={0.15}>
          <div
            className="coach-recipe-detail__nutrition mb-6 flex flex-col sm:flex-row lg:flex-col items-center lg:items-stretch gap-6"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Reparto de macros */}
            <div className="w-full flex-shrink-0 sm:w-[330px] lg:w-full">
              {macrosPorPorcion ? (
                <MacroTriangulo
                  kcal={macrosPorPorcion.kcal}
                  p={macrosPorPorcion.proteinas}
                  c={macrosPorPorcion.carbohidratos}
                  g={macrosPorPorcion.grasas}
                  sinMarco
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
                      {receta.descripcion_porcion
                        ? (receta.porciones > 1 ? `${receta.porciones} · ${receta.descripcion_porcion}` : receta.descripcion_porcion)
                        : `${receta.porciones} ${receta.porciones === 1 ? 'ración' : 'raciones'}`}
                    </span>
                    {pesoPorPorcion && !receta.descripcion_porcion && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>~{pesoPorPorcion}g / porción</span>
                    )}
                  </div>
                )}
              </div>

              {/* Por 100 g (los macros por ración ya salen en el triángulo) */}
              {macrosPor100g && (
                <div className="flex gap-3 flex-wrap">
                  <span className="text-xs self-center" style={{ color: 'var(--text-muted)' }}>/ 100g</span>
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
              {r.url_origen && /^https?:/.test(r.url_origen) && (
                /instagram\.com|tiktok\.com|youtube\.com|youtu\.be/.test(r.url_origen) ? (
                  <a href={r.url_origen} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 w-fit" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <PlayCircle size={14} /> Ver vídeo original
                  </a>
                ) : (
                  <a href={r.url_origen} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs hover:underline w-fit" style={{ color: 'var(--info)' }}>
                    <ArrowSquareOut size={12} /> Fuente original
                  </a>
                )
              )}
            </div>
          </div>
        </FadeIn>

    </>
  )

  const bloqueAptitudes = intolerancias.length > 0 ? (() => {
          const { aptaPara, contiene } = resumenAptitud(intolerancias)
          if (aptaPara.length === 0 && contiene.length === 0) return null
          const rotulo = 'text-xs font-bold uppercase tracking-widest shrink-0'
          return (
            <FadeIn delay={0.3}>
              <div
                className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2"
              >
                {aptaPara.length > 0 && (
                  <>
                    <span className={rotulo} style={{ color: 'var(--text-muted)' }}>Apta para</span>
                    {aptaPara.map(t => (
                      <span key={t} className="text-sm font-semibold px-2.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.07)', color: 'rgb(21,128,61)', border: '1px solid rgba(34,197,94,0.18)' }}>{t}</span>
                    ))}
                  </>
                )}
                {contiene.length > 0 && (
                  <>
                    {aptaPara.length > 0 && <span style={{ color: 'var(--border)' }}>·</span>}
                    <span className={rotulo} style={{ color: 'var(--text-muted)' }}>Contiene</span>
                    {contiene.map(t => (
                      <span key={t} className="text-sm font-semibold px-2.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.07)', color: 'rgb(185,28,28)', border: '1px solid rgba(239,68,68,0.18)' }}>{t}</span>
                    ))}
                  </>
                )}
              </div>
            </FadeIn>
          )
        })() : null

  const fotoReceta = receta.imagen_url ? (
    <div className="relative aspect-square w-full max-w-[20rem] overflow-hidden rounded-2xl lg:max-w-none" style={{ border: '1px solid var(--border)' }}>
      <img
        src={receta.imagen_url}
        alt={receta.nombre}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setImgLoaded(true)}
      />
      {!imgLoaded && <div className="absolute inset-0 skeleton" />}
    </div>
  ) : null

  return (
    <PageTransition className="coach-recipe-detail">
      {/* ═══════ HERO FULL-BLEED ═══════ */}
      <div className="coach-recipe-detail__hero relative w-full">
        {/* La foto va entera junto al título (la cabecera ya no la recorta en banner) */}
        <div className="h-16 w-full" aria-hidden />

        {/* Navegación flotante sobre la imagen */}
        <div
          className="absolute left-4 right-4 flex items-center gap-2 z-10"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
        >
          <Link
            href={returnTo}
            className={`flex items-center justify-center rounded-full transition-all duration-200 ${isClientView ? 'h-11 px-3 gap-1.5 text-sm font-semibold' : 'w-9 h-9'}`}
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', color: '#FFFFFF' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.7)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.5)' }}
            aria-label={isClientView ? 'Volver al plan' : 'Volver al recetario'}
          >
            <ArrowLeft size={18} />
            {isClientView && <span>Volver</span>}
          </Link>
          <div className="flex-1" />
          {!isClientView && (
            <>
              <button onClick={() => setEditandoRapido(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', color: '#FFFFFF' }}>
                <PencilSimple size={12} /> Editar rápido
              </button>
              {receta.estado === 'aprobada' && (
                <button onClick={() => setReportando(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200"
                  style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', color: 'var(--warning)' }}>
                  <Warning size={12} /> Reportar
                </button>
              )}
              <Link
                href={`/recetas/${id}/editar?returnTo=${encodeURIComponent(returnTo)}`}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', color: '#FFFFFF' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.7)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.5)' }}
              >
                <PencilSimple size={12} /> Editar
              </Link>
              <button onClick={borrar} disabled={borrando}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200"
                style={{ background: 'rgba(255,69,58,0.3)', backdropFilter: 'blur(12px)', color: '#FF453A' }}
              >
                <Trash size={12} /> {borrando ? '…' : 'Borrar'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═══════ CONTENIDO PRINCIPAL ═══════ */}
      <div className={`coach-recipe-detail__content mx-auto px-6 relative z-20 pb-safe${enBandeja ? ' pb-28' : ''}`}>
        {/* Banner de revisión */}
        {!isClientView && (receta.estado === 'en_revision' || receta.estado === 'borrador') && (
          <ScaleIn delay={0.05}>
            <div
              className="mb-6 p-4 rounded-2xl flex items-center justify-between gap-4"
              style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}
            >
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--warning)' }}>Pendiente de revisión</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Revisa los datos antes de aprobar</p>
              </div>
              {!enBandeja && <div className="flex gap-2 flex-shrink-0">
                <button disabled={accionando} onClick={() => handleEstado('aprobada')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-all duration-200"
                  style={{ background: 'var(--success)' }}>
                  {accionando ? <SpinnerGap size={13} className="animate-spin" /> : <CheckCircle size={13} />} Aprobar
                </button>
                <button disabled={accionando} onClick={() => handleEstado('descartada')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-all duration-200"
                  style={{ background: 'var(--error)' }}>
                  {accionando ? <SpinnerGap size={13} className="animate-spin" /> : <XCircle size={13} />} Descartar
                </button>
              </div>}
            </div>
          </ScaleIn>
        )}
        {!isClientView && receta.estado === 'descartada' && (
          <FadeIn delay={0.05}>
            <div className="mb-6 p-4 rounded-2xl" style={{ background: 'var(--error-bg)', border: '1px solid var(--error)' }}>
              <p className="font-semibold text-sm" style={{ color: 'var(--error)' }}>Receta descartada</p>
              <button onClick={() => handleEstado('aprobada')} className="text-xs mt-1 underline" style={{ color: 'var(--error)' }}>
                Restaurar como aprobada
              </button>
            </div>
          </FadeIn>
        )}

        <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="min-w-0 lg:col-span-2">
        {/* ═══════ TÍTULO + META ═══════ */}
        <FadeIn delay={0.1}>
          <div className={`coach-recipe-detail__intro mb-6 grid gap-6 ${receta.imagen_url ? 'sm:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[17rem_minmax(0,1fr)_25rem] lg:items-start' : 'lg:grid-cols-[minmax(0,1fr)_25rem]'}`}>
            {fotoReceta}
            <div className="min-w-0">
            <div className="flex items-start gap-3 flex-wrap mb-2">
              <h1 className="coach-recipe-detail__title flex-1" style={{ color: 'var(--text)' }}>{receta.nombre}</h1>
            </div>
            {receta.descripcion && (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{receta.descripcion}</p>
            )}
            {!isClientView && (
              <div className="mt-3">
                <EdicionRapida receta={{ id, nombre: receta.nombre, descripcion: receta.descripcion, tiempo_prep_min: receta.tiempo_prep_min, categoria: receta.categoria, tags: receta.tags }} control={{ abierto: editandoRapido, set: setEditandoRapido }} onGuardado={() => window.location.reload()} />
              </div>
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

            {bloqueAptitudes}
            </div>
            <div className="min-w-0 sm:col-span-2 lg:col-span-1">{bloqueMacros}</div>
          </div>
        </FadeIn>

          </div>

          {/* Columna principal: la receta en sí */}
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
        {/* ═══════ VIDEO (si existe) ═══════ */}
        {receta.video_url && (
          <FadeIn delay={0.2}>
            <div className="mb-6 overflow-hidden rounded-2xl" style={{ border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-subtle)' }}>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  <PlayCircle size={13} /> Video receta
                </span>
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
                      <PlayCircle size={16} /> Ver video en la web original
                    </a>
                  </div>
                )}
              </div>
            </div>
          </FadeIn>
        )}

        {/* Una sola lista a la vez: la receta no se hace larguísima con scroll */}
        {ingredientes.length > 0 && pasos.length > 0 && (
          <div className="mb-4 flex overflow-hidden" role="tablist" aria-label="Ingredientes o preparación" style={{ border: '1px solid var(--border)' }}>
            {([['ingredientes', 'Ingredientes'], ['preparacion', 'Preparación']] as const).map(([clave, etiqueta]) => (
              <button key={clave} role="tab" aria-selected={seccion === clave} onClick={() => setSeccion(clave)}
                className="flex-1 px-3 py-2.5 text-sm font-semibold"
                style={{ background: seccion === clave ? 'var(--primary)' : 'transparent', color: seccion === clave ? 'var(--bg)' : 'var(--text-muted)' }}>
                {etiqueta}
              </button>
            ))}
          </div>
        )}

        {/* ═══════ INGREDIENTES (Checklist estilo Crouton) ═══════ */}
        <FadeIn delay={0.25}>
          {ingredientes.length > 0 && (seccion === 'ingredientes' || pasos.length === 0) && (
            <>
              <div className="mb-3">
                <SelectorRaciones original={porcionesReceta} valor={nVista} onChange={setRacionesVista} kcalRacion={macrosPorPorcion?.kcal} />
              </div>
              <div
                className="coach-recipe-detail__section p-5 mb-6"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <IngredientChecklist ingredientes={checklistItems} sinCabecera={pasos.length > 0} />
                {nVista !== porcionesReceta && (
                  <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
                    Cantidades recalculadas para {nVista} {nVista === 1 ? 'ración' : 'raciones'}; los pasos van sin cantidades.
                  </p>
                )}
              </div>
            </>
          )}
        </FadeIn>

        {/* ═══════ PASOS (StepByStep estilo Crouton) ═══════ */}
        <FadeIn delay={0.35}>
          {pasos.length > 0 && (seccion === 'preparacion' || ingredientes.length === 0) && (
            <div
              className="coach-recipe-detail__section p-5 mb-6"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <StepByStep pasos={pasos} sinCabecera={ingredientes.length > 0} />
            </div>
          )}
        </FadeIn>

        {/* ═══════ CONSEJOS ═══════ */}
        {receta.consejos && (seccion === 'preparacion' || ingredientes.length === 0 || pasos.length === 0) && (
          <FadeIn delay={0.4}>
            <div
              className="rounded-2xl p-5 mb-6"
              style={{
                background: 'var(--accent-bg)',
                border: '1px solid var(--accent-ring)',
              }}
            >
              <h2 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                <Lightbulb size={15} /> Consejos
              </h2>
              <p className="text-sm whitespace-pre-line leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{receta.consejos}</p>
            </div>
          </FadeIn>
        )}

          </div>

          {/* Columna lateral: control del coach */}
          <div className="min-w-0 lg:col-start-2 lg:row-start-2">
        {!isClientView && quality && (
          <FadeIn delay={0.06}>
            <section className="coach-recipe-detail__section mb-6 p-4 sm:p-5" aria-label="Calidad de la receta">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="coach-recipe-kicker">Calidad</span>
                <span className="inline-flex items-center gap-2 text-sm font-semibold capitalize" style={{ color: 'var(--text)' }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: quality.ok ? 'var(--success)' : 'var(--warning)' }} aria-hidden />
                  {quality.banda_calidad}
                  <span className="font-normal tabular-nums" style={{ color: 'var(--text-secondary)' }}>{quality.score_calidad}/100</span>
                </span>
                <span className="text-xs tabular-nums sm:ml-auto" style={{ color: 'var(--text-muted)' }}>{quality.cobertura_pct}% de ingredientes con precio</span>
              </div>
              <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--recipe-rule)' }}>
                <ClasificacionEditor
                  recetaId={id}
                  clasificacion={quality.clasificacion}
                  manual={Boolean(quality.clasificacion_manual)}
                  onGuardado={(c, manual) => setQuality(q => (q ? { ...q, clasificacion: c, clasificacion_manual: manual } : q))}
                />
              </div>
              {quality.issues.length === 0 ? (
                <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Sin bloqueos de ingredientes, cantidades o coste.
                </p>
              ) : (
                <ul className="mt-4 space-y-1 border-t pt-4" style={{ borderColor: 'var(--recipe-rule)' }}>
                  {quality.issues.map(item => (
                    <li key={`${item.codigo}-${item.mensaje}`} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-semibold" style={{ color: item.severity === 'bloqueante' ? 'var(--error)' : 'var(--warning)' }}>{item.severity}:</span> {item.mensaje}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </FadeIn>
        )}

          </div>
        </div>

        {/* ═══════ ESCANDALLO DE COSTES (a todo el ancho, debajo de la ficha) ═══════ */}
        {!isClientView && (
        <FadeIn delay={0.42}>
          <div
            id="escandallo-receta"
            className="coach-recipe-detail__section p-5 mb-6 scroll-mt-24"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <CurrencyEur size={15} /> Coste de la receta
            </h2>
            <EscandalloReceta recetaId={id as string} />
          </div>
        </FadeIn>
        )}

        {/* ═══════ FOOTER ═══════ */}
        <FadeIn delay={0.45}>
          <div className="flex items-center justify-between py-6 border-t" style={{ borderColor: 'var(--border)' }}>
            <Link
              href={returnTo}
              className="flex items-center gap-1.5 text-sm font-medium transition-all duration-200"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              <CaretLeft size={16} /> {isClientView ? 'Volver al plan' : 'Volver al recetario'}
            </Link>
            {!isClientView && (
            <div className="flex gap-2">
              <Link href={`/recetas/${id}/editar?returnTo=${encodeURIComponent(returnTo)}`}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                <PencilSimple size={12} /> Editar
              </Link>
            </div>
            )}
          </div>
        </FadeIn>
      </div>
      <ReportarProblema ids={[id]} abierto={reportando} onCerrar={() => setReportando(false)} onHecho={() => { window.location.href = returnTo.startsWith('/') ? returnTo : '/recetas' }} />
      {enBandeja && (
        <BarraRevision id={id} pendiente={receta.estado === 'en_revision' || receta.estado === 'borrador'} returnTo={returnTo} accion={handleEstado} />
      )}
    </PageTransition>
  )
}
