'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ElementType, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { PlanNutricion, Alimento } from '@/types'

export type ResultadoBusqueda = Alimento & { imagen?: string; _fuente?: string }

export interface RecetaConIngredientes {
  id: string
  nombre: string
  categoria: string | null
  imagen_url: string | null
  porciones: number
  ingredientes: {
    alimento_id: string | null
    nombre_libre: string | null
    cantidad_gramos: number
    alimento?: Alimento | null
  }[]
}

export interface AlimentoEnComida {
  id: string
  cantidad_gramos: number
  alimento: Alimento
}

export interface RecetaAsignada {
  id: string
  nombre: string
  imagen_url: string | null
  kcal: number
  proteinas: number
  carbohidratos: number
  grasas: number
  tiempo_prep_min: number | null
}

export interface ComidaLocal {
  id: string
  nombre: string
  orden: number
  hora_sugerida: string
  dia_semana?: string | null
  receta_id?: string | null
  kcal_target?: number | null
  proteinas_target?: number | null
  carbos_target?: number | null
  grasas_target?: number | null
  alternativas_receta_ids?: string[] | null
  receta?: RecetaAsignada | null
  alimentos: AlimentoEnComida[]
  expandida: boolean
}

export type RecetaEquivalente = RecetaAsignada & {
  tipo_plato?: string | null
}

export type Fuente = 'local' | 'off' | 'recetas'
export type MacroPct = { proteinas: number; carbohidratos: number; grasas: number }

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
export const DIA_DEFAULT = DIAS_SEMANA[0]
export const DIA_ABR: Record<string, string> = {
  Lunes: 'L',
  Martes: 'M',
  Miércoles: 'X',
  Jueves: 'J',
  Viernes: 'V',
  Sábado: 'S',
  Domingo: 'D',
}

export function diaComida(comida: Pick<ComidaLocal, 'dia_semana'>) {
  return comida.dia_semana || DIA_DEFAULT
}

export function macroStatus(value: number, target?: number | null) {
  const t = Number(target ?? 0)
  if (t <= 0) return { pct: 0, delta: 0, label: 'sin objetivo', tone: 'neutral' as const }
  const delta = Math.round(value - t)
  const pct = Math.round((value / t) * 100)
  const abs = Math.abs(delta)
  const unit = t > 999 ? 'kcal' : 'g'
  const tolerance = Math.max(5, t * 0.05)
  return {
    pct,
    delta,
    label: abs <= tolerance ? 'en rango' : `${abs}${unit} ${delta > 0 ? 'sobre' : 'faltan'}`,
    tone: abs <= tolerance ? 'ok' as const : delta > 0 ? 'over' as const : 'under' as const,
  }
}

export type AuditSeverity = 'critico' | 'aviso' | 'ok'
export type AuditIssue = {
  id: string
  severity: AuditSeverity
  title: string
  detail: string
  scope: string
}

export function auditTone(severity: AuditSeverity) {
  if (severity === 'critico') return { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.22)', text: '#EF4444' }
  if (severity === 'aviso') return { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.24)', text: '#D97706' }
  return { bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.22)', text: '#10B981' }
}

export function scoreAuditoria(issues: AuditIssue[]) {
  if (issues.some(issue => issue.id.endsWith('-empty'))) return 0
  return Math.max(0, 100 - issues.reduce((acc, issue) => acc + (issue.severity === 'critico' ? 18 : issue.severity === 'aviso' ? 8 : 0), 0))
}

export function rangoMacro(value: number, target?: number | null, tolerancePct = 0.08) {
  const t = Number(target ?? 0)
  if (t <= 0) return null
  const delta = value - t
  const pct = delta / t
  if (Math.abs(pct) <= tolerancePct) return null
  return { delta, pct }
}

export function MacroDial({ label, value, target, color, icon: Icon, unit }: {
  label: string
  value: number
  target?: number | null
  color: string
  icon: ElementType
  unit: 'kcal' | 'g'
}) {
  const s = macroStatus(value, target)
  const pctCapped = Math.min(Math.max(s.pct, 0), 125)
  const barWidth = Math.min(pctCapped, 100)
  const toneColor = s.tone === 'ok' ? '#10B981' : s.tone === 'over' ? '#F59E0B' : s.tone === 'under' ? '#64748B' : 'var(--text-muted)'
  return (
    <div className="rounded-2xl p-3" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon size={14} style={{ color }} />
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{label}</span>
        </div>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: toneColor }}>{s.pct || '—'}%</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>{Math.round(value)}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{unit}</span>
        {target ? <span className="text-xs ml-auto tabular-nums" style={{ color: 'var(--text-muted)' }}>/ {Math.round(target)}</span> : null}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, background: color }} />
      </div>
      <p className="text-[11px] mt-1.5 truncate" style={{ color: toneColor }}>{s.label}</p>
    </div>
  )
}

export function macroPctFromPlan(plan: PlanNutricion | null) {
  const kcal = Number(plan?.kcal_objetivo ?? 0)
  if (kcal <= 0) return { proteinas: 30, carbohidratos: 40, grasas: 30 }
  return normalizeMacroPct({
    proteinas: Math.round(((Number(plan?.proteinas_objetivo ?? 0) * 4) / kcal) * 100) || 30,
    carbohidratos: Math.round(((Number(plan?.carbohidratos_objetivo ?? 0) * 4) / kcal) * 100) || 40,
    grasas: Math.round(((Number(plan?.grasas_objetivo ?? 0) * 9) / kcal) * 100) || 30,
  })
}

export function gramsFromPct(kcal: number, pct: number, kcalPerGram: 4 | 9) {
  return Math.round(((kcal * pct) / 100 / kcalPerGram) * 10) / 10
}

export function normalizeMacroPct(input: MacroPct): MacroPct {
  const next = {
    proteinas: Math.max(10, Math.round(input.proteinas || 0)),
    carbohidratos: Math.max(15, Math.round(input.carbohidratos || 0)),
    grasas: Math.max(15, Math.round(input.grasas || 0)),
  }
  const diff = 100 - (next.proteinas + next.carbohidratos + next.grasas)
  next.carbohidratos = Math.max(15, next.carbohidratos + diff)

  if (next.carbohidratos < 15) {
    const deficit = 15 - next.carbohidratos
    next.carbohidratos = 15
    next.grasas = Math.max(15, next.grasas - deficit)
  }

  const total = next.proteinas + next.carbohidratos + next.grasas
  if (total !== 100) next.grasas += 100 - total
  return next
}

export function MacroDistributionBar({
  value,
  onChange,
  kcal,
  disabled = false,
}: {
  value: MacroPct
  onChange: (next: MacroPct) => void
  kcal: number
  disabled?: boolean
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<'proteinas' | 'grasas' | null>(null)
  const total = value.proteinas + value.carbohidratos + value.grasas
  const proteinasEnd = value.proteinas
  const carbosEnd = value.proteinas + value.carbohidratos

  function pctFromPointer(clientX: number) {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.round(((clientX - rect.left) / rect.width) * 100)
  }

  const updateBoundary = useCallback((boundary: 'proteinas' | 'grasas', rawPct: number) => {
    if (disabled) return

    if (boundary === 'proteinas') {
      const min = 10
      const max = 100 - value.grasas - 15
      const proteinas = Math.min(Math.max(rawPct, min), max)
      onChange(normalizeMacroPct({
        proteinas,
        carbohidratos: 100 - proteinas - value.grasas,
        grasas: value.grasas,
      }))
      return
    }

    const minBoundary = value.proteinas + 15
    const maxBoundary = 100 - 15
    const boundaryPct = Math.min(Math.max(rawPct, minBoundary), maxBoundary)
    onChange(normalizeMacroPct({
      proteinas: value.proteinas,
      carbohidratos: boundaryPct - value.proteinas,
      grasas: 100 - boundaryPct,
    }))
  }, [disabled, onChange, value])

  useEffect(() => {
    if (!dragging) return
    const activeBoundary = dragging

    function onPointerMove(event: PointerEvent) {
      updateBoundary(activeBoundary, pctFromPointer(event.clientX))
    }

    function onPointerUp() {
      setDragging(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragging, updateBoundary])

  function onBarPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return
    const rawPct = pctFromPointer(event.clientX)
    const nearest = Math.abs(rawPct - proteinasEnd) <= Math.abs(rawPct - carbosEnd) ? 'proteinas' : 'grasas'
    setDragging(nearest)
    updateBoundary(nearest, rawPct)
  }

  const macros = [
    { key: 'proteinas' as const, label: 'Proteína', short: 'P', color: '#FF3B30', kcalPerGram: 4 as const },
    { key: 'carbohidratos' as const, label: 'Carbohidratos', short: 'C', color: '#FF9500', kcalPerGram: 4 as const },
    { key: 'grasas' as const, label: 'Grasas', short: 'G', color: '#0A84FF', kcalPerGram: 9 as const },
  ]

  return (
    <div className="space-y-3">
      <div
        ref={barRef}
        role="group"
        aria-label="Distribución editable de macros objetivo"
        onPointerDown={onBarPointerDown}
        className={`relative h-9 overflow-hidden rounded-full border select-none ${disabled ? 'opacity-60' : 'cursor-ew-resize'}`}
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface)',
          touchAction: 'none',
        }}
      >
        <div className="flex h-full w-full">
          <div className="h-full transition-[width]" style={{ width: `${value.proteinas}%`, background: '#FF3B30' }} />
          <div className="h-full transition-[width]" style={{ width: `${value.carbohidratos}%`, background: '#FF9500' }} />
          <div className="h-full transition-[width]" style={{ width: `${value.grasas}%`, background: '#0A84FF' }} />
        </div>
        {[
          { key: 'proteinas' as const, left: proteinasEnd, label: 'Ajustar proteína y carbohidratos' },
          { key: 'grasas' as const, left: carbosEnd, label: 'Ajustar carbohidratos y grasas' },
        ].map(handle => (
          <button
            key={handle.key}
            type="button"
            aria-label={handle.label}
            disabled={disabled}
            onPointerDown={event => {
              event.stopPropagation()
              setDragging(handle.key)
              updateBoundary(handle.key, pctFromPointer(event.clientX))
            }}
            className="absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-transform active:scale-95 disabled:cursor-not-allowed"
            style={{
              left: `${handle.left}%`,
              borderColor: 'rgba(255,255,255,0.85)',
              background: 'color-mix(in srgb, var(--surface) 88%, white)',
              boxShadow: '0 8px 24px rgba(15,23,42,0.18), inset 0 0 0 1px rgba(15,23,42,0.08)',
            }}
          >
            <span className="mx-auto block h-3.5 w-0.5 rounded-full" style={{ background: 'var(--text-muted)' }} />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {macros.map(item => (
          <div key={item.key} className="rounded-xl px-3 py-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold" style={{ color: item.color }}>{item.label}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text)' }}>{value[item.key]}%</span>
            </div>
            <p className="mt-1 text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {item.short} {gramsFromPct(kcal, value[item.key], item.kcalPerGram)}g objetivo
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        <span>Total {total}%</span>
        <span>Arrastra los cortes blancos para redistribuir sin romper el 100%.</span>
      </div>
    </div>
  )
}

export function CollapsibleModule({
  title,
  eyebrow,
  meta,
  defaultOpen = true,
  lazy = false,
  children,
}: {
  title: string
  eyebrow: string
  meta?: ReactNode
  defaultOpen?: boolean
  /** Monta el contenido solo la primera vez que se abre el módulo. */
  lazy?: boolean
  children: ReactNode
}) {
  const [visto, setVisto] = useState(defaultOpen || !lazy)
  return (
    <details
      open={defaultOpen}
      onToggle={e => { if (e.currentTarget.open) setVisto(true) }}
      className="coach-diet-module group mb-6 overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5 active:scale-[0.995]">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{eyebrow}</p>
          <h2 className="text-lg sm:text-xl font-bold truncate" style={{ color: 'var(--text)' }}>{title}</h2>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {meta}
          <ChevronDown size={18} className="transition-transform group-open:rotate-180" style={{ color: 'var(--text-muted)' }} />
        </div>
      </summary>
      <div className="px-4 sm:px-5 pb-4 sm:pb-5">
        {visto && children}
      </div>
    </details>
  )
}
