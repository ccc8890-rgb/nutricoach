'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  ChefHat,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trophy,
  Utensils,
  X,
} from 'lucide-react'
import { RECETA_CHEF_COLECCIONES, RECETA_LABELS } from '@/lib/recetario-taxonomia'

type EstadoCobertura = 'cubierto' | 'medio' | 'bajo' | 'critico'

type CoverageItem = {
  clave: string
  actual: number
  minimo: number
  faltan: number
  estado: EstadoCobertura
}

type Recomendacion = {
  tipo: 'slot' | 'objetivo' | 'deporte' | 'manual'
  clave: string
  faltan: number
  cantidad?: number
  objetivo?: string
  deporte?: string
  momento?: string
  estilo?: string
  titulo?: string
  direccion?: string[]
}

type CoberturaResponse = {
  total: number
  premium_chef: number
  cobertura: {
    slots: CoverageItem[]
    objetivos: CoverageItem[]
    deportes: CoverageItem[]
  }
  conteos: {
    momentos: Record<string, number>
    objetivos: Record<string, number>
    deportes: Record<string, number>
    estilos: Record<string, number>
  }
  recomendacion: Recomendacion[]
}

const ESTADO_STYLE: Record<EstadoCobertura, { label: string; bg: string; color: string; border: string }> = {
  cubierto: {
    label: 'Cubierto',
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#059669',
    border: 'rgba(16, 185, 129, 0.28)',
  },
  medio: {
    label: 'Medio',
    bg: 'rgba(59, 130, 246, 0.12)',
    color: '#2563eb',
    border: 'rgba(59, 130, 246, 0.28)',
  },
  bajo: {
    label: 'Bajo',
    bg: 'rgba(245, 158, 11, 0.14)',
    color: '#d97706',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  critico: {
    label: 'Crítico',
    bg: 'rgba(239, 68, 68, 0.12)',
    color: '#dc2626',
    border: 'rgba(239, 68, 68, 0.28)',
  },
}

function label(clave: string) {
  return RECETA_LABELS[clave] ?? clave.replaceAll('_', ' ')
}

function pct(actual: number, minimo: number) {
  if (minimo <= 0) return 100
  return Math.min(100, Math.round((actual / minimo) * 100))
}

function buildRecipeBrief(item: Recomendacion) {
  const bloque = item.titulo ?? label(item.clave)
  const tipo = item.tipo === 'slot' ? 'momento de comida' : item.tipo
  const cantidad = item.cantidad ?? Math.min(Math.max(item.faltan, 8), 20)
  const direccionExtra = item.direccion?.length
    ? item.direccion.map(line => `- ${line}`).join('\n')
    : '- Crear recetas funcionales y versión chef healthy para cubrir adherencia, variedad y uso en planes IA.'

  return [
    `OBJETIVO: crear ${cantidad} recetas para cubrir el bloque "${bloque}" (${tipo}) en NutriCoach.`,
    '',
    'DIRECCION CULINARIA:',
    '- Recetas healthy atractivas, actuales y con personalidad de chef.',
    '- Evitar estética de dieta hospitalaria o platos secos/restrictivos.',
    '- Reinterpretar comida normal en versión funcional: bowls, tacos, woks, burgers, crepes, tostas, pasta, wraps, curry, poke, comfort food ligero.',
    '- Priorizar adherencia: ingredientes reconocibles, montaje apetecible, sabores claros y preparación realista.',
    direccionExtra,
    '',
    'REQUISITOS NUTRICIONALES:',
    '- Incluir kcal, proteína, carbohidratos, grasas, fibra y porción redondeada para cliente.',
    '- Cantidades visualmente usables: 30g, 50g, 75g, 100g, 125g, 150g, 200g. Evitar 27g o 107g salvo suplementos o alimentos muy concretos.',
    '- Añadir objetivo, deporte, momento, estilos, digestibilidad, coste estimado y si es apta para batch cooking/tupper.',
    '',
    'VARIEDAD DEL LOTE:',
    '- 40% funcional rápido.',
    '- 40% chef healthy de alta adherencia.',
    '- 20% batch cooking o tupper.',
    '- Incluir alternativas para perfiles: pérdida grasa, recomposición, rendimiento y salud general cuando aplique.',
    '',
    'OUTPUT:',
    '- JSON array.',
    '- Cada receta con nombre, descripción corta, ingredientes con gramos redondeados, elaboración, macros, tags y taxonomía NutriCoach.',
    '- Marcar como en_revision, nunca aprobada automáticamente.',
  ].join('\n')
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  detail: string
}) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>{value}</p>
        </div>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-hover)', color: 'var(--text)' }}>
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{detail}</p>
    </div>
  )
}

function CoverageRow({ item }: { item: CoverageItem }) {
  const style = ESTADO_STYLE[item.estado]
  const progress = pct(item.actual, item.minimo)

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{label(item.clave)}</p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {item.actual} de {item.minimo} recetas objetivo
          </p>
        </div>
        <span
          className="shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold"
          style={{ background: style.bg, borderColor: style.border, color: style.color }}
        >
          {style.label}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-hover)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progress}%`, background: style.color }}
        />
      </div>
      {item.faltan > 0 && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Faltan {item.faltan} para trabajar este bloque con margen.
        </p>
      )}
    </div>
  )
}

function CoveragePanel({
  title,
  subtitle,
  icon: Icon,
  items,
}: {
  title: string
  subtitle: string
  icon: React.ElementType
  items: CoverageItem[]
}) {
  const ordered = [...items].sort((a, b) => b.faltan - a.faltan || a.clave.localeCompare(b.clave))

  return (
    <section className="rounded-2xl border p-4 md:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-hover)', color: 'var(--text)' }}>
          <Icon size={19} />
        </div>
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {ordered.map(item => <CoverageRow key={item.clave} item={item} />)}
      </div>
    </section>
  )
}

function ProductionBrief({
  recomendacion,
  onSelect,
}: {
  recomendacion: Recomendacion[]
  onSelect: (item: Recomendacion) => void
}) {
  const top = recomendacion.slice(0, 6)

  return (
    <section className="rounded-2xl border p-4 md:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Cola de producción recomendada</h2>
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Bloques prioritarios para que el agente pueda crear semanas completas sin repetir ni forzar recetas.
          </p>
        </div>
        <Link
          href="/recetas/nueva"
          className="hidden sm:inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
          style={{ background: 'var(--text)', color: 'var(--bg)' }}
        >
          Crear receta
          <ArrowUpRight size={15} />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {top.map((item, idx) => (
          <div key={`${item.tipo}-${item.clave}`} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                  Prioridad {idx + 1} · {item.tipo === 'slot' ? 'momento' : item.tipo}
                </p>
                <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>{label(item.clave)}</p>
              </div>
              <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' }}>
                +{item.faltan}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Crear recetas funcionales y versión chef healthy para cubrir adherencia, variedad y uso en planes IA.
            </p>
            <button
              onClick={() => onSelect(item)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--surface)' }}
            >
              Preparar brief
              <ArrowUpRight size={13} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function ChefCollectionsPanel({ onSelect }: { onSelect: (item: Recomendacion) => void }) {
  return (
    <section className="rounded-2xl border p-4 md:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Líneas chef healthy</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Colecciones pensadas para diferenciar el recetario: platos atractivos, realistas y útiles para que la IA no genere dietas planas.
          </p>
        </div>
        <Link
          href="/recetas?curacion=chef"
          className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
          style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}
        >
          Ver chef healthy
          <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {RECETA_CHEF_COLECCIONES.map(collection => (
          <article
            key={collection.id}
            className="flex min-h-[220px] flex-col justify-between rounded-2xl border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                {collection.subtitulo}
              </p>
              <h3 className="mt-2 text-base font-semibold leading-tight" style={{ color: 'var(--text)' }}>
                {collection.titulo}
              </h3>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {collection.descripcion}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {collection.tags.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => onSelect({
                tipo: 'manual',
                clave: collection.bloque,
                faltan: collection.cantidad,
                cantidad: collection.cantidad,
                objetivo: collection.objetivo,
                deporte: collection.deporte,
                momento: collection.momento,
                estilo: collection.estilo,
                titulo: collection.titulo,
                direccion: collection.direccion,
              })}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-transform active:scale-[0.98]"
              style={{ background: 'var(--text)', color: 'var(--bg)' }}
            >
              Preparar línea
              <ArrowUpRight size={13} />
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

function BriefModal({
  item,
  onClose,
}: {
  item: Recomendacion
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedJson, setGeneratedJson] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const brief = buildRecipeBrief(item)

  async function copyBrief() {
    await navigator.clipboard.writeText(brief)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  async function generateWithDeepSeek() {
    const ok = window.confirm('Esto llamará a DeepSeek con un lote pequeño y coste limitado. No usa OpenAI y no insertará recetas automáticamente. ¿Continuar?')
    if (!ok) return

    setGenerating(true)
    setGenerationError(null)
    setGeneratedJson(null)

    try {
      const res = await fetch('/api/recetas/generar-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloque: item.clave,
          tipo: item.tipo,
          cantidad: item.cantidad ?? Math.min(Math.max(item.faltan, 4), 8),
          objetivo: item.objetivo ?? (item.tipo === 'objetivo' ? item.clave : undefined),
          deporte: item.deporte ?? (item.tipo === 'deporte' ? item.clave : undefined),
          momento: item.momento ?? (item.tipo === 'slot' ? item.clave : undefined),
          estilo: item.estilo ?? 'chef_healthy',
          confirmar: true,
          proveedor: 'deepseek',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo generar el lote')
      setGeneratedJson(JSON.stringify(json, null, 2))
    } catch (e) {
      setGenerationError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setGenerating(false)
    }
  }

  async function saveGeneratedRecipes() {
    if (!generatedJson) return
    const ok = window.confirm('Se guardarán las recetas generadas en la cola de revisión. No se aprobarán automáticamente. ¿Continuar?')
    if (!ok) return

    setSaving(true)
    setGenerationError(null)
    setSaveMessage(null)

    try {
      const parsed = JSON.parse(generatedJson)
      const res = await fetch('/api/recetas/importar-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recetas: parsed.recetas ?? [] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar el lote')
      setSaveMessage(`${json.total ?? 0} recetas guardadas en revisión.`)
    } catch (e) {
      setGenerationError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm sm:items-center">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-2xl border shadow-2xl" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-start justify-between gap-4 border-b p-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
              Brief de producción
            </p>
            <h3 className="mt-1 text-lg font-semibold" style={{ color: 'var(--text)' }}>{label(item.clave)}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border p-2"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            aria-label="Cerrar"
          >
            <X size={17} />
          </button>
        </div>
        <div className="max-h-[62vh] overflow-y-auto p-4">
          <textarea
            readOnly
            value={brief}
            className="min-h-[420px] w-full resize-none rounded-xl border p-4 font-mono text-xs leading-relaxed outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
          />
          {generationError && (
            <p className="mt-3 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
              {generationError}
            </p>
          )}
          {generatedJson && (
            <div className="mt-4">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Resultado DeepSeek para revisión</p>
                <button
                  onClick={saveGeneratedRecipes}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60"
                  style={{ background: 'var(--text)', color: 'var(--bg)' }}
                >
                  {saving ? 'Guardando...' : 'Guardar en revisión'}
                </button>
              </div>
              {saveMessage && (
                <p className="mb-2 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.08)', color: '#059669' }}>
                  {saveMessage}
                </p>
              )}
              <textarea
                readOnly
                value={generatedJson}
                className="min-h-[320px] w-full resize-none rounded-xl border p-4 font-mono text-xs leading-relaxed outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 border-t p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Preparado para generar recetas sin aprobarlas automáticamente.
          </p>
          <div className="flex gap-2">
            <Link
              href="/recetas/nueva"
              className="inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Crear manual
            </Link>
            <button
              onClick={copyBrief}
              className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold"
              style={{ background: 'var(--text)', color: 'var(--bg)' }}
            >
              {copied ? 'Copiado' : 'Copiar brief'}
            </button>
            <button
              onClick={generateWithDeepSeek}
              disabled={generating}
              className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ background: 'var(--accent)', color: '#ffffff' }}
            >
              {generating ? 'Generando...' : 'Generar DeepSeek'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CoberturaRecetarioPage() {
  const [data, setData] = useState<CoberturaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [briefItem, setBriefItem] = useState<Recomendacion | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/recetas/cobertura', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar la cobertura')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const estilosOrdenados = useMemo(() => {
    if (!data) return []
    return Object.entries(data.conteos.estilos).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [data])

  const coberturaMedia = useMemo(() => {
    if (!data) return 0
    const all = [...data.cobertura.slots, ...data.cobertura.objetivos, ...data.cobertura.deportes]
    if (!all.length) return 0
    return Math.round(all.reduce((acc, item) => acc + pct(item.actual, item.minimo), 0) / all.length)
  }, [data])

  if (loading) {
    return (
      <main className="min-h-screen layout-main p-4 md:p-6">
        <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center">
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin" size={18} />
            Calculando cobertura del recetario
          </div>
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="min-h-screen layout-main p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="mt-0.5 text-red-500" />
              <div>
                <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>No se pudo cargar la cobertura</h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
                <button
                  onClick={load}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <RefreshCw size={15} />
                  Reintentar
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen layout-main p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              <ChefHat size={16} />
              Recetario inteligente
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl" style={{ color: 'var(--text)' }}>
              Cobertura estratégica
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed md:text-base" style={{ color: 'var(--text-muted)' }}>
              Mapa de huecos para que el motor IA pueda construir dietas semanales con variedad real, adherencia y recetas healthy atractivas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--surface)' }}
            >
              <RefreshCw size={15} />
              Actualizar
            </button>
            <Link
              href="/recetas"
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--surface)' }}
            >
              <Search size={15} />
              Ver biblioteca
            </Link>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={BarChart3} label="Recetas aprobadas" value={data.total} detail="Base disponible para planes, swaps y agentes." />
          <StatCard icon={Sparkles} label="Chef healthy" value={data.premium_chef} detail="Recetas atractivas para adherencia y diferenciación." />
          <StatCard icon={Target} label="Cobertura media" value={`${coberturaMedia}%`} detail="Media de slots, objetivos y deportes frente al mínimo." />
          <StatCard icon={AlertTriangle} label="Gaps prioritarios" value={data.recomendacion.length} detail="Bloques que conviene rellenar primero." />
        </section>

        <ProductionBrief recomendacion={data.recomendacion} onSelect={setBriefItem} />

        <ChefCollectionsPanel onSelect={setBriefItem} />

        <div className="grid gap-5 xl:grid-cols-3">
          <CoveragePanel
            title="Momentos de comida"
            subtitle="Garantiza 4 comidas al día, swaps y semanas completas."
            icon={Utensils}
            items={data.cobertura.slots}
          />
          <CoveragePanel
            title="Objetivos"
            subtitle="Ajusta el recetario a recomposición, pérdida, rendimiento y salud."
            icon={Target}
            items={data.cobertura.objetivos}
          />
          <CoveragePanel
            title="Disciplinas"
            subtitle="Base para running, Hyrox, fuerza, ciclismo y triatlón."
            icon={Trophy}
            items={data.cobertura.deportes}
          />
        </div>

        <section className="rounded-2xl border p-4 md:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Estilos dominantes</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {estilosOrdenados.map(([clave, count]) => (
              <span
                key={clave}
                className="rounded-full border px-3 py-1.5 text-sm font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}
              >
                {label(clave)} · {count}
              </span>
            ))}
          </div>
        </section>
      </div>
      {briefItem && <BriefModal item={briefItem} onClose={() => setBriefItem(null)} />}
    </main>
  )
}
