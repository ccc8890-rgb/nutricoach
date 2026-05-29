# Training OS F1 — Session Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir PR automático, sugerencia de peso desde historial y rediseño de vista semanal para que el cliente pueda seguir su entreno con retroalimentación real de progreso.

**Architecture:** La página de ejecución (`app/cliente/sesion/[id]/page.tsx`) ya existe y es funcional — la ampliamos con dos APIs nuevas (historial de pesos + PRs en el save). La vista semanal (`SemanaEntrenoCard`) se rediseña para enlazar a la sesión y mostrar progreso. La tabla `registros_sets` y vista `prs_por_ejercicio` están en `supabase_training_redesign_v1.sql` — hay que aplicarlas primero.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + RLS), TypeScript, Tailwind CSS / CSS vars

---

## ⚠️ Paso 0 (manual, antes de empezar): Aplicar migración en Supabase

Antes de cualquier código, aplicar en Supabase → SQL Editor:

```
nutricoach/supabase_training_redesign_v1.sql
```

Este archivo crea:
- `registros_sets` table con `sets_ejecutados jsonb`
- `prs_por_ejercicio` view (ya corregida por `fix_prs_por_ejercicio_v2.sql`)
- Columnas `instruccion_coach`, `fase_bloque`, `duracion_estimada_min` en `sesiones_entrenamiento` y `plantilla_sesiones`
- RLS policies para `registros_sets`

Verificar que no hay errores. Si algún ALTER falla por columna existente, ignorar — son `IF NOT EXISTS`.

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Crear | `app/api/entrenos/historial-pesos/route.ts` |
| Modificar | `app/api/entrenos/registrar-sesion/route.ts` |
| Modificar | `app/cliente/sesion/[id]/page.tsx` |
| Modificar | `components/training/SemanaEntrenoCard.tsx` |
| Modificar | `types/index.ts` (añadir `PRDetectado`) |

---

## Task 1: Tipo `PRDetectado` en types/index.ts

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Añadir interfaz al final de `types/index.ts`**

Añadir estas líneas al final del archivo (antes del último `export`):

```typescript
export interface PRDetectado {
  ejercicio_id: string
  ejercicio_nombre: string
  peso_anterior_kg: number | null
  peso_nuevo_kg: number
  reps: number
}

export interface HistorialPesoEjercicio {
  ejercicio_id: string
  ultimo_peso_kg: number | null
  ultima_fecha: string | null
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat(training-os): tipos PRDetectado e HistorialPesoEjercicio"
```

---

## Task 2: API historial de pesos por ejercicio

**Files:**
- Create: `app/api/entrenos/historial-pesos/route.ts`

Esta API devuelve el último peso registrado por ejercicio para el cliente autenticado. La sesión la usa para pre-cargar el campo "carga" con el peso real de la última vez (en lugar del `peso_sugerido` de la plantilla).

- [ ] **Step 1: Crear el archivo**

```typescript
// app/api/entrenos/historial-pesos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const ejercicioIds = searchParams.get('ejercicio_ids')
  if (!ejercicioIds) return NextResponse.json({ pesos: [] })

  const ids = ejercicioIds.split(',').filter(Boolean)
  if (!ids.length) return NextResponse.json({ pesos: [] })

  const admin = createServiceSupabase()

  const { data: clienteData } = await admin
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!clienteData) return NextResponse.json({ pesos: [] })

  // Para cada ejercicio, buscar el último set registrado con peso
  const { data: registros } = await admin
    .from('registros_sets')
    .select('ejercicio_id, sets_ejecutados, fecha')
    .eq('cliente_id', clienteData.id)
    .in('ejercicio_id', ids)
    .order('fecha', { ascending: false })

  if (!registros) return NextResponse.json({ pesos: [] })

  // Agrupar por ejercicio — quedarnos con el registro más reciente
  const porEjercicio = new Map<string, { peso: number | null; fecha: string }>()

  for (const reg of registros) {
    if (porEjercicio.has(reg.ejercicio_id)) continue // ya tenemos el más reciente

    const sets = (reg.sets_ejecutados as Array<{ peso_kg?: number; reps?: number }>) ?? []
    const pesosValidos = sets
      .map(s => typeof s.peso_kg === 'number' ? s.peso_kg : null)
      .filter((p): p is number => p !== null && p > 0)

    const ultimoPeso = pesosValidos.length > 0
      ? pesosValidos[pesosValidos.length - 1] // el último set registrado
      : null

    porEjercicio.set(reg.ejercicio_id, { peso: ultimoPeso, fecha: reg.fecha })
  }

  const pesos = ids.map(id => ({
    ejercicio_id: id,
    ultimo_peso_kg: porEjercicio.get(id)?.peso ?? null,
    ultima_fecha: porEjercicio.get(id)?.fecha ?? null,
  }))

  return NextResponse.json({ pesos })
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit 2>&1 | grep -E "historial-pesos|error" | head -10
```

Esperado: sin errores en ese archivo.

- [ ] **Step 3: Commit**

```bash
git add app/api/entrenos/historial-pesos/route.ts
git commit -m "feat(training-os): API historial pesos por ejercicio"
```

---

## Task 3: Detectar PRs en registrar-sesion

**Files:**
- Modify: `app/api/entrenos/registrar-sesion/route.ts`

Tras guardar los `registros_sets`, comparar los pesos máximos de esta sesión con `prs_por_ejercicio` y devolver la lista de PRs nuevos.

- [ ] **Step 1: Localizar el return final del archivo (actualmente línea ~75)**

El archivo termina con:

```typescript
  return NextResponse.json({
    ok: true,
    registros: insertedRows?.length ?? rows.length,
    fecha,
  })
```

- [ ] **Step 2: Reemplazar el return con detección de PRs**

Reemplazar ese bloque final por:

```typescript
  // Detectar PRs: comparar peso máximo de esta sesión con prs_por_ejercicio
  const ejercicioIds = ejercicios.map(e => e.ejercicio_id).filter(Boolean)
  let prs: Array<{ ejercicio_id: string; ejercicio_nombre: string; peso_anterior_kg: number | null; peso_nuevo_kg: number; reps: number }> = []

  if (ejercicioIds.length > 0) {
    // PRs anteriores
    const { data: prsPrevios } = await admin
      .from('prs_por_ejercicio')
      .select('ejercicio_id, peso_max_kg, reps_en_pr')
      .eq('cliente_id', cliente_id)
      .in('ejercicio_id', ejercicioIds)

    const prMap = new Map<string, { peso: number; reps: number }>(
      (prsPrevios ?? []).map(p => [p.ejercicio_id, { peso: p.peso_max_kg, reps: p.reps_en_pr }])
    )

    // Nombres de ejercicios
    const { data: ejerciciosData } = await admin
      .from('ejercicios')
      .select('id, nombre')
      .in('id', ejercicioIds)

    const nombreMap = new Map<string, string>(
      (ejerciciosData ?? []).map(e => [e.id, e.nombre])
    )

    for (const ej of ejercicios) {
      if (!ej.ejercicio_id || !ej.sets_ejecutados?.length) continue

      const pesosEjercicio = ej.sets_ejecutados
        .map((s: { peso_kg?: number; reps?: number }) => ({ peso: s.peso_kg ?? 0, reps: s.reps ?? 0 }))
        .filter(s => s.peso > 0)

      if (!pesosEjercicio.length) continue

      const maxSet = pesosEjercicio.reduce((best, s) => s.peso > best.peso ? s : best, pesosEjercicio[0])
      const prPrevio = prMap.get(ej.ejercicio_id)

      // Es PR si supera el peso máximo anterior (o si no había PR)
      if (!prPrevio || maxSet.peso > prPrevio.peso) {
        prs.push({
          ejercicio_id: ej.ejercicio_id,
          ejercicio_nombre: nombreMap.get(ej.ejercicio_id) ?? ej.ejercicio_id,
          peso_anterior_kg: prPrevio?.peso ?? null,
          peso_nuevo_kg: maxSet.peso,
          reps: maxSet.reps,
        })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    registros: insertedRows?.length ?? rows.length,
    fecha,
    prs,
  })
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit 2>&1 | grep -E "registrar-sesion|error" | head -10
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/api/entrenos/registrar-sesion/route.ts
git commit -m "feat(training-os): detección PRs en registrar-sesion"
```

---

## Task 4: Sugerencia de peso histórico + PRs en página de sesión

**Files:**
- Modify: `app/cliente/sesion/[id]/page.tsx`

Dos cambios:
1. Tras cargar la sesión, fetch del historial de pesos y pre-cargar los campos `carga` con el último peso real
2. Tras guardar, si hay PRs, mostrarlos en la pantalla de finalización

- [ ] **Step 1: Localizar `loadSesion` y el init de sets (aprox línea 82-100)**

Buscar el bloque:

```typescript
    // Init set state for each exercise
    const setsInit: Record<string, SetState[]> = {}
    for (const ej of ejerciciosSorted) {
      setsInit[ej.id] = Array.from({ length: ej.series ?? 3 }, () => ({
        reps: '',
        carga: ej.peso_sugerido ?? '',
        hecho: false,
      }))
    }
```

- [ ] **Step 2: Reemplazar el bloque de init para usar historial real**

```typescript
    // Fetch historial de pesos reales (última sesión) para pre-cargar carga
    const ejIds = ejerciciosSorted
      .map(e => e.ejercicio?.id)
      .filter((id): id is string => Boolean(id))

    let pesoHistorial: Record<string, number | null> = {}
    if (ejIds.length > 0) {
      try {
        const res = await fetch(`/api/entrenos/historial-pesos?ejercicio_ids=${ejIds.join(',')}`)
        if (res.ok) {
          const data = await res.json()
          for (const item of data.pesos ?? []) {
            pesoHistorial[item.ejercicio_id] = item.ultimo_peso_kg
          }
        }
      } catch {
        // silent — fallback a peso_sugerido
      }
    }

    // Init set state: usar historial si existe, sino peso_sugerido de la plantilla
    const setsInit: Record<string, SetState[]> = {}
    for (const ej of ejerciciosSorted) {
      const pesoReal = ej.ejercicio?.id ? pesoHistorial[ej.ejercicio.id] : null
      const cargaInicial = pesoReal !== null && pesoReal !== undefined
        ? String(pesoReal)
        : ej.peso_sugerido ?? ''
      setsInit[ej.id] = Array.from({ length: ej.series ?? 3 }, () => ({
        reps: '',
        carga: cargaInicial,
        hecho: false,
      }))
    }
```

- [ ] **Step 3: Añadir estado de PRs al componente**

Localizar el bloque de estados al inicio del componente (cerca de `const [showCompletion, setShowCompletion]`) y añadir:

```typescript
  const [prsDetectados, setPrsDetectados] = useState<Array<{
    ejercicio_id: string
    ejercicio_nombre: string
    peso_anterior_kg: number | null
    peso_nuevo_kg: number
    reps: number
  }>>([])
```

- [ ] **Step 4: Actualizar `guardarSesion` para capturar PRs**

Localizar la función `guardarSesion`. Buscar:

```typescript
      await fetch('/api/entrenos/registrar-sesion', {
```

Y actualizar el bloque de llamada + resultado:

```typescript
      const res = await fetch('/api/entrenos/registrar-sesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sesion_id: id,
          ejercicios: ejerciciosPayload,
          duracion_sesion_s,
          esfuerzo_percibido: esfuerzoPercibido ?? undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.prs?.length) setPrsDetectados(data.prs)
      }
      setGuardadoOk(true)
```

- [ ] **Step 5: Mostrar PRs en pantalla de finalización**

En la pantalla de completion (buscar `¡Sesión completada!`), añadir la sección de PRs justo después del bloque de stats (`{/* Stats */}`):

```typescript
        {/* PRs detectados */}
        {prsDetectados.length > 0 && (
          <div className="w-full max-w-xs mb-4">
            <p className="text-xs uppercase tracking-wide mb-2 text-center" style={{ color: 'var(--text-muted)' }}>
              🏅 Nuevos récords personales
            </p>
            <div className="flex flex-col gap-2">
              {prsDetectados.map(pr => (
                <div
                  key={pr.ejercicio_id}
                  className="rounded-xl px-4 py-2.5 flex justify-between items-center"
                  style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}
                >
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {pr.ejercicio_nombre}
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-bold" style={{ color: 'rgb(251,191,36)' }}>
                      {pr.peso_nuevo_kg} kg
                    </span>
                    {pr.peso_anterior_kg && (
                      <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                        (+{(pr.peso_nuevo_kg - pr.peso_anterior_kg).toFixed(1)})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
```

- [ ] **Step 6: Verificar que compila**

```bash
npx tsc --noEmit 2>&1 | grep -E "sesion/\[id\]|error" | head -10
```

Esperado: sin errores.

- [ ] **Step 7: Commit**

```bash
git add "app/cliente/sesion/[id]/page.tsx"
git commit -m "feat(training-os): peso histórico + PRs en ejecución de sesión"
```

---

## Task 5: Rediseño SemanaEntrenoCard con enlace a sesión

**Files:**
- Modify: `components/training/SemanaEntrenoCard.tsx`

El objetivo es añadir un botón "▶ Empezar" en la sesión del día que enlace a `/cliente/sesion/[id]`, y añadir barra de progreso del plan.

- [ ] **Step 1: Añadir import de `Link` y `Play` si no existen**

Al inicio del archivo, verificar que hay:

```typescript
import Link from 'next/link'
import { ChevronRight, Dumbbell, Zap, CheckCircle2, Loader2, Play } from 'lucide-react'
```

Si `Play` no está en la importación de lucide-react, añadirlo.

- [ ] **Step 2: Localizar el render de cada sesión**

Buscar el bloque donde se renderizan las sesiones (habrá un `.map` sobre `sesionesOrdenadas`). Dentro del map, localizar la card de la sesión de hoy (la que tiene `isHoy` o similar lógica de día actual).

- [ ] **Step 3: Añadir botón ▶ Empezar para la sesión de hoy**

Dentro del render de la sesión, donde se calcula si es hoy (`dia_semana === TODAY_NAME`), añadir el botón:

```typescript
{sesion.dia_semana === TODAY_NAME && !completadasHoy.has(sesion.id) && (
  <Link
    href={`/cliente/sesion/${sesion.id}`}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
    style={{ background: 'rgba(168,85,247,0.9)', color: 'white' }}
    onClick={e => e.stopPropagation()}
  >
    <Play size={12} />
    Empezar
  </Link>
)}
```

- [ ] **Step 4: Verificar que compila**

```bash
npx tsc --noEmit 2>&1 | grep -E "SemanaEntrenoCard|error" | head -10
```

Esperado: sin errores.

- [ ] **Step 5: Build final para verificar todo el proyecto**

```bash
npm run build 2>&1 | tail -20
```

Esperado: build exitoso, 0 errores.

- [ ] **Step 6: Commit final**

```bash
git add components/training/SemanaEntrenoCard.tsx
git commit -m "feat(training-os): F1 completo — PR automático + peso histórico + botón empezar sesión"
```

---

## Task 6: Push a producción

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Verificar deploy en Vercel**

Abrir [nutricoach-delta.vercel.app](https://nutricoach-delta.vercel.app) tras el deploy.

- [ ] **Step 3: Smoke test**

1. Iniciar sesión como cliente
2. Ir a Mi Plan → pestaña entrenamiento
3. Verificar que aparece botón "▶ Empezar" en la sesión de hoy
4. Abrir la sesión → verificar que los campos de carga muestran el peso de la última sesión (o el sugerido si no hay historial)
5. Completar un ejercicio con un peso superior al anterior → guardar → verificar que aparece la sección 🏅 con el PR

---

## Resumen F1

| Tarea | Estado |
|-------|--------|
| Migration `registros_sets` + `prs_por_ejercicio` en Supabase | Manual |
| API `GET /api/entrenos/historial-pesos` | Task 2 |
| PR detection en `registrar-sesion` | Task 3 |
| Peso histórico + PRs en página sesión | Task 4 |
| Botón "▶ Empezar" en `SemanaEntrenoCard` | Task 5 |

**Siguiente fase → F2:** Contexto IA (generación de texto en semana + sesión + ejercicio). Plan en `docs/superpowers/plans/2026-05-31-training-os-f2-contexto-ia.md` — se escribirá tras completar F1.
