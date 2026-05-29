# Rediseño Página de Clientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar `/clientes` con tabla densa, membresías con fechas, filtros avanzados, score de adherencia, predictor de baja, deuda de atención y agente de retención.

**Architecture:** Extraer lógica y UI en componentes pequeños (`ClientesToolbar`, `ClientesTabla`, `ClientesListaMobile`) + utilidades en `lib/clientes-utils.ts`. El agente de retención sigue el mismo patrón del sistema multiagente existente (`lib/agentes/`).

**Tech Stack:** Next.js App Router, Supabase JS client, Phosphor Icons, Tailwind + CSS vars, DeepSeek V3 (agente retención)

---

## Scope

Este plan cubre 9 tareas independientes y ejecutables en orden:

1. SQL migration — 3 columnas en `clientes`
2. `lib/clientes-utils.ts` — tipos + funciones score/predictor/deuda
3. `components/clientes/ClientesToolbar.tsx` — barra búsqueda + filtros
4. `components/clientes/ClientesTabla.tsx` — tabla desktop
5. `components/clientes/ClientesListaMobile.tsx` — lista iPhone
6. Reescritura `app/clientes/page.tsx` — data fetching + montaje
7. Editor membresía en `app/clientes/[id]/page.tsx`
8. `lib/agentes/agente-retencion.ts` — agente retención
9. Conectar agente en `orquestador.ts` + `director.ts`

---

## Task 1: SQL migration — campos membresía

**Files:**
- Create: `supabase/migrations/20260529_membresia_clientes.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/20260529_membresia_clientes.sql
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo_membresia TEXT
    CHECK (tipo_membresia IN ('trimestral', 'semestral', 'anual')),
  ADD COLUMN IF NOT EXISTS fecha_inicio_membresia DATE,
  ADD COLUMN IF NOT EXISTS fecha_fin_membresia DATE;
```

- [ ] **Step 2: Aplicar en Supabase**

Dashboard Supabase → SQL Editor → pegar y ejecutar el contenido del archivo.
Verificar: `SELECT id, tipo_membresia, fecha_inicio_membresia, fecha_fin_membresia FROM clientes LIMIT 3;` debe devolver columnas (con NULL por ahora).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260529_membresia_clientes.sql
git commit -m "feat: add tipo_membresia + fechas to clientes table"
```

---

## Task 2: Utilidades y tipos compartidos

**Files:**
- Create: `lib/clientes-utils.ts`

- [ ] **Step 1: Crear el archivo con todos los tipos y funciones**

```typescript
// lib/clientes-utils.ts

export type TipoMembresia = 'trimestral' | 'semestral' | 'anual'
export type Filtro = 'todos' | 'atencion' | 'nuevos' | 'riesgo' | 'sin_checkin' | 'activos'
export type FiltroAlta = 'mes' | 'trimestre' | null
export type SortKey = 'checkin' | 'nombre' | 'membresia_caduca' | 'score_adherencia' | 'deuda_atencion'

export type ClienteRow = {
  id: string
  activo: boolean
  objetivo?: string
  nivel?: string
  peso_inicial?: number | null
  fecha_proxima_revision?: string | null
  revisado_por_coach?: boolean | null
  tipo_membresia?: TipoMembresia | null
  fecha_inicio_membresia?: string | null
  fecha_fin_membresia?: string | null
  profile?: { nombre?: string; apellidos?: string; email?: string }
  // computed from parallel queries
  dias_sin_checkin?: number
  ultimo_checkin?: string | null
  tareas_ia_pendientes?: number
  tiene_dieta_activa?: boolean
  tiene_entreno_activo?: boolean
  chats_sin_leer?: number
  comidas_hecha_7d?: number
  sesiones_completadas_7d?: number
  tiene_peso_7d?: boolean
  interacciones_coach_7d?: number
  // computed from util functions
  score_adherencia?: number
  es_predictor_baja?: boolean
  deuda_atencion?: number
}

export type ToolbarCounts = {
  total: number
  atencion: number
  nuevos: number
  riesgo: number
  sin_checkin: number
  activos: number
  caduca_pronto: number
  chats_sin_leer: number
  revisiones_proximas: number
}

export function nombreCliente(c: ClienteRow): string {
  return [c.profile?.nombre, c.profile?.apellidos].filter(Boolean).join(' ') || 'Sin nombre'
}

export function diasHastaCaducidad(c: ClienteRow): number | null {
  if (!c.fecha_fin_membresia) return null
  return Math.floor((new Date(c.fecha_fin_membresia).getTime() - Date.now()) / 86_400_000)
}

export function calcularScoreAdherencia(c: ClienteRow): number {
  const dias = c.dias_sin_checkin ?? 999
  const checkInScore = dias <= 4 ? 100 : Math.max(0, 100 - ((dias - 4) / 10) * 100)
  const comidasScore = Math.min(100, ((c.comidas_hecha_7d ?? 0) / 21) * 100)
  const entrenoScore = Math.min(100, ((c.sesiones_completadas_7d ?? 0) / 3) * 100)
  const pesoScore = c.tiene_peso_7d ? 100 : 0
  return Math.round(checkInScore * 0.4 + comidasScore * 0.3 + entrenoScore * 0.2 + pesoScore * 0.1)
}

export function esPredictorBaja(c: ClienteRow): boolean {
  const cad = diasHastaCaducidad(c)
  const señales = [
    (c.score_adherencia ?? 100) < 40,
    cad !== null && cad <= 30,
    (c.chats_sin_leer ?? 0) > 0 && (c.interacciones_coach_7d ?? 0) === 0,
    (c.dias_sin_checkin ?? 0) > 10,
  ]
  return señales.filter(Boolean).length >= 2
}

export function calcularDeudaAtencion(c: ClienteRow): number {
  const urgencia =
    (c.dias_sin_checkin ?? 0) * 2 +
    (c.tareas_ia_pendientes ?? 0) * 3 +
    (c.chats_sin_leer ?? 0) * 2
  return urgencia / Math.max(c.interacciones_coach_7d ?? 0, 1)
}

export type EstadoTone = 'danger' | 'warning' | 'success' | 'muted' | 'info'
export type EstadoCliente = { label: string; tone: EstadoTone }

export function getEstadoCliente(c: ClienteRow): EstadoCliente {
  if (c.revisado_por_coach === false) return { label: 'Revisar plan', tone: 'info' }
  if ((c.tareas_ia_pendientes ?? 0) > 0) return { label: 'IA pendiente', tone: 'warning' }
  if ((c.dias_sin_checkin ?? 0) > 10) return { label: 'Riesgo', tone: 'danger' }
  if ((c.dias_sin_checkin ?? 0) > 4) return { label: 'Sin check-in', tone: 'warning' }
  if (c.activo) return { label: 'Activo', tone: 'success' }
  return { label: 'Inactivo', tone: 'muted' }
}

export function estadoStyle(tone: EstadoTone): React.CSSProperties {
  if (tone === 'danger') return { background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(255,69,58,0.24)' }
  if (tone === 'warning') return { background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid rgba(201,169,110,0.24)' }
  if (tone === 'success') return { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(48,209,88,0.2)' }
  if (tone === 'info') return { background: 'rgba(129,140,248,0.1)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)' }
  return { background: 'var(--surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
}

export function scoreColor(score: number): string {
  if (score >= 70) return 'var(--success)'
  if (score >= 40) return 'var(--warning)'
  return 'var(--error)'
}

export function checkinColor(dias: number): string {
  if (dias <= 4) return 'var(--success)'
  if (dias <= 10) return 'var(--warning)'
  return 'var(--error)'
}

export function aplicarFiltros(
  clientes: ClienteRow[],
  filtro: Filtro,
  busqueda: string,
  caducaPronte: boolean,
  filtroAlta: FiltroAlta,
  filtroRevisiones: boolean,
  filtroChats: boolean,
): ClienteRow[] {
  const q = busqueda.toLowerCase()
  const hoy = Date.now()

  return clientes.filter(c => {
    // búsqueda
    const texto = `${c.profile?.nombre ?? ''} ${c.profile?.apellidos ?? ''} ${c.profile?.email ?? ''}`.toLowerCase()
    if (q && !texto.includes(q)) return false

    // filtro estado (exclusivo)
    if (filtro === 'atencion' && !(c.revisado_por_coach === false || (c.tareas_ia_pendientes ?? 0) > 0 || (c.dias_sin_checkin ?? 0) > 4)) return false
    if (filtro === 'nuevos' && c.revisado_por_coach !== false) return false
    if (filtro === 'riesgo' && (c.dias_sin_checkin ?? 0) <= 10) return false
    if (filtro === 'sin_checkin' && (c.dias_sin_checkin ?? 0) <= 4) return false
    if (filtro === 'activos' && !c.activo) return false

    // filtros adicionales (acumulativos)
    if (caducaPronte) {
      const d = diasHastaCaducidad(c)
      if (d === null || d > 30) return false
    }
    if (filtroAlta === 'mes') {
      if (!c.fecha_inicio_membresia) return false
      const inicio = new Date(c.fecha_inicio_membresia).getTime()
      if (hoy - inicio > 30 * 86_400_000) return false
    }
    if (filtroAlta === 'trimestre') {
      if (!c.fecha_inicio_membresia) return false
      const inicio = new Date(c.fecha_inicio_membresia).getTime()
      if (hoy - inicio > 90 * 86_400_000) return false
    }
    if (filtroRevisiones) {
      if (!c.fecha_proxima_revision) return false
      const dias = Math.floor((new Date(c.fecha_proxima_revision).getTime() - hoy) / 86_400_000)
      if (dias < 0 || dias > 14) return false
    }
    if (filtroChats && (c.chats_sin_leer ?? 0) === 0) return false

    return true
  })
}

export function aplicarSort(clientes: ClienteRow[], sort: SortKey): ClienteRow[] {
  return [...clientes].sort((a, b) => {
    if (sort === 'nombre') return nombreCliente(a).localeCompare(nombreCliente(b))
    if (sort === 'membresia_caduca') {
      const da = diasHastaCaducidad(a) ?? 9999
      const db = diasHastaCaducidad(b) ?? 9999
      return da - db
    }
    if (sort === 'score_adherencia') return (a.score_adherencia ?? 0) - (b.score_adherencia ?? 0)
    if (sort === 'deuda_atencion') return (b.deuda_atencion ?? 0) - (a.deuda_atencion ?? 0)
    // checkin (default)
    return (b.dias_sin_checkin ?? 0) - (a.dias_sin_checkin ?? 0)
  })
}
```

Nota: el import de `React.CSSProperties` requiere que el archivo tenga `import type React from 'react'` o que se use el tipo directamente. Añadir al inicio:

```typescript
import type React from 'react'
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit --pretty false 2>&1 | grep clientes-utils
```

Esperado: sin errores en `clientes-utils.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/clientes-utils.ts
git commit -m "feat: clientes-utils — types, score adherencia, predictor baja, deuda atención"
```

---

## Task 3: ClientesToolbar component

**Files:**
- Create: `components/clientes/ClientesToolbar.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
// components/clientes/ClientesToolbar.tsx
'use client'

import { MagnifyingGlass, CaretDown } from '@phosphor-icons/react'
import type { Filtro, FiltroAlta, SortKey, ToolbarCounts } from '@/lib/clientes-utils'

const FILTRO_LABELS: Record<Filtro, string> = {
  todos: 'Todos',
  atencion: 'Atención',
  nuevos: 'Nuevos',
  riesgo: 'Riesgo',
  sin_checkin: 'Sin check-in',
  activos: 'Activos',
}

const SORT_LABELS: Record<SortKey, string> = {
  checkin: 'Check-in',
  nombre: 'Nombre',
  membresia_caduca: 'Caduca',
  score_adherencia: 'Adherencia',
  deuda_atencion: 'Deuda atención',
}

interface Props {
  busqueda: string
  onBusqueda: (v: string) => void
  filtro: Filtro
  onFiltro: (f: Filtro) => void
  caducaPronte: boolean
  onCaducaPronte: (v: boolean) => void
  filtroAlta: FiltroAlta
  onFiltroAlta: (v: FiltroAlta) => void
  filtroRevisiones: boolean
  onFiltroRevisiones: (v: boolean) => void
  filtroChats: boolean
  onFiltroChats: (v: boolean) => void
  sort: SortKey
  onSort: (s: SortKey) => void
  counts: ToolbarCounts
}

export default function ClientesToolbar({
  busqueda, onBusqueda,
  filtro, onFiltro,
  caducaPronte, onCaducaPronte,
  filtroAlta, onFiltroAlta,
  filtroRevisiones, onFiltroRevisiones,
  filtroChats, onFiltroChats,
  sort, onSort,
  counts,
}: Props) {
  const statusFiltros: Filtro[] = ['atencion', 'todos', 'riesgo', 'sin_checkin', 'nuevos', 'activos']
  const statusCounts: Partial<Record<Filtro, number>> = {
    atencion: counts.atencion,
    todos: counts.total,
    riesgo: counts.riesgo,
    sin_checkin: counts.sin_checkin,
    nuevos: counts.nuevos,
    activos: counts.activos,
  }

  return (
    <div
      className="rounded-2xl p-2.5 mb-4 flex flex-wrap items-center gap-2"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Búsqueda compacta */}
      <div className="relative flex-shrink-0">
        <MagnifyingGlass
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          className="input"
          style={{ width: '185px', paddingLeft: '28px', height: '32px', fontSize: '12px' }}
          placeholder="Buscar cliente…"
          value={busqueda}
          onChange={e => onBusqueda(e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* Separador */}
      <div className="hidden sm:block w-px h-5 flex-shrink-0" style={{ background: 'var(--border)' }} />

      {/* Filtros de estado */}
      <div className="flex gap-1.5 flex-wrap">
        {statusFiltros.map(f => {
          const active = filtro === f
          const cnt = statusCounts[f]
          return (
            <button
              key={f}
              onClick={() => onFiltro(f)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap"
              style={active
                ? { background: 'var(--text)', color: 'var(--bg)' }
                : { background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
              }
            >
              {FILTRO_LABELS[f]}
              {cnt !== undefined && cnt > 0 && (
                <span
                  className="rounded-full px-1 text-[10px] font-data"
                  style={{
                    background: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                    minWidth: '16px',
                    textAlign: 'center',
                  }}
                >
                  {cnt}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Separador */}
      <div className="hidden sm:block w-px h-5 flex-shrink-0" style={{ background: 'var(--border)' }} />

      {/* Filtros membresía + fechas */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => onCaducaPronte(!caducaPronte)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap"
          style={caducaPronte
            ? { background: 'rgba(255,69,58,0.15)', color: 'var(--error)', border: '1px solid rgba(255,69,58,0.3)' }
            : { background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
          }
        >
          ⏰ Caduca pronto
          {counts.caduca_pronto > 0 && (
            <span className="rounded-full px-1 text-[10px] font-data" style={{ background: 'rgba(255,69,58,0.2)' }}>
              {counts.caduca_pronto}
            </span>
          )}
        </button>

        <select
          value={filtroAlta ?? ''}
          onChange={e => onFiltroAlta((e.target.value as FiltroAlta) || null)}
          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
          style={{ background: filtroAlta ? 'rgba(99,102,241,0.12)' : 'var(--bg-subtle)', color: filtroAlta ? '#818cf8' : 'var(--text-secondary)', border: `1px solid ${filtroAlta ? 'rgba(129,140,248,0.3)' : 'var(--border)'}`, height: '32px' }}
        >
          <option value="">📅 Alta: cualquiera</option>
          <option value="mes">Alta: este mes</option>
          <option value="trimestre">Alta: últimos 3 meses</option>
        </select>

        <button
          onClick={() => onFiltroRevisiones(!filtroRevisiones)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap"
          style={filtroRevisiones
            ? { background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)' }
            : { background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
          }
        >
          📅 Revisiones
          {counts.revisiones_proximas > 0 && (
            <span className="rounded-full px-1 text-[10px] font-data" style={{ background: 'rgba(129,140,248,0.15)' }}>
              {counts.revisiones_proximas}
            </span>
          )}
        </button>

        <button
          onClick={() => onFiltroChats(!filtroChats)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap"
          style={filtroChats
            ? { background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)' }
            : { background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
          }
        >
          💬 Chats sin leer
          {counts.chats_sin_leer > 0 && (
            <span className="rounded-full px-1 text-[10px] font-data" style={{ background: 'rgba(129,140,248,0.15)' }}>
              {counts.chats_sin_leer}
            </span>
          )}
        </button>
      </div>

      {/* Espaciador */}
      <div className="flex-1" />

      {/* Ordenación */}
      <div className="relative flex-shrink-0">
        <select
          value={sort}
          onChange={e => onSort(e.target.value as SortKey)}
          className="px-2.5 pr-7 py-1.5 rounded-lg text-[11px] font-semibold appearance-none"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border)', height: '32px' }}
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
            <option key={k} value={k}>↕ {SORT_LABELS[k]}</option>
          ))}
        </select>
        <CaretDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep ClientesToolbar
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/clientes/ClientesToolbar.tsx
git commit -m "feat: ClientesToolbar — search compacto + filtros estado + membresía + fechas + sort"
```

---

## Task 4: ClientesTabla (desktop)

**Files:**
- Create: `components/clientes/ClientesTabla.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
// components/clientes/ClientesTabla.tsx
'use client'

import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react'
import { OBJETIVO_LABELS } from '@/lib/utils'
import {
  nombreCliente, getEstadoCliente, estadoStyle, scoreColor,
  checkinColor, diasHastaCaducidad,
  type ClienteRow, type SortKey,
} from '@/lib/clientes-utils'

interface Props {
  clientes: ClienteRow[]
  sort: SortKey
  onSort: (s: SortKey) => void
}

function ColHeader({ label, sortKey, current, onSort }: { label: string; sortKey: SortKey; current: SortKey; onSort: (s: SortKey) => void }) {
  const active = current === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="text-left text-[9px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap"
      style={{ color: active ? 'var(--text)' : 'var(--text-muted)' }}
    >
      {label}{active ? ' ↓' : ''}
    </button>
  )
}

function MembresiaCell({ c }: { c: ClienteRow }) {
  const dias = diasHastaCaducidad(c)
  const barColor = dias !== null && dias <= 30 ? 'var(--error)' : 'var(--primary, #6366f1)'
  const barWidth = (() => {
    if (!c.fecha_inicio_membresia || !c.fecha_fin_membresia) return 0
    const total = new Date(c.fecha_fin_membresia).getTime() - new Date(c.fecha_inicio_membresia).getTime()
    const elapsed = Date.now() - new Date(c.fecha_inicio_membresia).getTime()
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  })()

  return (
    <div>
      {c.tipo_membresia ? (
        <>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize"
            style={{ background: 'rgba(165,180,252,0.1)', color: '#a5b4fc', border: '1px solid rgba(165,180,252,0.18)' }}
          >
            {c.tipo_membresia}
          </span>
          <div className="text-[9px] mt-0.5" style={{ color: dias !== null && dias <= 30 ? 'var(--error)' : 'var(--text-muted)' }}>
            {dias === null ? '—' : dias <= 0 ? 'Caducada' : `${dias} d`}
          </div>
          <div className="h-[2px] rounded-full mt-0.5 w-full" style={{ background: 'var(--border)' }}>
            <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: barColor, opacity: 0.8 }} />
          </div>
        </>
      ) : (
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>—</span>
      )}
    </div>
  )
}

export default function ClientesTabla({ clientes, sort, onSort }: Props) {
  if (clientes.length === 0) return null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Cabecera */}
      <div
        className="hidden lg:flex items-center gap-0 px-3 py-2"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
      >
        <div style={{ width: '36px' }} />
        <div style={{ flex: 1, paddingRight: '8px' }}>
          <ColHeader label="Cliente" sortKey="nombre" current={sort} onSort={onSort} />
        </div>
        <div style={{ width: '108px', paddingRight: '6px' }}>
          <ColHeader label="Membresía" sortKey="membresia_caduca" current={sort} onSort={onSort} />
        </div>
        <div style={{ width: '60px', paddingRight: '4px', textAlign: 'center' }}>
          <ColHeader label="Check-in" sortKey="checkin" current={sort} onSort={onSort} />
        </div>
        <div style={{ width: '88px', paddingRight: '6px' }}>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Objetivo</span>
        </div>
        <div style={{ width: '48px', paddingRight: '4px', textAlign: 'center' }}>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Planes</span>
        </div>
        <div style={{ width: '60px', paddingRight: '6px', textAlign: 'center' }}>
          <ColHeader label="Adh." sortKey="score_adherencia" current={sort} onSort={onSort} />
        </div>
        <div style={{ width: '88px', paddingRight: '6px', textAlign: 'right' }}>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Estado</span>
        </div>
        <div style={{ width: '16px' }} />
      </div>

      {/* Filas */}
      {clientes.map((c, i) => {
        const estado = getEstadoCliente(c)
        const href = c.revisado_por_coach === false ? `/clientes/${c.id}/revisar-rapido` : `/clientes/${c.id}`
        const dias = c.dias_sin_checkin ?? 999
        const score = c.score_adherencia

        return (
          <Link
            key={c.id}
            href={href}
            className="group flex items-center gap-0 px-3 py-2.5 transition-colors"
            style={{
              borderBottom: i < clientes.length - 1 ? '1px solid var(--border)' : undefined,
              background: 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-[11px] flex-shrink-0 mr-2"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              {c.profile?.nombre?.[0]?.toUpperCase() ?? '?'}
            </div>

            {/* Cliente */}
            <div style={{ flex: 1, paddingRight: '8px', minWidth: 0 }}>
              <div className="font-bold text-[13px] truncate" style={{ color: 'var(--text)' }}>
                {nombreCliente(c)}
                {c.es_predictor_baja && <span className="ml-1.5 text-[9px]" style={{ color: 'var(--error)' }}>⚠</span>}
              </div>
              <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                {c.profile?.email}
              </div>
            </div>

            {/* Membresía */}
            <div style={{ width: '108px', paddingRight: '6px', flexShrink: 0 }}>
              <MembresiaCell c={c} />
            </div>

            {/* Check-in */}
            <div style={{ width: '60px', paddingRight: '4px', flexShrink: 0, textAlign: 'center' }}>
              <div className="font-data text-[13px] font-black" style={{ color: checkinColor(dias) }}>
                {dias === 999 ? '—' : `${dias}d`}
              </div>
              <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>check</div>
            </div>

            {/* Objetivo */}
            <div style={{ width: '88px', paddingRight: '6px', flexShrink: 0 }}>
              {c.objetivo && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                >
                  {OBJETIVO_LABELS[c.objetivo] ?? c.objetivo}
                </span>
              )}
            </div>

            {/* Planes (2 dots) */}
            <div style={{ width: '48px', paddingRight: '4px', flexShrink: 0, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '3px', alignItems: 'center' }}>
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: c.tiene_dieta_activa ? 'var(--success)' : 'var(--border)' }}
                title="Dieta"
              />
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: c.tiene_entreno_activo ? 'var(--success)' : 'var(--border)' }}
                title="Entreno"
              />
            </div>

            {/* Score adherencia */}
            <div style={{ width: '60px', paddingRight: '6px', flexShrink: 0, textAlign: 'center' }}>
              {score !== undefined ? (
                <>
                  <div className="font-data text-[13px] font-black" style={{ color: scoreColor(score) }}>{score}</div>
                  <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>/100</div>
                </>
              ) : (
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>—</span>
              )}
            </div>

            {/* Estado */}
            <div style={{ width: '88px', paddingRight: '6px', flexShrink: 0, textAlign: 'right' }}>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={estadoStyle(estado.tone)}
              >
                {estado.label}
              </span>
            </div>

            {/* Arrow */}
            <div style={{ width: '16px', flexShrink: 0 }}>
              <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} className="transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep ClientesTabla
```

- [ ] **Step 3: Commit**

```bash
git add components/clientes/ClientesTabla.tsx
git commit -m "feat: ClientesTabla — tabla densa desktop con score, membresía y predictor baja"
```

---

## Task 5: ClientesListaMobile (iPhone)

**Files:**
- Create: `components/clientes/ClientesListaMobile.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
// components/clientes/ClientesListaMobile.tsx
'use client'

import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react'
import {
  nombreCliente, getEstadoCliente, estadoStyle, checkinColor,
  diasHastaCaducidad,
  type ClienteRow,
} from '@/lib/clientes-utils'

export default function ClientesListaMobile({ clientes }: { clientes: ClienteRow[] }) {
  return (
    <div className="flex flex-col gap-0 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {clientes.map((c, i) => {
        const estado = getEstadoCliente(c)
        const href = c.revisado_por_coach === false ? `/clientes/${c.id}/revisar-rapido` : `/clientes/${c.id}`
        const dias = c.dias_sin_checkin ?? 999
        const caducaDias = diasHastaCaducidad(c)

        return (
          <Link
            key={c.id}
            href={href}
            className="flex items-start gap-3 px-3 py-3 active:opacity-70"
            style={{ borderBottom: i < clientes.length - 1 ? '1px solid var(--border)' : undefined }}
          >
            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-[13px] flex-shrink-0 mt-0.5"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              {c.profile?.nombre?.[0]?.toUpperCase() ?? '?'}
            </div>

            {/* Body */}
            <div className="flex-1 min-w-0">
              {/* Fila 1: nombre + badge */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[13px] truncate" style={{ color: 'var(--text)' }}>
                  {nombreCliente(c)}
                  {c.es_predictor_baja && <span className="ml-1 text-[10px]" style={{ color: 'var(--error)' }}>⚠</span>}
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={estadoStyle(estado.tone)}>
                  {estado.label}
                </span>
              </div>

              {/* Fila 2: membresía */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {c.tipo_membresia && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                    style={{ background: 'rgba(165,180,252,0.1)', color: '#a5b4fc', border: '1px solid rgba(165,180,252,0.18)' }}
                  >
                    {c.tipo_membresia}
                  </span>
                )}
                {caducaDias !== null && (
                  <span className="text-[10px]" style={{ color: caducaDias <= 30 ? 'var(--error)' : 'var(--text-muted)' }}>
                    · caduca {caducaDias <= 0 ? 'caducada' : `${caducaDias}d`}
                  </span>
                )}
              </div>

              {/* Fila 3: stats */}
              <div className="flex items-center gap-4 mt-1.5">
                <div>
                  <span className="font-data text-[12px] font-black" style={{ color: checkinColor(dias) }}>
                    {dias === 999 ? '—' : `${dias}d`}
                  </span>
                  <span className="text-[9px] ml-0.5" style={{ color: 'var(--text-muted)' }}>check-in</span>
                </div>
                <div>
                  <span className="font-data text-[12px] font-black" style={{ color: (c.tareas_ia_pendientes ?? 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {c.tareas_ia_pendientes ?? 0}
                  </span>
                  <span className="text-[9px] ml-0.5" style={{ color: 'var(--text-muted)' }}>IA</span>
                </div>
                {c.score_adherencia !== undefined && (
                  <div>
                    <span className="font-data text-[12px] font-black" style={{ color: 'var(--text-muted)' }}>
                      {c.score_adherencia}
                    </span>
                    <span className="text-[9px] ml-0.5" style={{ color: 'var(--text-muted)' }}>adh.</span>
                  </div>
                )}
                {/* Dots planes */}
                <div className="flex gap-1 items-center">
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: c.tiene_dieta_activa ? 'var(--success)' : 'var(--border)' }} />
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: c.tiene_entreno_activo ? 'var(--success)' : 'var(--border)' }} />
                </div>
              </div>
            </div>

            {/* Arrow */}
            <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '12px' }} />
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep ClientesListaMobile
```

- [ ] **Step 3: Commit**

```bash
git add components/clientes/ClientesListaMobile.tsx
git commit -m "feat: ClientesListaMobile — lista iPhone con membresía, score, predictor baja"
```

---

## Task 6: Reescritura de `app/clientes/page.tsx`

**Files:**
- Modify: `app/clientes/page.tsx` (reescritura completa)

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```typescript
// app/clientes/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useDebounce } from '@/lib/useDebounce'
import Link from 'next/link'
import { ArrowLeft, Check, Link as LinkIcon, Plus, SpinnerGap, UsersThree } from '@phosphor-icons/react'
import {
  type ClienteRow, type Filtro, type FiltroAlta, type SortKey, type ToolbarCounts,
  calcularScoreAdherencia, esPredictorBaja, calcularDeudaAtencion,
  aplicarFiltros, aplicarSort, diasHastaCaducidad,
} from '@/lib/clientes-utils'
import ClientesToolbar from '@/components/clientes/ClientesToolbar'
import ClientesTabla from '@/components/clientes/ClientesTabla'
import ClientesListaMobile from '@/components/clientes/ClientesListaMobile'

type PlanRow = { cliente_id: string }
type TareaRow = { cliente_id: string | null }

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [invitando, setInvitando] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const busquedaDebounced = useDebounce(busqueda, 250)
  const [filtro, setFiltro] = useState<Filtro>('atencion')
  const [caducaPronte, setCaducaPronte] = useState(false)
  const [filtroAlta, setFiltroAlta] = useState<FiltroAlta>(null)
  const [filtroRevisiones, setFiltroRevisiones] = useState(false)
  const [filtroChats, setFiltroChats] = useState(false)
  const [sort, setSort] = useState<SortKey>('checkin')

  async function handleInvitar() {
    setInvitando('loading')
    try {
      const res = await fetch('/api/invitaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (data.url) { await navigator.clipboard.writeText(data.url); setInvitando('done'); setTimeout(() => setInvitando('idle'), 2000) }
      else { setInvitando('error'); setTimeout(() => setInvitando('idle'), 2000) }
    } catch { setInvitando('error'); setTimeout(() => setInvitando('idle'), 2000) }
  }

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data, error } = await supabase
          .from('clientes')
          .select('id, activo, objetivo, nivel, peso_inicial, fecha_proxima_revision, revisado_por_coach, tipo_membresia, fecha_inicio_membresia, fecha_fin_membresia, profile:profiles!profile_id(nombre, apellidos, email)')
          .eq('coach_id', user.id)
          .order('created_at', { ascending: false })

        if (error) { console.error('[clientes] query error:', error.message); setLoading(false); return }

        const mapped: ClienteRow[] = (data ?? []).map(c => ({
          ...c,
          profile: Array.isArray(c.profile) ? c.profile[0] : c.profile,
        }))

        if (mapped.length > 0) {
          const ids = mapped.map(c => c.id)
          const hace7d = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]
          const hace90d = new Date(Date.now() - 90 * 86_400_000).toISOString().split('T')[0]

          const [checkinsRes, dietasRes, entrenosRes, tareasRes, chatsRes, comidasRes, sesionesRes, chatCoachRes] = await Promise.all([
            supabase.from('checkins').select('cliente_id, fecha, peso').in('cliente_id', ids).gte('fecha', hace90d).order('fecha', { ascending: false }),
            supabase.from('planes_nutricion').select('cliente_id').in('cliente_id', ids).eq('activo', true),
            supabase.from('planes_entrenamiento').select('cliente_id').in('cliente_id', ids).eq('activo', true),
            supabase.from('agente_tareas').select('cliente_id').in('cliente_id', ids).eq('estado', 'pendiente'),
            supabase.from('chat_mensajes').select('cliente_id').in('cliente_id', ids).eq('remitente', 'cliente').eq('leido', false),
            supabase.from('registro_comidas_dia').select('cliente_id').in('cliente_id', ids).gte('fecha', hace7d).in('estado', ['hecha', 'cambiada']),
            supabase.from('registros_entreno').select('cliente_id').in('cliente_id', ids).gte('fecha', hace7d),
            supabase.from('chat_mensajes').select('cliente_id').in('cliente_id', ids).eq('remitente', 'coach').gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString()),
          ])

          const ultimoCheckin = new Map<string, string>()
          const tienePeso7d = new Set<string>()
          for (const ch of checkinsRes.data ?? []) {
            if (!ultimoCheckin.has(ch.cliente_id)) ultimoCheckin.set(ch.cliente_id, ch.fecha)
            if (ch.peso && ch.fecha >= hace7d) tienePeso7d.add(ch.cliente_id)
          }

          const dietasActivas = new Set(((dietasRes.data ?? []) as PlanRow[]).map(p => p.cliente_id))
          const entrenosActivos = new Set(((entrenosRes.data ?? []) as PlanRow[]).map(p => p.cliente_id))

          const tareasPor = new Map<string, number>()
          for (const t of (tareasRes.data ?? []) as TareaRow[]) {
            if (t.cliente_id) tareasPor.set(t.cliente_id, (tareasPor.get(t.cliente_id) ?? 0) + 1)
          }

          const chatsSinLeer = new Map<string, number>()
          for (const m of chatsRes.data ?? []) {
            chatsSinLeer.set(m.cliente_id, (chatsSinLeer.get(m.cliente_id) ?? 0) + 1)
          }

          const comidasHecha = new Map<string, number>()
          for (const r of comidasRes.data ?? []) {
            comidasHecha.set(r.cliente_id, (comidasHecha.get(r.cliente_id) ?? 0) + 1)
          }

          const sesionesComp = new Map<string, number>()
          for (const s of sesionesRes.data ?? []) {
            sesionesComp.set(s.cliente_id, (sesionesComp.get(s.cliente_id) ?? 0) + 1)
          }

          const interaccionesCoach = new Map<string, number>()
          for (const m of chatCoachRes.data ?? []) {
            interaccionesCoach.set(m.cliente_id, (interaccionesCoach.get(m.cliente_id) ?? 0) + 1)
          }

          const ahora = Date.now()
          for (const c of mapped) {
            const fechaCheck = ultimoCheckin.get(c.id)
            c.ultimo_checkin = fechaCheck ?? null
            c.dias_sin_checkin = fechaCheck ? Math.floor((ahora - new Date(fechaCheck).getTime()) / 86_400_000) : 999
            c.tiene_dieta_activa = dietasActivas.has(c.id)
            c.tiene_entreno_activo = entrenosActivos.has(c.id)
            c.tareas_ia_pendientes = tareasPor.get(c.id) ?? 0
            c.chats_sin_leer = chatsSinLeer.get(c.id) ?? 0
            c.comidas_hecha_7d = comidasHecha.get(c.id) ?? 0
            c.sesiones_completadas_7d = sesionesComp.get(c.id) ?? 0
            c.tiene_peso_7d = tienePeso7d.has(c.id)
            c.interacciones_coach_7d = interaccionesCoach.get(c.id) ?? 0
            c.score_adherencia = calcularScoreAdherencia(c)
            c.deuda_atencion = calcularDeudaAtencion(c)
          }
          // predictor baja necesita score_adherencia calculado
          for (const c of mapped) {
            c.es_predictor_baja = esPredictorBaja(c)
          }
        }

        setClientes(mapped)
      } catch (e) {
        console.error('[clientes] error:', e)
      }
      setLoading(false)
    }
    load()
  }, [])

  const hoy = Date.now()

  const counts: ToolbarCounts = useMemo(() => ({
    total: clientes.length,
    atencion: clientes.filter(c => c.revisado_por_coach === false || (c.tareas_ia_pendientes ?? 0) > 0 || (c.dias_sin_checkin ?? 0) > 4).length,
    nuevos: clientes.filter(c => c.revisado_por_coach === false).length,
    riesgo: clientes.filter(c => (c.dias_sin_checkin ?? 0) > 10).length,
    sin_checkin: clientes.filter(c => (c.dias_sin_checkin ?? 0) > 4).length,
    activos: clientes.filter(c => c.activo).length,
    caduca_pronto: clientes.filter(c => { const d = diasHastaCaducidad(c); return d !== null && d <= 30 }).length,
    chats_sin_leer: clientes.filter(c => (c.chats_sin_leer ?? 0) > 0).length,
    revisiones_proximas: clientes.filter(c => {
      if (!c.fecha_proxima_revision) return false
      const d = Math.floor((new Date(c.fecha_proxima_revision).getTime() - hoy) / 86_400_000)
      return d >= 0 && d <= 14
    }).length,
  }), [clientes, hoy])

  const filtrados = useMemo(() =>
    aplicarSort(
      aplicarFiltros(clientes, filtro, busquedaDebounced, caducaPronte, filtroAlta, filtroRevisiones, filtroChats),
      sort
    ),
    [clientes, filtro, busquedaDebounced, caducaPronte, filtroAlta, filtroRevisiones, filtroChats, sort]
  )

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 mb-5">
        {/* Back button — visible en móvil */}
        <Link
          href="/dashboard"
          className="lg:hidden flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={16} />
          <span>Dashboard</span>
        </Link>

        <div className="hidden lg:block">
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text)' }}>Clientes</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInvitar}
            className="btn-secondary btn-sm"
            disabled={invitando === 'loading'}
          >
            {invitando === 'loading' ? <SpinnerGap size={14} className="animate-spin" /> : invitando === 'done' ? <Check size={14} /> : <LinkIcon size={14} />}
            <span className="hidden sm:inline">{invitando === 'done' ? 'Copiado' : 'Invitar'}</span>
          </button>
          <Link href="/clientes/nuevo" className="btn-primary btn-sm">
            <Plus size={14} />
            <span className="hidden sm:inline">Nuevo</span>
          </Link>
        </div>
      </header>

      {/* Toolbar */}
      <ClientesToolbar
        busqueda={busqueda} onBusqueda={setBusqueda}
        filtro={filtro} onFiltro={setFiltro}
        caducaPronte={caducaPronte} onCaducaPronte={setCaducaPronte}
        filtroAlta={filtroAlta} onFiltroAlta={setFiltroAlta}
        filtroRevisiones={filtroRevisiones} onFiltroRevisiones={setFiltroRevisiones}
        filtroChats={filtroChats} onFiltroChats={setFiltroChats}
        sort={sort} onSort={setSort}
        counts={counts}
      />

      {/* Lista */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl p-3 flex items-center gap-3 animate-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="w-7 h-7 rounded-lg skeleton flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 skeleton rounded w-40" />
                <div className="h-2 skeleton rounded w-56 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl text-center py-16" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <UsersThree size={42} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-semibold" style={{ color: 'var(--text)' }}>No hay clientes en este filtro</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Cambia el filtro o añade un nuevo cliente.</p>
          <Link href="/clientes/nuevo" className="btn-primary mt-4"><Plus size={16} /> Añadir cliente</Link>
        </div>
      ) : (
        <>
          {/* Desktop: tabla */}
          <div className="hidden lg:block">
            <ClientesTabla clientes={filtrados} sort={sort} onSort={setSort} />
          </div>
          {/* Mobile: lista */}
          <div className="lg:hidden">
            <ClientesListaMobile clientes={filtrados} />
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript y build**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep -E "clientes/page|clientes-utils"
```

Esperado: sin errores.

- [ ] **Step 3: Smoke test manual**

Abrir `npm run dev`, navegar a `/clientes`, verificar:
- Toolbar compacto visible con búsqueda estrecha
- Tabla visible en pantalla ancha
- En DevTools → responsive iPhone: lista vertical + back button

- [ ] **Step 4: Commit**

```bash
git add app/clientes/page.tsx
git commit -m "feat: rewrite /clientes — tabla densa + mobile list + todos los filtros"
```

---

## Task 7: Editor membresía en ficha cliente

**Files:**
- Modify: `app/clientes/[id]/page.tsx`

El objetivo es añadir 3 campos editables (tipo_membresia, fecha_inicio_membresia, fecha_fin_membresia) en la tab de **Perfil** existente de la ficha cliente, junto a los demás campos editables.

- [ ] **Step 1: Localizar dónde se renderiza la tab 'perfil' y añadir los campos**

Buscar el bloque `tabActiva === 'perfil'` en `app/clientes/[id]/page.tsx`. Dentro de `ClienteEditar` o del form de perfil, añadir los 3 campos tras los campos existentes.

Primero verificar si `ClienteEditar` acepta los nuevos campos:

```bash
grep -n "tipo_membresia\|fecha_inicio\|fecha_fin\|tipo_memb" /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach/components/ClienteEditar.tsx | head -5
```

Si no los tiene, añadirlos directamente en el bloque de perfil de `[id]/page.tsx` como un mini-formulario separado. Buscar la sección de la tab perfil:

```bash
grep -n "tabActiva === 'perfil'\|'perfil'" /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach/app/clientes/\[id\]/page.tsx | head -5
```

- [ ] **Step 2: Añadir state para membresía y los campos del form**

Dentro del componente `ClienteDetallePage`, añadir después de los estados existentes:

```typescript
const [membresiaEdit, setMembresiaEdit] = useState({
  tipo: cliente?.tipo_membresia ?? '',
  inicio: cliente?.fecha_inicio_membresia ?? '',
  fin: cliente?.fecha_fin_membresia ?? '',
})
const [guardandoMembresia, setGuardandoMembresia] = useState(false)

async function guardarMembresia() {
  setGuardandoMembresia(true)
  const { error } = await supabase
    .from('clientes')
    .update({
      tipo_membresia: membresiaEdit.tipo || null,
      fecha_inicio_membresia: membresiaEdit.inicio || null,
      fecha_fin_membresia: membresiaEdit.fin || null,
    })
    .eq('id', id)
  setGuardandoMembresia(false)
  if (!error) toast.success('Membresía guardada')
  else toast.error('Error al guardar')
}
```

Nota: `cliente` es el estado de tipo `Cliente` del componente, `id` es el `useParams().id`, `toast` es `useToast()` ya importado.

- [ ] **Step 3: Añadir UI de membresía en la sección perfil**

Localizar el bloque `tabActiva === 'perfil'` y añadir al final del contenido del tab, antes del cierre `</div>`:

```typescript
{/* Membresía */}
<div className="rounded-2xl p-4 mt-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
  <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>Membresía</h3>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div>
      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Tipo</label>
      <select
        className="input w-full text-sm"
        value={membresiaEdit.tipo}
        onChange={e => setMembresiaEdit(p => ({ ...p, tipo: e.target.value }))}
      >
        <option value="">Sin asignar</option>
        <option value="trimestral">Trimestral</option>
        <option value="semestral">Semestral</option>
        <option value="anual">Anual</option>
      </select>
    </div>
    <div>
      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Fecha inicio</label>
      <input
        type="date"
        className="input w-full text-sm"
        value={membresiaEdit.inicio}
        onChange={e => setMembresiaEdit(p => ({ ...p, inicio: e.target.value }))}
      />
    </div>
    <div>
      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Fecha fin</label>
      <input
        type="date"
        className="input w-full text-sm"
        value={membresiaEdit.fin}
        onChange={e => setMembresiaEdit(p => ({ ...p, fin: e.target.value }))}
      />
    </div>
  </div>
  <button
    onClick={guardarMembresia}
    disabled={guardandoMembresia}
    className="btn-primary btn-sm mt-3"
  >
    {guardandoMembresia ? <Loader2 size={14} className="animate-spin" /> : null}
    Guardar membresía
  </button>
</div>
```

- [ ] **Step 4: Inicializar membresiaEdit cuando cargue el cliente**

Buscar el `useEffect` que carga el cliente y añadir al final:

```typescript
setMembresiaEdit({
  tipo: data.tipo_membresia ?? '',
  inicio: data.fecha_inicio_membresia ?? '',
  fin: data.fecha_fin_membresia ?? '',
})
```

Asegurarse de que el select `clientes` en ese useEffect incluya los nuevos campos:
```typescript
.select('... , tipo_membresia, fecha_inicio_membresia, fecha_fin_membresia')
```

- [ ] **Step 5: Verificar TypeScript y build**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep "clientes/\[id\]"
```

- [ ] **Step 6: Commit**

```bash
git add app/clientes/\[id\]/page.tsx
git commit -m "feat: membresía editable en ficha cliente (tipo + fechas)"
```

---

## Task 8: Agente de retención

**Files:**
- Create: `lib/agentes/agente-retencion.ts`

- [ ] **Step 1: Crear el agente**

```typescript
// lib/agentes/agente-retencion.ts
// ================================================================
// AGENTE RETENCIÓN
// Detecta clientes en riesgo de baja o no renovar la membresía
// y propone acciones al coach. Se ejecuta diariamente.
// ================================================================

import { llamarDeepSeek, cargarContextoCliente, guardarTareaAgente } from './executor'
import { createServiceSupabase } from '@/lib/supabase-server'

const SYSTEM_PROMPT = `Eres el agente de Retención de NutriCoach.

Tu misión: detectar clientes que pueden abandonar el programa o no renovar su membresía, y proponer al coach una acción concreta y personalizada.

SEÑALES DE RIESGO DE BAJA:
- Membresía que caduca en ≤30 días sin renovación conocida
- Score de adherencia < 40 durante varios días
- Sin respuesta a mensajes del coach en >5 días
- Primera semana de membresía sin check-in (cliente nuevo sin enganchar)
- Plateau de peso >3 semanas + adherencia alta (frustración silenciosa)

ACCIONES POSIBLES:
- Mensaje de re-enganche personalizado (menciona su progreso real)
- Oferta de renovación (menciona el beneficio conseguido hasta ahora)
- Propuesta de ajuste de plan (si hay plateau o desmotivación)
- Alerta urgente: recomendar que el coach llame por teléfono

REGLAS:
- Máximo UNA acción propuesta por cliente, la más urgente
- Nunca duplicar una tarea de retención pendiente
- Personalizar con datos reales: nombre, kg perdidos, semanas activo, objetivo

OUTPUT JSON:
{
  "señal_principal": "caduca_pronto|baja_adherencia|sin_respuesta|nuevo_sin_enganche|plateau_frustrado",
  "accion": "mensaje|oferta_renovacion|ajuste_plan|alerta_llamada",
  "propuesta": "texto exacto que el coach usaría (max 3 frases, personalizado)",
  "razonamiento": "por qué esta acción ahora (max 80 palabras)",
  "urgencia": número 1-10,
  "requiere_aprobacion": true
}`

export async function ejecutarAgenteRetencion(clienteId: string): Promise<void> {
  const ctx = await cargarContextoCliente(clienteId)
  if (!ctx) return

  // Solo actuar si hay al menos una señal de riesgo
  const señales = detectarSenales(ctx)
  if (señales.length === 0) return

  const db = createServiceSupabase()

  // Evitar duplicados
  const { data: existente } = await db
    .from('agente_tareas')
    .select('id')
    .eq('cliente_id', clienteId)
    .eq('tipo', 'retencion')
    .eq('estado', 'pendiente')
    .limit(1)

  if (existente?.length) return

  const prompt = construirPrompt(ctx, señales)
  let raw: string
  try {
    raw = await llamarDeepSeek(prompt, 0.3)
  } catch (e) {
    console.error('[retencion] Error llamando DeepSeek:', e)
    return
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[retencion] JSON inválido:', raw.slice(0, 200))
    return
  }

  await guardarTareaAgente({
    cliente_id: clienteId,
    agente: 'retencion',
    tipo: 'retencion',
    titulo: `Retención: ${parsed.señal_principal ?? 'riesgo detectado'}`,
    contenido: parsed.propuesta as string ?? '',
    metadata: parsed,
    prioridad: (parsed.urgencia as number) >= 7 ? 'alta' : 'media',
    requiere_aprobacion: true,
  })
}

function detectarSenales(ctx: Awaited<ReturnType<typeof cargarContextoCliente>>): string[] {
  if (!ctx) return []
  const señales: string[] = []
  const diasSinCheckin = ctx.diasSinCheckin ?? 0
  const membresiaFin = ctx.cliente?.fecha_fin_membresia

  if (membresiaFin) {
    const diasHasta = Math.floor((new Date(membresiaFin).getTime() - Date.now()) / 86_400_000)
    if (diasHasta >= 0 && diasHasta <= 30) señales.push('caduca_pronto')
  }

  if (diasSinCheckin > 10) señales.push('baja_adherencia')

  // Primera semana sin check-in
  const createdAt = ctx.cliente?.created_at
  if (createdAt) {
    const diasAlta = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
    if (diasAlta <= 7 && diasSinCheckin >= diasAlta) señales.push('nuevo_sin_enganche')
  }

  return señales
}

function construirPrompt(
  ctx: NonNullable<Awaited<ReturnType<typeof cargarContextoCliente>>>,
  señales: string[]
): string {
  const nombre = ctx.cliente?.nombre ?? 'Cliente'
  const objetivo = ctx.cliente?.objetivo ?? 'no especificado'
  const diasSinCheckin = ctx.diasSinCheckin ?? 0

  return `${SYSTEM_PROMPT}

CLIENTE: ${nombre}
OBJETIVO: ${objetivo}
DÍAS SIN CHECK-IN: ${diasSinCheckin}
SEÑALES DETECTADAS: ${señales.join(', ')}
MEMBRESÍA FIN: ${ctx.cliente?.fecha_fin_membresia ?? 'no registrada'}
PLAN ACTIVO: ${ctx.tienePlanNutricion ? 'sí' : 'no'}

Genera la propuesta de retención más adecuada.`
}
```

- [ ] **Step 2: Verificar que `llamarDeepSeek` existe en executor**

```bash
grep -n "llamarDeepSeek\|export.*DeepSeek" /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach/lib/agentes/executor.ts | head -5
```

Si la función se llama diferente (ej: `llamarDeepseekV3`), ajustar el import en el agente.

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep agente-retencion
```

- [ ] **Step 4: Commit**

```bash
git add lib/agentes/agente-retencion.ts
git commit -m "feat: agente-retencion — detecta riesgo baja y propone acciones al coach"
```

---

## Task 9: Conectar agente en orquestador + director

**Files:**
- Modify: `lib/agentes/orquestador.ts`
- Modify: `lib/agentes/director.ts`

- [ ] **Step 1: Añadir `'retencion'` al tipo `PasoDirector` en `orquestador.ts`**

```typescript
// En lib/agentes/orquestador.ts
// Cambiar:
export type PasoDirector =
  | 'perfil_aprendizaje'
  | 'perfil_gusto'
  | 'riesgo_nutricion'
  | 'riesgo_entreno'
  | 'readiness'
  | 'supercoach'
  | 'revisor_semanal'
  | 'revisor_semanal_entreno'
  | 'motivacion'

// Por:
export type PasoDirector =
  | 'perfil_aprendizaje'
  | 'perfil_gusto'
  | 'riesgo_nutricion'
  | 'riesgo_entreno'
  | 'readiness'
  | 'supercoach'
  | 'revisor_semanal'
  | 'revisor_semanal_entreno'
  | 'motivacion'
  | 'retencion'
```

- [ ] **Step 2: Añadir `retencion` al objeto `ejecutar` en `crearPlanDirectorCliente`**

Localizar el bloque `const ejecutar: Record<PasoDirector, boolean> = {` y añadir:

```typescript
retencion: true, // siempre ejecutar diariamente
```

- [ ] **Step 3: Importar y llamar el agente en `director.ts`**

Añadir el import al inicio del archivo (después de los imports existentes):

```typescript
import { ejecutarAgenteRetencion } from './agente-retencion'
```

Añadir la llamada en el bucle de clientes, después de la línea con `riesgo_nutricion`:

```typescript
if (plan.ejecutar.retencion) await ejecutarAgenteRetencion(id)
```

- [ ] **Step 4: Verificar TypeScript completo**

```bash
npx tsc --noEmit --pretty false 2>&1 | head -20
```

Esperado: 0 errores.

- [ ] **Step 5: Build de producción**

```bash
npm run build 2>&1 | tail -10
```

Esperado: build exitoso sin errores.

- [ ] **Step 6: Commit final**

```bash
git add lib/agentes/orquestador.ts lib/agentes/director.ts
git commit -m "feat: conectar agente-retencion al director — ejecuta diariamente por cliente"
```

---

## Verificación final

- [ ] Abrir `/clientes` en desktop: tabla con columnas Membresía, Check-in, Adherencia, Estado
- [ ] Abrir `/clientes` en mobile (DevTools iPhone): lista vertical + `← Dashboard` arriba
- [ ] Búsqueda: escribir nombre de un cliente → se filtra sin solapar la lupa el texto
- [ ] Filtro "Caduca pronto": aparece/desaparece correctamente
- [ ] Abrir ficha cliente `/clientes/[id]` → tab Perfil → sección Membresía con 3 campos
- [ ] Asignar membresía "Trimestral" + fechas a un cliente de prueba → volver a `/clientes` → ver la barra de progreso
- [ ] `npx tsc --noEmit --pretty false` → 0 errores

---

## Notas

- **Stripe (fase futura):** cuando se implemente, los campos `tipo_membresia`, `fecha_inicio_membresia`, `fecha_fin_membresia` se poblarán automáticamente desde webhooks. No habrá migración de datos.
- **`llamarDeepSeek` en executor:** verificar el nombre exacto de la función antes de ejecutar Task 8. Podría ser `llamarDeepseekV3` o similar.
- **`.superpowers/`:** añadir a `.gitignore` si no está ya.
