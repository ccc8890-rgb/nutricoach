# Training OS F3 — Dashboard Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar `/entrenos` con dots de cumplimiento semanal por cliente y alerta de fatiga, para que el coach vea el estado de todos sus clientes de un vistazo.

**Architecture:** Nueva API `GET /api/entrenos/resumen-coach` devuelve para cada cliente activo: 7 dots (Lun-Dom de la semana actual) indicando si entrenó ese día, número de sesiones en 7 días y flag de fatiga (≥5 sesiones/7d = sin días de descanso). La página `/entrenos/page.tsx` consume esta API y añade los dots + badge fatiga a cada fila del plan.

**Tech Stack:** Next.js App Router, Supabase (`registros_sets` tabla), TypeScript, Tailwind / CSS vars

---

## Contexto de la arquitectura existente

- `/entrenos/page.tsx` — lista planes del coach con stats básicos (total30d, ultima, activo7d). Ya carga `registros_sets` para los últimos 30 días.
- `registros_sets` — tabla con columnas `cliente_id`, `fecha` (date string YYYY-MM-DD). Una fila por ejercicio por sesión.
- La semana actual se calcula desde el lunes (ISO week): `(hoy.getDay() + 6) % 7` da el índice del día (0=Lun, 6=Dom).
- Fatiga: si el cliente tiene `registros_sets` en ≥5 días distintos en los últimos 7 días → badge rojo "Fatiga".

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Crear | `app/api/entrenos/resumen-coach/route.ts` |
| Modificar | `app/entrenos/page.tsx` |

---

## Task 1: API GET /api/entrenos/resumen-coach

**Files:**
- Create: `app/api/entrenos/resumen-coach/route.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceSupabase()

  // Todos los planes activos del coach
  const { data: planes } = await admin
    .from('planes_entrenamiento')
    .select('cliente_id')
    .eq('coach_id', user.id)
    .eq('activo', true)

  const clienteIds = (planes ?? []).map(p => p.cliente_id).filter(Boolean) as string[]
  if (!clienteIds.length) return NextResponse.json({ clientes: [] })

  // Calcular lunes de esta semana ISO
  const hoy = new Date()
  const dayOfWeek = (hoy.getDay() + 6) % 7 // 0=Lun, 6=Dom
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - dayOfWeek)
  const lunesStr = lunes.toISOString().split('T')[0]

  // Calcular hace 7 días
  const hace7d = new Date(hoy)
  hace7d.setDate(hoy.getDate() - 6)
  const hace7dStr = hace7d.toISOString().split('T')[0]

  // Sesiones de esta semana y últimos 7 días
  const { data: registros } = await admin
    .from('registros_sets')
    .select('cliente_id, fecha')
    .in('cliente_id', clienteIds)
    .gte('fecha', hace7dStr)

  // Agrupar por cliente
  const porCliente = new Map<string, Set<string>>()
  for (const cid of clienteIds) porCliente.set(cid, new Set())
  for (const r of registros ?? []) {
    if (r.cliente_id && r.fecha) porCliente.get(r.cliente_id)?.add(r.fecha)
  }

  const result = clienteIds.map(cid => {
    const fechas = porCliente.get(cid) ?? new Set<string>()

    // Dots de la semana actual (Lun a Dom)
    const dots: boolean[] = Array.from({ length: 7 }, (_, i) => {
      const dia = new Date(lunes)
      dia.setDate(lunes.getDate() + i)
      const diaStr = dia.toISOString().split('T')[0]
      return fechas.has(diaStr)
    })

    // Sesiones en los últimos 7 días (días distintos)
    const sesiones7d = fechas.size

    // Fatiga: ≥5 días distintos en 7 días = sin descanso suficiente
    const fatiga = sesiones7d >= 5

    return { cliente_id: cid, dots, sesiones7d, fatiga }
  })

  return NextResponse.json({ clientes: result })
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit 2>&1 | grep -E "resumen-coach|error TS" | head -10
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/api/entrenos/resumen-coach/route.ts
git commit -m "feat(training-os): API resumen coach — dots cumplimiento semanal + fatiga"
```

---

## Task 2: Actualizar /entrenos/page.tsx con dots + badge fatiga

**Files:**
- Modify: `app/entrenos/page.tsx`

Lee el archivo completo antes de editar.

- [ ] **Step 1: Añadir tipo `ResumenCliente` e importar `useEffect` si no está**

Añadir cerca de los tipos existentes:

```typescript
type ResumenCliente = {
  cliente_id: string
  dots: boolean[]      // 7 elementos: Lun-Dom
  sesiones7d: number
  fatiga: boolean
}
```

- [ ] **Step 2: Añadir estado `resumen`**

Junto a los otros `useState`:

```typescript
const [resumen, setResumen] = useState<Map<string, ResumenCliente>>(new Map())
```

- [ ] **Step 3: Cargar el resumen en el `useEffect`**

Dentro de la función `load()` del `useEffect`, después del `setStats(map)`, añadir:

```typescript
      // Cargar resumen semanal
      const resRes = await fetch('/api/entrenos/resumen-coach')
      if (resRes.ok) {
        const resData = await resRes.json()
        const resMap = new Map<string, ResumenCliente>()
        for (const c of resData.clientes ?? []) resMap.set(c.cliente_id, c)
        setResumen(resMap)
      }
```

- [ ] **Step 4: Añadir los días de la semana para el header de dots**

Justo antes del `return (` del componente, añadir:

```typescript
  const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  const HOY_DOT = (new Date().getDay() + 6) % 7 // índice 0=Lun del día actual
```

- [ ] **Step 5: Mostrar dots + badge fatiga en cada fila**

Localizar en el JSX el bloque de stats de cada plan (la sección `{s && (...)}` que muestra `activo7d`, `diasDesde`, `total30d`). Reemplazar ese bloque completo con:

```typescript
                <div className="hidden md:flex items-center gap-3">
                  {p.activo && (() => {
                    const r = p.cliente_id ? resumen.get(p.cliente_id) : undefined
                    return (
                      <>
                        {/* Dots Lun-Dom */}
                        <div className="flex items-center gap-1">
                          {DIAS_SEMANA.map((d, i) => {
                            const completado = r?.dots[i] ?? false
                            const esHoy = i === HOY_DOT
                            return (
                              <div key={d} className="flex flex-col items-center gap-0.5">
                                <span className="text-[9px]" style={{ color: 'var(--text-muted)', opacity: esHoy ? 1 : 0.5 }}>{d}</span>
                                <div
                                  className="w-2.5 h-2.5 rounded-full transition-all"
                                  style={{
                                    background: completado
                                      ? 'rgb(168,85,247)'
                                      : esHoy
                                      ? 'rgba(168,85,247,0.2)'
                                      : 'var(--border)',
                                    boxShadow: completado ? '0 0 4px rgba(168,85,247,0.5)' : 'none',
                                  }}
                                />
                              </div>
                            )
                          })}
                        </div>
                        {/* Badge fatiga */}
                        {r?.fatiga && (
                          <span className="badge text-[10px] px-1.5 py-0.5" style={{ background: 'rgba(239,68,68,0.1)', color: 'rgb(239,68,68)', border: '1px solid rgba(239,68,68,0.3)' }}>
                            Fatiga
                          </span>
                        )}
                        {/* Última sesión */}
                        {s?.ultima && (
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {diasDesde(s.ultima)}
                          </span>
                        )}
                      </>
                    )
                  })()}
                  {!p.activo && s?.ultima && (
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{diasDesde(s.ultima)}</span>
                  )}
                  <span className={`badge ${p.activo ? 'badge-green' : 'badge-gray'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span>
                </div>
```

**NOTA:** Si `s` (stats del cliente) no está disponible en ese scope, adaptar accediendo a `stats[p.cliente_id ?? '']`.

- [ ] **Step 6: Verificar TypeScript + Build**

```bash
npx tsc --noEmit 2>&1 | grep -E "entrenos/page|error TS" | head -10
npm run build 2>&1 | tail -15
```

Build debe pasar con 0 errores.

- [ ] **Step 7: Commit**

```bash
git add app/entrenos/page.tsx
git commit -m "feat(training-os): F3 dashboard coach — dots cumplimiento semanal + badge fatiga"
```

---

## Task 3: Push a producción

- [ ] **Step 1: Push**

```bash
git push origin main
```

---

## Resultado esperado

En `/entrenos`, cada fila de plan activo muestra:
- **7 dots Lun-Dom** — púrpura brillante si entrenó ese día, gris si no, con tinte púrpura tenue en el día actual
- **Badge "Fatiga"** rojo — si el cliente entrenó ≥5 días distintos en los últimos 7 días
- **"Última sesión"** — texto relativo (Hoy / Ayer / Hace N días)

Los planes inactivos solo muestran badge gris + última sesión.

**Siguiente fase → F4:** Constructor de plantillas drag-drop + biblioteca de ejercicios con media.
