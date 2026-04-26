'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ClienteEditar from '@/components/ClienteEditar'
import Link from 'next/link'
import { ArrowLeft, UtensilsCrossed, Dumbbell, Weight } from 'lucide-react'
import { OBJETIVO_LABELS, NIVEL_LABELS } from '@/lib/utils'

export default function ClienteDetallePage() {
  const { id } = useParams()
  const [cliente, setCliente] = useState<any>(null)
  const [dietas, setDietas] = useState<any[]>([])
  const [entrenos, setEntrenos] = useState<any[]>([])
  const [seguimiento, setSeguimiento] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditando, setIsEditando] = useState(false)

  useEffect(() => {
    async function load() {
      const [clienteRes, dietasRes, entrenosRes, seguRes] = await Promise.all([
        supabase.from('clientes').select('*, profile:profiles!profile_id(nombre, apellidos, email, telefono)').eq('id', id).single(),
        supabase.from('planes_nutricion').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
        supabase.from('planes_entrenamiento').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
        supabase.from('seguimiento_peso').select('*').eq('cliente_id', id).order('fecha', { ascending: false }).limit(10),
      ])
      setCliente(clienteRes.data)
      setDietas(dietasRes.data ?? [])
      setEntrenos(entrenosRes.data ?? [])
      setSeguimiento(seguRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
    </div>
  )

  if (!cliente) return <div className="p-8 text-gray-500">Cliente no encontrado</div>

  const p = cliente.profile

  const handleSave = () => {
    setIsEditando(false)
    ;(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('*, profile:profiles!profile_id(nombre, apellidos, email, telefono)')
        .eq('id', id)
        .single()
      if (data) setCliente(data)
    })()
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/clientes" className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{p.nombre} {p.apellidos}</h1>
          <p className="text-gray-500 text-sm">{p.email}</p>
        </div>
        {!isEditando && (
          <button className="btn-primary" onClick={() => setIsEditando(true)}>
            Editar
          </button>
        )}
      </div>

      {isEditando ? (
        <ClienteEditar
          cliente={cliente}
          onSave={handleSave}
          onCancel={() => setIsEditando(false)}
        />
      ) : (
      <>
      {/* Info física */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Objetivo', value: cliente.objetivo ? OBJETIVO_LABELS[cliente.objetivo] : '—' },
          { label: 'Nivel', value: cliente.nivel ? NIVEL_LABELS[cliente.nivel] : '—' },
          { label: 'Peso inicial', value: cliente.peso_inicial ? `${cliente.peso_inicial} kg` : '—' },
          { label: 'Edad', value: cliente.edad ? `${cliente.edad} años` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="card">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="font-semibold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Planes de nutrición */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <UtensilsCrossed size={18} className="text-green-600" /> Planes de nutrición
            </h2>
            <Link href={`/dietas/nueva?cliente=${id}`} className="btn-primary text-sm py-1.5 px-3">+ Nuevo</Link>
          </div>
          {dietas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin planes asignados</p>
          ) : (
            <div className="flex flex-col gap-2">
              {dietas.map(d => (
                <Link key={d.id} href={`/dietas/${d.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                  <div>
                    <p className="font-medium text-sm text-gray-800">{d.nombre}</p>
                    {d.kcal_objetivo && <p className="text-xs text-gray-400">{d.kcal_objetivo} kcal/día</p>}
                  </div>
                  <span className={`badge ${d.activo ? 'badge-green' : 'badge-gray'}`}>{d.activo ? 'Activo' : 'Inactivo'}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Planes de entrenamiento */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Dumbbell size={18} className="text-purple-600" /> Planes de entrenamiento
            </h2>
            <Link href={`/entrenos/nueva?cliente=${id}`} className="btn-primary text-sm py-1.5 px-3">+ Nuevo</Link>
          </div>
          {entrenos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin planes asignados</p>
          ) : (
            <div className="flex flex-col gap-2">
              {entrenos.map(e => (
                <Link key={e.id} href={`/entrenos/${e.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                  <div>
                    <p className="font-medium text-sm text-gray-800">{e.nombre}</p>
                    {e.duracion_semanas && <p className="text-xs text-gray-400">{e.duracion_semanas} semanas</p>}
                  </div>
                  <span className={`badge ${e.activo ? 'badge-green' : 'badge-gray'}`}>{e.activo ? 'Activo' : 'Inactivo'}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Seguimiento de peso */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Weight size={18} className="text-blue-600" /> Seguimiento de peso
            </h2>
          </div>
          {seguimiento.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin registros de peso todavía</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 font-medium">Peso</th>
                    <th className="pb-2 font-medium">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {seguimiento.map(s => (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="py-2 text-gray-600">{new Date(s.fecha).toLocaleDateString('es-ES')}</td>
                      <td className="py-2 font-semibold text-gray-800">{s.peso ? `${s.peso} kg` : '—'}</td>
                      <td className="py-2 text-gray-400 truncate max-w-xs">{s.notas || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notas del coach */}
        {(cliente.notas || cliente.restricciones_alimentarias) && (
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-3">Notas y restricciones</h2>
            {cliente.restricciones_alimentarias && (
              <div className="mb-3">
                <p className="text-xs text-gray-400 mb-1">Restricciones alimentarias</p>
                <p className="text-sm text-gray-700">{cliente.restricciones_alimentarias}</p>
              </div>
            )}
            {cliente.notas && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Notas privadas</p>
                <p className="text-sm text-gray-700">{cliente.notas}</p>
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  )
}
