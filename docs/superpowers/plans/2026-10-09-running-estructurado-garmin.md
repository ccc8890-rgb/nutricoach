# Running estructurado + envío a Garmin — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una sesión de carrera (series, tempo, rodaje) tenga pasos estructurados con ritmo por VDOT y se pueda enviar y programar en el Garmin del atleta.

**Architecture:** Columna JSON `pasos` en `plantilla_sesiones` y `sesiones_entrenamiento`. Módulos puros (`ritmos`, `pasos`, `proxima-fecha`, `garmin-workouts-formato`) con tests; un servicio de envío que usa la conexión Garmin cifrada ya guardada en `integraciones_cliente`; un endpoint y una tarjeta en la pantalla de sesión del cliente.

**Tech Stack:** Next.js (versión personalizada, ver `node_modules/next/dist/docs/` si se toca routing), TypeScript, Supabase, `garmin-connect` 1.6.2, tests como scripts `node:assert` ejecutados con `npx tsx scripts/<nombre>.test.ts` (patrón del repo, sin framework).

**Spec:** `docs/superpowers/specs/2026-10-09-running-estructurado-garmin-design.md`

**Fuera de este plan** (planes posteriores): editor de pasos del coach (fase 4 del spec), programación automática de la semana (fase 5). Desviación del spec: `repetir` contiene solo pasos simples (un nivel); basta para series, strides y pirámides.

## Global Constraints

- Idioma de textos de UI y mensajes de error: español (castellano).
- Fechas en el formato `YYYY-MM-DD` hacia Garmin; en pantalla `DD-MM-YYYY`.
- Rutas de endpoint con datos de cliente: exigir sesión y `autorizarAccesoCliente` (`lib/cliente/autorizar-acceso-cliente.ts`); nunca devolver `err.message` crudo en 500.
- Nunca escribir claves ni credenciales en código, logs ni respuestas. La conexión Garmin se lee solo con `descifrarConexionGarmin`.
- `pasos` es nullable: toda sesión con `pasos = null` debe seguir funcionando exactamente como hoy.
- Cambios quirúrgicos: no tocar fuerza ni el flujo de registro de sets.
- Commit y push directo a `main` tras cada tarea, salvo la migración SQL (confirmar con Carlos antes de aplicarla en producción).
- Commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Atleta **sin VDOT**: no se inventan ritmos; las zonas se ven y el envío a Garmin sale sin objetivo de ritmo (test en Task 5 y Task 6).
- **Reenviar** la misma sesión: se borra el entreno anterior de Garmin y no se duplica; si el borrado falla (ya no existe) se continúa (Task 6).
- Sesión con `dia_semana` ya pasado esta semana (p. ej. hoy es sábado y la sesión es del lunes): se programa para el **próximo** lunes, y si es hoy, para hoy (test en Task 3).
- Nombre de día con acentos o mayúsculas distintas («Miércoles», «sabado»): se reconoce (Task 3).
- Tokens OAuth de Garmin caducados: re-login con credenciales guardadas y guardar tokens nuevos (Task 6).
- JSON `pasos` corrupto o manipulado en BD: `validarPasos` lo rechaza y la UI no se rompe, solo no muestra la tarjeta (Task 2 y Task 8).

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/entrenos/ritmos.ts` (nuevo) | Ritmos Daniels desde VDOT, formato `m:ss` |
| `lib/entrenos/pasos.ts` (nuevo) | Tipos de `Paso`, `validarPasos`, `resumenSesion`, `lineaPaso` |
| `lib/entrenos/proxima-fecha.ts` (nuevo) | `dia_semana` → próxima fecha `YYYY-MM-DD` |
| `lib/entrenos/running-plantillas.ts` (nuevo) | Pasos de las 4 sesiones de running ya sembradas |
| `lib/integraciones/garmin-workouts-formato.ts` (nuevo) | `pasosAGarmin` (puro, JSON de Garmin) |
| `lib/integraciones/garmin-workouts.ts` (nuevo) | `enviarSesionAGarmin` (BD + Garmin) |
| `app/api/entrenos/sesiones/[id]/garmin/route.ts` (nuevo) | Endpoint POST |
| `supabase/migrations/20261009120000_sesiones_pasos_garmin.sql` (nuevo) | Columnas |
| `scripts/convertir-running-a-pasos.ts` (nuevo) | Conversión de lo sembrado |
| `components/training/PasosSesion.tsx` (nuevo) | Tarjeta de pasos + botón Garmin |
| `app/api/cliente/sesion/[id]/route.ts` (mod.) | Devuelve `pasos`, `ritmos`, `garmin` |
| `app/cliente/sesion/[id]/page.tsx` (mod.) | Muestra la tarjeta |
| `scripts/*.test.ts` (nuevos) | Tests por módulo |

---

### Task 1: Ritmos Daniels

**Files:**
- Create: `lib/entrenos/ritmos.ts`
- Test: `scripts/ritmos.test.ts`

**Interfaces:**
- Produces: `type ZonaRitmo = 'E'|'M'|'T'|'I'|'R'`; `type Ritmos = Record<ZonaRitmo, number>` (segundos por km); `ritmosDesdeVdot(vdot: number): Ritmos | null` (null si `vdot` no es número entre 20 y 90); `formatearRitmo(segKm: number): string` → `"4:15"`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// scripts/ritmos.test.ts
import assert from 'node:assert/strict'
import { ritmosDesdeVdot, formatearRitmo } from '../lib/entrenos/ritmos'

const r = ritmosDesdeVdot(45)!
assert.ok(r)
// Rangos de control Daniels para VDOT 45 (seg/km)
assert.ok(r.E >= 340 && r.E <= 370, `E ${r.E}`)
assert.ok(r.M >= 280 && r.M <= 300, `M ${r.M}`)
assert.ok(r.T >= 270 && r.T <= 285, `T ${r.T}`)
assert.ok(r.I >= 245 && r.I <= 265, `I ${r.I}`)
assert.ok(r.R >= 222 && r.R <= 242, `R ${r.R}`)
// Orden: E más lento que R
assert.ok(r.E > r.M && r.M > r.T && r.T > r.I && r.I > r.R)
// Mejor VDOT = ritmos más rápidos
assert.ok(ritmosDesdeVdot(55)!.T < r.T)
// Entradas inválidas
assert.equal(ritmosDesdeVdot(0), null)
assert.equal(ritmosDesdeVdot(NaN), null)
assert.equal(ritmosDesdeVdot(120), null)
assert.equal(formatearRitmo(255), '4:15')
assert.equal(formatearRitmo(304.6), '5:05')
assert.equal(formatearRitmo(299.6), '5:00')

console.log('ritmos.test.ts OK')
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `cd nutricoach && npx tsx scripts/ritmos.test.ts`
Expected: FAIL («Cannot find module '../lib/entrenos/ritmos'»).

- [ ] **Step 3: Implementar**

```ts
// lib/entrenos/ritmos.ts
export type ZonaRitmo = 'E' | 'M' | 'T' | 'I' | 'R'
export type Ritmos = Record<ZonaRitmo, number>

/** Fracción del VO2max (VDOT) a la que corre cada zona (Daniels). */
const INTENSIDAD: Record<ZonaRitmo, number> = { E: 0.65, M: 0.84, T: 0.88, I: 0.98, R: 1.1 }

/** Velocidad (m/min) para un consumo de oxígeno dado: VO2 = 0,182258·v + 0,000104·v² − 4,60. */
function velocidadParaVo2(vo2: number): number {
  const a = 0.000104
  const b = 0.182258
  const c = -4.6 - vo2
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
}

export function ritmosDesdeVdot(vdot: number): Ritmos | null {
  if (typeof vdot !== 'number' || !Number.isFinite(vdot) || vdot < 20 || vdot > 90) return null
  const zona = (z: ZonaRitmo) => 60000 / velocidadParaVo2(vdot * INTENSIDAD[z])
  return { E: zona('E'), M: zona('M'), T: zona('T'), I: zona('I'), R: zona('R') }
}

export function formatearRitmo(segKm: number): string {
  const total = Math.round(segKm)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npx tsx scripts/ritmos.test.ts`
Expected: `ritmos.test.ts OK`. Si un rango falla por 1-2 s, ajustar la intensidad de esa zona (no el rango) hasta que coincida con la tabla de Daniels y anotarlo en el commit.

- [ ] **Step 5: Commit**

```bash
git add lib/entrenos/ritmos.ts scripts/ritmos.test.ts
git commit -m "feat(running): ritmos Daniels desde VDOT"
```

---

### Task 2: Modelo de pasos, validación y resumen

**Files:**
- Create: `lib/entrenos/pasos.ts`
- Test: `scripts/pasos.test.ts`

**Interfaces:**
- Consumes: `ZonaRitmo`, `Ritmos`, `formatearRitmo` de `lib/entrenos/ritmos`.
- Produces:
  - `type Duracion = { unidad: 'metros' | 'segundos'; valor: number } | { unidad: 'lap' }`
  - `type Objetivo = { tipo: 'zona'; zona: ZonaRitmo } | { tipo: 'ritmo'; min_seg_km: number; max_seg_km: number } | { tipo: 'fc'; min: number; max: number } | { tipo: 'rpe'; valor: number }`
  - `interface PasoSimple { tipo: 'calentamiento'|'trabajo'|'recuperacion'|'enfriamiento'; duracion: Duracion; objetivo?: Objetivo; nota?: string }`
  - `interface PasoRepetir { tipo: 'repetir'; veces: number; pasos: PasoSimple[] }`
  - `type Paso = PasoSimple | PasoRepetir`
  - `validarPasos(x: unknown): { ok: true; pasos: Paso[] } | { ok: false; error: string }`
  - `ritmoDelPaso(p: PasoSimple, ritmos: Ritmos | null): number | null` (seg/km)
  - `lineaPaso(p: PasoSimple, ritmos: Ritmos | null): string`
  - `resumenSesion(pasos: Paso[], ritmos: Ritmos | null): { distancia_m: number; duracion_s: number | null; lineas: string[] }`

- [ ] **Step 1: Test que falla**

```ts
// scripts/pasos.test.ts
import assert from 'node:assert/strict'
import { validarPasos, resumenSesion, lineaPaso, type Paso } from '../lib/entrenos/pasos'
import { ritmosDesdeVdot } from '../lib/entrenos/ritmos'

const series: Paso[] = [
  { tipo: 'calentamiento', duracion: { unidad: 'segundos', valor: 900 }, objetivo: { tipo: 'zona', zona: 'E' } },
  { tipo: 'repetir', veces: 5, pasos: [
    { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 1000 }, objetivo: { tipo: 'zona', zona: 'I' } },
    { tipo: 'recuperacion', duracion: { unidad: 'metros', valor: 400 }, objetivo: { tipo: 'zona', zona: 'E' } },
  ] },
  { tipo: 'enfriamiento', duracion: { unidad: 'segundos', valor: 600 }, objetivo: { tipo: 'zona', zona: 'E' } },
]

// Validación OK
const v = validarPasos(series)
assert.equal(v.ok, true)

// Validaciones que deben rechazar
for (const malo of [
  null, 'x', [], {},
  [{ tipo: 'trabajo' }],
  [{ tipo: 'trabajo', duracion: { unidad: 'metros', valor: 0 } }],
  [{ tipo: 'trabajo', duracion: { unidad: 'metros', valor: -5 } }],
  [{ tipo: 'volar', duracion: { unidad: 'metros', valor: 100 } }],
  [{ tipo: 'repetir', veces: 0, pasos: [{ tipo: 'trabajo', duracion: { unidad: 'lap' } }] }],
  [{ tipo: 'repetir', veces: 51, pasos: [{ tipo: 'trabajo', duracion: { unidad: 'lap' } }] }],
  [{ tipo: 'repetir', veces: 3, pasos: [] }],
  [{ tipo: 'repetir', veces: 3, pasos: [{ tipo: 'repetir', veces: 2, pasos: [] }] }],
  [{ tipo: 'trabajo', duracion: { unidad: 'lap' }, objetivo: { tipo: 'zona', zona: 'Z' } }],
  [{ tipo: 'trabajo', duracion: { unidad: 'lap' }, objetivo: { tipo: 'ritmo', min_seg_km: 300, max_seg_km: 250 } }],
  Array.from({ length: 31 }, () => ({ tipo: 'trabajo', duracion: { unidad: 'lap' } })),
]) {
  assert.equal(validarPasos(malo).ok, false, JSON.stringify(malo)?.slice(0, 80))
}

// Resumen con VDOT
const ritmos = ritmosDesdeVdot(45)
const r = resumenSesion(series, ritmos)
assert.equal(r.lineas.length, 3)
assert.ok(r.lineas[1].startsWith('5 ×'), r.lineas[1])
assert.ok(r.lineas[1].includes('1000 m'), r.lineas[1])
assert.ok(r.lineas[1].includes('4:'), r.lineas[1]) // ritmo I con VDOT 45
assert.equal(r.distancia_m > 5000 + 2000, true) // 5 km trabajo + 2 km recup + calentamiento/enfriamiento
assert.ok(r.duracion_s !== null && r.duracion_s > 2400)

// Sin VDOT: sin números de ritmo, sin duración total
const sin = resumenSesion(series, null)
assert.equal(sin.duracion_s, null)
assert.ok(sin.lineas[1].includes('zona I'), sin.lineas[1])
assert.ok(!/\d:\d\d\/km/.test(sin.lineas[1]))

assert.equal(
  lineaPaso({ tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 60 } }, null),
  'Recuperación 1:00'
)

console.log('pasos.test.ts OK')
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx tsx scripts/pasos.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

```ts
// lib/entrenos/pasos.ts
import { formatearRitmo, type Ritmos, type ZonaRitmo } from './ritmos'

export type Duracion =
  | { unidad: 'metros' | 'segundos'; valor: number }
  | { unidad: 'lap' }

export type Objetivo =
  | { tipo: 'zona'; zona: ZonaRitmo }
  | { tipo: 'ritmo'; min_seg_km: number; max_seg_km: number }
  | { tipo: 'fc'; min: number; max: number }
  | { tipo: 'rpe'; valor: number }

export type TipoPasoSimple = 'calentamiento' | 'trabajo' | 'recuperacion' | 'enfriamiento'

export interface PasoSimple {
  tipo: TipoPasoSimple
  duracion: Duracion
  objetivo?: Objetivo
  nota?: string
}
export interface PasoRepetir {
  tipo: 'repetir'
  veces: number
  pasos: PasoSimple[]
}
export type Paso = PasoSimple | PasoRepetir

const TIPOS_SIMPLES: TipoPasoSimple[] = ['calentamiento', 'trabajo', 'recuperacion', 'enfriamiento']
const ZONAS: ZonaRitmo[] = ['E', 'M', 'T', 'I', 'R']
const MAX_PASOS = 30

const esNumero = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

function errorDuracion(d: unknown): string | null {
  if (!esObjeto(d)) return 'duración ausente'
  if (d.unidad === 'lap') return null
  if ((d.unidad === 'metros' || d.unidad === 'segundos') && esNumero(d.valor) && d.valor > 0) return null
  return 'duración inválida'
}

function errorObjetivo(o: unknown): string | null {
  if (o === undefined) return null
  if (!esObjeto(o)) return 'objetivo inválido'
  if (o.tipo === 'zona') return ZONAS.includes(o.zona as ZonaRitmo) ? null : 'zona de ritmo inválida'
  if (o.tipo === 'ritmo') {
    return esNumero(o.min_seg_km) && esNumero(o.max_seg_km) && o.min_seg_km > 0 && o.min_seg_km < o.max_seg_km
      ? null : 'rango de ritmo inválido (mínimo debe ser menor que máximo)'
  }
  if (o.tipo === 'fc') {
    return esNumero(o.min) && esNumero(o.max) && o.min > 0 && o.min < o.max ? null : 'rango de FC inválido'
  }
  if (o.tipo === 'rpe') return esNumero(o.valor) && o.valor >= 1 && o.valor <= 10 ? null : 'RPE inválido'
  return 'tipo de objetivo desconocido'
}

function errorSimple(p: unknown): string | null {
  if (!esObjeto(p)) return 'paso inválido'
  if (!TIPOS_SIMPLES.includes(p.tipo as TipoPasoSimple)) return `tipo de paso desconocido: ${String(p.tipo)}`
  return errorDuracion(p.duracion) ?? errorObjetivo(p.objetivo)
}

export function validarPasos(x: unknown): { ok: true; pasos: Paso[] } | { ok: false; error: string } {
  if (!Array.isArray(x) || x.length === 0) return { ok: false, error: 'La sesión no tiene pasos' }
  if (x.length > MAX_PASOS) return { ok: false, error: `Demasiados pasos (máx. ${MAX_PASOS})` }
  for (const p of x) {
    if (esObjeto(p) && p.tipo === 'repetir') {
      if (!esNumero(p.veces) || !Number.isInteger(p.veces) || p.veces < 1 || p.veces > 50) {
        return { ok: false, error: 'Las repeticiones deben ser un entero entre 1 y 50' }
      }
      if (!Array.isArray(p.pasos) || p.pasos.length === 0) return { ok: false, error: 'Un bloque repetido necesita pasos' }
      for (const q of p.pasos) {
        const e = errorSimple(q)
        if (e) return { ok: false, error: e }
      }
    } else {
      const e = errorSimple(p)
      if (e) return { ok: false, error: e }
    }
  }
  return { ok: true, pasos: x as Paso[] }
}

/** Ritmo objetivo del paso en seg/km, o null si no hay ritmo aplicable. */
export function ritmoDelPaso(p: PasoSimple, ritmos: Ritmos | null): number | null {
  const o = p.objetivo
  if (o?.tipo === 'ritmo') return (o.min_seg_km + o.max_seg_km) / 2
  if (o?.tipo === 'zona') return ritmos ? ritmos[o.zona] : null
  return null
}

const NOMBRE_TIPO: Record<TipoPasoSimple, string> = {
  calentamiento: 'Calentamiento',
  trabajo: 'Trabajo',
  recuperacion: 'Recuperación',
  enfriamiento: 'Vuelta a la calma',
}

function textoDuracion(d: Duracion): string {
  if (d.unidad === 'lap') return 'hasta pulsar lap'
  if (d.unidad === 'metros') return `${d.valor} m`
  const m = Math.floor(d.valor / 60)
  const s = Math.round(d.valor % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function textoObjetivo(p: PasoSimple, ritmos: Ritmos | null): string {
  const o = p.objetivo
  if (!o) return ''
  if (o.tipo === 'zona') return ritmos ? ` @ ${formatearRitmo(ritmos[o.zona])}/km` : ` @ zona ${o.zona}`
  if (o.tipo === 'ritmo') return ` @ ${formatearRitmo(o.min_seg_km)}–${formatearRitmo(o.max_seg_km)}/km`
  if (o.tipo === 'fc') return ` @ ${o.min}–${o.max} ppm`
  return ` @ RPE ${o.valor}`
}

export function lineaPaso(p: PasoSimple, ritmos: Ritmos | null): string {
  return `${NOMBRE_TIPO[p.tipo]} ${textoDuracion(p.duracion)}${textoObjetivo(p, ritmos)}`
}

/** Metros y segundos de un paso simple (cada uno, si se pueden conocer). */
function medidas(p: PasoSimple, ritmos: Ritmos | null): { m: number; s: number | null } {
  const d = p.duracion
  if (d.unidad === 'lap') return { m: 0, s: null }
  // Sin objetivo de ritmo se asume ritmo fácil (E) para estimar.
  const ritmo = ritmoDelPaso(p, ritmos) ?? ritmos?.E ?? null
  if (d.unidad === 'metros') return { m: d.valor, s: ritmo ? (d.valor / 1000) * ritmo : null }
  return { m: ritmo ? (d.valor / ritmo) * 1000 : 0, s: d.valor }
}

export function resumenSesion(
  pasos: Paso[],
  ritmos: Ritmos | null,
): { distancia_m: number; duracion_s: number | null; lineas: string[] } {
  let distancia = 0
  let duracion: number | null = 0
  const lineas: string[] = []

  const acumular = (p: PasoSimple, veces: number) => {
    const { m, s } = medidas(p, ritmos)
    distancia += m * veces
    duracion = duracion === null || s === null ? null : duracion + s * veces
  }

  for (const p of pasos) {
    if (p.tipo === 'repetir') {
      lineas.push(`${p.veces} × (${p.pasos.map(q => lineaPaso(q, ritmos).replace(/^(\w+)\s/, (_, w) => `${w.toLowerCase()} `)).join(' + ')})`)
      p.pasos.forEach(q => acumular(q, p.veces))
    } else {
      lineas.push(lineaPaso(p, ritmos))
      acumular(p, 1)
    }
  }
  return { distancia_m: Math.round(distancia), duracion_s: duracion === null ? null : Math.round(duracion), lineas }
}
```

Nota: el test espera que, sin VDOT, la línea del bloque incluya `zona I` — la línea del bloque usa `lineaPaso(...)`, que ya escribe «@ zona I» cuando no hay ritmos. Y con ritmos, `4:` (ritmo I ≈ 4:15). La línea del bloque empieza por `5 ×` y contiene `1000 m`.

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npx tsx scripts/pasos.test.ts` → `pasos.test.ts OK`
Run: `npx tsc --noEmit --pretty false` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add lib/entrenos/pasos.ts scripts/pasos.test.ts
git commit -m "feat(running): modelo de pasos, validación y resumen"
```

---

### Task 3: Próxima fecha de una sesión

**Files:**
- Create: `lib/entrenos/proxima-fecha.ts`
- Test: `scripts/proxima-fecha.test.ts`

**Interfaces:**
- Produces: `proximaFechaDia(diaSemana: string | null | undefined, desde?: Date): string | null` — devuelve `YYYY-MM-DD` del próximo día con ese nombre (hoy si coincide); `null` si el nombre no se reconoce. Usa la fecha local de `desde` (por defecto ahora).

- [ ] **Step 1: Test que falla**

```ts
// scripts/proxima-fecha.test.ts
import assert from 'node:assert/strict'
import { proximaFechaDia } from '../lib/entrenos/proxima-fecha'

// 09-10-2026 es viernes
const viernes = new Date(2026, 9, 9, 12, 0, 0)
assert.equal(proximaFechaDia('Viernes', viernes), '2026-10-09') // hoy
assert.equal(proximaFechaDia('Sábado', viernes), '2026-10-10')
assert.equal(proximaFechaDia('sabado', viernes), '2026-10-10') // sin acento/minúscula
assert.equal(proximaFechaDia('Lunes', viernes), '2026-10-12') // ya pasó esta semana → próximo
assert.equal(proximaFechaDia('Miércoles', viernes), '2026-10-14')
assert.equal(proximaFechaDia('MIERCOLES', viernes), '2026-10-14')
assert.equal(proximaFechaDia('Domingo', viernes), '2026-10-11')
assert.equal(proximaFechaDia('Jueves', viernes), '2026-10-15')
assert.equal(proximaFechaDia('Funsday', viernes), null)
assert.equal(proximaFechaDia(null, viernes), null)
assert.equal(proximaFechaDia('', viernes), null)
// Cambio de mes
assert.equal(proximaFechaDia('Lunes', new Date(2026, 9, 30, 9, 0, 0)), '2026-11-02')

console.log('proxima-fecha.test.ts OK')
```

- [ ] **Step 2:** Run `npx tsx scripts/proxima-fecha.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

```ts
// lib/entrenos/proxima-fecha.ts
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function aIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function proximaFechaDia(diaSemana: string | null | undefined, desde: Date = new Date()): string | null {
  if (!diaSemana) return null
  const objetivo = DIAS.indexOf(normalizar(diaSemana))
  if (objetivo < 0) return null
  const dif = (objetivo - desde.getDay() + 7) % 7
  const fecha = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + dif)
  return aIso(fecha)
}
```

- [ ] **Step 4:** Run `npx tsx scripts/proxima-fecha.test.ts` → `proxima-fecha.test.ts OK`.

- [ ] **Step 5: Commit**

```bash
git add lib/entrenos/proxima-fecha.ts scripts/proxima-fecha.test.ts
git commit -m "feat(running): próxima fecha de un día de la semana"
```

---

### Task 4: Migración SQL

**Files:**
- Create: `supabase/migrations/20261009120000_sesiones_pasos_garmin.sql`

**Interfaces:**
- Produces: columnas `pasos jsonb` en `plantilla_sesiones` y `sesiones_entrenamiento`; `garmin_workout_id text`, `garmin_programado_fecha date` en `sesiones_entrenamiento`.

- [ ] **Step 1: Escribir la migración**

```sql
-- 20261009120000_sesiones_pasos_garmin.sql
-- Running estructurado: pasos de la sesión + rastro del entreno enviado a Garmin.
ALTER TABLE public.plantilla_sesiones
  ADD COLUMN IF NOT EXISTS pasos jsonb;

ALTER TABLE public.sesiones_entrenamiento
  ADD COLUMN IF NOT EXISTS pasos jsonb,
  ADD COLUMN IF NOT EXISTS garmin_workout_id text,
  ADD COLUMN IF NOT EXISTS garmin_programado_fecha date;

COMMENT ON COLUMN public.plantilla_sesiones.pasos IS 'Pasos estructurados de carrera (ver lib/entrenos/pasos.ts). NULL = sesión clásica por ejercicios.';
COMMENT ON COLUMN public.sesiones_entrenamiento.pasos IS 'Pasos estructurados de carrera. NULL = sesión clásica por ejercicios.';
```

- [ ] **Step 2: Confirmar con Carlos y aplicar**

Es una migración aditiva (solo columnas nuevas nullable), segura. Preguntar a Carlos «¿aplico la migración en producción?» y, con su sí, aplicarla por el método que se usó en sesiones anteriores (SQL en Supabase / `supabase db push`). 
Verificar:

```sql
select column_name from information_schema.columns
where table_schema='public' and table_name in ('plantilla_sesiones','sesiones_entrenamiento')
  and column_name in ('pasos','garmin_workout_id','garmin_programado_fecha');
```
Expected: 4 filas (pasos ×2, garmin_workout_id, garmin_programado_fecha).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20261009120000_sesiones_pasos_garmin.sql
git commit -m "feat(running): columnas pasos y rastro Garmin en sesiones"
```

---

### Task 5: Formato de workout de Garmin

**Files:**
- Create: `lib/integraciones/garmin-workouts-formato.ts`
- Test: `scripts/garmin-workouts-formato.test.ts`

**Interfaces:**
- Consumes: `Paso`, `PasoSimple`, `ritmoDelPaso` de `lib/entrenos/pasos`; `Ritmos` de `lib/entrenos/ritmos`.
- Produces: `pasosAGarmin(nombre: string, pasos: Paso[], ritmos: Ritmos | null, descripcion?: string): GarminWorkoutPayload` (objeto JSON listo para `addWorkout`).

IDs de Garmin Connect usados (conocidos del formato público de workouts): sportType running = 1; stepType warmup 1, cooldown 2, interval 3, recovery 4, repeat 6; endCondition lap.button 1, time 2, distance 3, iterations 7; targetType no.target 1, heart.rate.zone 4, pace.zone 6. En `pace.zone`, `targetValueOne` es la velocidad **menor** (m/s) y `targetValueTwo` la **mayor**.

- [ ] **Step 1: Test que falla**

```ts
// scripts/garmin-workouts-formato.test.ts
import assert from 'node:assert/strict'
import { pasosAGarmin } from '../lib/integraciones/garmin-workouts-formato'
import { ritmosDesdeVdot } from '../lib/entrenos/ritmos'
import type { Paso } from '../lib/entrenos/pasos'

const pasos: Paso[] = [
  { tipo: 'calentamiento', duracion: { unidad: 'segundos', valor: 900 }, objetivo: { tipo: 'zona', zona: 'E' } },
  { tipo: 'repetir', veces: 5, pasos: [
    { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 1000 }, objetivo: { tipo: 'zona', zona: 'I' } },
    { tipo: 'recuperacion', duracion: { unidad: 'metros', valor: 400 } },
  ] },
  { tipo: 'enfriamiento', duracion: { unidad: 'lap' } },
]
const ritmos = ritmosDesdeVdot(45)!
const w = pasosAGarmin('Series 5x1000', pasos, ritmos)

assert.equal(w.workoutName, 'Series 5x1000')
assert.equal(w.sportType.sportTypeKey, 'running')
const steps = w.workoutSegments[0].workoutSteps
assert.equal(steps.length, 3)

// Calentamiento por tiempo con objetivo de ritmo en rango (m/s, uno < dos)
assert.equal(steps[0].stepType.stepTypeKey, 'warmup')
assert.equal(steps[0].endCondition.conditionTypeKey, 'time')
assert.equal(steps[0].endConditionValue, 900)
assert.equal(steps[0].targetType.workoutTargetTypeKey, 'pace.zone')
assert.ok(steps[0].targetValueOne! < steps[0].targetValueTwo!)

// Bloque de repetición
const rep = steps[1] as any
assert.equal(rep.type, 'RepeatGroupDTO')
assert.equal(rep.numberOfIterations, 5)
assert.equal(rep.endCondition.conditionTypeKey, 'iterations')
assert.equal(rep.endConditionValue, 5)
assert.equal(rep.workoutSteps.length, 2)
assert.equal(rep.workoutSteps[0].stepType.stepTypeKey, 'interval')
assert.equal(rep.workoutSteps[0].endCondition.conditionTypeKey, 'distance')
assert.equal(rep.workoutSteps[0].endConditionValue, 1000)
// Ritmo I con VDOT 45 ≈ 4:15/km ≈ 3,9 m/s
assert.ok(rep.workoutSteps[0].targetValueTwo > 3.7 && rep.workoutSteps[0].targetValueTwo < 4.4)
// Recuperación sin objetivo → sin target
assert.equal(rep.workoutSteps[1].stepType.stepTypeKey, 'recovery')
assert.equal(rep.workoutSteps[1].targetType.workoutTargetTypeKey, 'no.target')

// Vuelta a la calma con lap
assert.equal(steps[2].stepType.stepTypeKey, 'cooldown')
assert.equal(steps[2].endCondition.conditionTypeKey, 'lap.button')

// stepOrder consecutivo y único (incluye los pasos dentro del bloque)
const orden: number[] = []
const rec = (s: any[]) => s.forEach(x => { orden.push(x.stepOrder); if (x.workoutSteps) rec(x.workoutSteps) })
rec(steps)
assert.deepEqual(orden, [1, 2, 3, 4, 5])

// Sin VDOT: la zona no genera objetivo de ritmo (nunca se inventa)
const sin = pasosAGarmin('x', pasos, null).workoutSegments[0].workoutSteps
assert.equal(sin[0].targetType.workoutTargetTypeKey, 'no.target')
assert.equal(sin[0].targetValueOne, undefined)

// Ritmo manual y FC
const manual = pasosAGarmin('m', [
  { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 2000 }, objetivo: { tipo: 'ritmo', min_seg_km: 290, max_seg_km: 300 } },
  { tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 600 }, objetivo: { tipo: 'fc', min: 150, max: 160 } },
], null).workoutSegments[0].workoutSteps
assert.equal(manual[0].targetType.workoutTargetTypeKey, 'pace.zone')
assert.ok(Math.abs(manual[0].targetValueOne! - 1000 / 300) < 0.01) // más lento = menor velocidad
assert.ok(Math.abs(manual[0].targetValueTwo! - 1000 / 290) < 0.01)
assert.equal(manual[1].targetType.workoutTargetTypeKey, 'heart.rate.zone')
assert.equal(manual[1].targetValueOne, 150)
assert.equal(manual[1].targetValueTwo, 160)

console.log('garmin-workouts-formato.test.ts OK')
```

- [ ] **Step 2:** Run `npx tsx scripts/garmin-workouts-formato.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

```ts
// lib/integraciones/garmin-workouts-formato.ts
import { ritmoDelPaso, type Paso, type PasoSimple } from '@/lib/entrenos/pasos'
import type { Ritmos } from '@/lib/entrenos/ritmos'

const SPORT_RUNNING = { sportTypeId: 1, sportTypeKey: 'running' }

const STEP_TYPE = {
  calentamiento: { stepTypeId: 1, stepTypeKey: 'warmup' },
  enfriamiento: { stepTypeId: 2, stepTypeKey: 'cooldown' },
  trabajo: { stepTypeId: 3, stepTypeKey: 'interval' },
  recuperacion: { stepTypeId: 4, stepTypeKey: 'recovery' },
} as const

const END = {
  lap: { conditionTypeId: 1, conditionTypeKey: 'lap.button' },
  segundos: { conditionTypeId: 2, conditionTypeKey: 'time' },
  metros: { conditionTypeId: 3, conditionTypeKey: 'distance' },
  iteraciones: { conditionTypeId: 7, conditionTypeKey: 'iterations' },
} as const

const TARGET = {
  ninguno: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' },
  fc: { workoutTargetTypeId: 4, workoutTargetTypeKey: 'heart.rate.zone' },
  ritmo: { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone' },
} as const

/** Margen alrededor del ritmo de una zona (±3 %). */
const MARGEN_ZONA = 0.03

export interface GarminStep {
  type: 'ExecutableStepDTO'
  stepOrder: number
  stepType: { stepTypeId: number; stepTypeKey: string }
  endCondition: { conditionTypeId: number; conditionTypeKey: string }
  endConditionValue: number | null
  targetType: { workoutTargetTypeId: number; workoutTargetTypeKey: string }
  targetValueOne?: number
  targetValueTwo?: number
  description?: string
}
export interface GarminRepeat {
  type: 'RepeatGroupDTO'
  stepOrder: number
  stepType: { stepTypeId: number; stepTypeKey: string }
  numberOfIterations: number
  endCondition: { conditionTypeId: number; conditionTypeKey: string }
  endConditionValue: number
  smartRepeat: boolean
  workoutSteps: GarminStep[]
}
export interface GarminWorkoutPayload {
  workoutName: string
  description?: string
  sportType: { sportTypeId: number; sportTypeKey: string }
  workoutSegments: Array<{
    segmentOrder: number
    sportType: { sportTypeId: number; sportTypeKey: string }
    workoutSteps: Array<GarminStep | GarminRepeat>
  }>
}

function convertirPaso(p: PasoSimple, orden: number, ritmos: Ritmos | null): GarminStep {
  const d = p.duracion
  const paso: GarminStep = {
    type: 'ExecutableStepDTO',
    stepOrder: orden,
    stepType: { ...STEP_TYPE[p.tipo] },
    endCondition: d.unidad === 'lap' ? { ...END.lap } : { ...END[d.unidad] },
    endConditionValue: d.unidad === 'lap' ? null : d.valor,
    targetType: { ...TARGET.ninguno },
  }
  if (p.nota) paso.description = p.nota.slice(0, 512)

  const o = p.objetivo
  if (o?.tipo === 'fc') {
    paso.targetType = { ...TARGET.fc }
    paso.targetValueOne = o.min
    paso.targetValueTwo = o.max
  } else if (o?.tipo === 'ritmo') {
    paso.targetType = { ...TARGET.ritmo }
    paso.targetValueOne = 1000 / o.max_seg_km // más lento = menor velocidad
    paso.targetValueTwo = 1000 / o.min_seg_km
  } else if (o?.tipo === 'zona') {
    const ritmo = ritmoDelPaso(p, ritmos)
    if (ritmo !== null) {
      paso.targetType = { ...TARGET.ritmo }
      paso.targetValueOne = 1000 / (ritmo * (1 + MARGEN_ZONA))
      paso.targetValueTwo = 1000 / (ritmo * (1 - MARGEN_ZONA))
    }
  }
  return paso
}

export function pasosAGarmin(
  nombre: string,
  pasos: Paso[],
  ritmos: Ritmos | null,
  descripcion?: string,
): GarminWorkoutPayload {
  let orden = 0
  const workoutSteps: Array<GarminStep | GarminRepeat> = pasos.map(p => {
    if (p.tipo === 'repetir') {
      const grupoOrden = ++orden
      const hijos = p.pasos.map(q => convertirPaso(q, ++orden, ritmos))
      return {
        type: 'RepeatGroupDTO',
        stepOrder: grupoOrden,
        stepType: { stepTypeId: 6, stepTypeKey: 'repeat' },
        numberOfIterations: p.veces,
        endCondition: { ...END.iteraciones },
        endConditionValue: p.veces,
        smartRepeat: false,
        workoutSteps: hijos,
      } satisfies GarminRepeat
    }
    return convertirPaso(p, ++orden, ritmos)
  })

  return {
    workoutName: nombre.slice(0, 80),
    description: descripcion,
    sportType: { ...SPORT_RUNNING },
    workoutSegments: [{ segmentOrder: 1, sportType: { ...SPORT_RUNNING }, workoutSteps }],
  }
}
```

- [ ] **Step 4:** Run `npx tsx scripts/garmin-workouts-formato.test.ts` → `... OK`. Si `tsx` no resuelve el alias `@/`, cambiar los dos imports a rutas relativas (`../entrenos/pasos`, `../entrenos/ritmos`) — es el patrón de los otros tests del repo.
Run: `npx tsc --noEmit --pretty false` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add lib/integraciones/garmin-workouts-formato.ts scripts/garmin-workouts-formato.test.ts
git commit -m "feat(running): convertir pasos al formato de workout de Garmin"
```

---

### Task 6: Envío y programación en Garmin (servicio + endpoint)

**Files:**
- Create: `lib/integraciones/garmin-workouts.ts`
- Create: `app/api/entrenos/sesiones/[id]/garmin/route.ts`

**Interfaces:**
- Consumes: `descifrarConexionGarmin`, `cifrarConexionGarmin` (`lib/integraciones/garmin-connect-perclient`); `pasosAGarmin`; `validarPasos`; `ritmosDesdeVdot`; `proximaFechaDia`; `autorizarAccesoCliente`; `createServiceSupabase`.
- Produces: `enviarSesionAGarmin(db: SupabaseClient, sesionId: string, fechaIso?: string): Promise<{ workoutId: string; fecha: string | null }>` — lanza `ErrorGarmin` (con `.mensaje` apto para mostrar al usuario) en fallos previstos. Endpoint `POST /api/entrenos/sesiones/[id]/garmin` body opcional `{ fecha?: "YYYY-MM-DD" }` → `200 { workoutId, fecha }` o `{ error }` con 4xx/5xx.

Esta tarea no tiene test automático (depende de Garmin real); su verificación es la prueba real del Task 9. Se pone el máximo en tipos y errores claros.

- [ ] **Step 1: Servicio**

```ts
// lib/integraciones/garmin-workouts.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { cifrarConexionGarmin, descifrarConexionGarmin } from './garmin-connect-perclient'
import { pasosAGarmin } from './garmin-workouts-formato'
import { validarPasos } from '@/lib/entrenos/pasos'
import { ritmosDesdeVdot } from '@/lib/entrenos/ritmos'
import { proximaFechaDia } from '@/lib/entrenos/proxima-fecha'

export class ErrorGarmin extends Error {
  constructor(public mensaje: string, public status = 400) {
    super(mensaje)
  }
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

export async function enviarSesionAGarmin(
  db: SupabaseClient,
  sesionId: string,
  fechaIso?: string,
): Promise<{ workoutId: string; fecha: string | null }> {
  if (fechaIso !== undefined && !FECHA_RE.test(fechaIso)) throw new ErrorGarmin('Fecha inválida')

  const { data: sesion } = await db
    .from('sesiones_entrenamiento')
    .select('id, nombre, dia_semana, notas, pasos, garmin_workout_id, plan_id')
    .eq('id', sesionId)
    .single()
  if (!sesion) throw new ErrorGarmin('Sesión no encontrada', 404)

  const validacion = validarPasos(sesion.pasos)
  if (!validacion.ok) throw new ErrorGarmin(`Esta sesión no tiene pasos de carrera válidos: ${validacion.error}`)

  const { data: plan } = await db.from('planes_entrenamiento').select('cliente_id').eq('id', sesion.plan_id).single()
  if (!plan) throw new ErrorGarmin('Plan no encontrado', 404)
  const clienteId = plan.cliente_id as string

  const { data: perfil } = await db.from('perfil_entreno_cliente').select('vdot').eq('cliente_id', clienteId).maybeSingle()
  const ritmos = perfil?.vdot ? ritmosDesdeVdot(Number(perfil.vdot)) : null

  const { data: integ } = await db
    .from('integraciones_cliente')
    .select('credenciales_json')
    .eq('cliente_id', clienteId)
    .eq('proveedor', 'garmin_connect')
    .maybeSingle()
  if (!integ?.credenciales_json) throw new ErrorGarmin('Este atleta no tiene Garmin Connect conectado', 409)

  let conexion
  try {
    conexion = descifrarConexionGarmin(integ.credenciales_json)
  } catch {
    throw new ErrorGarmin('No se pudo leer la conexión de Garmin; vuelve a conectarla', 409)
  }

  const { GarminConnect } = await import('garmin-connect')
  let gc = new GarminConnect({ username: conexion.email, password: conexion.password })
  try {
    if (conexion.oauth1 && conexion.oauth2) {
      gc.loadToken(conexion.oauth1, conexion.oauth2)
      try {
        await gc.getUserProfile()
      } catch {
        gc = new GarminConnect({ username: conexion.email, password: conexion.password })
        await gc.login()
      }
    } else {
      await gc.login()
    }
  } catch {
    throw new ErrorGarmin('No se pudo iniciar sesión en Garmin; reconecta la cuenta', 409)
  }

  // Reenvío: borrar el entreno anterior para no duplicar (si ya no existe, seguimos).
  if (sesion.garmin_workout_id) {
    try {
      await gc.deleteWorkout({ workoutId: sesion.garmin_workout_id })
    } catch {
      /* ya borrado en Garmin: no es un error */
    }
  }

  const payload = pasosAGarmin(sesion.nombre, validacion.pasos, ritmos, sesion.notas ?? undefined)
  let workoutId: string
  try {
    const creado = await gc.addWorkout(payload as never)
    workoutId = String((creado as unknown as { workoutId: number | string }).workoutId)
  } catch {
    throw new ErrorGarmin('Garmin rechazó el entreno. Inténtalo de nuevo; si persiste, avisa para revisar el formato', 502)
  }

  const fecha = fechaIso ?? proximaFechaDia(sesion.dia_semana)
  if (fecha) {
    try {
      await gc.client.post(`${gc.url.GC_API}/workout-service/schedule/${workoutId}`, { date: fecha })
    } catch {
      // El entreno existe en Garmin pero no se pudo poner en el calendario.
      await db.from('sesiones_entrenamiento').update({ garmin_workout_id: workoutId, garmin_programado_fecha: null }).eq('id', sesionId)
      throw new ErrorGarmin('El entreno se creó en Garmin pero no se pudo programar en el calendario; búscalo en Entrenamientos → Mis entrenamientos', 502)
    }
  }

  await db.from('sesiones_entrenamiento')
    .update({ garmin_workout_id: workoutId, garmin_programado_fecha: fecha })
    .eq('id', sesionId)

  // Guardar tokens renovados para no pedir login completo la próxima vez.
  try {
    const { oauth1, oauth2 } = gc.exportToken()
    await db.from('integraciones_cliente')
      .update({ credenciales_json: cifrarConexionGarmin({ email: conexion.email, password: conexion.password, oauth1, oauth2 }) })
      .eq('cliente_id', clienteId)
      .eq('proveedor', 'garmin_connect')
  } catch {
    /* no crítico */
  }

  return { workoutId, fecha }
}
```

- [ ] **Step 2: Endpoint**

```ts
// app/api/entrenos/sesiones/[id]/garmin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarAccesoCliente } from '@/lib/cliente/autorizar-acceso-cliente'
import { enviarSesionAGarmin, ErrorGarmin } from '@/lib/integraciones/garmin-workouts'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createServiceSupabase()

  const { data: sesion } = await admin.from('sesiones_entrenamiento').select('plan_id').eq('id', id).maybeSingle()
  if (!sesion) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  const { data: plan } = await admin.from('planes_entrenamiento').select('cliente_id').eq('id', sesion.plan_id).maybeSingle()
  if (!plan) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

  const auth = await autorizarAccesoCliente(request, { clienteId: plan.cliente_id })
  if (auth instanceof NextResponse) return auth

  let fecha: string | undefined
  try {
    const body = await request.json()
    if (typeof body?.fecha === 'string') fecha = body.fecha
  } catch {
    /* sin cuerpo: se usa la próxima fecha del día de la sesión */
  }

  try {
    const r = await enviarSesionAGarmin(admin, id, fecha)
    return NextResponse.json(r)
  } catch (e) {
    if (e instanceof ErrorGarmin) return NextResponse.json({ error: e.mensaje }, { status: e.status })
    return NextResponse.json({ error: 'No se pudo enviar a Garmin' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Comprobar tipos**

Run: `npx tsc --noEmit --pretty false`
Expected: sin errores. Si `gc.url` o `gc.client.post` no están tipados como públicos, usar `(gc as unknown as { url: { GC_API: string }; client: { post: (u: string, d: unknown) => Promise<unknown> } })` en esa línea concreta y dejar un comentario de una línea con el motivo.

- [ ] **Step 4: Commit**

```bash
git add lib/integraciones/garmin-workouts.ts "app/api/entrenos/sesiones/[id]/garmin/route.ts"
git commit -m "feat(running): enviar y programar sesión en Garmin"
```

---

### Task 7: Pasos de las 4 sesiones de running ya sembradas

**Files:**
- Create: `lib/entrenos/running-plantillas.ts`
- Create: `scripts/convertir-running-a-pasos.ts`
- Test: `scripts/running-plantillas.test.ts`

**Interfaces:**
- Consumes: `Paso`, `validarPasos`.
- Produces: `PASOS_RUNNING: Record<string, Paso[]>` indexado por el nombre exacto de la sesión.

- [ ] **Step 1: Test que falla**

```ts
// scripts/running-plantillas.test.ts
import assert from 'node:assert/strict'
import { PASOS_RUNNING } from '../lib/entrenos/running-plantillas'
import { validarPasos, resumenSesion } from '../lib/entrenos/pasos'
import { ritmosDesdeVdot } from '../lib/entrenos/ritmos'

const nombres = [
  'Long Run — E-pace',
  'Umbral — Tempo + Strides',
  'VO2max — Intervalos I-pace',
  'Easy + Strides — Recuperación activa',
]
assert.deepEqual(Object.keys(PASOS_RUNNING).sort(), [...nombres].sort())
for (const n of nombres) assert.equal(validarPasos(PASOS_RUNNING[n]).ok, true, n)

const ritmos = ritmosDesdeVdot(45)
const vo2 = resumenSesion(PASOS_RUNNING['VO2max — Intervalos I-pace'], ritmos)
// 15' E + 5×(1000+400) + 4×(100+60") + 10' E → bastante más de 7 km
assert.ok(vo2.distancia_m > 9000 && vo2.distancia_m < 14000, String(vo2.distancia_m))
const largo = resumenSesion(PASOS_RUNNING['Long Run — E-pace'], ritmos)
assert.equal(largo.duracion_s, 4500)

console.log('running-plantillas.test.ts OK')
```

- [ ] **Step 2:** Run `npx tsx scripts/running-plantillas.test.ts` → FAIL.

- [ ] **Step 3: Implementar datos**

```ts
// lib/entrenos/running-plantillas.ts
import type { Paso } from './pasos'

const E = { tipo: 'zona', zona: 'E' } as const
const T = { tipo: 'zona', zona: 'T' } as const
const I = { tipo: 'zona', zona: 'I' } as const
const R = { tipo: 'zona', zona: 'R' } as const

/** Pasos de las sesiones de «Running — Fondo Intermedio (VDOT 40-50)», por nombre de sesión. */
export const PASOS_RUNNING: Record<string, Paso[]> = {
  'Long Run — E-pace': [
    { tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 4500 }, objetivo: E, nota: 'Conversacional. Hidratación cada 20-25 min.' },
  ],
  'Umbral — Tempo + Strides': [
    { tipo: 'calentamiento', duracion: { unidad: 'segundos', valor: 900 }, objetivo: E },
    { tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 1500 }, objetivo: T, nota: 'Cómodamente duro, frases cortas.' },
    { tipo: 'repetir', veces: 6, pasos: [
      { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 100 }, objetivo: R, nota: 'Progresivo, máximo en los últimos 40 m.' },
      { tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 60 } },
    ] },
    { tipo: 'enfriamiento', duracion: { unidad: 'segundos', valor: 600 }, objetivo: E },
  ],
  'VO2max — Intervalos I-pace': [
    { tipo: 'calentamiento', duracion: { unidad: 'segundos', valor: 900 }, objetivo: E },
    { tipo: 'repetir', veces: 5, pasos: [
      { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 1000 }, objetivo: I },
      { tipo: 'recuperacion', duracion: { unidad: 'metros', valor: 400 }, objetivo: E, nota: 'Trote lento, sin parar.' },
    ] },
    { tipo: 'repetir', veces: 4, pasos: [
      { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 100 }, objetivo: R },
      { tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 60 } },
    ] },
    { tipo: 'enfriamiento', duracion: { unidad: 'segundos', valor: 600 }, objetivo: E },
  ],
  'Easy + Strides — Recuperación activa': [
    { tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 2700 }, objetivo: E, nota: 'Recuperación activa. Si hay fatiga, reducir a 30 min.' },
    { tipo: 'repetir', veces: 6, pasos: [
      { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 100 }, objetivo: R },
      { tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 60 } },
    ] },
  ],
}
```

- [ ] **Step 4:** Run `npx tsx scripts/running-plantillas.test.ts` → `... OK`.

- [ ] **Step 5: Script de conversión**

Sigue el patrón de `scripts/restaurar-receta.ts` (simula por defecto, `--apply` escribe).

```ts
// scripts/convertir-running-a-pasos.ts
// Uso: npx tsx scripts/convertir-running-a-pasos.ts [--cliente=<uuid>] [--apply]
// Pone `pasos` en las sesiones de running ya sembradas (plantillas y, con --cliente, las sesiones de su plan).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { PASOS_RUNNING } from '../lib/entrenos/running-plantillas'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')
const clienteArg = process.argv.find(a => a.startsWith('--cliente='))?.split('=')[1]

async function main() {
  let ids: string[] = []
  if (clienteArg) {
    const { data: planes } = await db.from('planes_entrenamiento').select('id').eq('cliente_id', clienteArg)
    ids = (planes ?? []).map(p => p.id as string)
  }
  for (const [nombre, pasos] of Object.entries(PASOS_RUNNING)) {
    const { data: plantillas } = await db.from('plantilla_sesiones').select('id').eq('nombre', nombre)
    console.log(`Plantilla «${nombre}»: ${plantillas?.length ?? 0} sesión(es)`)
    if (APPLY && plantillas?.length) {
      const { error } = await db.from('plantilla_sesiones').update({ pasos }).eq('nombre', nombre)
      if (error) throw error
    }
    if (clienteArg) {
      const { data: sesiones } = ids.length
        ? await db.from('sesiones_entrenamiento').select('id').eq('nombre', nombre).in('plan_id', ids)
        : { data: [] as { id: string }[] }
      console.log(`  Cliente ${clienteArg}: ${sesiones?.length ?? 0} sesión(es)`)
      if (APPLY && sesiones?.length) {
        const { error } = await db.from('sesiones_entrenamiento').update({ pasos }).eq('nombre', nombre).in('plan_id', ids)
        if (error) throw error
      }
    }
  }
  console.log(APPLY ? '✅ Aplicado.' : 'Simulación: nada escrito. Usa --apply.')
}
main().catch(e => { console.error('❌', e.message ?? e); process.exit(1) })
```

Comprobar con `npx tsc --noEmit --pretty false`.

- [ ] **Step 6: Simular y aplicar**

Run (simulación): `npx tsx scripts/convertir-running-a-pasos.ts`
Expected: 4 líneas «Plantilla … : N sesión(es)» con N ≥ 1 en cada una (si alguna sale 0, el nombre de la sesión en BD difiere: ajustar la clave en `PASOS_RUNNING` al nombre real y repetir).
Con el visto bueno de Carlos: `npx tsx scripts/convertir-running-a-pasos.ts --apply` (y, para sus sesiones, `--cliente=<su cliente_id> --apply`).

- [ ] **Step 7: Commit**

```bash
git add lib/entrenos/running-plantillas.ts scripts/running-plantillas.test.ts scripts/convertir-running-a-pasos.ts
git commit -m "feat(running): pasos estructurados para las sesiones de running sembradas"
```

---

### Task 8: Tarjeta de pasos y botón «Enviar a Garmin» en la sesión

**Files:**
- Modify: `app/api/cliente/sesion/[id]/route.ts` (select de la sesión y respuesta)
- Create: `components/training/PasosSesion.tsx`
- Modify: `app/cliente/sesion/[id]/page.tsx`

**Interfaces:**
- Consumes: `validarPasos`, `resumenSesion`, `lineaPaso`, `Paso`; `ritmosDesdeVdot`, `Ritmos`, `formatearRitmo`; endpoint del Task 6.
- Produces: la respuesta de `GET /api/cliente/sesion/[id]` añade `sesion.pasos: unknown | null`, `sesion.ritmos: Ritmos | null`, `sesion.garmin: { workoutId: string | null; fecha: string | null }`. Componente `PasosSesion({ sesionId, pasos, ritmos, garmin })`.

- [ ] **Step 1: API — devolver pasos, ritmos y estado Garmin**

En `app/api/cliente/sesion/[id]/route.ts`:
1. Cambiar el select de la sesión a `'id, nombre, dia_semana, notas, contexto_ia, plan_id, pasos, garmin_workout_id, garmin_programado_fecha'`.
2. Tras comprobar la propiedad del plan y antes de `return NextResponse.json`, añadir:

```ts
  const { data: perfilEntreno } = await admin
    .from('perfil_entreno_cliente').select('vdot').eq('cliente_id', clienteId).maybeSingle()
  const ritmos = perfilEntreno?.vdot ? ritmosDesdeVdot(Number(perfilEntreno.vdot)) : null
```
3. Añadir el import `import { ritmosDesdeVdot } from '@/lib/entrenos/ritmos'`.
4. En el objeto `sesion` de la respuesta añadir:

```ts
      pasos: sesion.pasos ?? null,
      ritmos,
      garmin: { workoutId: sesion.garmin_workout_id ?? null, fecha: sesion.garmin_programado_fecha ?? null },
```

- [ ] **Step 2: Componente**

```tsx
// components/training/PasosSesion.tsx
'use client'
import { useMemo, useState } from 'react'
import { WatchIcon } from '@phosphor-icons/react'
import { validarPasos, resumenSesion, lineaPaso, type PasoSimple } from '@/lib/entrenos/pasos'
import { formatearRitmo, type Ritmos } from '@/lib/entrenos/ritmos'

interface Props {
  sesionId: string
  pasos: unknown
  ritmos: Ritmos | null
  garmin: { workoutId: string | null; fecha: string | null }
}

function fechaLegible(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

export default function PasosSesion({ sesionId, pasos, ritmos, garmin }: Props) {
  const valido = useMemo(() => validarPasos(pasos), [pasos])
  const [enviando, setEnviando] = useState(false)
  const [estado, setEstado] = useState(garmin)
  const [error, setError] = useState('')

  if (!valido.ok) return null // JSON corrupto: no se muestra, la sesión sigue funcionando
  const resumen = resumenSesion(valido.pasos, ritmos)

  async function enviar() {
    setEnviando(true)
    setError('')
    try {
      const res = await fetch(`/api/entrenos/sesiones/${sesionId}/garmin`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo enviar a Garmin')
      setEstado({ workoutId: data.workoutId, fecha: data.fecha })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar a Garmin')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="rounded-2xl p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Estructura de la sesión</h2>
        <p className="text-xs font-data" style={{ color: 'var(--text-muted)' }}>
          {(resumen.distancia_m / 1000).toFixed(1)} km
          {resumen.duracion_s !== null ? ` · ${Math.round(resumen.duracion_s / 60)} min` : ''}
        </p>
      </div>

      <ol className="space-y-2">
        {valido.pasos.map((p, i) =>
          p.tipo === 'repetir' ? (
            <li key={i} className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>{p.veces} ×</p>
              <ul className="space-y-0.5">
                {p.pasos.map((q: PasoSimple, j: number) => (
                  <li key={j} className="text-sm" style={{ color: 'var(--text-secondary)' }}>{lineaPaso(q, ritmos)}</li>
                ))}
              </ul>
            </li>
          ) : (
            <li key={i} className="text-sm px-1" style={{ color: 'var(--text-secondary)' }}>{lineaPaso(p, ritmos)}</li>
          ),
        )}
      </ol>

      {!ritmos && (
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          Sin VDOT en tu perfil no puedo calcular los ritmos; añádelo en Perfil atleta y se rellenarán solos.
        </p>
      )}
      {ritmos && (
        <p className="text-xs mt-3 font-data" style={{ color: 'var(--text-muted)' }}>
          Tus ritmos: E {formatearRitmo(ritmos.E)} · M {formatearRitmo(ritmos.M)} · T {formatearRitmo(ritmos.T)} · I {formatearRitmo(ritmos.I)} · R {formatearRitmo(ritmos.R)} /km
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={enviar}
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-[0.98] disabled:opacity-60"
          style={{ background: 'var(--semantic-active)', color: '#fff' }}
        >
          <WatchIcon size={16} />
          {enviando ? 'Enviando…' : estado.workoutId ? 'Reenviar a Garmin' : 'Enviar a Garmin'}
        </button>
        {estado.workoutId && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {estado.fecha ? `Programado en tu Garmin para el ${fechaLegible(estado.fecha)}` : 'Creado en tu Garmin (sin fecha)'}
          </p>
        )}
      </div>
      {error && <p className="text-xs mt-2" style={{ color: 'var(--semantic-danger, #c0392b)' }}>{error}</p>}
    </section>
  )
}
```

Si `WatchIcon` no existe en la versión instalada de `@phosphor-icons/react`, usar `Watch` (comprobar con `grep -c "Watch" node_modules/@phosphor-icons/react/dist/index.d.ts`).

- [ ] **Step 3: Mostrarlo en la página de sesión**

En `app/cliente/sesion/[id]/page.tsx`:
1. Importar: `import PasosSesion from '@/components/training/PasosSesion'` y `import type { Ritmos } from '@/lib/entrenos/ritmos'`.
2. En la interfaz `SesionInfo` añadir: `pasos?: unknown | null; ritmos?: Ritmos | null; garmin?: { workoutId: string | null; fecha: string | null }`.
3. Localizar dónde se pinta `SesionCardMobile`: `grep -n "<SesionCardMobile" app/cliente/sesion/[id]/page.tsx`. Justo encima de ese elemento, dentro del mismo contenedor, insertar:

```tsx
        {sesion.pasos ? (
          <PasosSesion
            sesionId={sesion.id}
            pasos={sesion.pasos}
            ritmos={sesion.ritmos ?? null}
            garmin={sesion.garmin ?? { workoutId: null, fecha: null }}
          />
        ) : null}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit --pretty false` → sin errores.
Run: `npx tsx scripts/pasos.test.ts && npx tsx scripts/ritmos.test.ts && npx tsx scripts/proxima-fecha.test.ts && npx tsx scripts/garmin-workouts-formato.test.ts && npx tsx scripts/running-plantillas.test.ts` → los cinco `OK`.
Ver en navegador (headed + handoff, Carlos inicia sesión): abrir una sesión de running convertida; se ve la tarjeta con pasos y ritmos; una sesión de fuerza NO muestra tarjeta y sigue igual.

- [ ] **Step 5: Commit y push**

```bash
git add "app/api/cliente/sesion/[id]/route.ts" components/training/PasosSesion.tsx "app/cliente/sesion/[id]/page.tsx"
git commit -m "feat(running): tarjeta de pasos y botón Enviar a Garmin en la sesión"
git push origin main
```

---

### Task 9: Prueba real con Carlos

**Files:** ninguno (verificación).

- [ ] **Step 1:** Comprobar que Carlos tiene Garmin Connect conectado en su cliente (`integraciones_cliente`, proveedor `garmin_connect`) y VDOT en su perfil atleta. Si falta el VDOT, añadirlo desde «Perfil atleta».
- [ ] **Step 2:** Con la migración aplicada y el script de conversión con `--cliente=<su id> --apply`, abrir su sesión «VO2max — Intervalos I-pace», pulsar «Enviar a Garmin».
- [ ] **Step 3:** Comprobar en Garmin Connect (web o app): el entreno aparece en Entrenamientos y en el calendario en la fecha esperada, con 5 × 1000 m con ritmo y recuperación de 400 m. Sincronizar el reloj y comprobar que aparece para iniciar.
- [ ] **Step 4:** Pulsar «Reenviar»: debe seguir habiendo UN solo entreno (no duplicado).
- [ ] **Step 5:** Si Garmin rechaza el formato o el ritmo sale en un rango raro, ajustar `garmin-workouts-formato.ts` (IDs o orden `targetValueOne/Two`) con el mensaje real de Garmin, actualizar el test y repetir. Registrar el resultado en `CLAUDE.md` del proyecto (sección de la sesión).
