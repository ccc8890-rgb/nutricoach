'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Brain, CheckCircle2, XCircle, Clock } from 'lucide-react'

interface TareaTraining {
  id: string
  cliente_id: string | null
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  prioridad: number
  propuesta: string
  razonamiento: string
  payload: {
    senales?: Array<{ tipo: string; descripcion: string }>
    rpe_reciente?: number | null
    logros?: string[]
    advertencias?: string[]
    ajustes_plan?: string[]
    protocolos_kb?: string[]
  }
  fuentes: string[]
  created_at: string
  cliente_nombre?: string
}

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'rgba(251,191,36,0.12)', text: 'rgb(251,191,36)', icon: Clock },
  aprobado: { label: 'Aprobado', color: 'rgba(34,197,94,0.12)', text: 'rgb(34,197,94)', icon: CheckCircle2 },
  rechazado: { label: 'Rechazado', color: 'rgba(239,68,68,0.12)', text: 'rgb(239,68,68)', icon: XCircle },
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diff < 60) return `Hace ${diff} min`
  if (diff < 1440) return `Hace ${Math.floor(diff / 60)}h`
  return `Hace ${Math.floor(diff / 1440)}d`
}

export default function BrainIAPage() {
  const [tareas, setTareas] = useState<TareaTraining[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todas' | 'pendiente' | 'aprobado' | 'rechazado'>('todas')

  async function cargar() {
    const { data: tareasData } = await supabase
      .from('agente_tareas')
      .select('id, cliente_id, estado, prioridad, propuesta, razonamiento, payload, fuentes, created_at')
      .eq('tipo', 'training_brain')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!tareasData?.length) { setLoading(false); return }

    const clienteIds = [...new Set(tareasData.map(t => t.cliente_id).filter(Boolean))] as string[]
    const { data: perfiles } = await supabase
      .from('profiles')
      .select('id, nombre, apellidos')
      .in('id', clienteIds)

    const perfilMap = new Map((perfiles ?? []).map(p => [p.id, `${p.nombre} ${p.apellidos}`.trim()]))

    setTareas(tareasData.map(t => ({
      ...t,
      estado: t.estado as TareaTraining['estado'],
      payload: t.payload ?? {},
      fuentes: t.fuentes ?? [],
      cliente_nombre: t.cliente_id ? perfilMap.get(t.cliente_id) ?? '—' : '—',
    })))
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function actualizarEstado(id: string, estado: 'aprobado' | 'rechazado') {
    await supabase.from('agente_tareas').update({ estado, revisado_at: new Date().toISOString() }).eq('id', id)
    setTareas(prev => prev.map(t => t.id === id ? { ...t, estado } : t))
  }

  const filtradas = tareas.filter(t => filtro === 'todas' || t.estado === filtro)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)' }}>
          <Brain size={18} style={{ color: 'rgb(168,85,247)' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Training Brain</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Análisis IA con base de conocimiento científico</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5">
        {(['todas', 'pendiente', 'aprobado', 'rechazado'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
            style={{
              background: filtro === f ? 'rgba(168,85,247,0.15)' : 'var(--surface)',
              color: filtro === f ? 'rgb(168,85,247)' : 'var(--text-muted)',
              border: `1px solid ${filtro === f ? 'rgba(168,85,247,0.3)' : 'var(--border)'}`,
            }}
          >
            {f === 'todas' ? 'Todas' : ESTADO_CONFIG[f].label}
            {f !== 'todas' && (
              <span className="ml-1">({tareas.filter(t => t.estado === f).length})</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'rgb(168,85,247)' }} />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card text-center py-16">
          <Brain size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>Sin análisis Training Brain aún</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Se generan automáticamente cada lunes para clientes con ≥2 sesiones semanales</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtradas.map(t => {
            const cfg = ESTADO_CONFIG[t.estado]
            const Icon = cfg.icon
            return (
              <div key={t.id} className="card p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t.cliente_nombre}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: cfg.color, color: cfg.text }}>
                        <Icon size={10} /> {cfg.label}
                      </span>
                      <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{timeAgo(t.created_at)}</span>
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t.propuesta}</p>
                  </div>
                </div>

                {/* Señales detectadas */}
                {t.payload.senales?.length ? (
                  <div className="mb-3">
                    <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Señales</p>
                    <div className="flex flex-col gap-1">
                      {t.payload.senales.map((s, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                            style={{ background: 'rgba(168,85,247,0.1)', color: 'rgb(168,85,247)', fontSize: 9 }}>
                            {s.tipo.replace('_', ' ')}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.descripcion}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Ajustes sugeridos */}
                {t.payload.ajustes_plan?.length ? (
                  <div className="mb-3">
                    <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Ajustes sugeridos</p>
                    <ul className="flex flex-col gap-0.5">
                      {t.payload.ajustes_plan.map((a, i) => (
                        <li key={i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>→ {a}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Razonamiento */}
                {t.razonamiento && (
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t.razonamiento}</p>
                )}

                {/* Papers KB */}
                {t.fuentes?.length ? (
                  <div className="mb-4 p-2 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'rgb(168,85,247)' }}>📚 Evidencia científica</p>
                    {t.fuentes.slice(0, 3).map((f, i) => (
                      <p key={i} className="text-xs" style={{ color: 'var(--text-muted)' }}>· {f}</p>
                    ))}
                  </div>
                ) : null}

                {/* Acciones */}
                {t.estado === 'pendiente' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => actualizarEstado(t.id, 'aprobado')}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: 'rgba(34,197,94,0.12)', color: 'rgb(34,197,94)', border: '1px solid rgba(34,197,94,0.2)' }}
                    >
                      ✓ Aplicar propuesta
                    </button>
                    <button
                      onClick={() => actualizarEstado(t.id, 'rechazado')}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: 'rgba(239,68,68,0.08)', color: 'rgb(239,68,68)', border: '1px solid rgba(239,68,68,0.15)' }}
                    >
                      ✗ Descartar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
