'use client'
import { useEffect, useMemo, useState } from 'react'
import GeneralRendimiento from './GeneralRendimiento'
import RunningRendimiento from './RunningRendimiento'
import DeporteGenerico from './DeporteGenerico'
import { Pestanas, type DatosPanel } from './comun'
import { useEstadoUrl } from '@/lib/useEstadoUrl'
import { NOMBRE_DEPORTE, type DeporteConPanel } from '@/lib/rendimiento/deportes'

const RANGOS = [{ d: 42, t: '6 sem' }, { d: 90, t: '3 meses' }, { d: 180, t: '6 meses' }, { d: 365, t: '1 año' }]
const CLAVES_VISTA = ['general', 'running', 'ciclismo', 'natacion', 'fuerza'] as const
type Vista = (typeof CLAVES_VISTA)[number]

/**
 * Panel de rendimiento del atleta, organizado por deporte:
 * «General» suma todo; cada deporte con datos tiene su apartado (Running siempre).
 * Cada apartado lleva sus propias pestañas (parámetro `rend` de la URL).
 */
export default function PanelRendimiento({ clienteId }: { clienteId: string }) {
  const [dias, setDias] = useState(90)
  const [vistaUrl, setVista] = useEstadoUrl<Vista>('dep', 'general', CLAVES_VISTA)
  const [datos, setDatos] = useState<DatosPanel | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    setError(null)
    fetch(`/api/clientes/${clienteId}/rendimiento?dias=${dias}`, { cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Error al cargar'); return r.json() })
      .then(j => { if (vivo) setDatos(j) })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar') })
    return () => { vivo = false }
  }, [clienteId, dias])

  const vistas = useMemo(() => {
    const conDatos = (datos?.deportes ?? []).filter(d => d.deporte === 'running' || d.sesiones > 0).map(d => d.deporte)
    return [{ key: 'general' as Vista, titulo: 'General' }, ...conDatos.map(d => ({ key: d as Vista, titulo: NOMBRE_DEPORTE[d] }))]
  }, [datos])

  if (error) return <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
  if (!datos) return <div className="h-64 animate-pulse rounded-2xl" style={{ background: 'var(--surface)' }} />
  if (!datos.resumen || !datos.entrenos.length) {
    return <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Aún no hay entrenos de Garmin o Strava para este atleta.</p>
  }

  // Si la URL pide un deporte que no tiene datos, se cae a General.
  const vista: Vista = vistas.some(v => v.key === vistaUrl) ? vistaUrl : 'general'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Datos de Garmin · carga estimada por ritmo y pulso (TSS)</p>
        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          {RANGOS.map(x => (
            <button key={x.d} onClick={() => setDias(x.d)} className="rounded-md px-2.5 py-1 text-xs"
              style={{ background: dias === x.d ? 'var(--surface-elevated)' : 'transparent', color: dias === x.d ? 'var(--text)' : 'var(--text-muted)' }}>
              {x.t}
            </button>
          ))}
        </div>
      </div>

      <Pestanas items={vistas} valor={vista} onChange={setVista} etiqueta="Deporte" grande />

      {vista === 'general' && <GeneralRendimiento clienteId={clienteId} datos={datos} />}
      {vista === 'running' && <RunningRendimiento clienteId={clienteId} datos={datos} />}
      {vista !== 'general' && vista !== 'running' && <DeporteGenerico key={vista} deporte={vista as Exclude<DeporteConPanel, 'running'>} datos={datos} />}
    </div>
  )
}
