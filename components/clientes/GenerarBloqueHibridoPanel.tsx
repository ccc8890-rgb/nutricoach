'use client'
import { useEffect, useState } from 'react'
import { Dumbbell, Loader2, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { calcularEstadoBloque, siguienteFaseBloque, type FaseBloque } from '@/lib/entrenos/bloques'

interface PlanActivoInfo {
  id: string
  nombre: string
  created_at: string
  duracion_semanas: number | null
  fase_bloque: FaseBloque | null
}

export default function GenerarBloqueHibridoPanel({ clienteId }: { clienteId: string }) {
  const [plan, setPlan] = useState<PlanActivoInfo | null | undefined>(undefined) // undefined = cargando
  const [esHibrido, setEsHibrido] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avisosPlan, setAvisosPlan] = useState<{ nivel: string; texto: string }[] | null>(null)

  async function cargar() {
    const { data: perfil } = await supabase
      .from('perfil_entreno_cliente')
      .select('sport_modality')
      .eq('cliente_id', clienteId)
      .maybeSingle()
    setEsHibrido(perfil?.sport_modality === 'hibrido')

    const { data: planData } = await supabase
      .from('planes_entrenamiento')
      .select('id, nombre, created_at, duracion_semanas')
      .eq('cliente_id', clienteId)
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!planData) { setPlan(null); return }

    const { data: sesionData } = await supabase
      .from('sesiones_entrenamiento')
      .select('fase_bloque')
      .eq('plan_id', planData.id)
      .not('fase_bloque', 'is', null)
      .limit(1)
      .maybeSingle()

    setPlan({ ...planData, fase_bloque: (sesionData?.fase_bloque as FaseBloque | undefined) ?? null })
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  async function generar(faseBloqueObjetivo?: FaseBloque) {
    setGenerando(true)
    setError(null)
    try {
      const res = await fetch('/api/entrenos/proponer-plan-ciencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cliente_id: clienteId, fase_bloque_objetivo: faseBloqueObjetivo }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo generar el bloque.')
        return
      }
      setAvisosPlan(Array.isArray(data?.validacion?.hallazgos) ? data.validacion.hallazgos : [])
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setGenerando(false)
    }
  }

  if (plan === undefined) return null

  const esBloqueHibrido = Boolean(plan?.fase_bloque)

  // Sin bloque activo y el cliente no es de modalidad híbrida: no mostrar el
  // panel. El botón "Generar plan Híbrido..." desactivaría el plan activo
  // del cliente (proponer-plan-ciencia lo hace siempre) para sustituirlo por
  // uno que ni siquiera sería híbrido, sin que el coach lo pida.
  if (!esBloqueHibrido && !esHibrido) return null
  const estado = plan && plan.duracion_semanas
    ? calcularEstadoBloque(plan.created_at, plan.duracion_semanas)
    : null
  const bloqueACaducar = Boolean(estado && estado.diasRestantes <= 3)
  const siguienteFase = esBloqueHibrido ? siguienteFaseBloque(plan!.fase_bloque) : 'Base'

  return (
    <section className="rounded-2xl p-4 sm:p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Dumbbell size={16} style={{ color: '#818CF8' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Programa Híbrido Hyrox + Running</p>
      </div>

      {error && (
        <div className="mb-3 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: 'rgb(248,113,113)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </div>
      )}
      {avisosPlan !== null && (
        <div className="mb-3 rounded-xl px-3 py-2 text-xs space-y-1" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          <p className="font-medium" style={{ color: 'var(--text)' }}>Revisión automática de la parte de carrera</p>
          {avisosPlan.length === 0 ? <p>Sin avisos: calidad, tirada larga, ritmos y volumen cuadran.</p> : avisosPlan.map((h, i) => <p key={i} style={{ color: h.nivel === 'error' ? 'rgb(248,113,113)' : undefined }}>{h.nivel === 'error' ? 'Error: ' : 'Aviso: '}{h.texto}</p>)}
        </div>
      )}

      {!esBloqueHibrido ? (
        <button className="btn-primary btn-sm" onClick={() => generar('Base')} disabled={generando}>
          {generando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Generar plan Híbrido Hyrox + Running
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Bloque activo: <strong style={{ color: 'var(--text)' }}>{plan!.fase_bloque}</strong>
            {estado && ` · Semana ${estado.semanaActual}/${estado.semanasTotales}`}
          </p>
          {bloqueACaducar && (
            <button className="btn-primary btn-sm" onClick={() => generar(siguienteFase)} disabled={generando}>
              {generando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Generar siguiente bloque: {siguienteFase}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
