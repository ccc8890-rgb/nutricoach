'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import {
  calcularTMB, calcularTDEE, calcularKcalObjetivo, calcularMacrosObjetivo,
  NIVEL_ACTIVIDAD_LABELS, type NivelActividad,
} from '@/lib/utils'
import type { Cliente } from '@/types'
import { ArrowLeft, Zap } from 'lucide-react'
import Link from 'next/link'

export default function NuevaDietaPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" /></div>}>
      <NuevaDietaForm />
    </Suspense>
  )
}

function NuevaDietaForm() {
  const router = useRouter()
  const params = useSearchParams()
  const clientePreseleccionado = params.get('cliente')

  const [clientes, setClientes] = useState<(Cliente & { profile: { nombre: string; apellidos?: string } | null })[]>([])
  const [loading, setLoading] = useState(false)
  const [actividad, setActividad] = useState<NivelActividad>('moderado')
  const [form, setForm] = useState({
    cliente_id: clientePreseleccionado ?? '',
    nombre: '',
    descripcion: '',
    kcal_objetivo: '',
    proteinas_objetivo: '',
    carbohidratos_objetivo: '',
    grasas_objetivo: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('clientes')
        .select('*, profile:profiles!profile_id(nombre, apellidos)')
        .eq('coach_id', user.id)
        .eq('activo', true)
      setClientes((data ?? []) as unknown as (Cliente & { profile: { nombre: string; apellidos?: string } | null })[])
    }
    load()
  }, [])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Cliente seleccionado con datos suficientes para calcular TMB
  const clienteSeleccionado = clientes.find(c => c.id === form.cliente_id)
  const puedeCalcular = !!(
    clienteSeleccionado?.peso_inicial &&
    clienteSeleccionado?.altura &&
    clienteSeleccionado?.edad &&
    clienteSeleccionado?.sexo &&
    clienteSeleccionado?.objetivo
  )

  function aplicarTMB() {
    if (!clienteSeleccionado || !puedeCalcular) return
    const { peso_inicial, altura, edad, sexo, objetivo } = clienteSeleccionado
    const tmb = calcularTMB(peso_inicial!, altura!, edad!, sexo as 'hombre' | 'mujer')
    const tdee = calcularTDEE(tmb, actividad)
    const kcal = calcularKcalObjetivo(tdee, objetivo!)
    const macros = calcularMacrosObjetivo(kcal, objetivo!, peso_inicial!)
    setForm(prev => ({
      ...prev,
      kcal_objetivo: String(kcal),
      proteinas_objetivo: String(macros.proteinas),
      carbohidratos_objetivo: String(macros.carbohidratos),
      grasas_objetivo: String(macros.grasas),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase.from('planes_nutricion').insert({
      coach_id: user.id,
      cliente_id: form.cliente_id || null,
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      kcal_objetivo: form.kcal_objetivo ? parseFloat(form.kcal_objetivo) : null,
      proteinas_objetivo: form.proteinas_objetivo ? parseFloat(form.proteinas_objetivo) : null,
      carbohidratos_objetivo: form.carbohidratos_objetivo ? parseFloat(form.carbohidratos_objetivo) : null,
      grasas_objetivo: form.grasas_objetivo ? parseFloat(form.grasas_objetivo) : null,
      generado_por_ia: false,
    }).select().single()

    setLoading(false)
    if (!error && data) router.push(`/dietas/${data.id}`)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dietas" className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo plan de dieta</h1>
          <p className="text-gray-500 text-sm">Define los objetivos y luego añade los alimentos</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Información general */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Información general</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block mb-1.5">Cliente</label>
              <select className="input" value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
                <option value="">Sin asignar (plantilla)</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.profile?.nombre} {c.profile?.apellidos}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1.5">Nombre del plan *</label>
              <input className="input" placeholder="Ej: Plan definición semana 1" value={form.nombre} onChange={e => set('nombre', e.target.value)} required />
            </div>
            <div>
              <label className="block mb-1.5">Descripción (opcional)</label>
              <textarea className="input" rows={2} placeholder="Notas sobre este plan…" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Calculadora TMB — solo si el cliente tiene datos */}
        {puedeCalcular && (
          <div className="card border border-green-200 bg-green-50">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-green-600" />
              <h2 className="font-semibold text-green-800">Calcular con TMB (Mifflin-St Jeor)</h2>
            </div>
            <p className="text-sm text-green-700 mb-4">
              {clienteSeleccionado?.profile?.nombre} · {clienteSeleccionado?.peso_inicial}kg · {clienteSeleccionado?.altura}cm · {clienteSeleccionado?.edad} años · objetivo: {clienteSeleccionado?.objetivo?.replace('_', ' ')}
            </p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block mb-1.5 text-sm text-green-800">Nivel de actividad</label>
                <select className="input" value={actividad} onChange={e => setActividad(e.target.value as NivelActividad)}>
                  {(Object.entries(NIVEL_ACTIVIDAD_LABELS) as [NivelActividad, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={aplicarTMB} className="btn-primary whitespace-nowrap">
                Calcular y rellenar
              </button>
            </div>
          </div>
        )}

        {/* Macros objetivo */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Objetivos macro diarios</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5">Calorías (kcal)</label>
              <input type="number" className="input" placeholder="2000" value={form.kcal_objetivo} onChange={e => set('kcal_objetivo', e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5">Proteínas (g)</label>
              <input type="number" className="input" placeholder="160" value={form.proteinas_objetivo} onChange={e => set('proteinas_objetivo', e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5">Carbohidratos (g)</label>
              <input type="number" className="input" placeholder="200" value={form.carbohidratos_objetivo} onChange={e => set('carbohidratos_objetivo', e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5">Grasas (g)</label>
              <input type="number" className="input" placeholder="70" value={form.grasas_objetivo} onChange={e => set('grasas_objetivo', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Link href="/dietas" className="btn-secondary">Cancelar</Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading
              ? <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Creando…</>
              : 'Crear y añadir alimentos →'}
          </button>
        </div>
      </form>
    </div>
  )
}
