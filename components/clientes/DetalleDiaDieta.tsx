'use client'

import { useEffect, useState } from 'react'
import { Apple, Clock, ExternalLink, Loader2, PlayCircle, Plus, RefreshCw, Search, Video, X } from 'lucide-react'
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

type AlimentoBusqueda = { id: string; nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number }
type PostreBusqueda = { id: string; nombre: string; kcal: number; proteinas: number; imagen_url: string | null }

// Buscador para añadir un postre/complemento (alimento suelto o receta dulce) a una comida
function ModalComplemento({ clienteId, dia, franja, onCerrar, onHecho }: { clienteId: string; dia: string; franja: string; onCerrar: () => void; onHecho: () => void }) {
  const [modo, setModo] = useState<'alimento' | 'postre'>('alimento')
  const [q, setQ] = useState('')
  const [alimentos, setAlimentos] = useState<AlimentoBusqueda[]>([])
  const [postres, setPostres] = useState<PostreBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [elegido, setElegido] = useState<AlimentoBusqueda | null>(null)
  const [gramos, setGramos] = useState(100)
  const [ajustar, setAjustar] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setBuscando(true)
    const t = setTimeout(async () => {
      if (modo === 'alimento') {
        if (q.trim().length < 2) { setAlimentos([]); setBuscando(false); return }
        const res = await fetch(`/api/alimentos?q=${encodeURIComponent(q.trim())}&soloConDatos=true`)
        const data = await res.json().catch(() => [])
        setAlimentos(Array.isArray(data) ? data.slice(0, 40) : [])
      } else {
        const res = await fetch(`/api/clientes/${clienteId}/semana-dieta?franja=${encodeURIComponent(franja)}&postres=1&q=${encodeURIComponent(q.trim())}`)
        const data = await res.json().catch(() => null)
        setPostres(data?.recetas ?? [])
      }
      setBuscando(false)
    }, 250)
    return () => clearTimeout(t)
  }, [modo, q, clienteId, franja])

  async function anadir(body: Record<string, unknown>) {
    setGuardando(true); setError(null)
    const res = await fetch(`/api/clientes/${clienteId}/semana-dieta/complemento`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dia, franja, ajustar, ...body }),
    })
    const data = await res.json().catch(() => null)
    setGuardando(false)
    if (!res.ok) { setError(data?.error ?? 'No se pudo añadir'); return }
    onHecho()
  }

  const kcalPreview = elegido ? Math.round((elegido.calorias * gramos) / 100) : 0
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onCerrar}>
      <div className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl p-4" style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold" style={{ color: 'var(--text)' }}>Postre / complemento · {franja} · {dia}</p>
          <button onClick={onCerrar} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <div className="flex rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--border)' }}>
          {([['alimento', 'Fruta / alimento'], ['postre', 'Postre (receta)']] as const).map(([k, t]) => (
            <button key={k} onClick={() => { setModo(k); setElegido(null); setQ('') }} className="flex-1 px-3 py-2 text-xs font-medium"
              style={{ background: modo === k ? 'var(--primary)' : 'transparent', color: modo === k ? 'var(--bg)' : 'var(--text-muted)' }}>{t}</button>
          ))}
        </div>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input autoFocus autoComplete="off" value={q} onChange={e => { setQ(e.target.value); setElegido(null) }} placeholder={modo === 'alimento' ? 'Plátano, yogur, chocolate negro…' : 'Buscar postre…'} className="input search-input w-full text-sm" style={{ paddingLeft: '2.25rem' }} />
        </div>
        <label className="flex items-center gap-2 text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={ajustar} onChange={e => setAjustar(e.target.checked)} />
          Reajustar el plato principal para que la comida siga en su objetivo
        </label>
        {error && <p className="text-xs mb-2" style={{ color: 'var(--error)' }}>{error}</p>}
        <div className="overflow-y-auto space-y-1.5 flex-1">
          {buscando ? <div className="py-6 flex justify-center"><Loader2 size={18} className="animate-spin" /></div> : modo === 'alimento' ? (
            elegido ? (
              <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>{elegido.nombre}</p>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={2000} value={gramos} onChange={e => setGramos(Number(e.target.value))} className="input w-24 text-sm" />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>g · {kcalPreview} kcal · P {Math.round((elegido.proteinas * gramos) / 100)} · C {Math.round((elegido.carbohidratos * gramos) / 100)} · G {Math.round((elegido.grasas * gramos) / 100)}</span>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[50, 100, 150, 200].map(g => <button key={g} onClick={() => setGramos(g)} className="rounded-lg px-2 py-1 text-[11px]" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{g} g</button>)}
                </div>
                <button disabled={guardando || gramos <= 0} onClick={() => anadir({ alimento_id: elegido.id, gramos })} className="mt-3 w-full rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60" style={{ background: 'var(--primary)', color: 'var(--bg)' }}>
                  {guardando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Añadir a {franja}
                </button>
              </div>
            ) : alimentos.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>{q.trim().length < 2 ? 'Escribe al menos 2 letras' : 'Sin resultados'}</p>
            ) : alimentos.map(a => (
              <button key={a.id} onClick={() => setElegido(a)} className="w-full text-left rounded-xl p-2.5 flex items-center justify-between gap-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{a.nombre}</span>
                <span className="text-[11px] font-data whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{Math.round(a.calorias)} kcal/100 g</span>
              </button>
            ))
          ) : postres.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Sin postres</p>
          ) : postres.map(r => (
            <button key={r.id} disabled={guardando} onClick={() => anadir({ receta_id: r.id })} className="w-full text-left rounded-xl p-2.5 flex items-center justify-between gap-2 disabled:opacity-50" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{r.nombre}</span>
              <span className="text-[11px] font-data whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{Math.round(r.kcal)} kcal · P {Math.round(r.proteinas)} (ración base)</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DetalleDiaDieta({ clienteId, dia, semana, objetivo, version, franjas, onCambiar, onQuitar, onCambioDatos }: {
  clienteId: string; dia: string; semana: number | null; objetivo: Objetivo; version: number; franjas: string[]
  onCambiar: (franja: string) => void; onQuitar: (comidaId: string, recurrente: boolean) => void; onCambioDatos: () => void
}) {
  const [complementoEn, setComplementoEn] = useState<string | null>(null)
  // Se cargan los 7 días de la semana de una vez: cambiar de día es instantáneo y nunca se ve el día anterior
  const [semanaDatos, setSemanaDatos] = useState<DetalleDia[] | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    fetch(`/api/clientes/${clienteId}/semana-dieta/dia${semana ? `?semana=${semana}` : ''}`)
      .then(async res => ({ ok: res.ok, data: await res.json().catch(() => null) }))
      .then(({ ok, data }) => {
        if (!vigente) return
        if (!ok) setError(data?.error ?? 'No se pudo cargar el día')
        else { setError(null); setSemanaDatos(data.dias ?? []) }
        setCargando(false)
      })
      .catch(() => { if (vigente) { setError('No se pudo cargar el día'); setCargando(false) } })
    return () => { vigente = false }
  }, [clienteId, semana, version])

  const detalle = semanaDatos?.find(d => d.dia === dia) ?? null

  async function quitarComplemento(comidaId: string, x: { fila?: string; receta_id?: string }) {
    const q = `comida_id=${comidaId}${x.fila ? `&fila=${x.fila}` : ''}${x.receta_id ? `&receta=${x.receta_id}` : ''}`
    const res = await fetch(`/api/clientes/${clienteId}/semana-dieta/complemento?${q}`, { method: 'DELETE' })
    if (res.ok) onCambioDatos()
    else setError((await res.json().catch(() => null))?.error ?? 'No se pudo quitar')
  }

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
                    {(c.complementos.length > 0 || !semana) && (
                      <div className="rounded-lg p-2" style={{ background: 'var(--bg)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Apple size={11} /> Postre / complemento</p>
                        {c.complementos.map((x, k) => (
                          <div key={k} className="flex items-center justify-between gap-2 text-xs py-0.5">
                            <span style={{ color: 'var(--text)' }}>{x.nombre}{x.gramos ? ` · ${x.gramos} g` : ''}</span>
                            <span className="flex items-center gap-2 font-data whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                              {x.kcal} kcal
                              <button title="Quitar" onClick={() => quitarComplemento(c.id, x)}><X size={12} /></button>
                            </span>
                          </div>
                        ))}
                        {!semana && (
                          <button onClick={() => setComplementoEn(c.franja)} className="text-[11px] font-medium flex items-center gap-1 mt-1" style={{ color: 'var(--text)' }}><Plus size={11} /> Añadir postre o fruta</button>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                      <button onClick={() => onCambiar(c.franja)} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                        <RefreshCw size={11} /> Cambiar receta
                      </button>
                      {c.receta && (
                        <a href={`/recetas/${c.receta.id}`} target="_blank" rel="noreferrer" className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                          <ExternalLink size={11} /> Ver receta
                        </a>
                      )}
                      {c.receta?.url_origen && /instagram\.com|tiktok\.com|youtube\.com|youtu\.be/.test(c.receta.url_origen) && (
                        <a href={c.receta.url_origen} target="_blank" rel="noreferrer" className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                          <PlayCircle size={11} /> Ver vídeo
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

          {!semana && (() => {
            const libres = franjas.filter(f => !detalle.comidas.some(c => c.franja === f))
            return libres.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Solo postre o fruta en:</span>
                {libres.map(f => (
                  <button key={f} onClick={() => setComplementoEn(f)} className="rounded-full px-2.5 py-1 text-[11px] font-medium flex items-center gap-1" style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                    <Plus size={11} /> {f}
                  </button>
                ))}
              </div>
            ) : null
          })()}
        </>
      )}
      {complementoEn && (
        <ModalComplemento clienteId={clienteId} dia={dia} franja={complementoEn} onCerrar={() => setComplementoEn(null)} onHecho={() => { setComplementoEn(null); onCambioDatos() }} />
      )}
    </div>
  )
}
