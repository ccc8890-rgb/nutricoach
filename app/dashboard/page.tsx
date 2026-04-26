'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, UtensilsCrossed, Dumbbell, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface Stats {
  totalClientes: number
  clientesActivos: number
  totalDietas: number
  totalEntrenos: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ totalClientes: 0, clientesActivos: 0, totalDietas: 0, totalEntrenos: 0 })
  const [nombre, setNombre] = useState('')
  const [clientes, setClientes] = useState<Array<{ id: string; profile: { nombre: string } | null; objetivo: string | null; activo: boolean }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('nombre').eq('id', user.id).single()
      setNombre(profile?.nombre ?? '')

      const [clientesRes, dietasRes, entrenosRes] = await Promise.all([
        supabase.from('clientes').select('id, activo, objetivo, profile:profiles!profile_id(nombre)').eq('coach_id', user.id),
        supabase.from('planes_nutricion').select('id').eq('coach_id', user.id),
        supabase.from('planes_entrenamiento').select('id').eq('coach_id', user.id),
      ])

      const c = clientesRes.data ?? []
      setClientes(c.slice(0, 5) as any)
      setStats({
        totalClientes: c.length,
        clientesActivos: c.filter(x => x.activo).length,
        totalDietas: dietasRes.data?.length ?? 0,
        totalEntrenos: entrenosRes.data?.length ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const STAT_CARDS = [
    { label: 'Clientes totales', value: stats.totalClientes, icon: Users, color: '#dbeafe', iconColor: '#2563eb' },
    { label: 'Clientes activos', value: stats.clientesActivos, icon: TrendingUp, color: '#dcfce7', iconColor: '#16a34a' },
    { label: 'Planes de dieta', value: stats.totalDietas, icon: UtensilsCrossed, color: '#fef9c3', iconColor: '#ca8a04' },
    { label: 'Planes de entreno', value: stats.totalEntrenos, icon: Dumbbell, color: '#ede9fe', iconColor: '#7c3aed' },
  ]

  const OBJETIVO_LABELS: Record<string, string> = {
    perder_grasa: 'Perder grasa', ganar_musculo: 'Ganar músculo',
    recomposicion: 'Recomposición', mantenimiento: 'Mantenimiento', rendimiento: 'Rendimiento',
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">¡Hola, {nombre}! 👋</h1>
        <p className="text-gray-500 mt-1">Aquí tienes el resumen de tu actividad</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map(({ label, value, icon: Icon, color, iconColor }) => (
          <div key={label} className="card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color }}>
                <Icon size={20} style={{ color: iconColor }} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Acciones rápidas</h2>
          <div className="flex flex-col gap-2">
            <Link href="/clientes/nuevo" className="btn-secondary justify-start">
              <Users size={16} /> Añadir nuevo cliente
            </Link>
            <Link href="/dietas/nueva" className="btn-secondary justify-start">
              <UtensilsCrossed size={16} /> Crear plan de dieta
            </Link>
            <Link href="/entrenos/nueva" className="btn-secondary justify-start">
              <Dumbbell size={16} /> Crear plan de entreno
            </Link>
          </div>
        </div>

        {/* Últimos clientes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Clientes recientes</h2>
            <Link href="/clientes" className="text-sm text-green-600 hover:underline">Ver todos</Link>
          </div>
          <div className="flex flex-col gap-2">
            {clientes.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No tienes clientes todavía</p>
            )}
            {clientes.map((c: any) => (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm">
                  {c.profile?.nombre?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{c.profile?.nombre}</p>
                  <p className="text-xs text-gray-400">{c.objetivo ? OBJETIVO_LABELS[c.objetivo] : 'Sin objetivo'}</p>
                </div>
                <span className={`badge ${c.activo ? 'badge-green' : 'badge-gray'}`}>
                  {c.activo ? 'Activo' : 'Inactivo'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
