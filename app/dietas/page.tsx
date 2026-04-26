'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, UtensilsCrossed, Search } from 'lucide-react'

export default function DietasPage() {
  const [planes, setPlanes] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('planes_nutricion')
        .select('*, cliente:clientes(id, profile:profiles!profile_id(nombre, apellidos))')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })
      setPlanes(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtrados = planes.filter(p =>
    `${p.nombre} ${p.cliente?.profile?.nombre}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planes de dieta</h1>
          <p className="text-gray-500 mt-0.5">{planes.length} planes creados</p>
        </div>
        <Link href="/dietas/nueva" className="btn-primary">
          <Plus size={16} /> Nuevo plan
        </Link>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por nombre o cliente…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" /></div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-16">
          <UtensilsCrossed size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-medium">No hay planes de dieta todavía</p>
          <Link href="/dietas/nueva" className="btn-primary mt-4 inline-flex"><Plus size={16} /> Crear plan</Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtrados.map(p => (
            <Link key={p.id} href={`/dietas/${p.id}`}
              className="card hover:border-green-200 hover:shadow-sm transition-all flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <UtensilsCrossed size={20} className="text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{p.nombre}</p>
                <p className="text-sm text-gray-400">
                  {p.cliente?.profile?.nombre} {p.cliente?.profile?.apellidos}
                </p>
              </div>
              <div className="hidden md:flex items-center gap-4 text-sm text-gray-500">
                {p.kcal_objetivo && <span className="badge badge-orange">{p.kcal_objetivo} kcal</span>}
                <span className={`badge ${p.activo ? 'badge-green' : 'badge-gray'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
