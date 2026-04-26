'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ClienteEditar from '@/components/ClienteEditar'
import { cn } from '@/lib/utils'

interface Cliente {
  id: string
  nombre?: string
  apellidos?: string
  email?: string
  objetivo?: string
  nivel?: string
  peso_inicial?: number
  edad?: number
  notas?: string
  restricciones_alimentarias?: string
  activo?: boolean
  created_at?: string
  profile?: {
    nombre?: string
    apellidos?: string
    email?: string
  }
}

export default function ClienteDetallePage() {
  const params = useParams()
  const id = params.id as string

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditando, setIsEditando] = useState(false)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('clientes')
          .select('*, profile:profiles!profile_id(nombre, apellidos, email)')
          .eq('id', id)
          .single()

        if (fetchError) throw fetchError
        setCliente(data)
      } catch (err: any) {
        setError(err.message || 'Error al cargar cliente')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const handleSave = () => {
    setIsEditando(false)
    // Refetch to get updated data
    ;(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('*, profile:profiles!profile_id(nombre, apellidos, email)')
        .eq('id', id)
        .single()
      if (data) setCliente(data)
    })()
  }

  const handleCancel = () => {
    setIsEditando(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Cargando cliente...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Cliente no encontrado</p>
      </div>
    )
  }

  const nombreCompleto =
    cliente.profile?.nombre && cliente.profile?.apellidos
      ? `${cliente.profile.nombre} ${cliente.profile.apellidos}`
      : cliente.nombre || 'Sin nombre'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{nombreCompleto}</h1>
        {!isEditando && (
          <button
            className="btn-primary"
            onClick={() => setIsEditando(true)}
          >
            Editar
          </button>
        )}
      </div>

      {isEditando ? (
        <ClienteEditar
          cliente={cliente}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        /* Static cards */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4">
            <p className="text-sm text-gray-500">Objetivo</p>
            <p className="font-medium">{cliente.objetivo || '—'}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Nivel</p>
            <p className="font-medium">{cliente.nivel || '—'}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Peso inicial</p>
            <p className="font-medium">{cliente.peso_inicial ?? '—'} kg</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Edad</p>
            <p className="font-medium">{cliente.edad ?? '—'} años</p>
          </div>
          <div className="card p-4 md:col-span-2">
            <p className="text-sm text-gray-500">Notas</p>
            <p className="font-medium whitespace-pre-wrap">{cliente.notas || '—'}</p>
          </div>
          <div className="card p-4 md:col-span-2">
            <p className="text-sm text-gray-500">Restricciones alimentarias</p>
            <p className="font-medium whitespace-pre-wrap">{cliente.restricciones_alimentarias || '—'}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Activo</p>
            <p className="font-medium">{cliente.activo ? 'Sí' : 'No'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
