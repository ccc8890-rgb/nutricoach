'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, UtensilsCrossed, Search } from 'lucide-react'
import { StaggerList, StaggerItem } from '@/components/ui/Motion'

type PlanRow = {
  id: string
  nombre: string
  kcal_objetivo?: number | null
  activo: boolean
  cliente?: { id: string; profile?: { nombre?: string; apellidos?: string } }
}

export default function DietasPage() {
  const [planes, setPlanes] = useState<PlanRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) console.error('[dietas] Error auth.getUser:', userError)
        if (!user) { console.warn('[dietas] No hay usuario autenticado'); setLoading(false); return }

        const { data, error } = await supabase
          .from('planes_nutricion')
          .select('*, cliente:clientes(id, profile:profiles!profile_id(nombre, apellidos))')
          .eq('coach_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('[dietas] Error en query planes_nutricion:', error.message, error.details, error.hint)
        } else {
          console.log(`[dietas] ${data?.length ?? 0} planes cargados`)
        }

        setPlanes(data ?? [])
      } catch (e) {
        console.error('[dietas] Excepción inesperada:', e)
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtrados = planes.filter(p =>
    `${p.nombre} ${p.cliente?.profile?.nombre}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Planes de dieta</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{planes.length} planes creados</p>
        </div>
        <Link href="/dietas/nueva" className="btn btn-primary">
          <Plus size={16} /> Nuevo plan
        </Link>
      </header>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input className="input search-input" placeholder="Buscar por nombre o cliente…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card flex items-center gap-4 animate-pulse">
              <div className="w-11 h-11 rounded-xl skeleton flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 skeleton rounded w-40" />
                <div className="h-3 skeleton rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-16">
          <UtensilsCrossed size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No hay planes de dieta todavía</p>
          <Link href="/dietas/nueva" className="btn btn-primary mt-4"><Plus size={16} /> Crear plan</Link>
        </div>
      ) : (
        <StaggerList className="grid gap-3">
          {filtrados.map(p => (
            <StaggerItem key={p.id}>
              <Link href={`/dietas/${p.id}`}
                className="card flex items-center gap-4 block">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--primary-bg)' }}>
                  <UtensilsCrossed size={20} style={{ color: 'var(--primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold" style={{ color: 'var(--text)' }}>{p.nombre}</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {p.cliente?.profile?.nombre
                      ? `${p.cliente.profile.nombre} ${p.cliente.profile.apellidos ?? ''}`
                      : <span className="italic" style={{ color: 'var(--text-muted)' }}>Cliente anónimo (cuestionario)</span>
                    }
                  </p>
                </div>
                <div className="hidden md:flex items-center gap-3 text-sm">
                  {p.kcal_objetivo && <span className="badge badge-orange">{p.kcal_objetivo} kcal</span>}
                  <span className={`badge ${p.activo ? 'badge-teal' : 'badge-gray'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  )
}
