# Training Section Polish — Diseño
**Fecha:** 04-06-2026
**Alcance:** Consistencia visual + EjercicioDemoModal + ejecución cliente

---

## Contexto

La sección de entrenamiento tiene tres frentes con deuda pendiente:
1. Componentes de training usan Lucide mientras el shell usa Phosphor → mix visual perceptible
2. `EjercicioDemoModal` solo funciona con YouTube; Instagram/TikTok caen a enlace externo
3. La sesión del cliente carece de instrucciones en modo solo-ver, PRs celebratorios y feedback físico en el timer

---

## Bloque 1 — Consistencia visual (Lucide → Phosphor)

### Archivos afectados

| Archivo | Iconos Lucide actuales | Equivalente Phosphor |
|---------|----------------------|----------------------|
| `components/training/SesionCardMobile.tsx` | Brain, CheckCircle2, ChevronLeft, ChevronRight, Circle, History, Pause, Play, RotateCcw, Save | Brain, CheckCircle, CaretLeft, CaretRight, Circle, ClockCounterClockwise, Pause, Play, ArrowCounterClockwise, FloppyDisk |
| `components/training/SetRegistroSheet.tsx` | Check, History, X | Check, ClockCounterClockwise, X |
| `components/training/EjercicioDemoModal.tsx` | X, Play | X, Play |
| `components/training/SemanaEntrenoCard.tsx` | ChevronRight, Dumbbell, Zap, CheckCircle2, Play | CaretRight, Barbell, Lightning, CheckCircle, Play |
| `components/training/HistorialEntreno.tsx` | (verificar en implementación) | equivalentes directos |
| `app/cliente/sesion/[id]/page.tsx` | ArrowLeft, Brain, CheckCircle2, Clock3, Dumbbell, Loader2, Play, Target, Trophy | ArrowLeft, Brain, CheckCircle, Clock, Barbell, CircleNotch, Play, Target, Trophy |

### Reglas
- Solo se cambian importaciones y nombres de componente. Ningún cambio funcional.
- Todos los iconos se importan desde `@phosphor-icons/react`.
- `weight="duotone"` para iconos de estado/acción, `weight="regular"` para iconos inline de texto.
- CSS vars ya se usan correctamente en todos estos componentes — no tocar estilos.

---

## Bloque 2 — EjercicioDemoModal mejorada

### Problema
`getEmbedUrl()` devuelve `null` para Instagram y TikTok → el usuario ve un botón "Abrir enlace" que saca de la app.

### Solución: cuatro niveles de fallback

```
video_url presente?
  ├── YouTube → iframe embed (sin cambio)
  ├── Instagram / TikTok / Vimeo → thumbnail + botón "Ver en [plataforma]" target="_blank"
  │     El modal sigue abierto al volver → contexto preservado
  └── URL desconocida → botón "Abrir enlace externo" (igual que ahora)

video_url ausente, foto_url presente?
  └── imagen a pantalla completa dentro del sheet

Ambos ausentes?
  └── placeholder: icono Barbell + "Sin demo disponible — revisa las instrucciones"
```

### Instrucciones dentro del modal
- Añadir prop `instruccion_ejercicio?: string | null` a la interfaz `Props` de `EjercicioDemoModal`
- Actualizar todos los callers que abren el modal para pasar este campo:
  - `SesionCardMobile.tsx`: leer de `ejercicios[ejIdx].instruccion_ejercicio`
  - `app/cliente/sesion/[id]/page.tsx`: añadir `instruccion_ejercicio` al tipo `demoEjercicio` y pasarlo al modal
- Renderizar al final del sheet: sección "Instrucciones" colapsada por defecto (2 líneas visibles + "Ver instrucciones ↓")
- Al expandir: texto completo con scroll dentro del sheet
- Si `instruccion_ejercicio` está vacío o null: no renderizar la sección

### Detección de plataforma para thumbnail
```ts
function detectPlatform(url: string): 'youtube' | 'instagram' | 'tiktok' | 'vimeo' | 'externo' {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('vimeo.com')) return 'vimeo'
  return 'externo'
}
```

Para Instagram/TikTok/Vimeo: mostrar `foto_url` como thumbnail (si existe) o un icono de la plataforma, con overlay de play que abre `target="_blank"`.

---

## Bloque 3 — Ejecución cliente

### 3A — Instrucciones en modo solo-ver

**Archivo:** `app/cliente/sesion/[id]/page.tsx`

En modo `solo-ver` se renderiza una vista distinta (lista de ejercicios sin `SesionCardMobile`). Añadir por cada ejercicio:
- Instrucción principal (`ejercicio.instruccion_ejercicio` o `sesionEjercicio.notas`) — máx 2 líneas, expandible
- Contexto IA (`sesionEjercicio.contexto_ia`) — si existe, en un badge azul pequeño debajo
- Botón "Ver demo" si `video_url` o `foto_url` existen → abre `EjercicioDemoModal`

### 3B — Pantalla celebratoria de PRs

**Archivo:** `app/cliente/sesion/[id]/page.tsx`

Flujo de finalización actual: sets guardados → resumen.
Flujo nuevo: sets guardados → **si hay PRs → pantalla PRs → resumen**.

Pantalla PRs:
- Fondo: `var(--semantic-active-bg)` con borde `var(--semantic-active-border)`
- Icono Trophy (Phosphor, duotone, 48px) centrado, color `var(--semantic-active)`
- Título: "¡Nuevos récords personales!"
- Lista: por cada PR → nombre del ejercicio + `{peso_anterior_kg} kg → {peso_nuevo_kg} kg ({reps} reps)`
- Botón "Ver resumen →" que avanza al resumen normal
- Animación: `fadeIn` + `slideUp` estándar del proyecto (CSS keyframes ya definidos)

Si no hay PRs: saltar directo al resumen (comportamiento actual).

### 3C — Timer con feedback físico

**Archivo:** `components/training/SesionCardMobile.tsx`

Al llegar el contador de descanso a 0:
```ts
// Vibración (Android/PWA; iOS Safari no soporta)
if (typeof navigator !== 'undefined' && navigator.vibrate) {
  navigator.vibrate([200, 100, 200])
}

// Beep audible (funciona en ambos)
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
  } catch { /* silencioso si no disponible */ }
}
```

El `AudioContext` se crea en respuesta a interacción del usuario (el usuario ya tocó el botón de set → el contexto está desbloqueado). No necesita workaround de autoplay.

---

## Archivos que NO se tocan

- `app/entrenos/page.tsx` — ya usa Phosphor, ya está bien
- `app/entrenos/plantillas/page.tsx` — mezcla pero es página de coach, no es prioridad ahora
- `components/training/TrainingWorkspaceShell.tsx` — ya Phosphor, no tocar
- `components/training/TrainingRoomPanel.tsx` — ya Phosphor, no tocar
- `lib/training/*` — ningún cambio en lógica de negocio

---

## Criterios de aceptación

- [ ] `npx tsc --noEmit` sin errores tras los cambios
- [ ] Ninguna importación de `lucide-react` en los 6 archivos afectados
- [ ] EjercicioDemoModal muestra foto/placeholder cuando no hay YouTube embed
- [ ] Instrucciones visibles y colapsables dentro del modal de demo
- [ ] Modo solo-ver de sesión muestra instrucciones + botón demo por ejercicio
- [ ] PRs con datos muestran pantalla celebratoria antes del resumen
- [ ] Timer llega a 0 → vibración (Android) + beep audible
- [ ] Build `npm run build` sin errores
