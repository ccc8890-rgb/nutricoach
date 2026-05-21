'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, BrainCircuit, Sparkles, ArrowRight, TrendingUp, Layers, Hash, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface KBStats {
  total: number
  porDisciplina: Record<string, number>
  ultimas: { id: string; titulo: string; disciplina: string; created_at: string }[]
  bridgeEntries: number
  puentesPorCategoria: Array<{ categoria: string; count: number }>
}

export default function KBPanel() {
  const [stats, setStats] = useState<KBStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        // ── Stats desde API conocimiento ──
        const res = await fetch('/api/conocimiento')
        const json = await res.json()
        const fichas = json.data ?? []

        // ── Contar por disciplina ──
        const porDisciplina: Record<string, number> = {}
        for (const f of fichas) {
          porDisciplina[f.disciplina] = (porDisciplina[f.disciplina] ?? 0) + 1
        }

        // ── Últimas 5 ──
        const ultimas = fichas.slice(0, 5).map((f: any) => ({
          id: f.id,
          titulo: f.titulo,
          disciplina: f.disciplina,
          created_at: f.created_at,
        }))

        setStats({
          total: fichas.length,
          porDisciplina,
          ultimas,
          bridgeEntries: 80, // TAG_BRIDGE entries (~80 después de expansión)
          puentesPorCategoria: [
            { categoria: 'Objetivos', count: 6 },
            { categoria: 'Rendimiento', count: 7 },
            { categoria: 'Running', count: 7 },
            { categoria: 'Ciclismo/Tri', count: 5 },
            { categoria: 'Hyrox/Funcional', count: 5 },
            { categoria: 'Fuerza', count: 4 },
            { categoria: 'Salud/Metabólico', count: 11 },
            { categoria: 'Tiroides/Hormonas', count: 4 },
            { categoria: 'Suplementación', count: 4 },
            { categoria: 'Lesiones/Recup', count: 3 },
          ],
        })
      } catch (e) {
        console.error('[KBPanel] Error:', e)
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="card-glass mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BrainCircuit size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Base de Conocimiento</h2>
        </div>
        <div className="space-y-2">
          <div className="skeleton h-16 w-full rounded-xl" />
          <div className="skeleton h-10 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!stats) return null

  // Top 5 disciplinas
  const topDisciplinas = Object.entries(stats.porDisciplina)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  return (
    <div className="card-glass mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BrainCircuit size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Base de Conocimiento</h2>
        </div>
        <Link
          href="/conocimiento"
          className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
          style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
        >
          Gestionar <ArrowRight size={12} />
        </Link>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl" style={{ background: 'var(--surface-hover)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <BookOpen size={13} style={{ color: 'var(--accent)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Fichas</span>
          </div>
          <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{stats.total}</p>
        </div>
        <div className="p-3 rounded-xl" style={{ background: 'var(--surface-hover)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Hash size={13} style={{ color: 'var(--accent-light)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Puentes TAG</span>
          </div>
          <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{stats.bridgeEntries}</p>
        </div>
        <div className="p-3 rounded-xl" style={{ background: 'var(--surface-hover)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Layers size={13} style={{ color: 'var(--info)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Disciplinas</span>
          </div>
          <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{topDisciplinas.length}</p>
        </div>
      </div>

      {/* Distribución por disciplina mini-bars */}
      <div className="space-y-1.5 mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Por disciplina
        </span>
        {topDisciplinas.map(([disciplina, count]) => {
          const pct = Math.round((count / stats.total) * 100)
          return (
            <div key={disciplina} className="flex items-center gap-2">
              <span className="text-xs capitalize w-20 truncate" style={{ color: 'var(--text-secondary)' }}>
                {disciplina}
              </span>
              <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--surface-elevated)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: 'var(--accent)' }}
                />
              </div>
              <span className="text-xs font-medium w-6 text-right" style={{ color: 'var(--text-muted)' }}>
                {count}
              </span>
            </div>
          )
        })}
      </div>

      {/* Últimas añadidas */}
      {stats.ultimas.length > 0 && (
        <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-1 mb-2">
            <Sparkles size={12} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Últimas añadidas
            </span>
          </div>
          <div className="space-y-1">
            {stats.ultimas.map(f => (
              <Link
                key={f.id}
                href={`/conocimiento/${f.id}`}
                className="flex items-center gap-2 p-2 rounded-lg transition-all hover:opacity-80"
                style={{ background: 'var(--surface-hover)' }}
              >
                <CheckCircle size={10} style={{ color: 'var(--success)' }} />
                <span className="text-xs truncate flex-1" style={{ color: 'var(--text-secondary)' }}>
                  {f.titulo}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                  style={{ background: 'var(--surface-elevated)', color: 'var(--text-muted)' }}
                >
                  {f.disciplina}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* TAG_BRIDGE coverage quick-look */}
      <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-1 mb-2">
          <TrendingUp size={12} style={{ color: 'var(--text-muted)' }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Cobertura TAG_BRIDGE
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {stats.puentesPorCategoria.map(pc => (
            <div key={pc.categoria} className="flex items-center justify-between px-2 py-1 rounded-lg"
              style={{ background: 'var(--surface-hover)' }}>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{pc.categoria}</span>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>{pc.count}</span>
            </div>
          ))}
        </div>
        <Link
          href="/conocimiento"
          className="flex items-center justify-center gap-1 mt-3 text-xs font-medium py-2 rounded-lg transition-all hover:opacity-80"
          style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
        >
          <BookOpen size={13} /> Ver todas las fichas <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  )
}
