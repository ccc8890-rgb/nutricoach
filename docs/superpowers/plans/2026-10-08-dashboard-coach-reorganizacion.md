# Dashboard del coach — reorganización visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir el dashboard de 13 bloques en dos pestañas por una pantalla única: 3 tarjetas «Hoy», 4 cifras, 6 accesos y un «Más detalle» plegado.

**Architecture:** La lógica que decide qué mostrar en las 3 tarjetas es una función pura testeable (`lib/dashboard/hoy.ts`). La UI se parte en componentes pequeños en `components/dashboard/`. Los subcomponentes antiguos de listas se mueven tal cual (extraídos con `sed` desde git) al bloque plegado. Sin cambios de API.

**Tech Stack:** Next.js (versión personalizada, ver `node_modules/next/dist/docs/` antes de tocar APIs de Next), React client components, Tailwind + variables CSS del proyecto, `@phosphor-icons/react`, tests con `npx tsx` + `node:assert`.

**Spec:** `docs/superpowers/specs/2026-10-08-dashboard-coach-reorganizacion-design.md`

## Global Constraints

- Solo variables CSS del proyecto (`var(--surface)`, `--surface-hover`, `--surface-elevated`, `--border`, `--text`, `--error`, `--error-bg`, `--warning`, `--warning-bg`, `--success`, `--success-bg`, `--info`, `--info-bg`); nada de colores fijos nuevos. Debe verse bien en modo claro y oscuro.
- Mobile-first: 1 columna en móvil, cifras 2×2, accesos 3×2; sin scroll horizontal a 390 px.
- No tocar `app/api/dashboard/*` ni ninguna página destino.
- Iconos solo de `@phosphor-icons/react`. Texto de interfaz en español de España.
- No usar `&&` con números que pueden ser 0 (`{n > 0 && ...}`, nunca `{n && ...}`).
- Commits: añadir solo las rutas propias con `git add <ruta>` (hay otros cambios sin commitear en el repo que NO son de esta tarea: `.gitignore`, `skills-lock.json`, `scripts/`, `salidas/`).
- Mensaje de commit termina con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- `command.hoy` vacío y `inbox_ia`/`clientes_riesgo` vacíos → «Todo al día», no tres tarjetas a 0.
- Falla `/api/dashboard/negocio` pero command-center va bien → tarjetas Hoy intactas; cifras de negocio muestran «—» con «Reintentar».
- Falla command-center → error con «Reintentar» en lugar de las tarjetas, sin romper la página.
- Más de 3 casos en una tarjeta → se muestran 3 y el total real sigue siendo el número grande.
- Valores 0 en `checkins_pendientes` + `respuestas_pendientes` no deben pintar «0» suelto ni texto roto.

## File Structure

- Create `lib/dashboard/tipos.ts` — tipos de las respuestas de las APIs (movidos de `page.tsx`).
- Create `lib/dashboard/hoy.ts` — `resumirHoy()` pura.
- Create `scripts/dashboard-hoy.test.ts` — test de `resumirHoy`.
- Create `components/dashboard/comun.tsx` — helpers y piezas compartidas (extraídos de `page.tsx`).
- Create `components/dashboard/HoyCards.tsx`, `NumerosClave.tsx`, `Accesos.tsx`, `DetalleColapsable.tsx`.
- Modify `app/dashboard/page.tsx` — reescrito (≈120 líneas).

---

### Task 1: Tipos y lógica pura de las tarjetas «Hoy»

**Files:**
- Create: `lib/dashboard/tipos.ts`
- Create: `lib/dashboard/hoy.ts`
- Test: `scripts/dashboard-hoy.test.ts`

**Interfaces:**
- Produces: `CommandData`, `NegocioData`, `CosteCliente`, `TodayAction`, `ClienteRiesgo`, `InboxIa`, `Competicion`, `Severity` (de `tipos.ts`); `Tono`, `CasoHoy`, `TarjetaHoy`, `ResumenHoy`, `resumirHoy(c: CommandData): ResumenHoy` (de `hoy.ts`).

- [ ] **Step 1: Extraer los tipos**

Crear `lib/dashboard/tipos.ts` con las líneas 25-150 de `app/dashboard/page.tsx` actual, quitando `type Tab` y poniendo `export` a cada tipo:

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
mkdir -p lib/dashboard components/dashboard
git show HEAD:app/dashboard/page.tsx | sed -n '25p;28,150p' | sed 's/^type /export type /' > lib/dashboard/tipos.ts
```

Comprobar que el fichero empieza por `export type Severity = ...` y que NO contiene `Tab`.

- [ ] **Step 2: Escribir el test que falla**

`scripts/dashboard-hoy.test.ts`:

```ts
import assert from 'node:assert/strict'
import { resumirHoy } from '../lib/dashboard/hoy'
import type { CommandData } from '../lib/dashboard/tipos'

const base: CommandData = {
  hoy: [],
  clientes_riesgo: [],
  inbox_ia: [],
  operacion: {
    clientes_activos: 4, planes_nutricion_activos: 4, planes_entreno_activos: 4,
    checkins_pendientes: 0, revisiones_7d: 0, revisiones_30d: 0, membresias_30d: 0, respuestas_pendientes: 0,
  },
  competiciones: [],
  timestamp: '2026-10-08T00:00:00Z',
}

// Todo vacío → todo al día, tonos ok
const vacio = resumirHoy(base)
assert.equal(vacio.todoAlDia, true)
assert.deepEqual(vacio.tarjetas.map(t => [t.id, t.total, t.tono]), [['checkins', 0, 'ok'], ['riesgo', 0, 'ok'], ['ia', 0, 'ok']])

// Check-ins: total = checkins + respuestas; casos solo de tipo checkin/respuesta, máximo 3; crítico si algún caso lo es
const accion = (id: string, tipo: string, severity: 'critica' | 'alta' | 'media' | 'baja') => ({
  id, tipo, title: `t-${id}`, cliente_id: 'c', cliente_nombre: `N-${id}`, detail: 'd', meta: 'm', severity, href: `/h/${id}`, cta: 'Abrir',
})
const conCheckins = resumirHoy({
  ...base,
  operacion: { ...base.operacion, checkins_pendientes: 5, respuestas_pendientes: 2 },
  hoy: [accion('1', 'checkin', 'media'), accion('2', 'plan', 'critica'), accion('3', 'respuesta', 'critica'), accion('4', 'checkin', 'baja'), accion('5', 'checkin', 'baja')],
})
const tc = conCheckins.tarjetas.find(t => t.id === 'checkins')!
assert.equal(tc.total, 7)
assert.equal(tc.casos.length, 3)
assert.deepEqual(tc.casos.map(c => c.id), ['1', '3', '4'])
assert.equal(tc.tono, 'critico')
assert.equal(conCheckins.todoAlDia, false)

// Check-ins sin casos críticos → pendiente
const soloPend = resumirHoy({ ...base, operacion: { ...base.operacion, checkins_pendientes: 1 }, hoy: [accion('9', 'checkin', 'media')] })
assert.equal(soloPend.tarjetas[0].tono, 'pendiente')

// Riesgo: crítico si hay alguno 'alto', pendiente si solo medio; máximo 3 casos con la acción como detalle
const riesgo = (n: string, r: 'alto' | 'medio' | 'bajo') => ({ cliente_id: n, cliente_nombre: n, riesgo: r, score: 1, signals: [], accion: `acc-${n}`, href: `/clientes/${n}` })
const rAlto = resumirHoy({ ...base, clientes_riesgo: [riesgo('a', 'medio'), riesgo('b', 'alto'), riesgo('c', 'bajo'), riesgo('d', 'bajo')] })
const tr = rAlto.tarjetas.find(t => t.id === 'riesgo')!
assert.equal(tr.total, 4)
assert.equal(tr.tono, 'critico')
assert.equal(tr.casos.length, 3)
assert.equal(tr.casos[0].detalle, 'acc-a')
assert.equal(tr.casos[0].href, '/clientes/a')
assert.equal(resumirHoy({ ...base, clientes_riesgo: [riesgo('a', 'medio')] }).tarjetas[1].tono, 'pendiente')

// IA: detalle = tipo con espacios; href de la tarea
const ia = resumirHoy({
  ...base,
  inbox_ia: [{ id: 'x', tipo: 'actualizacion_plan', agente: 'a', prioridad: 1, propuesta: null, cliente_id: 'c', cliente_nombre: 'Ana', href: '/clientes', created_at: '' }],
})
const ti = ia.tarjetas.find(t => t.id === 'ia')!
assert.equal(ti.total, 1)
assert.equal(ti.tono, 'pendiente')
assert.deepEqual(ti.casos[0], { id: 'x', titulo: 'Ana', detalle: 'actualizacion plan', href: '/clientes' })
assert.equal(ti.href, '/entrenos/brain-ia')

console.log('dashboard-hoy: OK')
```

- [ ] **Step 3: Ejecutar y ver que falla**

Run: `npx tsx scripts/dashboard-hoy.test.ts`
Expected: FAIL (`Cannot find module '../lib/dashboard/hoy'`).

- [ ] **Step 4: Implementar `lib/dashboard/hoy.ts`**

```ts
import type { CommandData } from './tipos'

export type Tono = 'critico' | 'pendiente' | 'ok'

export type CasoHoy = { id: string; titulo: string; detalle: string; href: string }

export type TarjetaHoy = {
  id: 'checkins' | 'riesgo' | 'ia'
  titulo: string
  total: number
  tono: Tono
  href: string
  casos: CasoHoy[]
}

export type ResumenHoy = { tarjetas: TarjetaHoy[]; todoAlDia: boolean }

const MAX_CASOS = 3

function tonoDe(total: number, critico: boolean): Tono {
  if (total === 0) return 'ok'
  return critico ? 'critico' : 'pendiente'
}

export function resumirHoy(c: CommandData): ResumenHoy {
  const accionesCheckin = c.hoy.filter(a => a.tipo === 'checkin' || a.tipo === 'respuesta')
  const totalCheckins = c.operacion.checkins_pendientes + c.operacion.respuestas_pendientes

  const checkins: TarjetaHoy = {
    id: 'checkins',
    titulo: 'Check-ins por revisar',
    total: totalCheckins,
    tono: tonoDe(totalCheckins, accionesCheckin.some(a => a.severity === 'critica')),
    href: '/clientes',
    casos: accionesCheckin.slice(0, MAX_CASOS).map(a => ({ id: a.id, titulo: a.cliente_nombre, detalle: a.title, href: a.href })),
  }

  const riesgo: TarjetaHoy = {
    id: 'riesgo',
    titulo: 'Clientes en riesgo',
    total: c.clientes_riesgo.length,
    tono: tonoDe(c.clientes_riesgo.length, c.clientes_riesgo.some(r => r.riesgo === 'alto')),
    href: '/clientes',
    casos: c.clientes_riesgo.slice(0, MAX_CASOS).map(r => ({ id: r.cliente_id, titulo: r.cliente_nombre, detalle: r.accion, href: r.href })),
  }

  const ia: TarjetaHoy = {
    id: 'ia',
    titulo: 'Listo para aprobar (IA)',
    total: c.inbox_ia.length,
    tono: tonoDe(c.inbox_ia.length, false),
    href: '/entrenos/brain-ia',
    casos: c.inbox_ia.slice(0, MAX_CASOS).map(t => ({ id: t.id, titulo: t.cliente_nombre, detalle: t.tipo.replaceAll('_', ' '), href: t.href })),
  }

  const tarjetas = [checkins, riesgo, ia]
  return { tarjetas, todoAlDia: tarjetas.every(t => t.total === 0) }
}
```

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `npx tsx scripts/dashboard-hoy.test.ts`
Expected: `dashboard-hoy: OK`

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard/tipos.ts lib/dashboard/hoy.ts scripts/dashboard-hoy.test.ts
git commit -m "feat(dashboard): lógica pura de las tarjetas Hoy con test

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Piezas compartidas y tarjetas «Hoy»

**Files:**
- Create: `components/dashboard/comun.tsx`
- Create: `components/dashboard/HoyCards.tsx`

**Interfaces:**
- Consumes: `ResumenHoy`, `TarjetaHoy`, `Tono` de `@/lib/dashboard/hoy`.
- Produces: de `comun.tsx`: `DASHBOARD_MUTED`, `DASHBOARD_SECONDARY` (string), `fetchJson<T>(url): Promise<T>`, `formatEuro(n: number): string`, `formatDate(d: string | null | undefined): string`, `SkeletonRows({rows?})`, `SectionHeader({icon,title,meta?,href?,linkLabel?})`, `EmptyState({title,actionHref?,actionLabel?})`, `ErrorState({message,onRetry})`. De `HoyCards.tsx`: `HoyCards({ resumen: ResumenHoy | null, loading: boolean })`.

- [ ] **Step 1: Extraer helpers de la página actual**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
{
cat <<'EOF'
'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle, Warning } from '@phosphor-icons/react'

EOF
git show HEAD:app/dashboard/page.tsx | sed -n '159,192p;206,268p'
} | sed -E 's/^const DASHBOARD/export const DASHBOARD/; s/^async function/export async function/; s/^function /export function /' > components/dashboard/comun.tsx
```

Comprobar con `grep -n "^export" components/dashboard/comun.tsx`: deben salir `DASHBOARD_MUTED`, `DASHBOARD_SECONDARY`, `fetchJson`, `formatEuro`, `formatDate`, `SkeletonRows`, `SectionHeader`, `EmptyState`, `ErrorState`.

- [ ] **Step 2: Crear `components/dashboard/HoyCards.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { ArrowRight, Brain, CheckCircle, ClipboardText, Warning } from '@phosphor-icons/react'
import type { ResumenHoy, Tono } from '@/lib/dashboard/hoy'
import { DASHBOARD_MUTED, DASHBOARD_SECONDARY } from './comun'

const TONO: Record<Tono, { color: string; bg: string }> = {
  critico: { color: 'var(--error)', bg: 'var(--error-bg)' },
  pendiente: { color: 'var(--warning)', bg: 'var(--warning-bg)' },
  ok: { color: 'var(--success)', bg: 'var(--success-bg)' },
}

const ICONO = { checkins: ClipboardText, riesgo: Warning, ia: Brain } as const

export default function HoyCards({ resumen, loading }: { resumen: ResumenHoy | null; loading: boolean }) {
  if (loading || !resumen) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map(i => <div key={i} className="h-52 rounded-2xl skeleton" />)}
      </div>
    )
  }

  if (resumen.todoAlDia) {
    return (
      <div className="rounded-2xl border px-6 py-10 text-center" style={{ borderColor: 'var(--success)', background: 'var(--success-bg)' }}>
        <CheckCircle size={36} weight="fill" className="mx-auto mb-3" style={{ color: 'var(--success)' }} />
        <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>Todo al día</p>
        <p className="mt-1 text-sm" style={{ color: DASHBOARD_SECONDARY }}>No hay check-ins, riesgos ni propuestas pendientes.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {resumen.tarjetas.map(t => {
        const tono = TONO[t.tono]
        const Icon = ICONO[t.id]
        return (
          <section key={t.id} className="flex flex-col rounded-2xl border p-4" style={{ borderColor: t.total > 0 ? tono.color : 'var(--border)', background: 'var(--surface)' }}>
            <Link href={t.href} className="mb-3 flex items-start justify-between gap-3 active:scale-[0.99]">
              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <Icon size={15} weight="fill" style={{ color: tono.color }} />
                  <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>{t.titulo}</h2>
                </div>
                <p className="text-[11px]" style={{ color: DASHBOARD_MUTED }}>{t.total > 0 ? 'Toca para ver todos' : 'Nada pendiente'}</p>
              </div>
              <p className="font-data text-5xl font-semibold leading-none" style={{ color: tono.color }}>{t.total}</p>
            </Link>
            <div className="mt-auto space-y-1.5">
              {t.casos.map(caso => (
                <Link key={caso.id} href={caso.href} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 active:scale-[0.99]" style={{ background: 'var(--surface-hover)' }}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{caso.titulo}</p>
                    <p className="truncate text-[11px]" style={{ color: DASHBOARD_MUTED }}>{caso.detalle}</p>
                  </div>
                  <ArrowRight size={12} className="flex-shrink-0" style={{ color: DASHBOARD_MUTED }} />
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Comprobar tipos**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep -E "components/dashboard/(comun|HoyCards)|lib/dashboard" || echo "sin errores en ficheros nuevos"`
Expected: `sin errores en ficheros nuevos`

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/comun.tsx components/dashboard/HoyCards.tsx
git commit -m "feat(dashboard): tarjetas Hoy y piezas compartidas

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Cifras clave y accesos

**Files:**
- Create: `components/dashboard/NumerosClave.tsx`
- Create: `components/dashboard/Accesos.tsx`

**Interfaces:**
- Consumes: `CommandData`, `NegocioData` de `@/lib/dashboard/tipos`; `formatEuro`, `DASHBOARD_MUTED`, `DASHBOARD_SECONDARY` de `./comun`; `supabase` de `@/lib/supabase`.
- Produces: `NumerosClave({ operacion, negocio, loading, negocioError, onRetry })` con `operacion: CommandData['operacion'] | null`, `negocio: NegocioData | null`, `loading: boolean`, `negocioError: string | null`, `onRetry: () => void`; `Accesos()` sin props.

- [ ] **Step 1: Crear `NumerosClave.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { CreditCard, Warning } from '@phosphor-icons/react'
import type { CommandData, NegocioData } from '@/lib/dashboard/tipos'
import { DASHBOARD_MUTED, formatEuro } from './comun'

type Props = {
  operacion: CommandData['operacion'] | null
  negocio: NegocioData | null
  loading: boolean
  negocioError: string | null
  onRetry: () => void
}

export default function NumerosClave({ operacion, negocio, loading, negocioError, onRetry }: Props) {
  const dash = '—'
  const tiles = [
    { label: 'Clientes activos', value: operacion ? String(operacion.clientes_activos) : dash, href: '/clientes' },
    { label: 'Ingresos del mes', value: negocio ? formatEuro(negocio.resumen.ingresos_mes_actual) : dash, href: '/clientes' },
    { label: 'MRR estimado', value: negocio ? formatEuro(negocio.resumen.mrr_estimado) : dash, href: '/clientes' },
    { label: 'Renuevan en 7 días', value: negocio ? String(negocio.resumen.membresias_7d) : dash, href: '/clientes' },
  ]
  const pagos = negocio ? negocio.pagos_pendientes.length : 0
  const sinMembresia = negocio ? negocio.resumen.clientes_sin_membresia : 0

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(t => (
          <Link key={t.label} href={t.href} className="rounded-2xl border p-4 active:scale-[0.99]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <p className="text-[11px] font-medium" style={{ color: DASHBOARD_MUTED }}>{t.label}</p>
            {loading ? <div className="mt-2 h-8 w-20 rounded-lg skeleton" /> : (
              <p className="font-data mt-1 text-3xl font-semibold" style={{ color: 'var(--text)' }}>{t.value}</p>
            )}
          </Link>
        ))}
      </div>

      {negocioError && !loading && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border px-3 py-2" style={{ borderColor: 'var(--error)', background: 'var(--error-bg)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--error)' }}>No se pudieron cargar los datos de negocio</p>
          <button type="button" onClick={onRetry} className="text-xs font-semibold active:scale-95" style={{ color: 'var(--text)' }}>Reintentar</button>
        </div>
      )}

      {(pagos > 0 || sinMembresia > 0) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {pagos > 0 && (
            <Link href="/clientes" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>
              <CreditCard size={13} weight="fill" /> {pagos} {pagos === 1 ? 'pago pendiente' : 'pagos pendientes'}
            </Link>
          )}
          {sinMembresia > 0 && (
            <Link href="/clientes" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
              <Warning size={13} weight="fill" /> {sinMembresia} sin membresía
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Crear `Accesos.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BowlFood, FilmSlate, Barbell, ListChecks, UserPlus, Users } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'

export default function Accesos() {
  const [recetasPendientes, setRecetasPendientes] = useState(0)

  useEffect(() => {
    supabase
      .from('recetas')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'en_revision')
      .then(({ count }) => setRecetasPendientes(count ?? 0))
  }, [])

  const items = [
    { label: 'Nuevo cliente', href: '/clientes/nuevo', icon: UserPlus, badge: 0 },
    { label: 'Clientes', href: '/clientes', icon: Users, badge: 0 },
    { label: 'Revisar recetas', href: '/recetas/revisar', icon: ListChecks, badge: recetasPendientes },
    { label: 'Contenido', href: '/contenido', icon: FilmSlate, badge: 0 },
    { label: 'Dietas', href: '/dietas', icon: BowlFood, badge: 0 },
    { label: 'Entrenos', href: '/entrenos', icon: Barbell, badge: 0 },
  ]

  return (
    <section className="grid grid-cols-3 gap-2 sm:gap-3">
      {items.map(({ label, href, icon: Icon, badge }) => (
        <Link key={label} href={href} className="relative flex flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-4 text-center active:scale-[0.97]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <Icon size={24} weight="duotone" style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>{label}</span>
          {badge > 0 && (
            <span className="font-data absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>{badge}</span>
          )}
        </Link>
      ))}
    </section>
  )
}
```

Si `FilmSlate`, `BowlFood` o `Barbell` no existen en la versión instalada de `@phosphor-icons/react`, `tsc` lo dirá en el Step 3: sustituir por `Clapperboard`-equivalente (`VideoCamera`), `ForkKnife` (ya usado en el proyecto) y `Pulse` (ya usado).

- [ ] **Step 3: Comprobar tipos**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep -E "components/dashboard/(NumerosClave|Accesos)" || echo "sin errores en ficheros nuevos"`
Expected: `sin errores en ficheros nuevos`

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/NumerosClave.tsx components/dashboard/Accesos.tsx
git commit -m "feat(dashboard): cifras clave y accesos rápidos

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Bloque plegado, página nueva y verificación

**Files:**
- Create: `components/dashboard/DetalleColapsable.tsx`
- Modify (reescribir entero): `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: todo lo de las tareas 1-3.
- Produces: `DetalleColapsable({ command, costes, negocio, loading })` con `command: CommandData | null`, `costes: CosteCliente[]`, `negocio: NegocioData | null`, `loading: boolean`.

- [ ] **Step 1: Montar `DetalleColapsable.tsx` moviendo los subcomponentes antiguos**

Los subcomponentes `FoodCostFriction`, `SportsCalendarStrip`, `RenewalsTable`, `PaymentIssuesList` y `TransactionsTable` se copian tal cual desde git (líneas 465-500, 502-528, 555-576, 578-596 y 598-616 del `page.tsx` actual, a HEAD):

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
{
cat <<'EOF'
'use client'

import Link from 'next/link'
import { ArrowRight, CreditCard, CurrencyEur, ForkKnife, Receipt, Repeat, Trophy } from '@phosphor-icons/react'
import type { CommandData, CosteCliente, NegocioData } from '@/lib/dashboard/tipos'
import { DASHBOARD_MUTED, EmptyState, SectionHeader, SkeletonRows, formatDate, formatEuro } from './comun'

EOF
git show HEAD:app/dashboard/page.tsx | sed -n '465,500p;502,528p;555,576p;578,596p;598,616p'
cat <<'EOF'

type Props = {
  command: CommandData | null
  costes: CosteCliente[]
  negocio: NegocioData | null
  loading: boolean
}

export default function DetalleColapsable({ command, costes, negocio, loading }: Props) {
  return (
    <details className="group rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-bold" style={{ color: 'var(--text)' }}>
        Más detalle
        <span className="text-xs font-medium" style={{ color: DASHBOARD_MUTED }}>Calendario, costes, renovaciones, pagos y transacciones</span>
      </summary>
      <div className="grid gap-5 px-4 pb-5 lg:grid-cols-2">
        <section>
          <SectionHeader icon={Trophy} title="Calendario deportivo" />
          {loading || !command ? <SkeletonRows rows={3} /> : <SportsCalendarStrip competiciones={command.competiciones} />}
        </section>
        <section>
          <SectionHeader icon={ForkKnife} title="Coste y fricción alimentaria" href="/precios/escandallo" linkLabel="Abrir escandallo" />
          {loading ? <SkeletonRows rows={3} /> : <FoodCostFriction costes={costes} />}
        </section>
        <section>
          <SectionHeader icon={Repeat} title="Renovaciones" href="/clientes" linkLabel="Ver clientes" />
          {!negocio ? <SkeletonRows rows={3} /> : <RenewalsTable rows={negocio.renovaciones} />}
        </section>
        <section>
          <SectionHeader icon={CreditCard} title="Pagos pendientes" href="/clientes" linkLabel="Ver clientes" />
          {!negocio ? <SkeletonRows rows={3} /> : <PaymentIssuesList rows={negocio.pagos_pendientes} />}
        </section>
        <section className="lg:col-span-2">
          <SectionHeader icon={Receipt} title="Transacciones recientes" />
          {!negocio ? <SkeletonRows rows={3} /> : <TransactionsTable rows={negocio.transacciones_recientes} />}
        </section>
        {negocio && (
          <section className="grid gap-3 sm:grid-cols-4 lg:col-span-2">
            {([
              ['Nuevos sin pago', negocio.embudo.nuevos_sin_pago],
              ['Links/pagos creados', negocio.embudo.links_generados],
              ['Pagos completados', negocio.embudo.pagos_completados],
              ['Clientes activados', negocio.embudo.clientes_activados],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
                <p className="text-xs" style={{ color: DASHBOARD_MUTED }}>{label}</p>
                <p className="font-data mt-1 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{value}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </details>
  )
}
EOF
} > components/dashboard/DetalleColapsable.tsx
```

Después, `npx tsc --noEmit --pretty false 2>&1 | grep DetalleColapsable`. Si aparecen imports sin usar (`ArrowRight`, `Link` ya los usan los subcomponentes movidos; `CurrencyEur` no se usa) quitar solo los que `tsc`/eslint marquen como no usados (`npx eslint components/dashboard/DetalleColapsable.tsx`).

- [ ] **Step 2: Reescribir `app/dashboard/page.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Accesos from '@/components/dashboard/Accesos'
import DetalleColapsable from '@/components/dashboard/DetalleColapsable'
import HoyCards from '@/components/dashboard/HoyCards'
import NumerosClave from '@/components/dashboard/NumerosClave'
import { DASHBOARD_MUTED, ErrorState, fetchJson } from '@/components/dashboard/comun'
import { resumirHoy } from '@/lib/dashboard/hoy'
import type { CommandData, CosteCliente, NegocioData } from '@/lib/dashboard/tipos'

export default function DashboardPage() {
  const [command, setCommand] = useState<CommandData | null>(null)
  const [costes, setCostes] = useState<CosteCliente[]>([])
  const [negocio, setNegocio] = useState<NegocioData | null>(null)
  const [commandLoading, setCommandLoading] = useState(true)
  const [negocioLoading, setNegocioLoading] = useState(true)
  const [commandError, setCommandError] = useState<string | null>(null)
  const [negocioError, setNegocioError] = useState<string | null>(null)

  const loadCommand = useCallback(async () => {
    setCommandLoading(true)
    setCommandError(null)
    try {
      const [commandData, costesData] = await Promise.all([
        fetchJson<CommandData>('/api/dashboard/command-center'),
        fetchJson<{ costes: CosteCliente[] }>('/api/dashboard/costes-clientes').catch(() => ({ costes: [] })),
      ])
      setCommand(commandData)
      setCostes(costesData.costes ?? [])
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : 'No se pudo cargar el panel')
    } finally {
      setCommandLoading(false)
    }
  }, [])

  const loadNegocio = useCallback(async () => {
    setNegocioLoading(true)
    setNegocioError(null)
    try {
      setNegocio(await fetchJson<NegocioData>('/api/dashboard/negocio'))
    } catch (error) {
      setNegocioError(error instanceof Error ? error.message : 'No se pudo cargar negocio')
    } finally {
      setNegocioLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCommand()
    loadNegocio()
  }, [loadCommand, loadNegocio])

  const resumen = useMemo(() => (command ? resumirHoy(command) : null), [command])
  const totalPendiente = resumen ? resumen.tarjetas.reduce((sum, t) => sum + t.total, 0) : 0
  const fecha = useMemo(() => (
    new Date().toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })
  ), [])

  return (
    <main className="flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <p className="mb-1 text-xs capitalize" style={{ color: DASHBOARD_MUTED }}>{fecha}</p>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            {commandLoading || !resumen ? 'Hoy' : totalPendiente > 0 ? `Hoy tienes ${totalPendiente} ${totalPendiente === 1 ? 'cosa' : 'cosas'} por revisar` : 'Hoy, todo al día'}
          </h1>
        </header>

        {commandError ? <ErrorState message={commandError} onRetry={loadCommand} /> : <HoyCards resumen={resumen} loading={commandLoading} />}

        <NumerosClave
          operacion={command?.operacion ?? null}
          negocio={negocio}
          loading={commandLoading || negocioLoading}
          negocioError={negocioError}
          onRetry={loadNegocio}
        />

        <Accesos />

        <DetalleColapsable command={command} costes={costes} negocio={negocio} loading={commandLoading} />

        {command?.timestamp && (
          <p className="pb-4 text-center text-[10px]" style={{ color: DASHBOARD_MUTED }}>
            Actualizado {new Date(command.timestamp).toLocaleString('es-ES')}
          </p>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Verificación estática**

Run, en este orden:
```bash
npx tsx scripts/dashboard-hoy.test.ts
npx tsc --noEmit --pretty false
npx eslint app/dashboard/page.tsx components/dashboard lib/dashboard
npm run build
```
Expected: `dashboard-hoy: OK`; `tsc` sin errores; eslint sin errores nuevos; build correcto (si falla solo por descargar Google Fonts, reintentar: es de red, no del código).

- [ ] **Step 4: Verificación visual (con Carlos)**

Levantar `npm run dev` y abrir con `browse --headed` en `http://localhost:3000/dashboard`; Carlos inicia sesión él mismo en la ventana (handoff, nunca construir cookies a mano). Comprobar con capturas:
1. Ancho de Mac: 3 tarjetas en fila, 4 cifras en fila, 6 accesos en 3×2, «Más detalle» cerrado.
2. 390 px: una columna, cifras 2×2, sin scroll horizontal.
3. Modo claro y oscuro: texto legible en tarjetas con borde ámbar/rojo.
4. Abrir «Más detalle»: calendario, costes, renovaciones, pagos, transacciones y embudo cargan.
5. Pulsar un caso de cada tarjeta y comprobar que abre la ficha correcta.

- [ ] **Step 5: Commit y push**

```bash
git add app/dashboard/page.tsx components/dashboard/DetalleColapsable.tsx
git commit -m "feat(dashboard): pantalla única con Hoy, cifras, accesos y detalle plegado

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push origin main
```
(Carlos prueba recargando la webapp en Vercel; sin migraciones de BD. Si el push muestra «Changes must be made through a pull request», comprobar con `git branch -r --contains HEAD`.)

- [ ] **Step 6: Documentar**

Añadir al principio de `NUTRICION/CLAUDE.md` una entrada breve «SESIÓN 08-10-2026 — Dashboard del coach reorganizado» (qué cambia, ficheros, que `app/dashboard/page.tsx` pasó de 825 líneas a ~100) y commitear solo ese fichero.
