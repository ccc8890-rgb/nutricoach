# Cardio Metrics — Registro de Sesión Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar métricas relevantes por tipo de ejercicio en el registro de sesión del portal cliente: metros + calorías + tiempo + RPE para cardio (SkiErg, remo, etc.), kg + reps + RPE para fuerza/funcional.

**Architecture:** Se extiende `SetData` con campos opcionales para cardio, se añade `tipo` a `EjercicioCard`, y `SetRegistroSheet` acepta un prop `modo: 'fuerza' | 'cardio'` que alterna qué controles muestra. La detección del modo se basa en `ejercicio.tipo === 'cardio'`. Cero cambios en BD (JSONB ya acepta cualquier estructura) ni en la API de registro.

**Tech Stack:** Next.js 16, React, TypeScript, Phosphor Icons, Tailwind/CSS vars.

---

## File Map

| Archivo | Acción | Qué cambia |
|---------|--------|------------|
| `components/training/SesionCardMobile.tsx` | Modificar | `SetData` extendido, `EjercicioCard` + `tipo`, init cardio, display set cardio, guardarSet generalizado |
| `components/training/SetRegistroSheet.tsx` | Modificar | Prop `modo`, campos cardio (metros/cal/tiempo), firma `onGuardar` generalizada |
| `app/cliente/sesion/[id]/page.tsx` | Modificar | Mapear `tipo` al construir `EjercicioCard[]` |

---

## Task 1: Extender tipos y actualizar inicialización en `SesionCardMobile`

**Files:**
- Modify: `components/training/SesionCardMobile.tsx:8-28` (interfaces SetData y EjercicioCard)
- Modify: `components/training/SesionCardMobile.tsx:39-46` (inicialización setsMap)

- [ ] **Step 1.1: Actualizar `SetData` con campos opcionales**

En `components/training/SesionCardMobile.tsx`, reemplazar la interfaz `SetData` (líneas 8-13):

```typescript
export interface SetData {
  // Fuerza
  kg?: number
  reps?: number
  // Cardio
  metros?: number
  calorias?: number
  tiempo_s?: number
  // Común
  rpe: number
  hecho: boolean
}
```

- [ ] **Step 1.2: Añadir campo `tipo` a `EjercicioCard`**

En `components/training/SesionCardMobile.tsx`, añadir `tipo` a la interfaz `EjercicioCard` (después de `foto_url`):

```typescript
export interface EjercicioCard {
  id: string
  nombre: string
  grupo_muscular: string
  series: number
  repeticiones: string
  descanso_segundos?: number
  peso_sugerido: string
  instruccion_ejercicio: string
  contexto_ia: string | null
  ultimo_peso_kg?: number | null
  video_url?: string | null
  foto_url?: string | null
  tipo?: string | null   // 'fuerza' | 'cardio' | 'funcional' | 'flexibilidad'
}
```

- [ ] **Step 1.3: Helper para determinar modo**

Añadir esta función justo antes de `export default function SesionCardMobile`:

```typescript
function getModo(tipo?: string | null): 'fuerza' | 'cardio' {
  return tipo === 'cardio' ? 'cardio' : 'fuerza'
}
```

- [ ] **Step 1.4: Actualizar inicialización de `setsMap` según tipo**

Reemplazar el bloque `useState` de `setsMap` (líneas 39-46):

```typescript
const [setsMap, setSetsMap] = useState<Record<string, SetData[]>>(() =>
  Object.fromEntries(
    ejercicios.map(e => [
      e.id,
      getModo(e.tipo) === 'cardio'
        ? Array.from({ length: e.series }, () => ({ metros: 0, calorias: 0, tiempo_s: 0, rpe: 7, hecho: false }))
        : Array.from({ length: e.series }, () => ({ kg: 0, reps: 0, rpe: 7, hecho: false })),
    ])
  )
)
```

- [ ] **Step 1.5: Arreglar `volumenTotal` para que no falle con campos opcionales**

Buscar la línea con `volumenTotal` (dentro del bloque `if (finalizando)`) y reemplazarla:

```typescript
const volumenTotal = Math.round(
  setsCompletados.reduce((acc, set) => acc + ((set.kg ?? 0) * (set.reps ?? 0)), 0)
)
```

- [ ] **Step 1.6: Verificar TypeScript**

```bash
cd nutricoach && npx tsc --noEmit --pretty false 2>&1 | grep -E "SesionCard|SetData|EjercicioCard" | head -20
```

Expected: sin errores en estos archivos (puede haber otros no relacionados).

- [ ] **Step 1.7: Commit**

```bash
git add components/training/SesionCardMobile.tsx
git commit -m "feat(cardio): extender SetData y EjercicioCard con tipo y campos opcionales"
```

---

## Task 2: Actualizar `SetRegistroSheet` con modo cardio

**Files:**
- Modify: `components/training/SetRegistroSheet.tsx` (completo)

- [ ] **Step 2.1: Actualizar Props y firma de `onGuardar`**

Reemplazar el contenido completo de `components/training/SetRegistroSheet.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { Check, ClockCounterClockwise, X } from '@phosphor-icons/react'
import type { SetData } from './SesionCardMobile'

type Modo = 'fuerza' | 'cardio'

interface Props {
  setNum: number
  totalSets: number
  ejercicioNombre: string
  pesoSugerido: string
  repsSugeridas: string
  pesoInicialKg?: number
  modo: Modo
  onGuardar: (data: Omit<SetData, 'hecho'>) => void
  onCerrar: () => void
}

function formatTiempo(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function SetRegistroSheet({
  setNum, totalSets, ejercicioNombre, pesoSugerido, repsSugeridas,
  pesoInicialKg, modo, onGuardar, onCerrar,
}: Props) {
  // Fuerza
  const [kg, setKg] = useState(pesoInicialKg != null ? pesoInicialKg : parseFloat(pesoSugerido) || 0)
  const [reps, setReps] = useState(parseInt(repsSugeridas) || 0)
  // Cardio
  const [metros, setMetros] = useState(0)
  const [calorias, setCalorias] = useState(0)
  const [tiempoS, setTiempoS] = useState(0)
  // Común
  const [rpe, setRpe] = useState(7)

  function handleGuardar() {
    if (modo === 'cardio') {
      onGuardar({ metros, calorias, tiempo_s: tiempoS, rpe })
    } else {
      onGuardar({ kg, reps, rpe })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Set {setNum} / {totalSets}</p>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>{ejercicioNombre}</p>
            {modo === 'fuerza' && pesoInicialKg != null && pesoInicialKg > 0 && (
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--semantic-info)' }}>
                <ClockCounterClockwise size={12} /> Última vez: {pesoInicialKg} kg
              </p>
            )}
          </div>
          <button onClick={onCerrar} style={{ color: 'var(--text-muted)' }} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {modo === 'fuerza' ? (
          /* ── Fuerza: kg + reps ── */
          <div className="flex gap-4 justify-center mb-6">
            {([
              { label: 'kg', value: kg, setValue: setKg, step: 2.5 },
              { label: 'reps', value: reps, setValue: setReps, step: 1 },
            ] as const).map(({ label, value, setValue, step }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <button
                  onClick={() => setValue((v: number) => Math.max(0, +(v + step).toFixed(1)))}
                  className="w-10 h-10 rounded-full text-xl font-bold transition-transform active:scale-[0.95]"
                  style={{ background: 'var(--semantic-info-bg)', color: 'var(--semantic-info)', border: '1px solid var(--semantic-info-border)' }}
                  aria-label={`Aumentar ${label}`}
                >+</button>
                <div className="text-center min-w-[60px]">
                  <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{value}</span>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
                </div>
                <button
                  onClick={() => setValue((v: number) => Math.max(0, +(v - step).toFixed(1)))}
                  className="w-10 h-10 rounded-full text-xl font-bold transition-transform active:scale-[0.95]"
                  style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  aria-label={`Reducir ${label}`}
                >−</button>
              </div>
            ))}
          </div>
        ) : (
          /* ── Cardio: metros + calorias + tiempo ── */
          <div className="flex gap-3 justify-center mb-6">
            {([
              { label: 'm', value: metros, setValue: setMetros, step: 10 },
              { label: 'cal', value: calorias, setValue: setCalorias, step: 1 },
            ] as const).map(({ label, value, setValue, step }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <button
                  onClick={() => setValue((v: number) => Math.max(0, v + step))}
                  className="w-10 h-10 rounded-full text-xl font-bold transition-transform active:scale-[0.95]"
                  style={{ background: 'var(--semantic-info-bg)', color: 'var(--semantic-info)', border: '1px solid var(--semantic-info-border)' }}
                  aria-label={`Aumentar ${label}`}
                >+</button>
                <div className="text-center min-w-[52px]">
                  <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{value}</span>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
                </div>
                <button
                  onClick={() => setValue((v: number) => Math.max(0, v - step))}
                  className="w-10 h-10 rounded-full text-xl font-bold transition-transform active:scale-[0.95]"
                  style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  aria-label={`Reducir ${label}`}
                >−</button>
              </div>
            ))}
            {/* Tiempo MM:SS */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setTiempoS(v => v + 5)}
                className="w-10 h-10 rounded-full text-xl font-bold transition-transform active:scale-[0.95]"
                style={{ background: 'var(--semantic-info-bg)', color: 'var(--semantic-info)', border: '1px solid var(--semantic-info-border)' }}
                aria-label="Aumentar tiempo 5s"
              >+</button>
              <div className="text-center min-w-[52px]">
                <span className="text-2xl font-bold font-data" style={{ color: 'var(--text)' }}>{formatTiempo(tiempoS)}</span>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>tiempo</p>
              </div>
              <button
                onClick={() => setTiempoS(v => Math.max(0, v - 5))}
                className="w-10 h-10 rounded-full text-xl font-bold transition-transform active:scale-[0.95]"
                style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                aria-label="Reducir tiempo 5s"
              >−</button>
            </div>
          </div>
        )}

        {/* RPE — igual para ambos modos */}
        <div className="mb-5">
          <p className="text-xs text-center mb-2" style={{ color: 'var(--text-muted)' }}>RPE percibido</p>
          <div className="flex justify-center gap-1.5">
            {[6, 7, 8, 9, 10].map(n => (
              <button
                key={n}
                onClick={() => setRpe(n)}
                className="w-10 h-10 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: rpe === n ? 'var(--accent)' : 'var(--bg)',
                  color: rpe === n ? 'var(--bg)' : 'var(--text-muted)',
                  border: `1px solid ${rpe === n ? 'var(--accent)' : 'var(--border)'}`,
                }}
                aria-label={`RPE ${n}`}
                aria-pressed={rpe === n}
              >{n}</button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGuardar}
          className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}
        >
          <Check size={16} /> Guardar set
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2.2: Verificar TypeScript**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep "SetRegistroSheet\|error TS" | head -20
```

Expected: sin errores en `SetRegistroSheet.tsx`.

- [ ] **Step 2.3: Commit**

```bash
git add components/training/SetRegistroSheet.tsx
git commit -m "feat(cardio): SetRegistroSheet con modo fuerza/cardio — metros, cal, tiempo, RPE"
```

---

## Task 3: Actualizar `SesionCardMobile` — paso del modo y display de sets

**Files:**
- Modify: `components/training/SesionCardMobile.tsx` (función `guardarSet`, render del sheet, display de sets completados)

- [ ] **Step 3.1: Actualizar `guardarSet` para recibir `Omit<SetData, 'hecho'>`**

Buscar la función `guardarSet` (recibe `kg: number, reps: number, rpe: number`) y reemplazarla:

```typescript
function guardarSet(data: Omit<SetData, 'hecho'>) {
  if (!setActivo) return
  const ejId = setActivo.ejId
  const idx = setActivo.setIdx
  const esUltimoSetEjercicio = idx >= sets.length - 1
  setSetsMap(prev => {
    const nuevosSets = prev[ejId].map((s, i) =>
      i === idx ? { ...data, hecho: true } : s
    )
    const nuevo = { ...prev, [ejId]: nuevosSets }
    if (nuevosSets.every(s => s.hecho)) onEjercicioComplete(ejId, nuevosSets)
    return nuevo
  })
  setSetActivo(null)
  if (!esUltimoSetEjercicio && descanso > 0) {
    setRestLeft(descanso)
    setTimerRunning(true)
  }
  if (esUltimoSetEjercicio && ejIdx < ejercicios.length - 1) {
    window.setTimeout(() => setEjIdx(i => Math.min(ejercicios.length - 1, i + 1)), 350)
  }
}
```

- [ ] **Step 3.2: Pasar `modo` al `SetRegistroSheet`**

Buscar el bloque `{setActivo && (` que renderiza `SetRegistroSheet` y añadir el prop `modo`:

```typescript
{setActivo && (
  <SetRegistroSheet
    setNum={setActivo.setIdx + 1}
    totalSets={sets.length}
    ejercicioNombre={ej.nombre}
    pesoSugerido={ej.peso_sugerido}
    repsSugeridas={ej.repeticiones}
    pesoInicialKg={ej.ultimo_peso_kg ?? undefined}
    modo={getModo(ej.tipo)}
    onGuardar={guardarSet}
    onCerrar={() => setSetActivo(null)}
  />
)}
```

- [ ] **Step 3.3: Actualizar display del set completado en el grid**

Buscar el bloque que muestra `{set.kg}kg` / `{set.reps} reps` en el set completado y reemplazarlo con:

```typescript
{set.hecho ? (
  (() => {
    const modo = getModo(ej.tipo)
    if (modo === 'cardio') {
      const linea1 = (set.metros ?? 0) > 0 ? `${set.metros}m`
        : (set.calorias ?? 0) > 0 ? `${set.calorias}cal`
        : set.tiempo_s ? `${Math.floor((set.tiempo_s ?? 0) / 60)}:${String((set.tiempo_s ?? 0) % 60).padStart(2, '0')}`
        : '—'
      const linea2 = (set.metros ?? 0) > 0 && (set.calorias ?? 0) > 0 ? `${set.calorias}cal` : `RPE ${set.rpe}`
      return (
        <>
          <span className="text-base font-bold" style={{ color: 'var(--semantic-active)' }}>{linea1}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{linea2}</span>
        </>
      )
    }
    return (
      <>
        <span className="text-base font-bold" style={{ color: 'var(--semantic-active)' }}>{set.kg}kg</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{set.reps} reps</span>
      </>
    )
  })()
) : (
  isActive
    ? <Play size={17} fill="currentColor" style={{ color: 'var(--semantic-info)' }} />
    : <Circle size={17} style={{ color: 'var(--border-strong)' }} />
)}
```

- [ ] **Step 3.4: Actualizar aria-label del set**

En el mismo botón del set, actualizar el `aria-label` para que no crashee con campos opcionales:

```typescript
aria-label={`Set ${i + 1}${set.hecho
  ? getModo(ej.tipo) === 'cardio'
    ? ` completado`
    : ` completado: ${set.kg}kg × ${set.reps} reps`
  : ''}`}
```

- [ ] **Step 3.5: Verificar TypeScript**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep "SesionCardMobile\|error TS" | head -20
```

Expected: 0 errores.

- [ ] **Step 3.6: Commit**

```bash
git add components/training/SesionCardMobile.tsx
git commit -m "feat(cardio): SesionCardMobile adapta display y guardarSet para cardio/fuerza"
```

---

## Task 4: Mapear `tipo` en `sesion/[id]/page.tsx`

**Files:**
- Modify: `app/cliente/sesion/[id]/page.tsx:223-236` (construcción de `ejerciciosCard`)

- [ ] **Step 4.1: Añadir `tipo` al mapeo de `EjercicioCard`**

En `app/cliente/sesion/[id]/page.tsx`, reemplazar el bloque `ejerciciosCard` (líneas 223-236):

```typescript
const ejerciciosCard: EjercicioCard[] = sesion.ejercicios.map(ej => ({
  id: ej.id,
  nombre: ej.ejercicio?.nombre ?? '',
  grupo_muscular: ej.ejercicio?.grupo_muscular ?? '',
  series: ej.series ?? 3,
  repeticiones: ej.repeticiones ?? '',
  descanso_segundos: ej.descanso_segundos ?? 90,
  peso_sugerido: ej.peso_sugerido ?? '',
  instruccion_ejercicio: ej.notas ?? '',
  contexto_ia: ej.contexto_ia ?? null,
  ultimo_peso_kg: ej.ejercicio?.id ? (historialPesos.get(ej.ejercicio.id) ?? null) : null,
  video_url: ej.ejercicio?.video_url ?? null,
  foto_url: ej.ejercicio?.foto_url ?? null,
  tipo: ej.ejercicio?.tipo ?? null,
}))
```

- [ ] **Step 4.2: Verificar que `EjercicioSesion` ya incluye `tipo`**

Confirmar que la interfaz `EjercicioSesion` en el mismo archivo tiene `tipo: string` dentro de `ejercicio`. Debe ser:

```typescript
ejercicio: {
  id: string
  nombre: string
  grupo_muscular: string
  tipo: string         // ← debe existir
  video_url?: string
  foto_url?: string
}
```

Si no existe, añadir `tipo: string` a la interfaz `EjercicioSesion.ejercicio`.

- [ ] **Step 4.3: TypeScript clean build**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep "error TS" | head -20
```

Expected: 0 errores.

- [ ] **Step 4.4: Commit y push final**

```bash
git add app/cliente/sesion/\[id\]/page.tsx
git commit -m "feat(cardio): mapear tipo ejercicio al EjercicioCard — activa modo cardio en SkiErg/remo"
git push origin main
```

---

## Verificación manual post-deploy

1. Abrir portal cliente → Mi Plan → sesión con un ejercicio de cardio (SkiErg, remo)
2. Al pulsar un set → sheet muestra **metros + cal + tiempo + RPE** (no kg/reps)
3. Al pulsar un set de fuerza → sheet muestra **kg + reps + RPE** igual que antes
4. Guardar set cardio → aparece resumen en la card (metros o cal)
5. Guardar sesión completa → `registrar-sesion` acepta sin error (JSONB flexible)
6. Comprobar que ejercicios de fuerza en la misma sesión siguen funcionando sin cambios
