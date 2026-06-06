'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Dumbbell,
  Eye,
  Loader2,
  Play,
  Target,
} from 'lucide-react'
import { crearClienteWeekSummary } from '@/lib/training/client-week'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
const DIAS_ABR: Record<string, string> = {
  Lunes: 'L',
  Martes: 'M',
  Miércoles: 'X',
  Jueves: 'J',
  Viernes: 'V',
  Sábado: 'S',
  Domingo: 'D',
}
const DIAS_ORDER: Record<string, number> = {
  Lunes: 0,
  Martes: 1,
  Miércoles: 2,
  Jueves: 3,
  Viernes: 4,
  Sábado: 5,
  Domingo: 6,
}

interface SesionSemana {
  id: string
  nombre: string
  dia_semana: string
  ejercicios_count: number
  duracion_estimada_min: number | null
  contexto_ia?: string | null
  fecha: string
  fechaLabel: string
  ejercicioIds: string[]
  registros_count: number
  completada: boolean
  esHoy: boolean
}

function startOfWeek(date = new Date()) {
  const result = new Date(date)
  const day = result.getDay()
  const diff = day === 0 ? 6 : day - 1
  result.setDate(result.getDate() - diff)
  result.setHours(0, 0, 0, 0)
  return result
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function toISODate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatShortDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  })
}

export default function VistaSemanalClientePage() {
  const [sesiones, setSesiones] = useState<SesionSemana[]>([])
  const [loading, setLoading] = useState(true)
  const [planNombre, setPlanNombre] = useState('')
  const [error, setError] = useState('')

  const weekStart = useMemo(() => startOfWeek(), [])
  const todayISO = useMemo(() => toISODate(new Date()), [])
  const weekEndISO = useMemo(() => toISODate(addDays(weekStart, 6)), [weekStart])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('No se ha podido validar tu sesión.')
        setLoading(false)
        return
      }

      const { data: clienteData } = await supabase
        .from('clientes')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!clienteData) {
        setError('No encontramos tu perfil de cliente.')
        setLoading(false)
        return
      }

      const { data: planEntreno } = await supabase
        .from('planes_entrenamiento')
        .select('id, nombre')
        .eq('cliente_id', clienteData.id)
        .eq('activo', true)
        .single()

      if (!planEntreno) {
        setSesiones([])
        setLoading(false)
        return
      }

      setPlanNombre(planEntreno.nombre)

      const { data: sesData } = await supabase
        .from('sesiones_entrenamiento')
        .select('id, nombre, dia_semana, duracion_estimada_min, contexto_ia, ejercicios:sesion_ejercicios(id)')
        .eq('plan_id', planEntreno.id)
        .order('orden')

      const sesionesBase = ((sesData ?? []) as Array<{
        id: string
        nombre: string
        dia_semana: string | null
        duracion_estimada_min: number | null
        contexto_ia?: string | null
        ejercicios?: Array<{ id: string }>
      }>).map(s => {
        const dia = s.dia_semana ?? ''
        const fecha = toISODate(addDays(weekStart, DIAS_ORDER[dia] ?? 0))
        const ejercicioIds = Array.isArray(s.ejercicios) ? s.ejercicios.map(e => e.id).filter(Boolean) : []
        return {
          id: s.id,
          nombre: s.nombre,
          dia_semana: dia,
          duracion_estimada_min: s.duracion_estimada_min ?? null,
          contexto_ia: s.contexto_ia ?? null,
          ejercicios_count: ejercicioIds.length,
          ejercicioIds,
          fecha,
          fechaLabel: formatShortDate(fecha),
          registros_count: 0,
          completada: false,
          esHoy: fecha === todayISO,
        }
      })

      const allEjercicioIds = sesionesBase.flatMap(s => s.ejercicioIds)
      const registrosPorEjercicioFecha = new Map<string, number>()

      if (allEjercicioIds.length > 0) {
        const { data: registros } = await supabase
          .from('registros_sets')
          .select('sesion_ejercicio_id, fecha')
          .eq('cliente_id', clienteData.id)
          .gte('fecha', toISODate(weekStart))
          .lte('fecha', weekEndISO)
          .in('sesion_ejercicio_id', allEjercicioIds)

        for (const registro of registros ?? []) {
          const key = `${registro.sesion_ejercicio_id}:${registro.fecha}`
          registrosPorEjercicioFecha.set(key, (registrosPorEjercicioFecha.get(key) ?? 0) + 1)
        }
      }

      setSesiones(
        sesionesBase
          .sort((a, b) => (DIAS_ORDER[a.dia_semana] ?? 9) - (DIAS_ORDER[b.dia_semana] ?? 9))
          .map(s => {
            const registrosCount = s.ejercicioIds.reduce((total, ejercicioId) => (
              total + (registrosPorEjercicioFecha.get(`${ejercicioId}:${s.fecha}`) ?? 0)
            ), 0)
            return {
              ...s,
              registros_count: registrosCount,
              completada: registrosCount > 0,
            }
          })
      )
      setLoading(false)
    }

    load()
  }, [todayISO, weekEndISO, weekStart])

  const resumenSemana = useMemo(() => crearClienteWeekSummary({ sesiones }), [sesiones])
  const sesionPrincipal = resumenSemana.sesionPrincipal

  return (
    <div className="min-h-screen px-4 pb-8 pt-4" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/cliente"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
              Training OS
            </p>
            <h1 className="truncate text-xl font-bold" style={{ color: 'var(--text)' }}>
              Semana actual
            </h1>
          </div>
        </div>

        <section
          className="glass-card overflow-hidden rounded-3xl p-5"
          style={{ border: '1px solid var(--border)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {toISODate(weekStart).split('-').reverse().join('-')} / {weekEndISO.split('-').reverse().join('-')}
              </p>
              <h2 className="mt-1 truncate text-lg font-bold" style={{ color: 'var(--text)' }}>
                {planNombre || 'Tu plan de entrenamiento'}
              </h2>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {resumenSemana.mensajeCliente}
              </p>
            </div>
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: 'var(--semantic-info-bg)', border: '1px solid var(--semantic-info-border)' }}
            >
              <Dumbbell size={22} style={{ color: 'var(--semantic-info)' }} />
            </div>
          </div>

          <div className="mt-5 rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Progreso semanal</p>
                <p className="mt-1 text-2xl font-black tabular-nums" style={{ color: 'var(--text)' }}>{resumenSemana.progresoPct}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{resumenSemana.completadas}/{resumenSemana.totalSesiones}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>sesiones hechas</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'rgba(128,128,128,0.14)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${resumenSemana.progresoPct}%`, background: 'var(--accent)' }}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{resumenSemana.totalSesiones}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>sesiones</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-lg font-bold" style={{ color: 'var(--semantic-active)' }}>{resumenSemana.pendientes}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>pendientes</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{resumenSemana.minutosPlanificados || '-'}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>min plan</p>
            </div>
          </div>

          {sesionPrincipal && (
            <div className="mt-5 rounded-3xl p-4" style={{ background: 'rgba(201,169,110,0.10)', border: '1px solid rgba(201,169,110,0.24)' }}>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                  <Target size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
                    {sesionPrincipal.esHoy ? 'Sesión de hoy' : 'Próxima sesión'}
                  </p>
                  <h3 className="mt-1 truncate text-base font-bold" style={{ color: 'var(--text)' }}>{sesionPrincipal.nombre}</h3>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {sesionPrincipal.dia_semana || 'Sesión'} · {sesionPrincipal.ejercicios_count} ejercicios{sesionPrincipal.duracion_estimada_min ? ` · ${sesionPrincipal.duracion_estimada_min} min` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href={`/cliente/sesion/${sesionPrincipal.id}`}
                  replace
                  className="flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold transition-transform active:scale-[0.98]"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                >
                  <Play size={13} fill="currentColor" />
                  Empezar
                </Link>
                <Link
                  href={`/cliente/sesion/${sesionPrincipal.id}?modo=solo-ver`}
                  replace
                  className="flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold transition-transform active:scale-[0.98]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <Eye size={13} />
                  Revisar
                </Link>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-1.5">
            {DIAS.map(dia => {
              const sesion = sesiones.find(s => s.dia_semana === dia)
              const active = Boolean(sesion)
              const done = Boolean(sesion?.completada)
              const isToday = sesion?.esHoy || (!sesion && DIAS_ORDER[dia] === DIAS_ORDER[new Date().toLocaleDateString('es-ES', { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())])
              return (
                <div key={dia} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      background: done
                        ? 'var(--semantic-active-bg)'
                        : isToday && active
                          ? 'var(--accent)'
                          : active
                            ? 'var(--semantic-info-bg)'
                            : 'rgba(128,128,128,0.08)',
                      color: done
                        ? 'var(--semantic-active)'
                        : isToday && active
                          ? 'var(--bg)'
                          : active
                            ? 'var(--semantic-info)'
                            : 'var(--text-muted)',
                      border: `1px solid ${done ? 'var(--semantic-active-border)' : active ? 'var(--semantic-info-border)' : 'transparent'}`,
                    }}
                  >
                    {done ? <CheckCircle2 size={15} /> : DIAS_ABR[dia]}
                  </div>
                  <div
                    className="h-1 w-1 rounded-full"
                    style={{ background: isToday ? 'var(--accent)' : 'transparent' }}
                  />
                </div>
              )
            })}
          </div>
        </section>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : error ? (
          <div className="rounded-3xl p-5 text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {error}
          </div>
        ) : sesiones.length === 0 ? (
          <div className="rounded-3xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>Sin sesiones esta semana</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Tu coach aún no ha cargado entrenamientos activos.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sesiones.map(s => (
              <article
                key={s.id}
                className="rounded-3xl p-4"
                style={{
                  background: s.esHoy ? 'var(--glass-bg)' : 'var(--surface)',
                  border: `1px solid ${s.esHoy ? 'var(--accent)' : 'var(--border)'}`,
                  boxShadow: s.esHoy ? '0 18px 50px rgba(0,0,0,0.12)' : 'none',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl"
                    style={{
                      background: s.completada ? 'var(--semantic-active-bg)' : s.esHoy ? 'var(--accent)' : 'var(--bg)',
                      border: `1px solid ${s.completada ? 'var(--semantic-active-border)' : s.esHoy ? 'var(--accent)' : 'var(--border)'}`,
                      color: s.completada ? 'var(--semantic-active)' : s.esHoy ? 'var(--bg)' : 'var(--text-muted)',
                    }}
                  >
                    {s.completada ? <CheckCircle2 size={18} /> : <span className="text-sm font-black">{DIAS_ABR[s.dia_semana] ?? '?'}</span>}
                    <span className="text-[9px] font-semibold uppercase">{s.fechaLabel.replace('.', '')}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-bold" style={{ color: 'var(--text)' }}>{s.nombre}</h2>
                      {s.esHoy && !s.completada && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                          Hoy
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span className="inline-flex items-center gap-1"><Dumbbell size={12} /> {s.ejercicios_count} ejercicios</span>
                      {s.duracion_estimada_min && (
                        <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {s.duracion_estimada_min} min</span>
                      )}
                      {s.completada && <span style={{ color: 'var(--semantic-active)' }}>{s.registros_count} sets registrados</span>}
                    </p>
                    {s.contexto_ia && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {s.contexto_ia}
                      </p>
                    )}
                  </div>

                  <ChevronRight size={16} className="mt-1 shrink-0" style={{ color: 'var(--text-muted)' }} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    href={`/cliente/sesion/${s.id}`}
                    replace
                    className="flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold transition-transform active:scale-[0.98]"
                    style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                  >
                    <Play size={13} fill="currentColor" />
                    Registrar
                  </Link>
                  <Link
                    href={`/cliente/sesion/${s.id}?modo=solo-ver`}
                    replace
                    className="flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold transition-transform active:scale-[0.98]"
                    style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <Eye size={13} />
                    Solo ver
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
