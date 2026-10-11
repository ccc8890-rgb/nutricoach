'use client'
import { useEffect, useState } from 'react'
import type { FilaHojaDeRuta } from '@/lib/entrenos/hoja-de-ruta'

const FASE: Record<string, string> = { retorno: 'Retorno', base: 'Base', construccion: 'Construcción', especifica: 'Específica', tapering: 'Reducción', carrera: 'Carrera' }
const TIPO: Record<string, string> = { tirada: 'tirada', rodaje: 'rodaje', tempo: 'tempo', series: 'series', ritmo_carrera: 'ritmo carrera', strides: 'progresiones' }
const fecha = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}` }

/** Tabla de semanas previstas por el motor (y, si se conoce, lo realizado). Sin datos propios: solo presenta lo que recibe. */
export function TablaHojaDeRuta({ filas }: { filas: FilaHojaDeRuta[] }) {
  const max = Math.max(1, ...filas.map(f => Math.max(f.prevMin, f.realMin ?? 0)))
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-xs">
        <thead>
          <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
            <th className="py-1 pr-2 font-medium">Sem.</th><th className="pr-2 font-medium">Fase</th><th className="pr-2 font-medium">Carrera prevista</th><th className="pr-2 font-medium">Hecho</th><th className="pr-2 font-medium">Tirada</th><th className="font-medium">Sesiones</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(f => (
            <tr key={f.n} className="align-top" style={{ borderTop: '1px solid var(--border-light)', background: f.enCurso ? 'var(--bg-subtle)' : undefined }}>
              <td className="py-1.5 pr-2 tabular-nums"><span className="font-semibold">S{f.n}</span><span style={{ color: 'var(--text-muted)' }}> {fecha(f.lunes)}</span></td>
              <td className="pr-2">{FASE[f.fase] ?? f.fase}{f.descarga && <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: '1px solid var(--border-strong)' }}>descarga</span>}</td>
              <td className="pr-2">
                <div className="flex items-center gap-2"><div className="h-2 rounded" style={{ width: `${Math.round((f.prevMin / max) * 90)}px`, background: 'var(--text-muted)', opacity: 0.45 }} /><span className="tabular-nums">{f.prevMin} min</span></div>
              </td>
              <td className="pr-2 tabular-nums">{f.realMin === null ? <span style={{ color: 'var(--text-muted)' }}>—</span> : `${f.realMin} min${f.enCurso ? ' (en curso)' : ''}`}</td>
              <td className="pr-2 tabular-nums">{f.tiradaMin} min</td>
              <td style={{ color: 'var(--text-secondary)' }}>{f.tipos.map(t => TIPO[t] ?? t).join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface Datos { origen: 'aprobada' | 'propuesta' | null; filas: FilaHojaDeRuta[]; progresion: string | null; indicadores: string[]; avisos: string[] }

/** Hoja de ruta de ~2 meses en la ficha del cliente: previsión del motor frente a lo que ha hecho. */
export default function HojaDeRuta({ clienteId }: { clienteId: string }) {
  const [d, setD] = useState<Datos | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let vivo = true
    fetch(`/api/clientes/${clienteId}/hoja-de-ruta`).then(r => (r.ok ? r.json() : Promise.reject())).then(x => { if (vivo) setD(x) }).catch(() => { if (vivo) setError(true) })
    return () => { vivo = false }
  }, [clienteId])
  if (error) return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No se pudo cargar la hoja de ruta.</p>
  if (!d) return <div className="h-24 animate-pulse rounded-xl" style={{ background: 'var(--bg-subtle)' }} />
  if (!d.origen || d.filas.length === 0) return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Aún no hay una previsión de semanas: se crea al generar el plan con «Planificar con IA».</p>
  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {d.origen === 'propuesta' ? 'Previsión de la propuesta pendiente (aún sin aprobar). ' : 'Previsión del último plan aprobado. '}
        Es lo que el motor calcula con sus datos; se revisa cada bloque según cómo responda. Solo minutos de carrera: la fuerza va fija por el plan.
      </p>
      <TablaHojaDeRuta filas={d.filas} />
      {d.progresion && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}><span className="font-semibold">Cómo progresa: </span>{d.progresion}</p>}
      {d.indicadores.length > 0 && (
        <div className="text-xs"><p className="font-semibold">Qué debería mejorar (se mide con el reloj)</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5" style={{ color: 'var(--text-secondary)' }}>{d.indicadores.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      )}
      {d.avisos.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-xs" style={{ color: 'var(--text-muted)' }}>{d.avisos.map((x, i) => <li key={i}>{x}</li>)}</ul>}
    </div>
  )
}
