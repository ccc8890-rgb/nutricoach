'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Search, Users } from 'lucide-react'
import { OBJETIVO_LABELS, NIVEL_LABELS } from '@/lib/utils'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [debug, setDebug] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setDebug('SIN SESIÓN — no hay usuario logueado'); setLoading(false); return }
      setDebug(`Usuario: ${user.email} | ID: ${user.id}`)
      const { data, error } = await supabase
        .from('clientes')
        .select('*, profile:profiles!profile_id(nombre, apellidos, email)')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })
      setDebug(`Usuario: ${user.email} | Clientes: ${data?.length ?? 0} | Error: ${error?.message ?? 'ninguno'}`)
      setClientes(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtrados = clientes.filter(c =>
    `${c.profile?.nombre} ${c.profile?.apellidos} ${c.profile?.email}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {debug && <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs font-mono text-yellow-800">{debug}</div>}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 mt-0.5">{clientes.length} clientes en total</p>
        </div>
        <Link href="/clientes/nuevo" className="btn-primary">
          <Plus size={16} /> Nuevo cliente
        </Link>
      </div>

      {/* Buscador */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Buscar cliente por nombre o email…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-16">
          <Users size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-medium">No hay clientes todavía</p>
          <p className="text-sm text-gray-300 mt-1">Crea tu primer cliente para empezar</p>
          <Link href="/clientes/nuevo" className="btn-primary mt-4 inline-flex">
            <Plus size={16} /> Añadir cliente
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtrados.map((c) => (
            <Link
              key={c.id}
              href={`/clientes/${c.id}`}
              className="card hover:border-green-200 hover:shadow-sm transition-all flex items-center gap-4"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-lg flex-shrink-0">
                {c.profile?.nombre?.[0]?.toUpperCase() ?? '?'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900">
                    {c.profile?.nombre} {c.profile?.apellidos}
                  </p>
                  <span className={`badge ${c.activo ? 'badge-green' : 'badge-gray'}`}>
                    {c.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 truncate">{c.profile?.email}</p>
              </div>

              {/* Datos */}
              <div className="hidden md:flex items-center gap-4 text-sm text-gray-500">
                {c.objetivo && (
                  <span className="badge badge-blue">{OBJETIVO_LABELS[c.objetivo]}</span>
                )}
                {c.nivel && (
                  <span className="badge badge-purple">{NIVEL_LABELS[c.nivel]}</span>
                )}
                {c.peso_inicial && (
                  <span className="text-gray-400">{c.peso_inicial} kg</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
