# Planificar con IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un único botón «Planificar con IA» que decide qué hacer según el estado del plan de entreno del cliente y entrega siempre una **propuesta aprobable** en «Decisiones de IA pendientes», sin tocar el plan activo hasta que el coach aprueba.

**Architecture:** Se extraen del generador actual (`proponer-plan-ciencia`) dos piezas reutilizables: `generarPlanEntrenoIA` (genera, no guarda) y `guardarPlanEntreno` (guarda, de forma segura). Un servicio `planificarConIA` decide el modo y crea una tarea `plan_entreno_ia` en `agente_tareas`; `aplicarTarea` gana el caso `plan_entreno_ia` que llama a `guardarPlanEntreno`. La UI pasa a un botón único + menú «Más opciones».

**Tech Stack:** Next.js (App Router, versión custom), Supabase (service role), DeepSeek, tests con `npx tsx scripts/<x>.test.ts` (asserts de `node:assert/strict`), `npm run verificar:motor`.

**Spec:** `docs/superpowers/specs/2026-10-10-planificar-con-ia-design.md`

## Global Constraints

- Todo texto de usuario en **español (castellano)**; fechas DD-MM-YYYY en documentos.
- **Sin migraciones de base de datos**: `agente_tareas.tipo` es texto libre (hay que comprobarlo en la Task 5 con una inserción de prueba que se borra).
- **Estética: no se toca.** Solo clases y variables CSS que ya existen (`btn-primary`, `btn-secondary`, `btn-sm`, `var(--surface)`, `var(--border)`, `var(--text)`, `var(--text-muted)`, `var(--semantic-warn-*)`). El acabado visual lo hace Codex.
- Commits con **`git add` de rutas concretas** (Codex trabaja en paralelo en el mismo repo); mensaje terminado en `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Antes de cada `git push`: `npm run verificar:motor` debe dar todo ✅.
- Errores al cliente HTTP: mensajes genéricos, nunca `err.message`.
- La nutrición, el alta de clientes nuevos y el panel de Rendimiento **no cambian**.

## Review Focus

Entradas o fallos que la spec implica pero ninguna tarea ejercita por defecto; cada línea tiene su test en la tarea indicada:

1. **Dos pulsaciones seguidas o dos pestañas** → solo puede haber una propuesta `plan_entreno_ia` pendiente por cliente (409). Test en Task 4.
2. **Ejercicio propuesto por la IA que no existe en la base de datos** → se omite y se declara en el resultado de aplicar, nunca en silencio. Test en Task 2.
3. **Fallo a mitad de aplicar** (sesiones a medias) → el plan anterior sigue activo y no quedan restos del nuevo. Test en Task 2.
4. **Payload manipulado o vacío** (sin sesiones, sesiones de más, `plan` que no es objeto) → `INVALID_PAYLOAD`, sin crear nada. Test en Task 5.
5. **Cliente de otro coach, o usuario con rol cliente** → 401/403 en la ruta nueva y también en `proponer-plan-ciencia` (hoy solo comprueba que hay sesión). Test en Task 6.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `lib/entrenos/planificar-modo.ts` (nuevo) | Función pura `decidirModoPlanificacion` y tipos del modo |
| `lib/entrenos/guardar-plan.ts` (nuevo) | `guardarPlanEntreno` + `matchEjercicio` (movidos de la ruta); guardado seguro con limpieza |
| `lib/entrenos/generar-plan-ia.ts` (nuevo) | `generarPlanEntrenoIA` (todo el contexto, esqueleto, prompt y llamada a DeepSeek, sin guardar) y `ErrorGeneracionPlan` |
| `lib/entrenos/planificar-con-ia.ts` (nuevo) | `planificarConIA`, `leerModoPlanificacion`, `construirResumenPropuesta`, `construirPayloadPropuesta`, `estadoHttpDe` |
| `lib/entrenos/aplicar-plan-ia.ts` (nuevo) | `aplicarPlanEntrenoIA` (aprobación → plan real) |
| `lib/agentes/types.ts` (modificar) | `TipoTarea` + `'plan_entreno_ia'`, `TipoAgente` + `'planificador'` |
| `lib/agentes/aplicar.ts` (modificar) | Nuevo `case 'plan_entreno_ia'` |
| `app/api/entrenos/planificar-ia/route.ts` (nuevo) | GET (modo) y POST (planificar) |
| `app/api/entrenos/proponer-plan-ciencia/route.ts` (modificar) | Capa fina sobre el núcleo + comprobación de coach |
| `components/clientes/PlanificarConIA.tsx` (nuevo) | Botón único + línea de modo |
| `components/clientes/PropuestaPlanEntreno.tsx` (nuevo) | Detalle de una propuesta (sesiones, esqueleto, hallazgos, fundamentos) |
| `components/clientes/DecisionesIACliente.tsx` (modificar) | Muestra `plan_entreno_ia`, escucha el evento de recarga |
| `app/clientes/[id]/page.tsx` (modificar) | Botón único + «Más opciones»; quita «Regenerar» y el panel híbrido |
| `components/clientes/GenerarBloqueHibridoPanel.tsx` (eliminar) | Sustituido por el botón único |
| `scripts/planificar-modo.test.ts`, `guardar-plan.test.ts`, `planificar-con-ia.test.ts`, `aplicar-plan-ia.test.ts`, `planificar-ia-ruta.test.ts` (nuevos) | Tests |
| `scripts/regresion-generador-plan.ts` (nuevo) | Comprobación manual del núcleo extraído contra datos reales, con DeepSeek simulado |
| `scripts/verificar-motor.ts` (modificar) | Añade los tests nuevos |

---

### Task 1: Decisión de modo (función pura)

**Files:**
- Create: `lib/entrenos/planificar-modo.ts`
- Test: `scripts/planificar-modo.test.ts`

**Interfaces:**
- Consumes: `calcularEstadoBloque(fechaInicioISO: string, duracionSemanas: number, fechaRef?: Date): EstadoBloque` de `lib/entrenos/bloques.ts`.
- Produces: `type ModoPlanificacion = 'crear' | 'siguiente_bloque' | 'ajustar'`; `interface PlanActivoResumen { created_at: string; duracion_semanas: number | null }`; `interface DecisionModo { modo: ModoPlanificacion; etiqueta: string; diasRestantes: number | null }`; `const DIAS_AVISO_SIGUIENTE_BLOQUE = 7`; `decidirModoPlanificacion(plan: PlanActivoResumen | null, hoy?: Date): DecisionModo`.

- [ ] **Step 1: Escribir el test que falla** — `scripts/planificar-modo.test.ts`

```ts
import assert from 'node:assert/strict'
import { decidirModoPlanificacion, DIAS_AVISO_SIGUIENTE_BLOQUE } from '../lib/entrenos/planificar-modo'

const hoy = new Date(2026, 9, 10) // 10-10-2026 (local)
const inicio = (diasAtras: number) => new Date(2026, 9, 10 - diasAtras, 12).toISOString()

// Sin plan activo → crear
assert.deepEqual(decidirModoPlanificacion(null, hoy), { modo: 'crear', etiqueta: 'Crear el primer bloque', diasRestantes: null })

// Bloque de 4 semanas (28 días): a mitad → ajustar
const mitad = decidirModoPlanificacion({ created_at: inicio(10), duracion_semanas: 4 }, hoy)
assert.equal(mitad.modo, 'ajustar')
assert.equal(mitad.diasRestantes, 18)
assert.match(mitad.etiqueta, /semana 2 de 4/)

// Quedan exactamente 7 días → siguiente bloque; 8 días → todavía ajustar
assert.equal(decidirModoPlanificacion({ created_at: inicio(21), duracion_semanas: 4 }, hoy).modo, 'siguiente_bloque')
assert.equal(decidirModoPlanificacion({ created_at: inicio(20), duracion_semanas: 4 }, hoy).modo, 'ajustar')
assert.equal(DIAS_AVISO_SIGUIENTE_BLOQUE, 7)

// Quedan 3 días → texto en plural; queda 1 → singular
assert.match(decidirModoPlanificacion({ created_at: inicio(25), duracion_semanas: 4 }, hoy).etiqueta, /acaba en 3 días/)
assert.match(decidirModoPlanificacion({ created_at: inicio(27), duracion_semanas: 4 }, hoy).etiqueta, /acaba en 1 día\)/)

// Bloque terminado → siguiente bloque
const acabado = decidirModoPlanificacion({ created_at: inicio(40), duracion_semanas: 4 }, hoy)
assert.equal(acabado.modo, 'siguiente_bloque')
assert.equal(acabado.diasRestantes, 0)
assert.match(acabado.etiqueta, /ya terminó/)

// Plan sin duración definida (p. ej. plantilla): no se sustituye, se ajusta
const sinDuracion = decidirModoPlanificacion({ created_at: inicio(5), duracion_semanas: null }, hoy)
assert.equal(sinDuracion.modo, 'ajustar')
assert.equal(sinDuracion.diasRestantes, null)

console.log('planificar-modo.test OK')
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx tsx scripts/planificar-modo.test.ts`
Expected: FAIL (módulo no encontrado).

- [ ] **Step 3: Implementar** — `lib/entrenos/planificar-modo.ts`

```ts
// lib/entrenos/planificar-modo.ts
// Decide qué debe hacer el botón «Planificar con IA» según el plan activo del cliente. Función pura.
import { calcularEstadoBloque } from './bloques'

export type ModoPlanificacion = 'crear' | 'siguiente_bloque' | 'ajustar'

export interface PlanActivoResumen { created_at: string; duracion_semanas: number | null }

export interface DecisionModo {
  modo: ModoPlanificacion
  /** Texto que se muestra bajo el botón. */
  etiqueta: string
  diasRestantes: number | null
}

/** Cuando quedan estos días o menos del bloque, se propone el siguiente. */
export const DIAS_AVISO_SIGUIENTE_BLOQUE = 7

const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`

export function decidirModoPlanificacion(plan: PlanActivoResumen | null, hoy: Date = new Date()): DecisionModo {
  if (!plan) return { modo: 'crear', etiqueta: 'Crear el primer bloque', diasRestantes: null }
  // Sin duración no se sabe cuándo acaba: se ajusta, que no sustituye nada.
  if (!plan.duracion_semanas) return { modo: 'ajustar', etiqueta: 'Ajustar el plan actual con sus datos reales', diasRestantes: null }
  const e = calcularEstadoBloque(plan.created_at, plan.duracion_semanas, hoy)
  if (e.terminado) return { modo: 'siguiente_bloque', etiqueta: 'Siguiente bloque (el actual ya terminó)', diasRestantes: 0 }
  if (e.diasRestantes <= DIAS_AVISO_SIGUIENTE_BLOQUE) {
    return { modo: 'siguiente_bloque', etiqueta: `Siguiente bloque (el actual acaba en ${dias(e.diasRestantes)})`, diasRestantes: e.diasRestantes }
  }
  return { modo: 'ajustar', etiqueta: `Ajustar el bloque actual (semana ${e.semanaActual} de ${e.semanasTotales})`, diasRestantes: e.diasRestantes }
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npx tsx scripts/planificar-modo.test.ts`
Expected: `planificar-modo.test OK`

- [ ] **Step 5: Commit**

```bash
git add lib/entrenos/planificar-modo.ts scripts/planificar-modo.test.ts
git commit -m "feat: decisión de modo de «Planificar con IA» (crear, siguiente bloque, ajustar)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `guardarPlanEntreno` (guardado seguro, extraído de la ruta)

**Files:**
- Create: `lib/entrenos/guardar-plan.ts`
- Modify: `app/api/entrenos/proponer-plan-ciencia/route.ts` (mover `STOP_WORDS`, `OTRA_DISCIPLINA_RE`, `matchEjercicio` y el bloque de guardado, líneas 19-66 y 468-560)
- Test: `scripts/guardar-plan.test.ts`

**Interfaces:**
- Consumes: `bloqueEjercicioGenerado` de `@/lib/training/generated-session-blocks`.
- Produces:
```ts
export interface EjercicioIA { nombre?: string; bloque?: unknown; series?: unknown; repeticiones?: unknown; descanso_segundos?: unknown; rpe_objetivo?: unknown; notas?: unknown; peso_estimado_kg?: unknown }
export interface SesionIA { nombre?: string; dia_semana?: string | null; ritmo_objetivo?: unknown; ejercicios?: EjercicioIA[] }
export interface DatosGuardadoPlan {
  coachId: string; clienteId: string; nombre: string; descripcion: string | null
  duracionSemanas: number | null
  /** Solo en el protocolo híbrido: fase del bloque (Base, Fuerza…). */
  faseBloque: string | null
  sesiones: SesionIA[]
}
export interface ResultadoGuardadoPlan { planId: string; sesiones: number; ejerciciosVinculados: number; ejerciciosOmitidos: string[] }
export async function guardarPlanEntreno(sb: SupabaseClient, d: DatosGuardadoPlan): Promise<ResultadoGuardadoPlan>
export async function matchEjercicio(sb: SupabaseClient, nombre: string, tipoPreferido?: 'cardio' | 'fuerza'): Promise<string | null>
```
Orden seguro: (1) crear el plan nuevo con `activo: false`; (2) insertar sesiones y ejercicios; (3) solo al final desactivar los planes activos anteriores y activar el nuevo. Si algo falla antes del paso 3 se borra lo creado y el plan anterior no se toca.

- [ ] **Step 1: Escribir el test que falla** — `scripts/guardar-plan.test.ts`

```ts
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { guardarPlanEntreno, type DatosGuardadoPlan } from '../lib/entrenos/guardar-plan'

type Op = { tabla: string; op: string; payload?: unknown; filtros: Record<string, unknown> }

/** Cliente falso: registra cada escritura en orden; `ejercicios` responde al buscador por nombre; `falla` hace fallar un insert concreto. */
function fakeDb(opts: { ejercicios?: { id: string; nombre: string; tipo: string }[]; planesActivos?: { id: string }[]; falla?: string } = {}) {
  const ops: Op[] = []
  let n = 0
  const from = (tabla: string) => {
    const filtros: Record<string, unknown> = {}
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: unknown
    const q: Record<string, unknown> = {}
    const registrar = () => { if (op !== 'select') ops.push({ tabla, op, payload, filtros: { ...filtros } }) }
    for (const m of ['select', 'not', 'order', 'limit']) q[m] = () => q
    q.eq = (c: string, v: unknown) => { filtros[c] = v; return q }
    q.in = (c: string, v: unknown) => { filtros[c] = v; return q }
    q.ilike = (c: string, v: unknown) => { filtros[c] = v; return q }
    q.insert = (p: unknown) => { op = 'insert'; payload = p; return q }
    q.update = (p: unknown) => { op = 'update'; payload = p; return q }
    q.delete = () => { op = 'delete'; return q }
    const resultado = () => {
      registrar()
      if (op === 'insert' && opts.falla === tabla) return { data: null, error: { message: 'fallo simulado' } }
      if (op === 'insert') return { data: { id: `${tabla}-${++n}` }, error: null }
      if (op === 'select' && tabla === 'ejercicios') {
        const patron = String(filtros.nombre ?? '').replace(/%/g, '').toLowerCase()
        return { data: (opts.ejercicios ?? []).filter(e => e.nombre.toLowerCase().includes(patron)), error: null }
      }
      if (op === 'select' && tabla === 'planes_entrenamiento') return { data: opts.planesActivos ?? [], error: null }
      return { data: null, error: null }
    }
    q.single = () => Promise.resolve(resultado())
    q.maybeSingle = () => Promise.resolve(resultado())
    q.then = (res: (v: unknown) => void) => res(resultado())
    return q
  }
  return { db: { from } as unknown as SupabaseClient, ops }
}

const datos = (sesiones: DatosGuardadoPlan['sesiones']): DatosGuardadoPlan => ({
  coachId: 'coach1', clienteId: 'cli1', nombre: 'Plan IA', descripcion: 'Porque sí', duracionSemanas: 4, faseBloque: null, sesiones,
})
const ejercicios = [{ id: 'e1', nombre: 'Rodaje continuo', tipo: 'cardio' }, { id: 'e2', nombre: 'Sentadilla goblet', tipo: 'fuerza' }]

async function main() {
  // Camino feliz: plan inactivo → sesiones → ejercicios → solo al final se desactivan los anteriores y se activa el nuevo.
  const ok = fakeDb({ ejercicios, planesActivos: [{ id: 'viejo1' }] })
  const r = await guardarPlanEntreno(ok.db, datos([
    { nombre: 'Rodaje fácil', dia_semana: 'martes', ejercicios: [{ nombre: 'Rodaje continuo', series: 1 }] },
    { nombre: 'Fuerza A', dia_semana: 'jueves', ejercicios: [{ nombre: 'Sentadilla goblet', series: 3, repeticiones: 10, peso_estimado_kg: 16, rpe_objetivo: 7 }] },
  ]))
  assert.equal(r.sesiones, 2)
  assert.equal(r.ejerciciosVinculados, 2)
  assert.deepEqual(r.ejerciciosOmitidos, [])
  const planInsert = ok.ops.find(o => o.tabla === 'planes_entrenamiento' && o.op === 'insert')!
  assert.equal((planInsert.payload as { activo: boolean }).activo, false, 'el plan nuevo nace inactivo')
  const idxUltimaEscrituraSesion = Math.max(...ok.ops.map((o, i) => (o.tabla === 'sesion_ejercicios' || o.tabla === 'sesiones_entrenamiento') && o.op === 'insert' ? i : -1))
  const idxDesactivar = ok.ops.findIndex(o => o.tabla === 'planes_entrenamiento' && o.op === 'update' && (o.payload as { activo: boolean }).activo === false)
  const idxActivar = ok.ops.findIndex(o => o.tabla === 'planes_entrenamiento' && o.op === 'update' && (o.payload as { activo: boolean }).activo === true)
  assert.ok(idxDesactivar > idxUltimaEscrituraSesion && idxActivar > idxDesactivar, 'se activa al final')
  const ejInsert = ok.ops.find(o => o.tabla === 'sesion_ejercicios' && (o.payload as { ejercicio_id: string }).ejercicio_id === 'e2')!
  assert.equal((ejInsert.payload as { peso_sugerido: string }).peso_sugerido, '16kg')
  assert.equal((ejInsert.payload as { notas: string }).notas, 'RPE 7')

  // Ejercicio que no existe en la base de datos: se omite y se declara.
  const sinMatch = fakeDb({ ejercicios })
  const r2 = await guardarPlanEntreno(sinMatch.db, datos([{ nombre: 'Rodaje fácil', ejercicios: [{ nombre: 'Rodaje continuo' }, { nombre: 'Paseo del granjero con hipopótamo' }] }]))
  assert.equal(r2.ejerciciosVinculados, 1)
  assert.deepEqual(r2.ejerciciosOmitidos, ['Paseo del granjero con hipopótamo'])

  // Fallo a mitad (al insertar una sesión): se borra lo creado, el plan anterior NO se desactiva y se lanza el error.
  const fallo = fakeDb({ ejercicios, planesActivos: [{ id: 'viejo1' }], falla: 'sesion_ejercicios' })
  await assert.rejects(() => guardarPlanEntreno(fallo.db, datos([{ nombre: 'Rodaje', ejercicios: [{ nombre: 'Rodaje continuo' }] }])), /No se pudo guardar el plan/)
  assert.ok(!fallo.ops.some(o => o.tabla === 'planes_entrenamiento' && o.op === 'update'), 'el plan anterior sigue activo')
  assert.ok(fallo.ops.some(o => o.tabla === 'planes_entrenamiento' && o.op === 'delete'), 'se limpia el plan a medias')

  // Plan sin sesiones: no se crea nada.
  const vacio = fakeDb({ ejercicios })
  await assert.rejects(() => guardarPlanEntreno(vacio.db, datos([])), /sin sesiones/)
  assert.equal(vacio.ops.length, 0)

  // Protocolo híbrido: fase_bloque y ritmo en cada sesión.
  const hib = fakeDb({ ejercicios })
  await guardarPlanEntreno(hib.db, { ...datos([{ nombre: 'Carrera: Tempo', ritmo_objetivo: '4:38/km', ejercicios: [] }]), faseBloque: 'Base' })
  const ses = hib.ops.find(o => o.tabla === 'sesiones_entrenamiento')!.payload as { fase_bloque: string; contexto_ia: string }
  assert.equal(ses.fase_bloque, 'Base')
  assert.equal(ses.contexto_ia, '4:38/km')

  console.log('guardar-plan.test OK')
}
main()
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx tsx scripts/guardar-plan.test.ts`
Expected: FAIL (módulo no encontrado).

- [ ] **Step 3: Implementar** — `lib/entrenos/guardar-plan.ts`

Mover **tal cual** `STOP_WORDS`, `OTRA_DISCIPLINA_RE` y `matchEjercicio` desde la ruta (con sus comentarios), exportando `matchEjercicio`. Después añadir:

```ts
// lib/entrenos/guardar-plan.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { bloqueEjercicioGenerado } from '@/lib/training/generated-session-blocks'

// ⬇ AQUÍ van, movidos sin cambios desde proponer-plan-ciencia/route.ts: STOP_WORDS, OTRA_DISCIPLINA_RE y matchEjercicio (con `export`).

export interface EjercicioIA {
  nombre?: string; bloque?: unknown; series?: unknown; repeticiones?: unknown
  descanso_segundos?: unknown; rpe_objetivo?: unknown; notas?: unknown; peso_estimado_kg?: unknown
}
export interface SesionIA { nombre?: string; dia_semana?: string | null; ritmo_objetivo?: unknown; ejercicios?: EjercicioIA[] }
export interface DatosGuardadoPlan {
  coachId: string; clienteId: string; nombre: string; descripcion: string | null
  duracionSemanas: number | null
  faseBloque: string | null
  sesiones: SesionIA[]
}
export interface ResultadoGuardadoPlan { planId: string; sesiones: number; ejerciciosVinculados: number; ejerciciosOmitidos: string[] }

/**
 * Guarda un plan de entreno generado por IA sin dejar nunca al cliente sin plan:
 * el nuevo nace inactivo, se rellena entero y solo entonces sustituye al activo.
 * Si algo falla se borra lo creado y el plan anterior no se toca.
 */
export async function guardarPlanEntreno(sb: SupabaseClient, d: DatosGuardadoPlan): Promise<ResultadoGuardadoPlan> {
  if (!d.sesiones.length) throw new Error('El plan no tiene sesiones: no se guarda (plan sin sesiones)')

  const { data: plan, error: errPlan } = await sb.from('planes_entrenamiento').insert({
    coach_id: d.coachId, cliente_id: d.clienteId, nombre: d.nombre, descripcion: d.descripcion,
    duracion_semanas: d.duracionSemanas, activo: false,
  }).select('id').single()
  if (errPlan || !plan) throw new Error('No se pudo guardar el plan')
  const planId = plan.id as string

  const sesionesCreadas: string[] = []
  const omitidos: string[] = []
  let vinculados = 0

  try {
    for (let i = 0; i < d.sesiones.length; i++) {
      const s = d.sesiones[i]
      const { data: sesion, error: errSes } = await sb.from('sesiones_entrenamiento').insert({
        plan_id: planId,
        nombre: s.nombre ?? `Sesión ${i + 1}`,
        dia_semana: s.dia_semana ?? null,
        orden: i + 1,
        notas: null,
        fase_bloque: d.faseBloque,
        contexto_ia: d.faseBloque && s.ritmo_objetivo ? String(s.ritmo_objetivo) : null,
      }).select('id').single()
      if (errSes || !sesion) throw new Error('sesión')
      sesionesCreadas.push(sesion.id as string)

      // Una sesión de carrera pura debe vincularse a ejercicios de carrera, nunca a un aparato de otra disciplina.
      const nombreSesion = (s.nombre ?? '').toLowerCase()
      const esSesionCarrera = /carrera|tirada|rodaje|running|tempo run/i.test(nombreSesion) && !/híbrid|hibrid|hyrox/i.test(nombreSesion)
      const tipoPreferido: 'cardio' | 'fuerza' | undefined = esSesionCarrera ? 'cardio' : undefined

      const ejercicios = s.ejercicios ?? []
      for (let j = 0; j < ejercicios.length; j++) {
        const ej = ejercicios[j]
        const nombreEj = (ej.nombre ?? '').trim()
        if (!nombreEj) continue
        const ejercicioId = await matchEjercicio(sb, nombreEj, tipoPreferido)
        if (!ejercicioId) { omitidos.push(nombreEj); continue }
        const { error: errEj } = await sb.from('sesion_ejercicios').insert({
          sesion_id: sesion.id,
          ejercicio_id: ejercicioId,
          bloque: bloqueEjercicioGenerado(ej.bloque),
          series: typeof ej.series === 'number' ? ej.series : null,
          repeticiones: ej.repeticiones != null ? String(ej.repeticiones) : null,
          descanso_segundos: typeof ej.descanso_segundos === 'number' ? ej.descanso_segundos : null,
          notas: [ej.rpe_objetivo ? `RPE ${ej.rpe_objetivo}` : null, ej.notas].filter(Boolean).join(' — ') || null,
          orden: j + 1,
          peso_sugerido: typeof ej.peso_estimado_kg === 'number' ? `${ej.peso_estimado_kg}kg` : null,
        })
        if (errEj) throw new Error('ejercicio')
        vinculados++
      }
    }

    // Solo ahora el plan nuevo sustituye al activo.
    const { data: activos } = await sb.from('planes_entrenamiento').select('id').eq('cliente_id', d.clienteId).eq('activo', true)
    const previos = (activos ?? []).map(p => p.id as string).filter(id => id !== planId)
    if (previos.length) await sb.from('planes_entrenamiento').update({ activo: false }).in('id', previos)
    const { error: errAct } = await sb.from('planes_entrenamiento').update({ activo: true }).eq('id', planId)
    if (errAct) throw new Error('activar')
  } catch (e) {
    // Limpieza: ejercicios → sesiones → plan. El plan anterior no se ha tocado.
    if (sesionesCreadas.length) {
      await sb.from('sesion_ejercicios').delete().in('sesion_id', sesionesCreadas)
      await sb.from('sesiones_entrenamiento').delete().in('id', sesionesCreadas)
    }
    await sb.from('planes_entrenamiento').delete().eq('id', planId)
    console.error('guardarPlanEntreno:', e instanceof Error ? e.message : e)
    throw new Error('No se pudo guardar el plan')
  }

  return { planId, sesiones: sesionesCreadas.length, ejerciciosVinculados: vinculados, ejerciciosOmitidos: omitidos }
}
```

- [ ] **Step 4: Hacer que la ruta use el módulo** — en `app/api/entrenos/proponer-plan-ciencia/route.ts`: borrar `STOP_WORDS`, `OTRA_DISCIPLINA_RE`, `matchEjercicio` y el bloque `// Guardar automáticamente…` (desde `let planGuardadoId` hasta el `catch (saveErr)` inclusive) y sustituirlo por:

```ts
    // Guardar: el plan nuevo sustituye al activo solo cuando está completo (ver guardarPlanEntreno).
    let planGuardadoId: string | null = null
    try {
      const guardado = await guardarPlanEntreno(sb, {
        coachId: user.id,
        clienteId: cliente_id,
        nombre: esHibridoHyroxRunning ? `Híbrido Hyrox + Running — ${faseBloqueObjetivo}` : ((planIA.nombre_plan as string) ?? `Plan IA — ${modalidadFoco}`),
        descripcion: (planIA.fundamentacion as string) ?? null,
        duracionSemanas: esHibridoHyroxRunning ? 4 : ((planIA.duracion_semanas as number) ?? null),
        faseBloque: esHibridoHyroxRunning ? faseBloqueObjetivo : null,
        sesiones: (planIA.sesiones as SesionIA[]) ?? [],
      })
      planGuardadoId = guardado.planId
      // Historial para poder regenerar / ver versiones
      await sb.from('registros_ia').insert({
        cliente_id,
        tipo: 'plan_entreno_ia',
        respuesta_json: validacion || macrociclo ? { ...planIA, ...(validacion ? { _validacion: validacion } : {}), ...(macrociclo ? { _macrociclo: macrociclo } : {}) } : planIA,
      })
    } catch (saveErr) {
      // No bloqueante: devolvemos el plan aunque falle el guardado
      console.error('proponer-plan-ciencia save error:', saveErr)
    }
```
y añadir `import { guardarPlanEntreno, type SesionIA } from '@/lib/entrenos/guardar-plan'`.

- [ ] **Step 5: Verificar**

Run: `npx tsx scripts/guardar-plan.test.ts && npx tsc --noEmit --pretty false`
Expected: `guardar-plan.test OK` y `tsc` sin salida. Revisar con `git diff --color-moved=zebra` que `matchEjercicio` se movió sin cambios.

- [ ] **Step 6: Commit**

```bash
git add lib/entrenos/guardar-plan.ts scripts/guardar-plan.test.ts app/api/entrenos/proponer-plan-ciencia/route.ts
git commit -m "refactor: guardarPlanEntreno guarda el plan nuevo inactivo y solo lo activa al final (con limpieza si falla)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Núcleo generador `generarPlanEntrenoIA` (mover, no reescribir)

**Files:**
- Create: `lib/entrenos/generar-plan-ia.ts`
- Modify: `app/api/entrenos/proponer-plan-ciencia/route.ts` (queda: auth + coach + rate limit + llamada al núcleo + guardado + respuesta)
- Create: `scripts/regresion-generador-plan.ts`

**Interfaces:**
- Consumes: todo lo que importa hoy la ruta (`evaluarPerfilEntreno`, `obtenerInformeVigente`, `siguienteFaseBloque`, `construirContextoRendimiento`, `validarSemanaCarrera`, `planificarMacrociclo`, `construirEntradaMacro`, `formatearRitmo`).
- Produces:
```ts
export class ErrorGeneracionPlan extends Error {
  constructor(public codigo: 'CLIENTE_NO_ENCONTRADO' | 'IA_ERROR' | 'IA_RESPUESTA_INVALIDA', public estado: number, mensaje: string) { super(mensaje) }
}
export interface ResultadoGeneracionPlan {
  planIA: Record<string, unknown>
  nombrePlan: string
  duracionSemanas: number | null
  esHibrido: boolean
  faseBloque: FaseBloque | null
  modalidad: string
  validacion: ResultadoValidacion | null
  macrociclo: ResultadoMacro | null
  metadata: { rpe_promedio: number | null; ajuste_rpe: string; modalidad: string; recomendacion_motor: unknown; papers_usados: number; generado_con: string }
}
export async function generarPlanEntrenoIA(sb: SupabaseClient, opts: { clienteId: string; faseBloqueObjetivo?: FaseBloque }): Promise<ResultadoGeneracionPlan>
```
`ResultadoValidacion` se importa de `./validar-plan-carrera`.

- [ ] **Step 1: Mover el cuerpo con un script de anclas** (no a mano). Crear `scripts/_mover-nucleo.py` temporal:

```python
import re
ruta = 'app/api/entrenos/proponer-plan-ciencia/route.ts'
s = open(ruta).read()

# Tramo a mover: desde el primer `const sb = createServiceSupabase()` hasta justo antes de `// Guardar:` (Task 2).
a = s.index("    const sb = createServiceSupabase()\n") + len("    const sb = createServiceSupabase()\n")
b = s.index("    // Guardar: el plan nuevo sustituye al activo")
cuerpo = s[a:b]

# Dentro del cuerpo: las respuestas HTTP pasan a errores tipados.
cuerpo = cuerpo.replace("if (!clienteRes.data) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })",
                        "if (!clienteRes.data) throw new ErrorGeneracionPlan('CLIENTE_NO_ENCONTRADO', 404, 'Cliente no encontrado')")
cuerpo = cuerpo.replace("      return NextResponse.json({ error: 'Error al generar el plan con IA' }, { status: 502 })",
                        "      throw new ErrorGeneracionPlan('IA_ERROR', 502, 'Error al generar el plan con IA')")
cuerpo = cuerpo.replace("      return NextResponse.json({ error: 'Respuesta IA no válida', raw: planTexto }, { status: 502 })",
                        "      throw new ErrorGeneracionPlan('IA_RESPUESTA_INVALIDA', 502, 'Respuesta IA no válida')")
cuerpo = cuerpo.replace("cliente_id", "opts.clienteId").replace("faseBloqueObjetivoBody", "opts.faseBloqueObjetivo")
open('/tmp/nucleo_cuerpo.ts', 'w').write(cuerpo)
print(len(cuerpo.splitlines()), 'líneas movidas')
```
Run: `python3 scripts/_mover-nucleo.py` (en el repo) y revisar `/tmp/nucleo_cuerpo.ts`: no debe quedar ningún `NextResponse`, `req`, `user` ni `supabase.auth`. Las únicas referencias a `user.id` que existían estaban en el guardado (ya movidas en Task 2).

- [ ] **Step 2: Crear `lib/entrenos/generar-plan-ia.ts`** con esta estructura (el cuerpo es el de `/tmp/nucleo_cuerpo.ts`):

```ts
// lib/entrenos/generar-plan-ia.ts
// Genera (SIN guardar) la propuesta de plan de entreno de un cliente: contexto real, esqueleto del macrociclo, prompt y llamada a DeepSeek.
import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluarPerfilEntreno } from '@/lib/motor-entreno'
import { obtenerInformeVigente } from '@/lib/inteligencia-clinica'
import { siguienteFaseBloque, type FaseBloque } from '@/lib/entrenos/bloques'
import type { PerfilEntrenoCliente } from '@/types'
import { construirContextoRendimiento } from '@/lib/rendimiento/contexto'
import { validarSemanaCarrera, type ContextoValidacion, type ResultadoValidacion } from '@/lib/entrenos/validar-plan-carrera'
import { planificarMacrociclo, type ResultadoMacro } from '@/lib/entrenos/macrociclo'
import { construirEntradaMacro } from '@/lib/entrenos/macro-desde-cliente'
import { formatearRitmo } from '@/lib/entrenos/ritmos'

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions'
const MODEL = 'deepseek-chat'

export class ErrorGeneracionPlan extends Error {
  constructor(public codigo: 'CLIENTE_NO_ENCONTRADO' | 'IA_ERROR' | 'IA_RESPUESTA_INVALIDA', public estado: number, mensaje: string) { super(mensaje) }
}

export interface ResultadoGeneracionPlan {
  planIA: Record<string, unknown>
  nombrePlan: string
  duracionSemanas: number | null
  esHibrido: boolean
  faseBloque: FaseBloque | null
  modalidad: string
  validacion: ResultadoValidacion | null
  macrociclo: ResultadoMacro | null
  metadata: { rpe_promedio: number | null; ajuste_rpe: string; modalidad: string; recomendacion_motor: unknown; papers_usados: number; generado_con: string }
}

export async function generarPlanEntrenoIA(sb: SupabaseClient, opts: { clienteId: string; faseBloqueObjetivo?: FaseBloque }): Promise<ResultadoGeneracionPlan> {
  // ⬇ PEGAR AQUÍ, sin otros cambios, el cuerpo movido (/tmp/nucleo_cuerpo.ts).
  //   El último `return` sustituye al antiguo guardado + NextResponse:
  return {
    planIA,
    nombrePlan: esHibridoHyroxRunning ? `Híbrido Hyrox + Running — ${faseBloqueObjetivo}` : ((planIA.nombre_plan as string) ?? `Plan IA — ${modalidadFoco}`),
    duracionSemanas: esHibridoHyroxRunning ? 4 : ((planIA.duracion_semanas as number) ?? null),
    esHibrido: esHibridoHyroxRunning,
    faseBloque: esHibridoHyroxRunning ? faseBloqueObjetivo : null,
    modalidad: modalidadFoco,
    validacion,
    macrociclo,
    metadata: { rpe_promedio: rpePromedio, ajuste_rpe: ajusteRpe, modalidad: modalidadFoco, recomendacion_motor: recomendacion, papers_usados: papers.length, generado_con: MODEL },
  }
}
```
(Los nombres `MODEL`, `DEEPSEEK_BASE` y el uso de `DEEPSEEK_BASE` en el `fetch` ya coinciden con los de la ruta.)

- [ ] **Step 3: Reescribir la ruta como capa fina** — `app/api/entrenos/proponer-plan-ciencia/route.ts` completo:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { rateLimit } from '@/lib/rate-limit'
import type { FaseBloque } from '@/lib/entrenos/bloques'
import { ErrorGeneracionPlan, generarPlanEntrenoIA } from '@/lib/entrenos/generar-plan-ia'
import { guardarPlanEntreno, type SesionIA } from '@/lib/entrenos/guardar-plan'

export const maxDuration = 120

/**
 * Generador que guarda el plan al instante. Solo lo usa «revisar plan» (cliente nuevo, sin plan que proteger).
 * Para un cliente con plan en curso se usa /api/entrenos/planificar-ia, que entrega una propuesta aprobable.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createApiSupabase(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!rateLimit(`proponer-entreno:${user.id}`, 5, 60_000)) return NextResponse.json({ error: 'Demasiadas peticiones. Espera un momento.' }, { status: 429 })

    const { cliente_id, fase_bloque_objetivo } = await req.json() as { cliente_id?: string; fase_bloque_objetivo?: FaseBloque }
    if (!cliente_id) return NextResponse.json({ error: 'Falta cliente_id' }, { status: 400 })
    const FASES_VALIDAS: FaseBloque[] = ['Base', 'Fuerza', 'Resistencia', 'Deload']
    if (fase_bloque_objetivo && !FASES_VALIDAS.includes(fase_bloque_objetivo)) return NextResponse.json({ error: 'fase_bloque_objetivo inválida' }, { status: 400 })

    const sb = createServiceSupabase()
    // Antes solo se comprobaba que hubiera sesión: cualquier usuario podía generar planes de cualquier cliente.
    const autorizado = await autorizarCoachCliente(sb, { userId: user.id, clienteId: cliente_id })
    if (!autorizado.ok) return NextResponse.json({ error: autorizado.mensaje }, { status: autorizado.status })

    const r = await generarPlanEntrenoIA(sb, { clienteId: cliente_id, faseBloqueObjetivo: fase_bloque_objetivo })

    let planGuardadoId: string | null = null
    try {
      planGuardadoId = (await guardarPlanEntreno(sb, {
        coachId: user.id, clienteId: cliente_id, nombre: r.nombrePlan, descripcion: (r.planIA.fundamentacion as string) ?? null,
        duracionSemanas: r.duracionSemanas, faseBloque: r.faseBloque, sesiones: (r.planIA.sesiones as SesionIA[]) ?? [],
      })).planId
      await sb.from('registros_ia').insert({
        cliente_id, tipo: 'plan_entreno_ia',
        respuesta_json: { ...r.planIA, ...(r.validacion ? { _validacion: r.validacion } : {}), ...(r.macrociclo ? { _macrociclo: r.macrociclo } : {}) },
      })
    } catch (saveErr) {
      console.error('proponer-plan-ciencia save error:', saveErr)
    }

    return NextResponse.json({ plan: r.planIA, plan_id: planGuardadoId, validacion: r.validacion, macrociclo: r.macrociclo, metadata: r.metadata })
  } catch (err) {
    if (err instanceof ErrorGeneracionPlan) return NextResponse.json({ error: err.message }, { status: err.estado })
    console.error('proponer-plan-ciencia error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Regresión del núcleo contra datos reales (DeepSeek simulado)** — `scripts/regresion-generador-plan.ts`:

```ts
// Ejecuta generarPlanEntrenoIA con los datos REALES de un cliente (solo lectura) y DeepSeek simulado, y comprueba que el prompt conserva lo imprescindible.
// Uso: npx tsx scripts/regresion-generador-plan.ts <prefijo-id-cliente>
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
import { generarPlanEntrenoIA } from '../lib/entrenos/generar-plan-ia'

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: cli } = await db.from('clientes').select('id')
  const id = (cli ?? []).find(c => String(c.id).startsWith(process.argv[2] ?? '04cc53b3'))?.id
  assert.ok(id, 'cliente no encontrado')

  let prompt = ''
  const fetchReal = globalThis.fetch
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    prompt = String(init?.body ?? '')
    const plan = { nombre_plan: 'Plan simulado', duracion_semanas: 4, fundamentacion: 'simulado', sesiones: [
      { nombre: 'Carrera: Rodaje fácil', dia_semana: 'martes', ejercicios: [{ nombre: 'Rodaje continuo' }] },
      { nombre: 'Carrera: Tempo', dia_semana: 'jueves', ritmo_objetivo: '4:38/km', duracion_min: 35, ejercicios: [] },
      { nombre: 'Carrera: Tirada larga', dia_semana: 'sabado', duracion_min: 40, ejercicios: [] },
    ] }
    return { ok: true, text: async () => '', json: async () => ({ choices: [{ message: { content: JSON.stringify(plan) } }] }) } as unknown as Response
  }) as typeof fetch

  try {
    const r = await generarPlanEntrenoIA(db, { clienteId: id! })
    // El prompt conserva el esqueleto del motor, los datos reales y el protocolo del deporte.
    assert.ok(prompt.includes('ESQUELETO CALCULADO DEL MACROCICLO'), 'falta el esqueleto')
    assert.ok(prompt.includes('DATOS REALES DEL RELOJ'), 'faltan los datos del reloj')
    if (r.esHibrido) assert.ok(prompt.includes('EXACTAMENTE 6 SESIONES'), 'falta el protocolo híbrido')
    assert.ok(r.macrociclo && r.macrociclo.semanas.length > 0, 'sin macrociclo')
    assert.ok(r.macrociclo!.fundamentos.length > 0, 'sin fundamentos')
    assert.ok(r.validacion, 'sin validación del plan simulado')
    console.log('regresion-generador-plan OK ·', r.modalidad, '· fase', r.faseBloque ?? '-', '· semana 1:', JSON.stringify(r.macrociclo!.semanas[0].sesiones))
  } finally { globalThis.fetch = fetchReal }
}
main()
```
Run: `npx tsx scripts/regresion-generador-plan.ts 04cc53b3` y `npx tsc --noEmit --pretty false`
Expected: `regresion-generador-plan OK · hibrido · fase Base · semana 1: [...]` y `tsc` sin salida. (Si falla por una variable del cuerpo movido sin declarar, `tsc` la señala: declararla dentro de la función, sin cambiar lógica.)

- [ ] **Step 5: Borrar el script temporal y commit**

```bash
rm -f scripts/_mover-nucleo.py
git add lib/entrenos/generar-plan-ia.ts app/api/entrenos/proponer-plan-ciencia/route.ts scripts/regresion-generador-plan.ts
git commit -m "refactor: el generador de planes de entreno se extrae a generarPlanEntrenoIA (no guarda) y la ruta comprueba que el cliente es del coach

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Servicio `planificarConIA` y propuesta como tarea

**Files:**
- Modify: `lib/agentes/types.ts` (añadir `'plan_entreno_ia'` a `TipoTarea` y `'planificador'` a `TipoAgente`)
- Create: `lib/entrenos/planificar-con-ia.ts`
- Test: `scripts/planificar-con-ia.test.ts`

**Interfaces:**
- Consumes: `decidirModoPlanificacion`, `generarPlanEntrenoIA`, `ErrorGeneracionPlan`, `ejecutarAnalisisRendimiento(clienteId, { forzar: true }): Promise<{ ok: boolean; tareaId?: string; motivo?: string }>` de `@/lib/agentes/analisis-rendimiento`.
- Produces:
```ts
export type ResultadoPlanificacion =
  | { ok: true; modo: ModoPlanificacion; tareaId: string; resumen: string }
  | { ok: false; modo: ModoPlanificacion | null; codigo: 'YA_HAY_PROPUESTA' | 'SIN_DATOS' | 'IA_ERROR' | 'CLIENTE_NO_ENCONTRADO'; motivo: string }
export function estadoHttpDe(r: Extract<ResultadoPlanificacion, { ok: false }>): number   // 409 | 422 | 502 | 404
export function construirResumenPropuesta(r: ResultadoGeneracionPlan, modo: ModoPlanificacion): string
export function construirPayloadPropuesta(r: ResultadoGeneracionPlan, modo: ModoPlanificacion): PayloadPlanEntrenoIA
export interface PayloadPlanEntrenoIA { modo: ModoPlanificacion; fase_bloque: string | null; nombre_plan: string; duracion_semanas: number | null; es_hibrido: boolean; plan: Record<string, unknown>; macrociclo: ResultadoMacro | null; validacion: ResultadoValidacion | null; generado_en: string }
export async function leerModoPlanificacion(sb: SupabaseClient, clienteId: string): Promise<DecisionModo & { hayPropuestaPendiente: boolean }>
export async function planificarConIA(sb: SupabaseClient, input: { clienteId: string }): Promise<ResultadoPlanificacion>
```

- [ ] **Step 1: Tipos** — en `lib/agentes/types.ts` añadir `| 'planificador'` a `TipoAgente` y `| 'plan_entreno_ia'` a `TipoTarea`. Run `npx tsc --noEmit --pretty false`: si algún `Record<TipoAgente, …>` o `Record<TipoTarea, …>` falla, añadir la entrada (etiqueta «Planificador» / «Plan de entreno IA»).

- [ ] **Step 2: Test que falla** — `scripts/planificar-con-ia.test.ts`

```ts
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { construirPayloadPropuesta, construirResumenPropuesta, estadoHttpDe, leerModoPlanificacion, planificarConIA } from '../lib/entrenos/planificar-con-ia'
import type { ResultadoGeneracionPlan } from '../lib/entrenos/generar-plan-ia'

const generado = (over: Partial<ResultadoGeneracionPlan> = {}): ResultadoGeneracionPlan => ({
  planIA: { nombre_plan: 'Plan X', fundamentacion: 'porque', sesiones: [
    { nombre: 'Híbrida A', ejercicios: [] }, { nombre: 'Carrera: Rodaje', ejercicios: [] }, { nombre: 'Carrera: Tirada', ejercicios: [] },
  ] },
  nombrePlan: 'Híbrido Hyrox + Running — Base', duracionSemanas: 4, esHibrido: true, faseBloque: 'Base', modalidad: 'hibrido',
  validacion: { hallazgos: [{ nivel: 'aviso', codigo: 'x', texto: 'y' }, { nivel: 'aviso', codigo: 'z', texto: 'w' }], resumen: { carrerasSemana: 3, minutosCarrera: 100, sesionesCalidad: 0, tiradaLargaMin: 40, tiradaLargaPct: 40 } },
  macrociclo: { semanasHastaCarrera: null, semanas: [{ n: 1, lunes: '2026-10-12', fase: 'base', descarga: false, minutos: 100, salidas: 3, tiradaMin: 40, pctSuave: 95, fuerza: 3, sesiones: [], notas: [] }], ritmos: null, parametros: { nivel: 'avanzado', salidasSemana: 3, volumenBase: 89, volumenPico: 158, crecimientoSemanal: 0.1, descargaCada: 4 }, avisos: [], datosFaltantes: [], supuestos: [], fundamentos: [] },
  metadata: { rpe_promedio: null, ajuste_rpe: '', modalidad: 'hibrido', recomendacion_motor: null, papers_usados: 0, generado_con: 'deepseek-chat' },
  ...over,
})

// Resumen y payload
assert.equal(construirResumenPropuesta(generado(), 'siguiente_bloque'), 'Bloque Base · 3 sesiones (100 min de carrera/semana) · 2 avisos del validador')
assert.equal(construirResumenPropuesta(generado({ validacion: null, faseBloque: null, esHibrido: false, macrociclo: null }), 'crear'), 'Plan nuevo · 3 sesiones')
const p = construirPayloadPropuesta(generado(), 'crear')
assert.equal(p.modo, 'crear'); assert.equal(p.fase_bloque, 'Base'); assert.equal(p.duracion_semanas, 4); assert.equal(p.es_hibrido, true)
assert.ok(Array.isArray((p.plan as { sesiones: unknown[] }).sesiones)); assert.ok(p.generado_en.length > 10)

// Códigos HTTP
assert.equal(estadoHttpDe({ ok: false, modo: 'crear', codigo: 'YA_HAY_PROPUESTA', motivo: '' }), 409)
assert.equal(estadoHttpDe({ ok: false, modo: 'ajustar', codigo: 'SIN_DATOS', motivo: '' }), 422)
assert.equal(estadoHttpDe({ ok: false, modo: 'crear', codigo: 'IA_ERROR', motivo: '' }), 502)
assert.equal(estadoHttpDe({ ok: false, modo: null, codigo: 'CLIENTE_NO_ENCONTRADO', motivo: '' }), 404)

// Cliente falso: tablas → filas; registra inserts
function fakeDb(tablas: Record<string, unknown[]>) {
  const inserts: { tabla: string; payload: unknown }[] = []
  const from = (tabla: string) => {
    let esInsert = false
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit']) q[m] = () => q
    q.insert = (payload: unknown) => { esInsert = true; inserts.push({ tabla, payload }); return q }
    const filas = () => (esInsert ? [{ id: 'tarea-nueva' }] : tablas[tabla] ?? [])
    q.single = () => Promise.resolve({ data: filas()[0] ?? null, error: null })
    q.maybeSingle = () => Promise.resolve({ data: filas()[0] ?? null, error: null })
    q.then = (res: (v: unknown) => void) => res({ data: filas(), error: null })
    return q
  }
  return { db: { from } as unknown as SupabaseClient, inserts }
}

async function main() {
  // Modo: sin plan → crear; con propuesta pendiente se refleja
  const sinPlan = await leerModoPlanificacion(fakeDb({ planes_entrenamiento: [], agente_tareas: [] }).db, 'c1')
  assert.equal(sinPlan.modo, 'crear'); assert.equal(sinPlan.hayPropuestaPendiente, false)
  const conPend = await leerModoPlanificacion(fakeDb({ planes_entrenamiento: [], agente_tareas: [{ id: 't1' }] }).db, 'c1')
  assert.equal(conPend.hayPropuestaPendiente, true)

  // Dos pulsaciones: si ya hay una propuesta pendiente NO se genera otra (ni se llama a la IA)
  const dup = fakeDb({ planes_entrenamiento: [], agente_tareas: [{ id: 't1' }] })
  const r = await planificarConIA(dup.db, { clienteId: 'c1' })
  assert.equal(r.ok, false)
  if (!r.ok) { assert.equal(r.codigo, 'YA_HAY_PROPUESTA'); assert.equal(estadoHttpDe(r), 409) }
  assert.equal(dup.inserts.length, 0)
  console.log('planificar-con-ia.test OK')
}
main()
```

- [ ] **Step 3: Ejecutar y ver que falla**

Run: `npx tsx scripts/planificar-con-ia.test.ts`
Expected: FAIL (módulo no encontrado).

- [ ] **Step 4: Implementar** — `lib/entrenos/planificar-con-ia.ts`

```ts
// lib/entrenos/planificar-con-ia.ts
// «Planificar con IA»: decide el modo, genera la propuesta y la deja como tarea pendiente (nunca cambia el plan activo).
import type { SupabaseClient } from '@supabase/supabase-js'
import { decidirModoPlanificacion, type DecisionModo, type ModoPlanificacion } from './planificar-modo'
import { ErrorGeneracionPlan, generarPlanEntrenoIA, type ResultadoGeneracionPlan } from './generar-plan-ia'
import type { ResultadoMacro } from './macrociclo'
import type { ResultadoValidacion } from './validar-plan-carrera'
import { ejecutarAnalisisRendimiento } from '@/lib/agentes/analisis-rendimiento'

export interface PayloadPlanEntrenoIA {
  modo: ModoPlanificacion
  fase_bloque: string | null
  nombre_plan: string
  duracion_semanas: number | null
  es_hibrido: boolean
  plan: Record<string, unknown>
  macrociclo: ResultadoMacro | null
  validacion: ResultadoValidacion | null
  generado_en: string
}

export type ResultadoPlanificacion =
  | { ok: true; modo: ModoPlanificacion; tareaId: string; resumen: string }
  | { ok: false; modo: ModoPlanificacion | null; codigo: 'YA_HAY_PROPUESTA' | 'SIN_DATOS' | 'IA_ERROR' | 'CLIENTE_NO_ENCONTRADO'; motivo: string }

export function estadoHttpDe(r: Extract<ResultadoPlanificacion, { ok: false }>): number {
  return r.codigo === 'YA_HAY_PROPUESTA' ? 409 : r.codigo === 'SIN_DATOS' ? 422 : r.codigo === 'CLIENTE_NO_ENCONTRADO' ? 404 : 502
}

export function construirResumenPropuesta(r: ResultadoGeneracionPlan, modo: ModoPlanificacion): string {
  const sesiones = ((r.planIA.sesiones as unknown[]) ?? []).length
  const partes = [r.faseBloque ? `Bloque ${r.faseBloque}` : modo === 'siguiente_bloque' ? 'Siguiente bloque' : 'Plan nuevo']
  const min = r.macrociclo?.semanas[0]?.minutos
  partes.push(min ? `${sesiones} sesiones (${min} min de carrera/semana)` : `${sesiones} sesiones`)
  const avisos = r.validacion?.hallazgos.length ?? 0
  if (avisos) partes.push(`${avisos} ${avisos === 1 ? 'aviso' : 'avisos'} del validador`)
  return partes.join(' · ')
}

export function construirPayloadPropuesta(r: ResultadoGeneracionPlan, modo: ModoPlanificacion): PayloadPlanEntrenoIA {
  return {
    modo, fase_bloque: r.faseBloque, nombre_plan: r.nombrePlan, duracion_semanas: r.duracionSemanas, es_hibrido: r.esHibrido,
    plan: r.planIA, macrociclo: r.macrociclo, validacion: r.validacion, generado_en: new Date().toISOString(),
  }
}

async function hayPropuestaPendiente(sb: SupabaseClient, clienteId: string): Promise<boolean> {
  const { data } = await sb.from('agente_tareas').select('id').eq('cliente_id', clienteId).eq('tipo', 'plan_entreno_ia').in('estado', ['pendiente', 'en_revision']).limit(1)
  return (data ?? []).length > 0
}

export async function leerModoPlanificacion(sb: SupabaseClient, clienteId: string): Promise<DecisionModo & { hayPropuestaPendiente: boolean }> {
  const { data: plan } = await sb.from('planes_entrenamiento').select('id,created_at,duracion_semanas').eq('cliente_id', clienteId).eq('activo', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const decision = decidirModoPlanificacion(plan ? { created_at: plan.created_at as string, duracion_semanas: (plan.duracion_semanas as number | null) ?? null } : null)
  return { ...decision, hayPropuestaPendiente: await hayPropuestaPendiente(sb, clienteId) }
}

export async function planificarConIA(sb: SupabaseClient, input: { clienteId: string }): Promise<ResultadoPlanificacion> {
  const modoActual = await leerModoPlanificacion(sb, input.clienteId)
  if (modoActual.hayPropuestaPendiente) {
    return { ok: false, modo: modoActual.modo, codigo: 'YA_HAY_PROPUESTA', motivo: 'Ya hay una propuesta de plan pendiente de aprobar para este cliente.' }
  }

  // A mitad de bloque no se sustituye nada: se pide el análisis de rendimiento con los datos reales (ya crea su propia tarea).
  if (modoActual.modo === 'ajustar') {
    const a = await ejecutarAnalisisRendimiento(input.clienteId, { forzar: true })
    if (!a.ok || !a.tareaId) return { ok: false, modo: 'ajustar', codigo: 'SIN_DATOS', motivo: a.motivo ?? 'No hay datos suficientes del reloj para proponer ajustes. Sigue el plan actual unas semanas más.' }
    return { ok: true, modo: 'ajustar', tareaId: a.tareaId, resumen: 'Análisis de rendimiento generado: revisa los ajustes propuestos.' }
  }

  try {
    const r = await generarPlanEntrenoIA(sb, { clienteId: input.clienteId })
    const resumen = construirResumenPropuesta(r, modoActual.modo)
    const { data: tarea, error } = await sb.from('agente_tareas').insert({
      tipo: 'plan_entreno_ia', cliente_id: input.clienteId, agente: 'planificador', estado: 'pendiente', prioridad: 2,
      payload: construirPayloadPropuesta(r, modoActual.modo),
      propuesta: resumen,
      razonamiento: typeof r.planIA.fundamentacion === 'string' ? r.planIA.fundamentacion : null,
      fuentes: [],
    }).select('id').single()
    if (error || !tarea) return { ok: false, modo: modoActual.modo, codigo: 'IA_ERROR', motivo: 'No se pudo guardar la propuesta.' }
    return { ok: true, modo: modoActual.modo, tareaId: tarea.id as string, resumen }
  } catch (e) {
    if (e instanceof ErrorGeneracionPlan) return { ok: false, modo: modoActual.modo, codigo: e.codigo === 'CLIENTE_NO_ENCONTRADO' ? 'CLIENTE_NO_ENCONTRADO' : 'IA_ERROR', motivo: e.message }
    console.error('planificarConIA:', e instanceof Error ? e.message : e)
    return { ok: false, modo: modoActual.modo, codigo: 'IA_ERROR', motivo: 'No se pudo generar la propuesta.' }
  }
}
```

- [ ] **Step 5: Ejecutar tests y tipos**

Run: `npx tsx scripts/planificar-con-ia.test.ts && npx tsc --noEmit --pretty false`
Expected: `planificar-con-ia.test OK`, sin errores de tipos.

- [ ] **Step 6: Commit**

```bash
git add lib/agentes/types.ts lib/entrenos/planificar-con-ia.ts scripts/planificar-con-ia.test.ts
git commit -m "feat: planificarConIA crea una propuesta aprobable (tarea plan_entreno_ia) o pide el análisis de rendimiento a mitad de bloque

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Aprobar la propuesta crea el plan (`aplicarPlanEntrenoIA`)

**Files:**
- Create: `lib/entrenos/aplicar-plan-ia.ts`
- Modify: `lib/agentes/aplicar.ts` (nuevo `case 'plan_entreno_ia'`)
- Test: `scripts/aplicar-plan-ia.test.ts`

**Interfaces:**
- Consumes: `guardarPlanEntreno`, `PayloadPlanEntrenoIA`, `AgenteTarea`, `AplicarTareaResult` (de `lib/agentes/aplicar.ts`; si no está exportado, exportarlo).
- Produces: `validarPayloadPlanEntrenoIA(p: unknown): { ok: true; payload: PayloadPlanEntrenoIA } | { ok: false; motivo: string }`; `aplicarPlanEntrenoIA(db: SupabaseClient, tarea: AgenteTarea): Promise<AplicarTareaResult>`.

- [ ] **Step 1: Test que falla** — `scripts/aplicar-plan-ia.test.ts`

```ts
import assert from 'node:assert/strict'
import { validarPayloadPlanEntrenoIA } from '../lib/entrenos/aplicar-plan-ia'

const base = { modo: 'crear', fase_bloque: 'Base', nombre_plan: 'Plan', duracion_semanas: 4, es_hibrido: true, macrociclo: null, validacion: null, generado_en: '2026-10-10T10:00:00Z' }
const sesion = { nombre: 'Rodaje', dia_semana: 'martes', ejercicios: [{ nombre: 'Rodaje continuo' }] }

const ok = validarPayloadPlanEntrenoIA({ ...base, plan: { sesiones: [sesion] } })
assert.equal(ok.ok, true)

// Payloads inválidos o manipulados: nada se crea
for (const [nombre, p] of Object.entries({
  'no es objeto': 'hola', 'null': null,
  'sin plan': { ...base },
  'plan no objeto': { ...base, plan: 'x' },
  'sin sesiones': { ...base, plan: { sesiones: [] } },
  'sesiones no es lista': { ...base, plan: { sesiones: 'x' } },
  'demasiadas sesiones': { ...base, plan: { sesiones: Array.from({ length: 15 }, () => sesion) } },
  'sesión sin nombre': { ...base, plan: { sesiones: [{ ejercicios: [] }] } },
  'modo raro': { ...base, modo: 'borrar_todo', plan: { sesiones: [sesion] } },
  'duración absurda': { ...base, duracion_semanas: 500, plan: { sesiones: [sesion] } },
})) {
  const r = validarPayloadPlanEntrenoIA(p)
  assert.equal(r.ok, false, nombre)
}
console.log('aplicar-plan-ia.test OK')
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx tsx scripts/aplicar-plan-ia.test.ts`
Expected: FAIL (módulo no encontrado).

- [ ] **Step 3: Implementar** — `lib/entrenos/aplicar-plan-ia.ts`

```ts
// lib/entrenos/aplicar-plan-ia.ts
// Aprobación de una propuesta `plan_entreno_ia`: crea el plan real (sustituyendo al activo solo cuando está completo).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgenteTarea } from '@/lib/agentes/types'
import type { AplicarTareaResult } from '@/lib/agentes/aplicar'
import { guardarPlanEntreno, type SesionIA } from './guardar-plan'
import type { PayloadPlanEntrenoIA } from './planificar-con-ia'

const MODOS = ['crear', 'siguiente_bloque']
const MAX_SESIONES = 14

export function validarPayloadPlanEntrenoIA(p: unknown): { ok: true; payload: PayloadPlanEntrenoIA } | { ok: false; motivo: string } {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, motivo: 'El payload debe ser un objeto' }
  const x = p as Record<string, unknown>
  if (typeof x.modo !== 'string' || !MODOS.includes(x.modo)) return { ok: false, motivo: 'Modo de propuesta no válido' }
  if (!x.plan || typeof x.plan !== 'object' || Array.isArray(x.plan)) return { ok: false, motivo: 'La propuesta no contiene un plan' }
  const sesiones = (x.plan as { sesiones?: unknown }).sesiones
  if (!Array.isArray(sesiones) || sesiones.length === 0) return { ok: false, motivo: 'El plan no tiene sesiones' }
  if (sesiones.length > MAX_SESIONES) return { ok: false, motivo: `El plan tiene demasiadas sesiones (máximo ${MAX_SESIONES})` }
  if (sesiones.some(s => !s || typeof s !== 'object' || typeof (s as { nombre?: unknown }).nombre !== 'string' || !(s as { nombre: string }).nombre.trim())) return { ok: false, motivo: 'Hay sesiones sin nombre' }
  if (x.duracion_semanas != null && (typeof x.duracion_semanas !== 'number' || x.duracion_semanas < 1 || x.duracion_semanas > 52)) return { ok: false, motivo: 'Duración del plan no válida' }
  return { ok: true, payload: x as unknown as PayloadPlanEntrenoIA }
}

export async function aplicarPlanEntrenoIA(db: SupabaseClient, tarea: AgenteTarea): Promise<AplicarTareaResult> {
  if (!tarea.cliente_id) return { ok: false, codigo: 'NO_CLIENT', mensaje: 'Sin cliente_id' }
  if (tarea.aplicado_at) return { ok: true, codigo: 'APPLIED', mensaje: 'La propuesta ya estaba aplicada' }
  const v = validarPayloadPlanEntrenoIA(tarea.payload)
  if (!v.ok) return { ok: false, codigo: 'INVALID_PAYLOAD', mensaje: v.motivo }

  const { data: cliente } = await db.from('clientes').select('coach_id').eq('id', tarea.cliente_id).maybeSingle()
  if (!cliente?.coach_id) return { ok: false, codigo: 'NO_CLIENT', mensaje: 'Cliente no encontrado' }

  const p = v.payload
  try {
    const g = await guardarPlanEntreno(db, {
      coachId: cliente.coach_id as string, clienteId: tarea.cliente_id, nombre: p.nombre_plan,
      descripcion: typeof p.plan.fundamentacion === 'string' ? p.plan.fundamentacion : null,
      duracionSemanas: p.duracion_semanas, faseBloque: p.fase_bloque, sesiones: p.plan.sesiones as SesionIA[],
    })
    // Historial de versiones (pantalla «revisar plan»).
    await db.from('registros_ia').insert({
      cliente_id: tarea.cliente_id, tipo: 'plan_entreno_ia',
      respuesta_json: { ...p.plan, ...(p.validacion ? { _validacion: p.validacion } : {}), ...(p.macrociclo ? { _macrociclo: p.macrociclo } : {}) },
    })
    const omitidos = g.ejerciciosOmitidos.length ? ` · sin ejercicio equivalente en la biblioteca, omitidos: ${g.ejerciciosOmitidos.join(', ')}` : ''
    return { ok: true, codigo: 'APPLIED', mensaje: `Plan creado: ${g.sesiones} sesiones, ${g.ejerciciosVinculados} ejercicios vinculados${omitidos}` }
  } catch {
    return { ok: false, codigo: 'DB_ERROR', mensaje: 'No se pudo crear el plan; el plan anterior sigue activo.' }
  }
}
```

- [ ] **Step 4: Enchufar en `aplicarTarea`** — en `lib/agentes/aplicar.ts` añadir `import { aplicarPlanEntrenoIA } from '@/lib/entrenos/aplicar-plan-ia'` y, antes de `default:`:

```ts
    case 'plan_entreno_ia':
      return aplicarPlanEntrenoIA(db, tarea)
```
Si `AplicarTareaResult` no está exportado, añadir `export` a su declaración.

- [ ] **Step 5: Comprobar que `agente_tareas.tipo` acepta el tipo nuevo** (sin migración). Script de un solo uso:

```bash
npx tsx -e "
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)\$/); if (m) process.env[m[1]] = m[2].replace(/^[\"']|[\"']\$/g,'') }
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const { data: c } = await db.from('clientes').select('id').limit(1)
const { data, error } = await db.from('agente_tareas').insert({ tipo: 'plan_entreno_ia', cliente_id: c![0].id, agente: 'planificador', estado: 'pendiente', prioridad: 9, payload: {}, propuesta: 'prueba', fuentes: [] }).select('id').single()
console.log(error ? 'RECHAZADO: ' + error.message : 'aceptado ' + data!.id)
if (data) await db.from('agente_tareas').delete().eq('id', data.id)
"
```
Expected: `aceptado <uuid>` (y la fila de prueba queda borrada). Si responde `RECHAZADO` por un CHECK de `tipo` o `agente`, **parar**: hay que decidir con Carlos una migración mínima (ampliar el CHECK); no tocar producción sin su visto bueno.

- [ ] **Step 6: Ejecutar tests y tipos**

Run: `npx tsx scripts/aplicar-plan-ia.test.ts && npx tsc --noEmit --pretty false`
Expected: `aplicar-plan-ia.test OK`, sin errores de tipos.

- [ ] **Step 7: Commit**

```bash
git add lib/entrenos/aplicar-plan-ia.ts lib/agentes/aplicar.ts scripts/aplicar-plan-ia.test.ts
git commit -m "feat: aprobar una propuesta plan_entreno_ia crea el plan real con guardado seguro

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Ruta `/api/entrenos/planificar-ia`

**Files:**
- Create: `app/api/entrenos/planificar-ia/route.ts`
- Test: `scripts/planificar-ia-ruta.test.ts` (parte pura: validación del cuerpo)
- Modify: `lib/entrenos/planificar-con-ia.ts` (añadir `validarCuerpoPlanificar`)

**Interfaces:**
- Consumes: `planificarConIA`, `leerModoPlanificacion`, `estadoHttpDe`, `autorizarCoachCliente(db, { userId, clienteId })` → `{ ok: true } | { ok: false; status: number; mensaje: string }`, `rateLimit(clave, max, ventanaMs): boolean`.
- Produces: `GET /api/entrenos/planificar-ia?cliente_id=…` → `{ modo, etiqueta, diasRestantes, hayPropuestaPendiente }`; `POST` `{ cliente_id }` → `{ ok: true, modo, tarea_id, resumen }` o `{ error, codigo }` con el estado de `estadoHttpDe`. `validarCuerpoPlanificar(b: unknown): { ok: true; clienteId: string } | { ok: false; motivo: string }`.

- [ ] **Step 1: Test que falla** — `scripts/planificar-ia-ruta.test.ts`

```ts
import assert from 'node:assert/strict'
import { validarCuerpoPlanificar } from '../lib/entrenos/planificar-con-ia'

assert.deepEqual(validarCuerpoPlanificar({ cliente_id: '04cc53b3-1111-2222-3333-444455556666' }), { ok: true, clienteId: '04cc53b3-1111-2222-3333-444455556666' })
for (const malo of [null, 'x', {}, { cliente_id: 5 }, { cliente_id: '' }, { cliente_id: 'no-es-uuid' }, { cliente_id: "'; drop table clientes;--" }]) {
  assert.equal(validarCuerpoPlanificar(malo).ok, false, JSON.stringify(malo))
}
console.log('planificar-ia-ruta.test OK')
```

- [ ] **Step 2: Ejecutar y ver que falla**, luego **añadir a `lib/entrenos/planificar-con-ia.ts`**:

```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validarCuerpoPlanificar(b: unknown): { ok: true; clienteId: string } | { ok: false; motivo: string } {
  const id = b && typeof b === 'object' ? (b as { cliente_id?: unknown }).cliente_id : undefined
  if (typeof id !== 'string' || !UUID.test(id)) return { ok: false, motivo: 'cliente_id no válido' }
  return { ok: true, clienteId: id }
}
```
Run: `npx tsx scripts/planificar-ia-ruta.test.ts` → `planificar-ia-ruta.test OK`.

- [ ] **Step 3: Crear la ruta** — `app/api/entrenos/planificar-ia/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { rateLimit } from '@/lib/rate-limit'
import { estadoHttpDe, leerModoPlanificacion, planificarConIA, validarCuerpoPlanificar } from '@/lib/entrenos/planificar-con-ia'

export const maxDuration = 120

async function autorizar(req: NextRequest, clienteId: string) {
  const { data: { user } } = await createApiSupabase(req).auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const db = createServiceSupabase()
  const a = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!a.ok) return { error: NextResponse.json({ error: a.mensaje }, { status: a.status }) }
  return { db, userId: user.id }
}

/** Qué hará el botón para este cliente (texto bajo el botón). */
export async function GET(req: NextRequest) {
  const v = validarCuerpoPlanificar({ cliente_id: new URL(req.url).searchParams.get('cliente_id') })
  if (!v.ok) return NextResponse.json({ error: v.motivo }, { status: 400 })
  const r = await autorizar(req, v.clienteId)
  if (r.error) return r.error
  const m = await leerModoPlanificacion(r.db, v.clienteId)
  return NextResponse.json({ modo: m.modo, etiqueta: m.etiqueta, diasRestantes: m.diasRestantes, hayPropuestaPendiente: m.hayPropuestaPendiente })
}

/** Genera la propuesta (nunca cambia el plan activo). */
export async function POST(req: NextRequest) {
  try {
    const cuerpo = await req.json().catch(() => null)
    const v = validarCuerpoPlanificar(cuerpo)
    if (!v.ok) return NextResponse.json({ error: v.motivo }, { status: 400 })
    const r = await autorizar(req, v.clienteId)
    if (r.error) return r.error
    if (!rateLimit(`planificar-ia:${r.userId}`, 5, 60_000)) return NextResponse.json({ error: 'Demasiadas peticiones. Espera un momento.' }, { status: 429 })

    const res = await planificarConIA(r.db, { clienteId: v.clienteId })
    if (!res.ok) return NextResponse.json({ error: res.motivo, codigo: res.codigo, modo: res.modo }, { status: estadoHttpDe(res) })
    return NextResponse.json({ ok: true, modo: res.modo, tarea_id: res.tareaId, resumen: res.resumen })
  } catch (err) {
    console.error('planificar-ia error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Verificar seguridad en local** (el servidor de desarrollo necesita `.env.local`):

Run: `npm run dev` (en segundo plano) y, con otra terminal:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/entrenos/planificar-ia?cliente_id=04cc53b3-0000-0000-0000-000000000000"
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'content-type: application/json' -d '{"cliente_id":"x"}' http://localhost:3000/api/entrenos/planificar-ia
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'content-type: application/json' -d '{"cliente_id":"04cc53b3-0000-0000-0000-000000000000"}' http://localhost:3000/api/entrenos/proponer-plan-ciencia
```
Expected: `401`, `400`, `401` (sin sesión). La comprobación 403 para cliente ajeno la cubre `autorizarCoachCliente` (ya probado en el repo) y se confirma en la verificación en vivo (Task 8).

- [ ] **Step 5: Commit**

```bash
git add app/api/entrenos/planificar-ia/route.ts lib/entrenos/planificar-con-ia.ts scripts/planificar-ia-ruta.test.ts
git commit -m "feat: ruta /api/entrenos/planificar-ia (GET modo, POST propuesta) con autorización de coach y límite de uso

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Interfaz — botón único, propuesta en decisiones y limpieza

**Files:**
- Create: `components/clientes/PlanificarConIA.tsx`, `components/clientes/PropuestaPlanEntreno.tsx`
- Modify: `components/clientes/DecisionesIACliente.tsx`, `app/clientes/[id]/page.tsx` (bloque «Plan activo», líneas ~950-962 y ~986-990)
- Delete: `components/clientes/GenerarBloqueHibridoPanel.tsx` (si nada más lo importa)

**Interfaces:**
- Consumes: `GET/POST /api/entrenos/planificar-ia`; evento de ventana `decisiones-ia:recargar`.
- Produces: `<PlanificarConIA clienteId />`; `<PropuestaPlanEntreno payload />`.

- [ ] **Step 1: `PlanificarConIA.tsx`** (solo estructura; clases ya existentes)

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

interface Estado { etiqueta: string; hayPropuestaPendiente: boolean }

export default function PlanificarConIA({ clienteId }: { clienteId: string }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const leer = useCallback(() => {
    fetch(`/api/entrenos/planificar-ia?cliente_id=${clienteId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setEstado(d ? { etiqueta: d.etiqueta, hayPropuestaPendiente: d.hayPropuestaPendiente } : null))
      .catch(() => setEstado(null))
  }, [clienteId])

  useEffect(() => { leer() }, [leer])

  async function planificar() {
    setCargando(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/entrenos/planificar-ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente_id: clienteId }) })
      const d = await res.json().catch(() => null)
      if (!res.ok) { setMensaje({ tipo: 'error', texto: d?.error ?? 'No se pudo planificar.' }); return }
      setMensaje({ tipo: 'ok', texto: `${d.resumen} — está en «Decisiones de IA pendientes».` })
      window.dispatchEvent(new CustomEvent('decisiones-ia:recargar'))
      leer()
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo planificar. Inténtalo de nuevo.' })
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button className="btn-primary btn-sm" onClick={planificar} disabled={cargando || estado?.hayPropuestaPendiente}>
        {cargando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Planificar con IA
      </button>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {estado?.hayPropuestaPendiente ? 'Hay una propuesta pendiente de aprobar abajo.' : estado?.etiqueta ?? ''}
      </span>
      {mensaje && <span className="text-xs" role="status" style={{ color: mensaje.tipo === 'error' ? 'var(--semantic-danger-text, var(--text))' : 'var(--text)' }}>{mensaje.texto}</span>}
    </div>
  )
}
```

- [ ] **Step 2: `PropuestaPlanEntreno.tsx`** (detalle de la propuesta, sin estilos nuevos)

```tsx
'use client'

import type { PayloadPlanEntrenoIA } from '@/lib/entrenos/planificar-con-ia'

const TIPO_FUNDAMENTO: Record<string, string> = { estudio: 'Estudio', libro: 'Libro de entrenador', criterio: 'Criterio' }

export default function PropuestaPlanEntreno({ payload }: { payload: PayloadPlanEntrenoIA }) {
  const sesiones = ((payload.plan?.sesiones as { nombre?: string; dia_semana?: string | null }[]) ?? [])
  const semana1 = payload.macrociclo?.semanas?.[0]
  const hallazgos = payload.validacion?.hallazgos ?? []
  const fundamentos = payload.macrociclo?.fundamentos ?? []
  return (
    <div className="space-y-3 text-sm" style={{ color: 'var(--text)' }}>
      <p><strong>{payload.nombre_plan}</strong>{payload.duracion_semanas ? ` · ${payload.duracion_semanas} semanas` : ''}</p>
      {semana1 && <p style={{ color: 'var(--text-muted)' }}>Esqueleto del motor, semana 1 ({semana1.fase}): {semana1.salidas} sesiones de carrera, {semana1.minutos} min, tirada de {semana1.tiradaMin} min.</p>}
      <ul className="space-y-1">{sesiones.map((s, i) => <li key={i}>{s.dia_semana ? `${s.dia_semana} · ` : ''}{s.nombre}</li>)}</ul>
      {hallazgos.length > 0 && (
        <div><p className="font-semibold">Avisos del validador</p><ul className="space-y-1">{hallazgos.map((h, i) => <li key={i}>{h.nivel === 'error' ? '⛔' : '⚠️'} {h.texto}</li>)}</ul></div>
      )}
      {payload.macrociclo?.datosFaltantes?.length ? <p style={{ color: 'var(--text-muted)' }}>Datos que faltan: {payload.macrociclo.datosFaltantes.join('; ')}.</p> : null}
      {fundamentos.length > 0 && (
        <div><p className="font-semibold">De dónde sale cada regla</p><ul className="space-y-1">{fundamentos.map((f, i) => <li key={i}><span className="font-medium">[{TIPO_FUNDAMENTO[f.tipo] ?? f.tipo}]</span> {f.regla} — <span style={{ color: 'var(--text-muted)' }}>{f.fuente}</span></li>)}</ul></div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: `DecisionesIACliente.tsx`** — (a) añadir `'plan_entreno_ia'` a `TRAINING_TYPES` y `plan_entreno_ia: 'Plan de entreno'` a `TIPO_LABEL`; (b) ampliar `Tarea.payload` a `{ accion_aplicable?: string } & Partial<PayloadPlanEntrenoIA>`; (c) en `esTareaEntrenoDelCliente`, `plan_entreno_ia` cuenta si `estado` es pendiente o en revisión (ya lo cubre la regla general); (d) factorizar la carga en `cargar()` y recargar también con el evento:

```tsx
  useEffect(() => {
    let cancelado = false
    const cargar = () => fetch('/api/agentes/tareas?limite=100')
      .then(r => r.json())
      .then(data => { if (!cancelado) setTareas(((data.tareas ?? []) as Tarea[]).filter(t => esTareaEntrenoDelCliente(t, clienteId))) })
      .catch(() => { if (!cancelado) setTareas([]) })
    cargar()
    window.addEventListener('decisiones-ia:recargar', cargar)
    return () => { cancelado = true; window.removeEventListener('decisiones-ia:recargar', cargar) }
  }, [clienteId])
```
(e) al desplegar una tarea `plan_entreno_ia`, mostrar `<PropuestaPlanEntreno payload={tarea.payload as PayloadPlanEntrenoIA} />` además del razonamiento; (f) tras aprobar una `plan_entreno_ia`, disparar `window.dispatchEvent(new CustomEvent('plan-entreno:actualizado'))` y que la ficha recargue el plan activo (ver Step 4).

- [ ] **Step 4: Ficha `app/clientes/[id]/page.tsx`** — en el bloque «Plan activo» sustituir el grupo de botones por:

```tsx
                  <div className="flex flex-wrap items-start gap-3">
                    <PlanificarConIA clienteId={id as string} />
                    <details className="relative">
                      <summary className="btn-secondary btn-sm cursor-pointer list-none">Más opciones</summary>
                      <div className="absolute right-0 mt-1 z-10 flex flex-col gap-1 p-2 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)', minWidth: 180 }}>
                        {entrenoActivo && <Link href={`/entrenos/${entrenoActivo.id}?returnTo=${volverAqui}`} className="btn-secondary btn-sm">Abrir plan <ExternalLink size={12} /></Link>}
                        <button className="btn-secondary btn-sm" onClick={() => setShowSelectorPlantilla(true)}><CopyPlus size={13} /> Plantilla</button>
                        <Link href={`/entrenos/nueva?cliente=${id}`} className="btn-secondary btn-sm"><CopyPlus size={13} /> Nuevo plan</Link>
                      </div>
                    </details>
                  </div>
```
Importar `PlanificarConIA` (dinámico como los demás o estático). Eliminar el `Link` «Regenerar» del plan de entreno y, dentro de «Panel IA — decisiones, carga y recuperación», la línea `<GenerarBloqueHibridoPanel …/>` y su `dynamic import`. Añadir un `useEffect` que escuche `plan-entreno:actualizado` y vuelva a cargar `entrenoActivo` (usar la misma función de carga que ya usa la página al montar; localizarla con `grep -n "setEntrenoActivo" "app/clientes/[id]/page.tsx"`).

- [ ] **Step 5: Eliminar el panel antiguo**

Run: `grep -rn "GenerarBloqueHibridoPanel" app components scripts | grep -v "components/clientes/GenerarBloqueHibridoPanel.tsx"`
Expected: sin resultados. Entonces `git rm components/clientes/GenerarBloqueHibridoPanel.tsx`.

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit --pretty false && npx eslint components/clientes/PlanificarConIA.tsx components/clientes/PropuestaPlanEntreno.tsx components/clientes/DecisionesIACliente.tsx "app/clientes/[id]/page.tsx" && node scripts/audit-portal-patterns.mjs`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add components/clientes/PlanificarConIA.tsx components/clientes/PropuestaPlanEntreno.tsx components/clientes/DecisionesIACliente.tsx "app/clientes/[id]/page.tsx"
git rm -q components/clientes/GenerarBloqueHibridoPanel.tsx
git commit -m "feat: botón único «Planificar con IA» con menú «Más opciones»; la propuesta aparece en las decisiones de IA

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Verificación del motor, documentación y prueba en vivo con Carlos

**Files:**
- Modify: `scripts/verificar-motor.ts` (añadir `planificar-modo`, `guardar-plan`, `planificar-con-ia`, `aplicar-plan-ia`, `planificar-ia-ruta` a `TESTS`; añadir `lib/entrenos` ya cubierto por eslint)
- Modify: `docs/10-10-2026_errores-conocidos-motor.md` (filas nuevas), `CLAUDE.md` (sesión), memoria.

- [ ] **Step 1: Registrar los tests** en `TESTS` de `scripts/verificar-motor.ts`:

```ts
  'planificar-modo', 'guardar-plan', 'planificar-con-ia', 'aplicar-plan-ia', 'planificar-ia-ruta',
```
Run: `npm run verificar:motor`
Expected: todo ✅ (35+ comprobaciones).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Regresión del núcleo con datos reales**

Run: `npx tsx scripts/regresion-generador-plan.ts 04cc53b3`
Expected: `regresion-generador-plan OK · hibrido · fase …`

- [ ] **Step 4: Documentar** — en `docs/10-10-2026_errores-conocidos-motor.md` añadir filas:
  - «`proponer-plan-ciencia` solo comprobaba que hubiera sesión: cualquier usuario podía generar planes de cualquier cliente» → test: comprobación 401/403 (Task 6 Step 4).
  - «El generador desactivaba el plan activo antes de tener el nuevo completo; un fallo a mitad dejaba al cliente sin plan» → `guardar-plan.test.ts`.
  - «Ejercicios de la IA sin equivalente se omitían en silencio» → `guardar-plan.test.ts` (`ejerciciosOmitidos`).
  En `CLAUDE.md` (proyecto) añadir una sección de sesión: qué es «Planificar con IA», dónde está cada pieza y que `revisar-plan` conserva `proponer-plan-ciencia` (guardado inmediato) por ser alta de cliente nuevo.

- [ ] **Step 5: Commit y push**

```bash
git add scripts/verificar-motor.ts docs/10-10-2026_errores-conocidos-motor.md CLAUDE.md
git commit -m "docs: «Planificar con IA» en el registro de errores, la verificación del motor y CLAUDE.md

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push origin main
```
Esperar a que Vercel marque el despliegue `Ready` (`vercel ls`).

- [ ] **Step 6: Prueba en vivo con Carlos** (él inicia sesión; no se fabrican sesiones):
  1. Ficha de Carlos → Entrenamiento → bajo el botón «Planificar con IA» debe leerse el modo («Ajustar…» o «Siguiente bloque…»).
  2. Pulsar el botón: aparece el mensaje con el resumen y una tarjeta «Plan de entreno» en «Decisiones de IA pendientes». El plan activo **no ha cambiado** (verificar con `npx tsx scripts/auditar-plan-activo-cliente.ts 04cc53b3`).
  3. Pulsar otra vez: el botón está desactivado y la API responde 409 si se fuerza.
  4. Abrir la tarjeta: se ven esqueleto, sesiones, avisos del validador y fundamentos con su tipo.
  5. Aprobar: el plan nuevo queda activo, el anterior inactivo, y el mensaje de aplicar cuenta sesiones y ejercicios omitidos. Auditar de nuevo con el script (el registro IA trae `_macrociclo`).
  6. Si algo no cuadra, anotar el error en `errores-conocidos-motor.md` con su test antes de corregir.

---

## Self-Review (hecho al escribir)

- **Spec coverage:** 3.1 modo → Task 1; 3.2 servicio/ruta → Tasks 3, 4, 6; 3.3 payload → Task 4; 3.4 aprobación → Task 5; 3.5 interfaz → Task 7; 3.6 errores y seguridad → Tasks 2, 3, 6; §4 pruebas → cada tarea + Task 8; decisión abierta sobre `proponer-plan-ciencia` → resuelta: se conserva como capa fina solo para `revisar-plan`.
- **Placeholders:** el único bloque no literal es el cuerpo movido en la Task 3 (se genera con el script de anclas a partir del código real, no se reescribe); está acotado por el test de regresión y por `git diff --color-moved`.
- **Consistencia de tipos:** `PayloadPlanEntrenoIA` (Task 4) lo consumen Task 5 (`validarPayloadPlanEntrenoIA`) y Task 7 (`PropuestaPlanEntreno`); `ResultadoGeneracionPlan` (Task 3) lo consumen Task 4; `guardarPlanEntreno`/`SesionIA` (Task 2) los consumen Tasks 3 y 5; `ModoPlanificacion` (Task 1) lo usan Tasks 4 y 6.
