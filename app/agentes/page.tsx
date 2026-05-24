'use client'

import { useEffect, useState, useCallback } from 'react'

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
    profiles?: {
      nombre: string | null
      apellidos: string | null
    } | null
  } | null
}

const AGENTE_LABELS: Record<string, string> = {
  revisor_semanal: 'Revisor',
  riesgo: 'Riesgo',
  memoria: 'Memoria',
}

const TIPO_LABELS: Record<string, string> = {
  ajuste_macros: 'Ajuste macros',
  alerta_adherencia: 'Adherencia',
  alerta_peso_estancado: 'Peso estancado',
  alerta_peso_rapido: 'Peso rápido',
  alerta_sueno: 'Sueño',
  alerta_energia: 'Energía',
  revision_plan: 'Revisión plan',
  feedback_positivo: 'Feedback +',
  checkin_recordatorio: 'Check-in',
  // Nutrición
  revision_semanal: 'Revisión semanal 🥗',
  alerta_riesgo: 'Riesgo abandono 🚨',
  mensaje_motivacion: 'Motivación 💪',
  propuesta_receta: 'Receta sugerida 🍽️',
  actualizacion_plan: 'Actualizar plan',
  // Entrenamiento
  alerta_riesgo_entreno: 'Inactividad entreno 🏋️',
  revision_semanal_entreno: 'Revisión entreno 📊',
}

function getPrioridadColor(p: number): string {
  if (p <= 3) return 'var(--danger)'
  if (p <= 6) return 'var(--warning)'
  return 'var(--text-muted)'
}

function getNombreCliente(t: AgenteTarea): string {
  const p = t.clientes?.profiles
  if (!p) return '—'
  return [p.nombre, p.apellidos].filter(Boolean).join(' ') || '—'
}

export default function AgentesKanbanPage() {
  const [tareas, setTareas] = useState<AgenteTarea[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroAgente, setFiltroAgente] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoPropuesta, setEditandoPropuesta] = useState('')

  const fetchTareas = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('limite', '100')
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
  }, [filtroTipo, filtroAgente])

  useEffect(() => {
    fetchTareas()
    const interval = setInterval(fetchTareas, 60_000)
    return () => clearInterval(interval)
  }, [fetchTareas])

  const handleDecision = async (
    tareaId: string,
    decision: 'aprobado' | 'rechazado' | 'modificado',
    comentario?: string,
    propuestaFinal?: string
  ) => {
    const body: Record<string, unknown> = { tarea_id: tareaId, decision }
    if (comentario) body.comentario_coach = comentario
    if (propuestaFinal !== undefined) body.propuesta_final = propuestaFinal

    await fetch('/api/agentes/tareas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setEditandoId(null)
    fetchTareas()
  }

  const columnas = [
    { titulo: 'Pendiente', estados: ['pendiente'] },
    { titulo: 'En revisión', estados: ['en_revision'] },
    { titulo: 'Resuelto', estados: ['aprobado', 'rechazado', 'modificado', 'aplicado'] },
  ] as const

  const pendientes = tareas.filter((t) => t.estado === 'pendiente').length
  const riesgoAlto = tareas.filter(
    (t) => t.tipo === 'alerta_peso_estancado' || t.tipo === 'alerta_peso_rapido'
  ).length
  const resueltas = tareas.filter((t) =>
    ['aprobado', 'rechazado', 'modificado', 'aplicado'].includes(t.estado)
  ).length
  const tasaAprobacion =
    resueltas > 0
      ? Math.round(
          (tareas.filter((t) => t.estado === 'aprobado' || t.estado === 'aplicado').length /
            resueltas) *
            100
        )
      : 0

  const tiposUnicos = [...new Set(tareas.map((t) => t.tipo))]
  const agentesUnicos = [...new Set(tareas.map((t) => t.agente))]

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '60vh',
          color: 'var(--text-muted)',
        }}
      >
        Cargando tareas…
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Resumen */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <ResumenCard label="Pendientes" value={pendientes} />
        <ResumenCard label="Riesgo alto" value={riesgoAlto} color="var(--danger)" />
        <ResumenCard label="Tasa aprobación" value={`${tasaAprobacion}%`} />
      </div>

      {/* Filtros */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          style={{
            padding: '0.4rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: '0.875rem',
          }}
        >
          <option value="">Todos los tipos</option>
          {tiposUnicos.map((t) => (
            <option key={t} value={t}>
              {TIPO_LABELS[t] || t}
            </option>
          ))}
        </select>
        <select
          value={filtroAgente}
          onChange={(e) => setFiltroAgente(e.target.value)}
          style={{
            padding: '0.4rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: '0.875rem',
          }}
        >
          <option value="">Todos los agentes</option>
          {agentesUnicos.map((a) => (
            <option key={a} value={a}>
              {AGENTE_LABELS[a] || a}
            </option>
          ))}
        </select>
      </div>

      {/* Kanban */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        {columnas.map((col) => (
          <div key={col.titulo}>
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                marginBottom: '0.75rem',
                color: 'var(--text)',
              }}
            >
              {col.titulo}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {tareas
                .filter((t) => (col.estados as readonly string[]).includes(t.estado))
                .map((tarea) => (
                  <TareaCard
                    key={tarea.id}
                    tarea={tarea}
                    editandoId={editandoId}
                    editandoPropuesta={editandoPropuesta}
                    setEditandoId={setEditandoId}
                    setEditandoPropuesta={setEditandoPropuesta}
                    onDecision={handleDecision}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResumenCard({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: '12px',
        padding: '0.75rem 1.25rem',
        border: '1px solid var(--border)',
        minWidth: '140px',
      }}
    >
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{label}</p>
      <p
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          margin: 0,
          color: color || 'var(--text)',
        }}
      >
        {value}
      </p>
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

  const payloadObj = (tarea.payload as Record<string, unknown>) ?? {}
  const mensajeCliente =
    typeof payloadObj.mensaje_cliente === 'string' ? payloadObj.mensaje_cliente : null
  const senalesProxSemana = Array.isArray(payloadObj.senales_proxima_semana)
    ? (payloadObj.senales_proxima_semana as string[])
    : []

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: '12px',
        padding: '1rem',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            padding: '0.15rem 0.5rem',
            borderRadius: '6px',
            background: 'var(--accent)',
            color: 'var(--accent-foreground)',
          }}
        >
          {TIPO_LABELS[tarea.tipo] || tarea.tipo}
        </span>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            padding: '0.15rem 0.5rem',
            borderRadius: '6px',
            background: 'var(--surface-hover)',
            color: getPrioridadColor(tarea.prioridad),
          }}
        >
          P{tarea.prioridad}
        </span>
      </div>

      {/* Cliente */}
      <p style={{ fontSize: '0.85rem', fontWeight: 500, margin: 0, color: 'var(--text)' }}>
        {getNombreCliente(tarea)}
      </p>

      {/* Agente badge */}
      <span
        style={{
          fontSize: '0.7rem',
          padding: '0.15rem 0.5rem',
          borderRadius: '6px',
          background: 'var(--surface-hover)',
          color: 'var(--text-muted)',
          alignSelf: 'flex-start',
        }}
      >
        {AGENTE_LABELS[tarea.agente] || tarea.agente}
      </span>

      {/* Propuesta */}
      {tarea.propuesta && (
        <p style={{ fontSize: '0.8rem', margin: 0, color: 'var(--text)' }}>
          {tarea.propuesta}
        </p>
      )}

      {/* Mensaje sugerido al cliente — copia directa */}
      {mensajeCliente && (
        <div
          style={{
            background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: '8px',
            padding: '0.6rem 0.75rem',
          }}
        >
          <p
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'rgb(59,130,246)',
              margin: '0 0 0.25rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            💬 Mensaje para el cliente
          </p>
          <p
            style={{
              fontSize: '0.78rem',
              margin: 0,
              color: 'var(--text)',
              fontStyle: 'italic',
              whiteSpace: 'pre-wrap',
            }}
          >
            &ldquo;{mensajeCliente}&rdquo;
          </p>
          <button
            onClick={() => navigator.clipboard.writeText(mensajeCliente)}
            style={{
              marginTop: '0.4rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid rgba(59,130,246,0.3)',
              background: 'transparent',
              color: 'rgb(59,130,246)',
              fontSize: '0.7rem',
              cursor: 'pointer',
            }}
          >
            Copiar
          </button>
        </div>
      )}

      {/* Señales próxima semana */}
      {senalesProxSemana.length > 0 && (
        <details style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <summary style={{ cursor: 'pointer' }}>📍 Vigilar próxima semana</summary>
          <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
            {senalesProxSemana.map((s, i) => (
              <li key={i} style={{ marginBottom: '0.2rem' }}>
                {s}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Razonamiento colapsable */}
      {tarea.razonamiento && (
        <details style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <summary style={{ cursor: 'pointer' }}>Razonamiento</summary>
          <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>
            {tarea.razonamiento}
          </p>
        </details>
      )}

      {/* Edición inline para modificar */}
      {isEditing && (
        <textarea
          value={editandoPropuesta}
          onChange={(e) => setEditandoPropuesta(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: '0.8rem',
            resize: 'vertical',
          }}
        />
      )}

      {/* Comentario coach */}
      <textarea
        placeholder="Comentario (opcional)"
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={2}
        style={{
          width: '100%',
          padding: '0.4rem',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: '0.75rem',
          resize: 'vertical',
        }}
      />

      {/* Botones */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => onDecision(tarea.id, 'aprobado', comentario)}
          style={{
            padding: '0.3rem 0.75rem',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--success)',
            color: '#fff',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          Aprobar
        </button>
        <button
          onClick={() => onDecision(tarea.id, 'rechazado', comentario)}
          style={{
            padding: '0.3rem 0.75rem',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--danger)',
            color: '#fff',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          Rechazar
        </button>
        {!isEditing ? (
          <button
            onClick={() => {
              setEditandoId(tarea.id)
              setEditandoPropuesta(tarea.propuesta || '')
            }}
            style={{
              padding: '0.3rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Modificar
          </button>
        ) : (
          <button
            onClick={() => onDecision(tarea.id, 'modificado', comentario, editandoPropuesta)}
            style={{
              padding: '0.3rem 0.75rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--accent-foreground)',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Guardar modificación
          </button>
        )}
      </div>
    </div>
  )
}
