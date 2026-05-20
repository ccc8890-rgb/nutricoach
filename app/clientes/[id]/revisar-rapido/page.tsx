'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle, ChevronRight, Loader2, RefreshCw, Utensils } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ClienteData {
  id: string
  objetivo: string | null
  revisado_por_coach: boolean
  profiles: { nombre: string; apellidos: string | null; email: string | null } | null
}

interface PlanInicial {
  kcal_objetivo: number
  macros?: { proteinas_g?: number; carbos_g?: number; grasas_g?: number }
  distribucion_comidas?: {
    nombre: string
    porcentaje_kcal?: number
    kcal: number
    hora_sugerida?: string
    notas?: string
  }[]
  recomendaciones?: string[]
  alertas_coach?: string[]
  notas_coach?: string
}

interface RegistroIA {
  id: string
  respuesta_json: PlanInicial
  created_at: string
}

interface RecetaSugerida {
  id: string
  nombre: string
  kcal: number
  proteinas: number
  imagen_url: string | null
}

const OBJETIVOS: Record<string, string> = {
  perder_grasa: 'Perder grasa',
  ganar_musculo: 'Ganar músculo',
  rendimiento: 'Rendimiento',
  mantener: 'Mantener',
  salud_general: 'Salud general',
}

export default function RevisarRapidoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [cliente, setCliente] = useState<ClienteData | null>(null)
  const [plan, setPlan] = useState<PlanInicial | null>(null)
  const [dietaActivaId, setDietaActivaId] = useState<string | null>(null)
  const [entrenoActivoId, setEntrenoActivoId] = useState<string | null>(null)
  const [recetasPorComida, setRecetasPorComida] = useState<Record<number, RecetaSugerida[]>>({})
  const [loading, setLoading] = useState(true)
  const [regenerando, setRegenerando] = useState(false)
  const [aprobando, setAprobando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarRecetas = useCallback(async (planData: PlanInicial) => {
    const comidas = planData.distribucion_comidas ?? []
    if (!comidas.length) return

    const resultados: Record<number, RecetaSugerida[]> = {}
    await Promise.all(
      comidas.map(async (comida, idx) => {
        try {
          const params = new URLSearchParams({
            kcal: String(comida.kcal),
            proteinas: String(Math.round((comida.kcal * 0.30) / 4)),
            limite: '3',
          })
          const res = await fetch(`/api/recetas/sugeridas?${params}`)
          if (!res.ok) return
          const data = await res.json()
          resultados[idx] = data.recetas ?? []
        } catch {
          // Las recetas sugeridas no bloquean la revisión.
        }
      })
    )
    setRecetasPorComida(resultados)
  }, [])

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [
      clienteRes,
      registrosRes,
      dietaRes,
      entrenoRes,
    ] = await Promise.all([
      supabase
        .from('clientes')
        .select('id, objetivo, revisado_por_coach, profiles(nombre, apellidos, email)')
        .eq('id', id)
        .single(),
      supabase
        .from('registros_ia')
        .select('id, respuesta_json, created_at')
        .eq('cliente_id', id)
        .in('tipo', ['plan_inicial', 'dieta'])
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('planes_nutricion')
        .select('id')
        .eq('cliente_id', id)
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('planes_entrenamiento')
        .select('id')
        .eq('cliente_id', id)
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    if (clienteRes.error || !clienteRes.data) {
      setError('Cliente no encontrado')
      setLoading(false)
      return
    }

    const rawCliente = clienteRes.data as unknown as ClienteData & {
      profiles: ClienteData['profiles'] | ClienteData['profiles'][]
    }
    const profile = Array.isArray(rawCliente.profiles) ? rawCliente.profiles[0] ?? null : rawCliente.profiles
    setCliente({ ...rawCliente, profiles: profile })
    setDietaActivaId(dietaRes.data?.[0]?.id ?? null)
    setEntrenoActivoId(entrenoRes.data?.[0]?.id ?? null)

    const registro = (registrosRes.data?.[0] ?? null) as RegistroIA | null
    const planData = registro?.respuesta_json ?? null
    setPlan(planData)
    if (planData) await cargarRecetas(planData)

    setLoading(false)
  }, [cargarRecetas, id])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const regenerar = async () => {
    setRegenerando(true)
    setError(null)
    try {
      const res = await fetch('/api/generar-plan-inicial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cliente_id: id }),
      })
      if (!res.ok) throw new Error('No se ha podido regenerar el plan')
      await cargarDatos()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al regenerar')
    } finally {
      setRegenerando(false)
    }
  }

  const aprobar = async () => {
    if (!dietaActivaId) {
      setError('Antes de aprobar, crea la dieta desde la revisión completa.')
      return
    }

    setAprobando(true)
    setError(null)
    try {
      const res = await fetch('/api/aprobar-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cliente_id: id }),
      })
      if (!res.ok) throw new Error('No se ha podido aprobar el cliente')
      router.push(`/clientes/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al aprobar')
    } finally {
      setAprobando(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Loader2 className="animate-spin" size={30} style={{ color: 'var(--primary)' }} />
      </div>
    )
  }

  if (error && !cliente) {
    return (
      <main className="min-h-screen p-5" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <p className="text-sm text-red-500">{error}</p>
      </main>
    )
  }

  const nombre = cliente?.profiles
    ? `${cliente.profiles.nombre} ${cliente.profiles.apellidos ?? ''}`.trim()
    : 'Cliente'

  const objetivo = cliente?.objetivo ? (OBJETIVOS[cliente.objetivo] ?? cliente.objetivo) : 'Sin objetivo'
  const puedeAprobar = Boolean(dietaActivaId)

  return (
    <main className="min-h-screen pb-28" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-md p-4 space-y-4">
        <header className="pt-2">
          <button
            type="button"
            onClick={() => router.push(`/clientes/${id}/revisar-plan`)}
            className="text-xs mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            Revisión completa
          </button>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text)' }}>{nombre}</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{objetivo}</p>
            </div>
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
              style={{
                color: cliente?.revisado_por_coach ? 'rgb(22, 163, 74)' : 'rgb(217, 119, 6)',
                background: cliente?.revisado_por_coach ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.14)',
              }}
            >
              {cliente?.revisado_por_coach ? 'Activo' : 'Pendiente'}
            </span>
          </div>
        </header>

        <section className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>Estado de entrega</p>
              <div className="mt-3 space-y-2">
                <StatusRow label="Dieta activa" ok={Boolean(dietaActivaId)} />
                <StatusRow label="Entreno activo" ok={Boolean(entrenoActivoId)} />
              </div>
            </div>
            {!puedeAprobar && (
              <button
                type="button"
                onClick={() => router.push(`/clientes/${id}/revisar-plan`)}
                className="btn-secondary text-sm flex items-center gap-1.5 shrink-0"
              >
                Crear dieta
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </section>

        {plan ? (
          <section className="card p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>Plan IA</p>
                <p className="text-3xl font-bold mt-1" style={{ color: 'var(--text)' }}>{plan.kcal_objetivo}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>kcal objetivo</p>
              </div>
              <button
                type="button"
                onClick={regenerar}
                disabled={regenerando}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <RefreshCw size={14} className={regenerando ? 'animate-spin' : ''} />
                {regenerando ? 'Regenerando' : 'Regenerar'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Macro label="Proteína" value={`${plan.macros?.proteinas_g ?? '-'}g`} />
              <Macro label="Carbos" value={`${plan.macros?.carbos_g ?? '-'}g`} />
              <Macro label="Grasas" value={`${plan.macros?.grasas_g ?? '-'}g`} />
            </div>

            {plan.notas_coach && (
              <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--text)' }}>
                {plan.notas_coach}
              </div>
            )}
          </section>
        ) : (
          <section className="card p-4">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Plan todavía no generado</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Puedes regenerar para lanzar el motor IA otra vez.</p>
            <button
              type="button"
              onClick={regenerar}
              disabled={regenerando}
              className="btn-primary text-sm mt-4 flex items-center gap-2"
            >
              {regenerando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Generar plan
            </button>
          </section>
        )}

        {plan?.distribucion_comidas?.length ? (
          <section className="space-y-2">
            <p className="text-xs uppercase font-semibold tracking-wide px-1" style={{ color: 'var(--text-muted)' }}>
              Comidas y recetas compatibles
            </p>
            {plan.distribucion_comidas.map((comida, idx) => {
              const recetas = recetasPorComida[idx] ?? []
              return (
                <article key={`${comida.nombre}-${idx}`} className="card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{comida.nombre}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {comida.hora_sugerida ?? '--:--'} · {comida.kcal} kcal
                      </p>
                    </div>
                    <Utensils size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  {recetas.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {recetas.map(receta => (
                        <a
                          key={receta.id}
                          href={`/recetas/${receta.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] px-2 py-1 rounded-full border"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--surface)' }}
                        >
                          {receta.nombre}
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </section>
        ) : null}

        {plan?.alertas_coach?.length ? (
          <section className="card p-4">
            <p className="text-xs uppercase font-semibold tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Alertas coach</p>
            <ul className="space-y-2">
              {plan.alertas_coach.map((alerta, idx) => (
                <li key={idx} className="text-sm" style={{ color: 'var(--text)' }}>- {alerta}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {error && (
          <div className="rounded-lg border p-3 text-sm text-red-600 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
            {error}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-md grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => router.push(`/clientes/${id}/revisar-plan`)}
            className="btn-secondary h-12"
          >
            Ajustar
          </button>
          <button
            type="button"
            onClick={aprobar}
            disabled={!puedeAprobar || aprobando}
            className="btn-primary h-12 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {aprobando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            Aprobar
          </button>
        </div>
      </div>
    </main>
  )
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: ok ? 'rgb(34,197,94)' : 'rgb(245,158,11)' }}
      />
      <span style={{ color: 'var(--text)' }}>{label}</span>
      <span className="ml-auto text-xs" style={{ color: ok ? 'rgb(22,163,74)' : 'rgb(217,119,6)' }}>
        {ok ? 'Listo' : 'Pendiente'}
      </span>
    </div>
  )
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg)' }}>
      <p className="text-base font-bold" style={{ color: 'var(--text)' }}>{value}</p>
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}
