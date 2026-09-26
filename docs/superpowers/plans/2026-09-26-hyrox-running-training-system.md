# Sistema de rutinas Híbrido Hyrox + Running — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a Carlos (como cliente propio de NutriCoach) un plan de entrenamiento híbrido Hyrox + Running generado por IA, con pesos/reps/ritmos concretos, organizado en bloques de 4 semanas rotando foco (Base→Fuerza→Resistencia→Deload), visible con claridad en día/semana/mes desde el portal cliente.

**Architecture:** Se extiende infraestructura ya existente (`proponer-plan-ciencia` para generar, `sesiones-plan`/`semana-completa` para leer, `SemanaEntrenoCard`/`/cliente/semana` para mostrar) en vez de crear un motor paralelo. Toda la lógica de cálculo de bloque/semana y de clasificación de tipo de sesión vive en un módulo puro nuevo (`lib/entrenos/bloques.ts`) reutilizado por las 3 APIs que lo necesitan. No se crea ninguna tabla ni columna nueva — se usan `sesiones_entrenamiento.fase_bloque`, `sesion_ejercicios.peso_sugerido` y `ejercicios.tipo`, que ya existen en Supabase sin usar.

**Tech Stack:** Next.js App Router (TypeScript), Supabase (Postgres + `createServiceSupabase()`), DeepSeek (`deepseek-chat`) para generación, tests con `node:assert/strict` vía `npx tsx` (patrón ya usado en `scripts/*.test.ts`), verificación manual con `npx tsc --noEmit` + `npm run build` + comprobación contra Supabase real (patrón establecido en el proyecto, no hay suite de tests de rutas API).

**Spec:** `docs/superpowers/specs/2026-09-26-hyrox-running-training-system-design.md`

## Global Constraints

- No crear ninguna migración de base de datos — usar únicamente columnas ya existentes: `sesiones_entrenamiento.fase_bloque`, `sesion_ejercicios.peso_sugerido`, `sesiones_entrenamiento.contexto_ia`, `ejercicios.tipo`.
- El nuevo comportamiento (protocolo híbrido, `fase_bloque`, pesos/ritmos concretos) solo se activa cuando `modalidadFoco === 'hibrido'` dentro de `proponer-plan-ciencia` — cualquier cliente con otra modalidad debe generar planes exactamente igual que antes.
- Toda fecha se compara en días completos (sin horas) para evitar off-by-one por husos horarios, siguiendo el patrón `toISODate()` ya usado en `semana-completa`/`sesiones-plan`.
- Español en nombres de sesión, ejercicios, fases de bloque y textos de UI, consistente con el resto de la app.
- `npx tsc --noEmit` y `npm run build` deben quedar limpios después de cada tarea.

## Review Focus

- Cliente con `perfil_entreno_cliente` inexistente o `sport_modality` distinto de `'hibrido'` generando un plan — debe seguir el camino de protocolo único de siempre, sin tocar `fase_bloque` ni reventar.
- Plan activo cuyas sesiones nunca tuvieron `fase_bloque` (planes antiguos, de antes de este cambio, de cualquier cliente) — las vistas de cliente deben ocultar el pill de bloque en vez de mostrar `null`/`undefined` en pantalla.
- Sesión sin ningún ejercicio vinculado (todos los `matchEjercicio` fallaron) — la clasificación híbrido/carrera no debe dividir por cero ni lanzar excepción.
- `/api/entrenos/mes-completo` pedido para un cliente sin ningún plan activo — debe devolver una estructura vacía coherente (200 con `dias: []`), no 500.
- Reloj del servidor o `created_at` del plan en una fecha futura respecto a "hoy" (desincronización o dato corrupto) — el cálculo de semana-en-bloque no debe devolver números negativos ni `NaN`.

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `lib/entrenos/bloques.ts` | Crear | Lógica pura: rotación de fases, cálculo de semana-en-bloque, clasificación híbrido/carrera de una sesión. |
| `scripts/bloques-entreno.test.ts` | Crear | Tests de la lógica pura anterior (`node:assert/strict`, patrón existente en `scripts/*.test.ts`). |
| `app/api/entrenos/proponer-plan-ciencia/route.ts` | Modificar | Protocolo combinado Hyrox+Running, `fase_bloque_objetivo`, persistencia de `fase_bloque`/`peso_sugerido`/ritmo. |
| `app/api/entrenos/sesiones-plan/route.ts` | Modificar | Incluir `fase_bloque`, `tipo_sesion` por sesión y estado de bloque del plan. |
| `app/api/entrenos/semana-completa/route.ts` | Modificar | Igual que arriba, para la vista semanal completa. |
| `app/api/entrenos/mes-completo/route.ts` | Crear | Igual patrón que `semana-completa` pero para un mes completo. |
| `components/training/SemanaEntrenoCard.tsx` | Modificar | Pill de bloque/semana en el header. |
| `app/cliente/semana/page.tsx` | Modificar | Pill de bloque/semana + icono por tipo de sesión + enlace a `/cliente/mes`. |
| `app/cliente/mes/page.tsx` | Crear | Vista mensual en calendario. |
| `components/clientes/GenerarBloqueHibridoPanel.tsx` | Crear | Panel coach: generar primer bloque / siguiente bloque. |
| `app/clientes/[id]/page.tsx` | Modificar | Insertar `GenerarBloqueHibridoPanel` en la pestaña "entrenamiento". |

---

### Task 1: Módulo puro de bloques y clasificación de sesión

**Files:**
- Create: `lib/entrenos/bloques.ts`
- Test: `scripts/bloques-entreno.test.ts`

**Interfaces:**
- Produces: `FaseBloque` (tipo), `siguienteFaseBloque(faseActual: FaseBloque | null | undefined): FaseBloque`, `EstadoBloque` (interfaz), `calcularEstadoBloque(fechaInicioISO: string, duracionSemanas: number, fechaRef?: Date): EstadoBloque`, `TipoSesion` (tipo), `clasificarTipoSesion(tiposEjercicios: string[]): TipoSesion`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
// scripts/bloques-entreno.test.ts
import assert from 'node:assert/strict'
import {
  siguienteFaseBloque,
  calcularEstadoBloque,
  clasificarTipoSesion,
} from '../lib/entrenos/bloques'

// --- siguienteFaseBloque: rotación fija Base -> Fuerza -> Resistencia -> Deload -> Base ---
assert.equal(siguienteFaseBloque(null), 'Base')
assert.equal(siguienteFaseBloque(undefined), 'Base')
assert.equal(siguienteFaseBloque('Base'), 'Fuerza')
assert.equal(siguienteFaseBloque('Fuerza'), 'Resistencia')
assert.equal(siguienteFaseBloque('Resistencia'), 'Deload')
assert.equal(siguienteFaseBloque('Deload'), 'Base')

// --- calcularEstadoBloque: semana 1 el día de inicio ---
const inicio = '2026-09-01'
const bloqueDia0 = calcularEstadoBloque(inicio, 4, new Date('2026-09-01T12:00:00Z'))
assert.equal(bloqueDia0.semanaActual, 1)
assert.equal(bloqueDia0.semanasTotales, 4)
assert.equal(bloqueDia0.terminado, false)

// --- semana 2 tras 7 días ---
const bloqueSemana2 = calcularEstadoBloque(inicio, 4, new Date('2026-09-08T12:00:00Z'))
assert.equal(bloqueSemana2.semanaActual, 2)

// --- terminado tras las 4 semanas completas ---
const bloqueTerminado = calcularEstadoBloque(inicio, 4, new Date('2026-09-29T12:00:00Z'))
assert.equal(bloqueTerminado.terminado, true)
assert.equal(bloqueTerminado.diasRestantes, 0)
// nunca debe pasarse de semanasTotales aunque hayan pasado muchas más semanas
assert.equal(bloqueTerminado.semanaActual, 4)

// --- reloj/fecha de inicio en el futuro respecto a fechaRef: no debe dar negativos ni NaN ---
const bloqueFuturo = calcularEstadoBloque('2099-01-01', 4, new Date('2026-09-01T12:00:00Z'))
assert.equal(bloqueFuturo.semanaActual, 1)
assert.equal(Number.isNaN(bloqueFuturo.diasRestantes), false)
assert.ok(bloqueFuturo.diasRestantes >= 0)

// --- clasificarTipoSesion ---
assert.equal(clasificarTipoSesion(['fuerza', 'fuerza', 'funcional']), 'hibrido')
assert.equal(clasificarTipoSesion(['cardio', 'cardio', 'cardio']), 'carrera')
assert.equal(clasificarTipoSesion(['fuerza', 'cardio']), 'mixto')
// sesión sin ejercicios vinculados: no debe dividir por cero ni lanzar
assert.equal(clasificarTipoSesion([]), 'mixto')

console.log('OK — bloques-entreno')
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npx tsx scripts/bloques-entreno.test.ts`
Expected: FAIL — `Cannot find module '../lib/entrenos/bloques'`

- [ ] **Step 3: Implementar `lib/entrenos/bloques.ts`**

```typescript
// lib/entrenos/bloques.ts

export type FaseBloque = 'Base' | 'Fuerza' | 'Resistencia' | 'Deload'

const ROTACION_BLOQUES: FaseBloque[] = ['Base', 'Fuerza', 'Resistencia', 'Deload']

/** Rotación fija de foco de bloque. Sin fase previa, siempre empieza en Base. */
export function siguienteFaseBloque(faseActual: FaseBloque | null | undefined): FaseBloque {
  if (!faseActual) return 'Base'
  const idx = ROTACION_BLOQUES.indexOf(faseActual)
  if (idx === -1) return 'Base'
  return ROTACION_BLOQUES[(idx + 1) % ROTACION_BLOQUES.length]
}

export interface EstadoBloque {
  semanaActual: number
  semanasTotales: number
  diasRestantes: number
  terminado: boolean
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * Calcula en qué semana de un bloque de N semanas cae `fechaRef`, contando
 * desde `fechaInicioISO`. Clampa siempre semanaActual a [1, duracionSemanas]
 * y diasRestantes a >= 0, incluso si fechaInicioISO cae en el futuro
 * respecto a fechaRef (reloj desincronizado o dato corrupto).
 */
export function calcularEstadoBloque(
  fechaInicioISO: string,
  duracionSemanas: number,
  fechaRef: Date = new Date()
): EstadoBloque {
  const inicio = new Date(fechaInicioISO)
  const diasTranscurridos = Math.max(
    0,
    Math.floor((fechaRef.getTime() - inicio.getTime()) / MS_POR_DIA)
  )
  const totalDias = duracionSemanas * 7
  const diasRestantes = Math.max(0, totalDias - diasTranscurridos)
  const semanaActual = Math.min(duracionSemanas, Math.max(1, Math.floor(diasTranscurridos / 7) + 1))

  return {
    semanaActual,
    semanasTotales: duracionSemanas,
    diasRestantes,
    terminado: diasTranscurridos >= totalDias,
  }
}

export type TipoSesion = 'hibrido' | 'carrera' | 'mixto'

/**
 * Clasifica una sesión como híbrida o de carrera según qué proporción de
 * sus ejercicios vinculados son de tipo 'cardio' (ejercicios.tipo).
 * Sin ejercicios vinculados (match fallido para todos), devuelve 'mixto'
 * en vez de dividir por cero.
 */
export function clasificarTipoSesion(tiposEjercicios: string[]): TipoSesion {
  if (tiposEjercicios.length === 0) return 'mixto'
  const cardio = tiposEjercicios.filter(t => t === 'cardio').length
  const ratio = cardio / tiposEjercicios.length
  if (ratio >= 0.6) return 'carrera'
  if (ratio <= 0.2) return 'hibrido'
  return 'mixto'
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npx tsx scripts/bloques-entreno.test.ts`
Expected: `OK — bloques-entreno` impreso, exit code 0

- [ ] **Step 5: Commit**

```bash
git add lib/entrenos/bloques.ts scripts/bloques-entreno.test.ts
git commit -m "feat: lógica pura de bloques de 4 semanas y clasificación híbrido/carrera"
```

---

### Task 2: Protocolo combinado Hyrox+Running en `proponer-plan-ciencia`

**Files:**
- Modify: `app/api/entrenos/proponer-plan-ciencia/route.ts`

**Interfaces:**
- Consumes: `siguienteFaseBloque`, `FaseBloque` de `lib/entrenos/bloques.ts` (Task 1).
- Produces: el endpoint `POST /api/entrenos/proponer-plan-ciencia` acepta ahora opcionalmente `fase_bloque_objetivo?: FaseBloque` en el body; cuando `modalidadFoco === 'hibrido'`, genera un plan de 4 semanas con protocolo combinado, persiste `fase_bloque` en cada `sesiones_entrenamiento` y `peso_sugerido` en cada `sesion_ejercicios`. Los demás clientes (modalidad distinta de `'hibrido'`) generan exactamente igual que antes.

- [ ] **Step 1: Añadir el import y la función que construye el protocolo combinado**

En `app/api/entrenos/proponer-plan-ciencia/route.ts`, junto a los demás imports:

```typescript
import { siguienteFaseBloque, type FaseBloque } from '@/lib/entrenos/bloques'
```

Justo debajo de la constante `SPORT_PROTOCOLS` (después de su cierre `}`), añadir:

```typescript
const MODULACION_POR_FASE: Record<FaseBloque, string> = {
  Base: 'Volumen moderado, técnica ante todo. Carrera dominada por aeróbico Z2. Cargas de híbrido moderadas, sin buscar RM.',
  Fuerza: 'Más carga y menos repeticiones en el bloque de hipertrofia accesoria y en las estaciones Hyrox con peso. Carrera se mantiene en mantenimiento: Z2 + 1 sesión de series corta, sin volumen extra.',
  Resistencia: 'Más volumen y densidad en las estaciones (simulacros tipo "1km + estación"). El tempo run gana peso frente a las series puras.',
  Deload: 'Reduce el volumen total un 30-40% manteniendo la frecuencia. Baja la intensidad. Nada de PRs ni series intensas esta semana.',
}

/**
 * Protocolo combinado para el cliente con sport_modality === 'hibrido':
 * 3 sesiones híbridas (Hyrox + hipertrofia accesoria rotando espalda/
 * pecho/bíceps/hombro) y 2 sesiones de carrera (tirada larga fija en fin
 * de semana + series/tempo alternando entre semana), modulado por la fase
 * de bloque de 4 semanas en la que está el cliente.
 */
function construirProtocoloHibridoHyroxRunning(fase: FaseBloque): string {
  return `HÍBRIDO HYROX + RUNNING — Bloque actual: ${fase}
${MODULACION_POR_FASE[fase]}

REPARTO SEMANAL OBLIGATORIO (5 sesiones):
• 3 sesiones HÍBRIDAS: cada una incluye 1-2 estaciones reales de Hyrox (SkiErg, Sled Push, Sled Pull, Burpee Broad Jumps, Farmers Carry, Wall Balls, Row) MÁS un bloque de fuerza/hipertrofia accesoria. La hipertrofia accesoria debe ROTAR entre las 3 sesiones para cubrir espalda, pecho, bíceps y hombro a lo largo de la semana — no repitas el mismo grupo muscular en las 3 sesiones híbridas.
• 1 sesión de CARRERA — tirada larga, en fin de semana (Sábado o Domingo): rodaje continuo a ritmo aeróbico Z2, duración progresiva.
• 1 sesión de CARRERA — entre semana, alternando series (intervalos) o tempo run según la fase de bloque indicada arriba.

FUENTES: Laursen & Buchheit (Hyrox/HIIT), Daniels (VDOT running), Schoenfeld 2010/2017 (hipertrofia accesoria).`
}
```

- [ ] **Step 2: Resolver `fase_bloque_objetivo` y activar el modo combinado**

Dentro de `POST`, justo después de `const { cliente_id } = await req.json()` (línea ~52 actual), cambiar para leer también el nuevo campo del body:

```typescript
const { cliente_id, fase_bloque_objetivo } = await req.json() as {
  cliente_id?: string
  fase_bloque_objetivo?: FaseBloque
}
if (!cliente_id) return NextResponse.json({ error: 'Falta cliente_id' }, { status: 400 })
```

Después del bloque que calcula `modalidadFoco` (justo después de `modalidadFoco = perfilEntreno.sport_modality ?? 'funcional'`), añadir:

```typescript
const esHibridoHyroxRunning = modalidadFoco === 'hibrido'

// Si no se especifica fase de bloque, calcularla a partir del plan más
// reciente del cliente (activo o no) — así "generar siguiente bloque"
// funciona sin que el frontend tenga que saber la rotación.
let faseBloqueObjetivo: FaseBloque = 'Base'
if (esHibridoHyroxRunning) {
  if (fase_bloque_objetivo) {
    faseBloqueObjetivo = fase_bloque_objetivo
  } else {
    const { data: planAnterior } = await sb
      .from('planes_entrenamiento')
      .select('id')
      .eq('cliente_id', cliente_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let faseAnterior: FaseBloque | null = null
    if (planAnterior) {
      const { data: sesionPrevia } = await sb
        .from('sesiones_entrenamiento')
        .select('fase_bloque')
        .eq('plan_id', planAnterior.id)
        .not('fase_bloque', 'is', null)
        .limit(1)
        .maybeSingle()
      faseAnterior = (sesionPrevia?.fase_bloque as FaseBloque | undefined) ?? null
    }
    faseBloqueObjetivo = siguienteFaseBloque(faseAnterior)
  }
}
```

- [ ] **Step 3: Usar el protocolo combinado en el prompt**

Sustituir la línea:

```typescript
const protocoloDeporte = SPORT_PROTOCOLS[modalidadFoco] ?? SPORT_PROTOCOLS.funcional
```

por:

```typescript
const protocoloDeporte = esHibridoHyroxRunning
  ? construirProtocoloHibridoHyroxRunning(faseBloqueObjetivo)
  : (SPORT_PROTOCOLS[modalidadFoco] ?? SPORT_PROTOCOLS.funcional)
```

- [ ] **Step 4: Forzar 4 semanas y pedir pesos/ritmos concretos en el prompt**

En `promptUsuario`, la sección `## INSTRUCCIONES DE GENERACIÓN` tiene hoy la línea:

```
1. Plan de ${Math.min(diasSemana, 5)} sesiones/semana, 8-12 semanas de duración
```

Sustituirla por una versión condicional. Antes de construir `promptUsuario`, añadir:

```typescript
const instruccionDuracion = esHibridoHyroxRunning
  ? `1. Plan de EXACTAMENTE 5 sesiones/semana (3 híbridas + 2 carrera), EXACTAMENTE 4 semanas de duración (este bloque completo, sin semana de descarga adicional — el Deload es un bloque entero cuando corresponda en la rotación)`
  : `1. Plan de ${Math.min(diasSemana, 5)} sesiones/semana, 8-12 semanas de duración`

const instruccionCargasConcretas = esHibridoHyroxRunning
  ? `\n6. Sin datos de RM/VDOT reales del cliente: ESTIMA pesos de partida conservadores para un atleta de nivel ${nivel} de ~65kg (ej. sentadilla goblet, press banca, remo, dominadas asistidas si hace falta) y ritmos de partida conservadores en min/km para Z2/umbral/series según nivel ${nivel}. Estos valores son un punto de partida — el sistema los ajustará solo según el RPE que registre el cliente en el próximo bloque. NUNCA dejes "peso_estimado_kg" o "ritmo_objetivo" vacíos en ejercicios de fuerza o sesiones de carrera respectivamente.`
  : ''
```

Y en el template de `promptUsuario`, sustituir la línea `1. Plan de ${Math.min(diasSemana, 5)} sesiones/semana, 8-12 semanas de duración` por `${instruccionDuracion}` y añadir `${instruccionCargasConcretas}` justo después del punto 5 de esa misma lista (después de `4. Cada ejercicio: series, reps exactas, descanso calculado, RPE objetivo, nota con el POR QUÉ` y `5. Incluir progresión: cómo escalar cada 2 semanas`).

- [ ] **Step 5: Añadir campos nuevos al formato JSON pedido a la IA**

En el bloque `## FORMATO JSON EXACTO` de `promptUsuario`, dentro de cada sesión (objeto dentro del array `"sesiones"`), añadir después de `"tipo": "fuerza|cardio|hiit|tecnica|recuperacion|mixto",`:

```
      "tipo_sesion": "hibrido|carrera",
      "ritmo_objetivo": "string — solo si tipo_sesion es 'carrera': ritmo objetivo en min/km, ej. '5:30/km Z2' (omitir o vacío si es híbrida)",
```

Y dentro de cada ejercicio (objeto dentro del array `"ejercicios"`), añadir después de `"rpe_objetivo": "string — '7-8' o '8 RIR 2'",`:

```
          "peso_estimado_kg": "number — peso de partida estimado en kg. Solo para ejercicios de fuerza; omitir en ejercicios de carrera/cardio",
```

- [ ] **Step 6: Persistir `fase_bloque`, `peso_sugerido` y el ritmo objetivo al guardar**

En el bloque `// Guardar automáticamente en planes_entrenamiento + sesiones_entrenamiento`, sustituir:

```typescript
const { data: planDB } = await sb.from('planes_entrenamiento').insert({
  coach_id: user.id,
  cliente_id,
  nombre: (planIA.nombre_plan as string) ?? `Plan IA — ${modalidadFoco}`,
  descripcion: (planIA.fundamentacion as string) ?? null,
  duracion_semanas: (planIA.duracion_semanas as number) ?? null,
  activo: true,
}).select('id').single()
```

por:

```typescript
const { data: planDB } = await sb.from('planes_entrenamiento').insert({
  coach_id: user.id,
  cliente_id,
  nombre: esHibridoHyroxRunning
    ? `Híbrido Hyrox + Running — ${faseBloqueObjetivo}`
    : ((planIA.nombre_plan as string) ?? `Plan IA — ${modalidadFoco}`),
  descripcion: (planIA.fundamentacion as string) ?? null,
  duracion_semanas: esHibridoHyroxRunning ? 4 : ((planIA.duracion_semanas as number) ?? null),
  activo: true,
}).select('id').single()
```

Y sustituir el insert de `nuevaSesion`:

```typescript
const { data: nuevaSesion } = await sb.from('sesiones_entrenamiento').insert({
  plan_id: planDB.id,
  nombre: (s.nombre as string) ?? `Sesión ${i + 1}`,
  dia_semana: (s.dia_semana as string) ?? null,
  orden: i + 1,
  notas: null,
}).select('id').single()
```

por:

```typescript
const { data: nuevaSesion } = await sb.from('sesiones_entrenamiento').insert({
  plan_id: planDB.id,
  nombre: (s.nombre as string) ?? `Sesión ${i + 1}`,
  dia_semana: (s.dia_semana as string) ?? null,
  orden: i + 1,
  notas: null,
  fase_bloque: esHibridoHyroxRunning ? faseBloqueObjetivo : null,
  contexto_ia: esHibridoHyroxRunning && s.ritmo_objetivo ? String(s.ritmo_objetivo) : null,
}).select('id').single()
```

Y sustituir el insert de `sesion_ejercicios`:

```typescript
await sb.from('sesion_ejercicios').insert({
  sesion_id: nuevaSesion.id,
  ejercicio_id: ejercicioId,
  series: typeof ej.series === 'number' ? ej.series : null,
  repeticiones: ej.repeticiones != null ? String(ej.repeticiones) : null,
  descanso_segundos: typeof ej.descanso_segundos === 'number' ? ej.descanso_segundos : null,
  notas: [ej.rpe_objetivo ? `RPE ${ej.rpe_objetivo}` : null, ej.notas].filter(Boolean).join(' — ') || null,
  orden: j + 1,
})
```

por:

```typescript
await sb.from('sesion_ejercicios').insert({
  sesion_id: nuevaSesion.id,
  ejercicio_id: ejercicioId,
  series: typeof ej.series === 'number' ? ej.series : null,
  repeticiones: ej.repeticiones != null ? String(ej.repeticiones) : null,
  descanso_segundos: typeof ej.descanso_segundos === 'number' ? ej.descanso_segundos : null,
  notas: [ej.rpe_objetivo ? `RPE ${ej.rpe_objetivo}` : null, ej.notas].filter(Boolean).join(' — ') || null,
  orden: j + 1,
  peso_sugerido: typeof ej.peso_estimado_kg === 'number' ? `${ej.peso_estimado_kg}kg` : null,
})
```

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores

- [ ] **Step 8: Verificación manual contra Supabase real**

Esto no es testeable con `node:assert` porque llama a DeepSeek y escribe en Supabase. Verificar manualmente:

```bash
# Con el dev server corriendo y una cookie de sesión de coach válida:
curl -s -X POST http://localhost:3000/api/entrenos/proponer-plan-ciencia \
  -H "Content-Type: application/json" \
  -b "<cookie de sesión coach>" \
  -d '{"cliente_id":"04cc53b3-851e-43f9-b271-daf1577b743e"}' | jq .
```

Confirmar en la respuesta y en Supabase (`planes_entrenamiento` + `sesiones_entrenamiento` + `sesion_ejercicios` del `plan_id` devuelto):
- `duracion_semanas = 4`
- 5 sesiones: 3 con ejercicios de tipo fuerza/funcional predominante, 2 con ejercicios de tipo cardio predominante
- Las 5 sesiones tienen `fase_bloque = 'Base'` (primer bloque siempre empieza en Base)
- Al menos un ejercicio de fuerza con `peso_sugerido` no nulo
- Las 2 sesiones de carrera tienen `contexto_ia` con un ritmo en min/km
- Entre las 3 sesiones híbridas, los grupos musculares accesorios (espalda/pecho/bíceps/hombro) están repartidos y no repetidos los 3 días

- [ ] **Step 9: Commit**

```bash
git add app/api/entrenos/proponer-plan-ciencia/route.ts
git commit -m "feat: protocolo combinado Hyrox+Running con bloques de 4 semanas y cargas concretas"
```

---

### Task 3: Exponer bloque y tipo de sesión en las APIs de lectura

**Files:**
- Modify: `app/api/entrenos/sesiones-plan/route.ts`
- Modify: `app/api/entrenos/semana-completa/route.ts`

**Interfaces:**
- Consumes: `calcularEstadoBloque`, `clasificarTipoSesion` de `lib/entrenos/bloques.ts` (Task 1).
- Produces: ambos endpoints devuelven ahora, además de lo que ya devolvían, `bloque: { fase: string; semana_actual: number; semanas_totales: number } | null` a nivel de respuesta, y cada sesión del array `sesiones` incluye `tipo_sesion: 'hibrido' | 'carrera' | 'mixto'`.

- [ ] **Step 1: `sesiones-plan` — seleccionar columnas nuevas**

En `app/api/entrenos/sesiones-plan/route.ts`, añadir el import al principio del archivo:

```typescript
import { calcularEstadoBloque, clasificarTipoSesion } from '@/lib/entrenos/bloques'
```

Sustituir el select de `planData`:

```typescript
const { data: planData, error: planError } = await admin
  .from('planes_entrenamiento')
  .select('id, cliente_id')
  .eq('id', planId)
  .maybeSingle()
```

por:

```typescript
const { data: planData, error: planError } = await admin
  .from('planes_entrenamiento')
  .select('id, cliente_id, created_at, duracion_semanas')
  .eq('id', planId)
  .maybeSingle()
```

Sustituir el select de `sesData`:

```typescript
const { data: sesData, error: sesError } = await admin
  .from('sesiones_entrenamiento')
  .select('id, nombre, dia_semana, orden, duracion_estimada_min, contexto_ia')
  .eq('plan_id', planId)
  .order('orden')
```

por:

```typescript
const { data: sesData, error: sesError } = await admin
  .from('sesiones_entrenamiento')
  .select('id, nombre, dia_semana, orden, duracion_estimada_min, contexto_ia, fase_bloque')
  .eq('plan_id', planId)
  .order('orden')
```

Sustituir el select de `ejData` (que hoy trae solo `id, sesion_id`):

```typescript
let ejData: { id: string; sesion_id: string }[] = []
if (sesIds.length > 0) {
  const { data, error } = await admin
    .from('sesion_ejercicios')
    .select('id, sesion_id')
    .in('sesion_id', sesIds)
  if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  ejData = data ?? []
}
```

por:

```typescript
let ejData: { id: string; sesion_id: string; ejercicio: { tipo: string | null } | null }[] = []
if (sesIds.length > 0) {
  const { data, error } = await admin
    .from('sesion_ejercicios')
    .select('id, sesion_id, ejercicio:ejercicios(tipo)')
    .in('sesion_id', sesIds)
  if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  ejData = (data ?? []) as unknown as { id: string; sesion_id: string; ejercicio: { tipo: string | null } | null }[]
}
```

- [ ] **Step 2: `sesiones-plan` — calcular bloque y tipo por sesión, añadirlos a la respuesta**

Justo antes de `const sesiones = sesionesRaw.map(...)`, añadir:

```typescript
const tiposPorSesion: Record<string, string[]> = {}
for (const ej of ejData) {
  const tipo = ej.ejercicio?.tipo
  if (!tipo) continue
  if (!tiposPorSesion[ej.sesion_id]) tiposPorSesion[ej.sesion_id] = []
  tiposPorSesion[ej.sesion_id].push(tipo)
}

const faseBloqueDelPlan = sesionesRaw.find(s => s.fase_bloque)?.fase_bloque as string | undefined
const bloque = faseBloqueDelPlan && planData.duracion_semanas
  ? {
      fase: faseBloqueDelPlan,
      ...(() => {
        const estado = calcularEstadoBloque(planData.created_at, planData.duracion_semanas as number)
        return { semana_actual: estado.semanaActual, semanas_totales: estado.semanasTotales }
      })(),
    }
  : null
```

Sustituir el `return` final:

```typescript
return NextResponse.json({ sesiones, completadas_hoy: completadasHoy, registradas_semana: registradasSemana })
```

por:

```typescript
return NextResponse.json({ sesiones, completadas_hoy: completadasHoy, registradas_semana: registradasSemana, bloque })
```

Y en el `.map` que construye `sesiones`, añadir `tipo_sesion: clasificarTipoSesion(tiposPorSesion[s.id] ?? [])` a cada objeto de sesión devuelto.

- [ ] **Step 3: Mismo patrón en `semana-completa`**

En `app/api/entrenos/semana-completa/route.ts`, añadir el import:

```typescript
import { calcularEstadoBloque, clasificarTipoSesion } from '@/lib/entrenos/bloques'
```

Sustituir el select de `planEntreno`:

```typescript
const { data: planEntreno } = await admin
  .from('planes_entrenamiento')
  .select('id, nombre')
  .eq('cliente_id', clienteData.id)
  .eq('activo', true)
  .order('created_at', { ascending: false })
  .limit(1)
  .single()
```

por:

```typescript
const { data: planEntreno } = await admin
  .from('planes_entrenamiento')
  .select('id, nombre, created_at, duracion_semanas')
  .eq('cliente_id', clienteData.id)
  .eq('activo', true)
  .order('created_at', { ascending: false })
  .limit(1)
  .single()
```

Sustituir el select de `sesData`:

```typescript
const { data: sesData } = await admin
  .from('sesiones_entrenamiento')
  .select('id, nombre, dia_semana, duracion_estimada_min, contexto_ia')
  .eq('plan_id', planEntreno.id)
  .order('orden')
```

por:

```typescript
const { data: sesData } = await admin
  .from('sesiones_entrenamiento')
  .select('id, nombre, dia_semana, duracion_estimada_min, contexto_ia, fase_bloque')
  .eq('plan_id', planEntreno.id)
  .order('orden')
```

Sustituir el select de `ejData` (hoy `id, sesion_id`) por el mismo patrón con join a `ejercicios(tipo)` del Step 1, y calcular `tiposPorSesion` igual que en `sesiones-plan`.

Justo antes del `return NextResponse.json({ sesiones, plan_nombre: planEntreno.nombre })` final, añadir:

```typescript
const faseBloqueDelPlan = sesData.find(s => s.fase_bloque)?.fase_bloque as string | undefined
const bloque = faseBloqueDelPlan && planEntreno.duracion_semanas
  ? {
      fase: faseBloqueDelPlan,
      ...(() => {
        const estado = calcularEstadoBloque(planEntreno.created_at, planEntreno.duracion_semanas as number)
        return { semana_actual: estado.semanaActual, semanas_totales: estado.semanasTotales }
      })(),
    }
  : null
```

Y cambiar el `return` a:

```typescript
return NextResponse.json({ sesiones, plan_nombre: planEntreno.nombre, bloque })
```

En el `.map` que construye `sesiones` (el que ya añade `fecha`, `registros_count`, etc.), añadir `tipo_sesion: clasificarTipoSesion(tiposPorSesion[s.id] ?? [])`.

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores

- [ ] **Step 5: Verificación manual**

```bash
curl -s "http://localhost:3000/api/entrenos/sesiones-plan?plan_id=<plan_id_de_carlos>" -b "<cookie cliente>" | jq '.bloque, .sesiones[].tipo_sesion'
curl -s "http://localhost:3000/api/entrenos/semana-completa" -b "<cookie cliente>" | jq '.bloque, .sesiones[].tipo_sesion'
```

Confirmar `bloque.fase === 'Base'`, `bloque.semana_actual === 1`, `bloque.semanas_totales === 4`, y 3 sesiones `'hibrido'` + 2 `'carrera'`.

También probar con un cliente que NO tenga plan híbrido (cualquiera de los otros clientes reales con plan activo) y confirmar que `bloque` es `null` y no rompe nada.

- [ ] **Step 6: Commit**

```bash
git add app/api/entrenos/sesiones-plan/route.ts app/api/entrenos/semana-completa/route.ts
git commit -m "feat: exponer fase de bloque y tipo de sesión en las APIs de lectura del portal cliente"
```

---

### Task 4: Nueva API `mes-completo`

**Files:**
- Create: `app/api/entrenos/mes-completo/route.ts`

**Interfaces:**
- Consumes: `calcularEstadoBloque`, `clasificarTipoSesion` de `lib/entrenos/bloques.ts` (Task 1). Mismo patrón de auth y de acceso a datos que `semana-completa` (mismo archivo sirve de referencia directa).
- Produces: `GET /api/entrenos/mes-completo?year=YYYY&month=MM` (mes 1-12) devuelve `{ plan_nombre: string, dias: Array<{ fecha: string; dia_semana: string; sesion: { id: string; nombre: string; tipo_sesion: string; ejercicios_count: number; completada: boolean } | null; fase_bloque: string | null; bloque_pendiente: boolean }> }`.

- [ ] **Step 1: Crear el archivo con auth + carga de plan y sesiones (idéntico patrón a `semana-completa`)**

```typescript
// app/api/entrenos/mes-completo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { calcularEstadoBloque, clasificarTipoSesion } from '@/lib/entrenos/bloques'

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const DIAS_SEMANA_POR_INDICE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? '', 10)
  const month = parseInt(searchParams.get('month') ?? '', 10) // 1-12
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year y month (1-12) son obligatorios' }, { status: 400 })
  }

  const admin = createServiceSupabase()

  const { data: clienteData } = await admin
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!clienteData) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: planEntreno } = await admin
    .from('planes_entrenamiento')
    .select('id, nombre, created_at, duracion_semanas')
    .eq('cliente_id', clienteData.id)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const diasEnMes = new Date(year, month, 0).getDate()
  const diasDelMes = Array.from({ length: diasEnMes }, (_, i) => new Date(year, month - 1, i + 1))

  if (!planEntreno) {
    return NextResponse.json({
      plan_nombre: '',
      dias: diasDelMes.map(d => ({
        fecha: toISODate(d),
        dia_semana: DIAS_SEMANA_POR_INDICE[d.getDay()],
        sesion: null,
        fase_bloque: null,
        bloque_pendiente: false,
      })),
    })
  }

  const { data: sesData } = await admin
    .from('sesiones_entrenamiento')
    .select('id, nombre, dia_semana, fase_bloque')
    .eq('plan_id', planEntreno.id)
    .order('orden')

  const sesiones = sesData ?? []
  const sesIds = sesiones.map(s => s.id)

  let ejData: { id: string; sesion_id: string; ejercicio: { tipo: string | null } | null }[] = []
  if (sesIds.length > 0) {
    const { data } = await admin
      .from('sesion_ejercicios')
      .select('id, sesion_id, ejercicio:ejercicios(tipo)')
      .in('sesion_id', sesIds)
    ejData = (data ?? []) as unknown as typeof ejData
  }

  const ejCountBySesion: Record<string, number> = {}
  const tiposPorSesion: Record<string, string[]> = {}
  for (const ej of ejData) {
    ejCountBySesion[ej.sesion_id] = (ejCountBySesion[ej.sesion_id] ?? 0) + 1
    const tipo = ej.ejercicio?.tipo
    if (tipo) {
      if (!tiposPorSesion[ej.sesion_id]) tiposPorSesion[ej.sesion_id] = []
      tiposPorSesion[ej.sesion_id].push(tipo)
    }
  }

  const sesionPorDia = new Map(sesiones.map(s => [s.dia_semana, s]))

  const allEjIds = ejData.map(e => e.id)
  const primerDiaMes = toISODate(diasDelMes[0])
  const ultimoDiaMes = toISODate(diasDelMes[diasDelMes.length - 1])

  const { data: registros } = allEjIds.length > 0
    ? await admin
        .from('registros_sets')
        .select('sesion_ejercicio_id, fecha')
        .eq('cliente_id', clienteData.id)
        .gte('fecha', primerDiaMes)
        .lte('fecha', ultimoDiaMes)
        .in('sesion_ejercicio_id', allEjIds)
    : { data: [] }

  const ejToSesion = new Map(ejData.map(e => [e.id, e.sesion_id]))
  const sesionesCompletadasPorFecha = new Map<string, Set<string>>()
  for (const r of registros ?? []) {
    const sesId = ejToSesion.get(r.sesion_ejercicio_id)
    if (!sesId) continue
    if (!sesionesCompletadasPorFecha.has(r.fecha)) sesionesCompletadasPorFecha.set(r.fecha, new Set())
    sesionesCompletadasPorFecha.get(r.fecha)!.add(sesId)
  }

  const fechaInicioPlan = planEntreno.created_at
  const duracionSemanas = planEntreno.duracion_semanas as number | null

  const dias = diasDelMes.map(d => {
    const fecha = toISODate(d)
    const diaSemana = DIAS_SEMANA_POR_INDICE[d.getDay()]
    const sesion = sesionPorDia.get(diaSemana)

    // Antes del inicio del plan actual: no tenemos datos de qué se hizo ese día.
    const antesDeInicio = fecha < toISODate(new Date(fechaInicioPlan))
    // Después de que termine el bloque activo y aún no se generó el siguiente.
    const bloquePendiente = duracionSemanas
      ? d.getTime() > new Date(fechaInicioPlan).getTime() + duracionSemanas * 7 * 24 * 60 * 60 * 1000
      : false

    if (antesDeInicio || bloquePendiente || !sesion) {
      return {
        fecha,
        dia_semana: diaSemana,
        sesion: null,
        fase_bloque: null,
        bloque_pendiente: bloquePendiente,
      }
    }

    return {
      fecha,
      dia_semana: diaSemana,
      sesion: {
        id: sesion.id,
        nombre: sesion.nombre,
        tipo_sesion: clasificarTipoSesion(tiposPorSesion[sesion.id] ?? []),
        ejercicios_count: ejCountBySesion[sesion.id] ?? 0,
        completada: sesionesCompletadasPorFecha.get(fecha)?.has(sesion.id) ?? false,
      },
      fase_bloque: sesion.fase_bloque,
      bloque_pendiente: false,
    }
  })

  return NextResponse.json({ plan_nombre: planEntreno.nombre, dias })
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores

- [ ] **Step 3: Verificación manual**

```bash
curl -s "http://localhost:3000/api/entrenos/mes-completo?year=2026&month=9" -b "<cookie cliente>" | jq '.dias | length, .dias[0], .dias[-1]'
# Casos a confirmar a mano:
# 1. Cliente sin plan activo -> 200 con dias:[] de sesion:null (no 500)
# 2. Mes con el bloque activo completo dentro -> todas las semanas fase_bloque='Base'
# 3. Días anteriores a la fecha de creación del plan -> sesion:null, bloque_pendiente:false
```

- [ ] **Step 4: Commit**

```bash
git add app/api/entrenos/mes-completo/route.ts
git commit -m "feat: API mensual de entrenamiento para el portal cliente"
```

---

### Task 5: Pill de bloque + iconos por tipo en las vistas existentes

**Files:**
- Modify: `components/training/SemanaEntrenoCard.tsx`
- Modify: `app/cliente/semana/page.tsx`

**Interfaces:**
- Consumes: `data.bloque` y `sesion.tipo_sesion` devueltos por `sesiones-plan`/`semana-completa` (Task 3).

- [ ] **Step 1: `SemanaEntrenoCard` — leer `bloque` de la respuesta**

En `components/training/SemanaEntrenoCard.tsx`, añadir un nuevo estado junto a `registradasSemana`:

```typescript
const [bloque, setBloque] = useState<{ fase: string; semana_actual: number; semanas_totales: number } | null>(null)
```

En el `.then` que procesa `data`, añadir:

```typescript
if (data.bloque) setBloque(data.bloque)
```

- [ ] **Step 2: Mostrar el pill en el subtítulo del header**

Sustituir:

```tsx
<p className="text-[11px]" style={{ color: '#9898A0' }}>
  {planNombre} · {sesionesOrdenadas.length} día{sesionesOrdenadas.length !== 1 ? 's' : ''} / semana
</p>
```

por:

```tsx
<p className="text-[11px]" style={{ color: '#9898A0' }}>
  {planNombre} · {sesionesOrdenadas.length} día{sesionesOrdenadas.length !== 1 ? 's' : ''} / semana
  {bloque && ` · Bloque ${bloque.fase} · Semana ${bloque.semana_actual}/${bloque.semanas_totales}`}
</p>
```

- [ ] **Step 3: `/cliente/semana` — leer y mostrar `bloque` + icono por `tipo_sesion`**

En `app/cliente/semana/page.tsx`, la interfaz `SesionSemana` (línea ~37) añade el campo:

```typescript
interface SesionSemana {
  id: string
  nombre: string
  dia_semana: string
  ejercicios_count: number
  duracion_estimada_min: number | null
  contexto_ia?: string | null
  fecha: string
  fechaLabel: string
  registros_count: number
  completada: boolean
  esHoy: boolean
  tipo_sesion?: 'hibrido' | 'carrera' | 'mixto'
}
```

Añadir un nuevo estado junto a `planNombre`:

```typescript
const [bloque, setBloque] = useState<{ fase: string; semana_actual: number; semanas_totales: number } | null>(null)
```

En el `useEffect` de carga, después de `if (data.plan_nombre) setPlanNombre(data.plan_nombre)`, añadir:

```typescript
if (data.bloque) setBloque(data.bloque)
```

En el JSX, dentro de la sección `<section className="glass-card ...">`, justo después del párrafo `{resumenSemana.mensajeCliente}`, añadir:

```tsx
{bloque && (
  <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
    Bloque {bloque.fase} · Semana {bloque.semana_actual}/{bloque.semanas_totales}
  </p>
)}
```

En la tarjeta de cada sesión (dentro del `.map(s => ...)` que renderiza `<article key={s.id}>`), añadir un pequeño indicador de tipo justo antes del nombre de la sesión, usando los mismos iconos `lucide-react` que ya usa este archivo (no emoji — este proyecto usa iconografía consistente, nunca emoji como icono funcional). Añadir `Footprints` al import ya existente de `lucide-react` en la cabecera del archivo (junto a `Dumbbell`, que ya está importado). Sustituir:

```tsx
<div className="flex items-center gap-2">
  <h2 className="truncate text-sm font-bold" style={{ color: 'var(--text)' }}>{s.nombre}</h2>
```

por:

```tsx
<div className="flex items-center gap-2">
  {s.tipo_sesion === 'carrera' ? (
    <Footprints size={14} style={{ color: 'var(--semantic-info)' }} />
  ) : (
    <Dumbbell size={14} style={{ color: '#818CF8' }} />
  )}
  <h2 className="truncate text-sm font-bold" style={{ color: 'var(--text)' }}>{s.nombre}</h2>
```

- [ ] **Step 4: Añadir enlace a la vista mensual**

En `app/cliente/semana/page.tsx`, dentro de la misma `<section>` de resumen, justo después del bloque de "días con dot" (`<div className="mt-5 flex items-center gap-1.5">...</div>`), añadir:

```tsx
<Link
  href="/cliente/mes"
  className="mt-4 flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-bold"
  style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
>
  Ver mes completo <ChevronRight size={13} />
</Link>
```

(el import de `Link` y `ChevronRight` ya existen en este archivo).

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores

- [ ] **Step 6: Verificación manual en el navegador**

Con sesión de cliente (Carlos) activa: abrir `/cliente` y confirmar el pill de bloque en `SemanaEntrenoCard`; abrir `/cliente/semana` y confirmar pill + iconos 🏋️/🏃 + botón "Ver mes completo".
Con un cliente sin plan híbrido: confirmar que no aparece ningún pill (no debe mostrar "undefined" ni romper el layout).

- [ ] **Step 7: Commit**

```bash
git add components/training/SemanaEntrenoCard.tsx app/cliente/semana/page.tsx
git commit -m "feat: mostrar bloque activo e iconos híbrido/carrera en las vistas de hoy y semana"
```

---

### Task 6: Nueva vista mensual `/cliente/mes`

**Files:**
- Create: `app/cliente/mes/page.tsx`

**Interfaces:**
- Consumes: `GET /api/entrenos/mes-completo?year=&month=` (Task 4).

- [ ] **Step 1: Crear la página con navegación de mes y grid semanal**

```tsx
// app/cliente/mes/page.tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Dumbbell, Footprints, Loader2 } from 'lucide-react'

interface DiaMes {
  fecha: string
  dia_semana: string
  sesion: { id: string; nombre: string; tipo_sesion: 'hibrido' | 'carrera' | 'mixto'; ejercicios_count: number; completada: boolean } | null
  fase_bloque: string | null
  bloque_pendiente: boolean
}

const DIAS_ABR = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const DIA_ORDEN: Record<string, number> = { Lunes: 0, Martes: 1, Miércoles: 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6 }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function agruparPorSemanas(dias: DiaMes[]): DiaMes[][] {
  if (dias.length === 0) return []
  const semanas: DiaMes[][] = []
  let semanaActual: DiaMes[] = []

  // Rellenar huecos antes del primer día si el mes no empieza en Lunes
  const primerDiaOrden = DIA_ORDEN[dias[0].dia_semana] ?? 0
  for (let i = 0; i < primerDiaOrden; i++) {
    semanaActual.push({ fecha: '', dia_semana: '', sesion: null, fase_bloque: null, bloque_pendiente: false })
  }

  for (const dia of dias) {
    semanaActual.push(dia)
    if (semanaActual.length === 7) {
      semanas.push(semanaActual)
      semanaActual = []
    }
  }
  if (semanaActual.length > 0) {
    while (semanaActual.length < 7) semanaActual.push({ fecha: '', dia_semana: '', sesion: null, fase_bloque: null, bloque_pendiente: false })
    semanas.push(semanaActual)
  }
  return semanas
}

export default function VistaMensualClientePage() {
  const hoy = new Date()
  const [year, setYear] = useState(hoy.getFullYear())
  const [month, setMonth] = useState(hoy.getMonth() + 1) // 1-12
  const [dias, setDias] = useState<DiaMes[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/entrenos/mes-completo?year=${year}&month=${month}`)
      .then(r => r.ok ? r.json() : { dias: [] })
      .then(data => setDias(data.dias ?? []))
      .catch(() => setDias([]))
      .finally(() => setLoading(false))
  }, [year, month])

  const semanas = useMemo(() => agruparPorSemanas(dias), [dias])
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

  function mesAnterior() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function mesSiguiente() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  function colorDia(dia: DiaMes) {
    if (!dia.fecha) return { background: 'transparent', color: 'transparent' }
    if (dia.bloque_pendiente) return { background: 'rgba(128,128,128,0.06)', color: 'var(--text-muted)' }
    if (!dia.sesion) return { background: 'rgba(128,128,128,0.08)', color: 'var(--text-muted)' }
    if (dia.sesion.completada) return { background: 'var(--semantic-active-bg)', color: 'var(--semantic-active)' }
    return dia.sesion.tipo_sesion === 'carrera'
      ? { background: 'var(--semantic-info-bg)', color: 'var(--semantic-info)' }
      : { background: 'rgba(99,102,241,0.12)', color: '#818CF8' }
  }

  return (
    <div className="min-h-screen px-4 pb-8 pt-4" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/cliente/semana"
            replace
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Training OS</p>
            <h1 className="truncate text-xl font-bold" style={{ color: 'var(--text)' }}>Vista mensual</h1>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl p-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <button onClick={mesAnterior} className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-bold capitalize" style={{ color: 'var(--text)' }}>{MESES[month - 1]} {year}</p>
          <button onClick={mesSiguiente} className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: 'var(--text-muted)' }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : (
          <div className="rounded-3xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DIAS_ABR.map(d => (
                <p key={d} className="text-center text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{d}</p>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {semanas.map((semana, i) => {
                const fase = semana.find(d => d.fase_bloque)?.fase_bloque
                const pendiente = semana.some(d => d.bloque_pendiente)
                return (
                  <div key={i}>
                    {(fase || pendiente) && (
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                        {pendiente ? 'Bloque siguiente pendiente de generar' : `Bloque ${fase}`}
                      </p>
                    )}
                    <div className="grid grid-cols-7 gap-1">
                      {semana.map((dia, j) => {
                        const style = colorDia(dia)
                        const esHoy = dia.fecha === hoyISO
                        return (
                          <div key={j} className="flex flex-col items-center gap-0.5">
                            {dia.fecha ? (
                              <Link
                                href={dia.sesion ? `/cliente/sesion/${dia.sesion.id}?modo=solo-ver` : '#'}
                                className="flex h-10 w-full flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold"
                                style={{ ...style, border: esHoy ? '1.5px solid var(--accent)' : '1px solid transparent' }}
                              >
                                {new Date(dia.fecha).getDate()}
                                {dia.sesion && (
                                  dia.sesion.tipo_sesion === 'carrera'
                                    ? <Footprints size={11} />
                                    : <Dumbbell size={11} />
                                )}
                              </Link>
                            ) : (
                              <div className="h-10 w-full" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores

- [ ] **Step 3: Verificación manual en el navegador**

Abrir `/cliente/mes` como Carlos (cliente). Confirmar:
- Grid del mes correctamente alineado (el primer día cae en la columna de su día de semana real).
- Iconos 🏋️/🏃 en los días con sesión, punto verde si completada.
- Navegación mes anterior/siguiente funciona.
- Si se navega a un mes futuro sin bloque generado, aparece "Bloque siguiente pendiente de generar" en vez de celdas vacías sin explicación.

- [ ] **Step 4: Commit**

```bash
git add app/cliente/mes/page.tsx
git commit -m "feat: vista mensual de entrenamiento en el portal cliente"
```

---

### Task 7: Panel coach para generar el bloque

**Files:**
- Create: `components/clientes/GenerarBloqueHibridoPanel.tsx`
- Modify: `app/clientes/[id]/page.tsx`

**Interfaces:**
- Consumes: `POST /api/entrenos/proponer-plan-ciencia` con body `{ cliente_id, fase_bloque_objetivo? }` (Task 2); `GET /api/entrenos/sesiones-plan?plan_id=` o una consulta directa del plan activo del cliente para saber si hay bloque activo y si está por terminar — se resuelve con una consulta ligera propia dentro del panel (no reutiliza `sesiones-plan` porque ese endpoint es para el cliente autenticado, no para el coach mirando a un cliente ajeno).

- [ ] **Step 1: Crear el panel**

```tsx
// components/clientes/GenerarBloqueHibridoPanel.tsx
'use client'
import { useEffect, useState } from 'react'
import { Dumbbell, Loader2, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { calcularEstadoBloque, siguienteFaseBloque, type FaseBloque } from '@/lib/entrenos/bloques'

interface PlanActivoInfo {
  id: string
  nombre: string
  created_at: string
  duracion_semanas: number | null
  fase_bloque: FaseBloque | null
}

export default function GenerarBloqueHibridoPanel({ clienteId }: { clienteId: string }) {
  const supabase = createClient()
  const [plan, setPlan] = useState<PlanActivoInfo | null | undefined>(undefined) // undefined = cargando
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    const { data: planData } = await supabase
      .from('planes_entrenamiento')
      .select('id, nombre, created_at, duracion_semanas')
      .eq('cliente_id', clienteId)
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!planData) { setPlan(null); return }

    const { data: sesionData } = await supabase
      .from('sesiones_entrenamiento')
      .select('fase_bloque')
      .eq('plan_id', planData.id)
      .not('fase_bloque', 'is', null)
      .limit(1)
      .maybeSingle()

    setPlan({ ...planData, fase_bloque: (sesionData?.fase_bloque as FaseBloque | undefined) ?? null })
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  async function generar(faseBloqueObjetivo?: FaseBloque) {
    setGenerando(true)
    setError(null)
    try {
      const res = await fetch('/api/entrenos/proponer-plan-ciencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cliente_id: clienteId, fase_bloque_objetivo: faseBloqueObjetivo }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo generar el bloque.')
        return
      }
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setGenerando(false)
    }
  }

  if (plan === undefined) return null

  const esBloqueHibrido = Boolean(plan?.fase_bloque)
  const estado = plan && plan.duracion_semanas
    ? calcularEstadoBloque(plan.created_at, plan.duracion_semanas)
    : null
  const bloqueACaducar = Boolean(estado && estado.diasRestantes <= 3)
  const siguienteFase = esBloqueHibrido ? siguienteFaseBloque(plan!.fase_bloque) : 'Base'

  return (
    <section className="rounded-2xl p-4 sm:p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Dumbbell size={16} style={{ color: '#818CF8' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Programa Híbrido Hyrox + Running</p>
      </div>

      {error && (
        <div className="mb-3 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: 'rgb(248,113,113)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </div>
      )}

      {!esBloqueHibrido ? (
        <button className="btn-primary btn-sm" onClick={() => generar('Base')} disabled={generando}>
          {generando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Generar plan Híbrido Hyrox + Running
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Bloque activo: <strong style={{ color: 'var(--text)' }}>{plan!.fase_bloque}</strong>
            {estado && ` · Semana ${estado.semanaActual}/${estado.semanasTotales}`}
          </p>
          {bloqueACaducar && (
            <button className="btn-primary btn-sm" onClick={() => generar(siguienteFase)} disabled={generando}>
              {generando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Generar siguiente bloque: {siguienteFase}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Verificar que existe `lib/supabase-browser`**

Run: `grep -rn "export function createClient\|export const createClient" lib/supabase-browser.ts`
Expected: al menos una coincidencia (patrón ya usado por otros componentes cliente del coach en este proyecto; si el nombre real difiere, ajustar el import de este archivo al helper de cliente Supabase de navegador que ya use el resto de `components/clientes/*.tsx`, sin crear uno nuevo).

- [ ] **Step 3: Insertar el panel en la pestaña de entrenamiento**

En `app/clientes/[id]/page.tsx`, localizar la línea (dentro de `tabActiva === 'entrenamiento'`):

```tsx
<ErrorBoundary><TrainingCoachPanel clienteId={id as string} /></ErrorBoundary>
```

Añadir justo debajo:

```tsx
<ErrorBoundary><GenerarBloqueHibridoPanel clienteId={id as string} /></ErrorBoundary>
```

Y añadir el import junto a los demás imports de componentes dinámicos/estáticos de la parte superior del archivo:

```typescript
import GenerarBloqueHibridoPanel from '@/components/clientes/GenerarBloqueHibridoPanel'
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores

- [ ] **Step 5: Verificación manual en el navegador**

Como coach, abrir `/clientes/04cc53b3-851e-43f9-b271-daf1577b743e` (Carlos) → pestaña Entrenamiento. Confirmar que el panel aparece debajo del Training OS existente, muestra el botón correcto según si hay o no un bloque híbrido activo, y que generar funciona (llama a la API y refresca el estado del panel).

- [ ] **Step 6: Commit**

```bash
git add components/clientes/GenerarBloqueHibridoPanel.tsx app/clientes/\[id\]/page.tsx
git commit -m "feat: panel coach para generar y avanzar bloques del programa Híbrido Hyrox+Running"
```

---

### Task 8: Verificación end-to-end con Carlos como cliente real

**Files:** Ninguno (solo verificación).

- [ ] **Step 1: Generar el primer bloque real**

Como coach, en `/clientes/04cc53b3-851e-43f9-b271-daf1577b743e` → Entrenamiento → "Generar plan Híbrido Hyrox + Running".

- [ ] **Step 2: Verificar en Supabase**

```bash
node -e '
const fs = require("fs");
const env = fs.readFileSync(".env.local","utf8");
const get = k => { const m = env.match(new RegExp("^"+k+"=(.*)$","m")); return m ? m[1].replace(/^"|"$/g,"") : null; };
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession:false } });
(async () => {
  const { data: plan } = await sb.from("planes_entrenamiento").select("*").eq("cliente_id","04cc53b3-851e-43f9-b271-daf1577b743e").eq("activo",true).single();
  console.log("plan:", plan);
  const { data: sesiones } = await sb.from("sesiones_entrenamiento").select("*").eq("plan_id", plan.id).order("orden");
  console.log("sesiones:", sesiones.map(s => ({ nombre: s.nombre, dia: s.dia_semana, fase_bloque: s.fase_bloque, contexto_ia: s.contexto_ia })));
  const { data: ejercicios } = await sb.from("sesion_ejercicios").select("*, ejercicio:ejercicios(nombre,tipo)").in("sesion_id", sesiones.map(s=>s.id));
  console.log("ejercicios con peso_sugerido:", ejercicios.filter(e => e.peso_sugerido).length, "/", ejercicios.length);
})();
'
```

Confirmar: `duracion_semanas === 4`, 5 sesiones con `fase_bloque === 'Base'`, al menos 3 con ejercicios de tipo fuerza/funcional predominante y 2 con cardio predominante, varios `peso_sugerido` no nulos, 2 sesiones con `contexto_ia` con ritmo en min/km.

- [ ] **Step 3: Verificar las 3 vistas de cliente reales**

Con sesión de Carlos como cliente: `/cliente` (pill de bloque en la tarjeta de hoy), `/cliente/semana` (pill + iconos + botón "Ver mes completo"), `/cliente/mes` (grid correcto, semana actual marcada "Bloque Base").

- [ ] **Step 4: Confirmar que otros clientes no se rompen**

Elegir un cliente real con plan de entreno activo y modalidad distinta de híbrido (ej. cualquiera de los 6 clientes ficticios de sesiones anteriores, o uno real). Confirmar en `/clientes/[id]` que el panel `GenerarBloqueHibridoPanel` no aparece con datos erróneos (debe mostrar el botón "Generar plan Híbrido..." solo si ese cliente en concreto no tiene ya un bloque — esto es aceptable ya que el panel es específico de este programa; documentar en el commit final si se decide ocultarlo del todo para clientes no-híbridos como mejora futura) y que sus vistas de cliente (`/cliente/semana`, etc.) siguen funcionando sin pill de bloque.

- [ ] **Step 5: Build final**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 errores en ambos.

- [ ] **Step 6: Commit de cierre**

```bash
git add -A
git commit -m "docs: verificación end-to-end del programa Híbrido Hyrox+Running para Carlos"
```

---

## Self-Review

**1. Cobertura de la spec:** Reparto semanal 3+2 (Task 2), hipertrofia accesoria rotando (Task 2 prompt), bloques de 4 semanas con rotación (Task 1 + Task 2), pesos/reps/ritmos concretos (Task 2), sin migraciones (confirmado en todas las tareas — cero `ALTER TABLE`), 3 vistas cliente día/semana/mes (Task 5 + Task 6), panel coach generar bloque (Task 7), verificación (Task 8). Sin huecos detectados.

**2. Placeholders:** Ninguno — cada paso trae el código completo a escribir/sustituir, no hay "TBD" ni "similar a la tarea N".

**3. Consistencia de tipos:** `FaseBloque`, `EstadoBloque`, `TipoSesion` se definen una vez en Task 1 y se importan literalmente igual (`siguienteFaseBloque`, `calcularEstadoBloque`, `clasificarTipoSesion`) en Tasks 2, 3, 4 y 7 — mismos nombres, mismas firmas en todos los usos.

**4. Review Focus cubierto:**
- Cliente no-híbrido generando plan → Task 2 Step 8 y Task 3 Step 5 lo verifican explícitamente contra un cliente real distinto.
- Sesiones sin `fase_bloque` (planes antiguos) → Task 3 Steps 1-2 usan `sesionesRaw.find(s => s.fase_bloque)` que da `undefined` limpio, y Task 5 solo renderiza el pill `{bloque && ...}`.
- Sesión sin ejercicios vinculados → cubierto por el test de `clasificarTipoSesion([])` en Task 1 Step 1.
- `mes-completo` sin plan activo → Task 4 Step 1 tiene la rama explícita `if (!planEntreno)` devolviendo `dias` vacíos de sesión, con test manual dedicado en Step 3.
- Fecha de inicio en el futuro → cubierto por el test `bloqueFuturo` en Task 1 Step 1.

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-09-26-hyrox-running-training-system.md`. Por favor revísalo y dime si captura lo que quieres. ¿Qué enfoque de ejecución prefieres?

- **Subagent-driven** — un subagente fresco implementa cada tarea y un revisor fresco la revisa antes de pasar a la siguiente, más una revisión final de toda la rama. Más riguroso; gasta contexto nuevo por tarea y por revisión.
- **Nativo** — yo implemento todas las tareas en esta misma sesión, y al final un revisor fresco en el modelo más capaz revisa toda la rama. Más barato y rápido; sin revisión independiente hasta el final.

Para este plan recomiendo **nativo**, porque las 8 tareas son secuenciales y comparten un módulo pequeño de tipos (Task 1) que todas las demás simplemente importan — hay poca interfaz nueva que negociar entre tareas, y el coste de un fallo aquí es bajo (es tu propio plan de entrenamiento, no algo que afecte a clientes reales de pago todavía). ¿Confirmas el plan y el enfoque nativo, o prefieres subagent-driven?

