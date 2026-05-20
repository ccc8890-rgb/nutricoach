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
  cliente_id?: string
  cliente?: { id: string; profile?: { nombre?: string; apellidos?: string } }
}

type StatsMap = Record<string, { total30d: number; ultima: string; activo7d: boolean }>

export default function EntrenosPage() {
  const [planes, setPlanes] = useState<PlanRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<StatsMap>({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('planes_entrenamiento')
        .select('*, cliente_id, cliente:clientes(id, profile:profiles!profile_id(nombre, apellidos))')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })
      setPlanes(data ?? [])

      // stats de sesiones
      const clienteIds = (data ?? []).map(p => p.cliente_id).filter(Boolean) as string[]
      if (clienteIds.length > 0) {
        const fecha30d = new Date()
        fecha30d.setDate(fecha30d.getDate() - 30)
        const fecha30dStr = fecha30d.toISOString().split('T')[0]
        const fecha7d = new Date()
        fecha7d.setDate(fecha7d.getDate() - 7)
        const fecha7dStr = fecha7d.toISOString().split('T')[0]

        const { data: registros } = await supabase
          .from('registros_sets')
          .select('cliente_id, fecha')
          .in('cliente_id', clienteIds)
          .gte('fecha', fecha30dStr)

        const map: StatsMap = {}
        for (const cid of clienteIds) {
          map[cid] = { total30d: 0, ultima: '', activo7d: false }
        }
        if (registros) {
          for (const r of registros) {
            const cid = r.cliente_id
            if (!map[cid]) map[cid] = { total30d: 0, ultima: '', activo7d: false }
            map[cid].total30d++
            const fechaReg = r.fecha
            if (fechaReg > map[cid].ultima) {
              map[cid].ultima = fechaReg
            }
          }
          // calcular activo7d
          for (const cid of clienteIds) {
            if (map[cid].ultima) {
              map[cid].activo7d = map[cid].ultima >= fecha7dStr
            }
          }
        }
        setStats(map)
      }

      setLoading(false)
    }
    load()
  }, [])

  const filtrados = planes.filter(p =>
    `${p.nombre} ${p.cliente?.profile?.nombre}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  // stats agregados para header
  const planesActivos = planes.filter(p => p.activo).length
  const totalSesiones30d = Object.values(stats).reduce((acc, s) => acc + s.total30d, 0)
  const clientesActivos = Object.values(stats).filter(s => s.activo7d).length

  function diasDesde(ultima: string): string {
    if (!ultima) return ''
    const hoy = new Date()
    const ult = new Date(ultima)
    const diff = Math.floor((hoy.getTime() - ult.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Hoy'
    if (diff === 1) return 'Ayer'
    if (diff <= 30) return `Hace ${diff} días`
    return '30d+'
  }

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

      {/* Stats chips */}
      <div className="flex gap-3 mb-6">
        <div className="rounded-xl py-3 px-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-xl font-bold" style={{ color: 'var(--text)' }}>{planesActivos}</span>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Planes activos</p>
        </div>
        <div className="rounded-xl py-3 px-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-xl font-bold" style={{ color: 'rgb(168,85,247)' }}>{totalSesiones30d}</span>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Sesiones / 30d</p>
        </div>
        <div className="rounded-xl py-3 px-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-xl font-bold" style={{ color: 'rgb(34,197,94)' }}>{clientesActivos}</span>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Clientes activos</p>
        </div>
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
          {filtrados.map(p => {
            const s = p.cliente_id ? stats[p.cliente_id] : undefined
            return (
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
                  {s && (
                    <>
                      {s.activo7d && (
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      )}
                      <span style={{ color: 'var(--text-muted)' }}>
                        {s.ultima ? diasDesde(s.ultima) : ''}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {s.total30d} sesiones
                      </span>
                    </>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
