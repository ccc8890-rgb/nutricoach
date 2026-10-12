// components/training/PasosSesion.tsx
'use client'
import { useMemo, useState } from 'react'
import { Watch } from '@phosphor-icons/react'
import { validarPasos, resumenSesion, textoCorto, zonasUsadas, ZONAS_RITMO } from '@/lib/entrenos/pasos'
import type { Ritmos } from '@/lib/entrenos/ritmos'
import type { ZonasFc } from '@/lib/entrenos/zonas-fc'

export interface ExtrasSesion {
  pasos: unknown
  ritmos: Ritmos | null
  fc?: ZonasFc | null
  garmin: { workoutId: string | null; fecha: string | null }
}

export function extrasDeRespuesta(sesion: { pasos?: unknown; ritmos?: Ritmos | null; fc?: ZonasFc | null; garmin?: ExtrasSesion['garmin'] } | undefined): ExtrasSesion | null {
  if (!sesion?.pasos) return null
  return { pasos: sesion.pasos, ritmos: sesion.ritmos ?? null, fc: sesion.fc ?? null, garmin: sesion.garmin ?? { workoutId: null, fecha: null } }
}

interface Props {
  sesionId: string
  pasos: unknown
  ritmos: Ritmos | null
  fc?: ZonasFc | null
  garmin: { workoutId: string | null; fecha: string | null }
}

function fechaLegible(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

export default function PasosSesion({ sesionId, pasos, ritmos, fc, garmin }: Props) {
  const valido = useMemo(() => validarPasos(pasos), [pasos])
  const [enviando, setEnviando] = useState(false)
  const [estado, setEstado] = useState(garmin)
  const [error, setError] = useState('')

  if (!valido.ok) return null // JSON corrupto: no se muestra, la sesión sigue funcionando
  const resumen = resumenSesion(valido.pasos, ritmos)
  const zonas = zonasUsadas(valido.pasos)

  async function enviar() {
    setEnviando(true)
    setError('')
    try {
      const res = await fetch(`/api/entrenos/sesiones/${sesionId}/garmin`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo enviar a Garmin')
      setEstado({ workoutId: data.workoutId, fecha: data.fecha })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar a Garmin')
    } finally {
      setEnviando(false)
    }
  }

  const zonasTxt = zonas.map(z => `${ZONAS_RITMO[z].nombre}${fc?.[z] ? ` ${z === 'E' ? 'máx. ' + fc[z]!.max : `${fc[z]!.min}–${fc[z]!.max}`} ppm` : ''}`).join(' · ')

  return (
    <section className="rounded-2xl px-3.5 py-3 mb-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
          <Watch size={14} className="mr-1.5 inline align-[-2px]" />
          Se envía a tu Garmin
          <span className="font-data font-normal" style={{ color: 'var(--text-muted)' }}>
            {' · '}{(resumen.distancia_m / 1000).toFixed(1).replace('.', ',')} km{resumen.duracion_s !== null ? ` · ${Math.round(resumen.duracion_s / 60)} min` : ''}
          </span>
        </p>
        <button
          type="button"
          onClick={enviar}
          disabled={enviando}
          className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold active:scale-[0.98] disabled:opacity-60"
          style={{ color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          {enviando ? 'Enviando…' : estado.workoutId ? 'Reenviar' : 'Enviar'}
        </button>
      </div>

      <p className="mt-2 text-[13px] leading-snug" style={{ color: 'var(--text-secondary)' }}>{textoCorto(valido.pasos, ritmos)}</p>

      <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {estado.workoutId ? (estado.fecha ? `Programado para el ${fechaLegible(estado.fecha).slice(0, 5)}` : 'Creado en tu Garmin') : 'Aún no enviada'}
        {zonasTxt ? ` · ${zonasTxt}` : ''}
      </p>

      {!ritmos && (
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Sin VDOT en tu perfil no se calculan los ritmos; añádelo en Perfil atleta.
        </p>
      )}
      {error && <p className="text-xs mt-2" style={{ color: 'var(--semantic-danger, #c0392b)' }}>{error}</p>}
    </section>
  )
}
