'use client'

import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, CalendarDays, Loader2, Plus, Search, Sparkles, Video, X } from 'lucide-react'

type Receta = { id: string; nombre: string; imagen_url: string | null; contenido_estado: string | null; verificacion: string | null }
type Comida = { id: string; nombre: string; recurrente: boolean; receta: Receta | null; kcal: number; p: number; c: number; g: number }
type Dia = { dia: string; comidas: Comida[]; total: { kcal: number; p: number; c: number; g: number } }
type Plan = { id: string; nombre: string; kcal_objetivo: number | null; proteinas_objetivo: number | null }
type RecetaOpcion = Receta & { kcal: number; proteinas: number; tiempo_prep_min: number | null }
type ResultadoSemana = { ok: boolean; asignadas: number; repetidas: number; sinCubrir: { dia: string; franja: string }[]; errores: { dia: string; franja: string; error: string }[]; mensaje?: string }

function colorDesvio(real: number, objetivo: number | null) {
  if (!objetivo) return 'var(--text-muted)'
  const d = Math.abs(real - objetivo) / objetivo
  return d <= 0.1 ? 'var(--success)' : d <= 0.2 ? 'var(--warning)' : 'var(--error)'
}

export default function SemanaDietaPlanner({ clienteId }: { clienteId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [dias, setDias] = useState<Dia[]>([])
  const [franjas, setFranjas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hueco, setHueco] = useState<{ dia: string; franja: string } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [opciones, setOpciones] = useState<RecetaOpcion[]>([])
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoSemana | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    const res = await fetch(`/api/clientes/${clienteId}/semana-dieta`)
    const data = await res.json().catch(() => null)
    if (!res.ok) { setError(data?.error ?? 'No se pudo cargar la semana'); setLoading(false); return }
    setPlan(data.plan); setDias(data.dias ?? []); setFranjas(data.franjas ?? []); setLoading(false)
  }, [clienteId])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!hueco) return
    setBuscando(true)
    const t = setTimeout(async () => {
      const res = await fetch(`/api/clientes/${clienteId}/semana-dieta?franja=${encodeURIComponent(hueco.franja)}&q=${encodeURIComponent(busqueda)}`)
      const data = await res.json().catch(() => null)
      setOpciones(data?.recetas ?? []); setBuscando(false)
    }, 250)
    return () => clearTimeout(t)
  }, [hueco, busqueda, clienteId])

  async function asignar(recetaId: string) {
    if (!hueco) return
    setGuardando(true)
    const res = await fetch(`/api/clientes/${clienteId}/semana-dieta`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dia: hueco.dia, franja: hueco.franja, receta_id: recetaId }),
    })
    const data = await res.json().catch(() => null)
    setGuardando(false)
    if (!res.ok) { setError(data?.error ?? 'No se pudo asignar'); return }
    setHueco(null); setBusqueda(''); await cargar()
  }

  async function quitar(comidaId: string) {
    if (!confirm('¿Quitar esta comida de ese día?')) return
    const res = await fetch(`/api/clientes/${clienteId}/semana-dieta?comida_id=${comidaId}`, { method: 'DELETE' })
    const data = await res.json().catch(() => null)
    if (!res.ok) { setError(data?.error ?? 'No se pudo quitar'); return }
    await cargar()
  }

  async function generarSemana() {
    const conReceta = dias.flatMap(d => d.comidas).filter(c => c.receta).length
    if (conReceta > 0 && !confirm(`La semana ya tiene ${conReceta} comidas con receta. ¿Sustituirlas todas por una semana nueva sin repetir recetas?`)) return
    setGenerando(true); setError(null); setResultado(null)
    const res = await fetch(`/api/clientes/${clienteId}/semana-dieta/generar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reemplazar: conReceta > 0 }),
    })
    const data = await res.json().catch(() => null)
    setGenerando(false)
    if (!res.ok) { setError(data?.error ?? 'No se pudo generar la semana'); return }
    setResultado(data); await cargar()
  }

  async function alternarGrabar(receta: Receta) {
    const siguiente = receta.contenido_estado === 'para_grabar' ? 'grabada' : receta.contenido_estado === 'grabada' ? null : 'para_grabar'
    const res = await fetch(`/api/recetas/${receta.id}/contenido`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido_estado: siguiente }),
    })
    if (res.ok) await cargar()
  }

  if (loading) return <div className="rounded-2xl h-40 animate-pulse" style={{ background: 'var(--surface)' }} />
  if (!plan) return null

  return (
    <section className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Planificador semanal</p>
          <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}><CalendarDays size={16} /> {plan.nombre}</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Objetivo {plan.kcal_objetivo ?? '—'} kcal · {plan.proteinas_objetivo ?? '—'} g proteína · toca un hueco para elegir receta · <Video size={11} className="inline" /> para grabar
          </p>
        </div>
        <button onClick={generarSemana} disabled={generando}
          className="flex-shrink-0 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
          style={{ background: 'var(--primary)', color: 'var(--bg)' }}>
          {generando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {generando ? 'Generando…' : 'Generar semana'}
        </button>
      </div>

      {resultado && (
        <div className="rounded-xl p-2.5 mb-3 text-xs flex justify-between gap-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <span>
            {resultado.mensaje ?? `Semana generada: ${resultado.asignadas} comidas.`}
            {resultado.repetidas > 0 && ` ${resultado.repetidas} repetidas por falta de recetas en esa franja.`}
            {resultado.sinCubrir.length > 0 && ` Sin receta disponible: ${[...new Set(resultado.sinCubrir.map(h => h.franja))].join(', ')}.`}
            {resultado.errores.length > 0 && ` ${resultado.errores.length} no se pudieron asignar.`}
          </span>
          <button onClick={() => setResultado(null)}><X size={13} /></button>
        </div>
      )}

      {error && (
        <div className="rounded-xl p-2.5 mb-3 text-xs flex justify-between gap-2" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>
          <span>{error}</span><button onClick={() => setError(null)}><X size={13} /></button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {dias.map(d => {
          const nombres = new Set(d.comidas.map(c => c.nombre))
          const libres = franjas.filter(f => !nombres.has(f))
          return (
            <div key={d.dia} className="min-w-[180px] w-[180px] flex-shrink-0 rounded-xl p-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{d.dia}</p>
                <p className="text-xs font-data font-bold" style={{ color: colorDesvio(d.total.kcal, plan.kcal_objetivo) }}>{d.total.kcal} kcal</p>
              </div>
              <div className="space-y-1.5">
                {d.comidas.map(c => (
                  <div key={c.id} className="rounded-lg p-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between gap-1">
                      <button className="text-[10px] font-semibold uppercase tracking-wide text-left" style={{ color: 'var(--text-muted)' }} onClick={() => setHueco({ dia: d.dia, franja: c.nombre })}>
                        {c.nombre}{c.recurrente ? ' · diario' : ''}
                      </button>
                      <div className="flex items-center gap-1">
                        {c.receta && (
                          <button title="Para grabar → grabada → nada" onClick={() => alternarGrabar(c.receta!)}
                            style={{ color: c.receta.contenido_estado === 'para_grabar' ? 'var(--warning)' : c.receta.contenido_estado === 'grabada' ? 'var(--success)' : 'var(--text-muted)', opacity: c.receta.contenido_estado ? 1 : 0.45 }}>
                            <Video size={13} />
                          </button>
                        )}
                        {!c.recurrente && <button title="Quitar" onClick={() => quitar(c.id)} style={{ color: 'var(--text-muted)' }}><X size={13} /></button>}
                      </div>
                    </div>
                    <button className="text-xs font-medium text-left leading-snug mt-0.5 w-full" style={{ color: 'var(--text)' }} onClick={() => setHueco({ dia: d.dia, franja: c.nombre })}>
                      {c.receta?.nombre ?? 'Sin receta'}
                    </button>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.kcal} kcal · P {c.p} · C {c.c} · G {c.g}</p>
                  </div>
                ))}
                {libres.map(f => (
                  <button key={f} onClick={() => setHueco({ dia: d.dia, franja: f })}
                    className="w-full rounded-lg p-1.5 text-[11px] flex items-center gap-1 justify-center"
                    style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                    <Plus size={11} /> {f}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {hueco && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setHueco(null)}>
          <div className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl p-4" style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold" style={{ color: 'var(--text)' }}>{hueco.franja} · {hueco.dia}</p>
              <button onClick={() => setHueco(null)} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input autoFocus autoComplete="off" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar receta…" className="input search-input w-full text-sm" style={{ paddingLeft: '2.25rem' }} />
            </div>
            <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>Ordenadas por cómo encajan con tus macros. Las cantidades se ajustan solas al elegir.</p>
            <div className="overflow-y-auto space-y-1.5 flex-1">
              {buscando ? <div className="py-6 flex justify-center"><Loader2 size={18} className="animate-spin" /></div> :
                opciones.length === 0 ? <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Sin recetas para esta franja</p> :
                opciones.map(o => (
                  <button key={o.id} disabled={guardando} onClick={() => asignar(o.id)}
                    className="w-full text-left rounded-xl p-2.5 flex items-center gap-3 disabled:opacity-50"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                        {o.verificacion && <BadgeCheck size={13} style={{ color: 'var(--success)' }} />}
                        {o.contenido_estado && <Video size={12} style={{ color: o.contenido_estado === 'grabada' ? 'var(--success)' : 'var(--warning)' }} />}
                        {o.nombre}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {Math.round(o.kcal)} kcal · P {Math.round(o.proteinas)} g{o.tiempo_prep_min ? ` · ${o.tiempo_prep_min} min` : ''} (ración base)
                      </p>
                    </div>
                    {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} style={{ color: 'var(--text-muted)' }} />}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
