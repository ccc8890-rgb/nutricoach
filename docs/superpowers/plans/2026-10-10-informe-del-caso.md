# Informe del caso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un botón «Preparar conversación» que genera, solo para el coach, el informe de un cliente en cuatro lecturas (mensaje, guion de llamada, resumen detallado, PDF imprimible) a partir de sus datos reales.

**Architecture:** Un módulo puro (`lib/informe-caso/construir.ts`) transforma datos ya calculados en un `InformeCaso` con plantillas por escenario; otro módulo reúne los datos de la base; una ruta del coach devuelve JSON o una página imprimible; un componente pinta el panel. Todo es aislado para poder quitarse.

**Tech Stack:** Next.js (App Router custom), Supabase (service role), TypeScript, tests con `npx tsx scripts/<x>.test.ts`, `npm run verificar:motor`.

**Spec:** `docs/superpowers/specs/2026-10-10-informe-del-caso-design.md`

## Global Constraints

- Todo texto en **castellano**, tuteo, primera persona del coach, **sin emojis**; mensaje de chat **≤ 700 caracteres**.
- **Nada lo escribe una IA libre**: solo plantillas con datos reales. Todo número del mensaje y del guion debe venir de los datos de entrada (test de propiedad).
- Solo para el coach: la ruta exige sesión y `autorizarCoachCliente`; errores genéricos, nunca `err.message` al cliente HTTP.
- **Sin migraciones ni cambios de base de datos.**
- Estética: solo clases y variables CSS existentes (`btn-primary`, `btn-secondary`, `btn-sm`, `var(--surface)`, `var(--border)`, `var(--text)`, `var(--text-muted)`); el acabado lo pule Codex.
- Commits con **`git add` de rutas concretas**; mensaje terminado en `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Antes de cada `git push`: `npm run verificar:motor` todo ✅.
- **Fácil de quitar:** todo vive en `lib/informe-caso/`, `app/api/clientes/[id]/informe-caso/`, `components/clientes/InformeCaso.tsx` y una línea en la ficha.

## Review Focus

1. **Cliente sin datos del reloj, sin plan o sin análisis** → el informe se construye, sin `undefined`, `NaN` ni «null» en los textos, y lo declara en «Lo que no sé». Tests en Task 1.
2. **Nombre del cliente con HTML o comillas** (`<script>`, `"`) → en la página imprimible va escapado. Test en Task 3.
3. **Cliente de otro coach o usuario con rol cliente** → 403/401 en la ruta. Comprobación en Task 4.
4. **Varias situaciones a la vez** (alerta + propuesta + ajustes) → manda la de mayor prioridad y el informe lo recoge sin contradecirse. Test en Task 1.
5. **Texto largo del análisis** (decisiones de 600 caracteres) → el mensaje sigue ≤ 700 caracteres. Test en Task 1.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `lib/informe-caso/construir.ts` (nuevo) | Tipos (`DatosInforme`, `InformeCaso`), escenarios y plantillas; función pura `construirInformeCaso` |
| `lib/informe-caso/datos.ts` (nuevo) | `atletaDesdeEstado` (puro) y `reunirDatosInforme` (lee la base de datos) |
| `lib/informe-caso/html.ts` (nuevo) | `htmlInformeCaso`: página imprimible con escape |
| `app/api/clientes/[id]/informe-caso/route.ts` (nuevo) | GET JSON o `?formato=html` |
| `components/clientes/InformeCaso.tsx` (nuevo) | Botón y panel con cuatro pestañas y «Copiar» |
| `app/clientes/[id]/page.tsx` (modificar) | Una línea: el botón junto a «Planificar con IA» |
| `scripts/informe-caso.test.ts`, `informe-caso-datos.test.ts`, `informe-caso-html.test.ts`, `informe-caso-render.test.ts` (nuevos) | Tests |
| `scripts/verificar-motor.ts` (modificar) | Añade los tests |
| `docs/10-10-2026_traspaso-codex-informe-caso.md` (nuevo) | Nota para Codex |

---

### Task 1: Módulo de contenido `construirInformeCaso`

**Files:**
- Create: `lib/informe-caso/construir.ts`
- Test: `scripts/informe-caso.test.ts`

**Interfaces:**
- Consumes: `glosarSiglas`, `porQueResumen`, `resumirPropuesta`, `titularDe` de `@/lib/rendimiento/presentacion`; `PayloadPlanEntrenoIA` de `@/lib/entrenos/planificar-con-ia`.
- Produces:
```ts
export type Escenario = 'alerta' | 'propuesta_bloque' | 'ajustes' | 'sin_cambios'
export interface DecisionInforme { cambio: string; razon: string; segura?: boolean; riesgo?: 'bajo'|'medio'|'alto'; fiabilidad?: { nivel: 'alta'|'media'|'baja' }; estudios?: unknown[]; confianza?: number }
export interface DatosInforme {
  nombre: string
  atleta: { hayDatos: boolean; minutosCarreraSemana: number | null; salidasSemana: number | null; pctSuave: number | null
    forma: number | null; fatiga: number | null; frescura: number | null
    sesionesEvaluadas: number | null; sesionesSaltadas: number | null
    retorno: boolean; vdot: number | null; fuerzaRegistrada: number; fuerzaEnPlan: number; alertasAltas: string[] }
  plan: { nombre: string; semanaActual: number | null; semanasTotales: number | null; diasRestantes: number | null } | null
  analisis: { resumen?: string; alerta_prioritaria?: string | null; decisiones?: DecisionInforme[]; preguntas_al_coach?: string[] } | null
  propuesta: PayloadPlanEntrenoIA | null
}
export interface InformeCaso {
  cliente: string; escenario: Escenario
  situacion: { titulo: string; datos: { etiqueta: string; valor: string }[] }
  plan: string | null
  cambios: string[]
  porQue: { texto: string; origen: string }[]
  loQueNoSe: string[]
  mensaje: string
  guion: { paso: string; texto: string }[]
  preguntas: string[]
}
export function construirInformeCaso(d: DatosInforme): InformeCaso
export const ETIQUETA_ESCENARIO: Record<Escenario, string>
```

- [ ] **Step 1: Escribir el test que falla** — `scripts/informe-caso.test.ts`

```ts
import assert from 'node:assert/strict'
import { construirInformeCaso, ETIQUETA_ESCENARIO, type DatosInforme } from '../lib/informe-caso/construir'
import type { PayloadPlanEntrenoIA } from '../lib/entrenos/planificar-con-ia'

const atleta = (o: Partial<DatosInforme['atleta']> = {}): DatosInforme['atleta'] => ({
  hayDatos: true, minutosCarreraSemana: 89, salidasSemana: 3.5, pctSuave: 36, forma: 16, fatiga: 17.3, frescura: -1.3,
  sesionesEvaluadas: 6, sesionesSaltadas: 2, retorno: false, vdot: 45, fuerzaRegistrada: 0, fuerzaEnPlan: 3, alertasAltas: [], ...o,
})
const plan = { nombre: 'Híbrido Hyrox + Running — Deload', semanaActual: 2, semanasTotales: 4, diasRestantes: 18 }
const analisis = {
  resumen: 'Carlos está en descarga con la forma en 16. El plan se ejecuta a medias.',
  alerta_prioritaria: null,
  decisiones: [
    { cambio: 'En los rodajes y la tirada larga, llevar el pulso por debajo de 158 ppm. Objetivo: llegar al 75 % del tiempo en suave en 6-8 semanas.', razon: 'Últimas 4 semanas: 36 % suave, 52 % medio y 12 % duro. Referencia: 75-80 % suave.', segura: true, riesgo: 'bajo' as const, fiabilidad: { nivel: 'alta' as const }, estudios: [{}, {}, {}, {}] },
    { cambio: 'La tirada larga (69 min) concentra el 78 % del tiempo semanal de carrera. No alargarla más.', razon: 'Con 3.5 salidas por semana una sola sesión carga con casi todo el volumen.', segura: false, riesgo: 'medio' as const, fiabilidad: { nivel: 'media' as const }, estudios: [] },
  ],
  preguntas_al_coach: ['¿Hace las sesiones de fuerza?'],
}
const propuesta = {
  modo: 'siguiente_bloque', fase_bloque: 'Base', nombre_plan: 'Híbrido — Base', duracion_semanas: 4, es_hibrido: true,
  plan: { sesiones: [{ nombre: 'Carrera: Rodaje', dia_semana: 'martes', duracion_min: 30 }] },
  macrociclo: { semanasHastaCarrera: null, ritmos: null, avisos: [], supuestos: [], datosFaltantes: [], parametros: { nivel: 'avanzado', salidasSemana: 3, volumenBase: 89, volumenPico: 158, crecimientoSemanal: 0.1, descargaCada: 4 },
    semanas: [{ n: 1, lunes: '2026-10-12', fase: 'base', descarga: false, minutos: 100, salidas: 3, tiradaMin: 40, pctSuave: 95, fuerza: 3, sesiones: [], notas: [] }],
    fundamentos: [{ regla: 'Sesión más larga +10 %', tipo: 'estudio', fuente: 'Frandsen 2025' }, { regla: 'Descarga cada 4 semanas', tipo: 'libro', fuente: 'Fitzgerald' }] },
  validacion: null, generado_en: '2026-10-10T10:00:00Z', contexto: { minutos_reales_semana: 89 },
} as PayloadPlanEntrenoIA
const base = (o: Partial<DatosInforme> = {}): DatosInforme => ({ nombre: 'Carlos Casanova Cordero', atleta: atleta(), plan, analisis: null, propuesta: null, ...o })

// Números del texto = números de los datos (tolerancia por redondeo)
const numerosDe = (t: string) => [...t.matchAll(/\d+(?:,\d+)?/g)].map(m => Number(m[0].replace(',', '.')))
const permitidos = (d: DatosInforme) => [...JSON.stringify(d).matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]))
const sinInventar = (d: DatosInforme, textos: string[]) => {
  const ok = permitidos(d)
  for (const t of textos) for (const n of numerosDe(t)) assert.ok(ok.some(v => Math.abs(v - n) <= 0.06), `número «${n}» no sale de los datos en: ${t}`)
}
const limpio = (i: ReturnType<typeof construirInformeCaso>) => {
  const todo = JSON.stringify(i)
  for (const feo of ['undefined', 'NaN', 'null', '[object']) assert.ok(!todo.includes(feo), `aparece «${feo}»`)
}

// ── Escenarios y prioridad ──
assert.equal(construirInformeCaso(base()).escenario, 'sin_cambios')
assert.equal(construirInformeCaso(base({ analisis })).escenario, 'ajustes')
assert.equal(construirInformeCaso(base({ analisis, propuesta })).escenario, 'propuesta_bloque')
assert.equal(construirInformeCaso(base({ analisis, propuesta, atleta: atleta({ alertasAltas: ['La carga sube demasiado deprisa'] }) })).escenario, 'alerta')
assert.equal(construirInformeCaso(base({ analisis: { ...analisis, alerta_prioritaria: 'Dolor reportado' } })).escenario, 'alerta')
assert.deepEqual(Object.keys(ETIQUETA_ESCENARIO).sort(), ['ajustes', 'alerta', 'propuesta_bloque', 'sin_cambios'])

// ── Cada escenario: mensaje, guion y sin números inventados ──
for (const [nombre, d] of Object.entries({
  sin_cambios: base(), ajustes: base({ analisis }), propuesta: base({ analisis, propuesta }),
  alerta: base({ analisis: { ...analisis, alerta_prioritaria: 'La fatiga sube más deprisa de lo normal' } }),
})) {
  const i = construirInformeCaso(d)
  assert.ok(i.mensaje.startsWith('Hola Carlos'), nombre)
  assert.ok(!i.mensaje.includes('Casanova'), 'solo el nombre de pila')
  assert.ok(i.mensaje.length <= 700, `${nombre}: ${i.mensaje.length} caracteres`)
  assert.ok(i.guion.length >= 5 && i.guion.every(g => g.paso && g.texto), nombre)
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(i.mensaje), 'sin emojis')
  sinInventar(d, [i.mensaje, ...i.guion.map(g => g.texto), ...i.cambios])
  limpio(i)
}

// ── Contenido por escenario ──
const sc = construirInformeCaso(base())
assert.match(sc.mensaje, /seguimos con tu plan/)
assert.match(sc.mensaje, /89 minutos por semana/)
assert.match(sc.mensaje, /36 % del tiempo/)
assert.deepEqual(sc.cambios, ['Nada cambia por ahora: sigue con el plan actual.'])
const aj = construirInformeCaso(base({ analisis }))
assert.match(aj.mensaje, /Te propongo/)
assert.equal(aj.cambios.length, 2)
assert.ok(aj.porQue.some(p => p.origen.includes('4 estudios')))
const pr = construirInformeCaso(base({ analisis, propuesta }))
assert.match(pr.mensaje, /siguiente bloque/)
assert.match(pr.mensaje, /de 89 a 100 min/)
assert.ok(pr.cambios.some(c => c.includes('de 89 a 100 min')))
assert.ok(pr.porQue.some(p => p.origen.startsWith('Estudio')))
const al = construirInformeCaso(base({ analisis: { ...analisis, alerta_prioritaria: 'La fatiga sube más deprisa de lo normal' } }))
assert.match(al.mensaje, /La fatiga sube más deprisa de lo normal/)
assert.match(al.mensaje, /llamada/)
assert.ok(!al.mensaje.includes('Te propongo'), 'en una alerta no se propone nada que el sistema no sepa')

// ── Situación (dónde está) y «lo que no sé» ──
const etiquetas = sc.situacion.datos.map(x => x.etiqueta)
assert.ok(etiquetas.includes('Carrera') && etiquetas.includes('Tiempo en suave') && etiquetas.includes('Forma y fatiga'))
assert.ok(sc.loQueNoSe.some(x => x.includes('fuerza')), 'sin fuerza registrada se declara')
assert.equal(sc.plan, 'Híbrido Hyrox + Running — Deload · semana 2 de 4')

// ── Sin datos de ningún tipo: no revienta y lo dice ──
const vacio = base({ atleta: atleta({ hayDatos: false, minutosCarreraSemana: null, salidasSemana: null, pctSuave: null, forma: null, fatiga: null, frescura: null, sesionesEvaluadas: null, sesionesSaltadas: null, vdot: null, fuerzaEnPlan: 0 }), plan: null })
const iv = construirInformeCaso(vacio)
limpio(iv)
assert.equal(iv.escenario, 'sin_cambios')
assert.equal(iv.plan, null)
assert.ok(iv.loQueNoSe.length >= 3)
assert.ok(iv.loQueNoSe.some(x => x.includes('reloj')) && iv.loQueNoSe.some(x => x.includes('plan')) && iv.loQueNoSe.some(x => x.includes('VDOT')))
assert.ok(iv.mensaje.startsWith('Hola Carlos'))
assert.ok(iv.situacion.datos.length === 0)

// ── Texto largo: el mensaje no pasa de 700 caracteres ──
const larga = 'Una frase larguísima que no acaba nunca y sigue y sigue con más detalle del necesario '.repeat(8)
const il = construirInformeCaso(base({ analisis: { ...analisis, decisiones: [{ ...analisis.decisiones[0], cambio: larga }, { ...analisis.decisiones[1], cambio: larga }] } }))
assert.ok(il.mensaje.length <= 700, String(il.mensaje.length))

// ── Nombre raro ──
assert.ok(construirInformeCaso(base({ nombre: '   ' })).mensaje.startsWith('Hola,'))

console.log('informe-caso.test OK')
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx tsx scripts/informe-caso.test.ts`
Expected: FAIL (módulo no encontrado).

- [ ] **Step 3: Implementar** — `lib/informe-caso/construir.ts`

```ts
// lib/informe-caso/construir.ts
// Informe del caso para que el COACH explique la situación de un cliente (chat, WhatsApp, llamada). Función pura: plantillas con datos reales.
// Regla: cada número de los textos viene de los datos; lo que no se sabe va a «loQueNoSe», nunca se rellena.
import { glosarSiglas, porQueResumen, resumirPropuesta, titularDe } from '@/lib/rendimiento/presentacion'
import type { PayloadPlanEntrenoIA } from '@/lib/entrenos/planificar-con-ia'

export type Escenario = 'alerta' | 'propuesta_bloque' | 'ajustes' | 'sin_cambios'

export const ETIQUETA_ESCENARIO: Record<Escenario, string> = {
  alerta: 'Hay una alerta que hablar', propuesta_bloque: 'Hay un siguiente bloque propuesto', ajustes: 'Hay ajustes propuestos', sin_cambios: 'Sin cambios: seguir con el plan',
}

export interface DecisionInforme {
  cambio: string; razon: string
  segura?: boolean; riesgo?: 'bajo' | 'medio' | 'alto'; fiabilidad?: { nivel: 'alta' | 'media' | 'baja' }; estudios?: unknown[]; confianza?: number
}

export interface DatosInforme {
  nombre: string
  atleta: {
    hayDatos: boolean
    minutosCarreraSemana: number | null; salidasSemana: number | null; pctSuave: number | null
    forma: number | null; fatiga: number | null; frescura: number | null
    sesionesEvaluadas: number | null; sesionesSaltadas: number | null
    retorno: boolean; vdot: number | null; fuerzaRegistrada: number; fuerzaEnPlan: number; alertasAltas: string[]
  }
  plan: { nombre: string; semanaActual: number | null; semanasTotales: number | null; diasRestantes: number | null } | null
  analisis: { resumen?: string; alerta_prioritaria?: string | null; decisiones?: DecisionInforme[]; preguntas_al_coach?: string[] } | null
  propuesta: PayloadPlanEntrenoIA | null
}

export interface InformeCaso {
  cliente: string
  escenario: Escenario
  situacion: { titulo: string; datos: { etiqueta: string; valor: string }[] }
  plan: string | null
  cambios: string[]
  porQue: { texto: string; origen: string }[]
  loQueNoSe: string[]
  mensaje: string
  guion: { paso: string; texto: string }[]
  preguntas: string[]
}

const MAX_MENSAJE = 700
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')
const limpiar = (t: string) => t.replace(/\s+/g, ' ').trim()
const pilaDe = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? ''

function escenarioDe(d: DatosInforme): Escenario {
  if (d.analisis?.alerta_prioritaria || d.atleta.alertasAltas.length > 0) return 'alerta'
  if (d.propuesta) return 'propuesta_bloque'
  if ((d.analisis?.decisiones?.length ?? 0) > 0) return 'ajustes'
  return 'sin_cambios'
}

function datosSituacion(a: DatosInforme['atleta'], plan: DatosInforme['plan']) {
  const datos: { etiqueta: string; valor: string }[] = []
  if (a.minutosCarreraSemana) datos.push({ etiqueta: 'Carrera', valor: `${a.minutosCarreraSemana} min por semana${a.salidasSemana ? ` en ${fmt(a.salidasSemana)} salidas` : ''}` })
  if (a.pctSuave != null) datos.push({ etiqueta: 'Tiempo en suave', valor: `${Math.round(a.pctSuave)} %` })
  if (a.forma != null && a.fatiga != null) datos.push({ etiqueta: 'Forma y fatiga', valor: `forma ${fmt(a.forma)}, fatiga ${fmt(a.fatiga)}${a.frescura != null ? `, frescura ${fmt(a.frescura)}` : ''}` })
  if (a.sesionesEvaluadas && a.sesionesEvaluadas > 0) datos.push({ etiqueta: 'Sesiones de calidad', valor: `${a.sesionesEvaluadas - (a.sesionesSaltadas ?? 0)} de ${a.sesionesEvaluadas} hechas` })
  if (plan?.semanaActual && plan.semanasTotales) datos.push({ etiqueta: 'Plan', valor: `semana ${plan.semanaActual} de ${plan.semanasTotales}` })
  return datos
}

function loQueNoSe(d: DatosInforme): string[] {
  const l: string[] = []
  if (!d.atleta.hayDatos) l.push('No hay entrenos recientes del reloj: no puedo valorar su carga ni su cumplimiento.')
  if (d.atleta.fuerzaEnPlan > 0 && d.atleta.fuerzaRegistrada === 0) l.push(`El plan tiene ${d.atleta.fuerzaEnPlan} sesiones de fuerza o híbridas por semana y no hay ninguna registrada: no sé si las hace.`)
  if (d.atleta.vdot == null) l.push('Sin VDOT: los ritmos de referencia no están calculados.')
  if (!d.plan) l.push('No tiene un plan de entreno activo.')
  if (!d.analisis) l.push('Todavía no hay un análisis de rendimiento.')
  return l
}

function lineaDatos(a: DatosInforme['atleta']): string {
  const partes: string[] = []
  if (a.minutosCarreraSemana) partes.push(`estás corriendo unos ${a.minutosCarreraSemana} minutos por semana${a.salidasSemana ? ` en ${fmt(a.salidasSemana)} salidas` : ''}`)
  if (a.pctSuave != null) partes.push(`el ${Math.round(a.pctSuave)} % del tiempo lo haces a ritmo suave`)
  return partes.length ? `Ahora mismo ${partes.join(' y ')}.` : ''
}

function lineaCumplimiento(a: DatosInforme['atleta']): string {
  return a.sesionesEvaluadas && a.sesionesEvaluadas > 0 ? `De las ${a.sesionesEvaluadas} sesiones de calidad previstas has hecho ${a.sesionesEvaluadas - (a.sesionesSaltadas ?? 0)}.` : ''
}

function mensajeDe(d: DatosInforme, escenario: Escenario, cambios: string[]): string {
  const saludo = pilaDe(d.nombre) ? `Hola ${pilaDe(d.nombre)}` : 'Hola,'
  const datos = lineaDatos(d.atleta)
  let m: string
  if (escenario === 'alerta') {
    const alerta = d.analisis?.alerta_prioritaria || d.atleta.alertasAltas[0] || ''
    m = `${saludo}, he visto algo en tus datos que quiero comentarte: ${titularDe(alerta, 200).replace(/[.]+$/, '')}. Prefiero que lo hablemos antes de seguir con el plan tal cual. ¿Te va bien una llamada corta hoy o mañana?`
  } else if (escenario === 'propuesta_bloque' && d.propuesta) {
    const r = resumirPropuesta(d.propuesta)
    const carrera = r.queCambia.find(c => c.startsWith('Carrera') && !c.includes('sin datos'))
    m = `${saludo}, ya se acerca el final de tu bloque actual y te he preparado el siguiente bloque${d.propuesta.fase_bloque ? ` (${d.propuesta.fase_bloque}` + (d.propuesta.duracion_semanas ? `, ${d.propuesta.duracion_semanas} semanas)` : ')') : ''}. ${datos} ${carrera ? `${carrera.replace('Carrera: ', 'En carrera pasaríamos ')}.` : ''} Es una propuesta: si algo no te encaja, lo ajustamos. ¿Lo hablamos cuando te venga bien?`
  } else if (escenario === 'ajustes') {
    const ajustes = cambios.slice(0, 2).map(c => c.replace(/[.]+$/, '')).join('; ')
    m = `${saludo}, he revisado tus últimos entrenamientos. ${datos} Te propongo ${cambios.length === 1 ? 'un ajuste' : 'estos ajustes'}: ${ajustes}. ¿Te parece bien que lo probemos estas semanas?`
  } else {
    m = `${saludo}, te escribo para contarte cómo va tu entrenamiento. ${datos} ${lineaCumplimiento(d.atleta)} Por ahora no cambiamos nada: seguimos con tu plan${d.plan?.semanaActual && d.plan.semanasTotales ? ` (semana ${d.plan.semanaActual} de ${d.plan.semanasTotales})` : ''}. Si notas algo raro o tienes dudas, dímelo.`
  }
  m = limpiar(m)
  return m.length <= MAX_MENSAJE ? m : `${m.slice(0, MAX_MENSAJE - 1).replace(/\s+\S*$/, '')}…`
}

export function construirInformeCaso(d: DatosInforme): InformeCaso {
  const escenario = escenarioDe(d)
  const decisiones = d.analisis?.decisiones ?? []

  let cambios: string[]
  if (escenario === 'alerta') cambios = [`Pendiente de hablarlo: ${titularDe(d.analisis?.alerta_prioritaria || d.atleta.alertasAltas[0] || '', 160)}`]
  else if (escenario === 'propuesta_bloque' && d.propuesta) { const r = resumirPropuesta(d.propuesta); cambios = [r.titular, ...r.queCambia] }
  else if (escenario === 'ajustes') cambios = decisiones.slice(0, 3).map(x => glosarSiglas(titularDe(x.cambio, 150)))
  else cambios = ['Nada cambia por ahora: sigue con el plan actual.']

  const porQue: { texto: string; origen: string }[] = []
  if (escenario === 'propuesta_bloque' && d.propuesta) {
    for (const f of resumirPropuesta(d.propuesta).fundamentos.slice(0, 3)) porQue.push({ texto: f.regla, origen: `${f.tipo}: ${f.fuente}` })
  } else {
    for (const x of decisiones.slice(0, 3)) porQue.push({ texto: glosarSiglas(titularDe(x.razon, 200)), origen: porQueResumen(x) })
  }

  const noSe = loQueNoSe(d)
  const datos = datosSituacion(d.atleta, d.plan)
  const pide: Record<Escenario, string> = {
    alerta: 'Que te cuente cómo se encuentra antes de decidir nada.',
    propuesta_bloque: 'Que valore el nuevo bloque y te diga si algo no le encaja antes de empezarlo.',
    ajustes: 'Que pruebe el cambio estas semanas y te cuente cómo le sienta.',
    sin_cambios: noSe.some(x => x.includes('fuerza')) ? 'Que siga el plan y registre sus sesiones, también las de fuerza, con el reloj.' : 'Que siga el plan y registre sus sesiones con el reloj.',
  }
  const preguntas = [
    '¿Cómo has dormido y cómo notas las piernas?',
    '¿Alguna molestia o dolor?',
    ...(noSe.some(x => x.includes('fuerza')) ? ['¿Estás haciendo las sesiones de fuerza o híbridas? ¿Las registras en el reloj?'] : []),
    ...(d.analisis?.preguntas_al_coach ?? []),
  ].filter((p, i, a) => a.indexOf(p) === i)

  const guion = [
    { paso: 'Abrir', texto: 'Pregúntale cómo se ha sentido estos días: energía, sueño y molestias.' },
    { paso: 'Cómo va', texto: datos.length ? datos.map(x => `${x.etiqueta}: ${x.valor}`).join('. ') + '.' : 'No hay datos recientes del reloj: pregúntale directamente cómo van los entrenos.' },
    { paso: 'Qué cambia', texto: cambios.join(' ') },
    { paso: 'Por qué', texto: porQue.length ? porQue.map(p => `${p.texto} (${p.origen})`).join(' ') : 'Explícale que mantener el plan es lo que dicen sus datos.' },
    { paso: 'Qué le pides', texto: pide[escenario] },
    { paso: 'Cerrar', texto: 'Acordad cuándo volvéis a hablar, por ejemplo tras su próxima sesión importante.' },
  ]

  return {
    cliente: d.nombre.trim(),
    escenario,
    situacion: { titulo: ETIQUETA_ESCENARIO[escenario], datos },
    plan: d.plan ? `${d.plan.nombre}${d.plan.semanaActual && d.plan.semanasTotales ? ` · semana ${d.plan.semanaActual} de ${d.plan.semanasTotales}` : ''}` : null,
    cambios,
    porQue,
    loQueNoSe: noSe,
    mensaje: mensajeDe(d, escenario, cambios),
    guion,
    preguntas,
  }
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npx tsx scripts/informe-caso.test.ts`
Expected: `informe-caso.test OK`. Si algún número de un texto no sale de los datos, el test lo nombra: corregir la plantilla (no el test).

- [ ] **Step 5: Commit**

```bash
git add lib/informe-caso/construir.ts scripts/informe-caso.test.ts
git commit -m "feat: módulo de contenido del informe del caso (escenarios, mensaje, guion, lo que no sé)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Reunir los datos reales (`atletaDesdeEstado` y `reunirDatosInforme`)

**Files:**
- Create: `lib/informe-caso/datos.ts`
- Test: `scripts/informe-caso-datos.test.ts`

**Interfaces:**
- Consumes: `construirContextoRendimiento(db, clienteId, hoy)` → `{ estado, alertas, hayDatos }` (`lib/rendimiento/contexto.ts`); `calcularEstadoBloque`; `DatosInforme`.
- Produces: `atletaDesdeEstado(estado: EstadoAtleta, alertas: AlertaRendimiento[], hayDatos: boolean): DatosInforme['atleta']`; `reunirDatosInforme(db: SupabaseClient, clienteId: string, hoy?: Date): Promise<DatosInforme | null>` (null si el cliente no existe).

- [ ] **Step 1: Test que falla** — `scripts/informe-caso-datos.test.ts`

```ts
import assert from 'node:assert/strict'
import { atletaDesdeEstado } from '../lib/informe-caso/datos'

const estado = (o: Record<string, unknown> = {}) => ({
  minutosCarreraPorSemana: 89, carrerasPorSemana: 3.5, vdot: 45, retorno: false, fuerza28d: 0, fuerzaEnPlan: 3,
  intensidad: { valoracion: 'mejorable', pctSuave: 36, pctMedia: 52, pctDura: 12, minutos: 340 },
  carga: { ctl: 16.04, atl: 17.3, tsb: -1.3 },
  ejecucion: { repsEvaluadas: 10, repsLentas: 2, sesionesEvaluadas: 6, sesionesSaltadas: 2 },
  ...o,
}) as never

const a = atletaDesdeEstado(estado(), [{ codigo: 'a', gravedad: 'alta', texto: 'Carga alta' }, { codigo: 'b', gravedad: 'aviso', texto: 'Aviso' }, { codigo: 'c', gravedad: 'info', texto: 'Info' }], true)
assert.equal(a.minutosCarreraSemana, 89)
assert.equal(a.salidasSemana, 3.5)
assert.equal(a.pctSuave, 36)
assert.equal(a.forma, 16)
assert.equal(a.fatiga, 17.3)
assert.equal(a.frescura, -1.3)
assert.equal(a.sesionesEvaluadas, 6)
assert.equal(a.sesionesSaltadas, 2)
assert.equal(a.fuerzaRegistrada, 0)
assert.equal(a.fuerzaEnPlan, 3)
assert.deepEqual(a.alertasAltas, ['Carga alta'], 'solo las de gravedad alta')

// Sin datos: todo a null, nunca 0 inventado
const v = atletaDesdeEstado(estado({ minutosCarreraPorSemana: 0, carrerasPorSemana: 0, vdot: null, carga: null, intensidad: { valoracion: 'sin_datos', pctSuave: 0, pctMedia: 0, pctDura: 0, minutos: 0 }, ejecucion: { repsEvaluadas: 0, repsLentas: 0, sesionesEvaluadas: 0, sesionesSaltadas: 0 } }), [], false)
assert.equal(v.hayDatos, false)
assert.equal(v.minutosCarreraSemana, null)
assert.equal(v.salidasSemana, null)
assert.equal(v.pctSuave, null)
assert.equal(v.forma, null)
assert.equal(v.sesionesEvaluadas, null)
assert.equal(v.vdot, null)
console.log('informe-caso-datos.test OK')
```

- [ ] **Step 2: Ejecutar y ver que falla** (`npx tsx scripts/informe-caso-datos.test.ts` → módulo no encontrado).

- [ ] **Step 3: Implementar** — `lib/informe-caso/datos.ts`

```ts
// lib/informe-caso/datos.ts
// Reúne, solo en lectura, lo que necesita el informe del caso. Lo que no existe queda en null: nunca se rellena con ceros.
import type { SupabaseClient } from '@supabase/supabase-js'
import { construirContextoRendimiento } from '@/lib/rendimiento/contexto'
import type { EstadoAtleta } from '@/lib/rendimiento/estado'
import type { AlertaRendimiento } from '@/lib/rendimiento/alertas'
import { calcularEstadoBloque } from '@/lib/entrenos/bloques'
import type { PayloadPlanEntrenoIA } from '@/lib/entrenos/planificar-con-ia'
import type { DatosInforme } from './construir'

export function atletaDesdeEstado(e: EstadoAtleta, alertas: AlertaRendimiento[], hayDatos: boolean): DatosInforme['atleta'] {
  const evaluadas = e.ejecucion?.sesionesEvaluadas ?? 0
  return {
    hayDatos,
    minutosCarreraSemana: e.minutosCarreraPorSemana > 0 ? e.minutosCarreraPorSemana : null,
    salidasSemana: e.carrerasPorSemana > 0 ? e.carrerasPorSemana : null,
    pctSuave: e.intensidad && e.intensidad.valoracion !== 'sin_datos' ? e.intensidad.pctSuave : null,
    forma: e.carga ? Math.round(e.carga.ctl * 10) / 10 : null,
    fatiga: e.carga ? Math.round(e.carga.atl * 10) / 10 : null,
    frescura: e.carga ? Math.round(e.carga.tsb * 10) / 10 : null,
    sesionesEvaluadas: evaluadas > 0 ? evaluadas : null,
    sesionesSaltadas: evaluadas > 0 ? e.ejecucion.sesionesSaltadas : null,
    retorno: !!e.retorno,
    vdot: e.vdot ?? null,
    fuerzaRegistrada: e.fuerza28d ?? 0,
    fuerzaEnPlan: e.fuerzaEnPlan ?? 0,
    alertasAltas: alertas.filter(a => a.gravedad === 'alta').map(a => a.texto),
  }
}

export async function reunirDatosInforme(db: SupabaseClient, clienteId: string, hoy: Date = new Date()): Promise<DatosInforme | null> {
  const { data: cli } = await db.from('clientes').select('id, profiles:profiles!profile_id(nombre, apellidos)').eq('id', clienteId).maybeSingle()
  if (!cli) return null
  const perfil = (cli as { profiles?: { nombre?: string; apellidos?: string } | null }).profiles
  const nombre = `${perfil?.nombre ?? ''} ${perfil?.apellidos ?? ''}`.trim()

  const ctx = await construirContextoRendimiento(db, clienteId, hoy.toISOString().slice(0, 10))

  const { data: plan } = await db.from('planes_entrenamiento').select('nombre, created_at, duracion_semanas').eq('cliente_id', clienteId).eq('activo', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
  let planInfo: DatosInforme['plan'] = null
  if (plan) {
    const b = plan.duracion_semanas ? calcularEstadoBloque(plan.created_at as string, plan.duracion_semanas as number, hoy) : null
    planInfo = { nombre: plan.nombre as string, semanaActual: b?.semanaActual ?? null, semanasTotales: b?.semanasTotales ?? null, diasRestantes: b?.diasRestantes ?? null }
  }

  const { data: an } = await db.from('agente_tareas').select('payload').eq('cliente_id', clienteId).eq('tipo', 'analisis_rendimiento').in('estado', ['pendiente', 'en_revision', 'aprobado', 'aplicado', 'modificado']).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const { data: pr } = await db.from('agente_tareas').select('payload').eq('cliente_id', clienteId).eq('tipo', 'plan_entreno_ia').in('estado', ['pendiente', 'en_revision']).order('created_at', { ascending: false }).limit(1).maybeSingle()

  return {
    nombre,
    atleta: atletaDesdeEstado(ctx.estado, ctx.alertas, ctx.hayDatos),
    plan: planInfo,
    analisis: (an?.payload as DatosInforme['analisis']) ?? null,
    propuesta: (pr?.payload as PayloadPlanEntrenoIA) ?? null,
  }
}
```

- [ ] **Step 4: Ejecutar** `npx tsx scripts/informe-caso-datos.test.ts && npx tsc --noEmit --pretty false` → `informe-caso-datos.test OK`, sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add lib/informe-caso/datos.ts scripts/informe-caso-datos.test.ts
git commit -m "feat: reunir los datos reales del informe del caso (solo lectura; lo que falta queda en null)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Página imprimible (PDF)

**Files:**
- Create: `lib/informe-caso/html.ts`
- Test: `scripts/informe-caso-html.test.ts`

**Interfaces:**
- Consumes: `InformeCaso`, `escapeHtml` de `@/lib/html/escape`.
- Produces: `htmlInformeCaso(i: InformeCaso, fecha?: Date): string` (documento HTML completo, listo para imprimir).

- [ ] **Step 1: Test que falla** — `scripts/informe-caso-html.test.ts`

```ts
import assert from 'node:assert/strict'
import { htmlInformeCaso } from '../lib/informe-caso/html'
import { construirInformeCaso, type DatosInforme } from '../lib/informe-caso/construir'

const datos = (nombre: string): DatosInforme => ({
  nombre,
  atleta: { hayDatos: true, minutosCarreraSemana: 89, salidasSemana: 3.5, pctSuave: 36, forma: 16, fatiga: 17.3, frescura: -1.3, sesionesEvaluadas: 6, sesionesSaltadas: 2, retorno: false, vdot: 45, fuerzaRegistrada: 0, fuerzaEnPlan: 3, alertasAltas: [] },
  plan: { nombre: 'Plan <b>raro</b>', semanaActual: 2, semanasTotales: 4, diasRestantes: 18 }, analisis: null, propuesta: null,
})

const html = htmlInformeCaso(construirInformeCaso(datos('Carlos "El Rápido" <script>alert(1)</script> Casanova')), new Date(2026, 9, 10))
assert.ok(html.startsWith('<!doctype html>'))
assert.ok(!html.includes('<script'), 'sin etiquetas script')
assert.ok(!html.includes('<b>raro</b>'), 'el HTML del plan va escapado')
assert.ok(html.includes('&lt;b&gt;raro&lt;/b&gt;'))
assert.ok(html.includes('&quot;El Rápido&quot;'))
for (const seccion of ['Dónde está', 'Qué cambia', 'Por qué', 'Lo que no sé', 'Mensaje para el cliente', 'Guion de llamada', 'Preguntas']) assert.ok(html.includes(seccion), seccion)
assert.ok(html.includes('@media print'))
assert.ok(html.includes('10-10-2026'), 'fecha en formato DD-MM-AAAA')
console.log('informe-caso-html.test OK')
```

- [ ] **Step 2: Ejecutar y ver que falla** (`npx tsx scripts/informe-caso-html.test.ts`).

- [ ] **Step 3: Implementar** — `lib/informe-caso/html.ts`

```ts
// lib/informe-caso/html.ts
// Página imprimible del informe (el coach la abre y la guarda como PDF o la imprime). Todo el contenido va escapado.
import { escapeHtml as e } from '@/lib/html/escape'
import type { InformeCaso } from './construir'

const fechaDDMMAAAA = (d: Date) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
const lista = (items: string[]) => `<ul>${items.map(x => `<li>${e(x)}</li>`).join('')}</ul>`

export function htmlInformeCaso(i: InformeCaso, fecha: Date = new Date()): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Informe del caso · ${e(i.cliente)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#1b1b1f;line-height:1.5}
  h1{font-size:22px;margin:0}h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}
  .meta{color:#666;font-size:13px}ul{margin:4px 0;padding-left:20px}li{margin:2px 0}
  .caja{background:#f5f5f7;border-radius:8px;padding:10px 12px;white-space:pre-wrap}
  .origen{color:#666;font-size:12px}
  @media print{body{margin:0;max-width:none}h2{break-after:avoid}.caja{break-inside:avoid}}
</style></head><body>
<h1>${e(i.cliente)}</h1>
<p class="meta">${e(i.situacion.titulo)} · ${fechaDDMMAAAA(fecha)}${i.plan ? ` · ${e(i.plan)}` : ''}</p>
<h2>Dónde está</h2>
${i.situacion.datos.length ? lista(i.situacion.datos.map(d => `${d.etiqueta}: ${d.valor}`)) : '<p>Sin datos recientes del reloj.</p>'}
<h2>Qué cambia</h2>${lista(i.cambios)}
<h2>Por qué</h2>${i.porQue.length ? `<ul>${i.porQue.map(p => `<li>${e(p.texto)} <span class="origen">(${e(p.origen)})</span></li>`).join('')}</ul>` : '<p>Mantener el plan es lo que indican sus datos.</p>'}
<h2>Lo que no sé</h2>${i.loQueNoSe.length ? lista(i.loQueNoSe) : '<p>Nada relevante: hay datos para todo lo anterior.</p>'}
<h2>Mensaje para el cliente</h2><p class="caja">${e(i.mensaje)}</p>
<h2>Guion de llamada</h2><ol>${i.guion.map(g => `<li><strong>${e(g.paso)}.</strong> ${e(g.texto)}</li>`).join('')}</ol>
<h2>Preguntas</h2>${lista(i.preguntas)}
</body></html>`
}
```

- [ ] **Step 4: Ejecutar** `npx tsx scripts/informe-caso-html.test.ts` → `informe-caso-html.test OK`.

- [ ] **Step 5: Commit**

```bash
git add lib/informe-caso/html.ts scripts/informe-caso-html.test.ts
git commit -m "feat: página imprimible del informe del caso con el contenido escapado

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Ruta `/api/clientes/[id]/informe-caso`

**Files:**
- Create: `app/api/clientes/[id]/informe-caso/route.ts`

**Interfaces:**
- Consumes: `autorizarCoachCliente(db, { userId, clienteId })`, `reunirDatosInforme`, `construirInformeCaso`, `htmlInformeCaso`, `validarCuerpoPlanificar` (valida el UUID).
- Produces: `GET` → JSON `InformeCaso`, o con `?formato=html` una página `text/html`.

- [ ] **Step 1: Crear la ruta**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { validarCuerpoPlanificar } from '@/lib/entrenos/planificar-con-ia'
import { reunirDatosInforme } from '@/lib/informe-caso/datos'
import { construirInformeCaso } from '@/lib/informe-caso/construir'
import { htmlInformeCaso } from '@/lib/informe-caso/html'

export const maxDuration = 60

/** Informe del caso para que el coach explique la situación al cliente. Solo lectura, solo coach. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const v = validarCuerpoPlanificar({ cliente_id: id })
    if (!v.ok) return NextResponse.json({ error: 'Cliente no válido' }, { status: 400 })

    const { data: { user } } = await createApiSupabase(req).auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const db = createServiceSupabase()
    const a = await autorizarCoachCliente(db, { userId: user.id, clienteId: v.clienteId })
    if (!a.ok) return NextResponse.json({ error: a.mensaje }, { status: a.status })

    const datos = await reunirDatosInforme(db, v.clienteId)
    if (!datos) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    const informe = construirInformeCaso(datos)

    if (new URL(req.url).searchParams.get('formato') === 'html') {
      return new NextResponse(htmlInformeCaso(informe), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json(informe, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('informe-caso error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar tipos y seguridad en local**

Run: `npx tsc --noEmit --pretty false` (sin errores). Con `npm run dev` en segundo plano:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/clientes/04cc53b3-851e-43f9-b271-daf1577b743e/informe-caso
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/clientes/no-es-uuid/informe-caso
```
Expected: `401` y `400`. Después `pkill -f "next dev"`.

- [ ] **Step 3: Probar con datos reales (solo lectura, sin pasar por la ruta)** — `scripts/informe-caso-real.ts`:

```ts
// Construye el informe de un cliente real con la lógica de la ruta (solo lectura) y lo imprime. Uso: npx tsx scripts/informe-caso-real.ts <prefijo-id>
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
async function main() {
  const { reunirDatosInforme } = await import('../lib/informe-caso/datos')
  const { construirInformeCaso } = await import('../lib/informe-caso/construir')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data } = await db.from('clientes').select('id')
  const id = (data ?? []).find(c => String(c.id).startsWith(process.argv[2] ?? '04cc53b3'))?.id
  const datos = await reunirDatosInforme(db, id as string)
  console.log(JSON.stringify(construirInformeCaso(datos!), null, 2))
}
main()
```
Run: `npx tsx scripts/informe-caso-real.ts 04cc53b3`
Expected: JSON con `escenario: "ajustes"` o `"sin_cambios"`, `mensaje` que empieza por «Hola Carlos», sin `undefined`, y «Lo que no sé» con la fuerza sin registrar.

- [ ] **Step 4: Commit**

```bash
git add "app/api/clientes/[id]/informe-caso/route.ts" scripts/informe-caso-real.ts
git commit -m "feat: ruta del informe del caso (JSON o página imprimible) solo para el coach del cliente

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Interfaz — botón y panel

**Files:**
- Create: `components/clientes/InformeCaso.tsx`, `scripts/informe-caso-render.test.ts`
- Modify: `app/clientes/[id]/page.tsx` (una línea junto a `PlanificarConIA`)

**Interfaces:**
- Consumes: `GET /api/clientes/[id]/informe-caso`; `InformeCaso` (tipo).
- Produces: `<InformeCaso clienteId />`; `PanelInformeCaso({ informe, clienteId })` exportado para el test.

- [ ] **Step 1: Test de renderizado que falla** — `scripts/informe-caso-render.test.ts`

```ts
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PanelInformeCaso } from '../components/clientes/InformeCaso'
import { construirInformeCaso } from '../lib/informe-caso/construir'

const informe = construirInformeCaso({
  nombre: 'Carlos Casanova', plan: { nombre: 'Plan', semanaActual: 2, semanasTotales: 4, diasRestantes: 18 }, analisis: null, propuesta: null,
  atleta: { hayDatos: true, minutosCarreraSemana: 89, salidasSemana: 3.5, pctSuave: 36, forma: 16, fatiga: 17.3, frescura: -1.3, sesionesEvaluadas: 6, sesionesSaltadas: 2, retorno: false, vdot: 45, fuerzaRegistrada: 0, fuerzaEnPlan: 3, alertasAltas: [] },
})
const html = renderToStaticMarkup(createElement(PanelInformeCaso, { informe, clienteId: 'abc' }))
for (const t of ['Mensaje', 'Guion', 'Resumen', 'PDF', 'Copiar', informe.mensaje.slice(0, 30)]) assert.ok(html.includes(t), t)
assert.ok(html.includes('/api/clientes/abc/informe-caso?formato=html'), 'el PDF abre la página imprimible')
console.log('informe-caso-render.test OK')
```
Run: `npx tsx scripts/informe-caso-render.test.ts` → FAIL (componente inexistente).

- [ ] **Step 2: Implementar** — `components/clientes/InformeCaso.tsx`

```tsx
'use client'

import { useState } from 'react'
import { Loader2, MessageSquareText } from 'lucide-react'
import type { InformeCaso as Informe } from '@/lib/informe-caso/construir'

// Estructura y contenido; el acabado visual lo pule Codex. Todo el texto sale de lib/informe-caso/construir.ts.
type Pestana = 'mensaje' | 'guion' | 'resumen' | 'pdf'
const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: 'mensaje', texto: 'Mensaje' }, { id: 'guion', texto: 'Guion' }, { id: 'resumen', texto: 'Resumen' }, { id: 'pdf', texto: 'PDF' },
]

async function copiar(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true } catch { return false }
}

export function PanelInformeCaso({ informe, clienteId }: { informe: Informe; clienteId: string }) {
  const [pestana, setPestana] = useState<Pestana>('mensaje')
  const [copiado, setCopiado] = useState(false)
  const textoGuion = informe.guion.map(g => `${g.paso}: ${g.texto}`).join('\n')

  async function pulsarCopiar(texto: string) {
    setCopiado(await copiar(texto))
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="space-y-3 text-sm" style={{ color: 'var(--text)' }}>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{informe.situacion.titulo}{informe.plan ? ` · ${informe.plan}` : ''}</p>
      <div className="flex flex-wrap gap-1" role="tablist">
        {PESTANAS.map(p => (
          <button key={p.id} role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)} className={pestana === p.id ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}>{p.texto}</button>
        ))}
      </div>

      {pestana === 'mensaje' && (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>{informe.mensaje}</p>
          <button className="btn-secondary btn-sm" onClick={() => pulsarCopiar(informe.mensaje)}>{copiado ? 'Copiado' : 'Copiar'}</button>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Revísalo y cámbialo a tu estilo antes de enviarlo. No se envía nada solo.</p>
        </div>
      )}

      {pestana === 'guion' && (
        <div className="space-y-2">
          <ol className="space-y-2">{informe.guion.map((g, i) => <li key={i}><strong>{g.paso}.</strong> {g.texto}</li>)}</ol>
          <p className="text-xs font-semibold">Preguntas para hacerle</p>
          <ul className="list-disc pl-5 text-xs">{informe.preguntas.map((q, i) => <li key={i}>{q}</li>)}</ul>
          <button className="btn-secondary btn-sm" onClick={() => pulsarCopiar(textoGuion)}>{copiado ? 'Copiado' : 'Copiar'}</button>
        </div>
      )}

      {pestana === 'resumen' && (
        <div className="space-y-3">
          <section><p className="text-xs font-semibold">Dónde está</p>
            {informe.situacion.datos.length ? <ul className="list-disc pl-5 text-xs">{informe.situacion.datos.map((d, i) => <li key={i}>{d.etiqueta}: {d.valor}</li>)}</ul> : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin datos recientes del reloj.</p>}
          </section>
          <section><p className="text-xs font-semibold">Qué cambia</p><ul className="list-disc pl-5 text-xs">{informe.cambios.map((c, i) => <li key={i}>{c}</li>)}</ul></section>
          {informe.porQue.length > 0 && <section><p className="text-xs font-semibold">Por qué</p><ul className="list-disc pl-5 text-xs">{informe.porQue.map((p, i) => <li key={i}>{p.texto} <span style={{ color: 'var(--text-muted)' }}>({p.origen})</span></li>)}</ul></section>}
          <section><p className="text-xs font-semibold">Lo que no sé</p>
            {informe.loQueNoSe.length ? <ul className="list-disc pl-5 text-xs">{informe.loQueNoSe.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nada relevante: hay datos para todo lo anterior.</p>}
          </section>
        </div>
      )}

      {pestana === 'pdf' && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Se abre una página lista para imprimir o guardar como PDF y enviarla.</p>
          <a className="btn-secondary btn-sm inline-block" href={`/api/clientes/${clienteId}/informe-caso?formato=html`} target="_blank" rel="noreferrer">Abrir página para PDF</a>
        </div>
      )}
    </div>
  )
}

export default function InformeCaso({ clienteId }: { clienteId: string }) {
  const [abierto, setAbierto] = useState(false)
  const [informe, setInforme] = useState<Informe | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function alternar() {
    if (abierto) { setAbierto(false); return }
    setAbierto(true)
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/clientes/${clienteId}/informe-caso`, { cache: 'no-store' })
      if (!r.ok) throw new Error()
      setInforme(await r.json())
    } catch { setError('No se pudo preparar el informe. Inténtalo de nuevo.') } finally { setCargando(false) }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button className="btn-secondary btn-sm" onClick={alternar} aria-expanded={abierto}>
        {cargando ? <Loader2 size={13} className="animate-spin" /> : <MessageSquareText size={13} />} Preparar conversación
      </button>
      {abierto && (
        <div className="w-full rounded-2xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          {error && <p className="text-xs" role="alert">{error}</p>}
          {informe && <PanelInformeCaso informe={informe} clienteId={clienteId} />}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Enchufar en la ficha** — en `app/clientes/[id]/page.tsx` añadir junto a los demás `dynamic`:
`const InformeCaso = dynamic(() => import('@/components/clientes/InformeCaso'), { ssr: false, loading: () => <TabSkeleton /> })`
y, justo debajo de `<PlanificarConIA clienteId={id as string} />`, la línea `<InformeCaso clienteId={id as string} />`.

- [ ] **Step 4: Verificar**

Run: `npx tsx scripts/informe-caso-render.test.ts && npx tsc --noEmit --pretty false && npx eslint components/clientes/InformeCaso.tsx lib/informe-caso "app/api/clientes/[id]/informe-caso/route.ts" && node scripts/audit-portal-patterns.mjs`
Expected: `informe-caso-render.test OK`, sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/clientes/InformeCaso.tsx scripts/informe-caso-render.test.ts "app/clientes/[id]/page.tsx"
git commit -m "feat: botón «Preparar conversación» con mensaje, guion, resumen y página para PDF

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verificación, documentación y prueba con Carlos

**Files:**
- Modify: `scripts/verificar-motor.ts`, `CLAUDE.md` (sesión), `docs/10-10-2026_siguientes-tareas.md`
- Create: `docs/10-10-2026_traspaso-codex-informe-caso.md`

- [ ] **Step 1: Registrar los tests** en `TESTS` de `scripts/verificar-motor.ts`: `'informe-caso', 'informe-caso-datos', 'informe-caso-html', 'informe-caso-render'`.
Run: `npm run verificar:motor` → todo ✅. Run: `npm run build` → compila.

- [ ] **Step 2: Nota para Codex** — `docs/10-10-2026_traspaso-codex-informe-caso.md` con: qué es (solo coach, versión de prueba), los archivos, la regla de oro (los textos viven en `lib/informe-caso/construir.ts` y su test; los componentes solo pintan), qué pulir (panel con pestañas en móvil, botón «Copiar» y su estado, legibilidad del mensaje, la página imprimible `lib/informe-caso/html.ts` con su CSS de impresión), y qué no cambiar sin avisar (plantillas, «Lo que no sé»). Anotar también cómo quitar la función (borrar `lib/informe-caso/`, `app/api/clientes/[id]/informe-caso/`, `components/clientes/InformeCaso.tsx` y la línea de la ficha).

- [ ] **Step 3: Documentar** — en `CLAUDE.md` del proyecto una sección de sesión («Informe del caso»: qué es, dónde está, prueba, cómo quitarlo) y marcar en `docs/10-10-2026_siguientes-tareas.md` la tarea 8b como «hecha (prueba)».

- [ ] **Step 4: Commit y push**

```bash
git add scripts/verificar-motor.ts CLAUDE.md docs/10-10-2026_siguientes-tareas.md docs/10-10-2026_traspaso-codex-informe-caso.md
git commit -m "docs: informe del caso en la verificación del motor, CLAUDE.md y traspaso a Codex

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push origin main
```
Esperar a que Vercel marque el despliegue `Ready` (`vercel ls`).

- [ ] **Step 5: Prueba en vivo con Carlos** (él inicia sesión): ficha de Carlos → Entrenamiento → «Preparar conversación» → recorrer las cuatro pestañas; el mensaje debe empezar «Hola Carlos», usar sus datos reales (89 min, 36 % en suave…) y «Lo que no sé» debe decir que no hay fuerza registrada. Apuntar qué le sobra y qué le falta para decidir qué se queda.

---

## Self-Review (hecho al escribir)

- **Spec coverage:** §4.1 módulo → Task 1; datos → Task 2; PDF imprimible → Task 3; ruta → Task 4; interfaz y botón → Task 5; pruebas, traspaso, cómo quitarlo y prueba en vivo → Task 6.
- **Placeholders:** ninguno; el texto de la nota para Codex (Task 6 Step 2) es redacción libre con contenido definido en el propio paso.
- **Consistencia de tipos:** `DatosInforme`/`InformeCaso` (Task 1) los usan Tasks 2, 3, 4 y 5; `atletaDesdeEstado` (Task 2) produce `DatosInforme['atleta']`; `validarCuerpoPlanificar` ya existe (`lib/entrenos/planificar-con-ia.ts`).
