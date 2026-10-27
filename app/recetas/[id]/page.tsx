'use client'
import ClasificacionEditor from '@/components/recetas/ClasificacionEditor'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, MagnifyingGlassPlus, X, PencilSimple, Trash, ArrowSquareOut, CheckCircle, XCircle, SpinnerGap, CaretLeft, CurrencyEur, PlayCircle, Lightbulb } from '@/components/icons/phosphor'
import EscandalloReceta from '@/components/EscandalloReceta'
import SalsasQueCombinan from '@/components/recetas/SalsasQueCombinan'
import { normalizarReceta, resumenAptitud, normalizarIntolerancias } from '@/lib/recetas-constants'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import { FadeIn, PageTransition, ScaleIn } from '@/components/ui/Motion'
import { IngredientChecklist, StepByStep } from '@/components/premium'
import { parsePasos, ordenarPorFases } from '@/lib/recetas/pasos'
import MacroTriangulo from '@/components/PortalCliente/MacroTriangulo'
import { listaRecordada } from '@/lib/useEstadoUrl'
import BarraRevision from '@/components/recetas/BarraRevision'
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
  tipo_receta?: string | null
  intolerancias?: string[]
  coach_id?: string
  created_at: string
}

interface IngredienteConAlimento {
  id: string
  receta_id: string
  alimento_id?: string | null
  nombre_libre?: string | null
  elaboracion_id?: string | null
  cantidad_gramos: number
  cantidad_original?: number | null
  unidad_display?: string | null
  orden?: number
  grupo?: string | null
  es_opcional?: boolean | null
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
  const [ingredientes, setIngredientes] = useState<IngredienteConAlimento[]>([])
  // Elaboraciones enlazadas: kcal por 100 g para cada línea, y (si esta receta es una elaboración) dónde se usa
  const [kcalElaboracion, setKcalElaboracion] = useState<Record<string, number>>({})
  const [seUsaEn, setSeUsaEn] = useState<{ id: string; nombre: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [borrando, setBorrando] = useState(false)
  const [accionando, setAccionando] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [racionesVista, setRacionesVista] = useState<number | null>(null)
  const [seccion, setSeccion] = useState<'ingredientes' | 'preparacion'>('ingredientes')
  const [quality, setQuality] = useState<RecetaQuality | null>(null)
  const [calidadAbierta, setCalidadAbierta] = useState(false)
  const [fotoAmpliada, setFotoAmpliada] = useState(false)
  useEffect(() => {
    if (!fotoAmpliada) return
    const cerrar = (e: KeyboardEvent) => { if (e.key === 'Escape') setFotoAmpliada(false) }
    window.addEventListener('keydown', cerrar)
    return () => window.removeEventListener('keydown', cerrar)
  }, [fotoAmpliada])

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
      const idsElab = [...new Set((ingRes.data ?? []).map((i: IngredienteConAlimento) => i.elaboracion_id).filter(Boolean))] as string[]
      if (idsElab.length > 0) {
        fetch(`/api/recetas/elaboraciones?ids=${idsElab.join(',')}`).then(r => r.ok ? r.json() : null).then(j => {
          if (j?.elaboraciones) setKcalElaboracion(Object.fromEntries(j.elaboraciones.map((e: { id: string; kcal100: number }) => [e.id, e.kcal100])))
        }).catch(() => {})
      }
      if (recetaRes.data?.tipo_receta === 'salsa_base') {
        const { data: usos } = await supabase.from('receta_ingredientes').select('receta:recetas!receta_ingredientes_receta_id_fkey(id, nombre)').eq('elaboracion_id', id)
        const unicas = new Map<string, string>()
        for (const u of (usos ?? []) as unknown as { receta: { id: string; nombre: string } | { id: string; nombre: string }[] | null }[]) {
          const r = Array.isArray(u.receta) ? u.receta[0] : u.receta
          if (r) unicas.set(r.id, r.nombre)
        }
        setSeUsaEn([...unicas].map(([rid, nombre]) => ({ id: rid, nombre })))
      }
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
    const { error } = await supabase.from('recetas').delete().eq('id', id)
    if (error) {
      setBorrando(false)
      // 23503: otra receta la lleva como ingrediente (elaboración en uso)
      alert(error.code === '23503'
        ? 'Esta elaboración se usa en otras recetas: quítala de ellas primero.'
        : 'No se pudo borrar la receta.')
      return
    }
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
    opcional: Boolean(ing.es_opcional),
    nombre: ing.es_opcional ? (ing.nombre_libre ?? ing.alimento?.nombre ?? 'Ingrediente') : (ing.alimento?.nombre ?? ing.nombre_libre ?? 'Ingrediente'),
    cantidad: formatoCantidad(ing.cantidad_gramos, factorVista, ing.cantidad_original, ing.unidad_display, ing.alimento?.nombre ?? ing.nombre_libre),
    kcal: ing.alimento ? Math.round(calcularMacrosPorCantidad(
      ing.alimento.calorias, ing.alimento.proteinas, ing.alimento.carbohidratos, ing.alimento.grasas, ing.alimento.fibra ?? 0, ing.cantidad_gramos
    ).calorias * factorVista) : (ing.elaboracion_id && kcalElaboracion[ing.elaboracion_id] !== undefined
      ? Math.round(kcalElaboracion[ing.elaboracion_id] * ing.cantidad_gramos / 100 * factorVista) : undefined),
    href: ing.elaboracion_id ? `/recetas/${ing.elaboracion_id}?returnTo=${encodeURIComponent(`/recetas/${id}`)}` : undefined,
  })), parsePasos(r.instrucciones ?? receta.instrucciones))

  // Pasos para StepByStep: si se cambian las raciones, las cantidades escritas en los pasos ya no valen
  const pasos = parsePasos(r.instrucciones ?? receta.instrucciones).map(p =>
    nVista !== porcionesReceta ? { ...p, content: quitarCifras(p.content), title: p.title ? quitarCifras(p.title) : p.title } : p)

  const SORA_TITULO = 'var(--font-sora), var(--font-instrument), sans-serif'
  const bloqueMacros = (
    <>
        {/* ═══════ MACRO RING + STATS ROW ═══════ */}
        <FadeIn delay={0.15}>
          <div
            className="mb-0 flex flex-col sm:flex-row lg:flex-col items-center lg:items-stretch gap-4"
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

            {/* Datos de la ración: mismo lenguaje que el triángulo (rótulos mono, cifras Sora ligera) */}
            <div className="w-full">
              <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-3 border-t pt-4" style={{ borderColor: 'var(--recipe-rule)' }}>
                {tiempoTotal > 0 && (
                  <>
                    <dt className="font-data text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Tiempo</dt>
                    <dd className="text-lg tabular-nums" style={{ color: 'var(--text)', fontFamily: SORA_TITULO, fontWeight: 300 }}>{tiempoTotal} min</dd>
                  </>
                )}
                {receta.porciones && (
                  <>
                    <dt className="font-data text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Raciones</dt>
                    <dd className="text-lg" style={{ color: 'var(--text)', fontFamily: SORA_TITULO, fontWeight: 300 }}>
                      {receta.descripcion_porcion
                        ? (receta.porciones > 1 ? `${receta.porciones} · ${receta.descripcion_porcion}` : receta.descripcion_porcion)
                        : `${receta.porciones} ${receta.porciones === 1 ? 'ración' : 'raciones'}`}
                      {pesoPorPorcion && !receta.descripcion_porcion && (
                        <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>≈ {pesoPorPorcion} g</span>
                      )}
                    </dd>
                  </>
                )}
                {macrosPor100g && (
                  <>
                    <dt className="font-data text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Por 100 g</dt>
                    <dd className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-base tabular-nums" style={{ color: 'var(--text)', fontFamily: SORA_TITULO, fontWeight: 300 }}>
                      <span>{macrosPor100g.kcal}<span className="font-data ml-1 text-[10px] tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>KCAL</span></span>
                      <span>{macrosPor100g.proteinas}<span className="font-data ml-1 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>P</span></span>
                      <span>{macrosPor100g.carbohidratos}<span className="font-data ml-1 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>C</span></span>
                      <span>{macrosPor100g.grasas}<span className="font-data ml-1 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>G</span></span>
                    </dd>
                  </>
                )}
              </dl>

              {/* Fuente */}
              {r.url_origen && /^https?:/.test(r.url_origen) && (
                <a href={r.url_origen} target="_blank" rel="noopener noreferrer"
                  className="font-data mt-4 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] hover:underline" style={{ color: 'var(--text-muted)' }}>
                  {/instagram\.com|tiktok\.com|youtube\.com|youtu\.be/.test(r.url_origen) ? <><PlayCircle size={13} /> Vídeo original</> : <><ArrowSquareOut size={12} /> Fuente original</>}
                </a>
              )}
            </div>
          </div>
        </FadeIn>

    </>
  )

  // Etiquetas en el mismo lenguaje que la tarjeta de macros: rótulo mono + valor en texto, sin cajas
  const { aptaPara, contiene } = intolerancias.length > 0 ? resumenAptitud(intolerancias) : { aptaPara: [] as string[], contiene: [] as string[] }
  const datosReceta = ([['Plato', receta.categoria], ['Cocción', receta.tipo_coccion], ['Dificultad', receta.dificultad]] as const).filter(([, v]) => Boolean(v)) as unknown as [string, string][]
  const rotuloEt = 'font-data text-[10px] font-medium uppercase tracking-[0.14em]'
  const punto = (color: string) => <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: color }} aria-hidden />
  const filaEt = 'grid flex-1 grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-4 py-2.5'
  const lineaEt = { borderColor: 'var(--recipe-rule, var(--border))' }
  const bloqueEtiquetas = (datosReceta.length > 0 || aptaPara.length > 0 || contiene.length > 0) ? (
    <dl className="flex h-full min-h-[10rem] flex-col divide-y text-[0.95rem]" style={{ color: 'var(--text-secondary)', ...lineaEt }}>
      {datosReceta.map(([etiqueta, valor]) => (
        <div key={etiqueta} className={filaEt} style={lineaEt}>
          <dt className={rotuloEt} style={{ color: 'var(--text-muted)' }}>{etiqueta}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
      {aptaPara.length > 0 && (
        <div className={filaEt} style={lineaEt}>
          <dt className={rotuloEt} style={{ color: 'var(--text-muted)' }}>Apta para</dt>
          <dd className="flex flex-wrap gap-x-5 gap-y-1">{aptaPara.map(t => <span key={t}>{punto('rgb(34,197,94)')}{t}</span>)}</dd>
        </div>
      )}
      {contiene.length > 0 && (
        <div className={filaEt} style={lineaEt}>
          <dt className={rotuloEt} style={{ color: 'var(--text-muted)' }}>Contiene</dt>
          <dd className="flex flex-wrap gap-x-5 gap-y-1">{contiene.map(t => <span key={t}>{punto('rgb(239,68,68)')}{t}</span>)}</dd>
        </div>
      )}
    </dl>
  ) : null

  const fotoReceta = receta.imagen_url ? (
    <button type="button" onClick={() => setFotoAmpliada(true)} aria-label="Ampliar foto"
      className="group relative block aspect-square w-full max-w-[26rem] cursor-zoom-in overflow-hidden rounded-2xl lg:max-w-none" style={{ border: '1px solid var(--border)' }}>
      <img
        src={receta.imagen_url}
        alt={receta.nombre}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setImgLoaded(true)}
      />
      {!imgLoaded && <div className="absolute inset-0 skeleton" />}
      <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', color: '#fff' }} aria-hidden>
        <MagnifyingGlassPlus size={18} />
      </span>
    </button>
  ) : null

  return (
    <PageTransition className="coach-recipe-detail">
      {/* ═══════ CONTENIDO PRINCIPAL ═══════ */}
      <div className={`coach-recipe-detail__content mx-auto px-6 relative z-20 pb-safe${enBandeja ? ' pb-28' : ''}`}>
        {/* Navegación mínima: volver, editar y borrar */}
        <div className="flex items-center gap-2 pb-5 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)]">
          <Link
            href={returnTo}
            className={`flex items-center justify-center rounded-lg border transition-colors duration-200 hover:bg-[var(--surface-hover)] ${isClientView ? 'h-11 px-3 gap-1.5 text-sm font-semibold' : 'h-9 w-9'}`}
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            aria-label={isClientView ? 'Volver al plan' : 'Volver al recetario'}
          >
            <ArrowLeft size={18} />
            {isClientView && <span>Volver</span>}
          </Link>
          <div className="flex-1" />
          {!isClientView && (
            <>
              <Link
                href={`/recetas/${id}/editar?returnTo=${encodeURIComponent(returnTo)}`}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-200 hover:bg-[var(--surface-hover)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                <PencilSimple size={14} /> Editar
              </Link>
              <button onClick={borrar} disabled={borrando}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-200 hover:bg-[var(--surface-hover)]"
                style={{ borderColor: 'var(--border)', color: 'var(--error)' }}
              >
                <Trash size={14} /> {borrando ? '…' : 'Borrar'}
              </button>
            </>
          )}
        </div>

        {/* Aviso discreto solo si hay bloqueos reales de calidad */}
        {!isClientView && quality && quality.issues.some(i => i.severity === 'bloqueante') && (
          <button type="button"
            onClick={() => { setCalidadAbierta(true); setTimeout(() => document.getElementById('control-calidad')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }}
            className="mb-4 flex w-full items-center gap-2 rounded-lg border px-4 py-2 text-left text-sm"
            style={{ borderColor: 'var(--warning)', color: 'var(--warning)', background: 'var(--warning-bg)' }}>
            {quality.issues.filter(i => i.severity === 'bloqueante').length} problema(s) de calidad por revisar
            <span className="ml-auto underline">Ver</span>
          </button>
        )}

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

        <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="min-w-0 lg:col-span-2">
        {/* ═══════ TÍTULO + META ═══════ */}
        <FadeIn delay={0.1}>
          <div className="coach-recipe-detail__intro mb-4" style={{ padding: '1.25rem' }}>
            {/* Título arriba, a todo el ancho */}
            <div className="mb-6 max-w-5xl">
              <h1 className="coach-recipe-detail__title !text-[clamp(1.9rem,3.2vw,3rem)] !font-light !leading-[1.1] !tracking-[-0.02em]" style={{ color: 'var(--text)', fontFamily: 'var(--font-sora), var(--font-instrument), sans-serif' }}>{receta.nombre}</h1>
            </div>
            <div className={`grid gap-6 ${receta.imagen_url ? 'sm:grid-cols-[15rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)_26rem] xl:grid-cols-[22rem_minmax(0,1fr)_31rem] lg:items-stretch' : 'lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_31rem]'}`}>
              {fotoReceta}
              <div className="min-w-0 lg:py-2">{bloqueEtiquetas}</div>
              <div className="min-w-0 sm:col-span-2 lg:col-span-1 lg:border-l lg:pl-8" style={{ borderColor: 'var(--recipe-rule)' }}>{bloqueMacros}</div>
            </div>
          </div>
        </FadeIn>

          </div>

          {/* Columna principal: la receta en sí */}
          <div className="min-w-0 lg:col-span-2">
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

        {ingredientes.length > 0 && (
          <div className="mb-4">
            <SelectorRaciones original={porcionesReceta} valor={nVista} onChange={setRacionesVista} kcalRacion={macrosPorPorcion?.kcal} />
          </div>
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
              <div
                className="coach-recipe-detail__section p-5 mb-6"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <IngredientChecklist ingredientes={checklistItems} sinCabecera={pasos.length > 0} />
                {seUsaEn.length > 0 && (
                  <p className="text-[11px] mt-4" style={{ color: 'var(--text-muted)' }}>
                    <span className="uppercase tracking-[0.14em]" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Se usa en</span>{' '}
                    {seUsaEn.map((u, i) => (
                      <span key={u.id}>{i > 0 && ' · '}<Link href={`/recetas/${u.id}`} className="underline decoration-dotted underline-offset-4">{u.nombre}</Link></span>
                    ))}
                  </p>
                )}
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
              {receta.descripcion && (
                <p className="mx-auto mb-5 max-w-xl text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{receta.descripcion}</p>
              )}
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
        </div>

        {!isClientView && receta.estado === 'aprobada' && receta.tipo_receta !== 'salsa_base' && <SalsasQueCombinan recetaId={id as string} />}

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

        {/* ═══════ CONTROL DE CALIDAD (plegado: es para revisar, no para el día a día) ═══════ */}
        {!isClientView && quality && (
          <FadeIn delay={0.45}>
            <section id="control-calidad" className="coach-recipe-detail__section mb-6 scroll-mt-24" aria-label="Control de calidad">
              <button type="button" onClick={() => setCalidadAbierta(v => !v)} aria-expanded={calidadAbierta}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left sm:p-5">
                <span className="coach-recipe-kicker">Control de calidad</span>
                <span className="inline-flex items-center gap-2 text-sm font-semibold capitalize" style={{ color: 'var(--text)' }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: quality.ok ? 'var(--success)' : 'var(--warning)' }} aria-hidden />
                  {quality.banda_calidad}
                  <span className="font-normal tabular-nums" style={{ color: 'var(--text-secondary)' }}>{quality.score_calidad}/100</span>
                </span>
                <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>{calidadAbierta ? 'Ocultar' : 'Ver detalle'}</span>
              </button>
              {calidadAbierta && (
                <div className="border-t p-4 sm:p-5" style={{ borderColor: 'var(--recipe-rule)' }}>
                  <p className="mb-4 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{quality.cobertura_pct}% de ingredientes con precio</p>
                  <ClasificacionEditor
                    recetaId={id}
                    clasificacion={quality.clasificacion}
                    manual={Boolean(quality.clasificacion_manual)}
                    onGuardado={(c, manual) => setQuality(q => (q ? { ...q, clasificacion: c, clasificacion_manual: manual } : q))}
                  />
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
                </div>
              )}
            </section>
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
      {fotoAmpliada && receta.imagen_url && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10" style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={() => setFotoAmpliada(false)} role="dialog" aria-modal="true" aria-label={receta.nombre}>
          <img src={receta.imagen_url} alt={receta.nombre} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" onClick={e => e.stopPropagation()} />
          <button type="button" onClick={() => setFotoAmpliada(false)} aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
            <X size={20} />
          </button>
        </div>
      )}
      {enBandeja && (
        <BarraRevision id={id} pendiente={receta.estado === 'en_revision' || receta.estado === 'borrador'} returnTo={returnTo} accion={handleEstado} />
      )}
    </PageTransition>
  )
}
