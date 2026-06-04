# Training Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar iconos Lucide → Phosphor en los componentes de training, mejorar EjercicioDemoModal con fallbacks de plataforma e instrucciones, y añadir feedback físico al timer de descanso.

**Architecture:** Tres bloques independientes en orden de dependencia: primero iconos (mecánico), después EjercicioDemoModal que necesita nueva prop, después timer + callers que pasan esa prop. Ningún cambio de API ni esquema de BD.

**Tech Stack:** Next.js 14 App Router, `@phosphor-icons/react`, CSS variables del proyecto, Web Audio API, Vibration API

---

## Mapa de archivos

| Archivo | Cambio |
|---------|--------|
| `components/training/HistorialEntreno.tsx` | Lucide → Phosphor |
| `components/training/SemanaEntrenoCard.tsx` | Lucide → Phosphor |
| `components/training/SetRegistroSheet.tsx` | Lucide → Phosphor |
| `components/training/EjercicioDemoModal.tsx` | Lucide → Phosphor + fallbacks plataforma + prop instrucciones |
| `components/training/SesionCardMobile.tsx` | Lucide → Phosphor + beep/vibración al llegar timer a 0 |
| `app/cliente/sesion/[id]/page.tsx` | Lucide → Phosphor + pasar instruccion_ejercicio al modal |

---

## Task 1: HistorialEntreno.tsx — migración Lucide → Phosphor

**Files:**
- Modify: `components/training/HistorialEntreno.tsx:1-4`

- [ ] **Reemplazar importación**

```tsx
// ANTES (línea 3):
import { Trophy, Zap, ChevronDown, ChevronUp } from 'lucide-react'

// DESPUÉS:
import { Trophy, Lightning, CaretDown, CaretUp } from '@phosphor-icons/react'
```

- [ ] **Reemplazar usos en JSX** — buscar en el archivo y sustituir:
  - `<Zap` → `<Lightning`
  - `<ChevronDown` → `<CaretDown`
  - `<ChevronUp` → `<CaretUp`
  - `<Trophy` → `<Trophy` (nombre igual, ya migrado)

- [ ] **Verificar TypeScript**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit 2>&1 | grep HistorialEntreno
```

Esperado: sin output (sin errores).

- [ ] **Commit**

```bash
git add components/training/HistorialEntreno.tsx
git commit -m "refactor(training): migrate HistorialEntreno icons to Phosphor"
```

---

## Task 2: SemanaEntrenoCard.tsx — migración Lucide → Phosphor

**Files:**
- Modify: `components/training/SemanaEntrenoCard.tsx:1-5`

- [ ] **Reemplazar importación**

```tsx
// ANTES (línea 4):
import { ChevronRight, Dumbbell, Zap, CheckCircle2, Play } from 'lucide-react'

// DESPUÉS:
import { CaretRight, Barbell, Lightning, CheckCircle, Play } from '@phosphor-icons/react'
```

- [ ] **Reemplazar usos en JSX**:
  - `<ChevronRight` → `<CaretRight`
  - `<Dumbbell` → `<Barbell`
  - `<Zap` → `<Lightning`
  - `<CheckCircle2` → `<CheckCircle`
  - `<Play` → `<Play` (nombre igual)

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep SemanaEntrenoCard
```

Esperado: sin output.

- [ ] **Commit**

```bash
git add components/training/SemanaEntrenoCard.tsx
git commit -m "refactor(training): migrate SemanaEntrenoCard icons to Phosphor"
```

---

## Task 3: SetRegistroSheet.tsx — migración Lucide → Phosphor

**Files:**
- Modify: `components/training/SetRegistroSheet.tsx:1-3`

- [ ] **Reemplazar importación**

```tsx
// ANTES (línea 3):
import { Check, History, X } from 'lucide-react'

// DESPUÉS:
import { Check, ClockCounterClockwise, X } from '@phosphor-icons/react'
```

- [ ] **Reemplazar usos en JSX**:
  - `<History` → `<ClockCounterClockwise`

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep SetRegistroSheet
```

Esperado: sin output.

- [ ] **Commit**

```bash
git add components/training/SetRegistroSheet.tsx
git commit -m "refactor(training): migrate SetRegistroSheet icons to Phosphor"
```

---

## Task 4: EjercicioDemoModal.tsx — migración + fallbacks + prop instrucciones

**Files:**
- Modify: `components/training/EjercicioDemoModal.tsx` (archivo completo)

- [ ] **Reescribir el archivo completo** con:
  1. Importaciones Phosphor
  2. Nueva prop `instruccion_ejercicio`
  3. Función `detectPlatform()`
  4. Lógica de 4 niveles de fallback
  5. Sección de instrucciones colapsable

```tsx
'use client'
import { useEffect, useState } from 'react'
import { ArrowSquareOut, Barbell, CaretDown, CaretUp, Play, X } from '@phosphor-icons/react'

interface Props {
  nombre: string
  grupo_muscular?: string
  video_url?: string | null
  foto_url?: string | null
  instruccion_ejercicio?: string | null
  onCerrar: () => void
}

type Platform = 'youtube' | 'instagram' | 'tiktok' | 'vimeo' | 'externo'

function detectPlatform(url: string): Platform {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('vimeo.com')) return 'vimeo'
  return 'externo'
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  vimeo: 'Vimeo',
  externo: 'enlace externo',
}

export default function EjercicioDemoModal({
  nombre,
  grupo_muscular,
  video_url,
  foto_url,
  instruccion_ejercicio,
  onCerrar,
}: Props) {
  const [visible, setVisible] = useState(false)
  const [instruccionesExpanded, setInstruccionesExpanded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  function cerrar() {
    setVisible(false)
    setTimeout(onCerrar, 280)
  }

  const platform = video_url ? detectPlatform(video_url) : null
  const ytId = video_url && platform === 'youtube' ? getYouTubeId(video_url) : null
  const embedUrl = ytId
    ? `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&playsinline=1`
    : null

  const hasInstrucciones = instruccion_ejercicio && instruccion_ejercicio.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{
        background: visible ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
        transition: 'background 0.28s',
      }}
      onClick={cerrar}
    >
      <div
        className="w-full max-w-lg mx-auto rounded-t-2xl overflow-hidden"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.32,0.72,0,1)',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-strong)' }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-3 flex-shrink-0">
          <div>
            <p className="font-bold text-base" style={{ color: 'var(--text)' }}>{nombre}</p>
            {grupo_muscular && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{grupo_muscular}</p>
            )}
          </div>
          <button
            onClick={cerrar}
            className="p-1.5 rounded-full flex-shrink-0 ml-3"
            style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}
            aria-label="Cerrar demo"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido media */}
        <div className="flex-1 overflow-y-auto">
          {/* Nivel 1: YouTube embed */}
          {embedUrl && (
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={`Demo ${nombre}`}
              />
            </div>
          )}

          {/* Nivel 2: Instagram / TikTok / Vimeo / externo con foto de fondo */}
          {video_url && !embedUrl && platform && (
            <div
              className="relative w-full flex flex-col items-center justify-center gap-3 py-10"
              style={{
                minHeight: 200,
                background: foto_url
                  ? `linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.7)), url(${foto_url}) center/cover no-repeat`
                  : 'var(--bg)',
              }}
            >
              {!foto_url && (
                <Barbell size={40} weight="duotone" style={{ color: 'var(--text-muted)' }} />
              )}
              <a
                href={video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold text-sm"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                <Play size={16} weight="fill" />
                Ver en {PLATFORM_LABEL[platform]}
                <ArrowSquareOut size={14} />
              </a>
              <p className="text-xs" style={{ color: foto_url ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                Se abre en nueva pestaña
              </p>
            </div>
          )}

          {/* Nivel 3: Solo foto */}
          {!video_url && foto_url && (
            <div className="w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto_url}
                alt={`Demo ${nombre}`}
                className="w-full object-cover"
                style={{ maxHeight: 320 }}
              />
            </div>
          )}

          {/* Nivel 4: Sin media */}
          {!video_url && !foto_url && (
            <div
              className="flex flex-col items-center justify-center gap-3 py-12"
              style={{ color: 'var(--text-muted)' }}
            >
              <Barbell size={40} weight="duotone" />
              <p className="text-sm text-center px-6">Sin demo disponible — revisa las instrucciones</p>
            </div>
          )}

          {/* Instrucciones colapsables */}
          {hasInstrucciones && (
            <div className="px-5 pb-5 pt-3">
              <button
                onClick={() => setInstruccionesExpanded(v => !v)}
                className="flex w-full items-center justify-between py-2 text-sm font-semibold"
                style={{ color: 'var(--text)' }}
              >
                <span>Instrucciones</span>
                {instruccionesExpanded
                  ? <CaretUp size={16} style={{ color: 'var(--text-muted)' }} />
                  : <CaretDown size={16} style={{ color: 'var(--text-muted)' }} />
                }
              </button>
              <div
                style={{
                  maxHeight: instruccionesExpanded ? 400 : 48,
                  overflow: 'hidden',
                  transition: 'max-height 0.22s ease',
                }}
              >
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: 'var(--text-secondary)',
                    display: instruccionesExpanded ? 'block' : '-webkit-box',
                    WebkitLineClamp: instruccionesExpanded ? undefined : 2,
                    WebkitBoxOrient: instruccionesExpanded ? undefined : 'vertical',
                    overflow: instruccionesExpanded ? 'visible' : 'hidden',
                  }}
                >
                  {instruccion_ejercicio}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep EjercicioDemoModal
```

Esperado: sin output.

- [ ] **Commit**

```bash
git add components/training/EjercicioDemoModal.tsx
git commit -m "feat(training): enhance EjercicioDemoModal — platform fallbacks + instrucciones"
```

---

## Task 5: SesionCardMobile.tsx — Phosphor + beep/vibración

**Files:**
- Modify: `components/training/SesionCardMobile.tsx`

- [ ] **Reemplazar importación de iconos** (línea 3):

```tsx
// ANTES:
import { Brain, CheckCircle2, ChevronLeft, ChevronRight, Circle, History, Pause, Play, RotateCcw, Save } from 'lucide-react'

// DESPUÉS:
import { ArrowCounterClockwise, Barbell, Brain, CaretLeft, CaretRight, CheckCircle, Circle, ClockCounterClockwise, FloppyDisk, Pause, Play } from '@phosphor-icons/react'
```

- [ ] **Reemplazar usos en JSX**:
  - `<CheckCircle2` → `<CheckCircle`
  - `<ChevronLeft` → `<CaretLeft`
  - `<ChevronRight` → `<CaretRight`
  - `<History` → `<ClockCounterClockwise`
  - `<RotateCcw` → `<ArrowCounterClockwise`
  - `<Save` → `<FloppyDisk`
  - `<Brain`, `<Circle`, `<Pause`, `<Play` → mismos nombres, sin cambio

- [ ] **Añadir `playBeep()` y `prevRestLeftRef`** — insertar justo antes de la función `guardarSet`:

```tsx
// Ref para detectar cuándo el timer llega exactamente a 0
const prevRestLeftRef = useRef(0)

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 440
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
    osc.onended = () => ctx.close()
  } catch { /* silencioso si AudioContext no disponible */ }
}
```

- [ ] **Añadir `useEffect` de feedback físico** — insertar después del `useEffect` del timer (después de la línea 68):

```tsx
// Feedback físico cuando el timer llega a 0
useEffect(() => {
  if (restLeft === 0 && prevRestLeftRef.current > 0) {
    playBeep()
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200])
    }
  }
  prevRestLeftRef.current = restLeft
}, [restLeft])
```

- [ ] **Actualizar la apertura del demo modal** para pasar `instruccion_ejercicio` — busca donde se llama `setDemoAbierto(true)` o donde se renderiza `<EjercicioDemoModal` y añade la prop:

```tsx
{demoAbierto && (
  <EjercicioDemoModal
    nombre={ej.nombre}
    grupo_muscular={ej.grupo_muscular}
    video_url={ej.video_url}
    foto_url={ej.foto_url}
    instruccion_ejercicio={ej.instruccion_ejercicio}  {/* ← añadir */}
    onCerrar={() => setDemoAbierto(false)}
  />
)}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep SesionCardMobile
```

Esperado: sin output.

- [ ] **Commit**

```bash
git add components/training/SesionCardMobile.tsx
git commit -m "feat(training): Phosphor icons + rest timer feedback (beep + vibrate)"
```

---

## Task 6: /cliente/sesion/[id]/page.tsx — Phosphor + instruccion_ejercicio en callers

**Files:**
- Modify: `app/cliente/sesion/[id]/page.tsx`

- [ ] **Reemplazar importación de iconos** (línea 7):

```tsx
// ANTES:
import { ArrowLeft, Brain, CheckCircle2, Clock3, Dumbbell, Loader2, Play, Target, Trophy } from 'lucide-react'

// DESPUÉS:
import { ArrowLeft, Barbell, Brain, CheckCircle, CircleNotch, Clock, Play, Target, Trophy } from '@phosphor-icons/react'
```

- [ ] **Reemplazar usos en JSX**:
  - `<CheckCircle2` → `<CheckCircle`
  - `<Clock3` → `<Clock`
  - `<Dumbbell` → `<Barbell`
  - `<Loader2 ... className="animate-spin"` → `<CircleNotch ... className="animate-spin"`
  - `<ArrowLeft`, `<Brain`, `<Play`, `<Target`, `<Trophy` → mismos nombres

- [ ] **Extender el tipo del estado `demoEjercicio`** — localizar la línea donde se declara y añadir el campo:

```tsx
// ANTES (línea ~64):
const [demoEjercicio, setDemoEjercicio] = useState<{
  nombre: string
  grupo_muscular: string
  video_url?: string | null
  foto_url?: string | null
} | null>(null)

// DESPUÉS:
const [demoEjercicio, setDemoEjercicio] = useState<{
  nombre: string
  grupo_muscular: string
  video_url?: string | null
  foto_url?: string | null
  instruccion_ejercicio?: string | null
} | null>(null)
```

- [ ] **Actualizar el botón Demo en modo solo-ver** — localizar el `onClick` del botón "Demo" en la sección `modo === 'solo-ver'` (línea ~400) y añadir el campo:

```tsx
onClick={() => setDemoEjercicio({
  nombre: ej.ejercicio?.nombre ?? '',
  grupo_muscular: ej.ejercicio?.grupo_muscular ?? '',
  video_url: ej.ejercicio?.video_url,
  foto_url: ej.ejercicio?.foto_url,
  instruccion_ejercicio: ej.notas ?? '',  // ← añadir
})}
```

- [ ] **Actualizar el render del modal** — localizar donde se renderiza `<EjercicioDemoModal` al final del return (línea ~440):

```tsx
{demoEjercicio && (
  <EjercicioDemoModal
    nombre={demoEjercicio.nombre}
    grupo_muscular={demoEjercicio.grupo_muscular}
    video_url={demoEjercicio.video_url}
    foto_url={demoEjercicio.foto_url}
    instruccion_ejercicio={demoEjercicio.instruccion_ejercicio}  {/* ← añadir */}
    onCerrar={() => setDemoEjercicio(null)}
  />
)}
```

- [ ] **Añadir animación fadeIn al bloque de PRs en la pantalla de éxito** — localizar el `if (guardadoOk) return (` y envolver el contenedor principal con la animación:

```tsx
// En el div exterior del bloque guardadoOk, añadir style:
style={{
  background: prsDetectados.length > 0 ? 'var(--semantic-active-bg)' : 'var(--bg)',
  animation: 'fadeIn 0.4s var(--ease-out-strong) both',
}}
```

Y en la sección de PRs añadir animación staggered por item:

```tsx
{prsDetectados.map((pr, i) => (
  <div
    key={pr.ejercicio_id}
    className="px-4 py-3 rounded-xl flex justify-between items-center"
    style={{
      background: 'var(--semantic-active-bg)',
      border: '1px solid var(--semantic-active-border)',
      animation: `fadeIn 0.3s var(--ease-out-strong) ${i * 80}ms both`,
    }}
  >
    ...contenido igual que antes...
  </div>
))}
```

- [ ] **Verificar TypeScript completo**

```bash
npx tsc --noEmit 2>&1
```

Esperado: sin output (0 errores).

- [ ] **Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Esperado: `✓ Compiled successfully` o `Route (app)` con 0 errores.

- [ ] **Commit final**

```bash
git add app/cliente/sesion/[id]/page.tsx
git commit -m "feat(training): Phosphor icons + instruccion_ejercicio en demo modal del cliente"
```

---

## Criterios de aceptación finales

- [ ] `npx tsc --noEmit` sin errores
- [ ] `npm run build` sin errores
- [ ] Ninguna importación de `lucide-react` en los 6 archivos objetivo
- [ ] `EjercicioDemoModal` renderiza foto cuando no hay YouTube embed
- [ ] `EjercicioDemoModal` renderiza botón "Ver en Instagram/TikTok" con enlace externo cuando hay URL de esas plataformas
- [ ] `EjercicioDemoModal` muestra placeholder con Barbell cuando no hay ni vídeo ni foto
- [ ] Instrucciones colapsables visibles en el modal cuando `instruccion_ejercicio` está relleno
- [ ] El timer al llegar a 0 reproduce un beep audible (probar en Chrome DevTools con audio desbloqueado)
- [ ] El timer al llegar a 0 vibra en Android/PWA (`navigator.vibrate` disponible)
