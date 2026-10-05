'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import DetalleDiaDieta from './DetalleDiaDieta'
import ListaCompra from '@/components/ListaCompra'
import { Activity, BadgeCheck, CalendarDays, Copy, Loader2, Maximize2, Minimize2, Play, Plus, Search, Sparkles, Trash2, Video, X } from 'lucide-react'

type Receta = { id: string; nombre: string; imagen_url: string | null; contenido_estado: string | null; verificacion: string | null }
type Comida = { id: string; nombre: string; recurrente: boolean; receta: Receta | null; kcal: number; p: number; c: number; g: number }
type Total = { kcal: number; p: number; c: number; g: number }
type Dia = { dia: string; comidas: Comida[]; total: Total }
type Plan = { id: string; nombre: string; kcal_objetivo: number | null; proteinas_objetivo: number | null; carbohidratos_objetivo: number | null; grasas_objetivo: number | null }
type RecetaOpcion = Receta & { kcal: number; proteinas: number; tiempo_prep_min: number | null }
type ResultadoSemana = { ok: boolean; complementos?: number; asignadas: number; repetidas: number; sinCubrir: { dia: string; franja: string }[]; errores: { dia: string; franja: string; error: string }[]; mensaje?: string }
type Hueco = { dia: string; franja: string; semana: number | null }
type Tamano = { col: string; dia: string; diaKcal: string; card: string; label: string; nombre: string; macros: string; hueco: string; grid: string }

const DIAS_ORDEN = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const VISTAS = [{ semanas: 1, texto: '1 semana' }, { semanas: 2, texto: '2 semanas' }, { semanas: 4, texto: 'Mes' }]

function colorDesvio(real: number, objetivo: number | null) {
  if (!objetivo) return 'var(--text-muted)'
  const d = Math.abs(real - objetivo) / objetivo
  return d <= 0.1 ? 'var(--success)' : d <= 0.2 ? 'var(--warning)' : 'var(--error)'
}

function media(dias: Dia[]): Total | null {
  const con = dias.filter(d => d.comidas.length > 0)
  if (con.length === 0) return null
  const s = con.reduce((a, d) => ({ kcal: a.kcal + d.total.kcal, p: a.p + d.total.p, c: a.c + d.total.c, g: a.g + d.total.g }), { kcal: 0, p: 0, c: 0, g: 0 })
  return { kcal: Math.round(s.kcal / con.length), p: Math.round(s.p / con.length), c: Math.round(s.c / con.length), g: Math.round(s.g / con.length) }
}

// Rejilla de 7 días: las franjas en su orden, con los huecos vacíos en su sitio
function SemanaGrid({ dias, franjas, T, kcalObjetivo, objetivos, semana, diaSel, onDia, onHueco, onQuitar, onGrabar }: {
  dias: Dia[]; franjas: string[]; T: Tamano; kcalObjetivo: number | null; objetivos: Record<string, ObjetivoDia>; semana: number | null
  diaSel: { dia: string; semana: number | null } | null; onDia: (dia: string, semana: number | null) => void
  onHueco: (h: Hueco) => void; onQuitar: (c: Comida, semana: number | null) => void; onGrabar: (r: Receta) => void
}) {
  const posicion = (f: string) => { const i = franjas.indexOf(f); return i === -1 ? franjas.length : i }
  return (
    <div className={`flex gap-2 overflow-x-auto pb-2 scrollbar-none lg:grid lg:grid-cols-7 ${T.grid} lg:overflow-visible lg:pb-0`}>
      {dias.map(d => {
        const sel = diaSel?.dia === d.dia && diaSel.semana === semana
        const items: ({ tipo: 'comida'; c: Comida } | { tipo: 'hueco'; f: string })[] = [
          ...d.comidas.map(c => ({ tipo: 'comida' as const, c })),
          ...franjas.filter(f => !d.comidas.some(c => c.nombre === f)).map(f => ({ tipo: 'hueco' as const, f })),
        ].sort((a, b) => posicion(a.tipo === 'comida' ? a.c.nombre : a.f) - posicion(b.tipo === 'comida' ? b.c.nombre : b.f))
        return (
          <div key={d.dia} className={`min-w-[180px] w-[180px] flex-shrink-0 rounded-xl p-2 lg:min-w-0 lg:w-auto ${T.col}`} style={{ background: sel ? 'var(--surface)' : 'var(--bg)', border: `1px solid ${sel ? 'var(--primary)' : 'var(--border)'}`, boxShadow: sel ? '0 0 0 1px var(--primary)' : undefined }}>
            <button className="block w-full mb-2 text-left rounded-md" title={objetivos[d.dia]?.consejo ?? 'Ver el detalle del día'} aria-pressed={sel} onClick={() => onDia(d.dia, semana)}>
              <span className="flex w-full items-baseline justify-between">
                <span className={`${T.dia} font-semibold`} style={{ color: 'var(--text)' }}>{d.dia}</span>
                <span className={`${T.diaKcal} font-data font-bold`} style={{ color: colorDesvio(d.total.kcal, objetivos[d.dia]?.kcal || kcalObjetivo) }}>{d.total.kcal} kcal</span>
              </span>
              {objetivos[d.dia]?.label && (
                <span className="block text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {objetivos[d.dia].label!.replace('Día de ', '').replace('Día híbrido / HYROX', 'Híbrido')} · objetivo {objetivos[d.dia].kcal}
                </span>
              )}
            </button>
            <div className="space-y-1.5">
              {items.map(it => {
                if (it.tipo === 'hueco') return (
                  <button key={it.f} onClick={() => onHueco({ dia: d.dia, franja: it.f, semana })}
                    className={`w-full rounded-lg ${T.hueco} flex items-center gap-1 justify-center`}
                    style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                    <Plus size={11} /> {it.f}
                  </button>
                )
                const c = it.c
                return (
                  <div key={c.id} className={`rounded-lg ${T.card}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between gap-1">
                      <button className={`${T.label} font-semibold uppercase tracking-wide text-left`} style={{ color: 'var(--text-muted)' }} onClick={() => onHueco({ dia: d.dia, franja: c.nombre, semana })}>
                        {c.nombre}{c.recurrente ? ' · diario' : ''}{objetivos[d.dia]?.momento?.pre === c.nombre ? ' · pre' : objetivos[d.dia]?.momento?.post === c.nombre ? ' · post' : ''}
                      </button>
                      <div className="flex items-center gap-1">
                        {c.receta && (
                          <button title="Para grabar → grabada → nada" onClick={() => onGrabar(c.receta!)}
                            style={{ color: c.receta.contenido_estado === 'para_grabar' ? 'var(--warning)' : c.receta.contenido_estado === 'grabada' ? 'var(--success)' : 'var(--text-muted)', opacity: c.receta.contenido_estado ? 1 : 0.45 }}>
                            <Video size={13} />
                          </button>
                        )}
                        {!c.recurrente && <button title="Quitar" onClick={() => onQuitar(c, semana)} style={{ color: 'var(--text-muted)' }}><X size={13} /></button>}
                      </div>
                    </div>
                    <button className={`${T.nombre} font-medium text-left mt-0.5 w-full`} style={{ color: 'var(--text)' }} onClick={() => onHueco({ dia: d.dia, franja: c.nombre, semana })}>
                      {c.receta?.nombre ?? 'Sin receta'}
                    </button>
                    <p className={`${T.macros} mt-0.5`} style={{ color: 'var(--text-muted)' }}>{c.kcal} · P{c.p} C{c.c} G{c.g}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export type MomentoDia = { hora: string; pre: string | null; post: string | null; nota: string | null }
type ObjetivoDia = { kcal: number; p: number; c: number; g: number; label: string | null; consejo: string | null; ajuste_kcal_pct: number; momento?: MomentoDia | null }
export type ResumenDia = { etiqueta: string; dia: Total; media: Total | null; objetivo: Total | null; tipoDia: string | null }

export default function SemanaDietaPlanner({ clienteId, accionExtra, onResumen }: { clienteId: string; accionExtra?: React.ReactNode; onResumen?: (r: ResumenDia | null) => void }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [dias, setDias] = useState<Dia[]>([])
  const [futuras, setFuturas] = useState<{ semana: number; dias: Dia[] }[]>([])
  const [franjas, setFranjas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hueco, setHueco] = useState<Hueco | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [opciones, setOpciones] = useState<RecetaOpcion[]>([])
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoSemana | null>(null)
  const [franjasGen, setFranjasGen] = useState<string[] | null>(null)
  const [ampliado, setAmpliado] = useState(false)
  const [vista, setVista] = useState(1)
  const [diaSel, setDiaSel] = useState<{ dia: string; semana: number | null } | null>(null)
  const [version, setVersion] = useState(0)
  const [objetivosDia, setObjetivosDia] = useState<Record<string, ObjetivoDia>>({})

  // Franjas que se rellenan al generar: por defecto las que ya usa el plan; el coach puede añadir o quitar
  const franjasPlan = useMemo(() => franjas.filter(f => dias.some(d => d.comidas.some(c => c.nombre === f))), [franjas, dias])
  const seleccion = franjasGen ?? (franjasPlan.length > 0 ? franjasPlan : ['Desayuno', 'Comida', 'Cena'])
  const alternarFranja = (f: string) => setFranjasGen(seleccion.includes(f) ? seleccion.filter(x => x !== f) : [...seleccion, f])

  // Avisa a la ficha del día seleccionado y de la media de la semana en curso, para compararlos con el objetivo
  useEffect(() => {
    if (!onResumen) return
    if (!diaSel) { onResumen(null); return }
    const lista = diaSel.semana == null ? dias : futuras.find(f => f.semana === diaSel.semana)?.dias ?? []
    const d = lista.find(x => x.dia === diaSel.dia)
    const od = objetivosDia[diaSel.dia]
    onResumen(d ? { etiqueta: `${diaSel.dia}${diaSel.semana ? ` · semana +${diaSel.semana}` : ''}`, dia: d.total, media: media(dias), objetivo: od?.kcal ? { kcal: od.kcal, p: od.p, c: od.c, g: od.g } : null, tipoDia: od?.label ? `${od.label}${od.ajuste_kcal_pct ? ` ${od.ajuste_kcal_pct > 0 ? '+' : ''}${od.ajuste_kcal_pct}% kcal` : ''}` : null } : null)
  }, [diaSel, dias, futuras, objetivosDia, onResumen])
  useEffect(() => () => onResumen?.(null), [onResumen])

  const cargar = useCallback(async () => {
    setError(null)
    const res = await fetch(`/api/clientes/${clienteId}/semana-dieta`)
    const data = await res.json().catch(() => null)
    if (!res.ok) { setError(data?.error ?? 'No se pudo cargar la semana'); setLoading(false); return }
    setPlan(data.plan); setDias(data.dias ?? []); setFranjas(data.franjas ?? []); setObjetivosDia(data.objetivos_dia ?? {}); setLoading(false)
    setDiaSel(prev => prev ?? { dia: DIAS_ORDEN[(new Date().getDay() + 6) % 7], semana: null })
    setVersion(v => v + 1)
  }, [clienteId])

  const cargarFuturas = useCallback(async (v: number) => {
    if (v <= 1) { setFuturas([]); return }
    const res = await fetch(`/api/clientes/${clienteId}/semana-dieta/futuras?semanas=${v - 1}`)
    const data = await res.json().catch(() => null)
    if (!res.ok) { setError(data?.error ?? 'No se pudieron cargar las semanas planificadas'); return }
    setFuturas((data.semanas ?? []).map((s: { semana: number; dias: { dia: string; comidas: Omit<Comida, 'recurrente'>[]; total: Total }[] }) => ({
      semana: s.semana,
      dias: s.dias.map(d => ({ ...d, comidas: d.comidas.map(c => ({ ...c, recurrente: false })) })),
    })))
    setVersion(v => v + 1)
  }, [clienteId])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { cargarFuturas(vista) }, [vista, cargarFuturas])

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

  async function llamar(url: string, metodo: string, body?: unknown) {
    const res = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const data = await res.json().catch(() => null)
    if (!res.ok) { setError(data?.error ?? 'No se pudo completar la acción'); return null }
    return data
  }

  async function asignar(recetaId: string) {
    if (!hueco) return
    setGuardando(true)
    const base = `/api/clientes/${clienteId}/semana-dieta`
    const data = hueco.semana
      ? await llamar(`${base}/futuras`, 'POST', { semana: hueco.semana, dia: hueco.dia, franja: hueco.franja, receta_id: recetaId })
      : await llamar(base, 'POST', { dia: hueco.dia, franja: hueco.franja, receta_id: recetaId })
    setGuardando(false)
    if (!data) return
    setHueco(null); setBusqueda(''); await Promise.all([cargar(), cargarFuturas(vista)])
  }

  async function quitar(c: Comida, semana: number | null) {
    if (!confirm('¿Quitar esta comida de ese día?')) return
    const base = `/api/clientes/${clienteId}/semana-dieta`
    const data = semana ? await llamar(`${base}/futuras?id=${c.id}`, 'DELETE') : await llamar(`${base}?comida_id=${c.id}`, 'DELETE')
    if (data) await Promise.all([cargar(), cargarFuturas(vista)])
  }

  async function generarSemana() {
    if (seleccion.length === 0) { setError('Elige al menos una franja'); return }
    const conReceta = dias.flatMap(d => d.comidas).filter(c => c.receta && seleccion.includes(c.nombre)).length
    if (conReceta > 0 && !confirm(`Las franjas elegidas ya tienen ${conReceta} comidas con receta. ¿Sustituirlas por una semana nueva sin repetir recetas?`)) return
    setOcupado('actual'); setError(null); setResultado(null)
    const data = await llamar(`/api/clientes/${clienteId}/semana-dieta/generar`, 'POST', { reemplazar: conReceta > 0, franjas: seleccion })
    setOcupado(null)
    if (data) { setResultado(data); await cargar() }
  }

  async function accionFutura(semana: number, accion: 'generar' | 'copiar' | 'vaciar' | 'activar') {
    const s = futuras.find(f => f.semana === semana)
    const tiene = !!s && s.dias.some(d => d.comidas.length > 0)
    const base = `/api/clientes/${clienteId}/semana-dieta/futuras`
    if (accion === 'generar' && seleccion.length === 0) { setError('Elige al menos una franja'); return }
    if ((accion === 'generar' || accion === 'copiar') && tiene && !confirm(`La semana +${semana} ya tiene recetas. ¿Sustituirlas?`)) return
    if (accion === 'vaciar' && !confirm(`¿Vaciar la semana +${semana} planificada?`)) return
    if (accion === 'activar' && !confirm('Esto cambia lo que ve el cliente: la semana planificada pasa a ser su semana en curso (sustituye la actual) y las siguientes se adelantan. ¿Activar?')) return
    setOcupado(`${accion}-${semana}`); setError(null); setResultado(null)
    const data = accion === 'generar' ? await llamar(`${base}/generar`, 'POST', { semana, franjas: seleccion, reemplazar: tiene })
      : accion === 'copiar' ? await llamar(`${base}/copiar`, 'POST', { semana })
      : accion === 'vaciar' ? await llamar(`${base}?semana=${semana}`, 'DELETE')
      : await llamar(`${base}/activar`, 'POST')
    setOcupado(null)
    if (!data) return
    if (accion === 'generar') setResultado({ ok: true, complementos: data.complementos, asignadas: data.asignadas, repetidas: data.repetidas, sinCubrir: data.sinCubrir ?? [], errores: [], mensaje: data.mensaje })
    if (accion === 'activar') setResultado({ ok: data.ok, asignadas: data.activadas, repetidas: 0, sinCubrir: [], errores: data.errores ?? [], mensaje: data.ok ? `Semana activada: ${data.activadas} comidas ya son la semana en curso del cliente.` : undefined })
    await Promise.all([cargar(), cargarFuturas(vista)])
  }

  async function reajustarAlEntreno() {
    if (!confirm('Se mantienen las recetas pero se recalculan las cantidades de cada día según su entrenamiento (y se rehacen guarniciones y postres). ¿Continuar?')) return
    setOcupado('reajustar'); setError(null); setResultado(null)
    const data = await llamar(`/api/clientes/${clienteId}/semana-dieta/reajustar`, 'POST')
    setOcupado(null)
    if (data) { setResultado({ ok: true, complementos: data.complementos, asignadas: data.reajustadas, repetidas: 0, sinCubrir: [], errores: [], mensaje: `Semana ajustada al entrenamiento: ${data.reajustadas} comidas recalculadas.` }); await Promise.all([cargar(), cargarFuturas(vista)]) }
  }

  async function alternarGrabar(receta: Receta) {
    const siguiente = receta.contenido_estado === 'para_grabar' ? 'grabada' : receta.contenido_estado === 'grabada' ? null : 'para_grabar'
    const res = await fetch(`/api/recetas/${receta.id}/contenido`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido_estado: siguiente }),
    })
    if (res.ok) await Promise.all([cargar(), cargarFuturas(vista)])
  }

  if (loading) return <div className="rounded-2xl h-40 animate-pulse" style={{ background: 'var(--surface)' }} />
  if (!plan) return null

  // Tamaños: normal (cabe la semana en un portátil) o ampliado (pantalla completa, letra y casillas grandes)
  const T: Tamano = ampliado
    ? { col: 'p-3', dia: 'text-lg', diaKcal: 'text-sm', card: 'p-3', label: 'text-xs', nombre: 'text-base leading-snug line-clamp-4', macros: 'text-xs', hueco: 'p-3 text-sm', grid: 'lg:gap-3' }
    : { col: 'lg:p-2', dia: 'text-sm', diaKcal: 'text-xs', card: 'p-2', label: 'text-[10px]', nombre: 'text-xs lg:text-[13px] leading-snug line-clamp-3', macros: 'text-[10px]', hueco: 'p-1.5 text-[11px]', grid: 'lg:gap-1.5' }
  // El detalle del día aparece justo debajo de la semana a la que pertenece el día seleccionado
  const detalle = (semana: number | null) => diaSel && diaSel.semana === semana ? (
    <DetalleDiaDieta clienteId={clienteId} dia={diaSel.dia} semana={semana} version={version}
      objetivo={objetivosDia[diaSel.dia]?.kcal ? { kcal: objetivosDia[diaSel.dia].kcal, p: objetivosDia[diaSel.dia].p, c: objetivosDia[diaSel.dia].c, g: objetivosDia[diaSel.dia].g } : { kcal: plan.kcal_objetivo, p: plan.proteinas_objetivo, c: plan.carbohidratos_objetivo, g: plan.grasas_objetivo }}
      momento={objetivosDia[diaSel.dia]?.momento ?? null}
      onCambiar={franja => setHueco({ dia: diaSel.dia, franja, semana })}
      onQuitar={(id) => quitar({ id } as Comida, semana)}
      franjas={franjas} onCambioDatos={() => { void Promise.all([cargar(), cargarFuturas(vista)]) }} />
  ) : null
  const btnSec = 'rounded-lg px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1 disabled:opacity-50'
  const mediaActual = media(dias)

  return (
    <section className={ampliado ? 'fixed inset-0 z-[60] overflow-auto p-6' : 'rounded-2xl p-4'} style={{ background: ampliado ? 'var(--bg)' : 'var(--surface)', border: ampliado ? 'none' : '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Planificador</p>
          <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}><CalendarDays size={16} /> {plan.nombre}</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Objetivo {plan.kcal_objetivo ?? '—'} kcal · {plan.proteinas_objetivo ?? '—'} g proteína · toca un hueco para elegir receta · <Video size={11} className="inline" /> para grabar
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {VISTAS.map(v => (
              <button key={v.semanas} onClick={() => setVista(v.semanas)} className="px-2.5 py-2 text-xs font-medium"
                style={{ background: vista === v.semanas ? 'var(--primary)' : 'transparent', color: vista === v.semanas ? 'var(--bg)' : 'var(--text-muted)' }}>
                {v.texto}
              </button>
            ))}
          </div>
          {accionExtra}
          <button onClick={() => setAmpliado(a => !a)} title={ampliado ? 'Volver al tamaño normal' : 'Ver en pantalla completa'}
            className="rounded-xl p-2" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {ampliado ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {Object.values(objetivosDia).some(o => o.label) && (
            <button onClick={reajustarAlEntreno} disabled={ocupado !== null} title="Recalcula las cantidades de cada día según su entrenamiento"
              className="rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
              {ocupado === 'reajustar' ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />}
              {ocupado === 'reajustar' ? 'Ajustando…' : 'Ajustar al entreno'}
            </button>
          )}
          <button onClick={generarSemana} disabled={ocupado !== null}
            className="rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
            style={{ background: 'var(--primary)', color: 'var(--bg)' }}>
            {ocupado === 'actual' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {ocupado === 'actual' ? 'Generando…' : 'Generar semana'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Generar:</span>
        {franjas.map(f => {
          const activa = seleccion.includes(f)
          return (
            <button key={f} onClick={() => alternarFranja(f)} disabled={ocupado !== null}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ background: activa ? 'var(--primary)' : 'transparent', color: activa ? 'var(--bg)' : 'var(--text-muted)', border: `1px solid ${activa ? 'var(--primary)' : 'var(--border)'}` }}>
              {f}
            </button>
          )
        })}
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>· media mañana, merienda o peri-entreno solo si los marcas</span>
      </div>

      {resultado && (
        <div className="rounded-xl p-2.5 mb-3 text-xs flex justify-between gap-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <span>
            {resultado.mensaje ?? `Semana generada: ${resultado.asignadas} comidas.`}
            {(resultado.complementos ?? 0) > 0 && ` Se añadieron ${resultado.complementos} guarniciones/postres para cerrar el hueco de kcal.`}
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

      {vista > 1 && (
        <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>
          Semana en curso <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>· lo que ve el cliente{mediaActual ? ` · media ${mediaActual.kcal} kcal · P${mediaActual.p} C${mediaActual.c} G${mediaActual.g}` : ''}</span>
        </p>
      )}
      <SemanaGrid dias={dias} franjas={franjas} T={T} kcalObjetivo={plan.kcal_objetivo} objetivos={objetivosDia} semana={null} diaSel={diaSel} onDia={(dia, semana) => setDiaSel({ dia, semana })} onHueco={setHueco} onQuitar={quitar} onGrabar={alternarGrabar} />
      {detalle(null)}

      {futuras.map(s => {
        const m = media(s.dias)
        const vacia = !m
        return (
          <div key={s.semana} className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                Semana +{s.semana} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>· planificada, el cliente no la ve{m ? ` · media estimada ${m.kcal} kcal · P${m.p} C${m.c} G${m.g}` : ' · vacía'}</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button className={btnSec} style={{ border: '1px solid var(--border)', color: 'var(--text)' }} disabled={ocupado !== null} onClick={() => accionFutura(s.semana, 'generar')}>
                  {ocupado === `generar-${s.semana}` ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generar
                </button>
                <button className={btnSec} style={{ border: '1px solid var(--border)', color: 'var(--text)' }} disabled={ocupado !== null} onClick={() => accionFutura(s.semana, 'copiar')}>
                  {ocupado === `copiar-${s.semana}` ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />} Copiar semana en curso
                </button>
                {!vacia && (
                  <button className={btnSec} style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }} disabled={ocupado !== null} onClick={() => accionFutura(s.semana, 'vaciar')}>
                    <Trash2 size={12} /> Vaciar
                  </button>
                )}
                {s.semana === 1 && !vacia && (
                  <button className={btnSec} style={{ background: 'var(--primary)', color: 'var(--bg)' }} disabled={ocupado !== null} onClick={() => accionFutura(s.semana, 'activar')}>
                    {ocupado === `activar-${s.semana}` ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Activar como semana en curso
                  </button>
                )}
              </div>
            </div>
            <SemanaGrid dias={s.dias} franjas={franjas} T={T} kcalObjetivo={plan.kcal_objetivo} objetivos={objetivosDia} semana={s.semana} diaSel={diaSel} onDia={(dia, semana) => setDiaSel({ dia, semana })} onHueco={setHueco} onQuitar={quitar} onGrabar={alternarGrabar} />
            {detalle(s.semana)}
            {!vacia && <div className="mt-2"><ListaCompra planId={plan.id} clienteId={clienteId} semanaFutura={s.semana} nombrePlan={`${plan.nombre} · semana +${s.semana}`} rol="coach" /></div>}
          </div>
        )
      })}

      {hueco && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setHueco(null)}>
          <div className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl p-4" style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold" style={{ color: 'var(--text)' }}>{hueco.franja} · {hueco.dia}{hueco.semana ? ` · semana +${hueco.semana}` : ''}</p>
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
