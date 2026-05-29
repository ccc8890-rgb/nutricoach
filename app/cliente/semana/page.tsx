'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ChevronRight } from 'lucide-react'

const DIAS_ABR: Record<string, string> = {
  Lunes: 'L', Martes: 'M', Miércoles: 'X', Jueves: 'J',
  Viernes: 'V', Sábado: 'S', Domingo: 'D',
}
const HOY_NOMBRE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date().getDay()]

interface SesionSemana {
  id: string
  nombre: string
  dia_semana: string
  ejercicios_count: number
  duracion_estimada_min: number | null
  completada: boolean
}

export default function VistaSemanalClientePage() {
  const [sesiones, setSesiones] = useState<SesionSemana[]>([])
  const [loading, setLoading] = useState(true)
  const [planNombre, setPlanNombre] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: clienteData } = await supabase
        .from('clientes')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!clienteData) { setLoading(false); return }

      const { data: planEntreno } = await supabase
        .from('planes_entrenamiento')
        .select('id, nombre')
        .eq('cliente_id', clienteData.id)
        .eq('activo', true)
        .single()

      if (!planEntreno) { setLoading(false); return }

      setPlanNombre(planEntreno.nombre)

      const { data: sesData } = await supabase
        .from('sesiones_entrenamiento')
        .select('id, nombre, dia_semana, duracion_estimada_min, ejercicios:sesion_ejercicios(id)')
        .eq('plan_id', planEntreno.id)
        .order('orden')

      const lunesISO = (() => {
        const h = new Date()
        const d = h.getDay()
        const diff = d === 0 ? 6 : d - 1
        const l = new Date(h)
        l.setDate(h.getDate() - diff)
        l.setHours(0, 0, 0, 0)
        return l.toISOString().split('T')[0]
      })()

      const { data: regs } = await supabase
        .from('registros_sets')
        .select('fecha')
        .eq('cliente_id', clienteData.id)
        .gte('fecha', lunesISO)

      const fechasCompletadas = new Set((regs ?? []).map(r => r.fecha))
      const hoyStr = new Date().toISOString().split('T')[0]

      const DIAS_ORDER: Record<string, number> = {
        Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4,
        Viernes: 5, Sábado: 6, Domingo: 7,
      }

      setSesiones(
        (sesData ?? [])
          .sort((a, b) => (DIAS_ORDER[a.dia_semana] ?? 9) - (DIAS_ORDER[b.dia_semana] ?? 9))
          .map(s => ({
            id: s.id,
            nombre: s.nombre,
            dia_semana: s.dia_semana,
            ejercicios_count: Array.isArray(s.ejercicios) ? s.ejercicios.length : 0,
            duracion_estimada_min: s.duracion_estimada_min ?? null,
            completada: fechasCompletadas.has(hoyStr) && s.dia_semana === HOY_NOMBRE,
          }))
      )
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cliente" style={{ color: 'var(--text-muted)' }} aria-label="Volver">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Esta semana</h1>
          {planNombre && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{planNombre}</p>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--border)', borderTopColor: 'rgb(168,85,247)' }}
          />
        </div>
      ) : sesiones.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
          Sin sesiones esta semana
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sesiones.map(s => {
            const esHoy = s.dia_semana === HOY_NOMBRE
            return (
              <Link
                key={s.id}
                href={`/cliente/sesion/${s.id}`}
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{
                  background: esHoy ? 'rgba(168,85,247,0.06)' : 'var(--surface)',
                  border: `1px solid ${esHoy ? 'rgba(168,85,247,0.3)' : 'var(--border)'}`,
                  textDecoration: 'none',
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{
                    background: esHoy ? 'rgb(168,85,247)' : 'var(--bg)',
                    color: esHoy ? '#fff' : 'var(--text-muted)',
                    border: esHoy ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {DIAS_ABR[s.dia_semana] ?? s.dia_semana[0]}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{s.nombre}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {s.ejercicios_count} ejercicios
                    {s.duracion_estimada_min ? ` · ~${s.duracion_estimada_min} min` : ''}
                  </p>
                </div>

                {s.completada ? (
                  <CheckCircle2 size={18} style={{ color: 'rgb(34,197,94)', flexShrink: 0 }} />
                ) : esHoy ? (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{ background: 'rgba(168,85,247,0.15)', color: 'rgb(168,85,247)' }}
                  >Hoy</span>
                ) : (
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
