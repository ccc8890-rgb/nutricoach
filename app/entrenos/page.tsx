'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Activity, ArrowUpRight, Dumbbell, Plus, Search, Trophy } from 'lucide-react'

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
  pr_count: number
  fatiga: boolean
  ultima_fecha: string | null
  sesiones_7d: number
  tls: number
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
  if (c.fatiga) return { label: 'Fatiga', color: 'var(--semantic-alert-bg)', text: 'var(--semantic-alert)', border: 'var(--semantic-alert-border)' }
  if (c.tiene_pr) return { label: 'PR', color: 'var(--semantic-active-bg)', text: 'var(--semantic-active)', border: 'var(--semantic-active-border)', icon: Trophy }
  if (c.dots.some(Boolean)) return { label: 'Activo', color: 'var(--semantic-info-bg)', text: 'var(--semantic-info)', border: 'var(--semantic-info-border)' }
  return { label: '—', color: 'var(--surface)', text: 'var(--text-muted)' }
}

function DashboardSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="grid items-center gap-3 rounded-xl px-4 py-3"
          style={{
            gridTemplateColumns: '2fr 1fr 80px 60px 60px 28px',
            background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg-subtle)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl animate-pulse" style={{ background: 'var(--border-strong)' }} />
            <div className="space-y-2">
              <div className="h-3 w-32 rounded-full animate-pulse" style={{ background: 'var(--border-strong)' }} />
              <div className="h-2.5 w-44 rounded-full animate-pulse" style={{ background: 'var(--border)' }} />
            </div>
          </div>
          <div className="hidden md:flex justify-center gap-1">
            {DIAS.map(d => <div key={d} className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: 'var(--border)' }} />)}
          </div>
          <div className="hidden md:block h-5 rounded-full animate-pulse" style={{ background: 'var(--border)' }} />
          <div className="hidden md:block h-4 rounded-full animate-pulse" style={{ background: 'var(--border)' }} />
          <div className="hidden md:block h-4 rounded-full animate-pulse" style={{ background: 'var(--border)' }} />
        </div>
      ))}
    </div>
  )
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
        const prCount = (prsData ?? []).filter(pr => pr.cliente_id === p.cliente_id).length
        const sesiones7d = fechasSet.size
        const tls = Math.round(sesiones7d * ((rpeMedia ?? 6.5) / 10) * 100)
        return {
          cliente_id: p.cliente_id,
          plan_id: p.id,
          plan_nombre: p.nombre,
          nombre: cli?.profile?.nombre ?? '—',
          apellidos: cli?.profile?.apellidos ?? '',
          dots: dias7d,
          rpe_reciente: rpeMedia ? Math.round(rpeMedia * 10) / 10 : null,
          tiene_pr: tienePR,
          pr_count: prCount,
          fatiga: sesiones7d >= 5 || (rpeMedia !== null && rpeMedia >= 8.5),
          ultima_fecha: fechas[0] ?? null,
          sesiones_7d: sesiones7d,
          tls,
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
    <div className="px-4 py-5 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] mb-2" style={{ color: 'var(--text-muted)' }}>
            Training OS
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-none" style={{ color: 'var(--text)' }}>
            Panel de carga y ejecución
          </h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Prioriza clientes por fatiga, adherencia semanal, PRs recientes y último registro del plan.
          </p>
        </div>
        <Link href="/entrenos/nueva" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Nuevo plan
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center mb-4">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            {clientes.length} planes activos
          </span>
          <span className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: 'var(--semantic-alert-bg)', border: '1px solid var(--semantic-alert-border)', color: 'var(--semantic-alert)' }}>
            {clientes.filter(c => c.fatiga).length} con fatiga
          </span>
          <span className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: 'var(--semantic-active-bg)', border: '1px solid var(--semantic-active-border)', color: 'var(--semantic-active)' }}>
            {clientes.filter(c => c.tiene_pr).length} PRs semana
          </span>
        </div>
        <div className="relative sm:w-80">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          className="input search-input w-full"
          placeholder="Buscar cliente o plan…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          autoComplete="off"
        />
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl px-6 py-14 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            No hay planes activos con ese filtro
          </p>
          <p className="text-xs mt-2 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            Ajusta la búsqueda o crea un plan para empezar a registrar sesiones.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtrados.map((c, i) => {
            const badge = getBadge(c)
            const BadgeIcon = badge.icon
            const initials = `${c.nombre[0] ?? ''}${c.apellidos[0] ?? ''}`.toUpperCase()
            return (
              <Link
                key={c.plan_id}
                href={`/entrenos/${c.plan_id}`}
                className="glass-card p-4 transition-all duration-200 active:scale-[0.995]"
                style={{
                  textDecoration: 'none',
                  animation: `fadeIn 0.24s var(--ease-out-strong) ${Math.min(i, 8) * 35}ms both`,
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-semibold flex-shrink-0"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text)' }}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{c.nombre} {c.apellidos}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{c.plan_nombre}</p>
                    </div>
                  </div>
                  <ArrowUpRight size={16} style={{ color: 'var(--text-muted)' }} />
                </div>

                <div className="grid grid-cols-3 gap-3 my-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>TLS</p>
                    <p className="font-data text-3xl leading-none mt-1" style={{ color: c.fatiga ? 'var(--semantic-alert)' : 'var(--text)' }}>{c.tls}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>RPE</p>
                    <p className="font-data text-3xl leading-none mt-1" style={{ color: (c.rpe_reciente ?? 0) >= 8.5 ? 'var(--semantic-alert)' : 'var(--text)' }}>
                      {c.rpe_reciente !== null ? c.rpe_reciente.toFixed(1) : '--'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>PRs</p>
                    <p className="font-data text-3xl leading-none mt-1" style={{ color: c.pr_count > 0 ? 'var(--semantic-active)' : 'var(--text)' }}>{c.pr_count}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center justify-center gap-1">
                  {DIAS.map((d, idx) => (
                    <div key={d} className="flex flex-col items-center gap-0.5">
                      <span className="text-[8px]" style={{ color: 'var(--text-muted)', opacity: idx === HOY_IDX ? 1 : 0.5 }}>{d}</span>
                      <div className="w-2.5 h-2.5 rounded-full" style={{
                        background: c.dots[idx] ? 'var(--semantic-active)' : idx === HOY_IDX ? 'var(--semantic-info-bg)' : 'var(--border)',
                        boxShadow: c.dots[idx] ? '0 0 0 3px var(--semantic-active-bg)' : 'none',
                      }} />
                    </div>
                  ))}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: badge.color, color: badge.text, border: `1px solid ${badge.border ?? 'var(--border)'}` }}>
                    {BadgeIcon ? <BadgeIcon size={11} className="inline mr-1 -mt-0.5" /> : null}
                    {badge.label}
                  </span>
                </div>

                <div className="mt-4 pt-3 flex items-center justify-between text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <span className="inline-flex items-center gap-1"><Dumbbell size={12} /> {c.sesiones_7d} sesiones / 7d</span>
                  <span className="inline-flex items-center gap-1"><Activity size={12} /> {diasDesde(c.ultima_fecha)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
