'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Cliente {
  id: string
  objetivo?: string
  nivel?: string
  peso_inicial?: number
  edad?: number
  notas?: string
  restricciones_alimentarias?: string
  activo?: boolean
}

interface Props {
  cliente: Cliente
  onSave: () => void
  onCancel: () => void
}

export default function ClienteEditar({ cliente, onSave, onCancel }: Props) {
  const [objetivo, setObjetivo] = useState(cliente.objetivo ?? '')
  const [nivel, setNivel] = useState(cliente.nivel ?? '')
  const [pesoInicial, setPesoInicial] = useState(cliente.peso_inicial ?? 0)
  const [edad, setEdad] = useState(cliente.edad ?? 0)
  const [notas, setNotas] = useState(cliente.notas ?? '')
  const [restricciones, setRestricciones] = useState(cliente.restricciones_alimentarias ?? '')
  const [activo, setActivo] = useState(cliente.activo ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('clientes')
        .update({
          objetivo,
          nivel,
          peso_inicial: pesoInicial,
          edad,
          notas,
          restricciones_alimentarias: restricciones,
          activo,
        })
        .eq('id', cliente.id)

      if (updateError) throw updateError
      onSave()
    } catch (err: any) {
      setError(err.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Editar cliente</h2>
      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Objetivo */}
        <div>
          <label className="block text-sm font-medium mb-1">Objetivo</label>
          <select
            className="input"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
          >
            <option value="">Seleccionar</option>
            <option value="perder_grasa">Perder grasa</option>
            <option value="ganar_musculo">Ganar músculo</option>
            <option value="recomposicion">Recomposición</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="rendimiento">Rendimiento deportivo</option>
          </select>
        </div>

        {/* Nivel */}
        <div>
          <label className="block text-sm font-medium mb-1">Nivel</label>
          <select
            className="input"
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
          >
            <option value="">Seleccionar</option>
            <option value="principiante">Principiante</option>
            <option value="intermedio">Intermedio</option>
            <option value="avanzado">Avanzado</option>
          </select>
        </div>

        {/* Peso inicial */}
        <div>
          <label className="block text-sm font-medium mb-1">Peso inicial (kg)</label>
          <input
            type="number"
            className="input"
            value={pesoInicial}
            onChange={(e) => setPesoInicial(Number(e.target.value))}
          />
        </div>

        {/* Edad */}
        <div>
          <label className="block text-sm font-medium mb-1">Edad</label>
          <input
            type="number"
            className="input"
            value={edad}
            onChange={(e) => setEdad(Number(e.target.value))}
          />
        </div>

        {/* Notas */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Notas</label>
          <textarea
            className="input"
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>

        {/* Restricciones alimentarias */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Restricciones alimentarias</label>
          <textarea
            className="input"
            rows={3}
            value={restricciones}
            onChange={(e) => setRestricciones(e.target.value)}
          />
        </div>

        {/* Activo */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="activo"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="activo" className="text-sm font-medium">Activo</label>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          className="btn-secondary"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </button>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
