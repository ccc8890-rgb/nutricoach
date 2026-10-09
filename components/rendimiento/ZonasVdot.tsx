'use client'
import { useCallback, useEffect, useState } from 'react'
import type { PanelZonas } from '@/lib/rendimiento/zonas'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const fechaCorta = (f: string) => { const d = new Date(`${f}T12:00:00Z`); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}` }
const ZONAS: { k: 'E' | 'M' | 'T' | 'I' | 'R'; nombre: string; para: string }[] = [
  { k: 'E', nombre: 'Fácil', para: 'rodajes y tirada larga' },
  { k: 'M', nombre: 'Maratón', para: 'ritmo sostenido largo' },
  { k: 'T', nombre: 'Umbral', para: 'tempo' },
  { k: 'I', nombre: 'Intervalos', para: 'series de 3-5 min' },
  { k: 'R', nombre: 'Repeticiones', para: 'series cortas y rápidas' },
]

export default function ZonasVdot({ clienteId }: { clienteId: string }) {
  const [datos, setDatos] = useState<PanelZonas | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const leer = useCallback(async () => {
    const r = await fetch(`/api/clientes/${clienteId}/rendimiento/zonas`, { cache: 'no-store' })
    if (r.ok) setDatos(await r.json())
    else setError('No se pudieron calcular las zonas')
  }, [clienteId])
  useEffect(() => { leer() }, [leer])

  async function aceptar(vdot: number, motivo: string) {
    if (!window.confirm(`¿Subir el VDOT a ${vdot}? Los ritmos de las sesiones con zona se recalcularán y el envío diario las reenviará al reloj.`)) return
    setGuardando(true); setError(null); setAviso(null)
    try {
      const r = await fetch(`/api/clientes/${clienteId}/rendimiento/zonas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vdot, motivo }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'No se pudo guardar')
      setAviso(`VDOT actualizado a ${j.vdot}. El reloj recibirá los ritmos nuevos con el próximo envío diario.`)
      await leer()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setGuardando(false) }
  }

  if (!datos) return error ? <p className="text-xs" style={{ color: '#E0557A' }}>{error}</p> : <div className="h-24 animate-pulse rounded-2xl" style={{ background: 'var(--surface)' }} />
  const r = datos.recalibracion

  return (
    <section className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Zonas y VDOT</h3>
      <p className="mb-3 mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
        El VDOT resume el nivel y fija todos los ritmos de entreno. Se estima con las salidas largas y exigentes de las últimas 26 semanas. Solo se propone subirlo con evidencia: nunca bajarlo por falta de pruebas.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['VDOT actual', r.vdotActual ?? '—'],
          ['Estimado por resultados', r.vdotEstimado ?? '—'],
          ['Según umbral Garmin', r.contraste.vdotUmbralGarmin ?? '—'],
          ['Confianza', r.confianza ?? '—'],
        ].map(([t, v]) => (
          <div key={String(t)} className="rounded-lg p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
            <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{v}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{r.motivo}</p>
      {r.sugerencia === 'subir' && r.propuesta !== null && (
        <button disabled={guardando} onClick={() => aceptar(r.propuesta!, r.motivo)} className="mt-2 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text)' }}>
          {guardando ? 'Guardando…' : `Subir el VDOT a ${r.propuesta}`}
        </button>
      )}
      {error && <p className="mt-2 text-xs" style={{ color: '#E0557A' }}>{error}</p>}
      {aviso && <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{aviso}</p>}

      {datos.zonasActuales && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead><tr style={{ color: 'var(--text-muted)' }}><th className="py-1 pr-3 font-medium">Zona</th><th className="pr-3 font-medium">Para</th><th className="pr-3 font-medium">Ritmo /km</th>{datos.zonasPropuestas && <th className="font-medium">Con {r.propuesta}</th>}</tr></thead>
            <tbody>
              {ZONAS.map(z => (
                <tr key={z.k} style={{ borderTop: '1px solid var(--border-light)' }}>
                  <td className="py-1.5 pr-3" style={{ color: 'var(--text)' }}>{z.nombre}</td>
                  <td className="pr-3" style={{ color: 'var(--text-muted)' }}>{z.para}</td>
                  <td className="pr-3 tabular-nums" style={{ color: 'var(--text)' }}>{mmss(datos.zonasActuales![z.k])}</td>
                  {datos.zonasPropuestas && <td className="tabular-nums" style={{ color: 'var(--text)' }}>{mmss(datos.zonasPropuestas[z.k])}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!!r.esfuerzos.length && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text)' }}>Esfuerzos que cuentan</p>
          <ul className="space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {r.esfuerzos.slice(0, 6).map((e, i) => <li key={i}><span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>{fechaCorta(e.fecha)}</span> · {e.descripcion} → VDOT <strong style={{ color: 'var(--text)' }}>{e.vdot}</strong></li>)}
          </ul>
        </div>
      )}

      {!!datos.historial.length && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text)' }}>Cambios anteriores</p>
          <ul className="space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {datos.historial.map((h, i) => <li key={i}><span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>{fechaCorta(h.fecha)}</span> · {h.anterior ?? '—'} → <strong style={{ color: 'var(--text)' }}>{h.vdot}</strong> · {h.motivo}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}
