// components/training/PasosSesion.tsx
'use client'
import { useMemo, useState } from 'react'
import { WatchIcon } from '@phosphor-icons/react'
import { validarPasos, resumenSesion, lineaPaso, type PasoSimple } from '@/lib/entrenos/pasos'
import { formatearRitmo, type Ritmos } from '@/lib/entrenos/ritmos'

interface Props {
  sesionId: string
  pasos: unknown
  ritmos: Ritmos | null
  garmin: { workoutId: string | null; fecha: string | null }
}

function fechaLegible(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

export default function PasosSesion({ sesionId, pasos, ritmos, garmin }: Props) {
  const valido = useMemo(() => validarPasos(pasos), [pasos])
  const [enviando, setEnviando] = useState(false)
  const [estado, setEstado] = useState(garmin)
  const [error, setError] = useState('')

  if (!valido.ok) return null // JSON corrupto: no se muestra, la sesión sigue funcionando
  const resumen = resumenSesion(valido.pasos, ritmos)

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

  return (
    <section className="rounded-2xl p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Estructura de la sesión</h2>
        <p className="text-xs font-data" style={{ color: 'var(--text-muted)' }}>
          {(resumen.distancia_m / 1000).toFixed(1)} km
          {resumen.duracion_s !== null ? ` · ${Math.round(resumen.duracion_s / 60)} min` : ''}
        </p>
      </div>

      <ol className="space-y-2">
        {valido.pasos.map((p, i) =>
          p.tipo === 'repetir' ? (
            <li key={i} className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>{p.veces} ×</p>
              <ul className="space-y-0.5">
                {p.pasos.map((q: PasoSimple, j: number) => (
                  <li key={j} className="text-sm" style={{ color: 'var(--text-secondary)' }}>{lineaPaso(q, ritmos)}</li>
                ))}
              </ul>
            </li>
          ) : (
            <li key={i} className="text-sm px-1" style={{ color: 'var(--text-secondary)' }}>{lineaPaso(p, ritmos)}</li>
          ),
        )}
      </ol>

      {!ritmos && (
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          Sin VDOT en tu perfil no puedo calcular los ritmos; añádelo en Perfil atleta y se rellenarán solos.
        </p>
      )}
      {ritmos && (
        <p className="text-xs mt-3 font-data" style={{ color: 'var(--text-muted)' }}>
          Tus ritmos: E {formatearRitmo(ritmos.E)} · M {formatearRitmo(ritmos.M)} · T {formatearRitmo(ritmos.T)} · I {formatearRitmo(ritmos.I)} · R {formatearRitmo(ritmos.R)} /km
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={enviar}
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-[0.98] disabled:opacity-60"
          style={{ background: 'var(--semantic-active)', color: '#fff' }}
        >
          <WatchIcon size={16} />
          {enviando ? 'Enviando…' : estado.workoutId ? 'Reenviar a Garmin' : 'Enviar a Garmin'}
        </button>
        {estado.workoutId && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {estado.fecha ? `Programado en tu Garmin para el ${fechaLegible(estado.fecha)}` : 'Creado en tu Garmin (sin fecha)'}
          </p>
        )}
      </div>
      {error && <p className="text-xs mt-2" style={{ color: 'var(--semantic-danger, #c0392b)' }}>{error}</p>}
    </section>
  )
}
