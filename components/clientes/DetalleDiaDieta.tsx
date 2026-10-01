'use client'

import { useEffect, useState } from 'react'
import { Clock, ExternalLink, Loader2, RefreshCw, Video, X } from 'lucide-react'
import type { DetalleDia } from '@/lib/nutricion/detalle-dia'

type Objetivo = { kcal: number | null; p: number | null; c: number | null; g: number | null }

function Barra({ etiqueta, valor, objetivo, color, unidad }: { etiqueta: string; valor: number; objetivo: number | null; color: string; unidad: string }) {
  const pct = objetivo ? Math.round((valor / objetivo) * 100) : null
  const fuera = pct != null && Math.abs(pct - 100) > 15
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{etiqueta}</span>
        {pct != null && <span className="text-[11px] font-data" style={{ color: fuera ? 'var(--warning)' : 'var(--text-muted)' }}>{pct}%</span>}
      </div>
      <p className="text-lg font-semibold font-data leading-tight" style={{ color: 'var(--text)' }}>
        {valor}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{unidad}{objetivo ? ` / ${Math.round(objetivo)}` : ''}</span>
      </p>
      <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct ?? 0)}%`, background: color }} />
      </div>
    </div>
  )
}

export default function DetalleDiaDieta({ clienteId, dia, semana, objetivo, version, onCambiar, onQuitar }: {
  clienteId: string; dia: string; semana: number | null; objetivo: Objetivo; version: number
  onCambiar: (franja: string) => void; onQuitar: (comidaId: string, recurrente: boolean) => void
}) {
  const [detalle, setDetalle] = useState<DetalleDia | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    fetch(`/api/clientes/${clienteId}/semana-dieta/dia?dia=${encodeURIComponent(dia)}${semana ? `&semana=${semana}` : ''}`)
      .then(async res => ({ ok: res.ok, data: await res.json().catch(() => null) }))
      .then(({ ok, data }) => {
        if (!vigente) return
        if (!ok) { setError(data?.error ?? 'No se pudo cargar el día'); setDetalle(null) } else { setError(null); setDetalle(data) }
        setCargando(false)
      })
    return () => { vigente = false }
  }, [clienteId, dia, semana, version])

  return (
    <div className="mt-3 rounded-2xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="font-semibold" style={{ color: 'var(--text)' }}>
          {dia} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>· {semana ? `semana +${semana} · cantidades estimadas` : 'semana en curso'}</span>
        </p>
        {cargando && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--error)' }}>{error}</p>}

      {detalle && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Barra etiqueta="Kcal" valor={detalle.total.kcal} objetivo={objetivo.kcal} color="var(--accent)" unidad="" />
            <Barra etiqueta="Proteína" valor={detalle.total.p} objetivo={objetivo.p} color="#30D158" unidad=" g" />
            <Barra etiqueta="Hidratos" valor={detalle.total.c} objetivo={objetivo.c} color="#FF9F0A" unidad=" g" />
            <Barra etiqueta="Grasas" valor={detalle.total.g} objetivo={objetivo.g} color="#64D2FF" unidad=" g" />
          </div>

          {detalle.comidas.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>Este día no tiene comidas todavía. Toca un hueco del planificador para añadir una receta.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {detalle.comidas.map(c => (
                <div key={c.id} className="rounded-xl overflow-hidden flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  {c.receta?.imagen_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.receta.imagen_url} alt="" loading="lazy" className="w-full h-28 object-cover" />
                  )}
                  <div className="p-3 flex-1 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{c.franja}{c.recurrente ? ' · diario' : ''}</p>
                        <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>{c.receta?.nombre ?? 'Sin receta'}</p>
                      </div>
                      {c.receta?.contenido_estado && <Video size={14} style={{ color: c.receta.contenido_estado === 'grabada' ? 'var(--success)' : 'var(--warning)' }} />}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-data" style={{ color: 'var(--text)' }}>
                      <span className="font-semibold">{c.kcal} kcal</span>
                      <span style={{ color: '#30D158' }}>P {c.p}</span>
                      <span style={{ color: '#FF9F0A' }}>C {c.c}</span>
                      <span style={{ color: '#64D2FF' }}>G {c.g}</span>
                      {c.receta?.tiempo_prep_min ? <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Clock size={11} />{c.receta.tiempo_prep_min} min</span> : null}
                    </div>
                    <table className="w-full text-xs">
                      <tbody>
                        {c.ingredientes.map((i, k) => (
                          <tr key={k} style={{ borderTop: k ? '1px solid var(--border)' : undefined }}>
                            <td className="py-1 pr-2" style={{ color: 'var(--text)' }}>{i.nombre}</td>
                            <td className="py-1 text-right font-data whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{i.gramos} g</td>
                            <td className="py-1 pl-2 text-right font-data whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{i.kcal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                      <button onClick={() => onCambiar(c.franja)} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                        <RefreshCw size={11} /> Cambiar receta
                      </button>
                      {c.receta && (
                        <a href={`/recetas/${c.receta.id}`} target="_blank" rel="noreferrer" className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                          <ExternalLink size={11} /> Ver receta
                        </a>
                      )}
                      {!c.recurrente && (
                        <button onClick={() => onQuitar(c.id, c.recurrente)} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <X size={11} /> Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
