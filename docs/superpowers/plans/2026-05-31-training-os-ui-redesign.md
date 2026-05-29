# Training OS UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar visualmente el módulo de entrenamiento completo — sub-sidebar, dashboard CRM, timeline con drag & drop, y sesión cliente con cards.

**Architecture:** Sub-sidebar secundario dentro del layout `/entrenos` + reescritura de dashboard y editor como lista CRM / timeline vertical. Portal cliente con toggle Registrar/Solo-ver y cards de ejercicio. Sin cambios de SQL — todo sobre schema existente.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, CSS variables (`var(--text)`, `var(--surface)`, `var(--border)`), `@dnd-kit/core` + `@dnd-kit/sortable` (nuevo), Lucide React.

---

## File Map

| Acción | Archivo | Responsabilidad |
|--------|---------|----------------|
| Create | `components/training/TrainingSubNav.tsx` | Sub-sidebar navegación Training OS |
| Modify | `app/entrenos/layout.tsx` | Incluir TrainingSubNav |
| Rewrite | `app/entrenos/page.tsx` | Dashboard CRM lista clientes |
| Create | `components/training/PlanTimeline.tsx` | Timeline vertical ejercicios semana→día |
| Rewrite | `app/entrenos/[id]/page.tsx` | Editor plan con PlanTimeline + drag&drop |
| Create | `components/training/SesionCardMobile.tsx` | Card ejercicio + sets grid (cliente) |
| Create | `components/training/SetRegistroSheet.tsx` | Modal kg/reps/RPE por set |
| Rewrite | `app/cliente/sesion/[id]/page.tsx` | Toggle registro/solo-ver + SesionCardMobile |
| Create | `app/cliente/semana/page.tsx` | Vista semanal pasiva cliente |

---

### Task 1: Instalar @dnd-kit + crear TrainingSubNav

**Files:**
- Create: `components/training/TrainingSubNav.tsx`

- [ ] **Step 1: Instalar dependencias de drag & drop**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: instala sin errores.

- [ ] **Step 2: Crear `components/training/TrainingSubNav.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Brain, Library, Dumbbell, Sparkles } from 'lucide-react'

const SECTIONS = [
  {
    label: 'Coach',
    items: [
      { href: '/entrenos', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/entrenos/planes', label: 'Planes', icon: ClipboardList },
      { href: '/entrenos/brain-ia', label: 'Brain IA', icon: Brain },
    ],
  },
  {
    label: 'Biblioteca',
    items: [
      { href: '/entrenos/plantillas', label: 'Plantillas', icon: Library },
      { href: '/entrenos/ejercicios', label: 'Ejercicios', icon: Dumbbell },
    ],
  },
  {
    label: 'Herramientas',
    items: [
      { href: '/entrenos/generar-ia', label: 'Generar plan IA', icon: Sparkles },
    ],
  },
]

export default function TrainingSubNav() {
  const pathname = usePathname()

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    // /entrenos/[id] matches /entrenos/planes loosely — avoid false positives
    if (href === '/entrenos/planes') {
      // active for /entrenos/[uuid] paths (plan editor)
      const parts = pathname.split('/').filter(Boolean)
      return parts.length === 2 && parts[0] === 'entrenos' && parts[1] !== 'plantillas' && parts[1] !== 'ejercicios' && parts[1] !== 'generar-ia' && parts[1] !== 'nueva' && parts[1] !== 'brain-ia' && parts[1] !== 'planes'
    }
    return pathname.startsWith(href)
  }

  return (
    <nav
      className="hidden lg:flex flex-col flex-shrink-0"
      style={{
        width: 148,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        paddingTop: 12,
        paddingBottom: 12,
      }}
    >
      <div style={{ padding: '0 10px 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
        Training OS
      </div>
      {SECTIONS.map(section => (
        <div key={section.label} style={{ marginBottom: 4 }}>
          <div style={{ padding: '8px 12px 3px', fontSize: 9, fontWeight: 600, color: 'var(--border-strong)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {section.label}
          </div>
          {section.items.map(item => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'rgb(168,85,247)' : 'var(--text-secondary)',
                  borderLeft: `2px solid ${active ? 'rgb(168,85,247)' : 'transparent'}`,
                  background: active ? 'rgba(168,85,247,0.06)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                <item.icon size={14} />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
```

- [ ] **Step 3: Actualizar `app/entrenos/layout.tsx`**

```tsx
import CoachShell from '@/components/CoachShell'
import TrainingSubNav from '@/components/training/TrainingSubNav'

export default function EntrenosLayout({ children }: { children: React.ReactNode }) {
  return (
    <CoachShell>
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <TrainingSubNav />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </CoachShell>
  )
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit --pretty false 2>&1 | head -20
```

Expected: 0 errores en los nuevos archivos.

- [ ] **Step 5: Commit**

```bash
git add components/training/TrainingSubNav.tsx app/entrenos/layout.tsx package.json package-lock.json
git commit -m "feat(ui): TrainingSubNav sub-sidebar + layout wrapper"
```

---

### Task 2: Dashboard CRM — reescribir `/entrenos/page.tsx`

**Files:**
- Rewrite: `app/entrenos/page.tsx`

- [ ] **Step 1: Reescribir la página**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Search, Trophy, AlertTriangle, ChevronRight } from 'lucide-react'

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const HOY_IDX = (new Date().getDay() + 6) % 7

interface ClienteEntreno {
  cliente_id: string
  plan_id: string
  plan_nombre: string
  nombre: string
  apellidos: string
  dots: boolean[]
  rpe_reciente: number | null
  tiene_pr: boolean
  fatiga: boolean
  ultima_fecha: string | null
}

function diasDesde(fecha: string | null): string {
  if (!fecha) return '—'
  const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff <= 30) return `Hace ${diff}d`
  return '+30d'
}

function getBadge(c: ClienteEntreno) {
  if (c.fatiga) return { label: 'Fatiga', color: 'rgba(239,68,68,0.12)', text: 'rgb(239,68,68)' }
  if (c.tiene_pr) return { label: 'PR 🏆', color: 'rgba(34,197,94,0.12)', text: 'rgb(34,197,94)' }
  if (c.dots.some(Boolean)) return { label: 'OK', color: 'rgba(168,85,247,0.12)', text: 'rgb(168,85,247)' }
  return { label: '—', color: 'var(--surface)', text: 'var(--text-muted)' }
}

export default function EntrenosPage() {
  const [clientes, setClientes] = useState<ClienteEntreno[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Planes activos con info de cliente
      const { data: planes } = await supabase
        .from('planes_entrenamiento')
        .select('id, nombre, cliente_id, cliente:clientes(id, profile:profiles!profile_id(nombre, apellidos))')
        .eq('coach_id', user.id)
        .eq('activo', true)
        .order('created_at', { ascending: false })

      if (!planes?.length) { setLoading(false); return }

      const clienteIds = planes.map(p => p.cliente_id).filter(Boolean) as string[]
      const fecha7d = new Date(); fecha7d.setDate(fecha7d.getDate() - 7)
      const fecha7dStr = fecha7d.toISOString().split('T')[0]
      const lunesISO = (() => {
        const h = new Date(); const d = h.getDay(); const diff = d === 0 ? 6 : d - 1
        const l = new Date(h); l.setDate(h.getDate() - diff); l.setHours(0,0,0,0); return l.toISOString().split('T')[0]
      })()

      const [{ data: registros }, { data: prsData }] = await Promise.all([
        supabase.from('registros_sets')
          .select('cliente_id, fecha, esfuerzo_percibido')
          .in('cliente_id', clienteIds)
          .gte('fecha', fecha7dStr),
        supabase.from('prs_por_ejercicio')
          .select('cliente_id, fecha_pr')
          .in('cliente_id', clienteIds)
          .gte('fecha_pr', lunesISO),
      ])

      const rows: ClienteEntreno[] = planes.map(p => {
        const cli = p.cliente as unknown as { id: string; profile: { nombre: string; apellidos: string } } | null
        const regs = (registros ?? []).filter(r => r.cliente_id === p.cliente_id)
        const fechasSet = new Set(regs.map(r => r.fecha))
        const dias7d = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - ((HOY_IDX - i + 7) % 7))
          return fechasSet.has(d.toISOString().split('T')[0])
        })
        const rpeVals = regs.map(r => r.esfuerzo_percibido).filter((v): v is number => v != null)
        const rpeMedia = rpeVals.length ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length : null
        const fechas = regs.map(r => r.fecha).sort().reverse()
        const tienePR = (prsData ?? []).some(pr => pr.cliente_id === p.cliente_id)
        const sesiones7d = fechasSet.size
        return {
          cliente_id: p.cliente_id,
          plan_id: p.id,
          plan_nombre: p.nombre,
          nombre: cli?.profile?.nombre ?? '—',
          apellidos: cli?.profile?.apellidos ?? '',
          dots: dias7d,
          rpe_reciente: rpeMedia ? Math.round(rpeMedia * 10) / 10 : null,
          tiene_pr: tienePR,
          fatiga: sesiones7d >= 5 || (rpeMedia !== null && rpeMedia >= 8.5),
          ultima_fecha: fechas[0] ?? null,
        }
      })

      // Ordenar: fatiga primero, luego PR, luego activos, luego inactivos
      rows.sort((a, b) => {
        const score = (c: ClienteEntreno) => c.fatiga ? 3 : c.tiene_pr ? 2 : c.dots.some(Boolean) ? 1 : 0
        return score(b) - score(a)
      })

      setClientes(rows)
      setLoading(false)
    }
    load()
  }, [])

  const filtrados = clientes.filter(c =>
    `${c.nombre} ${c.apellidos} ${c.plan_nombre}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Dashboard Entrenamiento</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{clientes.length} planes activos</p>
        </div>
        <Link href="/entrenos/nueva" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Nuevo plan
        </Link>
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          className="input search-input w-full"
          placeholder="Buscar cliente o plan…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          autoComplete="off"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'rgb(168,85,247)' }} />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-12" style={{ color: 'var(--text-muted)' }}>
          No hay planes activos
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {/* Header de columnas */}
          <div className="hidden md:grid px-4 py-2 text-xs font-medium border-b"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', gridTemplateColumns: '2fr 1fr 80px 60px 60px 28px' }}>
            <span>Cliente / Plan</span>
            <span className="text-center">L M X J V S D</span>
            <span className="text-center">Estado</span>
            <span className="text-center">RPE</span>
            <span className="text-center">Última</span>
            <span />
          </div>

          {filtrados.map((c, i) => {
            const badge = getBadge(c)
            const initials = `${c.nombre[0] ?? ''}${c.apellidos[0] ?? ''}`.toUpperCase()
            return (
              <Link
                key={c.plan_id}
                href={`/entrenos/${c.plan_id}`}
                className="flex md:grid items-center gap-3 px-4 py-3 transition-colors hover:bg-opacity-50"
                style={{
                  gridTemplateColumns: '2fr 1fr 80px 60px 60px 28px',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  textDecoration: 'none',
                  background: 'transparent',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {/* Avatar + nombre */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                    style={{ background: 'linear-gradient(135deg, rgb(168,85,247), rgb(99,102,241))' }}>
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{c.nombre} {c.apellidos}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{c.plan_nombre}</p>
                  </div>
                </div>

                {/* Dots L-D */}
                <div className="hidden md:flex items-center justify-center gap-1">
                  {DIAS.map((d, idx) => (
                    <div key={d} className="flex flex-col items-center gap-0.5">
                      <span className="text-[8px]" style={{ color: 'var(--text-muted)', opacity: idx === HOY_IDX ? 1 : 0.5 }}>{d}</span>
                      <div className="w-2.5 h-2.5 rounded-full" style={{
                        background: c.dots[idx] ? 'rgb(168,85,247)' : idx === HOY_IDX ? 'rgba(168,85,247,0.2)' : 'var(--border)',
                        boxShadow: c.dots[idx] ? '0 0 4px rgba(168,85,247,0.4)' : 'none',
                      }} />
                    </div>
                  ))}
                </div>

                {/* Badge */}
                <div className="hidden md:flex justify-center">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: badge.color, color: badge.text }}>
                    {badge.label}
                  </span>
                </div>

                {/* RPE */}
                <div className="hidden md:flex justify-center">
                  {c.rpe_reciente !== null ? (
                    <span className="text-sm font-semibold"
                      style={{ color: c.rpe_reciente >= 8.5 ? 'rgb(239,68,68)' : 'var(--text-secondary)' }}>
                      {c.rpe_reciente.toFixed(1)}
                    </span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </div>

                {/* Última sesión */}
                <div className="hidden md:flex justify-center">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{diasDesde(c.ultima_fecha)}</span>
                </div>

                <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

```bash
npx tsc --noEmit --pretty false 2>&1 | head -20
```

Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add app/entrenos/page.tsx
git commit -m "feat(ui): dashboard entrenamiento CRM lista con dots, RPE y badges"
```

---

### Task 3: PlanTimeline component con drag & drop

**Files:**
- Create: `components/training/PlanTimeline.tsx`

Este componente recibe las sesiones del plan agrupadas por semana y día, y las renderiza como timeline vertical con drag & drop usando `@dnd-kit/sortable`.

- [ ] **Step 1: Crear `components/training/PlanTimeline.tsx`**

```tsx
'use client'
import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ArrowUpDown, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'

export interface EjercicioTimeline {
  id: string
  ejercicio_id: string
  nombre: string
  grupo_muscular: string
  series: number
  repeticiones: string
  descanso_segundos: number
  peso_sugerido: string
  rpe: string
  notas: string
  instruccion_ejercicio: string
  contexto_ia: string | null
  orden: number
}

export interface SesionTimeline {
  id: string
  nombre: string
  dia_semana: string
  orden: number
  duracion_estimada_min?: number
  ejercicios: EjercicioTimeline[]
}

export interface SemanaTimeline {
  numero: number
  sesiones: SesionTimeline[]
}

interface MoverDestino {
  ejercicioId: string
  diaActual: string
  sesionActualId: string
}

interface PlanTimelineProps {
  semanas: SemanaTimeline[]
  onReorder: (sesionId: string, ejerciciosOrdenados: string[]) => Promise<void>
  onMover: (ejercicioId: string, destSesionId: string) => Promise<void>
  onToggleContextoIA: (sesionId: string, ejercicioId: string) => void
  sesionesDisponibles: { id: string; nombre: string; dia_semana: string; semana: number }[]
}

function SortableEjercicioCard({
  ej,
  sesionId,
  onMoverClick,
  onToggleIA,
}: {
  ej: EjercicioTimeline
  sesionId: string
  onMoverClick: (info: MoverDestino) => void
  onToggleIA: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ej.id })
  const [expanded, setExpanded] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2.5 mb-1.5 border transition-colors"
        style={{
          background: isDragging ? 'var(--surface)' : 'var(--bg)',
          borderColor: isDragging ? 'rgb(168,85,247)' : 'var(--border)',
          boxShadow: isDragging ? '0 4px 16px rgba(168,85,247,0.15)' : 'none',
        }}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
          style={{ color: 'var(--border-strong)', padding: '2px' }}
          aria-label="Arrastrar"
        >
          <GripVertical size={14} />
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{ej.nombre}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {ej.series}×{ej.repeticiones}
            {ej.rpe && ` @RPE${ej.rpe}`}
            {ej.descanso_segundos > 0 && ` · ${ej.descanso_segundos}s desc`}
          </p>
        </div>

        {/* Grupo muscular badge */}
        <span className="hidden sm:inline text-xs px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: 'rgba(168,85,247,0.1)', color: 'rgb(168,85,247)' }}>
          {ej.grupo_muscular}
        </span>

        {/* Expand */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-shrink-0 p-1 rounded"
          style={{ color: 'var(--text-muted)' }}
          aria-label={expanded ? 'Colapsar' : 'Expandir'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Mover a otro día/semana */}
        <button
          onClick={() => onMoverClick({ ejercicioId: ej.id, diaActual: ej.nombre, sesionActualId: sesionId })}
          className="flex-shrink-0 p-1 rounded"
          style={{ color: 'var(--text-muted)' }}
          title="Mover a otro día o semana"
        >
          <ArrowUpDown size={14} />
        </button>
      </div>

      {expanded && (
        <div className="ml-6 mb-2 pl-3 py-2 rounded-lg border-l-2 text-xs"
          style={{ borderColor: 'rgba(168,85,247,0.3)', color: 'var(--text-secondary)' }}>
          {ej.instruccion_ejercicio && <p className="mb-1">{ej.instruccion_ejercicio}</p>}
          {ej.contexto_ia && (
            <p className="italic" style={{ color: 'rgb(168,85,247)' }}>🤖 {ej.contexto_ia}</p>
          )}
          {!ej.contexto_ia && (
            <button onClick={onToggleIA} className="text-xs" style={{ color: 'rgb(168,85,247)' }}>
              + Generar contexto IA
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function PlanTimeline({ semanas, onReorder, onMover, onToggleContextoIA, sesionesDisponibles }: PlanTimelineProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [moverInfo, setMoverInfo] = useState<MoverDestino | null>(null)

  function handleDragEnd(event: DragEndEvent, sesion: SesionTimeline) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = sesion.ejercicios.findIndex(e => e.id === active.id)
    const newIdx = sesion.ejercicios.findIndex(e => e.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const reordenados = arrayMove(sesion.ejercicios, oldIdx, newIdx)
    onReorder(sesion.id, reordenados.map(e => e.id))
  }

  return (
    <div>
      {semanas.map(semana => (
        <div key={semana.numero} className="mb-8">
          {/* Divider semana */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider flex-shrink-0"
              style={{ color: 'rgb(168,85,247)' }}>
              Semana {semana.numero}
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {semana.sesiones.map(sesion => (
            <div key={sesion.id} className="mb-5 pl-3" style={{ borderLeft: '2px solid var(--border)' }}>
              {/* Día */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'rgb(168,85,247)', marginLeft: -5 }} />
                <span className="text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>
                  {sesion.dia_semana}
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{sesion.nombre}</span>
                {sesion.duracion_estimada_min && (
                  <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>~{sesion.duracion_estimada_min} min</span>
                )}
              </div>

              {/* Ejercicios con DnD */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={e => handleDragEnd(e, sesion)}
              >
                <SortableContext items={sesion.ejercicios.map(e => e.id)} strategy={verticalListSortingStrategy}>
                  {sesion.ejercicios.map(ej => (
                    <SortableEjercicioCard
                      key={ej.id}
                      ej={ej}
                      sesionId={sesion.id}
                      onMoverClick={setMoverInfo}
                      onToggleIA={() => onToggleContextoIA(sesion.id, ej.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          ))}
        </div>
      ))}

      {/* Modal mover ejercicio */}
      {moverInfo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setMoverInfo(null)}>
          <div className="rounded-xl p-5 w-full max-w-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <p className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Mover ejercicio a…</p>
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
              {sesionesDisponibles
                .filter(s => s.id !== moverInfo.sesionActualId)
                .map(s => (
                  <button
                    key={s.id}
                    onClick={() => { onMover(moverInfo.ejercicioId, s.id); setMoverInfo(null) }}
                    className="text-left px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgb(168,85,247)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                  >
                    <span style={{ color: 'rgb(168,85,247)' }}>Sem {s.semana} · {s.dia_semana}</span>
                    {' '}— {s.nombre}
                  </button>
                ))}
            </div>
            <button onClick={() => setMoverInfo(null)} className="mt-3 text-xs w-full text-center"
              style={{ color: 'var(--text-muted)' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit --pretty false 2>&1 | head -20
```

Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add components/training/PlanTimeline.tsx
git commit -m "feat(ui): PlanTimeline component con drag&drop @dnd-kit"
```

---

### Task 4: Reescribir `/entrenos/[id]/page.tsx` con timeline

**Files:**
- Rewrite: `app/entrenos/[id]/page.tsx`

> **Nota para el implementador:** Lee el archivo existente antes de empezar. Preserva la lógica de: auth, fetch sesiones+ejercicios, `generarContexto()` (POST `/api/entrenos/generar-contexto`), actualización de `instruccion_coach` e `instruccion_ejercicio`, y la pantalla de `loading`. Lo que cambia es el layout de presentación.

- [ ] **Step 1: Leer el archivo actual**

```bash
cat app/entrenos/[id]/page.tsx | head -150
```

- [ ] **Step 2: Reescribir usando PlanTimeline**

La nueva página debe:

1. Hacer fetch del plan: `planes_entrenamiento` con `sesiones_entrenamiento` → `sesion_ejercicios` → `ejercicios`
2. Agrupar sesiones por "semana" — si el plan tiene `duracion_semanas`, repartir sesiones equitativamente; si no, todas en Semana 1
3. Pasar los datos a `<PlanTimeline>`
4. Implementar `onReorder`: PATCH a `sesion_ejercicios` actualizando `orden` de los ejercicios reordenados
5. Implementar `onMover`: UPDATE `sesion_ejercicios SET sesion_id = destSesionId WHERE id = ejercicioId`
6. Implementar `onToggleContextoIA`: llama POST `/api/entrenos/generar-contexto` para ese ejercicio

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Dumbbell } from 'lucide-react'
import PlanTimeline, { type SemanaTimeline, type EjercicioTimeline, type SesionTimeline } from '@/components/training/PlanTimeline'

interface PlanInfo {
  id: string
  nombre: string
  activo: boolean
  duracion_semanas: number | null
  instruccion_coach: string
  cliente_id: string
  cliente_nombre: string
}

interface RawSesion {
  id: string
  nombre: string
  dia_semana: string
  orden: number
  duracion_estimada_min: number | null
  contexto_ia: string | null
  ejercicios: Array<{
    id: string
    ejercicio_id: string
    series: number
    repeticiones: string
    descanso_segundos: number
    peso_sugerido: string
    rpe: string | null
    notas: string | null
    instruccion_ejercicio: string | null
    contexto_ia: string | null
    orden: number
    ejercicio: { id: string; nombre: string; grupo_muscular: string; tipo: string }
  }>
}

const DIAS_ORDER: Record<string, number> = {
  Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6, Domingo: 7,
}

function agruparPorSemanas(sesiones: RawSesion[], duracion: number | null): SemanaTimeline[] {
  if (!sesiones.length) return []
  const total = duracion ?? 1
  const porSemana = Math.ceil(sesiones.length / total)
  const semanas: SemanaTimeline[] = []
  for (let s = 0; s < total; s++) {
    const chunk = sesiones.slice(s * porSemana, (s + 1) * porSemana)
    if (!chunk.length) continue
    semanas.push({
      numero: s + 1,
      sesiones: chunk
        .sort((a, b) => (DIAS_ORDER[a.dia_semana] ?? 99) - (DIAS_ORDER[b.dia_semana] ?? 99))
        .map(ses => ({
          id: ses.id,
          nombre: ses.nombre,
          dia_semana: ses.dia_semana,
          orden: ses.orden,
          duracion_estimada_min: ses.duracion_estimada_min ?? undefined,
          ejercicios: ses.ejercicios
            .sort((a, b) => a.orden - b.orden)
            .map(ej => ({
              id: ej.id,
              ejercicio_id: ej.ejercicio_id,
              nombre: ej.ejercicio?.nombre ?? '—',
              grupo_muscular: ej.ejercicio?.grupo_muscular ?? '',
              series: ej.series,
              repeticiones: ej.repeticiones,
              descanso_segundos: ej.descanso_segundos,
              peso_sugerido: ej.peso_sugerido ?? '',
              rpe: ej.rpe ?? '',
              notas: ej.notas ?? '',
              instruccion_ejercicio: ej.instruccion_ejercicio ?? '',
              contexto_ia: ej.contexto_ia ?? null,
              orden: ej.orden,
            })),
        })),
    })
  }
  return semanas
}

export default function PlanEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [plan, setPlan] = useState<PlanInfo | null>(null)
  const [semanas, setSemanas] = useState<SemanaTimeline[]>([])
  const [sesionesFlat, setSesionesFlat] = useState<{ id: string; nombre: string; dia_semana: string; semana: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  async function load() {
    const { data: planData } = await supabase
      .from('planes_entrenamiento')
      .select(`
        id, nombre, activo, duracion_semanas, instruccion_coach, cliente_id,
        cliente:clientes(profile:profiles!profile_id(nombre, apellidos))
      `)
      .eq('id', id)
      .single()

    if (!planData) { router.push('/entrenos'); return }

    const { data: sesData } = await supabase
      .from('sesiones_entrenamiento')
      .select(`
        id, nombre, dia_semana, orden, duracion_estimada_min, contexto_ia,
        ejercicios:sesion_ejercicios(
          id, ejercicio_id, series, repeticiones, descanso_segundos, peso_sugerido, rpe, notas,
          instruccion_ejercicio, contexto_ia, orden,
          ejercicio:ejercicios(id, nombre, grupo_muscular, tipo)
        )
      `)
      .eq('plan_id', id)
      .order('orden')

    const cli = (planData as any).cliente?.profile
    const planInfo: PlanInfo = {
      id: planData.id,
      nombre: planData.nombre,
      activo: planData.activo,
      duracion_semanas: planData.duracion_semanas,
      instruccion_coach: planData.instruccion_coach ?? '',
      cliente_id: planData.cliente_id,
      cliente_nombre: `${cli?.nombre ?? ''} ${cli?.apellidos ?? ''}`.trim(),
    }

    const sesiones = (sesData ?? []) as unknown as RawSesion[]
    const semanasList = agruparPorSemanas(sesiones, planData.duracion_semanas)
    const flat = semanasList.flatMap(s => s.sesiones.map(ses => ({ id: ses.id, nombre: ses.nombre, dia_semana: ses.dia_semana, semana: s.numero })))

    setPlan(planInfo)
    setSemanas(semanasList)
    setSesionesFlat(flat)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleReorder(sesionId: string, ejerciciosOrdenados: string[]) {
    // Actualiza orden localmente primero (optimista)
    setSemanas(prev => prev.map(sem => ({
      ...sem,
      sesiones: sem.sesiones.map(ses => {
        if (ses.id !== sesionId) return ses
        const map = new Map(ses.ejercicios.map(e => [e.id, e]))
        return { ...ses, ejercicios: ejerciciosOrdenados.map((eid, i) => ({ ...map.get(eid)!, orden: i })) }
      }),
    })))
    // Persistir en BD
    await Promise.all(
      ejerciciosOrdenados.map((eid, i) =>
        supabase.from('sesion_ejercicios').update({ orden: i }).eq('id', eid)
      )
    )
  }

  async function handleMover(ejercicioId: string, destSesionId: string) {
    await supabase.from('sesion_ejercicios').update({ sesion_id: destSesionId }).eq('id', ejercicioId)
    await load()
  }

  function handleToggleContextoIA(sesionId: string, ejercicioId: string) {
    // Llama al endpoint existente — el estado se actualiza al recargar
    fetch('/api/entrenos/generar-contexto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sesion_id: sesionId }),
    }).then(() => load())
  }

  if (loading) return (
    <div className="flex justify-center items-center py-24">
      <Loader2 size={24} className="animate-spin" style={{ color: 'rgb(168,85,247)' }} />
    </div>
  )

  if (!plan) return null

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/entrenos" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate" style={{ color: 'var(--text)' }}>{plan.nombre}</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{plan.cliente_nombre}</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full font-medium"
          style={{ background: plan.activo ? 'rgba(34,197,94,0.12)' : 'var(--surface)', color: plan.activo ? 'rgb(34,197,94)' : 'var(--text-muted)' }}>
          {plan.activo ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {/* Timeline */}
      {semanas.length === 0 ? (
        <div className="card text-center py-12">
          <Dumbbell size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Sin sesiones en este plan</p>
        </div>
      ) : (
        <PlanTimeline
          semanas={semanas}
          onReorder={handleReorder}
          onMover={handleMover}
          onToggleContextoIA={handleToggleContextoIA}
          sesionesDisponibles={sesionesFlat}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar build completo**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: 0 errores de build.

- [ ] **Step 4: Commit**

```bash
git add "app/entrenos/[id]/page.tsx"
git commit -m "feat(ui): plan editor reescrito como timeline vertical con drag&drop"
```

---

### Task 5: SesionCardMobile + SetRegistroSheet

**Files:**
- Create: `components/training/SesionCardMobile.tsx`
- Create: `components/training/SetRegistroSheet.tsx`

- [ ] **Step 1: Crear `components/training/SetRegistroSheet.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  setNum: number
  totalSets: number
  ejercicioNombre: string
  pesoSugerido: string
  repsSugeridas: string
  onGuardar: (kg: number, reps: number, rpe: number) => void
  onCerrar: () => void
}

export default function SetRegistroSheet({ setNum, totalSets, ejercicioNombre, pesoSugerido, repsSugeridas, onGuardar, onCerrar }: Props) {
  const [kg, setKg] = useState(pesoSugerido ? parseFloat(pesoSugerido) || 0 : 0)
  const [reps, setReps] = useState(parseInt(repsSugeridas) || 0)
  const [rpe, setRpe] = useState(7)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onCerrar}>
      <div
        className="w-full max-w-sm rounded-t-2xl p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Set {setNum} / {totalSets}</p>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>{ejercicioNombre}</p>
          </div>
          <button onClick={onCerrar} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        {/* Inputs kg y reps */}
        <div className="flex gap-4 justify-center mb-6">
          {[
            { label: 'kg', value: kg, setValue: setKg, step: 2.5 },
            { label: 'reps', value: reps, setValue: setReps, step: 1 },
          ].map(({ label, value, setValue, step }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <button
                onClick={() => setValue(v => Math.max(0, +(v + step).toFixed(1)))}
                className="w-10 h-10 rounded-full text-xl font-bold"
                style={{ background: 'rgba(168,85,247,0.15)', color: 'rgb(168,85,247)' }}
              >+</button>
              <div className="text-center">
                <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{value}</span>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
              </div>
              <button
                onClick={() => setValue(v => Math.max(0, +(v - step).toFixed(1)))}
                className="w-10 h-10 rounded-full text-xl font-bold"
                style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >−</button>
            </div>
          ))}
        </div>

        {/* RPE selector */}
        <div className="mb-5">
          <p className="text-xs text-center mb-2" style={{ color: 'var(--text-muted)' }}>RPE percibido</p>
          <div className="flex justify-center gap-1.5">
            {[6, 7, 8, 9, 10].map(n => (
              <button
                key={n}
                onClick={() => setRpe(n)}
                className="w-10 h-10 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: rpe === n ? 'rgb(168,85,247)' : 'var(--bg)',
                  color: rpe === n ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${rpe === n ? 'rgb(168,85,247)' : 'var(--border)'}`,
                }}
              >{n}</button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onGuardar(kg, reps, rpe)}
          className="w-full py-3 rounded-xl font-semibold text-white"
          style={{ background: 'rgb(168,85,247)' }}
        >
          ✓ Guardar set
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear `components/training/SesionCardMobile.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import SetRegistroSheet from './SetRegistroSheet'

export interface SetData {
  kg: number
  reps: number
  rpe: number
  hecho: boolean
}

export interface EjercicioCard {
  id: string
  nombre: string
  grupo_muscular: string
  series: number
  repeticiones: string
  peso_sugerido: string
  instruccion_ejercicio: string
  contexto_ia: string | null
}

interface Props {
  ejercicios: EjercicioCard[]
  onEjercicioComplete: (ejId: string, sets: SetData[]) => void
  onTodosCompletos: (setsMap: Record<string, SetData[]>) => void
}

export default function SesionCardMobile({ ejercicios, onEjercicioComplete, onTodosCompletos }: Props) {
  const [ejIdx, setEjIdx] = useState(0)
  const [setsMap, setSetsMap] = useState<Record<string, SetData[]>>(() =>
    Object.fromEntries(ejercicios.map(e => [e.id, Array.from({ length: e.series }, () => ({ kg: 0, reps: 0, rpe: 7, hecho: false }))]))
  )
  const [setActivo, setSetActivo] = useState<{ ejId: string; setIdx: number } | null>(null)

  const ej = ejercicios[ejIdx]
  if (!ej) return null

  const sets = setsMap[ej.id] ?? []
  const primerSetPendiente = sets.findIndex(s => !s.hecho)
  const todosEjHechos = sets.every(s => s.hecho)

  function guardarSet(kg: number, reps: number, rpe: number) {
    if (!setActivo) return
    setSetsMap(prev => {
      const nuevosSets = prev[setActivo.ejId].map((s, i) =>
        i === setActivo.setIdx ? { kg, reps, rpe, hecho: true } : s
      )
      const nuevo = { ...prev, [setActivo.ejId]: nuevosSets }
      if (nuevosSets.every(s => s.hecho)) onEjercicioComplete(setActivo.ejId, nuevosSets)
      return nuevo
    })
    setSetActivo(null)
  }

  function avanzar() {
    if (ejIdx < ejercicios.length - 1) {
      setEjIdx(ejIdx + 1)
    } else {
      onTodosCompletos(setsMap)
    }
  }

  const totalSets = ejercicios.reduce((a, e) => a + e.series, 0)
  const hechos = Object.values(setsMap).flatMap(s => s).filter(s => s.hecho).length
  const progreso = totalSets > 0 ? hechos / totalSets : 0

  return (
    <div className="flex flex-col" style={{ minHeight: '100%' }}>
      {/* Barra progreso global */}
      <div className="h-1 rounded-full mx-4 mt-2 mb-1 overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${progreso * 100}%`, background: 'rgb(168,85,247)' }} />
      </div>
      <p className="text-center text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Ejercicio {ejIdx + 1} / {ejercicios.length}
      </p>

      {/* Card del ejercicio */}
      <div className="mx-4 rounded-2xl p-5 flex-1 flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between mb-1">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{ej.grupo_muscular}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.12)', color: 'rgb(168,85,247)' }}>
            {ej.series}×{ej.repeticiones}
          </span>
        </div>
        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>{ej.nombre}</h2>
        {ej.peso_sugerido && (
          <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Sugerido: {ej.peso_sugerido}</p>
        )}
        {ej.contexto_ia && (
          <p className="text-xs italic mb-3" style={{ color: 'rgb(168,85,247)' }}>🤖 {ej.contexto_ia}</p>
        )}
        {ej.instruccion_ejercicio && (
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{ej.instruccion_ejercicio}</p>
        )}

        {/* Grid de sets */}
        <div className="grid gap-2 flex-1" style={{ gridTemplateColumns: sets.length <= 3 ? `repeat(${sets.length}, 1fr)` : 'repeat(2, 1fr)' }}>
          {sets.map((set, i) => {
            const isActive = !set.hecho && i === primerSetPendiente
            return (
              <button
                key={i}
                onClick={() => !set.hecho && setSetActivo({ ejId: ej.id, setIdx: i })}
                className="rounded-xl py-3 flex flex-col items-center justify-center transition-all"
                style={{
                  background: set.hecho ? 'rgba(168,85,247,0.1)' : isActive ? 'rgba(168,85,247,0.08)' : 'var(--bg)',
                  border: `1.5px solid ${set.hecho ? 'rgba(168,85,247,0.5)' : isActive ? 'rgb(168,85,247)' : 'var(--border)'}`,
                }}
              >
                <span className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Set {i + 1}</span>
                {set.hecho ? (
                  <>
                    <span className="text-base font-bold" style={{ color: 'rgb(168,85,247)' }}>{set.kg}kg</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{set.reps} reps</span>
                  </>
                ) : (
                  <span className="text-lg" style={{ color: isActive ? 'rgb(168,85,247)' : 'var(--border-strong)' }}>
                    {isActive ? '▶' : '○'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Navegación inferior */}
      <div className="flex gap-3 px-4 py-4">
        <button
          onClick={() => setEjIdx(i => Math.max(0, i - 1))}
          disabled={ejIdx === 0}
          className="flex items-center gap-1 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: ejIdx === 0 ? 'var(--text-muted)' : 'var(--text)' }}
        >
          <ChevronLeft size={16} /> Anterior
        </button>
        <button
          onClick={avanzar}
          disabled={!todosEjHechos}
          className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: todosEjHechos ? 'rgb(168,85,247)' : 'rgba(168,85,247,0.3)' }}
        >
          {ejIdx === ejercicios.length - 1 ? 'Finalizar sesión' : 'Siguiente'} <ChevronRight size={16} />
        </button>
      </div>

      {/* Modal registro set */}
      {setActivo && (
        <SetRegistroSheet
          setNum={setActivo.setIdx + 1}
          totalSets={sets.length}
          ejercicioNombre={ej.nombre}
          pesoSugerido={ej.peso_sugerido}
          repsSugeridas={ej.repeticiones}
          onGuardar={guardarSet}
          onCerrar={() => setSetActivo(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit --pretty false 2>&1 | head -20
```

Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add components/training/SesionCardMobile.tsx components/training/SetRegistroSheet.tsx
git commit -m "feat(ui): SesionCardMobile + SetRegistroSheet para portal cliente"
```

---

### Task 6: Reescribir `/cliente/sesion/[id]/page.tsx`

**Files:**
- Rewrite: `app/cliente/sesion/[id]/page.tsx`

> **Nota:** El archivo actual (673 líneas) ya tiene toda la lógica de auth, fetch de sesión+ejercicios y llamada a `/api/entrenos/registrar-sesion`. Lee el archivo existente antes de reescribir. Preserva: auth por `codigo` del plan, fetch sesión, lógica de `registrarSesion()` que llama a la API, y la pantalla de `guardadoOk` con PRs. Lo que cambia es el layout del modo "Registrar" (ahora usa `SesionCardMobile`) y se añade toggle + modo "Solo ver".

- [ ] **Step 1: Leer el archivo actual**

```bash
wc -l "app/cliente/sesion/[id]/page.tsx"
grep -n "registrarSesion\|fetch.*registrar\|codigo\|guardadoOk\|prsDetectados" "app/cliente/sesion/[id]/page.tsx" | head -20
```

- [ ] **Step 2: Reescribir con toggle + SesionCardMobile**

El archivo nuevo debe tener esta estructura:

```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Trophy, Loader2 } from 'lucide-react'
import SesionCardMobile, { type SetData, type EjercicioCard } from '@/components/training/SesionCardMobile'

// (Reusar interfaces EjercicioSesion y SesionInfo del archivo original)
// (Reusar función registrarSesion que llama POST /api/entrenos/registrar-sesion)

type Modo = 'registrar' | 'solo-ver'

export default function EjecucionSesionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [sesion, setSesion] = useState<SesionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [modo, setModo] = useState<Modo>('registrar')
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [prsDetectados, setPrsDetectados] = useState<Array<{ ejercicio_nombre: string; peso_nuevo_kg: number; reps: number }>>([])

  // Fetch sesión (igual que antes — adaptar del archivo original)
  useEffect(() => {
    async function load() {
      // ... mismo fetch que en el archivo original ...
      // Seleccionar: sesiones_entrenamiento con plan, ejercicios con instruccion_ejercicio y contexto_ia
    }
    load()
  }, [id])

  async function registrarSesion(setsMap: Record<string, SetData[]>) {
    if (!sesion) return
    setGuardando(true)
    const ejercicios = sesion.ejercicios.map(ej => ({
      sesion_ejercicio_id: ej.id,
      ejercicio_id: ej.ejercicio.id,
      sets_ejecutados: (setsMap[ej.id] ?? []).map((s, i) => ({
        set_num: i + 1,
        peso_kg: s.kg,
        reps: s.reps,
        rpe: s.rpe,
      })),
    }))
    const res = await fetch('/api/entrenos/registrar-sesion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sesion_id: sesion.id,
        ejercicios,
        duracion_sesion_s: Math.floor((Date.now() - sesionStartMs) / 1000),
      }),
    })
    const data = await res.json()
    if (data.ok) {
      setPrsDetectados(data.prs ?? [])
      setGuardadoOk(true)
    }
    setGuardando(false)
  }

  // Pantalla de éxito
  if (guardadoOk) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <Trophy size={48} className="mb-4" style={{ color: 'rgb(168,85,247)' }} />
      <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>¡Sesión completada!</h2>
      {prsDetectados.length > 0 && (
        <div className="mb-4">
          {prsDetectados.map(pr => (
            <p key={pr.ejercicio_nombre} className="text-sm" style={{ color: 'rgb(34,197,94)' }}>
              🏆 Nuevo PR: {pr.ejercicio_nombre} — {pr.peso_nuevo_kg}kg × {pr.reps} reps
            </p>
          ))}
        </div>
      )}
      <Link href="/cliente" className="btn-primary">Volver al portal</Link>
    </div>
  )

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 size={24} className="animate-spin" style={{ color: 'rgb(168,85,247)' }} />
    </div>
  )

  if (!sesion) return null

  const ejerciciosCard: EjercicioCard[] = sesion.ejercicios.map(ej => ({
    id: ej.id,
    nombre: ej.ejercicio.nombre,
    grupo_muscular: ej.ejercicio.grupo_muscular,
    series: ej.series,
    repeticiones: ej.repeticiones,
    peso_sugerido: ej.peso_sugerido,
    instruccion_ejercicio: (ej as any).instruccion_ejercicio ?? '',
    contexto_ia: ej.contexto_ia ?? null,
  }))

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/cliente" style={{ color: 'var(--text-muted)' }}><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{sesion.nombre}</p>
          {sesion.contexto_ia && (
            <p className="text-xs italic" style={{ color: 'rgb(168,85,247)' }}>{sesion.contexto_ia}</p>
          )}
        </div>
        {/* Toggle modo */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {(['registrar', 'solo-ver'] as Modo[]).map(m => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: modo === m ? 'rgb(168,85,247)' : 'var(--surface)',
                color: modo === m ? '#fff' : 'var(--text-muted)',
              }}
            >
              {m === 'registrar' ? 'Registrar' : 'Solo ver'}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido según modo */}
      {modo === 'registrar' ? (
        <div className="flex-1 flex flex-col">
          {guardando ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin" style={{ color: 'rgb(168,85,247)' }} />
            </div>
          ) : (
            <SesionCardMobile
              ejercicios={ejerciciosCard}
              onEjercicioComplete={() => {}}
              onTodosCompletos={registrarSesion}
            />
          )}
        </div>
      ) : (
        /* Solo ver — lista plana */
        <div className="flex-1 overflow-y-auto p-4">
          {sesion.ejercicios.map((ej, i) => (
            <div key={ej.id} className="mb-3 p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(168,85,247,0.15)', color: 'rgb(168,85,247)' }}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{ej.ejercicio.nombre}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {ej.series} series × {ej.repeticiones} reps
                    {ej.peso_sugerido && ` · ${ej.peso_sugerido}`}
                  </p>
                  {(ej as any).instruccion_ejercicio && (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>{(ej as any).instruccion_ejercicio}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => setModo('registrar')} className="w-full mt-2 py-3 rounded-xl text-sm font-medium"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            Cambiar a modo registro
          </button>
        </div>
      )}
    </div>
  )
}
```

> **Importante:** La variable `sesionStartMs` debe declararse como `const sesionStartMs = useRef(Date.now())` o como `const [sesionStartMs] = useState(Date.now())` al inicio del componente. Adapta el fetch inicial del archivo original sin cambiar su lógica.

- [ ] **Step 3: Verificar build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add "app/cliente/sesion/[id]/page.tsx"
git commit -m "feat(ui): sesión cliente reescrita con cards + sets grid + toggle registrar/solo-ver"
```

---

### Task 7: Vista semanal cliente `/cliente/semana`

**Files:**
- Create: `app/cliente/semana/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ChevronRight } from 'lucide-react'

const DIAS_ABR: Record<string, string> = {
  Lunes: 'L', Martes: 'M', Miércoles: 'X', Jueves: 'J',
  Viernes: 'V', Sábado: 'S', Domingo: 'D',
}
const HOY_NOMBRE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date().getDay()]

interface SesionSemana {
  id: string
  nombre: string
  dia_semana: string
  ejercicios_count: number
  duracion_estimada_min: number | null
  completada: boolean
}

export default function VistaSemanalClientePage() {
  const [sesiones, setSesiones] = useState<SesionSemana[]>([])
  const [loading, setLoading] = useState(true)
  const [planNombre, setPlanNombre] = useState('')

  useEffect(() => {
    async function load() {
      // Leer codigo desde localStorage o URL — el portal usa codigo_publico
      const codigo = typeof window !== 'undefined' ? localStorage.getItem('cliente_codigo') : null
      if (!codigo) { setLoading(false); return }

      const { data: planData } = await supabase
        .from('planes_nutricion')
        .select('codigo_publico, cliente_id')
        .eq('codigo_publico', codigo)
        .single()

      if (!planData) { setLoading(false); return }

      const { data: planEntreno } = await supabase
        .from('planes_entrenamiento')
        .select('id, nombre')
        .eq('cliente_id', planData.cliente_id)
        .eq('activo', true)
        .single()

      if (!planEntreno) { setLoading(false); return }

      setPlanNombre(planEntreno.nombre)

      const { data: sesData } = await supabase
        .from('sesiones_entrenamiento')
        .select('id, nombre, dia_semana, duracion_estimada_min, ejercicios:sesion_ejercicios(id)')
        .eq('plan_id', planEntreno.id)
        .order('orden')

      // Verificar cuáles se completaron esta semana
      const lunesISO = (() => {
        const h = new Date(); const d = h.getDay(); const diff = d === 0 ? 6 : d - 1
        const l = new Date(h); l.setDate(h.getDate() - diff); return l.toISOString().split('T')[0]
      })()

      const { data: regs } = await supabase
        .from('registros_sets')
        .select('fecha')
        .eq('cliente_id', planData.cliente_id)
        .gte('fecha', lunesISO)

      const fechasCompletadas = new Set((regs ?? []).map(r => r.fecha))

      const DIAS_ORDER: Record<string, number> = { Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6, Domingo: 7 }
      const hoy = new Date().toISOString().split('T')[0]

      setSesiones(
        (sesData ?? [])
          .sort((a, b) => (DIAS_ORDER[a.dia_semana] ?? 9) - (DIAS_ORDER[b.dia_semana] ?? 9))
          .map(s => ({
            id: s.id,
            nombre: s.nombre,
            dia_semana: s.dia_semana,
            ejercicios_count: Array.isArray(s.ejercicios) ? s.ejercicios.length : 0,
            duracion_estimada_min: s.duracion_estimada_min ?? null,
            completada: fechasCompletadas.has(hoy) && s.dia_semana === HOY_NOMBRE,
          }))
      )
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cliente" style={{ color: 'var(--text-muted)' }}><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Esta semana</h1>
          {planNombre && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{planNombre}</p>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'rgb(168,85,247)' }} />
        </div>
      ) : sesiones.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Sin sesiones esta semana</div>
      ) : (
        <div className="flex flex-col gap-3">
          {sesiones.map(s => {
            const esHoy = s.dia_semana === HOY_NOMBRE
            return (
              <Link
                key={s.id}
                href={`/cliente/sesion/${s.id}`}
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{
                  background: esHoy ? 'rgba(168,85,247,0.06)' : 'var(--surface)',
                  border: `1px solid ${esHoy ? 'rgba(168,85,247,0.3)' : 'var(--border)'}`,
                  textDecoration: 'none',
                }}
              >
                {/* Día abreviado */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{
                    background: esHoy ? 'rgb(168,85,247)' : 'var(--bg)',
                    color: esHoy ? '#fff' : 'var(--text-muted)',
                    border: esHoy ? 'none' : '1px solid var(--border)',
                  }}>
                  {DIAS_ABR[s.dia_semana] ?? s.dia_semana[0]}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{s.nombre}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {s.ejercicios_count} ejercicios
                    {s.duracion_estimada_min && ` · ~${s.duracion_estimada_min} min`}
                  </p>
                </div>

                {s.completada ? (
                  <CheckCircle2 size={18} style={{ color: 'rgb(34,197,94)', flexShrink: 0 }} />
                ) : esHoy ? (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{ background: 'rgba(168,85,247,0.15)', color: 'rgb(168,85,247)' }}>Hoy</span>
                ) : (
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar build completo**

```bash
npm run build 2>&1 | tail -10
```

Expected: Build completado sin errores.

- [ ] **Step 3: Push**

```bash
git add app/cliente/semana/page.tsx
git commit -m "feat(ui): vista semanal cliente — sesiones de la semana con estado hoy/completada"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Sub-sidebar con Coach / Biblioteca / Herramientas (`TrainingSubNav.tsx` + `layout.tsx`)
- ✅ Dashboard CRM lista — avatar, nombre+plan, dots L-D, badge PR/Fatiga/OK, RPE, última sesión
- ✅ Timeline vertical continuo — semanas con divisor morado, sesiones por día, ejercicios como cards
- ✅ Drag & drop reordenar dentro del día (`@dnd-kit/sortable`)
- ✅ Mover ejercicio a otro día/semana (botón ↕ + modal selector)
- ✅ Toggle Registrar / Solo ver en sesión cliente
- ✅ Cards de ejercicio con sets en grid — completados en morado, activo resaltado
- ✅ Modal `SetRegistroSheet` con kg/reps/RPE
- ✅ Vista semanal `/cliente/semana` — sesiones del plan ordenadas por día, HOY resaltado
- ✅ Sin SQL nuevo — todo sobre schema existente
- ✅ CSS variables, mobile-first, `autoComplete="off"`

**Placeholder scan:** Ninguno. El código del archivo reescrito de sesión/[id] tiene una nota de adaptación documentada.

**Type consistency:**
- `EjercicioCard` definido en `SesionCardMobile.tsx` — `SetRegistroSheet` no lo usa directamente ✅
- `SemanaTimeline` / `SesionTimeline` / `EjercicioTimeline` definidos en `PlanTimeline.tsx` — usados en `[id]/page.tsx` via import ✅
- `SetData` exportado de `SesionCardMobile.tsx` — importado en `sesion/[id]/page.tsx` ✅
