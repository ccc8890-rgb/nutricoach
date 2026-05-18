'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Dumbbell, Search } from 'lucide-react'

type PlanRow = {
  id: string
  nombre: string
  duracion_semanas?: number | null
  activo: boolean
  cliente?: { id: string; profile?: { nombre?: string; apellidos?: string } }
}

export default function EntrenosPage() {
  const [planes, setPlanes] = useState<PlanRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('planes_entrenamiento')
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Planes de entrenamiento</h1>
          <p className="mt-0.5" style={{ color: 'var(--text-secondary)' }}>{planes.length} planes creados</p>
        </div>
        <Link href="/entrenos/nueva" className="btn-primary">
          <Plus size={16} /> Nuevo plan
        </Link>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input className="input search-input" placeholder="Buscar por nombre o cliente…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" /></div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-16">
          <Dumbbell size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No hay planes de entrenamiento</p>
          <Link href="/entrenos/nueva" className="btn-primary mt-4 inline-flex"><Plus size={16} /> Crear plan</Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtrados.map(p => (
            <Link key={p.id} href={`/entrenos/${p.id}`}
              className="card transition-all flex items-center gap-4"
              style={{ borderColor: 'var(--border)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#D8B4FE'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(168,85,247,0.15)' }}>
                <Dumbbell size={20} style={{ color: 'rgb(168,85,247)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold" style={{ color: 'var(--text)' }}>{p.nombre}</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{p.cliente?.profile?.nombre} {p.cliente?.profile?.apellidos}</p>
              </div>
              <div className="hidden md:flex items-center gap-4 text-sm">
                {p.duracion_semanas && <span className="badge badge-purple">{p.duracion_semanas} sem</span>}
                <span className={`badge ${p.activo ? 'badge-green' : 'badge-gray'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
