'use client'
import { useEffect, useMemo, useState } from 'react'
import { Barbell, CaretLeft, CaretRight, CircleDashed, CircleNotch, Footprints, Warning } from '@phosphor-icons/react'
import { DIAS_SEMANA_ABREVIATURA, DIAS_SEMANA_ORDEN } from '@/lib/entrenos/bloques'
import ListaEjerciciosExpandible, { type EjercicioDetalle } from './ExpandableExercises'
import PasosSesion, { extrasDeRespuesta, type ExtrasSesion } from './PasosSesion'
import { tituloSesionSinModalidad } from '@/lib/training/session-type-presentation'

export interface DiaMes {
  fecha: string
  dia_semana: string
  sesion: { id: string; nombre: string; tipo_sesion: 'hibrido' | 'carrera' | 'mixto'; ejercicios_count: number; completada: boolean } | null
  fase_bloque: string | null
  bloque_pendiente: boolean
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function agruparPorSemanas(dias: DiaMes[]): DiaMes[][] {
  if (dias.length === 0) return []
  const semanas: DiaMes[][] = []
  let semanaActual: DiaMes[] = []

  const primerDiaOrden = DIAS_SEMANA_ORDEN[dias[0].dia_semana] ?? 0
  for (let i = 0; i < primerDiaOrden; i++) {
    semanaActual.push({ fecha: '', dia_semana: '', sesion: null, fase_bloque: null, bloque_pendiente: false })
  }

  for (const dia of dias) {
    semanaActual.push(dia)
    if (semanaActual.length === 7) {
      semanas.push(semanaActual)
      semanaActual = []
    }
  }
  if (semanaActual.length > 0) {
    while (semanaActual.length < 7) semanaActual.push({ fecha: '', dia_semana: '', sesion: null, fase_bloque: null, bloque_pendiente: false })
    semanas.push(semanaActual)
  }
  return semanas
}

function formatFechaLarga(fecha: string) {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

interface CalendarioMesEntrenoProps {
  /** Si se oculta, siempre se muestra el mes completo (usado embebido en un sub-tab "Mes"). */
  mostrarToggleSemanaMes?: boolean
}

export default function CalendarioMesEntreno({ mostrarToggleSemanaMes = true }: CalendarioMesEntrenoProps) {
  const hoy = new Date()
  const [modo, setModo] = useState<'semana' | 'mes'>(mostrarToggleSemanaMes ? 'semana' : 'mes')
  const [year, setYear] = useState(hoy.getFullYear())
  const [month, setMonth] = useState(hoy.getMonth() + 1)
  const [dias, setDias] = useState<DiaMes[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>(hoyISO)
  const [detalles, setDetalles] = useState<Record<string, EjercicioDetalle[] | 'cargando'>>({})
  const [extras, setExtras] = useState<Record<string, ExtrasSesion | null>>({})

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`/api/entrenos/mes-completo?year=${year}&month=${month}`)
      .then(r => {
        if (!r.ok) throw new Error('No se pudo cargar el mes.')
        return r.json()
      })
      .then(data => setDias(data.dias ?? []))
      .catch(() => setError('No se pudo cargar el mes.'))
      .finally(() => setLoading(false))
  }, [year, month])

  const semanas = useMemo(() => agruparPorSemanas(dias), [dias])
  const semanaActual = useMemo(
    () => semanas.find(s => s.some(d => d.fecha === hoyISO)) ?? semanas[0] ?? [],
    [semanas, hoyISO]
  )
  const semanasVisibles = modo === 'semana' ? (semanaActual.length ? [semanaActual] : []) : semanas
  const diaInfo = dias.find(d => d.fecha === diaSeleccionado) ?? null

  useEffect(() => {
    const sesionId = diaInfo?.sesion?.id
    if (!sesionId || detalles[sesionId]) return
    setDetalles(prev => ({ ...prev, [sesionId]: 'cargando' }))
    fetch(`/api/cliente/sesion/${sesionId}`)
      .then(r => r.json())
      .then(data => {
        setDetalles(prev => ({ ...prev, [sesionId]: data.sesion?.ejercicios ?? [] }))
        setExtras(prev => ({ ...prev, [sesionId]: extrasDeRespuesta(data.sesion) }))
      })
      .catch(() => setDetalles(prev => ({ ...prev, [sesionId]: [] })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaInfo?.sesion?.id])

  function mesAnterior() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function mesSiguiente() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  function estadoDia(dia: DiaMes) {
    if (!dia.fecha) return 'is-empty'
    if (dia.bloque_pendiente) return 'is-pending'
    if (!dia.sesion) return 'is-rest'
    if (dia.sesion.completada) return 'is-complete'
    return dia.sesion.tipo_sesion === 'carrera' ? 'is-run' : 'is-strength'
  }

  return (
    <div className="training-calendar flex flex-col gap-4">
      {mostrarToggleSemanaMes && (
        <div className="training-calendar__view-switch">
          {(['semana', 'mes'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={modo === m ? 'is-active' : ''}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      <div className="training-calendar__period">
        <button onClick={mesAnterior} aria-label="Mes anterior">
          <CaretLeft size={17} />
        </button>
        <p><span>{String(month).padStart(2, '0')}</span>{MESES[month - 1]} {year}</p>
        <button onClick={mesSiguiente} aria-label="Mes siguiente">
          <CaretRight size={17} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <CircleNotch size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : error ? (
        <div
          className="flex items-center gap-2 rounded-3xl p-5 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <Warning size={16} style={{ color: 'var(--semantic-alert)' }} />
          {error}
        </div>
      ) : (
        <div className="training-calendar__grid-shell">
          <div className="training-calendar__weekdays grid grid-cols-7">
            {DIAS_SEMANA_ABREVIATURA.map(d => (
              <p key={d} className="text-center text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{d}</p>
            ))}
          </div>
          <div className="training-calendar__weeks">
            {semanasVisibles.map((semana, i) => {
              const fase = semana.find(d => d.fase_bloque)?.fase_bloque
              const pendiente = semana.some(d => d.bloque_pendiente)
              const etiqueta = fase && pendiente
                ? `Bloque ${fase} → bloque siguiente pendiente de generar`
                : pendiente
                  ? 'Bloque siguiente pendiente de generar'
                  : fase
                    ? `Bloque ${fase}`
                    : null
              return (
                <section key={i} className="training-calendar__week">
                  {etiqueta && (
                    <p className="training-calendar__phase">
                      {etiqueta}
                    </p>
                  )}
                  <div className="training-calendar__days grid grid-cols-7">
                    {semana.map((dia, j) => {
                      const esHoy = dia.fecha === hoyISO
                      const esSeleccionado = dia.fecha && dia.fecha === diaSeleccionado
                      return (
                        <div key={j} className="flex flex-col items-center gap-0.5">
                          {!dia.fecha ? (
                            <div className="training-calendar__day is-empty" />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDiaSeleccionado(dia.fecha)}
                              className={`training-calendar__day ${estadoDia(dia)} ${esSeleccionado ? 'is-selected' : ''} ${esHoy ? 'is-today' : ''}`}
                            >
                              {Number(dia.fecha.split('-')[2])}
                              {dia.sesion ? (
                                dia.sesion.tipo_sesion === 'carrera' ? <Footprints size={12} weight="regular" /> : <Barbell size={12} weight="regular" />
                              ) : modo === 'semana' ? (
                                <CircleDashed size={11} style={{ opacity: 0.5 }} />
                              ) : null}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}

      {/* Detalle del día seleccionado */}
      {!loading && !error && (
        <div className="training-calendar__detail">
          <p className="text-xs font-semibold uppercase tracking-wide first-letter:uppercase" style={{ color: 'var(--text-muted)' }}>
            {formatFechaLarga(diaSeleccionado)}
          </p>
          {diaInfo?.sesion ? (
            <>
              <div className="mt-2 flex items-center gap-3">
                <div className="training-calendar__session-icon">
                  {diaInfo.sesion.tipo_sesion === 'carrera'
                    ? <Footprints size={19} weight="regular" />
                    : <Barbell size={19} weight="regular" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight" style={{ color: 'var(--text)' }}>
                    {tituloSesionSinModalidad(diaInfo.sesion.nombre, diaInfo.sesion.tipo_sesion)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {diaInfo.sesion.ejercicios_count} ejercicios{diaInfo.sesion.completada ? ' · registrada' : ''}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                {detalles[diaInfo.sesion.id] === 'cargando' ? (
                  <div className="flex justify-center py-6"><CircleNotch size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
                ) : (
                  <>
                    {extras[diaInfo.sesion.id] && <PasosSesion sesionId={diaInfo.sesion.id} {...extras[diaInfo.sesion.id]!} />}
                    <ListaEjerciciosExpandible ejercicios={(detalles[diaInfo.sesion.id] as EjercicioDetalle[]) ?? []} />
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              {diaInfo?.bloque_pendiente ? 'Bloque siguiente pendiente de generar.' : 'Sin sesión programada — descanso.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
