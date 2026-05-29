# Training OS F4 — Constructor Plantillas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar el editor de planes `/entrenos/[id]` con tres capacidades: nota IA por ejercicio (`instruccion_ejercicio`), reordenación ↑↓ de ejercicios, y badge de media (vídeo/foto) en la card del ejercicio.

**Architecture:** Todo el trabajo es en `app/entrenos/[id]/page.tsx`. La función `actualizarEjercicio` ya persiste cualquier campo a `sesion_ejercicios`, por lo que `instruccion_ejercicio` funciona gratis. Los botones ↑↓ intercambian el `orden` de dos ejercicios en BD. El badge de media usa `foto_url`/`video_url` que ya se cargan con `ejercicio:ejercicios(*)`.

**Tech Stack:** Next.js App Router, Supabase, TypeScript, Tailwind / CSS vars — sin librerías nuevas.

---

## ⚠️ Paso 0 (manual): Aplicar migración media ejercicios en Supabase

El archivo `supabase/migrations/20260529_ejercicios_media.sql` ya existe en el repo. Aplicar antes de usar la feature de media:
```sql
ALTER TABLE ejercicios
  ADD COLUMN IF NOT EXISTS foto_url   TEXT,
  ADD COLUMN IF NOT EXISTS video_url  TEXT,
  ADD COLUMN IF NOT EXISTS video_tipo TEXT;
```

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Modificar | `app/entrenos/[id]/page.tsx` |

---

## Task 1: instruccion_ejercicio — nota IA por ejercicio

**Files:**
- Modify: `app/entrenos/[id]/page.tsx`

- [ ] **Step 1: Añadir `instruccion_ejercicio` a la interfaz `EjercicioEnSesion`**

Localizar la interfaz:
```typescript
interface EjercicioEnSesion {
  id: string
  ejercicio_id: string
  series: number
  repeticiones: string
  descanso_segundos: number
  peso_sugerido: string
  notas: string
  orden: number
  contexto_ia: string
  ejercicio: { id: string; nombre: string; grupo_muscular: string; tipo: string }
}
```

Reemplazar con (añadir `instruccion_ejercicio` y `foto_url`/`video_url` al sub-objeto `ejercicio`):
```typescript
interface EjercicioEnSesion {
  id: string
  ejercicio_id: string
  series: number
  repeticiones: string
  descanso_segundos: number
  peso_sugerido: string
  notas: string
  instruccion_ejercicio: string
  orden: number
  contexto_ia: string
  ejercicio: { id: string; nombre: string; grupo_muscular: string; tipo: string; foto_url?: string | null; video_url?: string | null }
}
```

- [ ] **Step 2: Inicializar `instruccion_ejercicio` en el map del fetch**

Localizar el `.map(e => ({...}))` que construye los ejercicios en `loadPlan`. Dentro del map, añadir:
```typescript
          instruccion_ejercicio: ((e as unknown as Record<string, unknown>).instruccion_ejercicio as string) ?? '',
```

- [ ] **Step 3: Añadir estado `instruccionesAbiertas` junto a `notasAbiertas`**

```typescript
const [instruccionesAbiertas, setInstruccionesAbiertas] = useState<Set<string>>(new Set())
```

- [ ] **Step 4: Añadir función `toggleInstruccion` junto a `toggleNotas`**

```typescript
function toggleInstruccion(ejId: string) {
  setInstruccionesAbiertas(prev => {
    const n = new Set(prev)
    n.has(ejId) ? n.delete(ejId) : n.add(ejId)
    return n
  })
}
```

- [ ] **Step 5: Añadir botón "Nota IA" y su input en la card del ejercicio**

Localizar en el JSX el bloque `{/* Actions */}` que tiene los botones StickyNote y X. Añadir un nuevo botón justo ANTES del botón X (después del StickyNote):

```typescript
                        <button
                          onClick={() => toggleInstruccion(ej.id)}
                          className="p-1.5 rounded-md transition-colors"
                          title="Nota para IA"
                          style={{
                            color: (ej.instruccion_ejercicio || instruccionesAbiertas.has(ej.id)) ? 'rgb(168,85,247)' : 'var(--text-muted)',
                            background: instruccionesAbiertas.has(ej.id) ? 'rgba(168,85,247,0.09)' : 'transparent',
                          }}
                        >
                          🤖
                        </button>
```

Y justo DEBAJO del input de notas (o donde está `{notasAbiertas.has(ej.id) && ...}`), añadir:
```typescript
                        {instruccionesAbiertas.has(ej.id) && (
                          <input
                            className="input py-1.5 text-sm w-full mt-2"
                            placeholder="Nota para IA (ej: técnica estricta, controlar excéntrica…)"
                            value={ej.instruccion_ejercicio ?? ''}
                            onChange={e => actualizarEjercicio(ej.id, 'instruccion_ejercicio', e.target.value)}
                            autoFocus
                          />
                        )}
```

- [ ] **Step 6: Verificar TypeScript**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit 2>&1 | grep -E "entrenos/\[id\]|error TS" | head -10
```

- [ ] **Step 7: Commit**

```bash
git add "app/entrenos/[id]/page.tsx"
git commit -m "feat(training-os): instruccion_ejercicio — nota IA por ejercicio en editor coach"
```

---

## Task 2: Reordenación ↑↓ de ejercicios

**Files:**
- Modify: `app/entrenos/[id]/page.tsx`

- [ ] **Step 1: Añadir función `moverEjercicio`**

Después de `eliminarEjercicio`, añadir:

```typescript
async function moverEjercicio(ejId: string, direction: 'up' | 'down') {
  if (!sesionActiva) return
  const sesion = sesiones.find(s => s.id === sesionActiva)
  if (!sesion) return
  const idx = sesion.ejercicios.findIndex(e => e.id === ejId)
  if (idx === -1) return
  const newIdx = direction === 'up' ? idx - 1 : idx + 1
  if (newIdx < 0 || newIdx >= sesion.ejercicios.length) return

  const reordenados = [...sesion.ejercicios]
  const [moved] = reordenados.splice(idx, 1)
  reordenados.splice(newIdx, 0, moved)
  const actualizados = reordenados.map((e, i) => ({ ...e, orden: i }))

  setSesiones(prev => prev.map(s =>
    s.id === sesionActiva ? { ...s, ejercicios: actualizados } : s
  ))

  // Persistir nuevos órdenes
  await Promise.all(
    actualizados.map(e => supabase.from('sesion_ejercicios').update({ orden: e.orden }).eq('id', e.id))
  )
}
```

- [ ] **Step 2: Añadir botones ↑↓ en la card del ejercicio**

Localizar el bloque `{/* Actions */}` en el JSX. Añadir los botones ↑↓ al PRINCIPIO de ese bloque (antes del botón 🤖 y StickyNote):

```typescript
                        <button
                          onClick={() => moverEjercicio(ej.id, 'up')}
                          disabled={idx === 0}
                          className="p-1.5 rounded-md transition-colors disabled:opacity-20"
                          title="Subir"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moverEjercicio(ej.id, 'down')}
                          disabled={idx === sesionActual.ejercicios.length - 1}
                          className="p-1.5 rounded-md transition-colors disabled:opacity-20"
                          title="Bajar"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          ↓
                        </button>
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "entrenos/\[id\]|error TS" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add "app/entrenos/[id]/page.tsx"
git commit -m "feat(training-os): reordenación ↑↓ de ejercicios en editor de plan"
```

---

## Task 3: Badge media (vídeo/foto) en card de ejercicio

**Files:**
- Modify: `app/entrenos/[id]/page.tsx`

- [ ] **Step 1: Añadir icono `Video` a los imports de lucide-react**

Localizar:
```typescript
import { ArrowLeft, Plus, Trash2, Search, X, StickyNote, Calendar } from 'lucide-react'
```
Reemplazar con:
```typescript
import { ArrowLeft, Plus, Trash2, Search, X, StickyNote, Calendar, Video } from 'lucide-react'
```

- [ ] **Step 2: Mostrar badge de media en la card del ejercicio**

Localizar en el JSX el bloque donde se muestra el nombre + tags del ejercicio:
```typescript
                        <div className="flex items-center gap-2 flex-wrap mb-2.5">
                          <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                            {ej.ejercicio?.nombre}
                          </span>
                          ...badges...
                        </div>
```

Añadir al FINAL de ese div (después de los badges existentes), justo antes del cierre `</div>`:

```typescript
                          {ej.ejercicio?.video_url && (
                            <a
                              href={ej.ejercicio.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full transition-colors"
                              style={{ background: 'rgba(168,85,247,0.1)', color: 'rgb(168,85,247)', border: '1px solid rgba(168,85,247,0.25)' }}
                              title="Ver demostración"
                            >
                              <Video size={10} /> Demo
                            </a>
                          )}
```

- [ ] **Step 3: Verificar TypeScript + Build final**

```bash
npx tsc --noEmit 2>&1 | grep -E "entrenos/\[id\]|error TS" | head -10
npm run build 2>&1 | tail -15
```

Build debe pasar con 0 errores.

- [ ] **Step 4: Commit final + Push**

```bash
git add "app/entrenos/[id]/page.tsx"
git commit -m "feat(training-os): F4 completo — media badge video en card de ejercicio"
git push origin main
```

---

## Resultado esperado

En `/entrenos/[id]`, cada ejercicio en el editor muestra:
- Botones **↑↓** para reordenar dentro de la sesión
- Botón **🤖** (robot) que abre un input de nota para la IA (`instruccion_ejercicio`) — púrpura si tiene nota
- Botón **StickyNote** que abre notas técnicas (`notas`) — ya existía
- Badge **"Demo"** con icono Video si el ejercicio tiene `video_url` configurado

⚠️ Aplicar migración en Supabase antes de usar la feature de media:
`supabase/migrations/20260529_ejercicios_media.sql`

**F4 cierra el ciclo del Training OS. Las 4 fases están completas.**
