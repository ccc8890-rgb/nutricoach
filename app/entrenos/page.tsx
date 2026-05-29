'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Dumbbell, Search, Activity, Trophy, Clock, ChevronRight } from 'lucide-react'

type ClienteRow = {
  id: string
  nombre: string
  apellidos: string
  plan_activo: { id: string, nombre: string, duracion_semanas: number | null } | null
  tls: { semana_actual: number, porcentaje: number, semaforo: string } | null
  prs: { ejercicio: string, peso: number }[]
  dots: boolean[]
  ultima_actividad: string
}

export default function EntrenosPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: cliData } = await supabase
        .from('clientes')
        .select('id, profile:profiles!profile_id(nombre, apellidos), planes_entrenamiento(id, nombre, duracion_semanas, activo)')
        .eq('coach_id', user.id)

      if (!cliData) { setLoading(false); return }

      const clientesRows: ClienteRow[] = []
      
      for (const c of cliData) {
        const planActivo = c.planes_entrenamiento?.find((p: any) => p.activo)
        
        let tlsData = null
        try {
          const { data: tls } = await supabase.rpc('get_tls_dashboard', { p_cliente_id: c.id })
          if (tls) {
            tlsData = {
              semana_actual: tls.tls_semana_actual || 0,
              porcentaje: tls.porcentaje_umbral || 0,
              semaforo: tls.semaforo || 'bajo'
            }
          }
        } catch(e) {}

        let prsList: any[] = []
        try {
          const { data: prs } = await supabase.from('prs_por_ejercicio')
            .select('ejercicio_nombre, peso_kg, fecha')
            .eq('cliente_id', c.id)
            .order('fecha', { ascending: false })
            .limit(2)
          if (prs) prsList = prs.map(pr => ({ ejercicio: pr.ejercicio_nombre, peso: pr.peso_kg }))
        } catch(e) {}

        clientesRows.push({
          id: c.id,
          nombre: (c.profile as any)?.nombre || 'Desconocido',
          apellidos: (c.profile as any)?.apellidos || '',
          plan_activo: planActivo ? { id: planActivo.id, nombre: planActivo.nombre, duracion_semanas: planActivo.duracion_semanas } : null,
          tls: tlsData,
          prs: prsList,
          dots: [true, false, true, false, false, false, false],
          ultima_actividad: 'Hace 2 días'
        })
      }

      setClientes(clientesRows)
      setLoading(false)
    }
    load()
  }, [])

  const filtrados = clientes.filter(c =>
    (c.nombre + ' ' + c.apellidos).toLowerCase().includes(busqueda.toLowerCase())
  )

  const getSemaforoColor = (s: string) => {
    switch(s) {
      case 'bajo': return 'var(--semantic-info)'
      case 'normal': return 'var(--semantic-active)'
      case 'alto': return 'var(--semantic-warn)'
      case 'muy_alto': return 'var(--semantic-alert)'
      default: return 'var(--border-strong)'
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Entrenamientos</h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Resumen de actividad y carga TLS</p>
        </div>
        <Link href="/entrenos/nueva" className="glass-btn flex items-center gap-2">
          <Plus size={16} /> Crear Plantilla
        </Link>
      </div>

      <div className="relative mb-8 max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input className="input pl-10 bg-transparent glass-card shadow-none" placeholder="Buscar atleta…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} /></div>
      ) : filtrados.length === 0 ? (
        <div className="glass-card text-center py-16">
          <Dumbbell size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium text-lg" style={{ color: 'var(--text)' }}>No hay atletas activos</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Asigna planes a tus clientes para ver su progreso aquí.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtrados.map(c => (
            <div key={c.id} className="glass-card p-5 group flex flex-col md:flex-row gap-6 justify-between transition-all hover:border-white/20" style={{ borderColor: 'var(--border-strong)' }}>
              
              <div className="flex items-center gap-4 min-w-[240px]">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                  {c.nombre[0]}{c.apellidos ? c.apellidos[0] : ''}
                </div>
                <div>
                  <h3 className="font-semibold text-lg leading-tight" style={{ color: 'var(--text)' }}>{c.nombre} {c.apellidos}</h3>
                  {c.plan_activo ? (
                    <Link href={'/entrenos/' + c.plan_activo.id} className="text-sm flex items-center gap-1 mt-1 hover:underline transition-all" style={{ color: 'var(--semantic-info)' }}>
                      <Dumbbell size={12}/> {c.plan_activo.nombre} {c.plan_activo.duracion_semanas ? '('+c.plan_activo.duracion_semanas+'s)' : ''}
                    </Link>
                  ) : (
                    <span className="text-sm flex items-center gap-1 mt-1" style={{ color: 'var(--text-muted)' }}>Sin plan activo</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col justify-center min-w-[140px]">
                <div className="flex items-center gap-2 mb-1">
                  <Activity size={14} style={{ color: 'var(--text-muted)' }}/>
                  <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>Carga TLS</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-data" style={{ color: 'var(--text)' }}>{c.tls?.semana_actual || 0}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: c.tls ? getSemaforoColor(c.tls.semaforo) + '20' : 'var(--bg)', color: c.tls ? getSemaforoColor(c.tls.semaforo) : 'var(--text-muted)', border: '1px solid ' + (c.tls ? getSemaforoColor(c.tls.semaforo) + '40' : 'var(--border)') }}>
                    {c.tls ? c.tls.porcentaje + '%' : '--'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col justify-center min-w-[200px]">
                <div className="flex items-center gap-2 mb-1.5">
                  <Trophy size={14} style={{ color: 'var(--semantic-warn)' }}/>
                  <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--semantic-warn)' }}>Nuevos PRs</span>
                </div>
                {c.prs.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {c.prs.map((pr, i) => (
                      <div key={i} className="text-sm truncate flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--semantic-warn)' }}></span>
                        <span className="font-medium" style={{ color: 'var(--text)' }}>{pr.peso}kg</span> {pr.ejercicio}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm italic" style={{ color: 'var(--text-muted)' }}>Sin récords recientes</span>
                )}
              </div>

              <div className="flex flex-col items-end justify-between min-w-[120px]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock size={12} style={{ color: 'var(--text-muted)' }}/>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.ultima_actividad}</span>
                </div>
                <Link href={'/clientes/' + c.id + '?tab=entreno'} className="btn-secondary btn-sm group-hover:bg-white group-hover:text-black transition-all">
                  Ver Atleta <ChevronRight size={14}/>
                </Link>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  )
}
