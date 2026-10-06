# Contenido (ideas, tandas de grabación, publicación) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un apartado "Contenido" en el lado coach para apuntar ideas, elegir recetas del recetario, agruparlas en un día de grabación (con compra consolidada y escaleta de planos), colocarlas en la dieta de Carlos y seguirlas hasta publicarlas.

**Architecture:** Tabla nueva `piezas_contenido` como fuente de verdad; la lógica de estados, escaleta, fechas y tanda vive en módulos puros de `lib/contenido/` con tests. `recetas.contenido_estado` pasa a ser un caché derivado de las piezas, para que el icono del planificador y sus lectores sigan funcionando sin tocarlos. La compra de la tanda reutiliza `agregarIngredientes`, extraída de la ruta de lista de la compra semanal.

**Tech Stack:** Next.js 16.2.4 (App Router), React 19.2.4, Supabase (service role en rutas API), TypeScript, lucide-react. Tests: scripts con `node:assert` ejecutados con `npx tsx`.

**Spec:** `docs/superpowers/specs/2026-10-07-contenido-grabacion-design.md`

## Cambios respecto al spec (decididos al mirar el código real)

| Spec | Plan | Por qué |
|---|---|---|
| "Con enlace, se lanza Content Radar" | Carlos comparte el reel a Content Radar como siempre. Contenido enlaza la pieza con la receta buscando `recetas.url_origen` (normalizando el enlace). | La app no tiene forma de disparar Content Radar (vive en Notion/Shortcut/Telegram + GitHub Actions). |
| El icono del planificador "lee y escribe en la pieza" | El icono escribe en piezas, y `recetas.contenido_estado` se mantiene como caché derivado. | Lo leen 4 sitios (`semana-dieta`, `detalle-dia`, `semanas-futuras`, `SemanaDietaPlanner`). Así no se tocan. |
| Compra con coste por supermercado | Coste estimado con el precio más barato por ingrediente. | El desglose por supermercado depende de selecciones por plan; es un refactor grande. Ampliable después. |
| Orden de cocinado por tiempo, horno y reposo | Solo por `tiempo_prep_min` (más largo primero, sin tiempo al final). | No hay columna fiable de tipo de cocción en el código. |
| Tablero con tarjetas arrastrables | Tarjetas con selector de estado. | Menos fricción y menos código; el arrastre se añade después si hace falta. |
| Calendario con dieta y entreno en pequeño | Solo grabación y publicación. | Cruzar dieta y entreno añade dos fuentes de datos; fuera de la primera versión. |
| "Colocar en mi dieta" en el día de grabación y siguientes | Solo para fechas en las semanas +1…+8 (las futuras de `comidas_planificadas`). Si la fecha cae en la semana en curso, avisa y no coloca. | La semana en curso usa otra tabla (`comidas`) con otra lógica. |
| La tanda parte de las cantidades de la dieta | La tanda usa las cantidades **completas** de la receta (lo que cocinas para grabar). | Para grabar cocinas la receta entera, no la ración ajustada a la dieta. |
| "Ya lo tengo" en la compra | Se guarda en el navegador (localStorage), no en base de datos. | Es una comodidad por dispositivo, no un dato a conservar. |

Tras ejecutar el plan, actualizar el spec con esta tabla.

## Global Constraints

- Todo el texto de interfaz en español (castellano). Fechas visibles en DD-MM-YYYY; en BD y API, `YYYY-MM-DD`.
- Next.js 16.2.4 tiene cambios incompatibles: antes de escribir una ruta nueva, leer la guía relevante en `node_modules/next/dist/docs/`. En rutas con `[id]`, `params` es una `Promise` (patrón actual del repo).
- **Toda** ruta de `app/api/contenido/**` verifica sesión y rol `coach` (`autorizarCoach`) antes de operar. Las rutas con `cliente_id` verifican además que el cliente es del coach (`autorizarSemanaDieta`).
- No devolver `err.message` al cliente en errores 500: mensaje genérico.
- Migraciones: no se aplican solas al hacer push; las aplica Carlos o se piden confirmación. **No hacer push de código que use `piezas_contenido` antes de que la migración esté aplicada.**
- Tests: scripts `scripts/<nombre>.test.ts` con `node:assert/strict`, que terminan con `console.log('<nombre>: OK')`. Se ejecutan con `npx tsx scripts/<nombre>.test.ts`.
- Los módulos puros de `lib/contenido/` usan imports relativos (`./estados`), no `@/`.
- Estilo de UI: clases `card`, `btn btn-primary|btn-secondary|btn-ghost|btn-danger`, `btn-sm`, `input`, y variables CSS (`var(--surface)`, `var(--border)`, `var(--text)`, `var(--text-muted)`, `var(--success)`, `var(--warning)`). Sin colores fijos.
- Verificación de tipos: `npx tsc --noEmit --pretty false`. Commits en `main` del repo `nutricoach`, con el pie `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Entradas o condiciones que el spec implica pero que ninguna prueba obvia cubriría; cada una tiene su prueba en la tarea indicada.

1. **Enlace con parámetros de seguimiento o sin `www`** (`?igsh=…`, `http://`, barra final): debe enlazar con la receta existente, no duplicarla. YouTube con `?v=` no debe perder el `v`. → Tarea 4.
2. **Receta con dos piezas** (una grabada, otra pendiente): el icono del planificador debe mostrar "para grabar". → Tarea 1.
3. **Desmarcar un plano de una pieza `grabada`**: vuelve a `para_grabar`, no se queda "grabada" con planos pendientes. Y marcar `grabada` desde el icono no deja la escaleta a cero. → Tarea 2.
4. **Fecha de grabación en la semana en curso, pasada o a más de 8 semanas**: colocar en dieta debe informar de las omitidas, no fallar. → Tarea 3.
5. **Tanda vacía o receta sin ingredientes vinculados / sin tiempo**: la compra sale vacía sin error y la receta sin tiempo va la última. → Tareas 4 y 5.
6. **Mismo alimento en varias recetas, y agua o sal**: se suman las cantidades, y agua y sal no aparecen en la compra. → Tarea 5.
7. **Cuerpo de API con estado inventado, fecha mal formada o `planos_hechos` desconocidos**: 400, nunca se guarda. → Tarea 7.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `lib/contenido/estados.ts` | Estados de pieza, caché del icono de receta, acciones del icono |
| `lib/contenido/escaleta.ts` | Los seis planos, estado según planos hechos |
| `lib/contenido/fechas.ts` | Lunes de la semana, semana y día relativos, reparto en dieta, "hoy" en Madrid |
| `lib/contenido/enlace.ts` | Normalizar enlaces, interpretar la entrada rápida |
| `lib/contenido/tanda.ts` | Orden de cocinado y resumen de la tanda |
| `lib/contenido/validacion.ts` | Validar y limpiar el cuerpo de las rutas de piezas |
| `lib/contenido/auth.ts` | `autorizarCoach` para las rutas |
| `lib/contenido/piezas.ts` | Operaciones con BD: buscar receta por enlace, sincronizar icono, añadir recetas a la tanda |
| `lib/contenido/compra-tanda.ts` | Compra consolidada de una tanda |
| `lib/lista-compra/agregar.ts` | `agregarIngredientes` extraída de la ruta semanal |
| `supabase/migrations/20261007120000_piezas_contenido.sql` | Tabla, RLS, copia desde `contenido_estado` |
| `app/api/contenido/**` | Rutas de piezas, recetas, tanda, dieta de la semana |
| `app/contenido/layout.tsx`, `page.tsx` | Apartado con sus vistas |
| `components/contenido/*` | Bandeja, Día de grabación, Escaleta, Tablero, Calendario, Selector |

---

### Task 1: Estados de pieza y caché del icono de receta

**Files:**
- Create: `lib/contenido/estados.ts`
- Test: `scripts/contenido-estados.test.ts`

**Interfaces:**
- Produces: `ESTADOS_PIEZA`, `type EstadoPieza`, `ESTADOS_GRABADOS`, `ETIQUETA_ESTADO`, `esEstadoPieza(v)`, `type IconoReceta`, `estadoIconoReceta(estados)`, `planificarIcono(piezas, destino)`, `type AccionIcono`

- [ ] **Step 1: Escribir el test que falla**

```ts
// scripts/contenido-estados.test.ts
import assert from 'node:assert/strict'
import { esEstadoPieza, estadoIconoReceta, planificarIcono } from '../lib/contenido/estados'

assert.equal(esEstadoPieza('para_grabar'), true)
assert.equal(esEstadoPieza('inventado'), false)
assert.equal(esEstadoPieza(null), false)

// Caché del icono: lo pendiente manda sobre lo grabado
assert.equal(estadoIconoReceta([]), null)
assert.equal(estadoIconoReceta(['idea', 'documentada']), null)
assert.equal(estadoIconoReceta(['para_grabar']), 'para_grabar')
assert.equal(estadoIconoReceta(['grabada']), 'grabada')
assert.equal(estadoIconoReceta(['publicada']), 'grabada')
assert.equal(estadoIconoReceta(['grabada', 'para_grabar']), 'para_grabar')

// Icono → para_grabar
assert.deepEqual(planificarIcono([], 'para_grabar'), { crear: 'para_grabar', actualizar: [], borrar: [] })
assert.deepEqual(planificarIcono([{ id: 'a', estado: 'para_grabar' }], 'para_grabar'), { crear: null, actualizar: [], borrar: [] })
assert.deepEqual(
  planificarIcono([{ id: 'a', estado: 'documentada' }], 'para_grabar'),
  { crear: null, actualizar: [{ id: 'a', estado: 'para_grabar' }], borrar: [] },
)
// Una pieza ya grabada no impide crear otra para volver a grabar
assert.deepEqual(planificarIcono([{ id: 'a', estado: 'publicada' }], 'para_grabar'), { crear: 'para_grabar', actualizar: [], borrar: [] })

// Icono → grabada
assert.deepEqual(
  planificarIcono([{ id: 'a', estado: 'para_grabar' }, { id: 'b', estado: 'idea' }], 'grabada'),
  { crear: null, actualizar: [{ id: 'a', estado: 'grabada' }], borrar: [] },
)
assert.deepEqual(planificarIcono([], 'grabada'), { crear: 'grabada', actualizar: [], borrar: [] })
assert.deepEqual(planificarIcono([{ id: 'a', estado: 'editada' }], 'grabada'), { crear: null, actualizar: [], borrar: [] })

// Icono → nada: solo se borran piezas pendientes o recién grabadas, nunca las ya editadas o publicadas
assert.deepEqual(
  planificarIcono([{ id: 'a', estado: 'para_grabar' }, { id: 'b', estado: 'grabada' }, { id: 'c', estado: 'publicada' }, { id: 'd', estado: 'idea' }], null),
  { crear: null, actualizar: [], borrar: ['a', 'b'] },
)

console.log('contenido-estados: OK')
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `cd nutricoach && npx tsx scripts/contenido-estados.test.ts`
Expected: FAIL (`Cannot find module '../lib/contenido/estados'`)

- [ ] **Step 3: Implementar**

```ts
// lib/contenido/estados.ts
export const ESTADOS_PIEZA = ['idea', 'documentada', 'para_grabar', 'grabada', 'editada', 'programada', 'publicada'] as const
export type EstadoPieza = typeof ESTADOS_PIEZA[number]

/** Estados en los que el vídeo ya está grabado. */
export const ESTADOS_GRABADOS: readonly EstadoPieza[] = ['grabada', 'editada', 'programada', 'publicada']

export const ETIQUETA_ESTADO: Record<EstadoPieza, string> = {
  idea: 'Idea',
  documentada: 'Documentada',
  para_grabar: 'Para grabar',
  grabada: 'Grabada',
  editada: 'Editada',
  programada: 'Programada',
  publicada: 'Publicada',
}

export function esEstadoPieza(v: unknown): v is EstadoPieza {
  return typeof v === 'string' && (ESTADOS_PIEZA as readonly string[]).includes(v)
}

export type IconoReceta = 'para_grabar' | 'grabada' | null

/** Valor de `recetas.contenido_estado` (caché del icono) según los estados de sus piezas. Lo pendiente manda. */
export function estadoIconoReceta(estados: EstadoPieza[]): IconoReceta {
  if (estados.includes('para_grabar')) return 'para_grabar'
  if (estados.some(e => ESTADOS_GRABADOS.includes(e))) return 'grabada'
  return null
}

export type AccionIcono = {
  crear: EstadoPieza | null
  actualizar: { id: string; estado: EstadoPieza }[]
  borrar: string[]
}

/** Qué hacer con las piezas de una receta cuando el planificador cambia su icono a `destino`. */
export function planificarIcono(piezas: { id: string; estado: EstadoPieza }[], destino: IconoReceta): AccionIcono {
  const nada: AccionIcono = { crear: null, actualizar: [], borrar: [] }
  if (destino === 'para_grabar') {
    if (piezas.some(p => p.estado === 'para_grabar')) return nada
    const promovible = piezas.find(p => p.estado === 'idea' || p.estado === 'documentada')
    if (promovible) return { ...nada, actualizar: [{ id: promovible.id, estado: 'para_grabar' }] }
    return { ...nada, crear: 'para_grabar' }
  }
  if (destino === 'grabada') {
    const pendientes = piezas.filter(p => p.estado === 'para_grabar')
    if (pendientes.length > 0) return { ...nada, actualizar: pendientes.map(p => ({ id: p.id, estado: 'grabada' as const })) }
    if (piezas.some(p => ESTADOS_GRABADOS.includes(p.estado))) return nada
    return { ...nada, crear: 'grabada' }
  }
  return { ...nada, borrar: piezas.filter(p => p.estado === 'para_grabar' || p.estado === 'grabada').map(p => p.id) }
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `cd nutricoach && npx tsx scripts/contenido-estados.test.ts`
Expected: `contenido-estados: OK`

- [ ] **Step 5: Commit**

```bash
cd nutricoach && git add lib/contenido/estados.ts scripts/contenido-estados.test.ts
git commit -m "feat(contenido): estados de pieza y caché del icono de receta

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Escaleta de grabación

**Files:**
- Create: `lib/contenido/escaleta.ts`
- Test: `scripts/contenido-escaleta.test.ts`

**Interfaces:**
- Consumes: `EstadoPieza`, `ESTADOS_GRABADOS` de `./estados`
- Produces: `PLANOS`, `IDS_PLANOS`, `planosPendientes(hechos)`, `alternarPlano(hechos, id)`, `estadoTrasPlanos(estado, hechos)`, `planosTrasEstado(estado, hechos)`

- [ ] **Step 1: Escribir el test que falla**

```ts
// scripts/contenido-escaleta.test.ts
import assert from 'node:assert/strict'
import { IDS_PLANOS, PLANOS, alternarPlano, estadoTrasPlanos, planosPendientes, planosTrasEstado } from '../lib/contenido/escaleta'

assert.equal(PLANOS.length, 6)
assert.equal(new Set(IDS_PLANOS).size, 6)

assert.equal(planosPendientes([]), 6)
assert.equal(planosPendientes(['ingredientes', 'plato']), 4)
assert.equal(planosPendientes([...IDS_PLANOS]), 0)
// ids desconocidos o repetidos no cuentan
assert.equal(planosPendientes(['ingredientes', 'ingredientes', 'otro']), 5)

assert.deepEqual(alternarPlano([], 'plato'), ['plato'])
assert.deepEqual(alternarPlano(['plato'], 'plato'), [])
assert.deepEqual(alternarPlano(['plato'], 'inventado'), ['plato'])

// Marcar el último plano pasa a grabada
assert.equal(estadoTrasPlanos('para_grabar', [...IDS_PLANOS]), 'grabada')
assert.equal(estadoTrasPlanos('para_grabar', ['plato']), 'para_grabar')
// Desmarcar un plano de una pieza grabada la devuelve a para_grabar
assert.equal(estadoTrasPlanos('grabada', IDS_PLANOS.slice(1)), 'para_grabar')
assert.equal(estadoTrasPlanos('grabada', [...IDS_PLANOS]), 'grabada')
// Otros estados no cambian por los planos
assert.equal(estadoTrasPlanos('idea', []), 'idea')
assert.equal(estadoTrasPlanos('publicada', ['plato']), 'publicada')

// Si el estado pasa a grabado o posterior, la escaleta se da por completa (icono "grabada" del planificador)
assert.deepEqual(planosTrasEstado('grabada', []), [...IDS_PLANOS])
assert.deepEqual(planosTrasEstado('publicada', ['plato']), [...IDS_PLANOS])
assert.deepEqual(planosTrasEstado('para_grabar', ['plato']), ['plato'])

console.log('contenido-escaleta: OK')
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `cd nutricoach && npx tsx scripts/contenido-escaleta.test.ts`
Expected: FAIL (`Cannot find module '../lib/contenido/escaleta'`)

- [ ] **Step 3: Implementar**

```ts
// lib/contenido/escaleta.ts
import { ESTADOS_GRABADOS, type EstadoPieza } from './estados'

/** Escaleta estándar de grabación: la misma para todas las recetas. Cambiarla es un cambio de código. */
export const PLANOS = [
  { id: 'ingredientes', texto: 'Ingredientes sobre la mesa (plano general)' },
  { id: 'proceso', texto: 'Preparación: 3 o 4 planos del proceso' },
  { id: 'cocinado', texto: 'Cocinado o montaje (el momento que engancha)' },
  { id: 'plato', texto: 'Plato terminado, plano cenital' },
  { id: 'detalle', texto: 'Plano de detalle o primer bocado' },
  { id: 'macros', texto: 'Texto en pantalla con los macros' },
] as const

export const IDS_PLANOS: string[] = PLANOS.map(p => p.id)

/** Planos de la escaleta que aún no están marcados. Ignora ids desconocidos y repetidos. */
export function planosPendientes(hechos: string[]): number {
  const validos = new Set(hechos.filter(id => IDS_PLANOS.includes(id)))
  return IDS_PLANOS.length - validos.size
}

export function alternarPlano(hechos: string[], id: string): string[] {
  if (!IDS_PLANOS.includes(id)) return hechos
  return hechos.includes(id) ? hechos.filter(h => h !== id) : [...hechos, id]
}

/** Estado de la pieza tras cambiar sus planos: completar pasa a grabada; desmarcar una grabada la devuelve a para_grabar. */
export function estadoTrasPlanos(estado: EstadoPieza, hechos: string[]): EstadoPieza {
  const completa = planosPendientes(hechos) === 0
  if (estado === 'para_grabar' && completa) return 'grabada'
  if (estado === 'grabada' && !completa) return 'para_grabar'
  return estado
}

/** Planos tras cambiar el estado a mano: un vídeo grabado o posterior tiene la escaleta completa. */
export function planosTrasEstado(estado: EstadoPieza, hechos: string[]): string[] {
  return ESTADOS_GRABADOS.includes(estado) ? [...IDS_PLANOS] : hechos
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `cd nutricoach && npx tsx scripts/contenido-escaleta.test.ts`
Expected: `contenido-escaleta: OK`

- [ ] **Step 5: Commit**

```bash
cd nutricoach && git add lib/contenido/escaleta.ts scripts/contenido-escaleta.test.ts
git commit -m "feat(contenido): escaleta estándar de grabación

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Fechas y reparto en la dieta

**Files:**
- Create: `lib/contenido/fechas.ts`
- Test: `scripts/contenido-fechas.test.ts`

**Interfaces:**
- Produces: `lunesDe(fecha)`, `sumarDias(fecha, n)`, `semanaYDia(fecha, hoy)`, `repartirEnDieta(n, fecha)`, `hoyMadrid()`, `formatoFecha(fecha)`, `FRANJAS_TANDA`

- [ ] **Step 1: Escribir el test que falla**

```ts
// scripts/contenido-fechas.test.ts
import assert from 'node:assert/strict'
import { formatoFecha, lunesDe, repartirEnDieta, semanaYDia, sumarDias } from '../lib/contenido/fechas'

// 2026-10-07 es miércoles
assert.equal(lunesDe('2026-10-07'), '2026-10-05')
assert.equal(lunesDe('2026-10-05'), '2026-10-05')
assert.equal(lunesDe('2026-10-11'), '2026-10-05') // domingo
assert.equal(sumarDias('2026-10-31', 1), '2026-11-01')
assert.equal(sumarDias('2026-12-31', 1), '2027-01-01')
assert.equal(formatoFecha('2026-10-07'), '07-10-2026')

const hoy = '2026-10-07'
assert.deepEqual(semanaYDia('2026-10-12', hoy), { semana: 1, dia: 'Lunes' })
assert.deepEqual(semanaYDia('2026-10-18', hoy), { semana: 1, dia: 'Domingo' })
assert.deepEqual(semanaYDia('2026-11-30', hoy), { semana: 8, dia: 'Lunes' })
// Semana en curso, pasada o demasiado lejana: no se puede colocar
assert.equal(semanaYDia('2026-10-09', hoy), null)
assert.equal(semanaYDia('2026-10-05', hoy), null)
assert.equal(semanaYDia('2026-09-28', hoy), null)
assert.equal(semanaYDia('2026-12-07', hoy), null)
assert.equal(semanaYDia('no-es-fecha', hoy), null)

// Reparto: 2 recetas por día (Comida y Cena), desde la fecha de grabación
assert.deepEqual(repartirEnDieta(0, '2026-10-17'), [])
assert.deepEqual(repartirEnDieta(3, '2026-10-17'), [
  { fecha: '2026-10-17', franja: 'Comida' },
  { fecha: '2026-10-17', franja: 'Cena' },
  { fecha: '2026-10-18', franja: 'Comida' },
])

console.log('contenido-fechas: OK')
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `cd nutricoach && npx tsx scripts/contenido-fechas.test.ts`
Expected: FAIL (`Cannot find module '../lib/contenido/fechas'`)

- [ ] **Step 3: Implementar**

```ts
// lib/contenido/fechas.ts
// Fechas como 'YYYY-MM-DD'. Se calcula en UTC a mediodía para evitar saltos por zona horaria u horario de verano.
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
export const FRANJAS_TANDA = ['Comida', 'Cena'] as const
export const MAX_SEMANAS_FUTURAS = 8
const FORMATO = /^\d{4}-\d{2}-\d{2}$/

function aDate(fecha: string): Date | null {
  if (!FORMATO.test(fecha)) return null
  const d = new Date(`${fecha}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function aTexto(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function sumarDias(fecha: string, n: number): string {
  const d = aDate(fecha)
  if (!d) throw new Error('Fecha no válida')
  d.setUTCDate(d.getUTCDate() + n)
  return aTexto(d)
}

export function lunesDe(fecha: string): string {
  const d = aDate(fecha)
  if (!d) throw new Error('Fecha no válida')
  const desdeLunes = (d.getUTCDay() + 6) % 7
  return sumarDias(fecha, -desdeLunes)
}

/** Semana (1 = la próxima respecto a `hoy`) y día de la semana de una fecha, o null si no cae en las semanas planificables (+1…+8). */
export function semanaYDia(fecha: string, hoy: string): { semana: number; dia: string } | null {
  const d = aDate(fecha)
  const h = aDate(hoy)
  if (!d || !h) return null
  const dias = Math.round((aDate(lunesDe(fecha))!.getTime() - aDate(lunesDe(hoy))!.getTime()) / 86_400_000)
  const semana = dias / 7
  if (!Number.isInteger(semana) || semana < 1 || semana > MAX_SEMANAS_FUTURAS) return null
  return { semana, dia: DIAS[(d.getUTCDay() + 6) % 7] }
}

/** Dos recetas por día (Comida y Cena) desde la fecha de grabación. */
export function repartirEnDieta(n: number, fecha: string): { fecha: string; franja: typeof FRANJAS_TANDA[number] }[] {
  return Array.from({ length: n }, (_, i) => ({
    fecha: sumarDias(fecha, Math.floor(i / FRANJAS_TANDA.length)),
    franja: FRANJAS_TANDA[i % FRANJAS_TANDA.length],
  }))
}

/** Hoy en Madrid como 'YYYY-MM-DD'. */
export function hoyMadrid(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
}

export function formatoFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}-${m}-${y}`
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `cd nutricoach && npx tsx scripts/contenido-fechas.test.ts`
Expected: `contenido-fechas: OK`

- [ ] **Step 5: Commit**

```bash
cd nutricoach && git add lib/contenido/fechas.ts scripts/contenido-fechas.test.ts
git commit -m "feat(contenido): fechas, semana relativa y reparto en la dieta

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Enlaces y resumen de la tanda

**Files:**
- Create: `lib/contenido/enlace.ts`, `lib/contenido/tanda.ts`
- Test: `scripts/contenido-enlace-tanda.test.ts`

**Interfaces:**
- Consumes: `planosPendientes` de `./escaleta`
- Produces: `normalizarEnlace(raw)`, `interpretarEntrada(texto)`, `ordenarCocinado(recetas)`, `resumenTanda(items)`

- [ ] **Step 1: Escribir el test que falla**

```ts
// scripts/contenido-enlace-tanda.test.ts
import assert from 'node:assert/strict'
import { interpretarEntrada, normalizarEnlace } from '../lib/contenido/enlace'
import { ordenarCocinado, resumenTanda } from '../lib/contenido/tanda'

// Enlaces: mismos reels con parámetros de seguimiento, http o www, barra final
assert.equal(normalizarEnlace('https://www.instagram.com/reel/ABC123/?igsh=xyz'), 'instagram.com/reel/ABC123')
assert.equal(normalizarEnlace('http://instagram.com/reel/ABC123'), 'instagram.com/reel/ABC123')
assert.equal(normalizarEnlace('https://instagram.com/reel/ABC123/#frag'), 'instagram.com/reel/ABC123')
assert.equal(normalizarEnlace('https://www.tiktok.com/@user/video/123?is_from_webapp=1'), 'tiktok.com/@user/video/123')
// El id de los ids de Instagram distingue mayúsculas
assert.notEqual(normalizarEnlace('https://instagram.com/reel/AbC'), normalizarEnlace('https://instagram.com/reel/abc'))
// YouTube watch conserva v
assert.equal(normalizarEnlace('https://www.youtube.com/watch?v=Q1w2E3&t=10s'), 'youtube.com/watch?v=Q1w2E3')
assert.equal(normalizarEnlace('https://youtu.be/Q1w2E3?si=zz'), 'youtu.be/Q1w2E3')
// No válidos
assert.equal(normalizarEnlace('no es un enlace'), null)
assert.equal(normalizarEnlace('ftp://x.com/a'), null)
assert.equal(normalizarEnlace(''), null)

// Entrada rápida
assert.deepEqual(interpretarEntrada('bowl salmón teriyaki https://instagram.com/reel/x/'), { titulo: 'bowl salmón teriyaki', enlace: 'https://instagram.com/reel/x/' })
assert.deepEqual(interpretarEntrada('https://www.tiktok.com/@u/video/1'), { titulo: 'Enlace de tiktok.com', enlace: 'https://www.tiktok.com/@u/video/1' })
assert.deepEqual(interpretarEntrada('  gofres de boniato  '), { titulo: 'gofres de boniato', enlace: null })
assert.deepEqual(interpretarEntrada(''), { titulo: '', enlace: null })

// Orden de cocinado: más largo primero, sin tiempo al final, desempate por nombre
const orden = ordenarCocinado([
  { nombre: 'Tostada', tiempo_prep_min: 5 },
  { nombre: 'Sin tiempo', tiempo_prep_min: null },
  { nombre: 'Lasaña', tiempo_prep_min: 90 },
  { nombre: 'Bowl', tiempo_prep_min: 5 },
])
assert.deepEqual(orden.map(r => r.nombre), ['Lasaña', 'Bowl', 'Tostada', 'Sin tiempo'])
assert.deepEqual(ordenarCocinado([]), [])

// Resumen de la tanda
assert.deepEqual(resumenTanda([]), { recetas: 0, minutos: 0, planosPendientes: 0 })
assert.deepEqual(
  resumenTanda([
    { tiempo_prep_min: 30, planos_hechos: [] },
    { tiempo_prep_min: null, planos_hechos: ['plato', 'macros'] },
  ]),
  { recetas: 2, minutos: 30, planosPendientes: 10 },
)

console.log('contenido-enlace-tanda: OK')
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `cd nutricoach && npx tsx scripts/contenido-enlace-tanda.test.ts`
Expected: FAIL (`Cannot find module '../lib/contenido/enlace'`)

- [ ] **Step 3: Implementar**

```ts
// lib/contenido/enlace.ts
/** Clave comparable de un enlace: sin protocolo, `www`, parámetros ni barra final. YouTube conserva `v`. */
export function normalizarEnlace(raw: string): string | null {
  let u: URL
  try { u = new URL(raw.trim()) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  const path = u.pathname.replace(/\/+$/, '')
  if (host === 'youtube.com' && path === '/watch') {
    const v = u.searchParams.get('v')
    if (v) return `${host}${path}?v=${v}`
  }
  return `${host}${path}`
}

/** Entrada rápida de la bandeja: texto libre, enlace o ambos. */
export function interpretarEntrada(texto: string): { titulo: string; enlace: string | null } {
  const t = texto.trim()
  const m = t.match(/https?:\/\/\S+/)
  if (!m) return { titulo: t, enlace: null }
  const enlace = m[0]
  const resto = t.replace(enlace, '').replace(/\s+/g, ' ').trim()
  if (resto) return { titulo: resto, enlace }
  const clave = normalizarEnlace(enlace)
  return { titulo: clave ? `Enlace de ${clave.split('/')[0]}` : 'Idea sin título', enlace }
}
```

```ts
// lib/contenido/tanda.ts
import { planosPendientes } from './escaleta'

/** Más largo primero; sin tiempo al final; desempate por nombre. */
export function ordenarCocinado<T extends { nombre: string; tiempo_prep_min: number | null }>(recetas: T[]): T[] {
  return [...recetas].sort((a, b) =>
    (b.tiempo_prep_min ?? -1) - (a.tiempo_prep_min ?? -1) || a.nombre.localeCompare(b.nombre))
}

export function resumenTanda(items: { tiempo_prep_min: number | null; planos_hechos: string[] }[]) {
  return {
    recetas: items.length,
    minutos: items.reduce((t, i) => t + (i.tiempo_prep_min ?? 0), 0),
    planosPendientes: items.reduce((t, i) => t + planosPendientes(i.planos_hechos), 0),
  }
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `cd nutricoach && npx tsx scripts/contenido-enlace-tanda.test.ts`
Expected: `contenido-enlace-tanda: OK`

- [ ] **Step 5: Commit**

```bash
cd nutricoach && git add lib/contenido/enlace.ts lib/contenido/tanda.ts scripts/contenido-enlace-tanda.test.ts
git commit -m "feat(contenido): normalizar enlaces, entrada rápida y resumen de tanda

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Extraer `agregarIngredientes` y compra de la tanda

**Files:**
- Create: `lib/lista-compra/agregar.ts`, `lib/contenido/compra-tanda.ts`
- Modify: `app/api/lista-compra/semanal/route.ts` (líneas 10-12 import, 33-62 tipos y función)
- Test: `scripts/lista-compra-agregar.test.ts`

**Interfaces:**
- Produces: `agregarIngredientes(fuentes)`, `type FuenteIngrediente`, `type IngredienteAgregado`; `compraDeTanda(db, recetaIds)` → `{ lineas: LineaCompraTanda[]; costeEstimado: number }`

- [ ] **Step 1: Escribir el test que falla**

```ts
// scripts/lista-compra-agregar.test.ts
import assert from 'node:assert/strict'
import { agregarIngredientes, type FuenteIngrediente } from '../lib/lista-compra/agregar'

const f = (alimento_id: string, alimento_nombre: string, categoria: string, cantidad_gramos: number, receta_nombre: string): FuenteIngrediente =>
  ({ alimento_id, alimento_nombre, categoria, es_generico: true, cantidad_gramos, receta_nombre })

assert.equal(agregarIngredientes([]).size, 0)

const mapa = agregarIngredientes([
  f('a1', 'Pechuga de pollo', 'Carnes', 200, 'Bowl'),
  f('a1', 'Pechuga de pollo', 'Carnes', 300, 'Wrap'),
  f('agua', 'Agua', 'Otros', 500, 'Bowl'),
  f('sal', 'Sal', 'Otros', 5, 'Bowl'),
  f('h1', 'Huevo L', 'Huevos', 120, 'Bowl'),
  f('h2', 'Huevos camperos', 'Huevos', 60, 'Wrap'),
])
const items = [...mapa.values()]
// agua y sal no se compran; los dos tipos de huevo se unifican
assert.equal(items.length, 2)
const pollo = items.find(i => i.alimento_ids.includes('a1'))!
assert.equal(pollo.cantidad_gramos_total, 500)
assert.deepEqual([...pollo.recetas_origen].sort(), ['Bowl', 'Wrap'])
const huevos = items.find(i => i.alimento_nombre === 'Huevos')!
assert.equal(huevos.cantidad_gramos_total, 180)
assert.deepEqual([...huevos.alimento_ids].sort(), ['h1', 'h2'])

console.log('lista-compra-agregar: OK')
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `cd nutricoach && npx tsx scripts/lista-compra-agregar.test.ts`
Expected: FAIL (`Cannot find module '../lib/lista-compra/agregar'`)

- [ ] **Step 3: Crear `lib/lista-compra/agregar.ts` moviendo el código de la ruta**

```ts
// lib/lista-compra/agregar.ts
import { canonicalizarItemCompra, esIngredienteBasicoNoCompra } from './filtros'
import type { IngredienteSemanal } from '@/types'

export type FuenteIngrediente = {
    alimento_id: string; alimento_nombre: string; categoria: string; es_generico: boolean
    cantidad_gramos: number; receta_nombre: string
}
export type IngredienteAgregado = Omit<IngredienteSemanal, 'precios' | 'seleccion'> & { alimento_ids: string[] }

export function agregarIngredientes(fuentes: FuenteIngrediente[]) {
    const mapa = new Map<string, IngredienteAgregado>()
    for (const fuente of fuentes) {
        if (esIngredienteBasicoNoCompra(fuente.alimento_nombre)) continue
        const canonical = canonicalizarItemCompra({ id: fuente.alimento_id, nombre: fuente.alimento_nombre, categoria: fuente.categoria })
        const existing = mapa.get(canonical.key)
        if (existing) {
            existing.cantidad_gramos_total += fuente.cantidad_gramos || 0
            existing.alimento_ids = Array.from(new Set([...existing.alimento_ids, fuente.alimento_id]))
            if (!existing.recetas_origen.includes(fuente.receta_nombre)) existing.recetas_origen.push(fuente.receta_nombre)
        } else {
            mapa.set(canonical.key, {
                alimento_id: fuente.alimento_id, alimento_ids: [fuente.alimento_id], alimento_nombre: canonical.nombre,
                categoria: canonical.categoria, es_generico: fuente.es_generico, cantidad_gramos_total: fuente.cantidad_gramos || 0,
                recetas_origen: [fuente.receta_nombre],
            })
        }
    }
    return mapa
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `cd nutricoach && npx tsx scripts/lista-compra-agregar.test.ts`
Expected: `lista-compra-agregar: OK`

- [ ] **Step 5: Hacer que la ruta semanal importe la función**

En `app/api/lista-compra/semanal/route.ts`:

1. Sustituir la línea `import { canonicalizarItemCompra, esIngredienteBasicoNoCompra } from '@/lib/lista-compra/filtros'` por `import { agregarIngredientes, type FuenteIngrediente } from '@/lib/lista-compra/agregar'`.
2. Borrar las líneas de `type FuenteIngrediente = {...}`, `type IngredienteAgregado = ...` y la función `agregarIngredientes` completa (el bloque entre `type FuenteIngrediente` y el cierre de `function agregarIngredientes`). Dejar `type ComidaActual` y `type SeleccionGuardada`.
3. Si `IngredienteSemanal` sigue usándose más abajo en el archivo (sí: `const ingredientes: IngredienteSemanal[]`), mantener su import.

Run: `cd nutricoach && npx tsc --noEmit --pretty false`
Expected: sin errores (si TypeScript marca `canonicalizarItemCompra`/`esIngredienteBasicoNoCompra` sin usar o falta algún import, ajustar el import de la ruta).

- [ ] **Step 6: Crear la compra de la tanda**

```ts
// lib/contenido/compra-tanda.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { agregarIngredientes, type FuenteIngrediente } from '@/lib/lista-compra/agregar'

export type LineaCompraTanda = {
  alimento_id: string
  alimento_nombre: string
  categoria: string
  gramos: number
  recetas: string[]
  coste_estimado: number | null
}

type FilaReceta = {
  id: string; nombre: string
  receta_ingredientes: { cantidad_gramos: number | null; alimento: { id: string; nombre: string; categoria: string | null; es_generico: boolean | null } | null }[]
}

const redondear = (n: number) => Math.round(n * 100) / 100

/** Compra consolidada de una tanda: cantidades completas de cada receta, sumadas por alimento. Coste con el precio más barato. */
export async function compraDeTanda(db: SupabaseClient, recetaIds: string[]): Promise<{ lineas: LineaCompraTanda[]; costeEstimado: number }> {
  if (recetaIds.length === 0) return { lineas: [], costeEstimado: 0 }
  const { data, error } = await db.from('recetas')
    .select('id, nombre, receta_ingredientes!receta_ingredientes_receta_id_fkey(cantidad_gramos, alimento:alimentos(id, nombre, categoria, es_generico))')
    .in('id', recetaIds)
  if (error) throw new Error('No se pudieron leer los ingredientes de la tanda')

  const fuentes: FuenteIngrediente[] = ((data ?? []) as unknown as FilaReceta[]).flatMap(r =>
    r.receta_ingredientes.flatMap(i => i.alimento && Number(i.cantidad_gramos) > 0 ? [{
      alimento_id: i.alimento.id, alimento_nombre: i.alimento.nombre, categoria: i.alimento.categoria ?? 'Otros',
      es_generico: i.alimento.es_generico ?? false, cantidad_gramos: Number(i.cantidad_gramos), receta_nombre: r.nombre,
    }] : []))

  const agregados = [...agregarIngredientes(fuentes).values()]
  const alimentoIds = [...new Set(agregados.flatMap(a => a.alimento_ids))]
  const minPorAlimento = new Map<string, number>()
  if (alimentoIds.length > 0) {
    const { data: precios } = await db.from('precios_actuales')
      .select('alimento_id, precio_por_kg').in('alimento_id', alimentoIds).gt('precio_por_kg', 0)
    for (const p of (precios ?? []) as { alimento_id: string; precio_por_kg: number }[]) {
      const actual = minPorAlimento.get(p.alimento_id)
      if (actual === undefined || p.precio_por_kg < actual) minPorAlimento.set(p.alimento_id, p.precio_por_kg)
    }
  }

  const lineas: LineaCompraTanda[] = agregados.map(a => {
    const candidatos = a.alimento_ids.map(id => minPorAlimento.get(id)).filter((n): n is number => n !== undefined)
    const mejor = candidatos.length > 0 ? Math.min(...candidatos) : null
    return {
      alimento_id: a.alimento_id, alimento_nombre: a.alimento_nombre, categoria: a.categoria,
      gramos: Math.round(a.cantidad_gramos_total), recetas: a.recetas_origen,
      coste_estimado: mejor === null ? null : redondear((a.cantidad_gramos_total / 1000) * mejor),
    }
  }).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.alimento_nombre.localeCompare(b.alimento_nombre))

  return { lineas, costeEstimado: redondear(lineas.reduce((t, l) => t + (l.coste_estimado ?? 0), 0)) }
}
```

- [ ] **Step 7: Comprobar tipos y que los tests siguen pasando**

Run: `cd nutricoach && npx tsc --noEmit --pretty false && npx tsx scripts/lista-compra-agregar.test.ts`
Expected: sin errores de tipos y `lista-compra-agregar: OK`

- [ ] **Step 8: Commit**

```bash
cd nutricoach && git add lib/lista-compra/agregar.ts lib/contenido/compra-tanda.ts app/api/lista-compra/semanal/route.ts scripts/lista-compra-agregar.test.ts
git commit -m "refactor(compra): extraer agregarIngredientes y añadir compra de tanda

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Migración de `piezas_contenido`

**Files:**
- Create: `supabase/migrations/20261007120000_piezas_contenido.sql`

**Interfaces:**
- Produces: tabla `public.piezas_contenido` con las columnas del spec

- [ ] **Step 1: Escribir la migración**

```sql
-- Piezas de contenido: una receta (o idea) que Carlos quiere grabar y publicar.
-- Fuente de verdad del estado de contenido; recetas.contenido_estado queda como caché derivado del icono.
create table if not exists public.piezas_contenido (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  receta_id uuid references public.recetas(id) on delete set null,
  plan_id uuid references public.planes_nutricion(id) on delete set null,
  titulo text not null,
  enlace_referencia text,
  notas text,
  gancho text,
  estado text not null default 'idea'
    check (estado in ('idea', 'documentada', 'para_grabar', 'grabada', 'editada', 'programada', 'publicada')),
  fecha_grabacion date,
  fecha_publicacion date,
  planos_hechos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists piezas_contenido_coach_estado_idx on public.piezas_contenido (coach_id, estado);
create index if not exists piezas_contenido_receta_idx on public.piezas_contenido (receta_id);
create index if not exists piezas_contenido_grabacion_idx on public.piezas_contenido (coach_id, fecha_grabacion);

alter table public.piezas_contenido enable row level security;

create policy piezas_contenido_coach on public.piezas_contenido
  for all to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

comment on table public.piezas_contenido is
  'Ideas y recetas a grabar/publicar por el coach. Las rutas API usan service role y filtran por coach_id.';

-- Copia lo que ya estaba marcado con el icono del planificador. Lo grabado entra con la escaleta completa.
insert into public.piezas_contenido (coach_id, receta_id, titulo, estado, planos_hechos)
select r.coach_id, r.id, r.nombre, r.contenido_estado,
       case when r.contenido_estado = 'grabada'
            then array['ingredientes', 'proceso', 'cocinado', 'plato', 'detalle', 'macros']
            else '{}'::text[] end
from public.recetas r
where r.contenido_estado is not null
  and r.coach_id is not null
  and not exists (select 1 from public.piezas_contenido p where p.receta_id = r.id);
```

- [ ] **Step 2: Comprobar que `recetas.coach_id` existe y cuántas filas se copiarán**

Pedir a Carlos que ejecute en el SQL Editor de Supabase (o hacerlo si hay acceso con confirmación):

```sql
select count(*) filter (where contenido_estado is not null) as marcadas,
       count(*) filter (where contenido_estado is not null and coach_id is null) as sin_coach
from public.recetas;
```

Expected: la consulta no da error (la columna `coach_id` existe). Si `sin_coach > 0`, esas recetas no se copian; avisar a Carlos del número.

- [ ] **Step 3: Pedir confirmación a Carlos y aplicar la migración**

Mostrar a Carlos el SQL y pedir su visto bueno. Aplicarla con su método habitual (SQL Editor de Supabase, o `supabase db push` si el proyecto está enlazado). **No continuar a la tarea 7 con push hasta que esté aplicada.**

- [ ] **Step 4: Verificar que está aplicada**

En el SQL Editor:

```sql
select count(*) as piezas, count(*) filter (where estado = 'grabada') as grabadas from public.piezas_contenido;
select policyname from pg_policies where tablename = 'piezas_contenido';
```

Expected: `piezas` igual a las recetas marcadas copiadas, y una política `piezas_contenido_coach`.

- [ ] **Step 5: Commit**

```bash
cd nutricoach && git add supabase/migrations/20261007120000_piezas_contenido.sql
git commit -m "feat(contenido): tabla piezas_contenido con RLS y copia del icono actual

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Validación, autorización, API de piezas y vínculo del icono

**Files:**
- Create: `lib/contenido/validacion.ts`, `lib/contenido/auth.ts`, `lib/contenido/piezas.ts`, `app/api/contenido/piezas/route.ts`, `app/api/contenido/piezas/[id]/route.ts`
- Modify: `app/api/recetas/[id]/contenido/route.ts`
- Test: `scripts/contenido-validacion.test.ts`

**Interfaces:**
- Consumes: `esEstadoPieza`, `estadoIconoReceta`, `planificarIcono` (Task 1); `IDS_PLANOS`, `estadoTrasPlanos`, `planosTrasEstado` (Task 2); `normalizarEnlace` (Task 4)
- Produces: `limpiarCambios(body)`, `type CambiosPieza`, `autorizarCoach(request)`, `buscarRecetaPorEnlace(db, enlace)`, `sincronizarIconoReceta(db, coachId, recetaId)`, `anadirRecetasATanda(db, coachId, fecha, recetaIds)`, `SELECT_PIEZA`; rutas `GET/POST /api/contenido/piezas`, `PATCH/DELETE /api/contenido/piezas/[id]`

- [ ] **Step 1: Escribir el test que falla**

```ts
// scripts/contenido-validacion.test.ts
import assert from 'node:assert/strict'
import { limpiarCambios } from '../lib/contenido/validacion'

const ok = (b: unknown) => { const r = limpiarCambios(b); assert.equal(r.ok, true, JSON.stringify(r)); return (r as { ok: true; cambios: Record<string, unknown> }).cambios }
const mal = (b: unknown) => assert.equal(limpiarCambios(b).ok, false, JSON.stringify(b))

assert.deepEqual(ok({}), {})
assert.deepEqual(ok({ titulo: '  Bowl  ', estado: 'para_grabar' }), { titulo: 'Bowl', estado: 'para_grabar' })
assert.deepEqual(ok({ notas: '', enlace_referencia: null }), { notas: null, enlace_referencia: null })
assert.deepEqual(ok({ fecha_grabacion: '2026-10-17', fecha_publicacion: null }), { fecha_grabacion: '2026-10-17', fecha_publicacion: null })
assert.deepEqual(ok({ planos_hechos: ['plato', 'plato', 'macros'] }), { planos_hechos: ['plato', 'macros'] })
assert.deepEqual(ok({ receta_id: '123e4567-e89b-12d3-a456-426614174000' }), { receta_id: '123e4567-e89b-12d3-a456-426614174000' })

// Entradas inválidas: nunca se guardan
mal(null)
mal('texto')
mal({ estado: 'inventado' })
mal({ titulo: '' })
mal({ titulo: 'x'.repeat(201) })
mal({ fecha_grabacion: '17-10-2026' })
mal({ fecha_grabacion: '2026-13-45' })
mal({ planos_hechos: ['plato', 'desconocido'] })
mal({ planos_hechos: 'plato' })
mal({ receta_id: 'no-uuid' })
mal({ notas: 5 })

// Campos no permitidos se ignoran
assert.deepEqual(ok({ titulo: 'A', coach_id: 'otro', id: 'x' }), { titulo: 'A' })

console.log('contenido-validacion: OK')
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `cd nutricoach && npx tsx scripts/contenido-validacion.test.ts`
Expected: FAIL (`Cannot find module '../lib/contenido/validacion'`)

- [ ] **Step 3: Implementar la validación**

```ts
// lib/contenido/validacion.ts
import { esEstadoPieza, type EstadoPieza } from './estados'
import { IDS_PLANOS } from './escaleta'

export type CambiosPieza = {
  titulo?: string
  enlace_referencia?: string | null
  notas?: string | null
  gancho?: string | null
  estado?: EstadoPieza
  fecha_grabacion?: string | null
  fecha_publicacion?: string | null
  receta_id?: string | null
  plan_id?: string | null
  planos_hechos?: string[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const LIMITES = { titulo: 200, enlace_referencia: 500, notas: 2000, gancho: 200 } as const

/** Valida el cuerpo de las rutas de piezas y devuelve solo los campos permitidos. */
export function limpiarCambios(body: unknown): { ok: true; cambios: CambiosPieza } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Cuerpo no válido' }
  const b = body as Record<string, unknown>
  const c: CambiosPieza = {}

  if ('titulo' in b) {
    const v = b.titulo
    if (typeof v !== 'string' || !v.trim() || v.trim().length > LIMITES.titulo) return { ok: false, error: 'Título no válido' }
    c.titulo = v.trim()
  }
  for (const k of ['enlace_referencia', 'notas', 'gancho'] as const) {
    if (!(k in b)) continue
    const v = b[k]
    if (v === null || v === '') { c[k] = null; continue }
    if (typeof v !== 'string' || v.trim().length > LIMITES[k]) return { ok: false, error: `${k} no válido` }
    c[k] = v.trim()
  }
  if ('estado' in b) {
    if (!esEstadoPieza(b.estado)) return { ok: false, error: 'Estado no válido' }
    c.estado = b.estado
  }
  for (const k of ['fecha_grabacion', 'fecha_publicacion'] as const) {
    if (!(k in b)) continue
    const v = b[k]
    if (v === null) { c[k] = null; continue }
    if (typeof v !== 'string' || !FECHA.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) return { ok: false, error: `${k} no válida` }
    c[k] = v
  }
  for (const k of ['receta_id', 'plan_id'] as const) {
    if (!(k in b)) continue
    const v = b[k]
    if (v === null) { c[k] = null; continue }
    if (typeof v !== 'string' || !UUID.test(v)) return { ok: false, error: `${k} no válido` }
    c[k] = v
  }
  if ('planos_hechos' in b) {
    const v = b.planos_hechos
    if (!Array.isArray(v) || !v.every(x => typeof x === 'string' && IDS_PLANOS.includes(x))) return { ok: false, error: 'Planos no válidos' }
    c.planos_hechos = [...new Set(v as string[])]
  }
  return { ok: true, cambios: c }
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `cd nutricoach && npx tsx scripts/contenido-validacion.test.ts`
Expected: `contenido-validacion: OK`

- [ ] **Step 5: Autorización y operaciones con BD**

```ts
// lib/contenido/auth.ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function autorizarCoach(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const admin = createServiceSupabase()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'coach') return { error: NextResponse.json({ error: 'Acceso restringido al coach' }, { status: 403 }) }
  return { admin, userId: user.id }
}
```

```ts
// lib/contenido/piezas.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { estadoIconoReceta, type EstadoPieza } from './estados'
import { normalizarEnlace } from './enlace'

export const SELECT_PIEZA = '*, receta:recetas(id, nombre, imagen_url, tiempo_prep_min, estado, verificacion)'

/** Receta del recetario cuyo `url_origen` coincide con el enlace (ignorando parámetros, www y barra final). */
export async function buscarRecetaPorEnlace(db: SupabaseClient, enlace: string): Promise<{ id: string; nombre: string } | null> {
  const clave = normalizarEnlace(enlace)
  if (!clave) return null
  const { data } = await db.from('recetas').select('id, nombre, url_origen').ilike('url_origen', `%${clave}%`).limit(20)
  const r = (data ?? []).find(x => x.url_origen && normalizarEnlace(x.url_origen) === clave)
  return r ? { id: r.id, nombre: r.nombre } : null
}

/** Recalcula `recetas.contenido_estado` (caché del icono del planificador) a partir de las piezas de la receta. */
export async function sincronizarIconoReceta(db: SupabaseClient, coachId: string, recetaId: string | null) {
  if (!recetaId) return
  const { data } = await db.from('piezas_contenido').select('estado').eq('coach_id', coachId).eq('receta_id', recetaId)
  const icono = estadoIconoReceta((data ?? []).map(p => p.estado as EstadoPieza))
  await db.from('recetas').update({ contenido_estado: icono }).eq('id', recetaId)
}

/** Programa recetas del recetario para grabar en `fecha`: promueve su pieza pendiente o crea una. Devuelve cuántas piezas tocó. */
export async function anadirRecetasATanda(db: SupabaseClient, coachId: string, fecha: string, recetaIds: string[]): Promise<number> {
  if (recetaIds.length === 0) return 0
  const { data: recetas } = await db.from('recetas').select('id, nombre').in('id', recetaIds)
  const { data: existentes } = await db.from('piezas_contenido').select('id, receta_id, estado')
    .eq('coach_id', coachId).in('receta_id', recetaIds).in('estado', ['idea', 'documentada', 'para_grabar'])
  let n = 0
  for (const rec of recetas ?? []) {
    const pieza = (existentes ?? []).find(p => p.receta_id === rec.id)
    const { error } = pieza
      ? await db.from('piezas_contenido').update({ estado: 'para_grabar', fecha_grabacion: fecha, updated_at: new Date().toISOString() }).eq('id', pieza.id)
      : await db.from('piezas_contenido').insert({ coach_id: coachId, receta_id: rec.id, titulo: rec.nombre, estado: 'para_grabar', fecha_grabacion: fecha })
    if (!error) n++
    await sincronizarIconoReceta(db, coachId, rec.id)
  }
  return n
}
```

- [ ] **Step 6: Rutas de piezas**

```ts
// app/api/contenido/piezas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { limpiarCambios } from '@/lib/contenido/validacion'
import { planosTrasEstado } from '@/lib/contenido/escaleta'
import { buscarRecetaPorEnlace, SELECT_PIEZA, sincronizarIconoReceta } from '@/lib/contenido/piezas'

export async function GET(request: NextRequest) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const { data, error } = await r.admin.from('piezas_contenido').select(SELECT_PIEZA)
    .eq('coach_id', r.userId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'No se pudieron cargar las piezas' }, { status: 500 })
  return NextResponse.json({ piezas: data ?? [] })
}

export async function POST(request: NextRequest) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const v = limpiarCambios(await request.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const c = v.cambios
  if (!c.titulo) return NextResponse.json({ error: 'Falta el título' }, { status: 400 })

  const recetaId = c.receta_id ?? (c.enlace_referencia ? (await buscarRecetaPorEnlace(r.admin, c.enlace_referencia))?.id ?? null : null)
  const estado = c.estado ?? 'idea'
  const { data, error } = await r.admin.from('piezas_contenido').insert({
    coach_id: r.userId, titulo: c.titulo, enlace_referencia: c.enlace_referencia ?? null, notas: c.notas ?? null, gancho: c.gancho ?? null,
    estado, receta_id: recetaId, plan_id: c.plan_id ?? null,
    fecha_grabacion: c.fecha_grabacion ?? null, fecha_publicacion: c.fecha_publicacion ?? null,
    planos_hechos: planosTrasEstado(estado, c.planos_hechos ?? []),
  }).select(SELECT_PIEZA).single()
  if (error) return NextResponse.json({ error: 'No se pudo crear la pieza' }, { status: 500 })
  await sincronizarIconoReceta(r.admin, r.userId, recetaId)
  return NextResponse.json({ pieza: data }, { status: 201 })
}
```

```ts
// app/api/contenido/piezas/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { limpiarCambios } from '@/lib/contenido/validacion'
import { estadoTrasPlanos, planosTrasEstado } from '@/lib/contenido/escaleta'
import type { EstadoPieza } from '@/lib/contenido/estados'
import { SELECT_PIEZA, sincronizarIconoReceta } from '@/lib/contenido/piezas'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const { id } = await params
  const v = limpiarCambios(await request.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const { data: actual } = await r.admin.from('piezas_contenido').select('estado, planos_hechos, receta_id')
    .eq('id', id).eq('coach_id', r.userId).maybeSingle()
  if (!actual) return NextResponse.json({ error: 'Pieza no encontrada' }, { status: 404 })

  const cambios: Record<string, unknown> = { ...v.cambios, updated_at: new Date().toISOString() }
  const c = v.cambios
  if (c.estado && c.planos_hechos === undefined) cambios.planos_hechos = planosTrasEstado(c.estado, actual.planos_hechos ?? [])
  if (c.planos_hechos && !c.estado) cambios.estado = estadoTrasPlanos(actual.estado as EstadoPieza, c.planos_hechos)

  const { data, error } = await r.admin.from('piezas_contenido').update(cambios)
    .eq('id', id).eq('coach_id', r.userId).select(SELECT_PIEZA).single()
  if (error) return NextResponse.json({ error: 'No se pudo actualizar la pieza' }, { status: 500 })
  await sincronizarIconoReceta(r.admin, r.userId, actual.receta_id)
  if (c.receta_id !== undefined && c.receta_id !== actual.receta_id) await sincronizarIconoReceta(r.admin, r.userId, c.receta_id)
  return NextResponse.json({ pieza: data })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const { id } = await params
  const { data: actual } = await r.admin.from('piezas_contenido').select('receta_id').eq('id', id).eq('coach_id', r.userId).maybeSingle()
  if (!actual) return NextResponse.json({ error: 'Pieza no encontrada' }, { status: 404 })
  const { error } = await r.admin.from('piezas_contenido').delete().eq('id', id).eq('coach_id', r.userId)
  if (error) return NextResponse.json({ error: 'No se pudo borrar la pieza' }, { status: 500 })
  await sincronizarIconoReceta(r.admin, r.userId, actual.receta_id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Reconectar el icono del planificador a las piezas**

Sustituir el contenido completo de `app/api/recetas/[id]/contenido/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { estadoIconoReceta, planificarIcono, type EstadoPieza, type IconoReceta } from '@/lib/contenido/estados'
import { planosTrasEstado } from '@/lib/contenido/escaleta'
import { sincronizarIconoReceta } from '@/lib/contenido/piezas'

const DESTINOS: IconoReceta[] = ['para_grabar', 'grabada', null]

// El icono del planificador escribe en las piezas de contenido; recetas.contenido_estado es solo su caché derivado.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error

  const { id } = await params
  const body = await request.json().catch(() => null) as { contenido_estado?: string | null } | null
  const destino = (body?.contenido_estado ?? null) as IconoReceta
  if (!DESTINOS.includes(destino)) return NextResponse.json({ error: 'Estado no válido' }, { status: 400 })

  const { data: receta } = await r.admin.from('recetas').select('id, nombre').eq('id', id).maybeSingle()
  if (!receta) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })
  const { data: piezas } = await r.admin.from('piezas_contenido').select('id, estado').eq('coach_id', r.userId).eq('receta_id', id)
  const accion = planificarIcono((piezas ?? []) as { id: string; estado: EstadoPieza }[], destino)

  const ahora = new Date().toISOString()
  if (accion.crear) {
    await r.admin.from('piezas_contenido').insert({
      coach_id: r.userId, receta_id: id, titulo: receta.nombre, estado: accion.crear,
      planos_hechos: planosTrasEstado(accion.crear, []),
    })
  }
  for (const a of accion.actualizar) {
    await r.admin.from('piezas_contenido')
      .update({ estado: a.estado, planos_hechos: planosTrasEstado(a.estado, []), updated_at: ahora }).eq('id', a.id).eq('coach_id', r.userId)
  }
  if (accion.borrar.length > 0) await r.admin.from('piezas_contenido').delete().in('id', accion.borrar).eq('coach_id', r.userId)

  await sincronizarIconoReceta(r.admin, r.userId, id)
  const { data: despues } = await r.admin.from('piezas_contenido').select('estado').eq('coach_id', r.userId).eq('receta_id', id)
  return NextResponse.json({ ok: true, contenido_estado: estadoIconoReceta((despues ?? []).map(p => p.estado as EstadoPieza)) })
}
```

- [ ] **Step 8: Comprobar tipos y tests**

Run: `cd nutricoach && npx tsc --noEmit --pretty false && for t in estados escaleta fechas enlace-tanda validacion; do npx tsx scripts/contenido-$t.test.ts || break; done`
Expected: sin errores de tipos; cinco líneas `contenido-…: OK`.

- [ ] **Step 9: Commit (sin push hasta que la migración de la tarea 6 esté aplicada)**

```bash
cd nutricoach && git add lib/contenido app/api/contenido app/api/recetas/\[id\]/contenido/route.ts scripts/contenido-validacion.test.ts
git commit -m "feat(contenido): API de piezas y vínculo del icono del planificador

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Menú, apartado y bandeja de ideas

**Files:**
- Create: `app/contenido/layout.tsx`, `app/contenido/page.tsx`, `app/api/contenido/recetas/route.ts`, `components/contenido/tipos.ts`, `components/contenido/api.ts`, `components/contenido/SelectorReceta.tsx`, `components/contenido/BandejaIdeas.tsx`
- Modify: `components/Sidebar.tsx` (import de lucide, `PRIMARY_ITEMS`)

**Interfaces:**
- Consumes: rutas de la tarea 7; `interpretarEntrada` (Task 4); `ETIQUETA_ESTADO`
- Produces: tipo `Pieza`, `RecetaPieza`; helper `api<T>(url, init)`; componente `SelectorReceta({ onElegir })`; página con `VISTAS` ampliable

- [ ] **Step 1: Ruta de búsqueda de recetas del recetario**

```ts
// app/api/contenido/recetas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'

export async function GET(request: NextRequest) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  let consulta = r.admin.from('recetas').select('id, nombre, imagen_url, tiempo_prep_min').eq('estado', 'aprobada').order('nombre').limit(30)
  if (q) consulta = consulta.ilike('nombre', `%${q}%`)
  const { data, error } = await consulta
  if (error) return NextResponse.json({ error: 'No se pudieron cargar las recetas' }, { status: 500 })
  return NextResponse.json({ recetas: data ?? [] })
}
```

- [ ] **Step 2: Tipos y helper de llamadas**

```ts
// components/contenido/tipos.ts
import type { EstadoPieza } from '@/lib/contenido/estados'

export type RecetaPieza = {
  id: string; nombre: string; imagen_url: string | null; tiempo_prep_min: number | null
  instrucciones?: string | null; estado?: string; verificacion?: string | null
}

export type Pieza = {
  id: string; titulo: string; enlace_referencia: string | null; notas: string | null; gancho: string | null
  estado: EstadoPieza; fecha_grabacion: string | null; fecha_publicacion: string | null
  receta_id: string | null; plan_id: string | null; planos_hechos: string[]; receta: RecetaPieza | null
}
```

```ts
// components/contenido/api.ts
export async function api<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? 'Error de servidor' }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, error: 'Sin conexión' }
  }
}
```

- [ ] **Step 3: Selector de receta**

```tsx
// components/contenido/SelectorReceta.tsx
'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from './api'

type Resultado = { id: string; nombre: string; imagen_url: string | null; tiempo_prep_min: number | null }

export default function SelectorReceta({ onElegir, placeholder = 'Buscar en el recetario…' }: { onElegir: (r: Resultado) => void; placeholder?: string }) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<Resultado[]>([])

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await api<{ recetas: Resultado[] }>(`/api/contenido/recetas?q=${encodeURIComponent(q)}`)
      if (r.ok) setResultados(r.data.recetas)
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="card" style={{ padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Search size={14} style={{ color: 'var(--text-muted)' }} />
        <input className="input" style={{ flex: 1 }} value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} />
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 6 }}>
        {resultados.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: 6 }}>Sin resultados</p>}
        {resultados.map(r => (
          <button key={r.id} type="button" className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => onElegir(r)}>
            {r.nombre}{r.tiempo_prep_min ? ` · ${r.tiempo_prep_min} min` : ''}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Bandeja de ideas**

```tsx
// components/contenido/BandejaIdeas.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileCheck2, Link2, Plus, Trash2, Video } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { interpretarEntrada } from '@/lib/contenido/enlace'
import { ETIQUETA_ESTADO } from '@/lib/contenido/estados'
import { api } from './api'
import SelectorReceta from './SelectorReceta'
import type { Pieza } from './tipos'

const ESTADOS_BANDEJA = ['idea', 'documentada']

export default function BandejaIdeas() {
  const { addToast } = useToast()
  const [texto, setTexto] = useState('')
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [cargando, setCargando] = useState(true)
  const [enlazando, setEnlazando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const r = await api<{ piezas: Pieza[] }>('/api/contenido/piezas')
    if (r.ok) setPiezas(r.data.piezas.filter(p => ESTADOS_BANDEJA.includes(p.estado)))
    else addToast({ type: 'error', title: 'No se pudieron cargar las ideas', message: r.error })
    setCargando(false)
  }, [addToast])

  useEffect(() => { cargar() }, [cargar])

  async function apuntar() {
    const { titulo, enlace } = interpretarEntrada(texto)
    if (!titulo) return
    const r = await api('/api/contenido/piezas', { method: 'POST', body: JSON.stringify({ titulo, enlace_referencia: enlace }) })
    if (!r.ok) { addToast({ type: 'error', title: 'No se pudo apuntar', message: r.error }); return }
    setTexto('')
    cargar()
  }

  async function cambiar(id: string, cambios: Record<string, unknown>) {
    const r = await api(`/api/contenido/piezas/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) })
    if (!r.ok) addToast({ type: 'error', title: 'No se pudo actualizar', message: r.error })
    setEnlazando(null)
    cargar()
  }

  async function borrar(id: string) {
    if (!confirm('¿Borrar esta idea?')) return
    const r = await api(`/api/contenido/piezas/${id}`, { method: 'DELETE' })
    if (!r.ok) addToast({ type: 'error', title: 'No se pudo borrar', message: r.error })
    cargar()
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <form onSubmit={e => { e.preventDefault(); apuntar() }} style={{ display: 'flex', gap: 8 }}>
        <input className="input" style={{ flex: 1 }} value={texto} onChange={e => setTexto(e.target.value)}
          placeholder="Una nota, un enlace del reel o ambos…" aria-label="Apuntar una idea" />
        <button className="btn btn-primary" type="submit"><Plus size={16} /> Apuntar</button>
      </form>

      {cargando && <p style={{ color: 'var(--text-muted)' }}>Cargando…</p>}
      {!cargando && piezas.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No hay ideas pendientes. Apunta la primera arriba.</p>}

      {piezas.map(p => (
        <div key={p.id} className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <strong>{p.titulo}</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{ETIQUETA_ESTADO[p.estado]}</span>
          </div>
          {p.enlace_referencia && (
            <a href={p.enlace_referencia} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <Link2 size={13} /> Ver referencia
            </a>
          )}
          <div style={{ fontSize: 13, color: p.receta ? 'var(--success)' : 'var(--warning)' }}>
            {p.receta ? `Receta en el recetario: ${p.receta.nombre}` : 'Aún sin receta en el recetario'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {p.receta && p.estado === 'idea' && (
              <button className="btn btn-secondary btn-sm" onClick={() => cambiar(p.id, { estado: 'documentada' })}><FileCheck2 size={14} /> Pasar a documentada</button>
            )}
            {!p.receta && <button className="btn btn-secondary btn-sm" onClick={() => setEnlazando(enlazando === p.id ? null : p.id)}>Enlazar receta</button>}
            <button className="btn btn-secondary btn-sm" onClick={() => cambiar(p.id, { estado: 'para_grabar' })}><Video size={14} /> Marcar para grabar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => borrar(p.id)} aria-label="Borrar idea"><Trash2 size={14} /></button>
          </div>
          {enlazando === p.id && <SelectorReceta onElegir={r => cambiar(p.id, { receta_id: r.id })} />}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Layout y página del apartado**

```tsx
// app/contenido/layout.tsx
import CoachShell from '@/components/CoachShell'

export default function ContenidoLayout({ children }: { children: React.ReactNode }) {
  return <CoachShell>{children}</CoachShell>
}
```

```tsx
// app/contenido/page.tsx
'use client'

import { useState } from 'react'
import BandejaIdeas from '@/components/contenido/BandejaIdeas'

// Las siguientes tareas añaden aquí el resto de vistas (tanda, tablero, calendario).
const VISTAS = [
  { id: 'bandeja', label: 'Bandeja' },
] as const
type Vista = typeof VISTAS[number]['id']

export default function ContenidoPage() {
  const [vista, setVista] = useState<Vista>('bandeja')
  return (
    <div style={{ padding: 16, display: 'grid', gap: 16, maxWidth: 960 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Contenido</h1>
      <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {VISTAS.map(v => (
          <button key={v.id} role="tab" aria-selected={vista === v.id} className={`btn btn-sm ${vista === v.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setVista(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      {vista === 'bandeja' && <BandejaIdeas />}
    </div>
  )
}
```

- [ ] **Step 6: Entrada en el menú**

En `components/Sidebar.tsx`: añadir `Clapperboard,` a la lista de imports de `lucide-react` (orden alfabético, junto a `ChartPie`), y en `PRIMARY_ITEMS`:

```ts
const PRIMARY_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: House },
  { href: '/clientes', label: 'Clientes', icon: UsersRound },
  { href: '/contenido', label: 'Contenido', icon: Clapperboard },
]
```

- [ ] **Step 7: Comprobar tipos y probar en local**

Run: `cd nutricoach && npx tsc --noEmit --pretty false`
Expected: sin errores.

Probar con `npm run dev` y la sesión de Carlos (usar `browse --headed` con handoff; no construir cookies a mano): abrir `/contenido`, apuntar `bowl de prueba https://www.instagram.com/reel/PRUEBA/`, comprobar que aparece en la bandeja con "Aún sin receta en el recetario", pulsar "Marcar para grabar" y comprobar que desaparece de la bandeja. Borrar la pieza de prueba.

- [ ] **Step 8: Commit**

```bash
cd nutricoach && git add app/contenido app/api/contenido/recetas components/contenido components/Sidebar.tsx
git commit -m "feat(contenido): apartado en el menú y bandeja de ideas

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

**Push:** solo si la migración de la tarea 6 está aplicada en producción. Tras el push y el despliegue, abrir `/contenido` en producción y repetir la prueba de apuntar y borrar una idea.

---

### Task 9: Día de grabación (compra, orden, escaleta)

**Files:**
- Create: `app/api/contenido/tanda/route.ts`, `components/contenido/EscaletaPlanos.tsx`, `components/contenido/DiaGrabacion.tsx`
- Modify: `app/contenido/page.tsx` (añadir vista `tanda`)

**Interfaces:**
- Consumes: `compraDeTanda` (Task 5); `ordenarCocinado`, `resumenTanda` (Task 4); `PLANOS`, `alternarPlano` (Task 2); `autorizarSemanaDieta` de `@/lib/nutricion/semana-dieta`; `formatoFecha`, `hoyMadrid` (Task 3)
- Produces: `GET /api/contenido/tanda?fecha=YYYY-MM-DD&cliente_id=<uuid opcional>` → `{ fecha, piezas: Pieza[] (en orden de cocinado), compra: { lineas, costeEstimado }, resumen: { recetas, minutos, planosPendientes, enDieta } }`; `DiaGrabacion({ fechaInicial?, onCambio? })`

- [ ] **Step 1: Ruta de la tanda**

```ts
// app/api/contenido/tanda/route.ts
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { autorizarCoach } from '@/lib/contenido/auth'
import { autorizarSemanaDieta } from '@/lib/nutricion/semana-dieta'
import { compraDeTanda } from '@/lib/contenido/compra-tanda'
import { ordenarCocinado, resumenTanda } from '@/lib/contenido/tanda'

const FECHA = /^\d{4}-\d{2}-\d{2}$/

/** Ids de las recetas que aparecen en el plan del cliente (semana en curso y futuras planificadas). */
async function recetasDelPlan(db: SupabaseClient, planId: string): Promise<Set<string>> {
  const [{ data: actuales }, { data: futuras }] = await Promise.all([
    db.from('comidas').select('receta_id').eq('plan_id', planId).not('receta_id', 'is', null),
    db.from('comidas_planificadas').select('receta_id').eq('plan_id', planId),
  ])
  return new Set([...(actuales ?? []), ...(futuras ?? [])].map(f => f.receta_id as string))
}

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams
  const fecha = q.get('fecha') ?? ''
  const clienteId = q.get('cliente_id')
  if (!FECHA.test(fecha)) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 })

  // Con cliente: comprueba que es del coach y carga su plan; sin cliente: solo rol coach.
  let admin: SupabaseClient
  let coachId: string
  let planId: string | null = null
  if (clienteId) {
    const a = await autorizarSemanaDieta(request, clienteId)
    if ('error' in a) return a.error
    const c = await autorizarCoach(request)
    if ('error' in c) return c.error
    admin = a.admin; coachId = c.userId; planId = a.plan?.id ?? null
  } else {
    const c = await autorizarCoach(request)
    if ('error' in c) return c.error
    admin = c.admin; coachId = c.userId
  }

  const { data, error } = await admin.from('piezas_contenido')
    .select('*, receta:recetas(id, nombre, imagen_url, tiempo_prep_min, instrucciones, estado, verificacion)')
    .eq('coach_id', coachId).eq('fecha_grabacion', fecha).in('estado', ['para_grabar', 'grabada'])
  if (error) return NextResponse.json({ error: 'No se pudo cargar la tanda' }, { status: 500 })

  type Fila = { id: string; titulo: string; receta_id: string | null; planos_hechos: string[]; receta: { tiempo_prep_min: number | null } | null }
  const filas = (data ?? []) as unknown as Fila[]
  const ordenadas = ordenarCocinado(filas.map(p => ({ ...p, nombre: p.titulo, tiempo_prep_min: p.receta?.tiempo_prep_min ?? null })))

  const recetaIds = [...new Set(ordenadas.flatMap(p => p.receta_id ? [p.receta_id] : []))]
  try {
    const [compra, enPlan] = await Promise.all([
      compraDeTanda(admin, recetaIds),
      planId ? recetasDelPlan(admin, planId) : Promise.resolve(new Set<string>()),
    ])
    return NextResponse.json({
      fecha,
      piezas: ordenadas,
      compra,
      resumen: { ...resumenTanda(ordenadas), enDieta: recetaIds.filter(id => enPlan.has(id)).length },
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo calcular la compra de la tanda' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Escaleta con casillas**

```tsx
// components/contenido/EscaletaPlanos.tsx
'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { PLANOS, alternarPlano } from '@/lib/contenido/escaleta'
import { api } from './api'

export default function EscaletaPlanos({ piezaId, hechos, onCambio }: { piezaId: string; hechos: string[]; onCambio: () => void }) {
  const { addToast } = useToast()
  const [local, setLocal] = useState(hechos)

  async function alternar(id: string) {
    const siguiente = alternarPlano(local, id)
    setLocal(siguiente)
    const r = await api(`/api/contenido/piezas/${piezaId}`, { method: 'PATCH', body: JSON.stringify({ planos_hechos: siguiente }) })
    if (!r.ok) { setLocal(local); addToast({ type: 'error', title: 'No se pudo guardar el plano', message: r.error }); return }
    onCambio()
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
      {PLANOS.map(p => (
        <li key={p.id}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <input type="checkbox" checked={local.includes(p.id)} onChange={() => alternar(p.id)} />
            <span style={{ textDecoration: local.includes(p.id) ? 'line-through' : 'none', color: local.includes(p.id) ? 'var(--text-muted)' : 'var(--text)' }}>{p.texto}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Pantalla del día de grabación**

```tsx
// components/contenido/DiaGrabacion.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { formatoFecha, hoyMadrid } from '@/lib/contenido/fechas'
import type { LineaCompraTanda } from '@/lib/contenido/compra-tanda'
import { api } from './api'
import EscaletaPlanos from './EscaletaPlanos'
import type { Pieza } from './tipos'

type Tanda = {
  fecha: string
  piezas: Pieza[]
  compra: { lineas: LineaCompraTanda[]; costeEstimado: number }
  resumen: { recetas: number; minutos: number; planosPendientes: number; enDieta: number }
}
type ClienteLista = { id: string; nombre: string }

const clave = (fecha: string) => `contenido:tengo:${fecha}`
const pasosDe = (texto: string | null | undefined) => (texto ?? '').split(/\n+/).map(s => s.trim()).filter(Boolean)

export default function DiaGrabacion({ fechaInicial }: { fechaInicial?: string }) {
  const { addToast } = useToast()
  const [fecha, setFecha] = useState(fechaInicial ?? hoyMadrid())
  const [clientes, setClientes] = useState<ClienteLista[]>([])
  const [clienteId, setClienteId] = useState('')
  const [tanda, setTanda] = useState<Tanda | null>(null)
  const [tengo, setTengo] = useState<string[]>([])

  useEffect(() => {
    api<{ clientes?: ClienteLista[] } | ClienteLista[]>('/api/clientes').then(r => {
      if (!r.ok) return
      const lista = Array.isArray(r.data) ? r.data : r.data.clientes ?? []
      setClientes(lista)
      setClienteId(prev => prev || (lista.find(c => /casanova/i.test(c.nombre)) ?? lista[0])?.id || '')
    })
  }, [])

  useEffect(() => {
    try { setTengo(JSON.parse(localStorage.getItem(clave(fecha)) ?? '[]')) } catch { setTengo([]) }
  }, [fecha])

  const cargar = useCallback(async () => {
    const q = new URLSearchParams({ fecha, ...(clienteId ? { cliente_id: clienteId } : {}) })
    const r = await api<Tanda>(`/api/contenido/tanda?${q}`)
    if (r.ok) setTanda(r.data)
    else addToast({ type: 'error', title: 'No se pudo cargar la tanda', message: r.error })
  }, [fecha, clienteId, addToast])

  useEffect(() => { cargar() }, [cargar])

  function alternarTengo(id: string) {
    const siguiente = tengo.includes(id) ? tengo.filter(x => x !== id) : [...tengo, id]
    setTengo(siguiente)
    try { localStorage.setItem(clave(fecha), JSON.stringify(siguiente)) } catch { /* sin almacenamiento: no pasa nada */ }
  }

  const porCategoria = useMemo(() => {
    const m = new Map<string, LineaCompraTanda[]>()
    for (const l of tanda?.compra.lineas ?? []) m.set(l.categoria, [...(m.get(l.categoria) ?? []), l])
    return [...m.entries()]
  }, [tanda])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label>Día <input className="input" type="date" value={fecha} onChange={e => e.target.value && setFecha(e.target.value)} /></label>
        <label>Dieta de{' '}
          <select className="input" value={clienteId} onChange={e => setClienteId(e.target.value)}>
            <option value="">(sin dieta)</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <span style={{ color: 'var(--text-muted)' }}>{formatoFecha(fecha)}</span>
      </div>

      {tanda && (
        <div className="card" style={{ padding: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span><strong>{tanda.resumen.recetas}</strong> recetas</span>
          <span><strong>{tanda.resumen.minutos}</strong> min de preparación</span>
          <span><strong>{tanda.resumen.planosPendientes}</strong> planos por grabar</span>
          {clienteId && <span><strong>{tanda.resumen.enDieta}</strong> en la dieta</span>}
        </div>
      )}

      {tanda && tanda.piezas.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No hay recetas para grabar este día.</p>}

      {tanda?.piezas.map((p, i) => (
        <div key={p.id} className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
          <strong>{i + 1}. {p.titulo}{p.receta?.tiempo_prep_min ? ` · ${p.receta.tiempo_prep_min} min` : ''}</strong>
          <EscaletaPlanos piezaId={p.id} hechos={p.planos_hechos} onCambio={cargar} />
          {pasosDe(p.receta?.instrucciones).length > 0 && (
            <details>
              <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>Pasos de la receta</summary>
              <ol style={{ margin: '6px 0 0 18px' }}>{pasosDe(p.receta?.instrucciones).map((s, k) => <li key={k} style={{ fontSize: 13 }}>{s}</li>)}</ol>
            </details>
          )}
        </div>
      ))}

      {tanda && tanda.compra.lineas.length > 0 && (
        <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
          <strong>Compra de la tanda · ≈ {tanda.compra.costeEstimado.toFixed(2)} €</strong>
          {porCategoria.map(([cat, lineas]) => (
            <div key={cat}>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase' }}>{cat}</div>
              {lineas.map(l => (
                <label key={l.alimento_id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 14 }}>
                  <input type="checkbox" checked={tengo.includes(l.alimento_id)} onChange={() => alternarTengo(l.alimento_id)} aria-label={`Ya tengo ${l.alimento_nombre}`} />
                  <span style={{ textDecoration: tengo.includes(l.alimento_id) ? 'line-through' : 'none' }}>
                    {l.alimento_nombre} · {l.gramos} g
                    <span style={{ color: 'var(--text-muted)' }}> ({l.recetas.join(', ')})</span>
                    {l.coste_estimado !== null && <span style={{ color: 'var(--text-muted)' }}> · ≈ {l.coste_estimado.toFixed(2)} €</span>}
                  </span>
                </label>
              ))}
            </div>
          ))}
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Marca lo que ya tienes en casa. El coste usa el precio más barato de cada ingrediente.</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Añadir la vista a la página**

En `app/contenido/page.tsx`: importar `DiaGrabacion from '@/components/contenido/DiaGrabacion'`, añadir `{ id: 'tanda', label: 'Día de grabación' }` a `VISTAS` y `{vista === 'tanda' && <DiaGrabacion />}` bajo la bandeja.

- [ ] **Step 5: Comprobar tipos y probar con datos reales**

Run: `cd nutricoach && npx tsc --noEmit --pretty false`
Expected: sin errores.

Probar con `browse --headed` + handoff: desde la bandeja marcar una idea con receta como "para grabar"; asignarle fecha (la tarea 12 añade el campo de fecha; mientras tanto, desde el SQL Editor: `update piezas_contenido set fecha_grabacion = current_date where estado = 'para_grabar';` en una pieza de prueba) y abrir "Día de grabación": comprobar que muestra la receta, la escaleta, los pasos y la compra con cantidades. Marcar los seis planos y confirmar que la pieza pasa a `grabada` (recargar). Probar también un día sin recetas (mensaje vacío, sin error).

- [ ] **Step 6: Commit**

```bash
cd nutricoach && git add app/api/contenido/tanda components/contenido/EscaletaPlanos.tsx components/contenido/DiaGrabacion.tsx app/contenido/page.tsx
git commit -m "feat(contenido): día de grabación con compra consolidada, orden y escaleta

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Añadir a la tanda desde la dieta de la semana

**Files:**
- Create: `app/api/contenido/dieta-semana/route.ts`, `app/api/contenido/tanda/anadir/route.ts`
- Modify: `components/contenido/DiaGrabacion.tsx`

**Interfaces:**
- Consumes: `anadirRecetasATanda` (Task 7); `autorizarSemanaDieta`
- Produces: `GET /api/contenido/dieta-semana?cliente_id=` → `{ recetas: { id, nombre, imagen_url, tiempo_prep_min, origen }[] }`; `POST /api/contenido/tanda/anadir` con `{ fecha, receta_ids }` → `{ anadidas }`

- [ ] **Step 1: Recetas de la dieta de la semana**

```ts
// app/api/contenido/dieta-semana/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { autorizarSemanaDieta } from '@/lib/nutricion/semana-dieta'

type R = { id: string; nombre: string; imagen_url: string | null; tiempo_prep_min: number | null }
const SEL = 'receta:recetas(id, nombre, imagen_url, tiempo_prep_min)'

export async function GET(request: NextRequest) {
  const clienteId = new URL(request.url).searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'Falta cliente_id' }, { status: 400 })
  const c = await autorizarCoach(request)
  if ('error' in c) return c.error
  const a = await autorizarSemanaDieta(request, clienteId)
  if ('error' in a) return a.error
  if (!a.plan) return NextResponse.json({ recetas: [] })

  const [actuales, futuras] = await Promise.all([
    a.admin.from('comidas').select(SEL).eq('plan_id', a.plan.id).not('receta_id', 'is', null),
    a.admin.from('comidas_planificadas').select(`semana, ${SEL}`).eq('plan_id', a.plan.id).lte('semana', 2),
  ])
  if (actuales.error || futuras.error) return NextResponse.json({ error: 'No se pudo cargar la dieta' }, { status: 500 })

  const vistas = new Map<string, R & { origen: string }>()
  const incluir = (receta: R | null, origen: string) => { if (receta && !vistas.has(receta.id)) vistas.set(receta.id, { ...receta, origen }) }
  for (const f of (actuales.data ?? []) as unknown as { receta: R | null }[]) incluir(f.receta, 'Esta semana')
  for (const f of (futuras.data ?? []) as unknown as { semana: number; receta: R | null }[]) incluir(f.receta, `Semana +${f.semana}`)
  return NextResponse.json({ recetas: [...vistas.values()] })
}
```

- [ ] **Step 2: Añadir recetas a la tanda**

```ts
// app/api/contenido/tanda/anadir/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { anadirRecetasATanda } from '@/lib/contenido/piezas'

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const b = await request.json().catch(() => null) as { fecha?: unknown; receta_ids?: unknown } | null
  if (typeof b?.fecha !== 'string' || !FECHA.test(b.fecha)) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 })
  if (!Array.isArray(b.receta_ids) || b.receta_ids.length === 0 || b.receta_ids.length > 50 || !b.receta_ids.every(x => typeof x === 'string' && UUID.test(x))) {
    return NextResponse.json({ error: 'Recetas no válidas' }, { status: 400 })
  }
  const anadidas = await anadirRecetasATanda(r.admin, r.userId, b.fecha, b.receta_ids as string[])
  return NextResponse.json({ anadidas })
}
```

- [ ] **Step 3: Botón y panel "Desde mi dieta" en `DiaGrabacion`**

En `components/contenido/DiaGrabacion.tsx`, añadir estado y función dentro del componente:

```tsx
const [dieta, setDieta] = useState<{ id: string; nombre: string; origen: string }[] | null>(null)

async function abrirDieta() {
  if (!clienteId) { addToast({ type: 'error', title: 'Elige primero una dieta' }); return }
  const r = await api<{ recetas: { id: string; nombre: string; origen: string }[] }>(`/api/contenido/dieta-semana?cliente_id=${clienteId}`)
  if (r.ok) setDieta(r.data.recetas)
  else addToast({ type: 'error', title: 'No se pudo cargar la dieta', message: r.error })
}

async function anadirDesdeDieta(id: string) {
  const r = await api('/api/contenido/tanda/anadir', { method: 'POST', body: JSON.stringify({ fecha, receta_ids: [id] }) })
  if (!r.ok) { addToast({ type: 'error', title: 'No se pudo añadir', message: r.error }); return }
  cargar()
}
```

Y en el JSX, después de la barra de día y dieta:

```tsx
<div>
  <button className="btn btn-secondary btn-sm" onClick={() => (dieta ? setDieta(null) : abrirDieta())}>
    {dieta ? 'Cerrar' : 'Añadir desde mi dieta'}
  </button>
  {dieta && (
    <div className="card" style={{ padding: 8, marginTop: 6, maxHeight: 260, overflowY: 'auto' }}>
      {dieta.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>La dieta no tiene recetas todavía.</p>}
      {dieta.map(r => {
        const yaEsta = tanda?.piezas.some(p => p.receta_id === r.id)
        return (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '4px 0' }}>
            <span style={{ fontSize: 14 }}>{r.nombre} <span style={{ color: 'var(--text-muted)' }}>· {r.origen}</span></span>
            <button className="btn btn-ghost btn-sm" disabled={yaEsta} onClick={() => anadirDesdeDieta(r.id)}>{yaEsta ? 'En la tanda' : 'Añadir'}</button>
          </div>
        )
      })}
    </div>
  )}
</div>
```

- [ ] **Step 4: Comprobar tipos y probar**

Run: `cd nutricoach && npx tsc --noEmit --pretty false`
Expected: sin errores.

Probar con `browse --headed` + handoff: elegir el cliente Carlos Casanova, abrir "Añadir desde mi dieta", añadir una receta y comprobar que aparece en la tanda con su compra y que el icono de vídeo de esa receta en el planificador de la dieta pasa a "para grabar" (recargar el planificador). Comprobar que añadir la misma receta otra vez no duplica la pieza.

- [ ] **Step 5: Commit**

```bash
cd nutricoach && git add app/api/contenido/dieta-semana app/api/contenido/tanda/anadir components/contenido/DiaGrabacion.tsx
git commit -m "feat(contenido): añadir a la tanda recetas de la dieta de la semana

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Colocar la tanda en la dieta

**Files:**
- Create: `app/api/contenido/tanda/colocar/route.ts`
- Modify: `components/contenido/DiaGrabacion.tsx`

**Interfaces:**
- Consumes: `repartirEnDieta`, `semanaYDia`, `hoyMadrid` (Task 3); `ordenarCocinado` (Task 4); `asignarFutura` de `@/lib/nutricion/semanas-futuras`; `autorizarSemanaDieta`
- Produces: `POST /api/contenido/tanda/colocar` con `{ fecha, cliente_id }` → `{ colocadas: number, omitidas: { titulo: string; motivo: string }[] }`

- [ ] **Step 1: Ruta**

```ts
// app/api/contenido/tanda/colocar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { autorizarSemanaDieta } from '@/lib/nutricion/semana-dieta'
import { asignarFutura } from '@/lib/nutricion/semanas-futuras'
import { hoyMadrid, repartirEnDieta, semanaYDia } from '@/lib/contenido/fechas'
import { ordenarCocinado } from '@/lib/contenido/tanda'

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Reparte las recetas de la tanda en Comida y Cena desde la fecha de grabación, en las semanas planificadas (+1…+8) del plan.
export async function POST(request: NextRequest) {
  const b = await request.json().catch(() => null) as { fecha?: unknown; cliente_id?: unknown } | null
  if (typeof b?.fecha !== 'string' || !FECHA.test(b.fecha)) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 })
  if (typeof b.cliente_id !== 'string' || !UUID.test(b.cliente_id)) return NextResponse.json({ error: 'Cliente no válido' }, { status: 400 })
  const c = await autorizarCoach(request)
  if ('error' in c) return c.error
  const a = await autorizarSemanaDieta(request, b.cliente_id)
  if ('error' in a) return a.error
  if (!a.plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })

  const { data, error } = await a.admin.from('piezas_contenido')
    .select('id, titulo, receta_id, receta:recetas(tiempo_prep_min)')
    .eq('coach_id', c.userId).eq('fecha_grabacion', b.fecha).in('estado', ['para_grabar', 'grabada']).not('receta_id', 'is', null)
  if (error) return NextResponse.json({ error: 'No se pudo cargar la tanda' }, { status: 500 })

  type Fila = { id: string; titulo: string; receta_id: string; receta: { tiempo_prep_min: number | null } | null }
  const piezas = ordenarCocinado(((data ?? []) as unknown as Fila[]).map(p => ({ ...p, nombre: p.titulo, tiempo_prep_min: p.receta?.tiempo_prep_min ?? null })))
  const destinos = repartirEnDieta(piezas.length, b.fecha)
  const hoy = hoyMadrid()

  let colocadas = 0
  const omitidas: { titulo: string; motivo: string }[] = []
  for (const [i, p] of piezas.entries()) {
    const sd = semanaYDia(destinos[i].fecha, hoy)
    if (!sd) { omitidas.push({ titulo: p.titulo, motivo: 'Cae fuera de las semanas planificables (la semana en curso no se toca; solo +1 a +8)' }); continue }
    try {
      await asignarFutura(a.admin, a.plan.id, { semana: sd.semana, dia: sd.dia, franja: destinos[i].franja, receta_id: p.receta_id })
      await a.admin.from('piezas_contenido').update({ plan_id: a.plan.id, updated_at: new Date().toISOString() }).eq('id', p.id).eq('coach_id', c.userId)
      colocadas++
    } catch {
      omitidas.push({ titulo: p.titulo, motivo: 'La receta no está aprobada o no se pudo guardar' })
    }
  }
  return NextResponse.json({ colocadas, omitidas })
}
```

- [ ] **Step 2: Botón en `DiaGrabacion`**

Añadir dentro del componente:

```tsx
async function colocarEnDieta() {
  if (!clienteId || !tanda) return
  const hechas = tanda.piezas.filter(p => p.receta_id).length
  if (!confirm(`Se colocarán ${hechas} recetas en Comida y Cena desde el ${formatoFecha(fecha)}. Sustituye lo que haya en esos huecos de las semanas planificadas. ¿Continuar?`)) return
  const r = await api<{ colocadas: number; omitidas: { titulo: string; motivo: string }[] }>('/api/contenido/tanda/colocar', {
    method: 'POST', body: JSON.stringify({ fecha, cliente_id: clienteId }),
  })
  if (!r.ok) { addToast({ type: 'error', title: 'No se pudo colocar en la dieta', message: r.error }); return }
  addToast({
    type: r.data.omitidas.length ? 'error' : 'success',
    title: `${r.data.colocadas} recetas colocadas en la dieta`,
    message: r.data.omitidas.map(o => `${o.titulo}: ${o.motivo}`).join(' · ') || undefined,
  })
  cargar()
}
```

Y junto al botón "Añadir desde mi dieta":

```tsx
<button className="btn btn-primary btn-sm" disabled={!clienteId || !tanda || tanda.piezas.length === 0} onClick={colocarEnDieta}>
  Colocar en mi dieta
</button>
```

- [ ] **Step 3: Comprobar tipos y probar**

Run: `cd nutricoach && npx tsc --noEmit --pretty false`
Expected: sin errores.

Probar con `browse --headed` + handoff: crear una tanda para una fecha de la semana que viene (p. ej. el próximo sábado), pulsar "Colocar en mi dieta", confirmar, y comprobar en el planificador de Carlos (semana +1) que las recetas ocupan Comida y Cena de ese día y el siguiente. Probar una tanda con fecha de la semana en curso: debe avisar de las omitidas sin dar error.

- [ ] **Step 4: Commit**

```bash
cd nutricoach && git add app/api/contenido/tanda/colocar components/contenido/DiaGrabacion.tsx
git commit -m "feat(contenido): colocar la tanda en las semanas planificadas de la dieta

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Tablero y calendario

**Files:**
- Create: `components/contenido/TableroContenido.tsx`, `components/contenido/CalendarioContenido.tsx`
- Modify: `app/contenido/page.tsx`

**Interfaces:**
- Consumes: `ESTADOS_PIEZA`, `ETIQUETA_ESTADO` (Task 1); `lunesDe`, `sumarDias`, `formatoFecha`, `hoyMadrid` (Task 3); `api`, `Pieza`
- Produces: `TableroContenido()`, `CalendarioContenido({ onAbrirDia(fecha) })`

- [ ] **Step 1: Tablero**

```tsx
// components/contenido/TableroContenido.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { ESTADOS_PIEZA, ETIQUETA_ESTADO, type EstadoPieza } from '@/lib/contenido/estados'
import { api } from './api'
import type { Pieza } from './tipos'

type Filtro = 'todas' | 'dieta' | 'prueba'

export default function TableroContenido() {
  const { addToast } = useToast()
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [filtro, setFiltro] = useState<Filtro>('todas')

  const cargar = useCallback(async () => {
    const r = await api<{ piezas: Pieza[] }>('/api/contenido/piezas')
    if (r.ok) setPiezas(r.data.piezas)
    else addToast({ type: 'error', title: 'No se pudo cargar el tablero', message: r.error })
  }, [addToast])
  useEffect(() => { cargar() }, [cargar])

  async function cambiar(id: string, cambios: Record<string, unknown>) {
    const r = await api(`/api/contenido/piezas/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) })
    if (!r.ok) addToast({ type: 'error', title: 'No se pudo actualizar', message: r.error })
    cargar()
  }

  const visibles = piezas.filter(p => filtro === 'todas' || (filtro === 'dieta' ? p.plan_id : !p.plan_id))

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {([['todas', 'Todas'], ['dieta', 'Entran en dieta'], ['prueba', 'Platos de prueba']] as [Filtro, string][]).map(([id, label]) => (
          <button key={id} className={`btn btn-sm ${filtro === id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFiltro(id)}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {ESTADOS_PIEZA.map(estado => {
          const columna = visibles.filter(p => p.estado === estado)
          return (
            <section key={estado} style={{ minWidth: 230, flex: '0 0 230px' }} aria-label={ETIQUETA_ESTADO[estado]}>
              <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>{ETIQUETA_ESTADO[estado]} · {columna.length}</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {columna.map(p => (
                  <div key={p.id} className="card" style={{ padding: 10, display: 'grid', gap: 6 }}>
                    <strong style={{ fontSize: 14 }}>{p.titulo}</strong>
                    <select className="input" value={p.estado} aria-label="Estado" onChange={e => cambiar(p.id, { estado: e.target.value as EstadoPieza })}>
                      {ESTADOS_PIEZA.map(e => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
                    </select>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Grabar{' '}
                      <input className="input" type="date" value={p.fecha_grabacion ?? ''} onChange={e => cambiar(p.id, { fecha_grabacion: e.target.value || null })} />
                    </label>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Publicar{' '}
                      <input className="input" type="date" value={p.fecha_publicacion ?? ''} onChange={e => cambiar(p.id, { fecha_publicacion: e.target.value || null })} />
                    </label>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Calendario semanal**

```tsx
// components/contenido/CalendarioContenido.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { formatoFecha, hoyMadrid, lunesDe, sumarDias } from '@/lib/contenido/fechas'
import { api } from './api'
import type { Pieza } from './tipos'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function CalendarioContenido({ onAbrirDia }: { onAbrirDia: (fecha: string) => void }) {
  const { addToast } = useToast()
  const [lunes, setLunes] = useState(lunesDe(hoyMadrid()))
  const [piezas, setPiezas] = useState<Pieza[]>([])

  const cargar = useCallback(async () => {
    const r = await api<{ piezas: Pieza[] }>('/api/contenido/piezas')
    if (r.ok) setPiezas(r.data.piezas)
    else addToast({ type: 'error', title: 'No se pudo cargar el calendario', message: r.error })
  }, [addToast])
  useEffect(() => { cargar() }, [cargar])

  const dias = DIAS.map((nombre, i) => ({ nombre, fecha: sumarDias(lunes, i) }))
  const hoy = hoyMadrid()

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setLunes(sumarDias(lunes, -7))} aria-label="Semana anterior"><ChevronLeft size={16} /></button>
        <strong>Semana del {formatoFecha(lunes)}</strong>
        <button className="btn btn-secondary btn-sm" onClick={() => setLunes(sumarDias(lunes, 7))} aria-label="Semana siguiente"><ChevronRight size={16} /></button>
        <button className="btn btn-ghost btn-sm" onClick={() => setLunes(lunesDe(hoy))}>Hoy</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
        {dias.map(d => {
          const grabar = piezas.filter(p => p.fecha_grabacion === d.fecha)
          const publicar = piezas.filter(p => p.fecha_publicacion === d.fecha)
          return (
            <div key={d.fecha} className="card" style={{ padding: 8, minHeight: 110, outline: d.fecha === hoy ? '1px solid var(--accent)' : 'none' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.nombre} {formatoFecha(d.fecha).slice(0, 5)}</div>
              {grabar.length > 0 && (
                <button className="btn btn-secondary btn-sm" style={{ margin: '6px 0 2px', width: '100%' }} onClick={() => onAbrirDia(d.fecha)}>
                  🎬 Grabar ({grabar.length})
                </button>
              )}
              {grabar.map(p => <div key={`g${p.id}`} style={{ fontSize: 12 }}>{p.titulo}</div>)}
              {publicar.map(p => <div key={`p${p.id}`} style={{ fontSize: 12, color: 'var(--success)' }}>📤 {p.titulo}</div>)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Completar la página**

Sustituir `app/contenido/page.tsx` por:

```tsx
'use client'

import { useState } from 'react'
import BandejaIdeas from '@/components/contenido/BandejaIdeas'
import CalendarioContenido from '@/components/contenido/CalendarioContenido'
import DiaGrabacion from '@/components/contenido/DiaGrabacion'
import TableroContenido from '@/components/contenido/TableroContenido'

const VISTAS = [
  { id: 'bandeja', label: 'Bandeja' },
  { id: 'tanda', label: 'Día de grabación' },
  { id: 'tablero', label: 'Tablero' },
  { id: 'calendario', label: 'Calendario' },
] as const
type Vista = typeof VISTAS[number]['id']

export default function ContenidoPage() {
  const [vista, setVista] = useState<Vista>('bandeja')
  const [fechaTanda, setFechaTanda] = useState<string | undefined>(undefined)

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Contenido</h1>
      <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {VISTAS.map(v => (
          <button key={v.id} role="tab" aria-selected={vista === v.id} className={`btn btn-sm ${vista === v.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setVista(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      {vista === 'bandeja' && <BandejaIdeas />}
      {vista === 'tanda' && <DiaGrabacion key={fechaTanda ?? 'hoy'} fechaInicial={fechaTanda} />}
      {vista === 'tablero' && <TableroContenido />}
      {vista === 'calendario' && <CalendarioContenido onAbrirDia={f => { setFechaTanda(f); setVista('tanda') }} />}
    </div>
  )
}
```

- [ ] **Step 4: Comprobar tipos y probar**

Run: `cd nutricoach && npx tsc --noEmit --pretty false`
Expected: sin errores.

Probar con `browse --headed` + handoff: en el tablero asignar fecha de grabación y de publicación a una pieza; abrir el calendario, comprobar que aparece el 🎬 y el 📤 en los días correctos; pulsar "Grabar" y comprobar que abre el día de grabación con esa fecha. Cambiar el estado desde el selector hasta `publicada` y comprobar que el icono de vídeo de esa receta en el planificador cambia a grabada.

- [ ] **Step 5: Commit**

```bash
cd nutricoach && git add components/contenido/TableroContenido.tsx components/contenido/CalendarioContenido.tsx app/contenido/page.tsx
git commit -m "feat(contenido): tablero por estado y calendario de grabación y publicación

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Verificación final y cierre

**Files:**
- Modify: `docs/superpowers/specs/2026-10-07-contenido-grabacion-design.md` (incorporar la tabla "Cambios respecto al spec")

- [ ] **Step 1: Todos los tests y tipos**

Run:

```bash
cd nutricoach && npx tsc --noEmit --pretty false \
 && for t in estados escaleta fechas enlace-tanda validacion; do npx tsx scripts/contenido-$t.test.ts || exit 1; done \
 && npx tsx scripts/lista-compra-agregar.test.ts
```

Expected: sin errores de tipos y seis líneas `…: OK`.

- [ ] **Step 2: Build**

Run: `cd nutricoach && npm run build`
Expected: compila. Si falla solo por red al descargar Google Fonts, reintentar (no es fallo de código).

- [ ] **Step 3: Regresión de la lista de la compra semanal**

Con `browse --headed` + handoff, abrir la lista de la compra de un plan con recetas (`/compra` o la ficha del cliente) y comprobar que sigue mostrando ingredientes, precios y totales como antes de la extracción de `agregarIngredientes`.

- [ ] **Step 4: Verificación en producción contra Supabase real**

Tras el push y el despliegue (migración ya aplicada), con datos reales de Carlos:

1. Marcar con el icono del planificador una receta de su dieta como "para grabar": debe aparecer en Contenido → Tablero como pieza `Para grabar`.
2. En Supabase (SQL Editor), `select titulo, estado, planos_hechos from piezas_contenido order by created_at desc limit 5;` coincide con lo visto en pantalla (RLS puede devolver listas vacías sin error; comparar siempre con service role).
3. Recorrer: apuntar idea con enlace de un reel que ya esté en el recetario (comprobar enlace automático por `url_origen`), pasar a para grabar, asignar fecha, abrir día de grabación, marcar planos, colocar en dieta.

- [ ] **Step 5: Actualizar el spec con los cambios y commit**

Añadir al final del spec una sección `## Cambios respecto al diseño inicial` con la tabla del encabezado de este plan, y:

```bash
cd nutricoach && git add docs/superpowers/specs/2026-10-07-contenido-grabacion-design.md
git commit -m "docs: spec de Contenido alineado con el plan de implementación

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Push**

Solo con la migración aplicada y las pruebas anteriores correctas:

```bash
cd nutricoach && git push origin main
```
