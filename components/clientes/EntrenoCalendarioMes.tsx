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
import { Check, ChevronLeft, ChevronRight, ClipboardPaste, Copy, Flag, Loader2, Pencil, Plus, Trash2, Watch, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { diaSemanaDe, diferenciaDias, lunesDe, sumarDias, esFechaISO, type Operacion } from '@/lib/entrenos/calendario-ajustes'
import { CATEGORIAS_SESION, type CategoriaSesion } from '@/lib/entrenos/biblioteca-categorias'
import EditorSesionCalendario, { type EjercicioEditable } from '@/components/clientes/EditorSesionCalendario'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_ABREV = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const FASE_COLOR: Record<string, { bg: string; text: string }> = {
  Base: { bg: 'var(--semantic-info-bg)', text: 'var(--semantic-info-text)' },
  Fuerza: { bg: 'var(--semantic-warn-bg)', text: 'var(--semantic-warn-text)' },
  Resistencia: { bg: 'var(--semantic-active-bg)', text: 'var(--semantic-active-text)' },
  Deload: { bg: 'var(--border)', text: 'var(--text-muted)' },
}

type EstadoGarmin = 'enviada' | 'pendiente' | null

interface SesionBase {
  id: string
  nombre: string
  categoria: CategoriaSesion
  plantilla: string
  duracion_min: number | null
  n_ejercicios: number
  con_pasos: boolean
}

const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const MAX_REPETICIONES = 120

interface SesionDia {
  id: string
  nombre: string
  fase_bloque: string | null
  ajuste: { id: string; tipo: 'mover' | 'copiar' | 'omitir'; fecha_origen: string | null } | null
  compartida: boolean
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
  /** Sesiones orientativas del macrociclo para fechas posteriores al bloque en curso (aún sin crear). */
  prevision?: { fase: string; sesiones: { id: string; nombre: string; tipo_sesion: string; km: number | null }[] } | null
  competiciones: { id: string; nombre: string; disciplina: string | null }[]
  realizados: Realizado[]
}

interface DetalleSemana extends Omit<DetalleSesion, 'nombre' | 'hora_inicio' | 'duracion_estimada_min' | 'contexto_ia'> { semana: { n: number; total: number | null; descarga: boolean } }

interface DetalleSesion {
  nombre: string
  hora_inicio: string | null
  duracion_estimada_min: number | null
  contexto_ia: string | null
  ejercicios: EjercicioEditable[]
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

function ChipSesion({ sesion, fecha, seleccionada, esPasado, onSeleccionar, resumen }: {
  sesion: SesionDia
  fecha: string
  seleccionada: boolean
  esPasado: boolean
  onSeleccionar: () => void
  /** Vista semanal: pasos o ejercicios de la sesión, para ver el día de un vistazo. */
  resumen?: string[]
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
      {resumen && resumen.length > 0 && (
        <ul className="mt-1 px-1 space-y-0.5">
          {resumen.slice(0, 7).map((l, i) => <li key={i} className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>{l}</li>)}
          {resumen.length > 7 && <li className="text-[11px]" style={{ color: 'var(--text-muted)' }}>+{resumen.length - 7} más</li>}
        </ul>
      )}
    </div>
  )
}

function Celda({ dia, hoy, seleccion, hayPortapapeles, onSeleccionarSesion, onSeleccionarDia, onPegar, onNueva, resumenDe, alta }: {
  dia: DiaMes
  hoy: string
  seleccion: Seleccion
  hayPortapapeles: boolean
  onSeleccionarSesion: (sesionId: string, fecha: string) => void
  onSeleccionarDia: (fecha: string) => void
  onPegar: (fecha: string) => void
  onNueva: (fecha: string) => void
  resumenDe?: (sesionId: string) => string[]
  alta?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dia.fecha })
  const esHoy = dia.fecha === hoy
  const esPasado = dia.fecha < hoy
  const diaSel = seleccion?.tipo === 'dia' && seleccion.fecha === dia.fecha
  const numeroDia = parseInt(dia.fecha.slice(8, 10), 10)
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg p-1.5 flex flex-col min-w-0 ${alta ? 'min-h-[260px]' : 'min-h-[104px]'}`}
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
          resumen={resumenDe?.(s.id)}
        />
      ))}

      {dia.prevision?.sesiones.map(p => (
        <p key={p.id} className="text-[11px] px-1.5 py-1 rounded-md mb-1 truncate" style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }} title={`Previsión (${dia.prevision?.fase}): se crea al cerrar el bloque`}>
          {p.nombre}{p.km ? ` · ≈ ${p.km.toFixed(1).replace('.', ',')} km` : ''}
        </p>
      ))}

      {dia.bloque_pendiente && <span className="text-[11px]" style={{ color: 'var(--text-disabled)' }}>Bloque siguiente sin generar</span>}
    </div>
  )
}

export default function EntrenoCalendarioMes({ planId, vista = 'mes' }: { planId: string; vista?: 'mes' | 'semana' }) {
  const now = new Date()
  const [semanaLunes, setSemanaLunes] = useState(() => lunesDe(hoyISO()))
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-12
  const [dias, setDias] = useState<DiaMes[] | null>(null)
  const [catalogo, setCatalogo] = useState<Record<string, DetalleSesion>>({})
  const [catalogoSemana, setCatalogoSemana] = useState<Record<string, DetalleSemana>>({})
  const [seleccion, setSeleccion] = useState<Seleccion>(null)
  const [portapapeles, setPortapapeles] = useState<Portapapeles>(null)
  const [guardando, setGuardando] = useState(false)
  const [fechaMover, setFechaMover] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoAlcance, setNuevoAlcance] = useState<'dia' | 'repetir' | 'semanal'>('dia')
  const [biblioteca, setBiblioteca] = useState<SesionBase[] | null>(null)
  const [bibliotecaError, setBibliotecaError] = useState(false)
  const [categoria, setCategoria] = useState<CategoriaSesion | 'Todas'>('Todas')
  const [busqueda, setBusqueda] = useState('')
  const [baseSel, setBaseSel] = useState<SesionBase | null>(null)
  const [diasRep, setDiasRep] = useState<number[]>([])
  const [hastaRep, setHastaRep] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const { addToast } = useToast()
  const [reenviando, setReenviando] = useState(false)
  const reenviarGarmin = async () => {
    if (!window.confirm('¿Reenviar a Garmin todo lo programado de este cliente? Se vuelve a crear en su calendario sin duplicar.')) return
    setReenviando(true)
    try {
      const res = await fetch(`/api/entrenos/planes/${planId}/garmin-reenviar`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo reenviar')
      addToast(data.errores?.length ? { type: 'error', title: `Reenviadas ${data.enviados}; fallo: ${data.errores[0]}` } : { type: 'success', title: `Reenviadas ${data.enviados} sesiones a Garmin` })
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'No se pudo reenviar' })
    } finally {
      setReenviando(false)
    }
  }
  const hoy = hoyISO()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/entrenos/mes-coach?plan_id=${planId}&year=${year}&month=${month}`)
      const data = await r.json()
      setDias(data.dias ?? [])
      setCatalogo(data.catalogo ?? {})
      setCatalogoSemana(data.catalogo_semana ?? {})
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

  function cambiarSemana(delta: number) {
    const nuevo = sumarDias(semanaLunes, delta * 7)
    const y = Number(nuevo.slice(0, 4))
    const m = Number(nuevo.slice(5, 7))
    // Los datos cubren las semanas completas del mes: solo se recargan si la semana cae en otro mes
    // (si no, no cambia year/month, nada dispara la carga y la pantalla se quedaría esperando).
    if (y !== year || m !== month) { setDias(null); setYear(y); setMonth(m) }
    setSemanaLunes(nuevo)
  }

  function resumenDe(sesionId: string): string[] {
    const c = catalogo[sesionId]
    if (!c) return []
    return c.pasos ?? c.ejercicios.map(e => `${e.nombre}${e.series ? ` · ${e.series}×${e.repeticiones ?? '?'}` : ''}${e.peso_sugerido ? ` · ${e.peso_sugerido}` : ''}`)
  }

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

  function abrirNueva(fecha: string) {
    setNuevoNombre(''); setNuevoAlcance('dia'); setBaseSel(null); setBusqueda('')
    setDiasRep([NOMBRES_DIA.indexOf(diaSemanaDe(fecha))]); setHastaRep(sumarDias(fecha, 27))
    setSeleccion({ tipo: 'nueva', fecha })
    if (biblioteca === null) {
      setBibliotecaError(false)
      fetch('/api/entrenos/biblioteca-sesiones')
        .then(r => r.json())
        .then(d => setBiblioteca(d.sesiones ?? []))
        .catch(() => { setBiblioteca([]); setBibliotecaError(true) })
    }
  }

  function fechasARepetir(fecha: string): string[] {
    if (nuevoAlcance !== 'repetir') return [fecha]
    const out: string[] = []
    for (let f = fecha; f <= hastaRep && out.length < MAX_REPETICIONES; f = sumarDias(f, 1)) {
      if (diasRep.includes(NOMBRES_DIA.indexOf(diaSemanaDe(f)))) out.push(f)
    }
    return out.length > 0 ? out : [fecha]
  }

  async function crearSesion(fecha: string) {
    const nombre = nuevoNombre.trim()
    if (!nombre) return
    setGuardando(true)
    try {
      const res = await fetch('/api/entrenos/calendario-sesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, fecha, fechas: fechasARepetir(fecha), nombre, alcance: nuevoAlcance === 'semanal' ? 'semanal' : 'dia', plantilla_sesion_id: baseSel?.id }),
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
  // `base` = semana tipo (lo que se edita); `detalle` = lo que toca en ESTA fecha (semana del bloque con su progresión).
  const base = selSesion ? catalogo[selSesion.sesion_id] : null
  const deLaSemana = selSesion ? catalogoSemana[`${selSesion.sesion_id}|${selSesion.fecha}`] : undefined
  const detalle = base ? (deLaSemana ? { ...base, ...deLaSemana } : base) : null

  const mensajeGarmin = (s: SesionDia, fecha: string) => {
    if (!detalle?.pasos) return 'Sin pasos de Garmin: esta sesión no se envía al reloj.'
    if (s.garmin === 'enviada') return 'Programada en el reloj (Garmin) para este día.'
    if (fecha < hoy) return 'Con pasos de Garmin, pero este día ya pasó sin enviarse.'
    return 'Con pasos de Garmin: se enviará al reloj automáticamente (se deja programado hasta dentro de 3 semanas).'
  }

  return (
    <div className="coach-training-calendar">
      <div className="flex items-center justify-between mb-3">
        <p className="text-base font-semibold" style={{ color: 'var(--text)' }}>
          {vista === 'semana' ? `Semana del ${parseInt(semanaLunes.slice(8), 10)} de ${MESES[Number(semanaLunes.slice(5, 7)) - 1].toLowerCase()} al ${parseInt(sumarDias(semanaLunes, 6).slice(8), 10)} de ${MESES[Number(sumarDias(semanaLunes, 6).slice(5, 7)) - 1].toLowerCase()}` : `${MESES[month - 1]} ${year}`}
        </p>
        <div className="flex items-center gap-1.5">
          <button onClick={reenviarGarmin} disabled={reenviando} className="mr-1 flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium disabled:opacity-60" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }} title="Vuelve a mandar al reloj todo lo programado (por si el envío automático falló)">
            {reenviando ? <Loader2 size={13} className="animate-spin" /> : <Watch size={13} />} Reenviar a Garmin
          </button>
          {guardando && <Loader2 size={14} className="animate-spin mr-1" style={{ color: 'var(--text-muted)' }} />}
          <button onClick={() => (vista === 'semana' ? cambiarSemana(-1) : cambiarMes(-1))} className="p-2 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }} aria-label={vista === 'semana' ? 'Semana anterior' : 'Mes anterior'}><ChevronLeft size={15} /></button>
          <button onClick={() => (vista === 'semana' ? cambiarSemana(1) : cambiarMes(1))} className="p-2 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }} aria-label={vista === 'semana' ? 'Semana siguiente' : 'Mes siguiente'}><ChevronRight size={15} /></button>
        </div>
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        {vista === 'semana' ? 'Cada día se edita por separado: arrastra una sesión a otro día, o púlsala para editar sus ejercicios, cargas y repeticiones solo en esa fecha.' : 'Arrastra una sesión a otro día para moverla solo esa fecha. Pulsa una sesión para ver su detalle, copiarla o quitarla; pulsa el número de un día para copiar el día o la semana.'}
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
        <div className={vista === 'semana' ? 'overflow-x-auto pb-1' : ''}>
        <div className={vista === 'semana' ? 'min-w-[900px]' : ''}>
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {DIAS_ABREV.map(d => (
            <p key={d} className="text-center text-xs font-semibold uppercase tracking-wider py-1" style={{ color: 'var(--text-muted)' }}>{d}</p>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {(vista === 'semana' ? dias.filter(d => d.fecha >= semanaLunes && d.fecha <= sumarDias(semanaLunes, 6)) : dias).map(dia => (
            <Celda
              key={dia.fecha}
              dia={dia}
              hoy={hoy}
              seleccion={seleccion}
              hayPortapapeles={!!portapapeles}
              onSeleccionarSesion={(id, fecha) => setSeleccion({ tipo: 'sesion', sesion_id: id, fecha })}
              onSeleccionarDia={fecha => setSeleccion({ tipo: 'dia', fecha })}
              onPegar={pegar}
              onNueva={abrirNueva}
              resumenDe={vista === 'semana' ? resumenDe : undefined}
              alta={vista === 'semana'}
            />
          ))}
        </div>
        </div>
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

          <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Sesión base (opcional)</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(['Todas', ...CATEGORIAS_SESION] as const).map(c => (
              <button
                key={c}
                onClick={() => setCategoria(c)}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: categoria === c ? 'var(--primary)' : 'transparent', color: categoria === c ? 'var(--bg)' : 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar sesión (series, tirada, híbrida, pierna…)"
            className="w-full text-sm px-3 py-2 rounded-lg mb-2"
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
          <div className="rounded-lg mb-3 max-h-56 overflow-y-auto" style={{ border: '1px solid var(--border)' }}>
            {biblioteca === null ? (
              <div className="flex items-center justify-center py-5"><Loader2 size={15} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
            ) : (() => {
              const q = busqueda.trim().toLowerCase()
              const lista = biblioteca.filter(b => (categoria === 'Todas' || b.categoria === categoria) && (!q || `${b.nombre} ${b.plantilla}`.toLowerCase().includes(q)))
              if (lista.length === 0) return <p className="text-sm px-3 py-3" style={{ color: 'var(--text-muted)' }}>{bibliotecaError ? 'No se pudo cargar la biblioteca.' : 'No hay sesiones con ese filtro.'}</p>
              return lista.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setBaseSel(b); setNuevoNombre(b.nombre.slice(0, 80)) }}
                  className="w-full text-left px-3 py-2 flex items-center justify-between gap-3"
                  style={{ background: baseSel?.id === b.id ? 'var(--semantic-info-bg)' : 'transparent', borderBottom: '1px solid var(--border)' }}
                >
                  <span className="min-w-0">
                    <span className="block text-sm truncate" style={{ color: 'var(--text)' }}>{b.nombre}</span>
                    <span className="block text-xs truncate" style={{ color: 'var(--text-muted)' }}>{b.categoria} · {b.plantilla}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {b.duracion_min ? `${b.duracion_min} min` : `${b.n_ejercicios} ej.`}
                    {b.con_pasos && <Watch size={12} aria-label="Con pasos de Garmin" />}
                  </span>
                </button>
              ))
            })()}
          </div>
          {baseSel && (
            <p className="text-xs mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              Se copiará «{baseSel.nombre}» con sus ejercicios{baseSel.con_pasos ? ' y pasos de Garmin' : ''}.
              <button onClick={() => { setBaseSel(null); setNuevoNombre('') }} className="underline">Quitar</button>
            </p>
          )}

          <input
            value={nuevoNombre}
            onChange={e => setNuevoNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') crearSesion(seleccion.fecha) }}
            maxLength={80}
            placeholder="Nombre de la sesión (p. ej. Rodaje fácil 30 min)"
            className="w-full text-sm px-3 py-2 rounded-lg mb-3"
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />

          <div className="flex flex-wrap gap-4 mb-2 text-sm" style={{ color: 'var(--text)' }}>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" checked={nuevoAlcance === 'dia'} onChange={() => setNuevoAlcance('dia')} /> Solo este día
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" checked={nuevoAlcance === 'repetir'} onChange={() => setNuevoAlcance('repetir')} /> Repetir en los días que elija
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" checked={nuevoAlcance === 'semanal'} onChange={() => setNuevoAlcance('semanal')} /> Todos los {diaSemanaDe(seleccion.fecha).toLowerCase()} del bloque
            </label>
          </div>
          {nuevoAlcance === 'repetir' && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {DIAS_ABREV.map((d, i) => (
                <button
                  key={d}
                  onClick={() => setDiasRep(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                  className="w-8 h-8 rounded-full text-xs font-semibold"
                  style={{ background: diasRep.includes(i) ? 'var(--primary)' : 'transparent', color: diasRep.includes(i) ? 'var(--bg)' : 'var(--text-muted)', border: '1px solid var(--border)' }}
                  aria-label={NOMBRES_DIA[i]}
                >
                  {d}
                </button>
              ))}
              <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>hasta</span>
              <input
                type="date"
                value={hastaRep}
                min={seleccion.fecha}
                onChange={e => setHastaRep(e.target.value)}
                className="text-sm px-2 py-1 rounded-lg"
                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({fechasARepetir(seleccion.fecha).length} {fechasARepetir(seleccion.fecha).length === 1 ? 'día' : 'días'})</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={() => crearSesion(seleccion.fecha)} disabled={guardando || !nuevoNombre.trim()} className="btn-primary btn-sm">
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Añadir sesión
            </button>
            <button onClick={() => setSeleccion(null)} className="btn-secondary btn-sm">Cancelar</button>
          </div>
          {!baseSel && <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Sin sesión base se crea vacía: después puedes añadirle ejercicios con el botón «Editar» de la sesión.</p>}
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
                {deLaSemana && <span>Semana {deLaSemana.semana.n}{deLaSemana.semana.total ? ` de ${deLaSemana.semana.total}` : ''}{deLaSemana.semana.descarga ? ' · descarga' : ''}</span>}
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

              {editando === selSesion.sesion_id && detalle && deLaSemana && (
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Estás editando la semana tipo (semana 1): el resto de semanas del bloque se calculan desde ella (más carga, descarga…).</p>
              )}

              {editando === selSesion.sesion_id && detalle && (
                <EditorSesionCalendario
                  key={selSesion.sesion_id}
                  sesionId={selSesion.sesion_id}
                  fecha={selSesion.fecha}
                  nombre={detalle.nombre}
                  duracionMin={detalle.duracion_estimada_min}
                  ejercicios={base?.ejercicios ?? detalle.ejercicios}
                  compartida={sesionSel.compartida}
                  conPasos={!!detalle.pasos}
                  onCambio={cargar}
                  onIndependizada={nuevoId => { setSeleccion({ tipo: 'sesion', sesion_id: nuevoId, fecha: selSesion.fecha }); setEditando(nuevoId) }}
                />
              )}

              {/* Si la sesión tiene pasos de Garmin, ya están todos arriba: la lista de ejercicios sería redundante. */}
              {detalle && !detalle.pasos && editando !== selSesion.sesion_id && detalle.ejercicios.length > 0 && (
                <ul className="space-y-1.5 mb-4">
                  {detalle.ejercicios.map(e => {
                    const stats = [e.series && `${e.series}x${e.repeticiones ?? '?'}`, e.peso_sugerido, e.rpe && `RPE ${e.rpe}`].filter(Boolean)
                    return (
                      <li key={e.id} className="text-sm" style={{ color: 'var(--text)' }}>
                        {e.nombre}{stats.length > 0 && <span className="ml-2 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{stats.join(' · ')}</span>}
                        {e.encadenado && <span className="ml-2 text-[11px] uppercase tracking-wider" style={{ color: 'var(--semantic-active)' }}>↓ sin parar</span>}
                      </li>
                    )
                  })}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => copiarSesion(selSesion.sesion_id, selSesion.fecha)} className="btn-secondary btn-sm"><Copy size={13} /> Copiar</button>
                <button onClick={() => quitar(selSesion.sesion_id, selSesion.fecha)} disabled={guardando} className="btn-secondary btn-sm"><Trash2 size={13} /> Quitar de este día</button>
                <button onClick={() => setEditando(editando === selSesion.sesion_id ? null : selSesion.sesion_id)} className="btn-secondary btn-sm"><Pencil size={13} /> {editando === selSesion.sesion_id ? 'Cerrar edición' : 'Editar'}</button>
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
                <button onClick={() => abrirNueva(seleccion.fecha)} className="btn-secondary btn-sm"><Plus size={13} /> Nueva sesión</button>
                {portapapeles && <button onClick={() => pegar(seleccion.fecha)} disabled={guardando} className="btn-primary btn-sm"><ClipboardPaste size={13} /> Pegar aquí</button>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
