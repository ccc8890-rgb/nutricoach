'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Loader2, Dumbbell } from 'lucide-react'
import PlanTimeline, {
  type SemanaTimeline,
  type SesionTimeline,
  type EjercicioTimeline,
} from '@/components/training/PlanTimeline'

interface PlanInfo {
  id: string
  nombre: string
  activo: boolean
  duracion_semanas: number | null
  cliente_id: string
  cliente_nombre: string
}

interface RawEjercicio {
  id: string
  ejercicio_id: string
  series: number
  repeticiones: string
  descanso_segundos: number
  peso_sugerido: string | null
  rpe: string | null
  notas: string | null
  instruccion_ejercicio: string | null
  contexto_ia: string | null
  orden: number
  ejercicio: { id: string; nombre: string; grupo_muscular: string; tipo: string; foto_url?: string | null; video_url?: string | null } | null
}

interface RawSesion {
  id: string
  nombre: string
  dia_semana: string
  orden: number
  duracion_estimada_min: number | null
  contexto_ia: string | null
  ejercicios: RawEjercicio[]
}

const DIAS_ORDER: Record<string, number> = {
  Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4,
  Viernes: 5, Sábado: 6, Domingo: 7,
}

function agruparPorSemanas(sesiones: RawSesion[], duracion: number | null): SemanaTimeline[] {
  if (!sesiones.length) return []
  const total = Math.max(1, duracion ?? 1)
  const porSemana = Math.ceil(sesiones.length / total)
  const semanas: SemanaTimeline[] = []

  for (let s = 0; s < total; s++) {
    const chunk = sesiones.slice(s * porSemana, (s + 1) * porSemana)
    if (!chunk.length) continue

    const sesionesTimeline: SesionTimeline[] = chunk
      .sort((a, b) => (DIAS_ORDER[a.dia_semana] ?? 99) - (DIAS_ORDER[b.dia_semana] ?? 99))
      .map(ses => ({
        id: ses.id,
        nombre: ses.nombre,
        dia_semana: ses.dia_semana,
        orden: ses.orden,
        duracion_estimada_min: ses.duracion_estimada_min ?? undefined,
        ejercicios: ses.ejercicios
          .sort((a, b) => a.orden - b.orden)
          .map((ej): EjercicioTimeline => ({
            id: ej.id,
            ejercicio_id: ej.ejercicio_id,
            nombre: ej.ejercicio?.nombre ?? '—',
            grupo_muscular: ej.ejercicio?.grupo_muscular ?? '',
            series: ej.series,
            repeticiones: ej.repeticiones,
            descanso_segundos: ej.descanso_segundos,
            peso_sugerido: ej.peso_sugerido ?? '',
            rpe: ej.rpe ?? '',
            notas: ej.notas ?? '',
            instruccion_ejercicio: ej.instruccion_ejercicio ?? '',
            contexto_ia: ej.contexto_ia ?? null,
            orden: ej.orden,
            foto_url: ej.ejercicio?.foto_url ?? null,
            video_url: ej.ejercicio?.video_url ?? null,
          })),
      }))

    semanas.push({ numero: s + 1, sesiones: sesionesTimeline })
  }

  return semanas
}

export default function PlanEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [plan, setPlan] = useState<PlanInfo | null>(null)
  const [semanas, setSemanas] = useState<SemanaTimeline[]>([])
  const [sesionesFlat, setSesionesFlat] = useState<{ id: string; nombre: string; dia_semana: string; semana: number }[]>([])
  const [selectedSesionId, setSelectedSesionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch(`/api/entrenos/${id}`)

    if (res.status === 404 || res.status === 403) {
      router.push('/entrenos')
      return
    }

    if (!res.ok) {
      setLoading(false)
      return
    }

    const { plan: planData, sesiones: sesData } = await res.json()
    const cli = (planData as unknown as { cliente: { profile: { nombre: string; apellidos: string } } | null }).cliente
    const planInfo: PlanInfo = {
      id: planData.id,
      nombre: planData.nombre,
      activo: planData.activo,
      duracion_semanas: planData.duracion_semanas,
      cliente_id: planData.cliente_id,
      cliente_nombre: `${cli?.profile?.nombre ?? ''} ${cli?.profile?.apellidos ?? ''}`.trim(),
    }

    const sesiones = (sesData ?? []) as unknown as RawSesion[]
    const semanasList = agruparPorSemanas(sesiones, planData.duracion_semanas)
    const flat = semanasList.flatMap(s =>
      s.sesiones.map(ses => ({
        id: ses.id,
        nombre: ses.nombre,
        dia_semana: ses.dia_semana,
        semana: s.numero,
      }))
    )

    setPlan(planInfo)
    setSemanas(semanasList)
    setSesionesFlat(flat)
    setSelectedSesionId(current => current ?? flat[0]?.id ?? null)
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function handleReorder(sesionId: string, ejerciciosOrdenados: string[]) {
    // Optimistic update
    setSemanas(prev => prev.map(sem => ({
      ...sem,
      sesiones: sem.sesiones.map(ses => {
        if (ses.id !== sesionId) return ses
        const map = new Map(ses.ejercicios.map(e => [e.id, e]))
        return {
          ...ses,
          ejercicios: ejerciciosOrdenados
            .filter(eid => map.has(eid))
            .map((eid, i) => ({
              ...map.get(eid)!,
              orden: i,
            })),
        }
      }),
    })))

    await Promise.all(
      ejerciciosOrdenados.map((eid, i) =>
        supabase.from('sesion_ejercicios').update({ orden: i }).eq('id', eid)
      )
    )
  }

  async function handleUpdateEjercicio(sesionEjercicioId: string, field: 'instruccion_ejercicio', value: string) {
    await supabase.from('sesion_ejercicios').update({ [field]: value }).eq('id', sesionEjercicioId)
    setSemanas(prev => prev.map(sem => ({
      ...sem,
      sesiones: sem.sesiones.map(ses => ({
        ...ses,
        ejercicios: ses.ejercicios.map(ej =>
          ej.id === sesionEjercicioId ? { ...ej, [field]: value } : ej
        ),
      })),
    })))
  }

  async function handleMover(ejercicioId: string, destSesionId: string) {
    await supabase.from('sesion_ejercicios').update({ sesion_id: destSesionId }).eq('id', ejercicioId)
    setLoading(true)
    await load()
  }

  function handleToggleContextoIA(sesionId: string) {
    fetch('/api/entrenos/generar-contexto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sesion_id: sesionId }),
    }).then(() => load())
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--semantic-info)' }} />
      </div>
    )
  }

  if (!plan) return null

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/entrenos" style={{ color: 'var(--text-muted)' }} aria-label="Volver">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate" style={{ color: 'var(--text)' }}>{plan.nombre}</h1>
          {plan.cliente_nombre && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{plan.cliente_nombre}</p>
          )}
        </div>
        <span
          className="text-xs px-2 py-1 rounded-full font-medium flex-shrink-0"
          style={{
            background: plan.activo ? 'rgba(34,197,94,0.12)' : 'var(--surface)',
            color: plan.activo ? 'rgb(34,197,94)' : 'var(--text-muted)',
          }}
        >
          {plan.activo ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-5">
        <aside className="hidden lg:block">
          <div className="glass-card p-3 sticky top-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-3" style={{ color: 'var(--text-muted)' }}>
              Navegación del bloque
            </p>
            <div className="space-y-1.5 max-h-[70dvh] overflow-y-auto pr-1">
              {sesionesFlat.map(s => {
                const active = selectedSesionId === s.id
                return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSesionId(s.id)}
                  className="block w-full text-left rounded-lg px-3 py-2 text-xs transition-colors"
                  style={{
                    color: active ? 'var(--text)' : 'var(--text-secondary)',
                    border: `1px solid ${active ? 'var(--semantic-info-border)' : 'var(--border)'}`,
                    background: active ? 'var(--semantic-info-bg)' : 'var(--bg)',
                  }}
                >
                  <span className="font-data" style={{ color: 'var(--semantic-info)' }}>S{s.semana}</span>
                  {' · '}{s.dia_semana}
                  <span className="block truncate mt-0.5" style={{ color: 'var(--text)' }}>{s.nombre}</span>
                </button>
              )})}
            </div>
          </div>
        </aside>

        <main className="min-w-0 glass-card p-4 sm:p-5">
          {semanas.length === 0 ? (
            <div className="text-center py-12">
              <Dumbbell size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-muted)' }}>Sin sesiones en este plan</p>
            </div>
          ) : (
            <PlanTimeline
              semanas={semanas}
              selectedSesionId={selectedSesionId}
              onReorder={handleReorder}
              onMover={handleMover}
              onToggleContextoIA={handleToggleContextoIA}
              onUpdateEjercicio={handleUpdateEjercicio}
              sesionesDisponibles={sesionesFlat}
            />
          )}
        </main>
      </div>
    </div>
  )
}
