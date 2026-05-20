// components/dashboard/AutoCoachPanel.tsx
// ═══════════════════════════════════════════════════════════════
// AutoCoachPanel — Widget de recomendaciones proactivas IA.
// Muestra alertas de clientes agrupadas por urgencia,
// resumen IA generado por DeepSeek, y acceso rápido.
// ═══════════════════════════════════════════════════════════════

'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Warning,
  Bell,
  Sparkle,
  ArrowRight,
  Robot,
  CheckCircle,
  Clock,
  Bed,
  Lightning,
  Target,
  CalendarBlank,
  Smiley,
  TrendDown,
} from '@phosphor-icons/react'
import type { AutoCoachDashboard, RecomendacionAutoCoach, TipoRecomendacion, NivelUrgencia } from '@/types'

// ── Config iconos por tipo de recomendación ──

const TIPO_META: Record<TipoRecomendacion, { icon: React.ElementType; label: string }> = {
  ajuste_macros: { icon: Target, label: 'Ajuste macros' },
  alerta_adherencia: { icon: Warning, label: 'Adherencia baja' },
  alerta_peso_estancado: { icon: TrendDown, label: 'Peso estancado' },
  alerta_peso_rapido: { icon: TrendDown, label: 'Pérdida rápida' },
  alerta_sueno: { icon: Bed, label: 'Sueño bajo' },
  alerta_energia: { icon: Lightning, label: 'Energía baja' },
  checkin_recordatorio: { icon: Bell, label: 'Sin check-in' },
  feedback_positivo: { icon: Smiley, label: 'Buen progreso' },
  revision_plan: { icon: CalendarBlank, label: 'Revisión plan' },
  sin_actividad_portal: { icon: Clock, label: 'Sin actividad' },
  sin_entreno: { icon: Lightning, label: 'Sin entreno' },
  periodizacion_ajuste: { icon: TrendDown, label: 'Periodización' },
}

const URGENCIA_COLOR: Record<NivelUrgencia, string> = {
  critica: 'var(--error)',
  alta: '#FF9F0A',
  media: 'var(--accent)',
  baja: 'var(--success)',
}

const URGENCIA_BG: Record<NivelUrgencia, string> = {
  critica: 'var(--error-bg)',
  alta: 'rgba(255,159,10,0.1)',
  media: 'var(--accent-bg)',
  baja: 'rgba(48,209,88,0.08)',
}

// ── Badge de urgencia ──

function BadgeUrgencia({ urgencia }: { urgencia: NivelUrgencia }) {
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{
        background: URGENCIA_BG[urgencia],
        color: URGENCIA_COLOR[urgencia],
      }}
    >
      {urgencia === 'critica' ? 'CRÍTICA' : urgencia.toUpperCase()}
    </span>
  )
}

// ── Card de recomendación individual ──

function RecomendacionCard({ rec }: { rec: RecomendacionAutoCoach }) {
  const meta = TIPO_META[rec.tipo] ?? { icon: Warning, label: rec.tipo }
  const Icon = meta.icon
  const color = URGENCIA_COLOR[rec.urgencia]

  return (
    <Link
      href={`/clientes/${rec.cliente_id}`}
      className="flex items-start gap-3 p-3 rounded-xl transition-all duration-150 active:scale-[0.98]"
      style={{ background: 'var(--surface-hover)' }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: URGENCIA_BG[rec.urgencia] }}
      >
        <Icon size={15} weight="fill" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>
            {rec.cliente_nombre}
          </span>
          <BadgeUrgencia urgencia={rec.urgencia} />
        </div>
        <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text)' }}>
          {rec.titulo}
        </p>
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {rec.sugerencia_accion}
        </p>
      </div>
      <ArrowRight size={12} className="flex-shrink-0 mt-2" style={{ color: 'var(--text-muted)' }} />
    </Link>
  )
}

// ── Componente principal ──

export default function AutoCoachPanel() {
  const [data, setData] = useState<AutoCoachDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(5)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/auto-coach/analizar')
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (e) {
        console.error('[AutoCoachPanel] Error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Ordenar recomendaciones por urgencia ──
  const ordenUrgencia: NivelUrgencia[] = ['critica', 'alta', 'media', 'baja']

  const recomendaciones = data
    ? [...data.analisis]
      .flatMap(a => a.recomendaciones)
      .sort((a, b) => ordenUrgencia.indexOf(a.urgencia) - ordenUrgencia.indexOf(b.urgencia))
    : []

  const visibles = recomendaciones.slice(0, visible)
  const resto = recomendaciones.length - visible

  if (loading) {
    return (
      <div className="card-glass mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Robot size={16} weight="fill" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>AutoCoach IA</h2>
        </div>
        <div className="space-y-3">
          <div className="skeleton h-16 w-full rounded-xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  // No mostrar si no hay datos o no hay recomendaciones
  if (!data || recomendaciones.length === 0) return null

  const totalCriticas = recomendaciones.filter(r => r.urgencia === 'critica').length
  const totalAltas = recomendaciones.filter(r => r.urgencia === 'alta').length

  return (
    <div className="card-glass mb-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Robot size={16} weight="fill" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>AutoCoach IA</h2>
          {totalCriticas > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--error-bg)', color: 'var(--error)' }}
            >
              {totalCriticas} críticas
            </span>
          )}
          {totalAltas > 0 && totalCriticas === 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,159,10,0.15)', color: '#FF9F0A' }}
            >
              {totalAltas} urgentes
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {recomendaciones.length} recomendaciones
        </span>
      </div>

      {/* ── Resumen IA ── */}
      {data.resumen_ia && (
        <div
          className="p-3 rounded-xl mb-3 flex items-start gap-2.5"
          style={{ background: 'var(--accent-bg)' }}
        >
          <Sparkle size={14} weight="fill" style={{ color: 'var(--accent)' }} className="mt-0.5 flex-shrink-0" />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {data.resumen_ia}
          </p>
        </div>
      )}

      {/* ── Recomendaciones ── */}
      <div className="space-y-2">
        {visibles.map((rec, i) => (
          <RecomendacionCard key={`${rec.cliente_id}-${rec.tipo}-${i}`} rec={rec} />
        ))}
      </div>

      {/* ── Ver más ── */}
      {resto > 0 && (
        <button
          onClick={() => setVisible(prev => prev + 5)}
          className="w-full text-center text-xs py-2 rounded-xl mt-2 transition-all duration-150 active:scale-95"
          style={{ color: 'var(--text-muted)', background: 'var(--surface-hover)' }}
        >
          +{resto} más
        </button>
      )}
    </div>
  )
}
