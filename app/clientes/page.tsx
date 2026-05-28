'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useDebounce } from '@/lib/useDebounce'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  ClipboardText,
  Link as LinkIcon,
  MagnifyingGlass,
  Plus,
  Robot,
  SpinnerGap,
  TrendDown,
  UserPlus,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react'
import { StaggerList, StaggerItem } from '@/components/ui/Motion'
import { OBJETIVO_LABELS, NIVEL_LABELS } from '@/lib/utils'

type Filtro = 'todos' | 'atencion' | 'nuevos' | 'riesgo' | 'sin_checkin' | 'activos'

type ClienteRow = {
  id: string
  activo: boolean
  objetivo?: string
  nivel?: string
  peso_inicial?: number | null
  fecha_proxima_revision?: string | null
  revisado_por_coach?: boolean | null
  profile?: { nombre?: string; apellidos?: string; email?: string }
  dias_sin_checkin?: number
  ultimo_checkin?: string | null
  tareas_ia_pendientes?: number
  tiene_dieta_activa?: boolean
  tiene_entreno_activo?: boolean
}

type PlanRow = { cliente_id: string }
type TareaRow = { cliente_id: string | null }

const FILTER_LABELS: Record<Filtro, string> = {
  todos: 'Todos',
  atencion: 'Atención',
  nuevos: 'Nuevos',
  riesgo: 'Riesgo',
  sin_checkin: 'Sin check-in',
  activos: 'Activos',
}

function nombreCliente(c: ClienteRow) {
  return [c.profile?.nombre, c.profile?.apellidos].filter(Boolean).join(' ') || 'Sin nombre'
}

function getEstadoCliente(c: ClienteRow): { label: string; tone: 'danger' | 'warning' | 'success' | 'muted' } {
  if (c.revisado_por_coach === false) return { label: 'Revisar plan', tone: 'warning' }
  if ((c.tareas_ia_pendientes ?? 0) > 0) return { label: 'IA pendiente', tone: 'warning' }
  if ((c.dias_sin_checkin ?? 0) > 10) return { label: 'Riesgo', tone: 'danger' }
  if ((c.dias_sin_checkin ?? 0) > 4) return { label: 'Sin check-in', tone: 'warning' }
  if (c.activo) return { label: 'Activo', tone: 'success' }
  return { label: 'Inactivo', tone: 'muted' }
}

function estadoStyle(tone: 'danger' | 'warning' | 'success' | 'muted') {
  if (tone === 'danger') return { background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(255,69,58,0.24)' }
  if (tone === 'warning') return { background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid rgba(201,169,110,0.24)' }
  if (tone === 'success') return { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(48,209,88,0.2)' }
  return { background: 'var(--surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
}

function StatTile({ label, value, icon: Icon, active }: {
  label: string
  value: number
  icon: React.ElementType
  active?: boolean
}) {
  return (
    <div
      className="rounded-2xl p-3 sm:p-4 min-w-0"
      style={{
        background: active ? 'var(--text)' : 'var(--surface)',
        color: active ? 'var(--bg)' : 'var(--text)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] sm:text-xs font-semibold truncate" style={{ color: active ? 'var(--bg)' : 'var(--text-muted)' }}>
          {label}
        </p>
        <Icon size={17} weight="duotone" />
      </div>
      <p className="font-data text-2xl sm:text-3xl font-black mt-3 leading-none">{value}</p>
    </div>
  )
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const busquedaDebounced = useDebounce(busqueda, 250)
  const [loading, setLoading] = useState(true)
  const [invitando, setInvitando] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [filtro, setFiltro] = useState<Filtro>('atencion')

  async function handleInvitar() {
    setInvitando('loading')
    try {
      const res = await fetch('/api/invitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.url) {
        await navigator.clipboard.writeText(data.url)
        setInvitando('done')
        setTimeout(() => setInvitando('idle'), 2000)
      } else {
        setInvitando('error')
        setTimeout(() => setInvitando('idle'), 2000)
      }
    } catch {
      setInvitando('error')
      setTimeout(() => setInvitando('idle'), 2000)
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError && userError.name !== 'AuthSessionMissingError') {
          console.error('[clientes] Error auth.getUser:', userError)
        }
        if (!user) { setLoading(false); return }

        const { data, error } = await supabase
          .from('clientes')
          .select('id, activo, objetivo, nivel, peso_inicial, fecha_proxima_revision, revisado_por_coach, profile:profiles!profile_id(nombre, apellidos, email)')
          .eq('coach_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('[clientes] Error en query clientes:', error.message, error.details, error.hint)
        }

        const clientesMapeados: ClienteRow[] = (data ?? []).map(c => ({
          ...c,
          profile: Array.isArray(c.profile) ? c.profile[0] : c.profile,
        }))

        if (clientesMapeados.length > 0) {
          const clienteIds = clientesMapeados.map(c => c.id)
          const [checkinsRes, dietasRes, entrenosRes, tareasRes] = await Promise.all([
            supabase
              .from('checkins')
              .select('cliente_id, fecha')
              .in('cliente_id', clienteIds)
              .order('fecha', { ascending: false }),
            supabase
              .from('planes_nutricion')
              .select('cliente_id')
              .in('cliente_id', clienteIds)
              .eq('activo', true),
            supabase
              .from('planes_entrenamiento')
              .select('cliente_id')
              .in('cliente_id', clienteIds)
              .eq('activo', true),
            supabase
              .from('agente_tareas')
              .select('cliente_id')
              .in('cliente_id', clienteIds)
              .eq('estado', 'pendiente'),
          ])

          const ultimoCheckinMap = new Map<string, string>()
          for (const ch of checkinsRes.data ?? []) {
            if (!ultimoCheckinMap.has(ch.cliente_id)) ultimoCheckinMap.set(ch.cliente_id, ch.fecha)
          }

          const dietasActivas = new Set(((dietasRes.data ?? []) as PlanRow[]).map(p => p.cliente_id))
          const entrenosActivos = new Set(((entrenosRes.data ?? []) as PlanRow[]).map(p => p.cliente_id))
          const tareasPorCliente = new Map<string, number>()
          for (const tarea of (tareasRes.data ?? []) as TareaRow[]) {
            if (!tarea.cliente_id) continue
            tareasPorCliente.set(tarea.cliente_id, (tareasPorCliente.get(tarea.cliente_id) ?? 0) + 1)
          }

          const ahora = Date.now()
          for (const c of clientesMapeados) {
            const fechaCheckin = ultimoCheckinMap.get(c.id)
            c.ultimo_checkin = fechaCheckin ?? null
            c.dias_sin_checkin = fechaCheckin
              ? Math.floor((ahora - new Date(fechaCheckin).getTime()) / 86_400_000)
              : 999
            c.tareas_ia_pendientes = tareasPorCliente.get(c.id) ?? 0
            c.tiene_dieta_activa = dietasActivas.has(c.id)
            c.tiene_entreno_activo = entrenosActivos.has(c.id)
          }
        }

        setClientes(clientesMapeados)
      } catch (e) {
        console.error('[clientes] Excepción inesperada:', e)
      }
      setLoading(false)
    }
    load()
  }, [])

  const stats = useMemo(() => {
    const atencion = clientes.filter(c =>
      c.revisado_por_coach === false ||
      (c.tareas_ia_pendientes ?? 0) > 0 ||
      (c.dias_sin_checkin ?? 0) > 4
    ).length
    return {
      total: clientes.length,
      atencion,
      nuevos: clientes.filter(c => c.revisado_por_coach === false).length,
      riesgo: clientes.filter(c => (c.dias_sin_checkin ?? 0) > 10).length,
      ia: clientes.reduce((sum, c) => sum + (c.tareas_ia_pendientes ?? 0), 0),
    }
  }, [clientes])

  const filtrados = clientes.filter(c => {
    const textoMatch = `${c.profile?.nombre ?? ''} ${c.profile?.apellidos ?? ''} ${c.profile?.email ?? ''}`
      .toLowerCase()
      .includes(busquedaDebounced.toLowerCase())
    if (!textoMatch) return false

    if (filtro === 'atencion') {
      return c.revisado_por_coach === false || (c.tareas_ia_pendientes ?? 0) > 0 || (c.dias_sin_checkin ?? 0) > 4
    }
    if (filtro === 'nuevos') return c.revisado_por_coach === false
    if (filtro === 'riesgo') return (c.dias_sin_checkin ?? 0) > 10
    if (filtro === 'sin_checkin') return (c.dias_sin_checkin ?? 0) > 4
    if (filtro === 'activos') return c.activo
    return true
  })

  const filtros: { key: Filtro; count: number }[] = [
    { key: 'atencion', count: stats.atencion },
    { key: 'todos', count: stats.total },
    { key: 'nuevos', count: stats.nuevos },
    { key: 'riesgo', count: stats.riesgo },
    { key: 'sin_checkin', count: clientes.filter(c => (c.dias_sin_checkin ?? 0) > 4).length },
    { key: 'activos', count: clientes.filter(c => c.activo).length },
  ]

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 overflow-x-hidden">
      <header className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-5 mb-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
            Radar de clientes
          </p>
          <h1 className="text-[clamp(1.85rem,8vw,2.5rem)] font-black tracking-tight leading-[1.05]" style={{ color: 'var(--text)' }}>
            Decide a quién atender ahora.
          </h1>
          <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            Check-ins, planes pendientes e IA en una sola vista. La lista deja de ser archivo y pasa a ser cola de trabajo.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-start lg:justify-end">
          <button
            onClick={handleInvitar}
            className="btn-secondary btn-sm w-full sm:w-auto"
            disabled={invitando === 'loading'}
          >
            {invitando === 'loading' ? (
              <SpinnerGap size={14} className="animate-spin" />
            ) : invitando === 'done' ? (
              <Check size={14} />
            ) : (
              <LinkIcon size={14} />
            )}
            <span>{invitando === 'done' ? 'Copiado' : 'Invitar'}</span>
          </button>
          <Link href="/clientes/nuevo" className="btn-primary btn-sm w-full sm:w-auto">
            <Plus size={14} /> Nuevo
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-5">
        <StatTile label="Total" value={stats.total} icon={UsersThree} />
        <StatTile label="Atención" value={stats.atencion} icon={WarningCircle} active={filtro === 'atencion'} />
        <StatTile label="Acciones IA" value={stats.ia} icon={Robot} />
        <StatTile label="Nuevos" value={stats.nuevos} icon={UserPlus} />
      </div>

      <div className="rounded-3xl p-3 mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <MagnifyingGlass size={17} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              className="input search-input pl-10"
              placeholder="Buscar por nombre o email"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0 -mx-1 px-1">
            {filtros.map(f => {
              const active = filtro === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setFiltro(f.key)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-[0.98]"
                  style={active
                    ? { background: 'var(--text)', color: 'var(--bg)' }
                    : { background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
                  }
                >
                  {FILTER_LABELS[f.key]} <span className="font-data">{f.count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-3xl p-4 flex items-center gap-4 animate-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="w-12 h-12 rounded-2xl skeleton flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 skeleton rounded w-40" />
                <div className="h-3 skeleton rounded w-64 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-3xl text-center py-16" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <UsersThree size={42} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-semibold" style={{ color: 'var(--text)' }}>No hay clientes en este filtro</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Cambia el filtro o crea un nuevo cliente.</p>
          <Link href="/clientes/nuevo" className="btn-primary mt-4">
            <Plus size={16} /> Añadir cliente
          </Link>
        </div>
      ) : (
        <StaggerList className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtrados.map((c) => {
            const estado = getEstadoCliente(c)
            const href = c.revisado_por_coach === false ? `/clientes/${c.id}/revisar-rapido` : `/clientes/${c.id}`
            const dias = c.dias_sin_checkin ?? 999
            return (
              <StaggerItem key={c.id}>
                <Link
                  href={href}
                  className="group block rounded-3xl p-1 transition-all active:scale-[0.99]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <div className="rounded-[1.35rem] p-4 transition-colors group-hover:bg-[var(--surface-hover)]">
                    <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base flex-shrink-0"
                        style={{ background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)' }}
                      >
                        {c.profile?.nombre?.[0]?.toUpperCase() ?? '?'}
                      </div>

                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-bold leading-tight truncate max-w-full" style={{ color: 'var(--text)' }}>
                            {nombreCliente(c)}
                          </h2>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={estadoStyle(estado.tone)}>
                            {estado.label}
                          </span>
                        </div>
                        <p className="text-sm truncate mt-1" style={{ color: 'var(--text-muted)' }}>
                          {c.profile?.email}
                        </p>

                        <div className="grid grid-cols-2 min-[420px]:grid-cols-4 gap-2 mt-4">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Check-in</p>
                            <p className="text-sm font-bold font-data mt-0.5" style={{ color: dias > 10 ? 'var(--error)' : dias > 4 ? 'var(--warning)' : 'var(--text)' }}>
                              {dias === 999 ? 'Nunca' : `${dias} d`}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>IA</p>
                            <p className="text-sm font-bold font-data mt-0.5" style={{ color: (c.tareas_ia_pendientes ?? 0) > 0 ? 'var(--warning)' : 'var(--text)' }}>
                              {c.tareas_ia_pendientes ?? 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Dieta</p>
                            <p className="text-sm font-bold mt-0.5" style={{ color: c.tiene_dieta_activa ? 'var(--success)' : 'var(--text-muted)' }}>
                              {c.tiene_dieta_activa ? 'Activa' : 'No'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Entreno</p>
                            <p className="text-sm font-bold mt-0.5" style={{ color: c.tiene_entreno_activo ? 'var(--success)' : 'var(--text-muted)' }}>
                              {c.tiene_entreno_activo ? 'Activo' : 'No'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap mt-4">
                          {c.objetivo && (
                            <span className="badge badge-blue">{OBJETIVO_LABELS[c.objetivo] ?? c.objetivo}</span>
                          )}
                          {c.nivel && (
                            <span className="badge badge-gray">{NIVEL_LABELS[c.nivel] ?? c.nivel}</span>
                          )}
                          {c.peso_inicial && (
                            <span className="badge badge-gray">{c.peso_inicial} kg inicial</span>
                          )}
                          {dias > 10 && (
                            <span className="badge badge-red inline-flex gap-1">
                              <TrendDown size={12} /> Riesgo seguimiento
                            </span>
                          )}
                          {(c.tareas_ia_pendientes ?? 0) > 0 && (
                            <span className="badge badge-orange inline-flex gap-1">
                              <Robot size={12} /> Acción IA
                            </span>
                          )}
                          {c.revisado_por_coach === false && (
                            <span className="badge badge-orange inline-flex gap-1">
                              <ClipboardText size={12} /> Revisar onboarding
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                        <ArrowRight size={16} />
                      </div>
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            )
          })}
        </StaggerList>
      )}
    </div>
  )
}
