'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NuevoClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nombre: '', apellidos: '', email: '', password: '',
    objetivo: '', nivel: '', peso_inicial: '', altura: '', edad: '', sexo: '',
    restricciones_alimentarias: '', notas: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: { user: coach } } = await supabase.auth.getUser()
      if (!coach) throw new Error('No autenticado')

      const res = await fetch('/api/crear-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, coach_id: coach.id }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al crear el cliente')

      router.push('/clientes')
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Error al crear el cliente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/clientes" className="btn-secondary p-2">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Nuevo cliente</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Crea el perfil de tu nuevo cliente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Datos de acceso */}
        <div className="card">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Datos de acceso</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5">Nombre *</label>
              <input className="input" value={form.nombre} onChange={e => set('nombre', e.target.value)} required />
            </div>
            <div>
              <label className="block mb-1.5">Apellidos</label>
              <input className="input" value={form.apellidos} onChange={e => set('apellidos', e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5">Email *</label>
              <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div>
              <label className="block mb-1.5">Contraseña *</label>
              <input type="password" className="input" placeholder="Mínimo 6 caracteres" value={form.password} onChange={e => set('password', e.target.value)} required minLength={6} />
            </div>
          </div>
        </div>

        {/* Datos físicos */}
        <div className="card">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Datos físicos y objetivo</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5">Objetivo</label>
              <select className="input" value={form.objetivo} onChange={e => set('objetivo', e.target.value)}>
                <option value="">Sin especificar</option>
                <option value="perder_grasa">Perder grasa</option>
                <option value="ganar_musculo">Ganar músculo</option>
                <option value="recomposicion">Recomposición</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="rendimiento">Rendimiento deportivo</option>
              </select>
            </div>
            <div>
              <label className="block mb-1.5">Nivel</label>
              <select className="input" value={form.nivel} onChange={e => set('nivel', e.target.value)}>
                <option value="">Sin especificar</option>
                <option value="principiante">Principiante</option>
                <option value="intermedio">Intermedio</option>
                <option value="avanzado">Avanzado</option>
              </select>
            </div>
            <div>
              <label className="block mb-1.5">Sexo</label>
              <select className="input" value={form.sexo} onChange={e => set('sexo', e.target.value)}>
                <option value="">Sin especificar</option>
                <option value="hombre">Hombre</option>
                <option value="mujer">Mujer</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block mb-1.5">Edad</label>
              <input type="number" className="input" placeholder="28" value={form.edad} onChange={e => set('edad', e.target.value)} min={1} max={120} />
            </div>
            <div>
              <label className="block mb-1.5">Peso inicial (kg)</label>
              <input type="number" step="0.1" className="input" placeholder="75.5" value={form.peso_inicial} onChange={e => set('peso_inicial', e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5">Altura (cm)</label>
              <input type="number" className="input" placeholder="175" value={form.altura} onChange={e => set('altura', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="card">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Información adicional</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block mb-1.5">Restricciones alimentarias / Alergias</label>
              <input className="input" placeholder="Ej: intolerancia al gluten, alergia a frutos secos…" value={form.restricciones_alimentarias} onChange={e => set('restricciones_alimentarias', e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5">Notas privadas</label>
              <textarea className="input" rows={3} placeholder="Notas que solo tú verás…" value={form.notas} onChange={e => set('notas', e.target.value)} />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-bg)', border: '1px solid var(--error)', color: 'var(--error)' }}>{error}</div>
        )}

        <div className="flex gap-3 justify-end">
          <Link href="/clientes" className="btn-secondary">Cancelar</Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Guardando…</>
            ) : 'Crear cliente'}
          </button>
        </div>
      </form>
    </div>
  )
}
