'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, Edit3, Loader2, XCircle } from '@/components/icons/lucide'
import PropuestaPlanEntreno from '@/components/clientes/PropuestaPlanEntreno'
import type { PayloadPlanEntrenoIA } from '@/lib/entrenos/planificar-con-ia'

// Versión compacta, scopeada a UN cliente, de lo que antes vivía en la
// página global /entrenos/brain-ia (840 líneas, eliminada el 11-10-2026, cola de TODOS los
// clientes). Carlos pidió que aprobar/editar la IA se haga desde la
// ficha del cliente en la que ya está trabajando, no en una pantalla
// aparte — así que esto reusa la misma API (PATCH /api/agentes/tareas)
// pero solo muestra lo pendiente de este cliente, sin el resto de la
// complejidad (trace, playbook, filtros por tipo/estado) que no hace
// falta cuando ya sabes de qué cliente estás hablando.

const TRAINING_TYPES = new Set([
  'training_brain',
  'revision_semanal_entreno',
  'alerta_riesgo_entreno',
  'alerta_readiness',
  'ajuste_nutricion_carga',
  'actualizacion_plan',
  'plan_entreno_ia',
])

const TIPO_LABEL: Record<string, string> = {
  training_brain: 'Training Brain',
  revision_semanal_entreno: 'Revisión semanal',
  alerta_riesgo_entreno: 'Riesgo entreno',
  alerta_readiness: 'Readiness',
  ajuste_nutricion_carga: 'Nutrición carga',
  actualizacion_plan: 'Ajuste plan',
  plan_entreno_ia: 'Plan de entreno',
}

interface Tarea {
  id: string
  cliente_id: string | null
  tipo: string
  estado: string
  propuesta: string | null
  razonamiento: string | null
  created_at: string
  payload?: ({ accion_aplicable?: string } & Partial<PayloadPlanEntrenoIA>) | null
}

function esTareaEntrenoDelCliente(t: Tarea, clienteId: string): boolean {
  if (t.cliente_id !== clienteId) return false
  if (!TRAINING_TYPES.has(t.tipo)) return false
  if (t.tipo === 'actualizacion_plan' && t.payload?.accion_aplicable !== 'actualizar_plan_entreno') return false
  return t.estado === 'pendiente' || t.estado === 'en_revision'
}

// Misma propuesta repetida (mismo tipo y texto): se queda la más reciente.
function sinDuplicados(tareas: Tarea[]): Tarea[] {
  const vistas = new Set<string>()
  return [...tareas]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .filter(t => {
      const clave = `${t.tipo}|${t.propuesta ?? ''}`
      if (vistas.has(clave)) return false
      vistas.add(clave)
      return true
    })
}

export default function DecisionesIACliente({ clienteId, envolver }: { clienteId: string; envolver?: (contenido: React.ReactNode) => React.ReactNode }) {
  const [tareas, setTareas] = useState<Tarea[] | null>(null)
  const [expandidaId, setExpandidaId] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [guardandoId, setGuardandoId] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    const cargar = () => fetch('/api/agentes/tareas?limite=100')
      .then(r => r.json())
      .then(data => {
        if (cancelado) return
        const pendientes = sinDuplicados(((data.tareas ?? []) as Tarea[]).filter(t => esTareaEntrenoDelCliente(t, clienteId)))
        setTareas(pendientes)
      })
      .catch(() => { if (!cancelado) setTareas([]) })
    cargar()
    // «Planificar con IA» avisa cuando deja una propuesta nueva.
    window.addEventListener('decisiones-ia:recargar', cargar)
    return () => { cancelado = true; window.removeEventListener('decisiones-ia:recargar', cargar) }
  }, [clienteId])

  async function decidir(tarea: Tarea, decision: 'aprobado' | 'rechazado' | 'modificado') {
    setGuardandoId(tarea.id)
    try {
      const res = await fetch('/api/agentes/tareas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tarea_id: tarea.id,
          decision,
          propuesta_final: decision === 'modificado' ? draft : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const resultado = await res.json().catch(() => null) as { mensaje_aplicacion?: string } | null
      if (tarea.tipo === 'plan_entreno_ia' && resultado?.mensaje_aplicacion) setAviso(resultado.mensaje_aplicacion)
      setTareas(prev => (prev ?? []).filter(t => t.id !== tarea.id))
      if (tarea.tipo === 'plan_entreno_ia' && decision === 'aprobado') window.dispatchEvent(new CustomEvent('plan-entreno:actualizado'))
      setEditandoId(null)
      setDraft('')
    } catch {
      // silencioso: si falla, la tarea sigue en la lista y el coach puede reintentar
    } finally {
      setGuardandoId(null)
    }
  }

  const avisoNodo = aviso ? <p className="text-sm px-1 pb-2" role="status" style={{ color: 'var(--text)' }}>{aviso}</p> : null

  if (tareas === null) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={15} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  const envuelto = (contenido: React.ReactNode) => (envolver ? envolver(contenido) : contenido)

  // Sin nada pendiente (y sin aviso de una aprobación reciente) no ocupa sitio.
  if (tareas.length === 0) return avisoNodo ? <>{envuelto(avisoNodo)}</> : null

  return envuelto(
    <div className="space-y-2">
      {avisoNodo}
      {tareas.map(tarea => {
        const abierta = expandidaId === tarea.id
        const editando = editandoId === tarea.id
        return (
          <div key={tarea.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--semantic-warn-border)', background: 'var(--semantic-warn-bg)' }}>
            <button
              onClick={() => setExpandidaId(abierta ? null : tarea.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--semantic-warn-text)' }}>{TIPO_LABEL[tarea.tipo] ?? tarea.tipo}</p>
                <p className="text-sm font-medium mt-1 truncate" style={{ color: 'var(--text)' }}>{tarea.propuesta ?? 'Sin propuesta'}</p>
              </div>
              <ChevronDown size={16} className="flex-shrink-0 transition-transform" style={{ color: 'var(--text-muted)', transform: abierta ? 'rotate(180deg)' : 'none' }} />
            </button>

            {abierta && (
              <div className="px-4 pb-4 space-y-3">
                {tarea.razonamiento && tarea.tipo !== 'plan_entreno_ia' && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{tarea.razonamiento}</p>
                )}
                {tarea.tipo === 'plan_entreno_ia' && tarea.payload?.plan && <PropuestaPlanEntreno payload={tarea.payload as PayloadPlanEntrenoIA} />}

                {editando ? (
                  <div>
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      rows={3}
                      className="w-full text-sm px-3 py-2.5 rounded-lg mb-2"
                      style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => decidir(tarea, 'modificado')} disabled={guardandoId === tarea.id} className="btn-primary btn-sm">
                        {guardandoId === tarea.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Guardar edición
                      </button>
                      <button onClick={() => setEditandoId(null)} className="btn-secondary btn-sm">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => decidir(tarea, 'aprobado')} disabled={guardandoId === tarea.id} className="btn-primary btn-sm">
                      {guardandoId === tarea.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Aprobar
                    </button>
                    {tarea.tipo !== 'plan_entreno_ia' && (
                      <button onClick={() => { setEditandoId(tarea.id); setDraft(tarea.propuesta ?? '') }} className="btn-secondary btn-sm">
                        <Edit3 size={13} /> Editar
                      </button>
                    )}
                    <button onClick={() => decidir(tarea, 'rechazado')} disabled={guardandoId === tarea.id} className="btn-secondary btn-sm">
                      <XCircle size={13} /> Ignorar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
