'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Edit3,
  ExternalLink,
  Loader2,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react'
import type { EstadoTarea, FuenteCientifica, TipoTarea } from '@/lib/agentes/types'
import { crearDecisionSummary } from '@/lib/training/workspace'

const TRAINING_TYPES: TipoTarea[] = [
  'training_brain',
  'revision_semanal_entreno',
  'alerta_riesgo_entreno',
  'alerta_readiness',
  'ajuste_nutricion_carga',
]

const TYPE_LABEL: Partial<Record<TipoTarea, string>> = {
  training_brain: 'Training Brain',
  revision_semanal_entreno: 'Revisión semanal',
  alerta_riesgo_entreno: 'Riesgo entreno',
  alerta_readiness: 'Readiness',
  ajuste_nutricion_carga: 'Nutrición carga',
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; bg: string; color: string; border: string }> = {
  pendiente: {
    label: 'Pendiente',
    icon: AlertTriangle,
    bg: 'var(--semantic-warn-bg)',
    color: 'var(--semantic-warn)',
    border: 'var(--semantic-warn-border)',
  },
  modificado: {
    label: 'Editada',
    icon: Edit3,
    bg: 'var(--semantic-info-bg)',
    color: 'var(--semantic-info)',
    border: 'var(--semantic-info-border)',
  },
  aprobado: {
    label: 'Aprobada',
    icon: CheckCircle2,
    bg: 'var(--semantic-active-bg)',
    color: 'var(--semantic-active)',
    border: 'var(--semantic-active-border)',
  },
  rechazado: {
    label: 'Ignorada',
    icon: XCircle,
    bg: 'var(--semantic-alert-bg)',
    color: 'var(--semantic-alert)',
    border: 'var(--semantic-alert-border)',
  },
  aplicado: {
    label: 'Aplicada',
    icon: ClipboardCheck,
    bg: 'var(--semantic-active-bg)',
    color: 'var(--semantic-active)',
    border: 'var(--semantic-active-border)',
  },
}

interface ClienteJoin {
  id: string
  profiles?: { nombre?: string | null; apellidos?: string | null } | null
}

interface TareaInbox {
  id: string
  cliente_id: string | null
  tipo: TipoTarea
  estado: EstadoTarea
  prioridad: number
  propuesta: string | null
  razonamiento: string | null
  payload: {
    senales?: Array<{ tipo: string; descripcion: string }>
    logros?: string[]
    advertencias?: string[]
    ajustes_plan?: string[]
    protocolos_kb?: string[]
    mensaje_cliente?: string
    [key: string]: unknown
  } | null
  fuentes: FuenteCientifica[] | null
  created_at: string
  comentario_coach?: string | null
  clientes?: ClienteJoin | null
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diff < 1) return 'Ahora'
  if (diff < 60) return `${diff} min`
  if (diff < 1440) return `${Math.floor(diff / 60)}h`
  return `${Math.floor(diff / 1440)}d`
}

function nombreCliente(tarea: TareaInbox): string {
  const profile = tarea.clientes?.profiles
  const nombre = [profile?.nombre, profile?.apellidos].filter(Boolean).join(' ').trim()
  return nombre || 'Cliente sin nombre'
}

function priorityTone(priority: number) {
  if (priority <= 3) return { label: 'Alta', color: 'var(--semantic-alert)', bg: 'var(--semantic-alert-bg)', border: 'var(--semantic-alert-border)' }
  if (priority <= 6) return { label: 'Media', color: 'var(--semantic-warn)', bg: 'var(--semantic-warn-bg)', border: 'var(--semantic-warn-border)' }
  return { label: 'Baja', color: 'var(--text-muted)', bg: 'var(--surface)', border: 'var(--border)' }
}

function normalizeEstado(estado: EstadoTarea): keyof typeof STATUS_CONFIG {
  if (estado === 'en_revision') return 'pendiente'
  return estado in STATUS_CONFIG ? estado : 'pendiente'
}

export default function BrainIAPage() {
  const [tareas, setTareas] = useState<TareaInbox[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState<'todas' | 'pendiente' | 'aprobado' | 'rechazado' | 'modificado'>('pendiente')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [comment, setComment] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/agentes/tareas?limite=100')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error cargando recomendaciones')
      const rows = ((data.tareas ?? []) as TareaInbox[])
        .filter(t => TRAINING_TYPES.includes(t.tipo))
      setTareas(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando recomendaciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const stats = useMemo(() => ({
    pendientes: tareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_revision').length,
    aprobadas: tareas.filter(t => t.estado === 'aprobado' || t.estado === 'aplicado').length,
    ignoradas: tareas.filter(t => t.estado === 'rechazado').length,
    editadas: tareas.filter(t => t.estado === 'modificado').length,
  }), [tareas])

  const filtradas = useMemo(() => {
    return tareas.filter(t => {
      if (filtro === 'todas') return true
      if (filtro === 'pendiente') return t.estado === 'pendiente' || t.estado === 'en_revision'
      if (filtro === 'aprobado') return t.estado === 'aprobado' || t.estado === 'aplicado'
      return t.estado === filtro
    })
  }, [tareas, filtro])

  const selected = useMemo(() => (
    filtradas.find(t => t.id === selectedId) ?? filtradas[0] ?? null
  ), [filtradas, selectedId])

  async function decidir(tarea: TareaInbox, decision: 'aprobado' | 'rechazado' | 'modificado') {
    setSavingId(tarea.id)
    try {
      const res = await fetch('/api/agentes/tareas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tarea_id: tarea.id,
          decision,
          comentario_coach: comment || undefined,
          propuesta_final: decision === 'modificado' ? draft : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error actualizando tarea')
      setTareas(prev => prev.map(t => (
        t.id === tarea.id
          ? {
              ...t,
              estado: decision,
              propuesta: decision === 'modificado' ? draft : t.propuesta,
              comentario_coach: comment || t.comentario_coach,
            }
          : t
      )))
      setEditingId(null)
      setDraft('')
      setComment('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando tarea')
    } finally {
      setSavingId(null)
    }
  }

  function startEdit(tarea: TareaInbox) {
    setEditingId(tarea.id)
    setExpandedId(tarea.id)
    setDraft(tarea.propuesta ?? '')
    setComment(tarea.comentario_coach ?? '')
  }

  return (
    <div className="px-4 py-5 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-6">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] mb-2" style={{ color: 'var(--text-muted)' }}>
            Training OS 2.0
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-none" style={{ color: 'var(--text)' }}>
            AI Review Inbox
          </h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Recomendaciones de entrenamiento, carga y nutrición listas para revisar. La IA prepara; el coach decide.
          </p>
        </div>
        <Link href="/entrenos" className="btn-secondary inline-flex items-center gap-2 text-sm">
          <ExternalLink size={15} />
          Command Center
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-5">
        <StatCard label="Pendientes" value={stats.pendientes} tone="warning" onClick={() => setFiltro('pendiente')} />
        <StatCard label="Editadas" value={stats.editadas} tone="info" onClick={() => setFiltro('modificado')} />
        <StatCard label="Aprobadas" value={stats.aprobadas} tone="active" onClick={() => setFiltro('aprobado')} />
        <StatCard label="Ignoradas" value={stats.ignoradas} tone="alert" onClick={() => setFiltro('rechazado')} />
      </section>

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ['todas', 'Todas'],
          ['pendiente', 'Pendientes'],
          ['modificado', 'Editadas'],
          ['aprobado', 'Aprobadas'],
          ['rechazado', 'Ignoradas'],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFiltro(value as typeof filtro)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
            style={{
              background: filtro === value ? 'var(--accent)' : 'var(--surface)',
              color: filtro === value ? 'var(--bg)' : 'var(--text-secondary)',
              border: `1px solid ${filtro === value ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: 'var(--semantic-alert-bg)', border: '1px solid var(--semantic-alert-border)', color: 'var(--semantic-alert)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="glass-card py-16 px-6 text-center">
          <Brain size={38} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-semibold" style={{ color: 'var(--text)' }}>Sin recomendaciones en esta vista</p>
          <p className="text-sm mt-1 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
            Cuando los agentes detecten fatiga, baja adherencia, progreso o ajustes de carga aparecerán aquí para revisión.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {filtradas.map((tarea, index) => (
            <RecommendationCard
              key={tarea.id}
              tarea={tarea}
              index={index}
              selected={selected?.id === tarea.id}
              expanded={expandedId === tarea.id}
              editing={editingId === tarea.id}
              draft={draft}
              comment={comment}
              saving={savingId === tarea.id}
              onSelect={() => setSelectedId(tarea.id)}
              onToggle={() => {
                setSelectedId(tarea.id)
                setExpandedId(expandedId === tarea.id ? null : tarea.id)
              }}
              onApprove={() => decidir(tarea, 'aprobado')}
              onReject={() => decidir(tarea, 'rechazado')}
              onEdit={() => startEdit(tarea)}
              onSaveEdit={() => decidir(tarea, 'modificado')}
              onCancelEdit={() => {
                setEditingId(null)
                setDraft('')
                setComment('')
              }}
              onDraft={setDraft}
              onComment={setComment}
            />
          ))}
          </div>
          {selected && (
            <DecisionDetailPanel
              tarea={selected}
              saving={savingId === selected.id}
              onApprove={() => decidir(selected, 'aprobado')}
              onReject={() => decidir(selected, 'rechazado')}
              onEdit={() => startEdit(selected)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, tone, onClick }: {
  label: string
  value: number
  tone: 'warning' | 'info' | 'active' | 'alert'
  onClick: () => void
}) {
  const color = tone === 'warning'
    ? 'var(--semantic-warn)'
    : tone === 'info'
      ? 'var(--semantic-info)'
      : tone === 'active'
        ? 'var(--semantic-active)'
        : 'var(--semantic-alert)'
  return (
    <button
      onClick={onClick}
      className="rounded-2xl px-4 py-3 text-left transition-transform active:scale-[0.98]"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p className="text-2xl font-semibold leading-none" style={{ color }}>{value}</p>
      <p className="text-[11px] mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </button>
  )
}

function RecommendationCard(props: {
  tarea: TareaInbox
  index: number
  selected: boolean
  expanded: boolean
  editing: boolean
  draft: string
  comment: string
  saving: boolean
  onToggle: () => void
  onSelect: () => void
  onApprove: () => void
  onReject: () => void
  onEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDraft: (value: string) => void
  onComment: (value: string) => void
}) {
  const { tarea } = props
  const status = STATUS_CONFIG[normalizeEstado(tarea.estado)]
  const StatusIcon = status.icon
  const priority = priorityTone(tarea.prioridad)
  const payload = tarea.payload ?? {}
  const signals = payload.senales ?? []
  const ajustes = payload.ajustes_plan ?? []
  const advertencias = payload.advertencias ?? []
  const logros = payload.logros ?? []

  return (
    <article
      className="glass-card p-4"
      onClick={props.onSelect}
      style={{
        borderColor: props.selected ? priority.border : status.border,
        animation: `fadeIn 0.24s var(--ease-out-strong) ${Math.min(props.index, 8) * 35}ms both`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{nombreCliente(tarea)}</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--semantic-info-bg)', color: 'var(--semantic-info)', border: '1px solid var(--semantic-info-border)' }}>
              {TYPE_LABEL[tarea.tipo] ?? tarea.tipo}
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: priority.bg, color: priority.color, border: `1px solid ${priority.border}` }}>
              Prioridad {priority.label}
            </span>
          </div>
          <h2 className="text-base font-semibold leading-snug" style={{ color: 'var(--text)' }}>
            {tarea.propuesta || 'Recomendación sin texto'}
          </h2>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1"
          style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}
        >
          <StatusIcon size={12} />
          {status.label}
        </span>
      </div>

      {tarea.razonamiento && (
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {tarea.razonamiento}
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniSignal icon={ShieldAlert} label="Señales" value={signals.length} tone={signals.length ? 'warning' : 'neutral'} />
        <MiniSignal icon={Sparkles} label="Ajustes" value={ajustes.length} tone={ajustes.length ? 'info' : 'neutral'} />
        <MiniSignal icon={MessageSquareText} label="Evidencia" value={tarea.fuentes?.length ?? 0} tone={(tarea.fuentes?.length ?? 0) ? 'active' : 'neutral'} />
      </div>

      {props.editing && (
        <div className="mt-4 rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>Propuesta final</label>
          <textarea
            value={props.draft}
            onChange={e => props.onDraft(e.target.value)}
            className="input min-h-28 w-full resize-y"
            style={{ paddingTop: 10 }}
          />
          <label className="block text-xs font-semibold mt-3 mb-1" style={{ color: 'var(--text)' }}>Nota privada del coach</label>
          <textarea
            value={props.comment}
            onChange={e => props.onComment(e.target.value)}
            className="input min-h-20 w-full resize-y"
            style={{ paddingTop: 10 }}
            placeholder="Qué has cambiado y por qué..."
          />
          <div className="mt-3 flex gap-2">
            <button onClick={props.onSaveEdit} disabled={props.saving || !props.draft.trim()} className="btn-primary flex-1 text-sm">
              {props.saving ? 'Guardando...' : 'Guardar editada'}
            </button>
            <button onClick={props.onCancelEdit} disabled={props.saving} className="btn-secondary flex-1 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {props.expanded && !props.editing && (
        <div className="mt-4 space-y-3">
          {signals.length > 0 && (
            <InfoBlock title="Señales detectadas">
              {signals.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 rounded-full px-2 py-0.5 font-semibold" style={{ background: 'var(--semantic-warn-bg)', color: 'var(--semantic-warn)' }}>
                    {s.tipo.replaceAll('_', ' ')}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{s.descripcion}</span>
                </div>
              ))}
            </InfoBlock>
          )}
          {ajustes.length > 0 && (
            <InfoBlock title="Ajustes sugeridos">
              {ajustes.map((a, i) => <p key={i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>{a}</p>)}
            </InfoBlock>
          )}
          {advertencias.length > 0 && (
            <InfoBlock title="Advertencias">
              {advertencias.map((a, i) => <p key={i} className="text-xs" style={{ color: 'var(--semantic-alert)' }}>{a}</p>)}
            </InfoBlock>
          )}
          {logros.length > 0 && (
            <InfoBlock title="Logros">
              {logros.map((a, i) => <p key={i} className="text-xs" style={{ color: 'var(--semantic-active)' }}>{a}</p>)}
            </InfoBlock>
          )}
          {(tarea.fuentes?.length ?? 0) > 0 && (
            <InfoBlock title="Evidencia aplicada">
              {(tarea.fuentes ?? []).slice(0, 4).map((f, i) => (
                <p key={i} className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {f.autores ? `${f.autores} (${f.año})` : 'Fuente'}: {f.titulo}
                  {f.conclusión ? ` — ${f.conclusión}` : ''}
                </p>
              ))}
            </InfoBlock>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={(e) => { e.stopPropagation(); props.onToggle() }}
          className="inline-flex items-center gap-1 text-xs font-semibold"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronDown size={13} style={{ transform: props.expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }} />
          {props.expanded ? 'Ocultar detalle' : 'Ver detalle'}
        </button>

        {(tarea.estado === 'pendiente' || tarea.estado === 'en_revision' || tarea.estado === 'modificado') && (
          <div className="flex flex-wrap gap-2">
            <button onClick={(e) => { e.stopPropagation(); props.onEdit() }} disabled={props.saving} className="btn-secondary text-xs inline-flex items-center gap-1">
              <Edit3 size={12} />
              Editar
            </button>
            <button onClick={(e) => { e.stopPropagation(); props.onReject() }} disabled={props.saving} className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: 'var(--semantic-alert-bg)', color: 'var(--semantic-alert)', border: '1px solid var(--semantic-alert-border)' }}>
              Ignorar
            </button>
            <button onClick={(e) => { e.stopPropagation(); props.onApprove() }} disabled={props.saving} className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: 'var(--semantic-active-bg)', color: 'var(--semantic-active)', border: '1px solid var(--semantic-active-border)' }}>
              Aprobar
            </button>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Generada hace {timeAgo(tarea.created_at)}
      </p>
    </article>
  )
}

function DecisionDetailPanel({ tarea, saving, onApprove, onReject, onEdit }: {
  tarea: TareaInbox
  saving: boolean
  onApprove: () => void
  onReject: () => void
  onEdit: () => void
}) {
  const payload = tarea.payload ?? {}
  const signals = payload.senales ?? []
  const ajustes = payload.ajustes_plan ?? []
  const summary = crearDecisionSummary({
    prioridad: tarea.prioridad,
    tipo: tarea.tipo,
    senalesCount: signals.length,
    ajustesCount: ajustes.length,
    evidenciaCount: tarea.fuentes?.length ?? 0,
  })
  const riskColor = summary.risk === 'alto'
    ? 'var(--semantic-alert)'
    : summary.risk === 'medio'
      ? 'var(--semantic-warn)'
      : 'var(--semantic-active)'

  return (
    <aside className="xl:sticky xl:top-28 xl:self-start">
      <section className="rounded-[28px] border p-4" style={{ borderColor: 'var(--border)', background: 'linear-gradient(135deg, var(--surface), var(--bg-subtle))' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
              Decision detail
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              {summary.intent}
            </h2>
          </div>
          <span className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: riskColor, color: riskColor, background: 'var(--bg)' }}>
            Riesgo {summary.risk}
          </span>
        </div>

        <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{nombreCliente(tarea)}</p>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {tarea.propuesta || 'Recomendación sin texto'}
          </p>
          {tarea.razonamiento && (
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{tarea.razonamiento}</p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <DetailMetric label="Señales" value={signals.length} />
          <DetailMetric label="Ajustes" value={ajustes.length} />
          <DetailMetric label="Fuentes" value={tarea.fuentes?.length ?? 0} />
        </div>

        <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
            Checklist de decisión
          </p>
          <div className="mt-3 space-y-2">
            {summary.checklist.map(item => (
              <p key={item} className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item}</p>
            ))}
          </div>
        </div>

        {(payload.mensaje_cliente || ajustes.length > 0) && (
          <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
              Aplicación
            </p>
            {ajustes.slice(0, 3).map((ajuste, idx) => (
              <p key={`${ajuste}-${idx}`} className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{ajuste}</p>
            ))}
            {payload.mensaje_cliente && (
              <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--semantic-info)' }}>{payload.mensaje_cliente}</p>
            )}
          </div>
        )}

        {(tarea.estado === 'pendiente' || tarea.estado === 'en_revision' || tarea.estado === 'modificado') && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button onClick={onEdit} disabled={saving} className="btn-secondary text-xs">
              Editar
            </button>
            <button onClick={onReject} disabled={saving} className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: 'var(--semantic-alert-bg)', color: 'var(--semantic-alert)', border: '1px solid var(--semantic-alert-border)' }}>
              Ignorar
            </button>
            <button onClick={onApprove} disabled={saving} className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: 'var(--semantic-active-bg)', color: 'var(--semantic-active)', border: '1px solid var(--semantic-active-border)' }}>
              Aprobar
            </button>
          </div>
        )}

        {tarea.cliente_id && (
          <Link href={`/clientes/${tarea.cliente_id}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Abrir Training Room del cliente <ExternalLink size={14} />
          </Link>
        )}
      </section>
    </aside>
  )
}

function DetailMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="font-data mt-1 text-xl font-semibold" style={{ color: 'var(--text)' }}>{value}</p>
    </div>
  )
}

function MiniSignal({ icon: Icon, label, value, tone }: {
  icon: typeof Brain
  label: string
  value: number
  tone: 'warning' | 'info' | 'active' | 'neutral'
}) {
  const color = tone === 'warning'
    ? 'var(--semantic-warn)'
    : tone === 'info'
      ? 'var(--semantic-info)'
      : tone === 'active'
        ? 'var(--semantic-active)'
        : 'var(--text-muted)'
  return (
    <div className="rounded-2xl px-3 py-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
        <Icon size={11} />
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold leading-none" style={{ color }}>{value}</p>
    </div>
  )
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
