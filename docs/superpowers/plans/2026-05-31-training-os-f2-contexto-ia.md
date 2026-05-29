# Training OS F2 — Contexto IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir contexto IA en sesión y ejercicio — el coach escribe una nota breve y la IA genera un párrafo de "porqué" que aparece al cliente durante la ejecución.

**Architecture:** Nueva columna `contexto_ia` en `sesiones_entrenamiento` y `sesion_ejercicios`. Un endpoint `POST /api/entrenos/generar-contexto` llama a DeepSeek con el perfil del atleta + datos Garmin + nota del coach y guarda el texto generado. El coach acciona la generación desde el editor `/entrenos/[id]`. El cliente ve el contexto en la página de sesión y en el card semanal.

**Tech Stack:** Next.js App Router, Supabase, DeepSeek (`deepseek-chat` via `llamarDeepSeek` de `lib/agentes/executor.ts`), TypeScript, Tailwind / CSS vars

---

## Contexto de la arquitectura existente

### Columnas ya existentes (de la migración F1 `supabase_training_redesign_v1.sql`)
- `sesiones_entrenamiento.instruccion_coach TEXT` — nota del coach (input para la IA)
- `sesion_ejercicios.instruccion_ejercicio TEXT` — nota del coach por ejercicio (input para la IA)

### Lo que añade F2
- `sesiones_entrenamiento.contexto_ia TEXT` — texto generado por IA (output)
- `sesion_ejercicios.contexto_ia TEXT` — texto generado por IA por ejercicio (output)

### Función IA disponible
`llamarDeepSeek(systemPrompt, userPrompt, temperature?, modelo?)` en `lib/agentes/executor.ts:72` — devuelve `string` (JSON parseado como string). Como generamos texto plano, usaremos `response_format` sin JSON — necesitamos una variante sin `json_object`. Solución: llamar directamente al fetch de DeepSeek en el endpoint (no usar `llamarDeepSeek`) para texto plano.

### Datos del atleta disponibles
- `perfil_entreno_cliente` — sport_modality, objetivo_especifico, ftp_watts, patron_lesiones, rm_sentadilla_kg
- `actividad_semanal` via `getSummaryLast7d` — body_battery_media, training_readiness_media

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Crear | `supabase/migrations/20260531_training_os_f2_contexto_ia.sql` |
| Crear | `app/api/entrenos/generar-contexto/route.ts` |
| Modificar | `app/entrenos/[id]/page.tsx` |
| Modificar | `app/cliente/sesion/[id]/page.tsx` |
| Modificar | `components/training/SemanaEntrenoCard.tsx` |

---

## ⚠️ Paso 0 (manual): Aplicar migración en Supabase

Tras crear el archivo en Task 1, aplicar en Supabase → SQL Editor antes de que los demás tasks funcionen en producción.

---

## Task 1: Migración SQL — columnas contexto_ia

**Files:**
- Create: `supabase/migrations/20260531_training_os_f2_contexto_ia.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/20260531_training_os_f2_contexto_ia.sql
-- Training OS F2 — Contexto IA
-- Añade columnas de salida AI a sesiones y ejercicios
-- Idempotente con IF NOT EXISTS

ALTER TABLE public.sesiones_entrenamiento
  ADD COLUMN IF NOT EXISTS contexto_ia TEXT;

ALTER TABLE public.sesion_ejercicios
  ADD COLUMN IF NOT EXISTS contexto_ia TEXT;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260531_training_os_f2_contexto_ia.sql
git commit -m "feat(training-os): migración F2 — columnas contexto_ia en sesiones y ejercicios"
```

---

## Task 2: API POST /api/entrenos/generar-contexto

**Files:**
- Create: `app/api/entrenos/generar-contexto/route.ts`

Esta API recibe `sesion_id`, carga el perfil del atleta y los datos Garmin, llama a DeepSeek y guarda los textos generados en `contexto_ia` de la sesión y de cada ejercicio.

- [ ] **Step 1: Crear el archivo**

```typescript
// app/api/entrenos/generar-contexto/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { getSummaryLast7d } from '@/lib/integraciones/normalizer'

const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions'

async function generarTextoDeepSeek(prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada')

  const res = await fetch(DEEPSEEK_API, {
    method: 'POST',
    signal: AbortSignal.timeout(45_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content: 'Eres el asistente de un coach de fitness de alto rendimiento. Generas textos de contexto cortos, directos y motivantes para atletas. Sin emojis. Máximo 3 frases.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!res.ok) throw new Error(`DeepSeek error ${res.status}`)
  const data = await res.json()
  return (data.choices?.[0]?.message?.content ?? '').trim()
}

export async function POST(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: { sesion_id: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { sesion_id } = body
  if (!sesion_id) return NextResponse.json({ error: 'sesion_id requerido' }, { status: 400 })

  const admin = createServiceSupabase()

  // Cargar sesión + ejercicios + plan + cliente
  const { data: sesion } = await admin
    .from('sesiones_entrenamiento')
    .select(`
      id, nombre, instruccion_coach, dia_semana,
      plan:planes_entrenamiento!inner(cliente_id, nombre),
      ejercicios:sesion_ejercicios(
        id, instruccion_ejercicio,
        ejercicio:ejercicios(nombre, grupo_muscular, tipo)
      )
    `)
    .eq('id', sesion_id)
    .single()

  if (!sesion) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

  const plan = Array.isArray(sesion.plan) ? sesion.plan[0] : sesion.plan
  const cliente_id: string = (plan as { cliente_id: string }).cliente_id

  // Perfil atleta
  const { data: perfil } = await admin
    .from('perfil_entreno_cliente')
    .select('sport_modality, objetivo_especifico, patron_lesiones, rm_sentadilla_kg, rm_banca_kg, ftp_watts, vo2max_estimado')
    .eq('cliente_id', cliente_id)
    .single()

  // Actividad Garmin/semanal
  let actividadStr = ''
  try {
    const actividad = await getSummaryLast7d(admin, cliente_id)
    if (actividad?.tiene_datos) {
      const bb = actividad.body_battery_media !== null ? `Body Battery ${actividad.body_battery_media.toFixed(0)}/100` : null
      const tr = actividad.training_readiness_media !== null ? `Training Readiness ${actividad.training_readiness_media.toFixed(0)}/100` : null
      if (bb || tr) actividadStr = [bb, tr].filter(Boolean).join(', ')
    }
  } catch { /* sin datos wearable */ }

  // Construir contexto del atleta para el prompt
  const modalidad = perfil?.sport_modality ?? 'fitness'
  const objetivo = perfil?.objetivo_especifico ?? ''
  const lesiones = Array.isArray(perfil?.patron_lesiones) && perfil.patron_lesiones.length > 0
    ? `Lesiones previas: ${perfil.patron_lesiones.map((l: { zona: string }) => l.zona).join(', ')}.`
    : ''
  const atletaCtx = [
    `Modalidad: ${modalidad}.`,
    objetivo ? `Objetivo: ${objetivo}.` : '',
    lesiones,
    actividadStr ? `Estado hoy — ${actividadStr}.` : '',
  ].filter(Boolean).join(' ')

  type EjercicioSesionRaw = {
    id: string
    instruccion_ejercicio: string | null
    ejercicio: { nombre: string; grupo_muscular: string; tipo: string } | null
  }
  const ejerciciosRaw = (sesion.ejercicios ?? []) as EjercicioSesionRaw[]

  // 1. Generar contexto de la sesión
  const notaCoach = sesion.instruccion_coach ?? ''
  const ejerciciosLista = ejerciciosRaw
    .map(e => e.ejercicio?.nombre ?? '')
    .filter(Boolean)
    .join(', ')

  const promptSesion = `
Atleta: ${atletaCtx}
Sesión: "${sesion.nombre}" (${sesion.dia_semana ?? 'día libre'}).
Ejercicios: ${ejerciciosLista}.
${notaCoach ? `Intención del coach: "${notaCoach}".` : ''}
Genera el contexto de la sesión: qué busca esta sesión, por qué estos ejercicios hoy, qué actitud tener. Máximo 2-3 frases. Sin emojis.`

  let contextoSesion = ''
  try {
    contextoSesion = await generarTextoDeepSeek(promptSesion)
  } catch (err) {
    console.error('[generar-contexto] sesión error:', err)
  }

  // 2. Generar contexto por ejercicio
  const contextosEjercicios: Array<{ id: string; contexto: string }> = []

  for (const ej of ejerciciosRaw) {
    if (!ej.ejercicio) continue
    const promptEj = `
Atleta: ${atletaCtx}
Ejercicio: "${ej.ejercicio.nombre}" (${ej.ejercicio.grupo_muscular}, ${ej.ejercicio.tipo}).
${ej.instruccion_ejercicio ? `Nota del coach: "${ej.instruccion_ejercicio}".` : ''}
Genera 1-2 frases explicando qué busca este ejercicio específicamente para este atleta. Sin emojis.`

    try {
      const texto = await generarTextoDeepSeek(promptEj)
      contextosEjercicios.push({ id: ej.id, contexto: texto })
    } catch {
      // skip this exercise
    }
  }

  // 3. Guardar en BD
  if (contextoSesion) {
    await admin
      .from('sesiones_entrenamiento')
      .update({ contexto_ia: contextoSesion })
      .eq('id', sesion_id)
  }

  for (const { id, contexto } of contextosEjercicios) {
    await admin
      .from('sesion_ejercicios')
      .update({ contexto_ia: contexto })
      .eq('id', id)
  }

  return NextResponse.json({
    ok: true,
    contexto_sesion: contextoSesion,
    contextos_ejercicios: contextosEjercicios,
  })
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit 2>&1 | grep -E "generar-contexto|TS" | head -10
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/api/entrenos/generar-contexto/route.ts
git commit -m "feat(training-os): API generar contexto IA para sesión y ejercicios"
```

---

## Task 3: Coach UI — nota + botón Generar en /entrenos/[id]

**Files:**
- Modify: `app/entrenos/[id]/page.tsx`

Añadir en la sesión activa: (1) textarea para `instruccion_coach`, (2) botón "Generar contexto IA", (3) display del `contexto_ia` resultante.

- [ ] **Step 1: Añadir campos al estado `SesionLocal`**

Al inicio del archivo, localizar la interfaz `SesionLocal`:

```typescript
interface SesionLocal {
  id: string
  nombre: string
  dia_semana: string
  orden: number
  notas: string
  ejercicios: EjercicioEnSesion[]
}
```

Reemplazarla con:

```typescript
interface SesionLocal {
  id: string
  nombre: string
  dia_semana: string
  orden: number
  notas: string
  instruccion_coach: string
  contexto_ia: string
  ejercicios: EjercicioEnSesion[]
}
```

- [ ] **Step 2: Actualizar el map del fetch para incluir los nuevos campos**

Localizar el bloque en el `useEffect` que hace el map de `sesionesRes.data`:

```typescript
    const data = (sesionesRes.data ?? []).map(s => ({
```

Dentro de ese map, añadir los dos campos nuevos (busca dónde se mapean `notas`, `nombre`, etc. y añade):

```typescript
      instruccion_coach: (s as { instruccion_coach?: string }).instruccion_coach ?? '',
      contexto_ia: (s as { contexto_ia?: string }).contexto_ia ?? '',
```

- [ ] **Step 3: Actualizar el SELECT para incluir los nuevos campos**

Localizar:
```typescript
      supabase.from('sesiones_entrenamiento')
        .select('*, ejercicios:sesion_ejercicios(*, ejercicio:ejercicios(*))')
```

No hace falta cambiar — el `*` ya incluye todos los campos. Solo verificar que los campos se mapean en el Step 2.

- [ ] **Step 4: Añadir estado para carga del generador**

Busca los `useState` al inicio del componente y añade:

```typescript
  const [generandoCtx, setGenerandoCtx] = useState<string | null>(null) // sesion_id en curso
```

- [ ] **Step 5: Añadir función `generarContexto`**

Después de la función `actualizarSesion`, añadir:

```typescript
  async function generarContexto(sesionId: string) {
    setGenerandoCtx(sesionId)
    try {
      const res = await fetch('/api/entrenos/generar-contexto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesion_id: sesionId }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.contexto_sesion) {
        setSesiones(prev => prev.map(s =>
          s.id === sesionId ? { ...s, contexto_ia: data.contexto_sesion } : s
        ))
      }
      // Actualizar contexto_ia de ejercicios
      if (data.contextos_ejercicios?.length) {
        const ctxMap = new Map<string, string>(
          data.contextos_ejercicios.map((c: { id: string; contexto: string }) => [c.id, c.contexto])
        )
        setSesiones(prev => prev.map(s =>
          s.id === sesionId
            ? {
                ...s,
                ejercicios: s.ejercicios.map(e =>
                  ctxMap.has(e.id) ? { ...e, contexto_ia: ctxMap.get(e.id)! } : e
                ),
              }
            : s
        ))
      }
    } finally {
      setGenerandoCtx(null)
    }
  }
```

- [ ] **Step 6: Añadir `contexto_ia` a `EjercicioEnSesion`**

Localizar la interfaz `EjercicioEnSesion` y añadir el campo:

```typescript
interface EjercicioEnSesion {
  id: string
  ejercicio_id: string
  series: number
  repeticiones: string
  descanso_segundos: number
  peso_sugerido: string
  notas: string
  contexto_ia: string
  orden: number
  ejercicio: { id: string; nombre: string; grupo_muscular: string; tipo: string }
}
```

Y en el map del fetch, añadir `contexto_ia` a cada ejercicio:
```typescript
// dentro del map de sesionesRes.data, en la parte de ejercicios:
ejercicios: (s.ejercicios ?? []).map((e: Record<string, unknown>) => ({
  ...
  contexto_ia: (e.contexto_ia as string) ?? '',
}))
```

- [ ] **Step 7: Añadir UI de nota + botón Generar en el panel de sesión**

Localizar en el JSX el bloque `{/* Session header */}` dentro de `{sesionActual ? (`. Justo DESPUÉS del `div` con el nombre + día (antes del bloque `{/* Exercise cards */}`), añadir:

```typescript
              {/* IA Context block */}
              <div
                className="rounded-xl p-4 mb-5"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                  Contexto IA
                </p>
                <textarea
                  className="w-full text-sm rounded-lg px-3 py-2 resize-none outline-none mb-3"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: 64 }}
                  placeholder="Intención de esta sesión (ej: 'semana intensidad, apretar en compuestos…')"
                  value={sesionActual.instruccion_coach}
                  onChange={e => {
                    setSesiones(prev => prev.map(s => s.id === sesionActual.id ? { ...s, instruccion_coach: e.target.value } : s))
                    supabase.from('sesiones_entrenamiento').update({ instruccion_coach: e.target.value }).eq('id', sesionActual.id)
                  }}
                />
                <button
                  onClick={() => generarContexto(sesionActual.id)}
                  disabled={generandoCtx === sesionActual.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50"
                  style={{ background: 'rgba(168,85,247,0.15)', color: 'rgb(192,132,252)', border: '1px solid rgba(168,85,247,0.3)' }}
                >
                  {generandoCtx === sesionActual.id ? (
                    <><span className="w-3 h-3 rounded-full border border-t-transparent animate-spin" style={{ borderColor: 'rgba(192,132,252,0.4)', borderTopColor: 'rgb(192,132,252)' }} /> Generando…</>
                  ) : (
                    <>🤖 Generar contexto</>
                  )}
                </button>
                {sesionActual.contexto_ia && (
                  <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {sesionActual.contexto_ia}
                  </p>
                )}
              </div>
```

- [ ] **Step 8: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "entrenos/\[id\]|error TS" | head -10
```

Esperado: sin errores.

- [ ] **Step 9: Commit**

```bash
git add app/entrenos/\[id\]/page.tsx
git commit -m "feat(training-os): UI nota coach + botón Generar contexto IA en editor de entreno"
```

---

## Task 4: Display de contexto en página de sesión cliente

**Files:**
- Modify: `app/cliente/sesion/[id]/page.tsx`

Mostrar `contexto_ia` de la sesión en el header, y `contexto_ia` de cada ejercicio bajo el nombre del ejercicio.

- [ ] **Step 1: Añadir `contexto_ia` al SELECT de la sesión**

Localizar el `.select(...)` de `sesiones_entrenamiento` en `loadSesion`:

```typescript
      .select(`
        id, nombre, dia_semana, notas,
        plan:planes_entrenamiento(nombre, cliente_id),
        ejercicios:sesion_ejercicios(
          id, orden, series, repeticiones, descanso_segundos, peso_sugerido, notas,
          ejercicio:ejercicios(id, nombre, grupo_muscular, tipo, video_url, foto_url)
        )
      `)
```

Reemplazar con:

```typescript
      .select(`
        id, nombre, dia_semana, notas, contexto_ia,
        plan:planes_entrenamiento(nombre, cliente_id),
        ejercicios:sesion_ejercicios(
          id, orden, series, repeticiones, descanso_segundos, peso_sugerido, notas, contexto_ia,
          ejercicio:ejercicios(id, nombre, grupo_muscular, tipo, video_url, foto_url)
        )
      `)
```

- [ ] **Step 2: Añadir `contexto_ia` al estado de sesión**

Localizar la interfaz (o tipo) de la sesión en el componente. Cerca de la línea donde se define `SesionCargada` o similar, verificar que incluye `contexto_ia`. Si el estado usa el tipo directo de Supabase, bastará con que el select lo incluya. Buscar donde se llama `setSesion(...)` y verificar que el objeto incluye `contexto_ia`:

```typescript
    setSesion({
      ...data,
      ejercicios: ejerciciosSorted,
      contexto_ia: (data as { contexto_ia?: string }).contexto_ia ?? null,
    })
```

Si `setSesion` ya usa el objeto `data` directamente, añadir `contexto_ia` al tipo del state:

En la declaración de `useState` busca `const [sesion, setSesion]` y si hay un tipo explícito, añadir `contexto_ia?: string | null`.

- [ ] **Step 3: Mostrar contexto de sesión en el header**

Localizar en el JSX el encabezado de sesión donde se muestra el nombre. Busca el texto del nombre de la sesión (algo como `{sesion.nombre}` o `{sesion?.nombre}`). Justo DESPUÉS del nombre/título de la sesión y ANTES de la lista de ejercicios, añadir:

```typescript
              {sesion?.contexto_ia && (
                <p
                  className="text-sm leading-relaxed mt-1 mb-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {sesion.contexto_ia}
                </p>
              )}
```

- [ ] **Step 4: Mostrar contexto de ejercicio bajo el nombre**

Localizar en el JSX donde se renderiza el ejercicio activo. Busca `{ej.ejercicio?.nombre}` (o similar) en el render principal del ejercicio activo. Justo después del nombre del ejercicio, añadir:

```typescript
                  {ejercicioActualData?.contexto_ia && (
                    <p
                      className="text-xs leading-relaxed mt-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {ejercicioActualData.contexto_ia}
                    </p>
                  )}
```

Donde `ejercicioActualData` es la variable que contiene el ejercicio activo del tipo `EjercicioSesion`. Adaptar el nombre de variable al que use el componente.

**Nota:** `EjercicioSesion` (interfaz definida al inicio del archivo) necesita el campo `contexto_ia`. Añadirlo:

```typescript
interface EjercicioSesion {
  // ... campos existentes ...
  contexto_ia?: string | null
}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "sesion/\[id\]|error TS" | head -10
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add "app/cliente/sesion/[id]/page.tsx"
git commit -m "feat(training-os): mostrar contexto IA en sesión cliente — header + ejercicio"
```

---

## Task 5: SemanaEntrenoCard — preview contexto sesión

**Files:**
- Modify: `components/training/SemanaEntrenoCard.tsx`

Añadir `contexto_ia` al fetch y mostrar las primeras 80 caracteres como subtítulo de la sesión en el card semanal.

- [ ] **Step 1: Actualizar el SELECT**

Localizar:

```typescript
        .select('id, nombre, dia_semana, orden, duracion_estimada_min, ejercicios:sesion_ejercicios(id)')
```

Reemplazar con:

```typescript
        .select('id, nombre, dia_semana, orden, duracion_estimada_min, contexto_ia, ejercicios:sesion_ejercicios(id)')
```

- [ ] **Step 2: Añadir `contexto_ia` al tipo/mapa de sesiones**

Localizar el bloque de `setSesiones(data.map(...))`. Dentro del map, añadir:

```typescript
            contexto_ia: (s as { contexto_ia?: string }).contexto_ia ?? null,
```

Y en la interfaz o tipo del array de sesiones (si está definida explícitamente dentro del componente), añadir:

```typescript
  contexto_ia?: string | null
```

- [ ] **Step 3: Mostrar preview del contexto en el card de sesión**

Localizar en el JSX donde se muestra cada sesión en el card semanal. Busca el nombre de la sesión (`{s.nombre}` o similar). Justo debajo del nombre de la sesión, añadir:

```typescript
                    {s.contexto_ia && (
                      <p
                        className="text-[11px] mt-0.5 leading-snug"
                        style={{ color: 'var(--text-muted)', opacity: 0.75 }}
                      >
                        {s.contexto_ia.length > 80
                          ? s.contexto_ia.slice(0, 80) + '…'
                          : s.contexto_ia}
                      </p>
                    )}
```

- [ ] **Step 4: Verificar TypeScript + Build**

```bash
npx tsc --noEmit 2>&1 | grep -E "SemanaEntrenoCard|error TS" | head -5
npm run build 2>&1 | tail -10
```

Esperado: sin errores.

- [ ] **Step 5: Commit final**

```bash
git add components/training/SemanaEntrenoCard.tsx
git commit -m "feat(training-os): F2 completo — preview contexto IA en card semanal"
```

---

## Task 6: Push a producción

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Aplicar migration en Supabase** (si no se hizo en Task 0)

Supabase → SQL Editor → ejecutar `supabase/migrations/20260531_training_os_f2_contexto_ia.sql`

---

## Resumen F2

| Tarea | Estado |
|-------|--------|
| Migration `contexto_ia` en sesiones y ejercicios | Task 1 |
| API `POST /api/entrenos/generar-contexto` | Task 2 |
| Coach UI: nota + botón Generar en editor | Task 3 |
| Cliente: contexto en header sesión + por ejercicio | Task 4 |
| SemanaEntrenoCard: preview contexto | Task 5 |

**Siguiente fase → F3:** Dashboard global del coach (tabla clientes con dots cumplimiento + fatiga). Plan en `docs/superpowers/plans/2026-05-31-training-os-f3-dashboard-coach.md` — se escribirá tras completar F2.
