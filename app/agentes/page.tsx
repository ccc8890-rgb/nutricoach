'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  Clock,
  Funnel,
  PencilSimple,
  Robot,
  SpinnerGap,
  TrendUp,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { StaggerList, StaggerItem } from '@/components/ui/Motion'

type AgenteTarea = {
  id: string
  tipo: string
  cliente_id: string
  agente: string
  estado: string
  prioridad: number
  payload: unknown
  propuesta: string | null
  comentario_coach: string | null
  razonamiento: string | null
  fuentes: unknown
  created_at: string
  updated_at: string
  revisado_at: string | null
  aplicado_at: string | null
  clientes?: {
    id: string
    profile?: {
      nombre: string | null
      apellidos: string | null
    } | null
  } | null
}

const AGENTE_LABELS: Record<string, string> = {
  revisor_semanal: 'Revisor semanal',
  riesgo: 'Riesgo',
  memoria: 'Memoria',
  motivacion: 'Motivación',
  riesgo_entreno: 'Riesgo entreno',
  revisor_semanal_entreno: 'Revisor entreno',
  readiness: 'Readiness',
  supercoach: 'Director SuperCoach',
  director: 'Director',
}

const TIPO_LABELS: Record<string, string> = {
  ajuste_macros: 'Ajuste de macros',
  alerta_adherencia: 'Adherencia',
  alerta_peso_estancado: 'Peso estancado',
  alerta_peso_rapido: 'Peso rápido',
  alerta_sueno: 'Sueño',
  alerta_energia: 'Energía',
  revision_plan: 'Revisión de plan',
  feedback_positivo: 'Feedback positivo',
  checkin_recordatorio: 'Check-in',
  revision_semanal: 'Revisión semanal',
  alerta_riesgo: 'Riesgo de abandono',
  mensaje_motivacion: 'Mensaje de apoyo',
  propuesta_receta: 'Receta sugerida',
  actualizacion_plan: 'Actualizar plan',
  alerta_riesgo_entreno: 'Inactividad de entreno',
  revision_semanal_entreno: 'Revisión de entreno',
  alerta_readiness: 'Recuperación y carga',
  ajuste_nutricion_carga: 'Nutrición por carga',
}

function getNombreCliente(t: AgenteTarea): string {
  const p = t.clientes?.profile
  if (!p) return 'Sin cliente'
  return [p.nombre, p.apellidos].filter(Boolean).join(' ') || 'Sin cliente'
}

function prioridadConfig(p: number) {
  if (p <= 3) return { label: 'Alta', color: 'var(--error)', bg: 'var(--error-bg)' }
  if (p <= 6) return { label: 'Media', color: 'var(--warning)', bg: 'var(--warning-bg)' }
  return { label: 'Baja', color: 'var(--text-muted)', bg: 'var(--surface-hover)' }
}

function estadoConfig(estado: string) {
  if (estado === 'pendiente') return { label: 'Pendiente', color: 'var(--warning)', bg: 'var(--warning-bg)' }
  if (estado === 'aplicado') return { label: 'Aplicado', color: 'var(--success)', bg: 'var(--success-bg)' }
  if (estado === 'aprobado') return { label: 'Aprobado', color: 'var(--success)', bg: 'var(--success-bg)' }
  if (estado === 'rechazado') return { label: 'Rechazado', color: 'var(--error)', bg: 'var(--error-bg)' }
  if (estado === 'modificado') return { label: 'Modificado', color: 'var(--info)', bg: 'var(--info-bg)' }
  return { label: estado, color: 'var(--text-muted)', bg: 'var(--surface-hover)' }
}

function getPayload(tarea: AgenteTarea) {
  return (tarea.payload as Record<string, unknown>) ?? {}
}

function getMensajeCliente(tarea: AgenteTarea) {
  const payload = getPayload(tarea)
  return typeof payload.mensaje_cliente === 'string' ? payload.mensaje_cliente : null
}

function getSenales(tarea: AgenteTarea) {
  const payload = getPayload(tarea)
  return Array.isArray(payload.senales_proxima_semana) ? payload.senales_proxima_semana as string[] : []
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl p-3 sm:p-4 min-w-0" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] sm:text-xs font-semibold truncate" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <Icon size={17} weight="duotone" style={{ color: 'var(--text-muted)' }} />
      </div>
      <p className="font-data text-2xl sm:text-3xl font-black mt-3 leading-none" style={{ color: 'var(--text)' }}>{value}</p>
    </div>
  )
}

export default function AgentesInboxPage() {
  const [tareas, setTareas] = useState<AgenteTarea[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('pendiente')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroAgente, setFiltroAgente] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoPropuesta, setEditandoPropuesta] = useState('')
  const [ejecutando, setEjecutando] = useState<'idle' | 'diario' | 'semanal'>('idle')
  const [resultadoRun, setResultadoRun] = useState<string | null>(null)

  const fetchTareas = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('limite', '120')
      if (filtroEstado) params.set('estado', filtroEstado)
      if (filtroTipo) params.set('tipo', filtroTipo)
      if (filtroAgente) params.set('agente', filtroAgente)
      const res = await fetch(`/api/agentes/tareas?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setTareas(data.tareas ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [filtroEstado, filtroTipo, filtroAgente])

  useEffect(() => {
    fetchTareas()
    const interval = setInterval(fetchTareas, 60_000)
    return () => clearInterval(interval)
  }, [fetchTareas])

  async function ejecutarAnalisis(modo: 'diario' | 'semanal') {
    setEjecutando(modo)
    setResultadoRun(null)
    try {
      const res = await fetch(`/api/agentes/ejecutar?modo=${modo}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setResultadoRun(data.error ?? 'No se pudo ejecutar el análisis')
        return
      }
      const resultado = data.resultado
      setResultadoRun(`${resultado?.clientes_procesados ?? 0} clientes procesados, ${resultado?.tareas_generadas ?? 0} acciones nuevas`)
      await fetchTareas()
    } catch {
      setResultadoRun('No se pudo ejecutar el análisis')
    } finally {
      setEjecutando('idle')
    }
  }

  async function handleDecision(
    tareaId: string,
    decision: 'aprobado' | 'rechazado' | 'modificado',
    comentario?: string,
    propuestaFinal?: string
  ) {
    const body: Record<string, unknown> = { tarea_id: tareaId, decision }
    if (comentario) body.comentario_coach = comentario
    if (propuestaFinal !== undefined) body.propuesta_final = propuestaFinal

    await fetch('/api/agentes/tareas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setEditandoId(null)
    await fetchTareas()
  }

  const stats = useMemo(() => {
    const pendientes = tareas.filter(t => t.estado === 'pendiente').length
    const alta = tareas.filter(t => t.prioridad <= 3).length
    const aplicadas = tareas.filter(t => t.estado === 'aplicado').length
    const clientes = new Set(tareas.map(t => t.cliente_id).filter(Boolean)).size
    return { pendientes, alta, aplicadas, clientes }
  }, [tareas])

  const tiposUnicos = [...new Set(tareas.map((t) => t.tipo))]
  const agentesUnicos = [...new Set(tareas.map((t) => t.agente))]

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 overflow-x-hidden">
      <header className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-5 mb-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
            Inbox IA
          </p>
          <h1 className="text-[clamp(1.85rem,8vw,2.5rem)] font-black tracking-tight leading-[1.05]" style={{ color: 'var(--text)' }}>
            Revisa decisiones, no tareas técnicas.
          </h1>
          <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            Los agentes detectan riesgo, ajustes y mensajes. Carlos decide, modifica o aplica.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-start lg:justify-end">
          <button className="btn-secondary btn-sm w-full sm:w-auto" onClick={() => ejecutarAnalisis('diario')} disabled={ejecutando !== 'idle'}>
            {ejecutando === 'diario' ? <SpinnerGap size={14} className="animate-spin" /> : <Robot size={14} />}
            Diario
          </button>
          <button className="btn-primary btn-sm w-full sm:w-auto" onClick={() => ejecutarAnalisis('semanal')} disabled={ejecutando !== 'idle'}>
            {ejecutando === 'semanal' ? <SpinnerGap size={14} className="animate-spin" /> : <TrendUp size={14} />}
            Semanal
          </button>
        </div>
      </header>

      {resultadoRun && (
        <div className="rounded-2xl px-4 py-3 mb-5 text-sm" style={{ background: 'var(--info-bg)', color: 'var(--info)', border: '1px solid rgba(10,132,255,0.22)' }}>
          {resultadoRun}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-5">
        <Metric label="Pendientes" value={stats.pendientes} icon={Robot} />
        <Metric label="Alta prioridad" value={stats.alta} icon={WarningCircle} />
        <Metric label="Clientes" value={stats.clientes} icon={Clock} />
        <Metric label="Aplicadas" value={stats.aplicadas} icon={Check} />
      </div>

      <div className="rounded-3xl p-3 mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold min-w-fit" style={{ color: 'var(--text-secondary)' }}>
            <Funnel size={16} /> Filtros
          </div>
          <select className="input min-w-0 lg:max-w-[180px]" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="aplicado">Aplicadas</option>
            <option value="aprobado">Aprobadas</option>
            <option value="rechazado">Rechazadas</option>
            <option value="modificado">Modificadas</option>
          </select>
          <select className="input min-w-0 lg:max-w-[220px]" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {tiposUnicos.map((t) => (
              <option key={t} value={t}>{TIPO_LABELS[t] || t}</option>
            ))}
          </select>
          <select className="input min-w-0 lg:max-w-[220px]" value={filtroAgente} onChange={(e) => setFiltroAgente(e.target.value)}>
            <option value="">Todos los agentes</option>
            {agentesUnicos.map((a) => (
              <option key={a} value={a}>{AGENTE_LABELS[a] || a}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-3xl p-5 animate-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="h-4 skeleton rounded w-52 mb-3" />
              <div className="h-3 skeleton rounded w-full max-w-xl" />
            </div>
          ))}
        </div>
      ) : tareas.length === 0 ? (
        <div className="rounded-3xl text-center py-16" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Robot size={44} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-semibold" style={{ color: 'var(--text)' }}>No hay acciones en este filtro</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Ejecuta análisis diario o semanal para generar nuevas recomendaciones.</p>
        </div>
      ) : (
        <StaggerList className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {tareas.map(tarea => (
            <StaggerItem key={tarea.id}>
              <TareaCard
                tarea={tarea}
                editandoId={editandoId}
                editandoPropuesta={editandoPropuesta}
                setEditandoId={setEditandoId}
                setEditandoPropuesta={setEditandoPropuesta}
                onDecision={handleDecision}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  )
}

function TareaCard({
  tarea,
  editandoId,
  editandoPropuesta,
  setEditandoId,
  setEditandoPropuesta,
  onDecision,
}: {
  tarea: AgenteTarea
  editandoId: string | null
  editandoPropuesta: string
  setEditandoId: (id: string | null) => void
  setEditandoPropuesta: (v: string) => void
  onDecision: (
    tareaId: string,
    decision: 'aprobado' | 'rechazado' | 'modificado',
    comentario?: string,
    propuestaFinal?: string
  ) => void
}) {
  const [comentario, setComentario] = useState('')
  const isEditing = editandoId === tarea.id
  const mensajeCliente = getMensajeCliente(tarea)
  const senales = getSenales(tarea)
  const prioridad = prioridadConfig(tarea.prioridad)
  const estado = estadoConfig(tarea.estado)

  return (
    <article className="rounded-3xl p-1 min-w-0" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="rounded-[1.35rem] p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: prioridad.bg, color: prioridad.color }}>
                {prioridad.label}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: estado.bg, color: estado.color }}>
                {estado.label}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
                {AGENTE_LABELS[tarea.agente] || tarea.agente}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight" style={{ color: 'var(--text)' }}>
              {TIPO_LABELS[tarea.tipo] || tarea.tipo}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {new Date(tarea.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          {tarea.cliente_id && (
            <Link
              href={`/clientes/${tarea.cliente_id}`}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              Cliente <ArrowRight size={12} />
            </Link>
          )}
        </div>

        <div className="rounded-2xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-1" style={{ color: 'var(--text-muted)' }}>
            Cliente
          </p>
          <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{getNombreCliente(tarea)}</p>
        </div>

        {tarea.propuesta && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: 'var(--text-muted)' }}>
              Propuesta del agente
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{tarea.propuesta}</p>
          </div>
        )}

        {mensajeCliente && (
          <div className="rounded-2xl p-3" style={{ background: 'var(--info-bg)', border: '1px solid rgba(10,132,255,0.22)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: 'var(--info)' }}>
              Mensaje listo para cliente
            </p>
            <p className="text-sm leading-relaxed italic" style={{ color: 'var(--text)' }}>{mensajeCliente}</p>
            <button
              onClick={() => navigator.clipboard.writeText(mensajeCliente)}
              className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(10,132,255,0.12)', color: 'var(--info)' }}
            >
              Copiar mensaje
            </button>
          </div>
        )}

        {senales.length > 0 && (
          <details className="text-sm" style={{ color: 'var(--text-muted)' }}>
            <summary className="cursor-pointer font-semibold">Señales a vigilar</summary>
            <ul className="mt-2 space-y-1 list-disc pl-5">
              {senales.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </details>
        )}

        {tarea.razonamiento && (
          <details className="text-sm" style={{ color: 'var(--text-muted)' }}>
            <summary className="cursor-pointer font-semibold">Razonamiento</summary>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{tarea.razonamiento}</p>
          </details>
        )}

        {isEditing && (
          <textarea
            value={editandoPropuesta}
            onChange={(e) => setEditandoPropuesta(e.target.value)}
            rows={4}
            className="input"
          />
        )}

        {tarea.estado === 'pendiente' && (
          <div className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <textarea
              placeholder="Comentario interno opcional"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
              className="input text-sm"
            />

            <div className="grid grid-cols-1 sm:flex gap-2 sm:flex-wrap">
              <button className="btn-primary btn-sm w-full sm:w-auto" onClick={() => onDecision(tarea.id, 'aprobado', comentario)}>
                <Check size={13} /> Aprobar y aplicar
              </button>
              <button className="btn-secondary btn-sm w-full sm:w-auto" onClick={() => onDecision(tarea.id, 'rechazado', comentario)}>
                <X size={13} /> Rechazar
              </button>
              {!isEditing ? (
                <button
                  className="btn-secondary btn-sm w-full sm:w-auto"
                  onClick={() => {
                    setEditandoId(tarea.id)
                    setEditandoPropuesta(tarea.propuesta || '')
                  }}
                >
                  <PencilSimple size={13} /> Modificar
                </button>
              ) : (
                <button className="btn-primary btn-sm w-full sm:w-auto" onClick={() => onDecision(tarea.id, 'modificado', comentario, editandoPropuesta)}>
                  <Check size={13} /> Guardar y aplicar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
