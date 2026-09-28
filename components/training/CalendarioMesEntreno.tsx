'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronLeft, ChevronRight, CircleDashed, Dumbbell, Footprints, Loader2, Play, Eye } from 'lucide-react'
import { DIAS_SEMANA_ABREVIATURA, DIAS_SEMANA_ORDEN } from '@/lib/entrenos/bloques'

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

  function mesAnterior() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function mesSiguiente() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  function colorDia(dia: DiaMes) {
    if (!dia.fecha) return { background: 'transparent', color: 'transparent' }
    if (dia.bloque_pendiente) return { background: 'rgba(128,128,128,0.06)', color: 'var(--text-muted)' }
    if (!dia.sesion) return { background: 'rgba(128,128,128,0.08)', color: 'var(--text-muted)' }
    if (dia.sesion.completada) return { background: 'var(--semantic-active-bg)', color: 'var(--semantic-active)' }
    return dia.sesion.tipo_sesion === 'carrera'
      ? { background: 'var(--semantic-info-bg)', color: 'var(--semantic-info)' }
      : { background: 'rgba(99,102,241,0.12)', color: '#818CF8' }
  }

  return (
    <div className="flex flex-col gap-4">
      {mostrarToggleSemanaMes && (
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          {(['semana', 'mes'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className="flex-1 py-2.5 text-sm font-semibold capitalize transition-colors"
              style={{
                background: modo === m ? 'var(--primary)' : 'transparent',
                color: modo === m ? 'var(--bg)' : 'var(--text-muted)',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between rounded-2xl p-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <button onClick={mesAnterior} className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-bold capitalize" style={{ color: 'var(--text)' }}>{MESES[month - 1]} {year}</p>
        <button onClick={mesSiguiente} className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: 'var(--text-muted)' }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : error ? (
        <div
          className="flex items-center gap-2 rounded-3xl p-5 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <AlertTriangle size={16} style={{ color: 'var(--semantic-alert)' }} />
          {error}
        </div>
      ) : (
        <div className="rounded-3xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DIAS_SEMANA_ABREVIATURA.map(d => (
              <p key={d} className="text-center text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{d}</p>
            ))}
          </div>
          <div className="flex flex-col gap-2">
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
                <div key={i}>
                  {etiqueta && (
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                      {etiqueta}
                    </p>
                  )}
                  <div className="grid grid-cols-7 gap-1">
                    {semana.map((dia, j) => {
                      const style = colorDia(dia)
                      const esHoy = dia.fecha === hoyISO
                      const esSeleccionado = dia.fecha && dia.fecha === diaSeleccionado
                      return (
                        <div key={j} className="flex flex-col items-center gap-0.5">
                          {!dia.fecha ? (
                            <div className={modo === 'semana' ? 'h-16 w-full' : 'h-10 w-full'} />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDiaSeleccionado(dia.fecha)}
                              className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold transition-transform active:scale-95 ${modo === 'semana' ? 'h-16' : 'h-10'}`}
                              style={{
                                ...style,
                                border: esSeleccionado
                                  ? '1.5px solid var(--text)'
                                  : esHoy
                                    ? '1.5px solid var(--accent)'
                                    : '1px solid transparent',
                              }}
                            >
                              {Number(dia.fecha.split('-')[2])}
                              {dia.sesion ? (
                                dia.sesion.tipo_sesion === 'carrera' ? <Footprints size={11} /> : <Dumbbell size={11} />
                              ) : modo === 'semana' ? (
                                <CircleDashed size={11} style={{ opacity: 0.5 }} />
                              ) : null}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Detalle del día seleccionado */}
      {!loading && !error && (
        <div className="rounded-3xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide first-letter:uppercase" style={{ color: 'var(--text-muted)' }}>
            {formatFechaLarga(diaSeleccionado)}
          </p>
          {diaInfo?.sesion ? (
            <>
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: diaInfo.sesion.tipo_sesion === 'carrera' ? 'var(--semantic-info-bg)' : 'rgba(99,102,241,0.12)' }}
                >
                  {diaInfo.sesion.tipo_sesion === 'carrera'
                    ? <Footprints size={18} style={{ color: 'var(--semantic-info)' }} />
                    : <Dumbbell size={18} style={{ color: '#818CF8' }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight" style={{ color: 'var(--text)' }}>{diaInfo.sesion.nombre}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {diaInfo.sesion.ejercicios_count} ejercicios{diaInfo.sesion.completada ? ' · registrada' : ''}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href={`/cliente/sesion/${diaInfo.sesion.id}`}
                  className="flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold transition-transform active:scale-[0.98]"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                >
                  <Play size={13} fill="currentColor" /> Empezar
                </Link>
                <Link
                  href={`/cliente/sesion/${diaInfo.sesion.id}?modo=solo-ver`}
                  className="flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold transition-transform active:scale-[0.98]"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <Eye size={13} /> Solo ver
                </Link>
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
