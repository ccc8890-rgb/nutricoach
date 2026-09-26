'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Dumbbell, Footprints, Loader2 } from 'lucide-react'

interface DiaMes {
  fecha: string
  dia_semana: string
  sesion: { id: string; nombre: string; tipo_sesion: 'hibrido' | 'carrera' | 'mixto'; ejercicios_count: number; completada: boolean } | null
  fase_bloque: string | null
  bloque_pendiente: boolean
}

const DIAS_ABR = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const DIA_ORDEN: Record<string, number> = { Lunes: 0, Martes: 1, Miércoles: 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6 }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function agruparPorSemanas(dias: DiaMes[]): DiaMes[][] {
  if (dias.length === 0) return []
  const semanas: DiaMes[][] = []
  let semanaActual: DiaMes[] = []

  const primerDiaOrden = DIA_ORDEN[dias[0].dia_semana] ?? 0
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

export default function VistaMensualClientePage() {
  const hoy = new Date()
  const [year, setYear] = useState(hoy.getFullYear())
  const [month, setMonth] = useState(hoy.getMonth() + 1)
  const [dias, setDias] = useState<DiaMes[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/entrenos/mes-completo?year=${year}&month=${month}`)
      .then(r => r.ok ? r.json() : { dias: [] })
      .then(data => setDias(data.dias ?? []))
      .catch(() => setDias([]))
      .finally(() => setLoading(false))
  }, [year, month])

  const semanas = useMemo(() => agruparPorSemanas(dias), [dias])
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

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
    <div className="min-h-screen px-4 pb-8 pt-4" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/cliente/semana"
            replace
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Training OS</p>
            <h1 className="truncate text-xl font-bold" style={{ color: 'var(--text)' }}>Vista mensual</h1>
          </div>
        </div>

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
        ) : (
          <div className="rounded-3xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DIAS_ABR.map(d => (
                <p key={d} className="text-center text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{d}</p>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {semanas.map((semana, i) => {
                const fase = semana.find(d => d.fase_bloque)?.fase_bloque
                const pendiente = semana.some(d => d.bloque_pendiente)
                return (
                  <div key={i}>
                    {(fase || pendiente) && (
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                        {pendiente ? 'Bloque siguiente pendiente de generar' : `Bloque ${fase}`}
                      </p>
                    )}
                    <div className="grid grid-cols-7 gap-1">
                      {semana.map((dia, j) => {
                        const style = colorDia(dia)
                        const esHoy = dia.fecha === hoyISO
                        return (
                          <div key={j} className="flex flex-col items-center gap-0.5">
                            {dia.fecha ? (
                              <Link
                                href={dia.sesion ? `/cliente/sesion/${dia.sesion.id}?modo=solo-ver` : '#'}
                                className="flex h-10 w-full flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold"
                                style={{ ...style, border: esHoy ? '1.5px solid var(--accent)' : '1px solid transparent' }}
                              >
                                {new Date(dia.fecha).getDate()}
                                {dia.sesion && (
                                  dia.sesion.tipo_sesion === 'carrera'
                                    ? <Footprints size={11} />
                                    : <Dumbbell size={11} />
                                )}
                              </Link>
                            ) : (
                              <div className="h-10 w-full" />
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
      </div>
    </div>
  )
}
