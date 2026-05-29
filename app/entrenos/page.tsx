'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Search, ChevronRight } from 'lucide-react'

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const HOY_IDX = (new Date().getDay() + 6) % 7

interface ClienteEntreno {
  cliente_id: string
  plan_id: string
  plan_nombre: string
  nombre: string
  apellidos: string
  dots: boolean[]
  rpe_reciente: number | null
  tiene_pr: boolean
  fatiga: boolean
  ultima_fecha: string | null
}

function diasDesde(fecha: string | null): string {
  if (!fecha) return '—'
  const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff <= 30) return `Hace ${diff}d`
  return '+30d'
}

function getBadge(c: ClienteEntreno) {
  if (c.fatiga) return { label: 'Fatiga', color: 'rgba(239,68,68,0.12)', text: 'rgb(239,68,68)' }
  if (c.tiene_pr) return { label: 'PR 🏆', color: 'rgba(34,197,94,0.12)', text: 'rgb(34,197,94)' }
  if (c.dots.some(Boolean)) return { label: 'OK', color: 'rgba(168,85,247,0.12)', text: 'rgb(168,85,247)' }
  return { label: '—', color: 'var(--surface)', text: 'var(--text-muted)' }
}

export default function EntrenosPage() {
  const [clientes, setClientes] = useState<ClienteEntreno[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: planes } = await supabase
        .from('planes_entrenamiento')
        .select('id, nombre, cliente_id, cliente:clientes(id, profile:profiles!profile_id(nombre, apellidos))')
        .eq('coach_id', user.id)
        .eq('activo', true)
        .order('created_at', { ascending: false })

      if (!planes?.length) { setLoading(false); return }

      const clienteIds = planes.map(p => p.cliente_id).filter(Boolean) as string[]
      const fecha7d = new Date(); fecha7d.setDate(fecha7d.getDate() - 7)
      const fecha7dStr = fecha7d.toISOString().split('T')[0]
      const lunesISO = (() => {
        const h = new Date(); const d = h.getDay(); const diff = d === 0 ? 6 : d - 1
        const l = new Date(h); l.setDate(h.getDate() - diff); l.setHours(0,0,0,0); return l.toISOString().split('T')[0]
      })()

      const [{ data: registros }, { data: prsData }] = await Promise.all([
        supabase.from('registros_sets')
          .select('cliente_id, fecha, esfuerzo_percibido')
          .in('cliente_id', clienteIds)
          .gte('fecha', fecha7dStr),
        supabase.from('prs_por_ejercicio')
          .select('cliente_id, fecha_pr')
          .in('cliente_id', clienteIds)
          .gte('fecha_pr', lunesISO),
      ])

      const rows: ClienteEntreno[] = planes.map(p => {
        const cli = p.cliente as unknown as { id: string; profile: { nombre: string; apellidos: string } } | null
        const regs = (registros ?? []).filter(r => r.cliente_id === p.cliente_id)
        const fechasSet = new Set(regs.map(r => r.fecha))
        const dias7d = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - ((HOY_IDX - i + 7) % 7))
          return fechasSet.has(d.toISOString().split('T')[0])
        })
        const rpeVals = regs.map(r => r.esfuerzo_percibido).filter((v): v is number => v != null)
        const rpeMedia = rpeVals.length ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length : null
        const fechas = regs.map(r => r.fecha).sort().reverse()
        const tienePR = (prsData ?? []).some(pr => pr.cliente_id === p.cliente_id)
        const sesiones7d = fechasSet.size
        return {
          cliente_id: p.cliente_id,
          plan_id: p.id,
          plan_nombre: p.nombre,
          nombre: cli?.profile?.nombre ?? '—',
          apellidos: cli?.profile?.apellidos ?? '',
          dots: dias7d,
          rpe_reciente: rpeMedia ? Math.round(rpeMedia * 10) / 10 : null,
          tiene_pr: tienePR,
          fatiga: sesiones7d >= 5 || (rpeMedia !== null && rpeMedia >= 8.5),
          ultima_fecha: fechas[0] ?? null,
        }
      })

      rows.sort((a, b) => {
        const score = (c: ClienteEntreno) => c.fatiga ? 3 : c.tiene_pr ? 2 : c.dots.some(Boolean) ? 1 : 0
        return score(b) - score(a)
      })

      setClientes(rows)
      setLoading(false)
    }
    load()
  }, [])

  const filtrados = clientes.filter(c =>
    `${c.nombre} ${c.apellidos} ${c.plan_nombre}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Dashboard Entrenamiento</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{clientes.length} planes activos</p>
        </div>
        <Link href="/entrenos/nueva" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Nuevo plan
        </Link>
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          className="input search-input w-full"
          placeholder="Buscar cliente o plan…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          autoComplete="off"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'rgb(168,85,247)' }} />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-12" style={{ color: 'var(--text-muted)' }}>
          No hay planes activos
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="hidden md:grid px-4 py-2 text-xs font-medium border-b"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', gridTemplateColumns: '2fr 1fr 80px 60px 60px 28px' }}>
            <span>Cliente / Plan</span>
            <span className="text-center">L M X J V S D</span>
            <span className="text-center">Estado</span>
            <span className="text-center">RPE</span>
            <span className="text-center">Última</span>
            <span />
          </div>

          {filtrados.map((c, i) => {
            const badge = getBadge(c)
            const initials = `${c.nombre[0] ?? ''}${c.apellidos[0] ?? ''}`.toUpperCase()
            return (
              <Link
                key={c.plan_id}
                href={`/entrenos/${c.plan_id}`}
                className="flex md:grid items-center gap-3 px-4 py-3 transition-colors"
                style={{
                  gridTemplateColumns: '2fr 1fr 80px 60px 60px 28px',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  textDecoration: 'none',
                  background: 'transparent',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                    style={{ background: 'linear-gradient(135deg, rgb(168,85,247), rgb(99,102,241))' }}>
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{c.nombre} {c.apellidos}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{c.plan_nombre}</p>
                  </div>
                </div>

                <div className="hidden md:flex items-center justify-center gap-1">
                  {DIAS.map((d, idx) => (
                    <div key={d} className="flex flex-col items-center gap-0.5">
                      <span className="text-[8px]" style={{ color: 'var(--text-muted)', opacity: idx === HOY_IDX ? 1 : 0.5 }}>{d}</span>
                      <div className="w-2.5 h-2.5 rounded-full" style={{
                        background: c.dots[idx] ? 'rgb(168,85,247)' : idx === HOY_IDX ? 'rgba(168,85,247,0.2)' : 'var(--border)',
                        boxShadow: c.dots[idx] ? '0 0 4px rgba(168,85,247,0.4)' : 'none',
                      }} />
                    </div>
                  ))}
                </div>

                <div className="hidden md:flex justify-center">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: badge.color, color: badge.text }}>
                    {badge.label}
                  </span>
                </div>

                <div className="hidden md:flex justify-center">
                  {c.rpe_reciente !== null ? (
                    <span className="text-sm font-semibold"
                      style={{ color: c.rpe_reciente >= 8.5 ? 'rgb(239,68,68)' : 'var(--text-secondary)' }}>
                      {c.rpe_reciente.toFixed(1)}
                    </span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </div>

                <div className="hidden md:flex justify-center">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{diasDesde(c.ultima_fecha)}</span>
                </div>

                <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
