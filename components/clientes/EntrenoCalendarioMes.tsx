'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronLeft, ChevronRight, ClipboardPaste, Copy, ExternalLink, Flag, Loader2, Plus, Trash2, Watch, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { diaSemanaDe, diferenciaDias, lunesDe, sumarDias, esFechaISO, type Operacion } from '@/lib/entrenos/calendario-ajustes'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_ABREV = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const FASE_COLOR: Record<string, { bg: string; text: string }> = {
  Base: { bg: 'var(--semantic-info-bg)', text: 'var(--semantic-info-text)' },
  Fuerza: { bg: 'var(--semantic-warn-bg)', text: 'var(--semantic-warn-text)' },
  Resistencia: { bg: 'var(--semantic-active-bg)', text: 'var(--semantic-active-text)' },
  Deload: { bg: 'var(--border)', text: 'var(--text-muted)' },
}

type EstadoGarmin = 'enviada' | 'pendiente' | null

interface SesionDia {
  id: string
  nombre: string
  fase_bloque: string | null
  ajuste: { id: string; tipo: 'mover' | 'copiar' | 'omitir'; fecha_origen: string | null } | null
  garmin: EstadoGarmin
}

interface Realizado {
  id: string
  tipo: string | null
  nombre: string | null
  distancia_m: number | null
  duracion_s: number | null
}

interface DiaMes {
  fecha: string
  fuera_de_mes: boolean
  dia_semana: string
  sesiones: SesionDia[]
  bloque_pendiente: boolean
  competiciones: { id: string; nombre: string; disciplina: string | null }[]
  realizados: Realizado[]
}

interface DetalleSesion {
  hora_inicio: string | null
  duracion_estimada_min: number | null
  contexto_ia: string | null
  ejercicios: { id: string; nombre: string; series: number | null; repeticiones: string | null; peso_sugerido: string | null; rpe: string | null }[]
  pasos: string[] | null
  distancia_m: number | null
  duracion_s: number | null
}

type Seleccion = { tipo: 'sesion'; sesion_id: string; fecha: string } | { tipo: 'dia'; fecha: string } | { tipo: 'nueva'; fecha: string } | null

type Portapapeles =
  | { tipo: 'sesion'; etiqueta: string; items: { sesion_id: string; fecha: string }[] }
  | { tipo: 'dia'; etiqueta: string; items: { sesion_id: string; fecha: string }[] }
  | { tipo: 'semana'; etiqueta: string; lunes: string; items: { sesion_id: string; fecha: string }[] }
  | null

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fechaLarga(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

function textoRealizado(r: Realizado) {
  const km = r.distancia_m ? ` · ${(r.distancia_m / 1000).toFixed(1).replace('.', ',')} km` : ''
  return `${r.nombre ?? r.tipo ?? 'Entreno'}${km}`
}

function minutos(s: number | null) {
  return s ? `${Math.round(s / 60)} min` : null
}

function ChipSesion({ sesion, fecha, seleccionada, esPasado, onSeleccionar }: {
  sesion: SesionDia
  fecha: string
  seleccionada: boolean
  esPasado: boolean
  onSeleccionar: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `${sesion.id}|${fecha}` })
  const color = sesion.fase_bloque ? FASE_COLOR[sesion.fase_bloque] : undefined
  const garmin = esPasado && sesion.garmin !== 'enviada' ? null : sesion.garmin
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onSeleccionar}
      className="touch-none select-none cursor-grab active:cursor-grabbing mb-1 relative"
      style={{ transform: transform ? CSS.Translate.toString(transform) : undefined, zIndex: isDragging ? 30 : undefined, opacity: isDragging ? 0.7 : 1 }}
      title={sesion.nombre}
    >
      <p
        className="text-[11px] font-medium px-1.5 py-1 rounded-md flex items-center gap-1"
        style={{
          background: color?.bg ?? 'var(--surface-elevated,var(--border))',
          color: color?.text ?? 'var(--text-muted)',
          outline: seleccionada ? '2px solid var(--primary)' : 'none',
          boxShadow: isDragging ? '0 6px 18px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {sesion.ajuste?.tipo === 'copiar' && <Copy size={10} className="flex-shrink-0" aria-label="Copia" />}
        {sesion.ajuste?.tipo === 'mover' && <span className="flex-shrink-0" aria-label="Movida">↷</span>}
        <span className="truncate flex-1">{sesion.nombre}</span>
        {garmin && <Watch size={10} className="flex-shrink-0" style={{ opacity: garmin === 'enviada' ? 1 : 0.45 }} aria-label={garmin === 'enviada' ? 'En el reloj' : 'Pendiente de enviar al reloj'} />}
      </p>
    </div>
  )
}

function Celda({ dia, hoy, seleccion, hayPortapapeles, onSeleccionarSesion, onSeleccionarDia, onPegar, onNueva }: {
  dia: DiaMes
  hoy: string
  seleccion: Seleccion
  hayPortapapeles: boolean
  onSeleccionarSesion: (sesionId: string, fecha: string) => void
  onSeleccionarDia: (fecha: string) => void
  onPegar: (fecha: string) => void
  onNueva: (fecha: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dia.fecha })
  const esHoy = dia.fecha === hoy
  const esPasado = dia.fecha < hoy
  const diaSel = seleccion?.tipo === 'dia' && seleccion.fecha === dia.fecha
  const numeroDia = parseInt(dia.fecha.slice(8, 10), 10)
  return (
    <div
      ref={setNodeRef}
      className="rounded-lg p-1.5 min-h-[104px] flex flex-col min-w-0"
      style={{
        background: isOver ? 'var(--semantic-info-bg)' : esHoy ? 'var(--semantic-info-bg)' : 'var(--bg)',
        border: `1px ${isOver ? 'dashed' : 'solid'} ${isOver || esHoy ? 'var(--semantic-info-border)' : 'var(--border)'}`,
        outline: diaSel ? '2px solid var(--primary)' : 'none',
        opacity: dia.fuera_de_mes ? 0.5 : 1,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => onSeleccionarDia(dia.fecha)}
          className="text-xs font-semibold px-1 rounded"
          style={{ color: esHoy ? 'var(--semantic-info-text)' : 'var(--text-muted)' }}
          title="Seleccionar día"
        >
          {numeroDia}
        </button>
        {!hayPortapapeles && (
          <button
            onClick={() => onNueva(dia.fecha)}
            className="p-0.5 rounded opacity-40 hover:opacity-100"
            style={{ color: 'var(--text-muted)' }}
            title="Añadir una sesión nueva este día"
            aria-label="Añadir sesión"
          >
            <Plus size={12} />
          </button>
        )}
        {hayPortapapeles && (
          <button
            onClick={() => onPegar(dia.fecha)}
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5"
            style={{ background: 'var(--primary)', color: 'var(--bg)' }}
          >
            <ClipboardPaste size={10} /> Pegar
          </button>
        )}
      </div>

      {dia.competiciones.length > 0 && (
        <div className="flex items-center gap-1 mb-1 px-1.5 py-1 rounded-md" style={{ background: 'var(--semantic-alert-bg)' }}>
          <Flag size={10} className="flex-shrink-0" style={{ color: 'var(--semantic-alert-text)' }} />
          <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--semantic-alert-text)' }}>{dia.competiciones[0].nombre}</span>
        </div>
      )}

      {dia.realizados.map(r => (
        <p key={r.id} className="text-[11px] font-medium px-1.5 py-1 rounded-md mb-1 flex items-center gap-1" style={{ background: 'var(--semantic-active-bg)', color: 'var(--semantic-active-text)' }} title={`Hecho: ${textoRealizado(r)}`}>
          <Check size={10} className="flex-shrink-0" />
          <span className="truncate">{textoRealizado(r)}</span>
        </p>
      ))}

      {dia.sesiones.map(s => (
        <ChipSesion
          key={`${s.id}|${s.ajuste?.id ?? 'plantilla'}`}
          sesion={s}
          fecha={dia.fecha}
          esPasado={esPasado}
          seleccionada={seleccion?.tipo === 'sesion' && seleccion.sesion_id === s.id && seleccion.fecha === dia.fecha}
          onSeleccionar={() => onSeleccionarSesion(s.id, dia.fecha)}
        />
      ))}

      {dia.bloque_pendiente && <span className="text-[11px]" style={{ color: 'var(--text-disabled)' }}>Bloque siguiente sin generar</span>}
    </div>
  )
}

export default function EntrenoCalendarioMes({ planId }: { planId: string }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-12
  const [dias, setDias] = useState<DiaMes[] | null>(null)
  const [catalogo, setCatalogo] = useState<Record<string, DetalleSesion>>({})
  const [seleccion, setSeleccion] = useState<Seleccion>(null)
  const [portapapeles, setPortapapeles] = useState<Portapapeles>(null)
  const [guardando, setGuardando] = useState(false)
  const [fechaMover, setFechaMover] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoAlcance, setNuevoAlcance] = useState<'dia' | 'semanal'>('dia')
  const { addToast } = useToast()
  const hoy = hoyISO()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/entrenos/mes-coach?plan_id=${planId}&year=${year}&month=${month}`)
      const data = await r.json()
      setDias(data.dias ?? [])
      setCatalogo(data.catalogo ?? {})
    } catch {
      setDias(prev => prev ?? [])
    }
  }, [planId, year, month])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setPortapapeles(null); setSeleccion(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function cambiarMes(delta: number) {
    let m = month + delta
    let y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    setDias(null)
    setMonth(m); setYear(y)
  }

  // Mueve la sesión en pantalla al instante (antes de que responda el servidor) para que el arrastre no «rebote».
  function moverLocal(sesionId: string, desde: string, hasta: string) {
    setDias(prev => {
      if (!prev) return prev
      const origen = prev.find(d => d.fecha === desde)?.sesiones.find(x => x.id === sesionId)
      if (!origen || !prev.some(d => d.fecha === hasta)) return prev
      const movida: SesionDia = { ...origen, ajuste: origen.ajuste ?? { id: `local-${sesionId}`, tipo: 'mover', fecha_origen: desde } }
      return prev.map(d => d.fecha === desde
        ? { ...d, sesiones: d.sesiones.filter(x => x.id !== sesionId) }
        : d.fecha === hasta ? { ...d, sesiones: [...d.sesiones, movida] } : d)
    })
  }

  async function aplicar(operaciones: Operacion[]): Promise<boolean> {
    setGuardando(true)
    try {
      const res = await fetch('/api/entrenos/calendario-ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, operaciones }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'error')
      await cargar()
      return true
    } catch {
      await cargar() // deshace el cambio hecho en pantalla
      addToast({ type: 'error', title: 'No se pudo guardar el cambio' })
      return false
    } finally {
      setGuardando(false)
    }
  }

  const diaDe = (fecha: string) => dias?.find(d => d.fecha === fecha)

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const [sesionId, desde] = String(active.id).split('|')
    const hasta = String(over.id)
    if (!esFechaISO(hasta) || hasta === desde) return
    moverLocal(sesionId, desde, hasta)
    const ok = await aplicar([{ op: 'mover', sesion_id: sesionId, desde, hasta }])
    if (ok) setSeleccion(null)
  }

  function copiarSesion(sesionId: string, fecha: string) {
    const nombre = diaDe(fecha)?.sesiones.find(s => s.id === sesionId)?.nombre ?? 'Sesión'
    setPortapapeles({ tipo: 'sesion', etiqueta: nombre, items: [{ sesion_id: sesionId, fecha }] })
  }

  function copiarDia(fecha: string) {
    const items = (diaDe(fecha)?.sesiones ?? []).map(s => ({ sesion_id: s.id, fecha }))
    if (items.length === 0) { addToast({ type: 'info', title: 'Ese día no tiene sesiones que copiar' }); return }
    setPortapapeles({ tipo: 'dia', etiqueta: `Día ${fechaLarga(fecha)}`, items })
  }

  function copiarSemana(fecha: string) {
    const lunes = lunesDe(fecha)
    const items: { sesion_id: string; fecha: string }[] = []
    for (let i = 0; i < 7; i++) {
      const f = sumarDias(lunes, i)
      for (const s of diaDe(f)?.sesiones ?? []) items.push({ sesion_id: s.id, fecha: f })
    }
    if (items.length === 0) { addToast({ type: 'info', title: 'Esa semana no tiene sesiones que copiar' }); return }
    setPortapapeles({ tipo: 'semana', etiqueta: `Semana del ${fechaLarga(lunes)}`, lunes, items })
  }

  async function pegar(fechaDestino: string) {
    if (!portapapeles) return
    let ops: Operacion[]
    if (portapapeles.tipo === 'semana') {
      const desfase = diferenciaDias(portapapeles.lunes, lunesDe(fechaDestino))
      if (desfase === 0) { addToast({ type: 'info', title: 'Elige otra semana para pegar' }); return }
      ops = portapapeles.items.map(i => ({ op: 'copiar', sesion_id: i.sesion_id, hasta: sumarDias(i.fecha, desfase) }))
    } else {
      ops = portapapeles.items.map(i => ({ op: 'copiar', sesion_id: i.sesion_id, hasta: fechaDestino }))
    }
    await aplicar(ops)
  }

  async function quitar(sesionId: string, fecha: string) {
    const ok = await aplicar([{ op: 'omitir', sesion_id: sesionId, desde: fecha }])
    if (ok) setSeleccion(null)
  }

  async function moverAFecha(sesionId: string, desde: string) {
    if (!esFechaISO(fechaMover)) return
    moverLocal(sesionId, desde, fechaMover)
    const ok = await aplicar([{ op: 'mover', sesion_id: sesionId, desde, hasta: fechaMover }])
    if (ok) { setSeleccion(null); setFechaMover('') }
  }

  async function crearSesion(fecha: string) {
    const nombre = nuevoNombre.trim()
    if (!nombre) return
    setGuardando(true)
    try {
      const res = await fetch('/api/entrenos/calendario-sesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, fecha, nombre, alcance: nuevoAlcance }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'error')
      await cargar()
      setNuevoNombre('')
      setSeleccion({ tipo: 'sesion', sesion_id: json.sesion_id, fecha })
    } catch {
      addToast({ type: 'error', title: 'No se pudo crear la sesión' })
    } finally {
      setGuardando(false)
    }
  }

  if (dias === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  const selSesion = seleccion?.tipo === 'sesion' ? seleccion : null
  const diaSel = seleccion ? diaDe(seleccion.fecha) : null
  const sesionSel = selSesion ? diaSel?.sesiones.find(s => s.id === selSesion.sesion_id) ?? null : null
  const detalle = selSesion ? catalogo[selSesion.sesion_id] : null

  const mensajeGarmin = (s: SesionDia, fecha: string) => {
    if (!detalle?.pasos) return 'Sin pasos de Garmin: esta sesión no se envía al reloj.'
    if (s.garmin === 'enviada') return 'Programada en el reloj (Garmin) para este día.'
    if (fecha < hoy) return 'Con pasos de Garmin, pero este día ya pasó sin enviarse.'
    return 'Con pasos de Garmin: se enviará al reloj automáticamente (se deja programado hasta dentro de 3 semanas).'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-base font-semibold" style={{ color: 'var(--text)' }}>{MESES[month - 1]} {year}</p>
        <div className="flex items-center gap-1.5">
          {guardando && <Loader2 size={14} className="animate-spin mr-1" style={{ color: 'var(--text-muted)' }} />}
          <button onClick={() => cambiarMes(-1)} className="p-2 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }} aria-label="Mes anterior"><ChevronLeft size={15} /></button>
          <button onClick={() => cambiarMes(1)} className="p-2 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }} aria-label="Mes siguiente"><ChevronRight size={15} /></button>
        </div>
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Arrastra una sesión a otro día para moverla solo esa fecha. Pulsa una sesión para ver su detalle, copiarla o quitarla; pulsa el número de un día para copiar el día o la semana.
        <span className="ml-1">↷ movida · <Copy size={10} className="inline" /> copia · <Check size={10} className="inline" /> hecho (Garmin) · <Watch size={10} className="inline" /> en el reloj</span>
      </p>

      {portapapeles && (
        <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 mb-3" style={{ background: 'var(--semantic-info-bg)', border: '1px solid var(--semantic-info-border)' }}>
          <p className="text-sm" style={{ color: 'var(--semantic-info-text)' }}>
            Copiado: <strong>{portapapeles.etiqueta}</strong> — pulsa «Pegar» en el día{portapapeles.tipo === 'semana' ? ' (se pega la semana entera)' : ''} de destino.
          </p>
          <button onClick={() => setPortapapeles(null)} className="btn-secondary btn-sm flex-shrink-0"><X size={13} /> Cancelar</button>
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {DIAS_ABREV.map(d => (
            <p key={d} className="text-center text-xs font-semibold uppercase tracking-wider py-1" style={{ color: 'var(--text-muted)' }}>{d}</p>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {dias.map(dia => (
            <Celda
              key={dia.fecha}
              dia={dia}
              hoy={hoy}
              seleccion={seleccion}
              hayPortapapeles={!!portapapeles}
              onSeleccionarSesion={(id, fecha) => setSeleccion({ tipo: 'sesion', sesion_id: id, fecha })}
              onSeleccionarDia={fecha => setSeleccion({ tipo: 'dia', fecha })}
              onPegar={pegar}
              onNueva={fecha => { setNuevoNombre(''); setNuevoAlcance('dia'); setSeleccion({ tipo: 'nueva', fecha }) }}
            />
          ))}
        </div>
      </DndContext>

      {seleccion?.tipo === 'nueva' && (
        <div className="rounded-xl p-4 mt-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>{fechaLarga(seleccion.fecha)}</p>
              <h3 className="font-bold leading-tight" style={{ color: 'var(--text)' }}>Nueva sesión</h3>
            </div>
            <button onClick={() => setSeleccion(null)} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: 'var(--text-muted)' }} aria-label="Cerrar"><X size={15} /></button>
          </div>
          <input
            autoFocus
            value={nuevoNombre}
            onChange={e => setNuevoNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') crearSesion(seleccion.fecha) }}
            maxLength={80}
            placeholder="Nombre de la sesión (p. ej. Rodaje fácil 30 min)"
            className="w-full text-sm px-3 py-2 rounded-lg mb-3"
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
          <div className="flex flex-wrap gap-4 mb-3 text-sm" style={{ color: 'var(--text)' }}>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" checked={nuevoAlcance === 'dia'} onChange={() => setNuevoAlcance('dia')} /> Solo este día
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" checked={nuevoAlcance === 'semanal'} onChange={() => setNuevoAlcance('semanal')} /> Todos los {diaSemanaDe(seleccion.fecha).toLowerCase()} del bloque
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => crearSesion(seleccion.fecha)} disabled={guardando || !nuevoNombre.trim()} className="btn-primary btn-sm">
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Añadir sesión
            </button>
            <button onClick={() => setSeleccion(null)} className="btn-secondary btn-sm">Cancelar</button>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Se crea vacía: después puedes añadirle ejercicios desde «Abrir plan».</p>
        </div>
      )}

      {seleccion && seleccion.tipo !== 'nueva' && diaSel && (
        <div className="rounded-xl p-4 mt-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>{fechaLarga(seleccion.fecha)}</p>
              <h3 className="font-bold leading-tight" style={{ color: 'var(--text)' }}>
                {sesionSel ? sesionSel.nombre : 'Día seleccionado'}
              </h3>
              {sesionSel?.ajuste?.tipo === 'copiar' && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Copia puesta a mano en este día.</p>}
              {sesionSel?.ajuste?.tipo === 'mover' && sesionSel.ajuste.fecha_origen && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Movida desde el {fechaLarga(sesionSel.ajuste.fecha_origen)}.</p>}
            </div>
            <button onClick={() => setSeleccion(null)} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: 'var(--text-muted)' }} aria-label="Cerrar"><X size={15} /></button>
          </div>

          {sesionSel && selSesion && (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                {sesionSel.fase_bloque && <span>Fase {sesionSel.fase_bloque}</span>}
                {detalle?.hora_inicio && <span>{detalle.hora_inicio}</span>}
                {(detalle?.duracion_estimada_min || minutos(detalle?.duracion_s ?? null)) && <span>{detalle?.duracion_estimada_min ? `${detalle.duracion_estimada_min} min` : minutos(detalle?.duracion_s ?? null)}</span>}
                {detalle?.distancia_m ? <span>{(detalle.distancia_m / 1000).toFixed(1).replace('.', ',')} km</span> : null}
                {detalle?.contexto_ia && <span style={{ color: 'var(--semantic-info-text)' }}>{detalle.contexto_ia}</span>}
              </div>

              <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                <Watch size={12} style={{ color: 'var(--text-muted)' }} /> {mensajeGarmin(sesionSel, selSesion.fecha)}
              </p>

              {detalle?.pasos && (
                <ul className="space-y-1 mb-3">
                  {detalle.pasos.map((l, i) => <li key={i} className="text-sm" style={{ color: 'var(--text)' }}>{l}</li>)}
                </ul>
              )}

              {/* Si la sesión tiene pasos de Garmin, ya están todos arriba: la lista de ejercicios sería redundante. */}
              {detalle && !detalle.pasos && detalle.ejercicios.length > 0 && (
                <ul className="space-y-1.5 mb-4">
                  {detalle.ejercicios.map(e => {
                    const stats = [e.series && `${e.series}x${e.repeticiones ?? '?'}`, e.peso_sugerido, e.rpe && `RPE ${e.rpe}`].filter(Boolean)
                    return (
                      <li key={e.id} className="text-sm" style={{ color: 'var(--text)' }}>
                        {e.nombre}{stats.length > 0 && <span className="ml-2 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{stats.join(' · ')}</span>}
                      </li>
                    )
                  })}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => copiarSesion(selSesion.sesion_id, selSesion.fecha)} className="btn-secondary btn-sm"><Copy size={13} /> Copiar</button>
                <button onClick={() => quitar(selSesion.sesion_id, selSesion.fecha)} disabled={guardando} className="btn-secondary btn-sm"><Trash2 size={13} /> Quitar de este día</button>
                <a href={`/entrenos/${planId}`} className="btn-secondary btn-sm"><ExternalLink size={13} /> Editar en el plan</a>
                <span className="flex items-center gap-1.5 ml-auto">
                  <input
                    type="date"
                    value={fechaMover}
                    onChange={e => setFechaMover(e.target.value)}
                    className="text-sm px-2 py-1 rounded-lg"
                    style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    aria-label="Mover a la fecha"
                  />
                  <button onClick={() => moverAFecha(selSesion.sesion_id, selSesion.fecha)} disabled={guardando || !esFechaISO(fechaMover)} className="btn-secondary btn-sm">Mover a esa fecha</button>
                </span>
              </div>
            </>
          )}

          {!sesionSel && (
            <>
              {diaSel.realizados.length > 0 && (
                <ul className="space-y-1 mb-3">
                  {diaSel.realizados.map(r => (
                    <li key={r.id} className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                      <Check size={13} style={{ color: 'var(--semantic-active-text)' }} /> Hecho: {textoRealizado(r)}{minutos(r.duracion_s) ? ` · ${minutos(r.duracion_s)}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              {diaSel.sesiones.length === 0 && diaSel.realizados.length === 0 && (
                <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Día de descanso: sin sesiones planificadas ni entrenos registrados.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => copiarDia(seleccion.fecha)} className="btn-secondary btn-sm"><Copy size={13} /> Copiar día</button>
                <button onClick={() => copiarSemana(seleccion.fecha)} className="btn-secondary btn-sm"><Copy size={13} /> Copiar semana</button>
                <button onClick={() => { setNuevoNombre(''); setNuevoAlcance('dia'); setSeleccion({ tipo: 'nueva', fecha: seleccion.fecha }) }} className="btn-secondary btn-sm"><Plus size={13} /> Nueva sesión</button>
                {portapapeles && <button onClick={() => pegar(seleccion.fecha)} disabled={guardando} className="btn-primary btn-sm"><ClipboardPaste size={13} /> Pegar aquí</button>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
