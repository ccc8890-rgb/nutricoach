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
  profile?: { nombre?: string; apellidos?: string; email?: string }
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const busquedaDebounced = useDebounce(busqueda, 250)
  const [loading, setLoading] = useState(true)
  const [invitando, setInvitando] = useState<'idle'|'loading'|'done'|'error'>('idle')

  async function handleInvitar() {
    setInvitando('loading')
    try {
      const res = await fetch('/api/invitaciones', { method: 'POST' })
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('clientes')
        .select('*, profile:profiles!profile_id(nombre, apellidos, email)')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })
      setClientes(data ?? [])
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
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">{clientes.length} clientes en total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInvitar}
            className="btn btn-secondary"
            disabled={invitando === 'loading'}
          >
            {invitando === 'loading' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : invitando === 'done' ? (
              <Check size={16} />
            ) : (
              <Link2 size={16} />
            )}
            {invitando === 'done' ? 'Copiado' : 'Invitar'}
          </button>
          <Link href="/clientes/nuevo" className="btn btn-primary">
            <Plus size={16} /> Nuevo cliente
          </Link>
        </div>
      </header>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
              <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-40" />
                <div className="h-3 bg-gray-200 rounded w-56" />
              </div>
            </div>
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-16">
          <Users size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No hay clientes todavía</p>
          <p className="text-sm text-gray-400 mt-1">Crea tu primer cliente para empezar</p>
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
                {/* Avatar con gradiente teal */}
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #1C1C1E, #3A3A3C)' }}>
                  {c.profile?.nombre?.[0]?.toUpperCase() ?? '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">
                      {c.profile?.nombre} {c.profile?.apellidos}
                    </p>
                    <span className={`badge ${c.activo ? 'badge-teal' : 'badge-gray'}`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 truncate">{c.profile?.email}</p>
                  {c.fecha_proxima_revision && (
                    <p className="text-xs text-gray-300 mt-0.5">
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
                    <span className="text-gray-400 font-medium">{c.peso_inicial} kg</span>
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
