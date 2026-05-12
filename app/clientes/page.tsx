'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useDebounce } from '@/lib/useDebounce'
import Link from 'next/link'
import { Plus, Search, Users, Link2, Check, Loader2 } from 'lucide-react'
import { StaggerList, StaggerItem } from '@/components/ui/Motion'
import { OBJETIVO_LABELS, NIVEL_LABELS } from '@/lib/utils'

type ClienteRow = {
  id: string
  activo: boolean
  objetivo?: string
  nivel?: string
  peso_inicial?: number | null
  fecha_proxima_revision?: string | null
  revisado_por_coach?: boolean | null
  profile?: { nombre?: string; apellidos?: string; email?: string }
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const busquedaDebounced = useDebounce(busqueda, 250)
  const [loading, setLoading] = useState(true)
  const [invitando, setInvitando] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

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
        if (userError) console.error('[clientes] Error auth.getUser:', userError)
        if (!user) { console.warn('[clientes] No hay usuario autenticado'); setLoading(false); return }

        const { data, error } = await supabase
          .from('clientes')
          .select('id, activo, objetivo, nivel, peso_inicial, fecha_proxima_revision, revisado_por_coach, profile:profiles!profile_id(nombre, apellidos, email)')
          .eq('coach_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('[clientes] Error en query clientes:', error.message, error.details, error.hint)
        } else {
          console.log(`[clientes] ${data?.length ?? 0} clientes cargados para coach ${user.id}`)
        }

        setClientes((data ?? []).map(c => ({ ...c, profile: Array.isArray(c.profile) ? c.profile[0] : c.profile })))
      } catch (e) {
        console.error('[clientes] Excepción inesperada:', e)
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtrados = clientes.filter(c =>
    `${c.profile?.nombre} ${c.profile?.apellidos} ${c.profile?.email}`
      .toLowerCase()
      .includes(busquedaDebounced.toLowerCase())
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="flex items-start justify-between gap-3 mb-6 stack-mobile sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text)' }}>Clientes</h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{clientes.length} clientes en total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInvitar}
            className="btn btn-secondary btn-sm"
            disabled={invitando === 'loading'}
          >
            {invitando === 'loading' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : invitando === 'done' ? (
              <Check size={14} />
            ) : (
              <Link2 size={14} />
            )}
            <span className="hidden sm:inline">{invitando === 'done' ? 'Copiado' : 'Invitar'}</span>
          </button>
          <Link href="/clientes/nuevo" className="btn btn-primary btn-sm">
            <Plus size={14} /> <span className="hidden sm:inline">Nuevo</span><span className="sm:hidden">Nuevo</span>
          </Link>
        </div>
      </header>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          className="input search-input"
          placeholder="Buscar cliente por nombre o email…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card flex items-center gap-4 animate-pulse">
              <div className="w-12 h-12 rounded-full skeleton flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 skeleton rounded w-40" />
                <div className="h-3 skeleton rounded w-56" />
              </div>
            </div>
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-16">
          <Users size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No hay clientes todavía</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Crea tu primer cliente para empezar</p>
          <Link href="/clientes/nuevo" className="btn btn-primary mt-4">
            <Plus size={16} /> Añadir cliente
          </Link>
        </div>
      ) : (
        <StaggerList className="grid gap-3">
          {filtrados.map((c) => (
            <StaggerItem key={c.id}>
              <Link
                href={`/clientes/${c.id}`}
                className="card flex items-center gap-4 block"
              >
                {/* Avatar con gradiente charcoal */}
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))' }}>
                  {c.profile?.nombre?.[0]?.toUpperCase() ?? '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ color: 'var(--text)' }}>
                      {c.profile?.nombre} {c.profile?.apellidos}
                    </p>
                    <span className={`badge ${c.activo ? 'badge-teal' : 'badge-gray'}`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    {c.revisado_por_coach === false && (
                      <span className="badge" style={{ background: 'var(--primary)', color: 'white' }}>Nuevo</span>
                    )}
                  </div>
                  <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{c.profile?.email}</p>
                  {c.fecha_proxima_revision && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      📅 Revisión: {new Date(c.fecha_proxima_revision).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>

                <div className="hidden md:flex items-center gap-3 text-sm">
                  {c.objetivo && (
                    <span className="badge badge-blue">{OBJETIVO_LABELS[c.objetivo]}</span>
                  )}
                  {c.nivel && (
                    <span className="badge badge-purple">{NIVEL_LABELS[c.nivel]}</span>
                  )}
                  {c.peso_inicial && (
                    <span className="font-medium" style={{ color: 'var(--text-muted)' }}>{c.peso_inicial} kg</span>
                  )}
                </div>
              </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  )
}
