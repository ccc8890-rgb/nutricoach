'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import cloudinaryLoader from '@/lib/cloudinary-loader'
import { PROTEINAS_PRINCIPALES, ETIQUETA_PROTEINA } from '@/lib/recetas-constants'
import DetalleDiaDieta from './DetalleDiaDieta'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Activity, BadgeCheck, CalendarDays, ChevronDown, ChevronRight, ClipboardPaste, Copy, Loader2, Maximize2, Minimize2, MoreHorizontal, Play, Plus, Search, SlidersHorizontal, Sparkles, Trash2, Video, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { GuardarPlantillaModal, ListaPlantillasModal, type PlantillaSemana, type SemanaPlantilla } from './PlantillasSemanaDieta'

type Receta = { id: string; nombre: string; imagen_url: string | null; contenido_estado: string | null; verificacion: string | null }
type Comida = { id: string; nombre: string; recurrente: boolean; receta: Receta | null; kcal: number; p: number; c: number; g: number }
type Total = { kcal: number; p: number; c: number; g: number }
type Dia = { dia: string; comidas: Comida[]; total: Total }
type Plan = { id: string; nombre: string; kcal_objetivo: number | null; proteinas_objetivo: number | null; carbohidratos_objetivo: number | null; grasas_objetivo: number | null }
type RecetaOpcion = Receta & { kcal: number; proteinas: number; tiempo_prep_min: number | null; kcal_hueco?: number; proteinas_hueco?: number; encaje?: number; usos?: number; favorita?: boolean; familia?: string | null; proteinas_principales?: string[] }
type FiltroOpcion = 'rapidas' | 'proteicas' | 'favoritas'
const FILTROS_OPCION: { id: FiltroOpcion; texto: string }[] = [{ id: 'rapidas', texto: 'Rápidas' }, { id: 'proteicas', texto: 'Alta proteína' }, { id: 'favoritas', texto: 'Favoritas' }]
type ResultadoSemana = { ok: boolean; complementos?: number; avisos?: { dia: string; franja: string; motivo: string }[]; asignadas: number; repetidas: number; sinCubrir: { dia: string; franja: string }[]; errores: { dia: string; franja: string; error: string }[]; mensaje?: string }
type Hueco = { dia: string; franja: string; semana: number | null }
type Tamano = { col: string; dia: string; diaKcal: string; card: string; label: string; nombre: string; macros: string; hueco: string; grid: string }

const DIAS_ORDEN = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const VISTAS = [{ semanas: 1, texto: '1 semana' }, { semanas: 2, texto: '2 semanas' }, { semanas: 4, texto: 'Mes' }]

// Menú «más»: agrupa las acciones secundarias para no llenar la cabecera de botones
type ItemMenu = { texto: string; icono?: React.ReactNode; onClick: () => void; disabled?: boolean }
function MenuMas({ items, extra, titulo = 'Más opciones' }: { items: ItemMenu[]; extra?: React.ReactNode; titulo?: string }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setAbierto(a => !a)} title={titulo} aria-haspopup="menu" aria-expanded={abierto} className="rounded-xl p-2" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <MoreHorizontal size={14} />
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-[65] min-w-[210px] rounded-xl p-1 shadow-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={() => setAbierto(false)}>
          {items.map(i => (
            <button key={i.texto} role="menuitem" disabled={i.disabled} onClick={i.onClick} className="w-full text-left rounded-lg px-2.5 py-2 text-[13px] flex items-center gap-2 disabled:opacity-50" style={{ color: 'var(--text)' }}>
              {i.icono}{i.texto}
            </button>
          ))}
          {extra}
        </div>
      )}
    </div>
  )
}

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

// Fecha de cada día de la semana en curso (semana 0) o de una planificada (+N)
function fechaDia(semana: number | null, i: number) {
  const hoy = new Date()
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7) + (semana ?? 0) * 7 + i)
  return d
}
const fmtCorta = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
function rangoSemana(semana: number | null) { return `${fmtCorta(fechaDia(semana, 0))} – ${fmtCorta(fechaDia(semana, 6))}` }

// Vista de pájaro: una tarjeta por día con kcal y macros, sin desplegar los platos, para comparar semanas
function SemanaResumen({ dias, kcalObjetivo, objetivos, semana, diaSel, onDia, repeticiones }: {
  repeticiones: Map<string, number>
  dias: Dia[]; kcalObjetivo: number | null; objetivos: Record<string, ObjetivoDia>; semana: number | null
  diaSel: { dia: string; semana: number | null } | null; onDia: (dia: string, semana: number | null) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
      {dias.map((d, i) => {
        const sel = diaSel?.dia === d.dia && diaSel.semana === semana
        const obj = objetivos[d.dia]?.kcal || kcalObjetivo
        const vacio = d.comidas.length === 0
        const color = vacio ? 'var(--text-muted)' : semana != null ? (obj && d.total.kcal > obj * 1.1 ? 'var(--error)' : 'var(--text-muted)') : colorDesvio(d.total.kcal, obj)
        const fecha = fechaDia(semana, i)
        return (
          <button key={d.dia} onClick={() => onDia(d.dia, semana)} aria-pressed={sel}
            title={objetivos[d.dia]?.label ?? 'Ver el detalle del día'}
            className="rounded-lg p-1.5 sm:p-2 text-left min-w-0"
            style={{ background: sel ? 'var(--surface)' : 'var(--bg)', border: `1px solid ${sel ? 'var(--primary)' : 'var(--border)'}` }}>
            <span className="block text-[12px] uppercase tracking-wide truncate" style={{ color: 'var(--text-muted)' }}>{d.dia.slice(0, 3)} {fecha.getDate()}</span>
            <span className="block text-sm font-data font-bold" style={{ color }}>{vacio ? '—' : `${semana != null ? '≈ ' : ''}${d.total.kcal}`}</span>
            {!vacio && <span className="block text-[12px] font-data truncate" style={{ color: 'var(--text-muted)' }}>P{d.total.p} C{d.total.c} G{d.total.g}</span>}
            {vacio ? <span className="block text-[12px]" style={{ color: 'var(--text-muted)' }}>sin platos</span> : (
              <span className="block mt-1 space-y-0.5">
                {d.comidas.map(c => {
                  const veces = c.receta ? repeticiones.get(c.receta.id) ?? 1 : 1
                  return (
                    <span key={c.id} className="block text-[13px] leading-snug line-clamp-2 break-words" title={`${c.nombre}: ${c.receta?.nombre ?? 'Sin receta'}${veces > 1 ? ` · se repite ${veces} veces` : ''}`}
                      style={{ color: veces > 1 ? 'var(--warning)' : 'var(--text)' }}>
                      {veces > 1 ? '↻ ' : ''}{c.receta?.nombre ?? 'Sin receta'}
                    </span>
                  )
                })}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

const contarPlatosPl = (semanas: SemanaPlantilla[]) => semanas.reduce((n, s) => n + s.dias.reduce((m, d) => m + d.comidas.length, 0), 0)
type Origen = { comida: Comida; dia: string; semana: number | null }
type Portapapeles = { nombre: string; items: { franja: string; receta_id: string }[] }
const idHueco = (semana: number | null, dia: string, franja: string) => `${semana ?? 0}|${dia}|${franja}`

// Cada hueco (vacío u ocupado) es un destino al que se puede soltar un plato
function HuecoSoltable({ id, className, style, children }: { id: string; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return <div ref={setNodeRef} className={className} style={{ ...style, outline: isOver ? '2px solid var(--primary)' : undefined }}>{children}</div>
}

// Tarjeta de plato: se arrastra (mover; con Alt, copiar) y a la vez es destino de otros platos
function PlatoArrastrable({ origen, id, className, style, children }: { origen: Origen; id: string; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const drop = useDroppable({ id })
  const drag = useDraggable({ id: `c:${origen.comida.id}`, data: origen, disabled: !origen.comida.receta })
  return (
    <div ref={n => { drop.setNodeRef(n); drag.setNodeRef(n) }} {...drag.listeners} className={className}
      style={{ ...style, opacity: drag.isDragging ? 0.35 : 1, cursor: origen.comida.receta ? 'grab' : undefined, outline: drop.isOver && !drag.isDragging ? '2px solid var(--primary)' : undefined }}>
      {children}
    </div>
  )
}

// Rejilla de 7 días: las franjas en su orden, con los huecos vacíos en su sitio
function SemanaGrid({ dias, franjas, T, kcalObjetivo, objetivos, semana, diaSel, onDia, onHueco, onQuitar, onGrabar, portapapeles, onCopiar, onCopiarDia, onPegar }: {
  dias: Dia[]; franjas: string[]; T: Tamano; kcalObjetivo: number | null; objetivos: Record<string, ObjetivoDia>; semana: number | null
  diaSel: { dia: string; semana: number | null } | null; onDia: (dia: string, semana: number | null) => void
  onHueco: (h: Hueco) => void; onQuitar: (c: Comida, semana: number | null) => void; onGrabar: (r: Receta) => void
  portapapeles: Portapapeles | null; onCopiar: (c: Comida) => void; onCopiarDia: (d: Dia) => void; onPegar: (dia: string, semana: number | null, franja?: string) => void
}) {
  const posicion = (f: string) => { const i = franjas.indexOf(f); return i === -1 ? franjas.length : i }
  return (
    <div className={`coach-week-grid flex gap-2 overflow-x-auto pb-2 scrollbar-none lg:grid lg:grid-cols-7 ${T.grid} lg:overflow-visible lg:pb-0`}>
      {dias.map(d => {
        const sel = diaSel?.dia === d.dia && diaSel.semana === semana
        const items: ({ tipo: 'comida'; c: Comida } | { tipo: 'hueco'; f: string })[] = [
          ...d.comidas.map(c => ({ tipo: 'comida' as const, c })),
          ...franjas.filter(f => !d.comidas.some(c => c.nombre === f)).map(f => ({ tipo: 'hueco' as const, f })),
        ].sort((a, b) => posicion(a.tipo === 'comida' ? a.c.nombre : a.f) - posicion(b.tipo === 'comida' ? b.c.nombre : b.f))
        return (
          <div key={d.dia} className={`coach-day-column min-w-[180px] w-[180px] flex-shrink-0 p-2 lg:min-w-0 lg:w-auto ${T.col}`} data-selected={sel}>
            <button className="coach-day-heading block w-full mb-2 text-left" title={objetivos[d.dia]?.consejo ?? 'Ver el detalle del día'} aria-pressed={sel} onClick={() => onDia(d.dia, semana)}>
              <span className="flex w-full items-baseline justify-between">
                <span className={`${T.dia} font-semibold`} style={{ color: 'var(--text)' }}>{d.dia}</span>
                {/* En las semanas planificadas la vista previa no lleva guarniciones ni complementos (se añaden al activar la semana):
                    por debajo del objetivo no es un fallo, solo se marca en rojo si ya se pasa */}
                <span className={`${T.diaKcal} font-data font-bold`}
                  title={semana != null ? 'Vista previa sin guarniciones ni complementos: se añaden al activar la semana' : undefined}
                  style={{ color: semana != null ? ((objetivos[d.dia]?.kcal || kcalObjetivo) && d.total.kcal > (objetivos[d.dia]?.kcal || kcalObjetivo || 0) * 1.1 ? 'var(--error)' : 'var(--text-muted)') : colorDesvio(d.total.kcal, objetivos[d.dia]?.kcal || kcalObjetivo) }}>{semana != null && d.total.kcal > 0 ? '≈ ' : ''}{d.total.kcal} kcal</span>
              </span>
              {objetivos[d.dia]?.label && (
                <span className="block text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {objetivos[d.dia].label!.replace('Día de ', '').replace('Día híbrido / HYROX', 'Híbrido')} · objetivo {objetivos[d.dia].kcal}
                </span>
              )}
            </button>
            <div className="coach-day-actions flex items-center justify-end gap-2 mb-1.5 -mt-1" style={{ color: 'var(--text-muted)' }}>
              {d.comidas.some(c => c.receta) && <button title="Copiar todos los platos del día" onClick={() => onCopiarDia(d)} className="flex items-center gap-0.5 text-[12px]"><Copy size={11} /> día</button>}
              {portapapeles && <button title="Pegar en este día (sustituye las franjas copiadas)" onClick={() => onPegar(d.dia, semana)} className="flex items-center gap-0.5 text-[12px]" style={{ color: 'var(--primary)' }}><ClipboardPaste size={11} /> pegar</button>}
            </div>
            <div className="space-y-1.5">
              {items.map(it => {
                if (it.tipo === 'hueco') return (
                  <HuecoSoltable key={it.f} id={idHueco(semana, d.dia, it.f)} className="flex gap-1">
                    <button onClick={() => onHueco({ dia: d.dia, franja: it.f, semana })}
                      className={`flex-1 rounded-lg ${T.hueco} flex items-center gap-1 justify-center`}
                      style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                      <Plus size={11} /> {it.f}
                    </button>
                    {portapapeles?.items.length === 1 && <button title="Pegar aquí" onClick={() => onPegar(d.dia, semana, it.f)} className="rounded-lg px-1.5" style={{ border: '1px dashed var(--primary)', color: 'var(--primary)' }}><ClipboardPaste size={12} /></button>}
                  </HuecoSoltable>
                )
                const c = it.c
                return (
                  <PlatoArrastrable key={c.id} id={idHueco(semana, d.dia, c.nombre)} origen={{ comida: c, dia: d.dia, semana }} className={`coach-meal-card ${T.card}`}>
                    <div className="flex items-center justify-between gap-1">
                      <button className={`${T.label} font-semibold uppercase tracking-wide text-left`} style={{ color: 'var(--text-muted)' }} onClick={() => onHueco({ dia: d.dia, franja: c.nombre, semana })}>
                        {c.nombre}{c.recurrente ? ' · diario' : ''}{objetivos[d.dia]?.momento?.pre === c.nombre ? ' · pre' : objetivos[d.dia]?.momento?.post === c.nombre ? ' · post' : ''}
                      </button>
                      <div className="flex items-center gap-1">
                        {c.receta && <button title="Copiar este plato" onClick={() => onCopiar(c)} style={{ color: 'var(--text-muted)' }}><Copy size={12} /></button>}
                        {portapapeles?.items.length === 1 && <button title="Pegar aquí (sustituye este plato)" onClick={() => onPegar(d.dia, semana, c.nombre)} style={{ color: 'var(--primary)' }}><ClipboardPaste size={12} /></button>}
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
                  </PlatoArrastrable>
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
  const [futuras, setFuturas] = useState<{ semana: number; dias: Dia[]; objetivos?: Record<string, ObjetivoDia> }[]>([])
  const [franjas, setFranjas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hueco, setHueco] = useState<Hueco | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [opciones, setOpciones] = useState<RecetaOpcion[]>([])
  const [buscando, setBuscando] = useState(false)
  const [filtrosOpcion, setFiltrosOpcion] = useState<FiltroOpcion[]>([])
  const [proteinasSel, setProteinasSel] = useState<string[]>([])
  const [familiaSel, setFamiliaSel] = useState<string | null>(null)
  const [variedad, setVariedad] = useState<Record<string, number>>({})
  const [avanzar, setAvanzar] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoSemana | null>(null)
  const [franjasGen, setFranjasGen] = useState<string[] | null>(null)
  const [ampliado, setAmpliado] = useState(false)
  const [vista, setVista] = useState(1)
  const [modo, setModo] = useState<'platos' | 'resumen'>('platos')
  const irAFuturas = useRef(false)
  const zonaFuturas = useRef<HTMLDivElement>(null)
  const [diaSel, setDiaSel] = useState<{ dia: string; semana: number | null } | null>(null)
  // En 2 semanas / mes el detalle del día va plegado para ver varias semanas a la vez; se despliega a petición
  const [ajustesGen, setAjustesGen] = useState(false)
  // Las semanas arrancan desplegadas; en 2 semanas / mes se pueden plegar una a una (solo queda su título)
  const [semanasPlegadas, setSemanasPlegadas] = useState<Record<string, boolean>>({})
  const semanaAbierta = (semana: number | null) => vista === 1 || !semanasPlegadas[String(semana ?? 0)]
  const alternarSemana = (semana: number | null) => setSemanasPlegadas(p => ({ ...p, [String(semana ?? 0)]: !p[String(semana ?? 0)] }))
  // Cada semana recuerda su propio día elegido y si su detalle está desplegado, así se pueden comparar varias a la vez
  const [detalles, setDetalles] = useState<Record<string, { dia: string; abierto: boolean }>>({})
  const seleccionarDia = (dia: string, semana: number | null) => {
    setDiaSel({ dia, semana })
    setDetalles(p => ({ ...p, [String(semana ?? 0)]: { dia, abierto: p[String(semana ?? 0)]?.dia === dia && p[String(semana ?? 0)]?.abierto } }))
  }
  // Día que muestra el detalle de una semana si aún no se ha elegido ninguno: hoy en la semana en curso, el lunes en las planificadas
  const diaDetalle = (semana: number | null) => detalles[String(semana ?? 0)]?.dia ?? (diaSel && diaSel.semana === semana ? diaSel.dia : semana == null ? DIAS_ORDEN[(new Date().getDay() + 6) % 7] : DIAS_ORDEN[0])
  const alternarDetalle = (semana: number | null, abierto: boolean) => setDetalles(p => ({ ...p, [String(semana ?? 0)]: { dia: diaDetalle(semana), abierto } }))
  const [version, setVersion] = useState(0)
  const [portapapeles, setPortapapeles] = useState<Portapapeles | null>(null)
  const [modalPlantilla, setModalPlantilla] = useState<'guardar' | 'lista' | null>(null)
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const altRef = useRef(false)
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  useEffect(() => {
    const alt = (e: KeyboardEvent | PointerEvent) => { altRef.current = e.altKey }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPortapapeles(null) }
    window.addEventListener('keydown', alt); window.addEventListener('keyup', alt); window.addEventListener('pointermove', alt); window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('keydown', alt); window.removeEventListener('keyup', alt); window.removeEventListener('pointermove', alt); window.removeEventListener('keydown', esc) }
  }, [])
  const [objetivosDia, setObjetivosDia] = useState<Record<string, ObjetivoDia>>({})
  const [comidasDia, setComidasDia] = useState<2 | 3 | 4 | 5 | null>(null)
  const [guardandoComidasDia, setGuardandoComidasDia] = useState(false)
  const { addToast } = useToast()

  // Selector de receta: propuestas con etiqueta (un toque) + lista filtrable
  const opcionesFiltradas = useMemo(() => opciones.filter(o =>
    (!filtrosOpcion.includes('rapidas') || (o.tiempo_prep_min != null && o.tiempo_prep_min <= 20)) &&
    (!filtrosOpcion.includes('proteicas') || (o.kcal > 0 && (o.proteinas * 4) / o.kcal >= 0.28)) &&
    (!filtrosOpcion.includes('favoritas') || o.favorita) &&
    (proteinasSel.length === 0 || proteinasSel.some(p => o.proteinas_principales?.includes(p))) &&
    (!familiaSel || o.familia === familiaSel)
  ), [opciones, filtrosOpcion, proteinasSel, familiaSel])
  // Botones de categoría: solo los que tienen recetas en esta franja, con su contador
  const chipsProteina = useMemo(() => PROTEINAS_PRINCIPALES.map(p => ({ id: p, texto: ETIQUETA_PROTEINA[p], n: opciones.filter(o => o.proteinas_principales?.includes(p)).length })).filter(c => c.n > 0), [opciones])
  const chipsFamilia = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of opciones) if (o.familia) m.set(o.familia, (m.get(o.familia) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n }))
  }, [opciones])
  const sugerencias = useMemo(() => {
    if (busqueda.trim()) return []
    const nuevas = opcionesFiltradas.filter(o => !o.usos)
    const elegidas: { etiqueta: string; receta: RecetaOpcion }[] = []
    const poner = (etiqueta: string, r?: RecetaOpcion) => { if (r && !elegidas.some(e => e.receta.id === r.id)) elegidas.push({ etiqueta, receta: r }) }
    const porEncaje = [...nuevas].sort((a, b) => (a.encaje ?? 9) - (b.encaje ?? 9))
    poner('Mejor encaje', porEncaje[0])
    poner('Favorita', porEncaje.find(o => o.favorita))
    poner('Rápida', porEncaje.find(o => o.tiempo_prep_min != null && o.tiempo_prep_min <= 20))
    poner('Variedad', porEncaje.find(o => !elegidas.some(e => e.receta.id === o.id) && (o.encaje ?? 9) <= (porEncaje[0]?.encaje ?? 0) + 0.15))
    return elegidas
  }, [opcionesFiltradas, busqueda])

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
    // Cada semana futura trae sus propios objetivos (tapering, víspera, carrera...): no los de la semana en curso
    const od = (diaSel.semana == null ? objetivosDia : futuras.find(f => f.semana === diaSel.semana)?.objetivos ?? objetivosDia)[diaSel.dia]
    onResumen(d ? { etiqueta: `${diaSel.dia}${diaSel.semana ? ` · semana +${diaSel.semana}` : ''}`, dia: d.total, media: media(dias), objetivo: od?.kcal ? { kcal: od.kcal, p: od.p, c: od.c, g: od.g } : null, tipoDia: od?.label ? `${od.label}${od.ajuste_kcal_pct ? ` ${od.ajuste_kcal_pct > 0 ? '+' : ''}${od.ajuste_kcal_pct}% kcal` : ''}` : null } : null)
  }, [diaSel, dias, futuras, objetivosDia, onResumen])
  useEffect(() => () => onResumen?.(null), [onResumen])

  const cargar = useCallback(async () => {
    setError(null)
    const res = await fetch(`/api/clientes/${clienteId}/semana-dieta`)
    const data = await res.json().catch(() => null)
    if (!res.ok) { setError(data?.error ?? 'No se pudo cargar la semana'); setLoading(false); return }
    setPlan(data.plan); setDias(data.dias ?? []); setFranjas(data.franjas ?? []); setObjetivosDia(data.objetivos_dia ?? {}); setComidasDia(data.comidas_dia ?? null); setLoading(false)
    setDiaSel(prev => prev ?? { dia: DIAS_ORDEN[(new Date().getDay() + 6) % 7], semana: null })
    setVersion(v => v + 1)
  }, [clienteId])

  const cargarFuturas = useCallback(async (v: number) => {
    if (v <= 1) { setFuturas([]); return }
    const res = await fetch(`/api/clientes/${clienteId}/semana-dieta/futuras?semanas=${v - 1}`)
    const data = await res.json().catch(() => null)
    if (!res.ok) { setError(data?.error ?? 'No se pudieron cargar las semanas planificadas'); return }
    setFuturas((data.semanas ?? []).map((s: { semana: number; dias: { dia: string; comidas: Omit<Comida, 'recurrente'>[]; total: Total }[]; objetivos?: Record<string, ObjetivoDia> }) => ({
      semana: s.semana,
      objetivos: s.objetivos,
      dias: s.dias.map(d => ({ ...d, comidas: d.comidas.map(c => ({ ...c, recurrente: false })) })),
    })))
    setVersion(v => v + 1)
  }, [clienteId])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { cargarFuturas(vista) }, [vista, cargarFuturas])
  // Al ampliar la vista, las semanas planificadas quedan por debajo de la semana en curso y su detalle: llevar la vista hasta ellas
  useEffect(() => {
    if (irAFuturas.current && futuras.length > 0) { irAFuturas.current = false; zonaFuturas.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  }, [futuras])

  useEffect(() => {
    if (!hueco) return
    setBuscando(true)
    const t = setTimeout(async () => {
      const res = await fetch(`/api/clientes/${clienteId}/semana-dieta?franja=${encodeURIComponent(hueco.franja)}&dia=${encodeURIComponent(hueco.dia)}&q=${encodeURIComponent(busqueda)}`)
      const data = await res.json().catch(() => null)
      setOpciones(data?.recetas ?? []); setVariedad(data?.variedad ?? {}); setBuscando(false)
    }, 250)
    return () => clearTimeout(t)
  }, [hueco, busqueda, clienteId])

  async function llamar(url: string, metodo: string, body?: unknown) {
    const res = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const data = await res.json().catch(() => null)
    if (!res.ok) { setError(data?.error ?? 'No se pudo completar la acción'); return null }
    return data
  }

  // Siguiente hueco vacío después del actual (día a día, franja a franja) de la misma semana; null si no queda ninguno
  function siguienteHueco(actual: Hueco): Hueco | null {
    const lista = actual.semana == null ? dias : futuras.find(f => f.semana === actual.semana)?.dias ?? []
    const huecos = lista.flatMap(d => seleccion.map(franja => ({ dia: d.dia, franja, vacio: !d.comidas.some(c => c.nombre === franja && c.receta) })))
    const idx = huecos.findIndex(h => h.dia === actual.dia && h.franja === actual.franja)
    const sig = huecos.slice(idx + 1).find(h => h.vacio)
    return sig ? { dia: sig.dia, franja: sig.franja, semana: actual.semana } : null
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
    const siguiente = avanzar ? siguienteHueco(hueco) : null
    setHueco(siguiente); setBusqueda(''); await Promise.all([cargar(), cargarFuturas(vista)])
  }

  async function quitar(c: Comida, semana: number | null, sinConfirmar = false) {
    if (!sinConfirmar && !confirm('¿Quitar esta comida de ese día?')) return
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
    if (accion === 'generar') setResultado({ ok: true, complementos: data.complementos, avisos: data.avisos ?? [], asignadas: data.asignadas, repetidas: data.repetidas, sinCubrir: data.sinCubrir ?? [], errores: [], mensaje: data.mensaje })
    if (accion === 'activar') setResultado({ ok: data.ok, avisos: data.avisos ?? [], asignadas: data.activadas, repetidas: 0, sinCubrir: [], errores: data.errores ?? [], mensaje: data.ok ? `Semana activada: ${data.activadas} comidas ya son la semana en curso del cliente.` : undefined })
    await Promise.all([cargar(), cargarFuturas(vista)])
  }

  async function reajustarAlEntreno() {
    if (!confirm('Se mantienen las recetas pero se recalculan las cantidades de cada día según su entrenamiento (y se rehacen guarniciones y postres). ¿Continuar?')) return
    setOcupado('reajustar'); setError(null); setResultado(null)
    const data = await llamar(`/api/clientes/${clienteId}/semana-dieta/reajustar`, 'POST')
    setOcupado(null)
    if (data) { setResultado({ ok: true, complementos: data.complementos, avisos: data.avisos ?? [], asignadas: data.reajustadas, repetidas: 0, sinCubrir: [], errores: [], mensaje: `Semana ajustada al entrenamiento: ${data.reajustadas} comidas recalculadas.` }); await Promise.all([cargar(), cargarFuturas(vista)]) }
  }

  async function alternarGrabar(receta: Receta) {
    const siguiente = receta.contenido_estado === 'para_grabar' ? 'grabada' : receta.contenido_estado === 'grabada' ? null : 'para_grabar'
    const res = await fetch(`/api/recetas/${receta.id}/contenido`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido_estado: siguiente }),
    })
    if (res.ok) await Promise.all([cargar(), cargarFuturas(vista)])
  }

  async function cambiarComidasDia(valor: string) {
    const siguiente = valor === '' ? null : Number(valor) as 2 | 3 | 4 | 5
    const anterior = comidasDia
    setComidasDia(siguiente)
    setGuardandoComidasDia(true)
    const res = await fetch(`/api/clientes/${clienteId}/comidas-dia`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comidas_dia: siguiente }),
    }).catch(() => null)
    setGuardandoComidasDia(false)
    if (!res?.ok) {
      setComidasDia(anterior)
      addToast({ type: 'error', title: 'No se pudo guardar las comidas al día', message: 'Se ha restaurado el valor anterior.' })
      return
    }
    addToast({ type: 'success', title: 'Comidas al día actualizadas' })
  }

  if (loading) return <div className="rounded-2xl h-40 animate-pulse" style={{ background: 'var(--surface)' }} />
  if (!plan) return null

  // Tamaños: normal (cabe la semana en un portátil) o ampliado (pantalla completa, letra y casillas grandes)
  const T: Tamano = ampliado
    ? { col: 'p-3', dia: 'text-lg', diaKcal: 'text-sm', card: 'p-3', label: 'text-xs', nombre: 'text-base leading-snug line-clamp-4', macros: 'text-xs', hueco: 'p-3 text-sm', grid: 'lg:gap-3' }
    : { col: 'lg:p-2', dia: 'text-sm', diaKcal: 'text-xs', card: 'p-2', label: 'text-[12px]', nombre: 'text-xs lg:text-[13px] leading-snug line-clamp-3', macros: 'text-[12px]', hueco: 'p-1.5 text-[13px]', grid: 'lg:gap-1.5' }
  // El detalle del día aparece justo debajo de la semana a la que pertenece el día seleccionado
  const detalle = (semana: number | null) => {
    if (!semanaAbierta(semana)) return null
    const sel = { dia: diaDetalle(semana), abierto: !!detalles[String(semana ?? 0)]?.abierto }
    const abierto = vista === 1 || sel.abierto
    return (
      <>
        {vista > 1 && (
          <div className="mt-2 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <span><b>{sel.dia}</b>{semana ? ` · semana +${semana}` : ' · semana en curso'}</span>
            <button className="rounded-lg px-2.5 py-1 text-xs font-medium" style={abierto ? { border: '1px solid var(--border)', color: 'var(--text)' } : { background: 'var(--primary)', color: 'var(--bg)' }} onClick={() => alternarDetalle(semana, !abierto)}>
              {abierto ? 'Plegar detalle' : 'Desplegar detalle'}
            </button>
          </div>
        )}
        {abierto && (
          <DetalleDiaDieta clienteId={clienteId} dia={sel.dia} semana={semana} version={version}
            objetivo={objetivosDia[sel.dia]?.kcal ? { kcal: objetivosDia[sel.dia].kcal, p: objetivosDia[sel.dia].p, c: objetivosDia[sel.dia].c, g: objetivosDia[sel.dia].g } : { kcal: plan.kcal_objetivo, p: plan.proteinas_objetivo, c: plan.carbohidratos_objetivo, g: plan.grasas_objetivo }}
            momento={objetivosDia[sel.dia]?.momento ?? null}
            onCambiar={franja => setHueco({ dia: sel.dia, franja, semana })}
            onQuitar={(id) => quitar({ id } as Comida, semana)}
            franjas={franjas} onCambioDatos={() => { void Promise.all([cargar(), cargarFuturas(vista)]) }} />
        )}
      </>
    )
  }
  const diaDe = (semana: number | null, dia: string) => (semana == null ? dias : futuras.find(f => f.semana === semana)?.dias)?.find(d => d.dia === dia)
  const recargar = () => Promise.all([cargar(), cargarFuturas(vista)])

  // Asigna recetas a franjas de un día (la semana en curso o una planificada); reutiliza las rutas de asignar
  async function colocar(items: { franja: string; receta_id: string }[], dia: string, semana: number | null) {
    const base = `/api/clientes/${clienteId}/semana-dieta`
    for (const it of items) {
      const data = semana
        ? await llamar(`${base}/futuras`, 'POST', { semana, dia, franja: it.franja, receta_id: it.receta_id })
        : await llamar(base, 'POST', { dia, franja: it.franja, receta_id: it.receta_id })
      if (!data) return false
    }
    return true
  }

  // Lo que se ve ahora (1, 2 o 4 semanas) convertido en plantilla: solo receta, día y franja
  const semanasVisibles: SemanaPlantilla[] = [dias, ...futuras.slice(0, Math.max(vista - 1, 0)).map(f => f.dias)].map(sem => ({
    dias: sem.map(d => ({ dia: d.dia, comidas: d.comidas.filter(c => c.receta).map(c => ({ franja: c.nombre, receta_id: c.receta!.id, nombre: c.receta!.nombre })) })),
  }))

  async function aplicarPlantilla(pl: PlantillaSemana, desde: 0 | 1) {
    setModalPlantilla(null); setOcupado('mover'); setError(null)
    const url = `/api/clientes/${clienteId}/semana-dieta/plantilla`
    // 1) qué platos no valen para este cliente (restricciones, recetas descartadas); 2) aplicar el resto
    const c = await llamar(url, 'POST', { plantilla_id: pl.id, desde, comprobar: true })
    if (!c) { setOcupado(null); return }
    const malos = [...c.incompatibles, ...c.noDisponibles] as { dia: string; franja: string; nombre: string; motivo: string }[]
    const aviso = malos.length > 0
      ? `\n\n${malos.length} plato${malos.length > 1 ? 's no se colocarán' : ' no se colocará'}:\n${malos.slice(0, 6).map(m => `· ${m.dia} ${m.franja}: ${m.nombre} (${m.motivo})`).join('\n')}${malos.length > 6 ? `\n· y ${malos.length - 6} más` : ''}`
      : ''
    const hasta = desde + pl.semanas.length - 1
    if (!confirm(`Aplicar «${pl.nombre}» (${c.validos} platos) a ${desde === 0 ? 'la semana en curso' : `la semana +${desde}`}${hasta > desde ? ` y siguientes hasta la +${hasta}` : ''}?\nSustituye los platos de las franjas que trae la plantilla; las cantidades se ajustan al objetivo de este cliente.${desde === 0 ? '\nLa semana en curso es la que ve el cliente.' : ''}${aviso}`)) { setOcupado(null); return }
    const r = await llamar(url, 'POST', { plantilla_id: pl.id, desde })
    setOcupado(null)
    if (r) {
      const saltados = r.incompatibles.length + r.noDisponibles.length
      if (r.fallos.length) setError(`Se aplicaron ${r.aplicados} de ${r.total} platos; ${r.fallos.length} fallaron (${r.fallos[0].motivo}).`)
      else setResultado({ ok: true, asignadas: r.aplicados, repetidas: 0, sinCubrir: [], errores: [], mensaje: `Plantilla aplicada: ${r.aplicados} platos${saltados ? `; ${saltados} omitidos por no ser compatibles o no estar disponibles` : ''}.${desde === 0 ? ' Pulsa «Ajustar al entreno» para adaptar las cantidades a sus días de entreno.' : ''}` })
    }
    await recargar()
  }

  function copiar(c: Comida) {
    if (c.receta) setPortapapeles({ nombre: c.receta.nombre, items: [{ franja: c.nombre, receta_id: c.receta.id }] })
  }
  function copiarDia(d: Dia) {
    const items = d.comidas.filter(c => c.receta).map(c => ({ franja: c.nombre, receta_id: c.receta!.id }))
    if (items.length) setPortapapeles({ nombre: `${d.dia} (${items.length} platos)`, items })
  }
  async function pegar(dia: string, semana: number | null, franja?: string) {
    if (!portapapeles) return
    const items = franja ? [{ franja, receta_id: portapapeles.items[0].receta_id }] : portapapeles.items
    const ocupados = items.filter(it => diaDe(semana, dia)?.comidas.some(c => c.nombre === it.franja && c.receta && c.receta.id !== it.receta_id))
    if (ocupados.length && !confirm(`${dia}: se sustituirán ${ocupados.length} plato${ocupados.length > 1 ? 's' : ''} (${ocupados.map(o => o.franja).join(', ')}). ¿Seguir?`)) return
    setOcupado('mover'); setError(null)
    await colocar(items, dia, semana)
    setOcupado(null); await recargar()
  }
  async function soltar(e: DragEndEvent) {
    setArrastrando(null)
    const o = e.active.data.current as Origen | undefined
    const over = e.over ? String(e.over.id) : null
    if (!o?.comida.receta || !over) return
    const [sem, dia, franja] = over.split('|')
    const semana = sem === '0' ? null : Number(sem)
    if (semana === o.semana && dia === o.dia && franja === o.comida.nombre) return
    const copia = altRef.current || o.comida.recurrente
    const destino = diaDe(semana, dia)?.comidas.find(c => c.nombre === franja)
    if (destino?.receta && destino.receta.id !== o.comida.receta.id && !confirm(`${franja} · ${dia}: ¿sustituir «${destino.receta.nombre}» por «${o.comida.receta.nombre}»?`)) return
    setOcupado('mover'); setError(null)
    const ok = await colocar([{ franja, receta_id: o.comida.receta.id }], dia, semana)
    if (ok && !copia) await quitar(o.comida, o.semana, true)
    setOcupado(null); await recargar()
  }
  const btnSec = 'rounded-lg px-2.5 py-1.5 text-[13px] font-medium flex items-center gap-1 disabled:opacity-50'
  const mediaActual = media(dias)
  // Cuántas veces aparece cada receta en las semanas visibles (para marcar repeticiones en el Resumen)
  const repeticiones = new Map<string, number>()
  for (const d of [...dias, ...futuras.flatMap(f => f.dias)]) for (const c of d.comidas) if (c.receta) repeticiones.set(c.receta.id, (repeticiones.get(c.receta.id) ?? 0) + 1)
  const platosRepetidos = [...repeticiones.values()].filter(n => n > 1).length

  return (
    <DndContext sensors={sensores} collisionDetection={pointerWithin} onDragStart={(e: DragStartEvent) => setArrastrando((e.active.data.current as Origen | undefined)?.comida.receta?.nombre ?? null)} onDragEnd={soltar} onDragCancel={() => setArrastrando(null)}>
    <section className={ampliado ? 'coach-diet-planner is-expanded fixed inset-0 z-[60] overflow-auto p-6' : 'coach-diet-planner p-4'} style={{ background: ampliado ? 'var(--bg)' : undefined, border: ampliado ? 'none' : undefined }}>
      <div className="coach-planner-header flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>Semana nutricional</p>
          <h3 className="coach-planner-title font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}><CalendarDays size={16} /> {plan.nombre}</h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {VISTAS.map(v => (
              <button key={v.semanas} onClick={() => { irAFuturas.current = v.semanas > vista; setVista(v.semanas); setModo('platos'); setSemanasPlegadas({}) }} className="px-2.5 py-2 text-xs font-medium"
                style={{ background: vista === v.semanas ? 'var(--primary)' : 'transparent', color: vista === v.semanas ? 'var(--bg)' : 'var(--text-muted)' }}>
                {v.texto}
              </button>
            ))}
          </div>
          <button onClick={() => setAmpliado(a => !a)} title={ampliado ? 'Volver al tamaño normal' : 'Ver en pantalla completa'}
            className="rounded-xl p-2" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {ampliado ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <MenuMas
            items={[
              { texto: 'Ajustes de generación', icono: <SlidersHorizontal size={13} />, onClick: () => setAjustesGen(a => !a) },
              { texto: 'Aplicar plantilla', icono: <ClipboardPaste size={13} />, onClick: () => setModalPlantilla('lista') },
              { texto: `Guardar ${vista === 1 ? 'esta semana' : vista === 2 ? 'estas 2 semanas' : 'estas 4 semanas'} como plantilla`, icono: <Copy size={13} />, onClick: () => setModalPlantilla('guardar'), disabled: contarPlatosPl(semanasVisibles) === 0 },
              ...(Object.values(objetivosDia).some(o => o.label) ? [{ texto: 'Ajustar al entreno', icono: <Activity size={13} />, onClick: () => { void reajustarAlEntreno() }, disabled: ocupado !== null }] : []),
            ]}
            extra={accionExtra ? <div className="mt-1 pt-1 px-1" style={{ borderTop: '1px solid var(--border)' }}>{accionExtra}</div> : undefined}
          />
          <button onClick={generarSemana} disabled={ocupado !== null} title={`Genera la semana en curso con: ${seleccion.join(', ')}`}
            className="rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
            style={{ background: 'var(--primary)', color: 'var(--bg)' }}>
            {ocupado === 'actual' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {ocupado === 'actual' ? 'Generando…' : vista > 1 ? 'Generar semana en curso' : 'Generar semana'}
          </button>
        </div>
      </div>

      {ajustesGen && (
      <div className="rounded-xl p-3 mb-3 space-y-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div className="flex flex-wrap items-center gap-1.5 ">
        <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Franjas a generar:</span>
        {franjas.map(f => {
          const activa = seleccion.includes(f)
          return (
            <button key={f} onClick={() => alternarFranja(f)} disabled={ocupado !== null}
              className="rounded-full px-2.5 py-1 text-[13px] font-medium"
              style={{ background: activa ? 'var(--primary)' : 'transparent', color: activa ? 'var(--bg)' : 'var(--text-muted)', border: `1px solid ${activa ? 'var(--primary)' : 'var(--border)'}` }}>
              {f}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl" >
        <label className="flex items-center gap-2 text-xs font-semibold flex-shrink-0" style={{ color: 'var(--text)' }} title="Si lo fijas, Generar semana usa estas franjas aunque el plan tenga comidas sueltas. 2 = Comida + Cena; 3 = Desayuno + Comida + Cena; 4 = añade Merienda; 5 = las cinco.">
          Comidas al día
          <select
            value={comidasDia ?? ''}
            disabled={guardandoComidasDia}
            onChange={e => { void cambiarComidasDia(e.target.value) }}
            className="rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-60"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            <option value="">Auto</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
          {guardandoComidasDia && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
        </label>
      </div>
      </div>
      )}

      {resultado && (
        <div className="rounded-xl p-2.5 mb-3 text-xs flex justify-between gap-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <span>
            {resultado.mensaje ?? `Semana generada: ${resultado.asignadas} comidas.`}
            {(resultado.complementos ?? 0) > 0 && ` Se añadieron ${resultado.complementos} guarniciones/postres para cerrar el hueco de kcal.`}
            {resultado.repetidas > 0 && ` ${resultado.repetidas} repetidas por falta de recetas en esa franja.`}
            {resultado.sinCubrir.length > 0 && ` Sin receta disponible: ${[...new Set(resultado.sinCubrir.map(h => h.franja))].join(', ')}.`}
            {resultado.errores.length > 0 && ` ${resultado.errores.length} no se pudieron asignar.`}
            {(resultado.avisos?.length ?? 0) > 0 && (
              <span className="block mt-1" style={{ color: 'var(--warning)' }}>
                Revisar a mano: {resultado.avisos!.map(a => `${a.dia} ${a.franja} (${a.motivo})`).join('; ')}.
              </span>
            )}
          </span>
          <button onClick={() => setResultado(null)}><X size={13} /></button>
        </div>
      )}

      {error && (
        <div className="rounded-xl p-2.5 mb-3 text-xs flex justify-between gap-2" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>
          <span>{error}</span><button onClick={() => setError(null)}><X size={13} /></button>
        </div>
      )}

      {vista > 1 && modo === 'resumen' && (
        <p className="text-[13px] mb-2" style={{ color: 'var(--text-muted)' }}>
          {platosRepetidos > 0 ? <><span style={{ color: 'var(--warning)' }}>↻</span> {platosRepetidos} {platosRepetidos === 1 ? 'receta se repite' : 'recetas se repiten'} en estas semanas (en ámbar). </> : 'Sin recetas repetidas en estas semanas. '}Pasa el ratón sobre un plato para ver la comida y las veces.
        </p>
      )}
      {modo === 'platos' && (
        portapapeles ? (
          <div className="rounded-xl p-2.5 mb-3 text-xs flex items-center justify-between gap-2" style={{ background: 'var(--bg)', border: '1px solid var(--primary)', color: 'var(--text)' }}>
            <span>Copiado: <b>{portapapeles.nombre}</b>. Pulsa «pegar» en un hueco o en un día (Esc para cancelar).</span>
            <button onClick={() => setPortapapeles(null)}><X size={13} /></button>
          </div>
        ) : (
          <p className="coach-planner-hint text-[12px] mb-2" style={{ color: 'var(--text-muted)' }}>Arrastra para mover · Alt para copiar · usa copiar y pegar para repetir.{ocupado === 'mover' ? ` Trabajando…` : ''}</p>
        )
      )}
      {vista > 1 && (
        <button onClick={() => alternarSemana(null)} aria-expanded={semanaAbierta(null)} className="w-full flex items-center gap-1.5 text-left text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>
          {semanaAbierta(null) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <span>Semana en curso · {rangoSemana(null)} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>· lo que ve el cliente{mediaActual ? ` · media ${mediaActual.kcal} kcal · P${mediaActual.p} C${mediaActual.c} G${mediaActual.g}` : ''}</span></span>
        </button>
      )}
      {semanaAbierta(null) && (vista > 1 && modo === 'resumen'
        ? <SemanaResumen dias={dias} kcalObjetivo={plan.kcal_objetivo} objetivos={objetivosDia} semana={null} diaSel={diaSel} onDia={seleccionarDia} repeticiones={repeticiones} />
        : <SemanaGrid dias={dias} franjas={franjas} T={T} kcalObjetivo={plan.kcal_objetivo} objetivos={objetivosDia} semana={null} diaSel={diaSel} onDia={seleccionarDia} onHueco={setHueco} onQuitar={quitar} onGrabar={alternarGrabar} portapapeles={portapapeles} onCopiar={copiar} onCopiarDia={copiarDia} onPegar={pegar} />)}
      {detalle(null)}

      <div ref={zonaFuturas} className="scroll-mt-4" />
      {futuras.map(s => {
        const m = media(s.dias)
        const vacia = !m
        return (
          <div key={s.semana} className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <button onClick={() => alternarSemana(s.semana)} aria-expanded={semanaAbierta(s.semana)} className="flex items-center gap-1.5 text-left text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {semanaAbierta(s.semana) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <span>Semana +{s.semana} · {rangoSemana(s.semana)} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>· planificada, el cliente no la ve{m ? ` · media estimada sin complementos ${m.kcal} kcal · P${m.p} C${m.c} G${m.g}` : ' · vacía'}</span></span>
              </button>
              <div className="flex items-center gap-1.5">
                {s.semana === 1 && !vacia && (
                  <button className={btnSec} style={{ background: 'var(--primary)', color: 'var(--bg)' }} disabled={ocupado !== null} onClick={() => accionFutura(s.semana, 'activar')}>
                    {ocupado === `activar-${s.semana}` ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Activar
                  </button>
                )}
                <MenuMas titulo={`Opciones de la semana +${s.semana}`} items={[
                  { texto: ocupado === `generar-${s.semana}` ? 'Generando…' : 'Generar con IA', icono: <Sparkles size={13} />, onClick: () => accionFutura(s.semana, 'generar'), disabled: ocupado !== null },
                  { texto: 'Copiar semana en curso', icono: <Copy size={13} />, onClick: () => accionFutura(s.semana, 'copiar'), disabled: ocupado !== null || !dias.some(d => d.comidas.some(c => c.receta)) },
                  ...(!vacia ? [{ texto: 'Vaciar semana', icono: <Trash2 size={13} />, onClick: () => accionFutura(s.semana, 'vaciar'), disabled: ocupado !== null }] : []),
                ]} />
              </div>
            </div>
            {semanaAbierta(s.semana) && (modo === 'resumen'
              ? <SemanaResumen dias={s.dias} kcalObjetivo={plan.kcal_objetivo} objetivos={s.objetivos ?? objetivosDia} semana={s.semana} diaSel={diaSel} onDia={seleccionarDia} repeticiones={repeticiones} />
              : <SemanaGrid dias={s.dias} franjas={franjas} T={T} kcalObjetivo={plan.kcal_objetivo} objetivos={s.objetivos ?? objetivosDia} semana={s.semana} diaSel={diaSel} onDia={seleccionarDia} onHueco={setHueco} onQuitar={quitar} onGrabar={alternarGrabar} portapapeles={portapapeles} onCopiar={copiar} onCopiarDia={copiarDia} onPegar={pegar} />)}
            {detalle(s.semana)}
          </div>
        )
      })}

      {hueco && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setHueco(null)}>
          <div className="w-full sm:max-w-3xl max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl p-4" style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold" style={{ color: 'var(--text)' }}>{hueco.franja} · {hueco.dia}{hueco.semana ? ` · semana +${hueco.semana}` : ''}</p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[12px] cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={avanzar} onChange={e => setAvanzar(e.target.checked)} /> Pasar al siguiente hueco vacío
                </label>
                <button onClick={() => setHueco(null)} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
              </div>
            </div>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input autoFocus autoComplete="off" value={busqueda} onChange={e => setBusqueda(e.target.value)} onKeyDown={e => {
                if (guardando) return
                if (e.key === 'Escape') setHueco(null)
                else if (e.key === 'Enter' && opcionesFiltradas[0]) asignar(opcionesFiltradas[0].id)
                // Con el buscador vacío, 1-4 eligen una propuesta
                else if (!busqueda && /^[1-4]$/.test(e.key) && sugerencias[Number(e.key) - 1]) { e.preventDefault(); asignar(sugerencias[Number(e.key) - 1].receta.id) }
              }} placeholder="Buscar receta…  (Enter: la primera · 1-4: propuestas)" className="input search-input w-full text-sm" style={{ paddingLeft: '2.25rem' }} />
            </div>
            {chipsProteina.length > 0 && (
              <div className="flex gap-1.5 mb-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-1" style={{ scrollbarWidth: 'none' }}>
                {chipsProteina.map(c => {
                  const activo = proteinasSel.includes(c.id)
                  return (
                    <button key={c.id} onClick={() => setProteinasSel(p => activo ? p.filter(x => x !== c.id) : [...p, c.id])}
                      className="text-[12px] px-2.5 py-1 rounded-md whitespace-nowrap shrink-0"
                      style={{ background: activo ? 'var(--primary)' : 'var(--bg)', color: activo ? 'var(--bg)' : 'var(--text)', border: '1px solid var(--border)' }}>{c.texto} <span style={{ opacity: 0.6 }}>{c.n}</span></button>
                  )
                })}
              </div>
            )}
            {chipsFamilia.length > 1 && (
              <div className="flex gap-1.5 mb-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-1" style={{ scrollbarWidth: 'none' }}>
                {chipsFamilia.map(c => {
                  const activo = familiaSel === c.id
                  return (
                    <button key={c.id} onClick={() => setFamiliaSel(activo ? null : c.id)}
                      className="text-[12px] px-2.5 py-1 rounded-md whitespace-nowrap shrink-0"
                      style={{ background: activo ? 'var(--primary)' : 'transparent', color: activo ? 'var(--bg)' : 'var(--text-muted)', border: '1px dashed var(--border)' }}>{c.id} <span style={{ opacity: 0.6 }}>{c.n}</span></button>
                  )
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {FILTROS_OPCION.map(f => {
                const activo = filtrosOpcion.includes(f.id)
                return (
                  <button key={f.id} onClick={() => setFiltrosOpcion(p => activo ? p.filter(x => x !== f.id) : [...p, f.id])}
                    className="text-[12px] px-2.5 py-1 rounded-md"
                    style={{ background: activo ? 'var(--primary)' : 'var(--bg)', color: activo ? 'var(--bg)' : 'var(--text-muted)', border: '1px solid var(--border)' }}>{f.texto}</button>
                )
              })}
            </div>
            {(proteinasSel.length > 0 || familiaSel || filtrosOpcion.length > 0) && (
              <button onClick={() => { setProteinasSel([]); setFamiliaSel(null); setFiltrosOpcion([]) }} className="text-[12px] mb-1.5 underline self-start" style={{ color: 'var(--text-muted)' }}>Limpiar filtros</button>
            )}
            {Object.keys(variedad).length > 0 && (
              <p className="text-[12px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                En el plan: {PROTEINAS_PRINCIPALES.filter(p => chipsProteina.some(c => c.id === p)).map(p => `${ETIQUETA_PROTEINA[p]} ×${variedad[p] ?? 0}`).join(' · ')}
              </p>
            )}
            <div className="overflow-y-auto space-y-1.5 flex-1">
              {buscando ? <div className="py-6 flex justify-center"><Loader2 size={18} className="animate-spin" /></div> : <>
                {sugerencias.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[12px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Propuestas</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {sugerencias.map(({ etiqueta, receta }, n) => (
                        <button key={receta.id} disabled={guardando} onClick={() => asignar(receta.id)}
                          className="text-left rounded-xl overflow-hidden disabled:opacity-50" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          {receta.imagen_url && <Image loader={cloudinaryLoader} src={receta.imagen_url} alt="" width={384} height={240} className="w-full aspect-[16/10] object-cover" />}
                          <div className="p-2">
                            <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--accent, var(--primary))' }}><span style={{ opacity: 0.6 }}>{n + 1} · </span>{etiqueta}</p>
                            <p className="text-[13px] font-medium leading-tight line-clamp-2" style={{ color: 'var(--text)' }}>{receta.nombre}</p>
                            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{Math.round(receta.kcal_hueco ?? receta.kcal)} kcal · P {Math.round(receta.proteinas_hueco ?? receta.proteinas)} g</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-[12px] uppercase tracking-wide mt-3" style={{ color: 'var(--text-muted)' }}>Todas</p>
                  </div>
                )}
                <p className="text-[13px] mb-1" style={{ color: 'var(--text-muted)' }}>Ordenadas por encaje con los macros del hueco. Kcal y proteína ya ajustadas a este hueco.</p>
                {opcionesFiltradas.length === 0 ? <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Sin recetas para esta franja</p> :
                opcionesFiltradas.map(o => (
                  <button key={o.id} disabled={guardando} onClick={() => asignar(o.id)}
                    className="w-full text-left rounded-xl p-2 flex items-center gap-3 disabled:opacity-50"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    {o.imagen_url ? <Image loader={cloudinaryLoader} src={o.imagen_url} alt="" width={96} height={96} className="w-12 h-12 rounded-lg object-cover shrink-0" /> : <div className="w-12 h-12 rounded-lg shrink-0" style={{ background: 'var(--surface)' }} />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                        {o.verificacion && <BadgeCheck size={13} style={{ color: 'var(--success)' }} />}
                        {o.contenido_estado && <Video size={12} style={{ color: o.contenido_estado === 'grabada' ? 'var(--success)' : 'var(--warning)' }} />}
                        {o.nombre}
                      </p>
                      <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                        {Math.round(o.kcal_hueco ?? o.kcal)} kcal · P {Math.round(o.proteinas_hueco ?? o.proteinas)} g{o.tiempo_prep_min ? ` · ${o.tiempo_prep_min} min` : ''}
                        {o.favorita ? ' · ♥ favorita' : ''}
                      </p>
                      {!!o.usos && <p className="text-[12px]" style={{ color: 'var(--warning)' }}>Ya en el plan {o.usos === 1 ? '1 vez' : `${o.usos} veces`}</p>}
                    </div>
                    {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} style={{ color: 'var(--text-muted)' }} />}
                  </button>
                ))}
              </>}
            </div>
          </div>
        </div>
      )}
      {modalPlantilla === 'guardar' && <GuardarPlantillaModal semanas={semanasVisibles} onClose={() => setModalPlantilla(null)} onGuardada={() => { setModalPlantilla(null); setResultado({ ok: true, asignadas: 0, repetidas: 0, sinCubrir: [], errores: [], mensaje: 'Plantilla guardada.' }) }} />}
      {modalPlantilla === 'lista' && <ListaPlantillasModal onClose={() => setModalPlantilla(null)} onAplicar={aplicarPlantilla} />}
      <DragOverlay dropAnimation={null}>
        {arrastrando && <div className="rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-lg max-w-[220px]" style={{ background: 'var(--surface)', border: '1px solid var(--primary)', color: 'var(--text)' }}>{arrastrando}</div>}
      </DragOverlay>
    </section>
    </DndContext>
  )
}
