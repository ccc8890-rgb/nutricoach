'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NuevoEntrenoPage() {
  const router = useRouter()
  const params = useSearchParams()
  const clientePreseleccionado = params.get('cliente')
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    cliente_id: clientePreseleccionado ?? '',
    nombre: '',
    descripcion: '',
    duracion_semanas: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('clientes').select('id, profile:profiles!profile_id(nombre, apellidos)').eq('coach_id', user.id).eq('activo', true)
      setClientes(data ?? [])
    }
    load()
  }, [])

  function set(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('planes_entrenamiento').insert({
      coach_id: user.id,
      cliente_id: form.cliente_id || null,
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      duracion_semanas: form.duracion_semanas ? parseInt(form.duracion_semanas) : null,
    }).select().single()
    setLoading(false)
    if (!error && data) router.push(`/entrenos/${data.id}`)
  }

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/entrenos" className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo plan de entrenamiento</h1>
          <p className="text-gray-500 text-sm">Define la estructura y luego añade los ejercicios</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
        <div>
          <label className="block mb-1.5">Cliente</label>
          <select className="input" value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
            <option value="">Sin asignar (plantilla)</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.profile?.nombre} {c.profile?.apellidos}</option>)}
          </select>
        </div>
        <div>
          <label className="block mb-1.5">Nombre del plan *</label>
          <input className="input" placeholder="Ej: Fuerza 4 días/semana" value={form.nombre} onChange={e => set('nombre', e.target.value)} required />
        </div>
        <div>
          <label className="block mb-1.5">Descripción (opcional)</label>
          <textarea className="input" rows={2} placeholder="Objetivo, metodología…" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
        </div>
        <div>
          <label className="block mb-1.5">Duración (semanas)</label>
          <input type="number" className="input" placeholder="8" value={form.duracion_semanas} onChange={e => set('duracion_semanas', e.target.value)} min={1} max={52} />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Link href="/entrenos" className="btn-secondary">Cancelar</Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Creando…</> : 'Crear y añadir ejercicios →'}
          </button>
        </div>
      </form>
    </div>
  )
}
