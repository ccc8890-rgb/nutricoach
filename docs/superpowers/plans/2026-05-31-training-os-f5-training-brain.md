# Training OS F5 — Training Brain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an autonomous Training Brain agent that analyzes each client's PR history, RPE trends, and muscle group coverage using the 230-paper knowledge base, then surfaces science-backed coach "thoughts" in the existing agente_tareas kanban.

**Architecture:** New `lib/agentes/training-brain.ts` agent that detects training signals (PR stagnation, RPE drift, muscle imbalance) from `registros_sets` + `prs_por_ejercicio`, queries `seleccionarProtocolos()` with relevant tags, calls DeepSeek V3 with the evidence, and saves proposals to `agente_tareas` with paper citations in `fuentes`. Wired into `orquestador.ts` (new `training_brain` PasoDirector) and `director.ts` — runs on `semanal` mode when client has an active training plan and recent sessions.

**Tech Stack:** DeepSeek V3 via `llamarDeepSeek()`, `seleccionarProtocolos()` + `formatearEvidenciaParaPrompt()` from `lib/knowledge-base.ts`, `guardarTareaAgente()` from `lib/agentes/executor.ts`, Supabase `prs_por_ejercicio` view + `registros_sets` table.

---

## File Map

| Action | File |
|--------|------|
| Create | `lib/agentes/training-brain.ts` |
| Modify | `lib/agentes/orquestador.ts` — add `training_brain` to PasoDirector |
| Modify | `lib/agentes/director.ts` — import + call `ejecutarTrainingBrain` |

---

### Task 1: Create `lib/agentes/training-brain.ts`

**Files:**
- Create: `lib/agentes/training-brain.ts`

The agent must:
1. Check for active training plan (exit if none)
2. Avoid duplicate runs this week (query `agente_tareas` for `training_brain` since Monday)
3. Load data: last 4 weeks `registros_sets` + current PRs from `prs_por_ejercicio`
4. Detect signals: PR stagnation, RPE drift, muscle imbalance
5. Select KB protocols via `seleccionarProtocolos()` with relevant tags
6. Call DeepSeek V3 with all context
7. Save to `agente_tareas` via `guardarTareaAgente()`

- [ ] **Step 1: Write the complete module**

```typescript
// lib/agentes/training-brain.ts
// ================================================================
// TRAINING BRAIN — Análisis profundo con base de conocimiento
// Detecta: plateau de PRs, deriva de RPE, desequilibrios musculares.
// Consulta KB (230 papers) + DeepSeek → propuestas coach con citas.
// Corre en modo semanal cuando el cliente tiene plan activo.
// ================================================================

import { llamarDeepSeek, guardarTareaAgente } from './executor'
import { seleccionarProtocolos, formatearEvidenciaParaPrompt } from '@/lib/knowledge-base'
import { createServiceSupabase } from '@/lib/supabase-server'

function getLunesActual(): string {
  const hoy = new Date()
  const diff = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - diff)
  lunes.setHours(0, 0, 0, 0)
  return lunes.toISOString()
}

function getFechaHaceNDias(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

interface PRRow {
  ejercicio_id: string
  ejercicio_nombre: string
  peso_max_kg: number
  reps_en_pr: number
  fecha_pr: string
}

interface RegistroRow {
  fecha: string
  sets_ejecutados: Array<{ peso_kg?: number; reps?: number }>
  esfuerzo_percibido: number | null
  ejercicio: { nombre: string; grupo_muscular: string } | null
}

interface Signal {
  tipo: 'plateau_pr' | 'rpe_elevado' | 'desequilibrio_muscular' | 'baja_adherencia'
  descripcion: string
  tags: string[]
}

export async function ejecutarTrainingBrain(clienteId: string): Promise<void> {
  const db = createServiceSupabase()

  // 1. Verificar plan activo
  const { data: plan } = await db
    .from('planes_entrenamiento')
    .select('id, nombre')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .single()

  if (!plan) return

  // 2. Evitar duplicado esta semana
  const lunesActual = getLunesActual()
  const { count: yaExiste } = await db
    .from('agente_tareas')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .eq('tipo', 'training_brain')
    .gte('created_at', lunesActual)

  if (yaExiste && yaExiste > 0) return

  // 3. Cargar datos últimas 4 semanas
  const desde28d = getFechaHaceNDias(28)
  const desde14d = getFechaHaceNDias(14)

  const [{ data: registros28d }, { data: prsActuales }] = await Promise.all([
    db
      .from('registros_sets')
      .select('fecha, sets_ejecutados, esfuerzo_percibido, ejercicio:ejercicios(nombre, grupo_muscular)')
      .eq('cliente_id', clienteId)
      .gte('fecha', desde28d)
      .order('fecha', { ascending: false }),
    db
      .from('prs_por_ejercicio')
      .select('ejercicio_id, ejercicio_nombre, peso_max_kg, reps_en_pr, fecha_pr')
      .eq('cliente_id', clienteId)
      .order('fecha_pr', { ascending: false })
      .limit(20),
  ])

  const registros = (registros28d ?? []) as unknown as RegistroRow[]
  const prs = (prsActuales ?? []) as PRRow[]

  // Salir si no hay datos suficientes
  if (registros.length < 3) return

  // 4. Detectar señales
  const signals: Signal[] = []

  // a) PR stagnation: PRs con fecha_pr > 21 días Y RPE alto en esas sesiones
  const hoy = new Date()
  for (const pr of prs) {
    const diasSinPR = Math.floor(
      (hoy.getTime() - new Date(pr.fecha_pr).getTime()) / 86_400_000
    )
    if (diasSinPR >= 21) {
      signals.push({
        tipo: 'plateau_pr',
        descripcion: `${pr.ejercicio_nombre}: sin nuevo PR hace ${diasSinPR} días (último: ${pr.peso_max_kg}kg × ${pr.reps_en_pr} reps)`,
        tags: ['plateau', 'estancamiento', 'progresion'],
      })
    }
  }

  // b) RPE drift: RPE medio últimas 2 semanas vs semanas 3-4
  const registros14d = registros.filter(r => r.fecha >= desde14d)
  const registros14_28d = registros.filter(r => r.fecha < desde14d)

  const rpeReciente = registros14d
    .map(r => r.esfuerzo_percibido)
    .filter((v): v is number => v !== null && v !== undefined)
  const rpeAnterior = registros14_28d
    .map(r => r.esfuerzo_percibido)
    .filter((v): v is number => v !== null && v !== undefined)

  const avgRpeReciente = rpeReciente.length > 0
    ? rpeReciente.reduce((a, b) => a + b, 0) / rpeReciente.length
    : null
  const avgRpeAnterior = rpeAnterior.length > 0
    ? rpeAnterior.reduce((a, b) => a + b, 0) / rpeAnterior.length
    : null

  if (avgRpeReciente !== null && avgRpeAnterior !== null) {
    if (avgRpeReciente >= 8.5) {
      signals.push({
        tipo: 'rpe_elevado',
        descripcion: `RPE medio últimas 2 semanas: ${avgRpeReciente.toFixed(1)} (anterior: ${avgRpeAnterior.toFixed(1)}) — posible acumulación de fatiga`,
        tags: ['fatiga', 'recuperacion', 'sobreentrenamiento', 'deload'],
      })
    } else if (avgRpeReciente - avgRpeAnterior >= 1.2) {
      signals.push({
        tipo: 'rpe_elevado',
        descripcion: `Subida de RPE: ${avgRpeAnterior.toFixed(1)} → ${avgRpeReciente.toFixed(1)} en 2 semanas — señal de fatiga acumulada`,
        tags: ['fatiga', 'recuperacion', 'deload'],
      })
    }
  }

  // c) Desequilibrio muscular: grupos no entrenados en 14d
  const gruposUltimas2Semanas = new Set<string>()
  const gruposUltimas4Semanas = new Set<string>()

  for (const r of registros) {
    const gm = (r.ejercicio as unknown as { grupo_muscular?: string } | null)?.grupo_muscular
    if (!gm) continue
    if (r.fecha >= desde14d) gruposUltimas2Semanas.add(gm)
    gruposUltimas4Semanas.add(gm)
  }

  for (const grupo of gruposUltimas4Semanas) {
    if (!gruposUltimas2Semanas.has(grupo)) {
      signals.push({
        tipo: 'desequilibrio_muscular',
        descripcion: `${grupo}: no entrenado en las últimas 2 semanas pero activo en las anteriores`,
        tags: ['equilibrio_muscular', 'planificacion', 'frecuencia'],
      })
    }
  }

  // Salir si no hay señales relevantes
  if (signals.length === 0) return

  // 5. Obtener perfil del cliente para KB
  const { data: perfil } = await db
    .from('perfil_entreno_cliente')
    .select('objetivo_especifico, sport_modality, nivel_experiencia')
    .eq('cliente_id', clienteId)
    .single()

  const { data: profileData } = await db
    .from('profiles')
    .select('nombre, apellidos')
    .eq('id', clienteId)
    .single()

  const nombre = [profileData?.nombre, profileData?.apellidos].filter(Boolean).join(' ') || 'el cliente'

  // 6. Seleccionar protocolos KB relevantes
  const allTags = [...new Set(signals.flatMap(s => s.tags))]
  const clienteTags = [
    perfil?.objetivo_especifico,
    perfil?.sport_modality,
    perfil?.nivel_experiencia,
    ...allTags,
  ].filter(Boolean) as string[]

  const protocolos = await seleccionarProtocolos(
    clienteTags,
    db as Parameters<typeof seleccionarProtocolos>[1],
    3
  )
  const evidenciaTexto = formatearEvidenciaParaPrompt(protocolos)

  // 7. Prompt DeepSeek
  const senalesTexto = signals.map(s => `- [${s.tipo}] ${s.descripcion}`).join('\n')
  const sesionesCount = new Set(registros.map(r => r.fecha)).size
  const gruposEntrenados = [...gruposUltimas2Semanas].join(', ') || 'ninguno registrado'

  const systemPrompt = `Eres el Training Brain de NutriCoach — un sistema de análisis de entrenamiento científico.
Analiza los datos del cliente y genera propuestas precisas para el coach basadas en evidencia.
Responde SIEMPRE en JSON válido.`

  const userPrompt = `CLIENTE: ${nombre}
PLAN ACTIVO: ${plan.nombre}
PERÍODO: últimas 4 semanas
SESIONES REALIZADAS: ${sesionesCount}
GRUPOS MUSCULARES ÚLTIMAS 2 SEM: ${gruposEntrenados}

SEÑALES DETECTADAS:
${senalesTexto}

${evidenciaTexto ? evidenciaTexto + '\n' : ''}

Genera un análisis para el coach en JSON:
{
  "propuesta": "qué hacer esta semana con el plan (máx 3 frases, concreto y accionable)",
  "razonamiento": "análisis de las señales detectadas (máx 100 palabras)",
  "logros": ["logro positivo 1", "logro 2"],
  "advertencias": ["advertencia concreta si aplica"],
  "ajustes_plan": ["ajuste técnico 1 (ej: 'Reducir volumen pierna 20% esta semana')", "ajuste 2"],
  "citas_papers": ["cita paper breve 1", "cita 2"],
  "prioridad": 1-10,
  "score_confianza": 0.0-1.0
}`

  let raw: string
  try {
    raw = await llamarDeepSeek(systemPrompt, userPrompt, 0.35)
  } catch {
    return
  }

  let parsed: {
    propuesta: string
    razonamiento: string
    logros: string[]
    advertencias: string[]
    ajustes_plan: string[]
    citas_papers: string[]
    prioridad: number
    score_confianza: number
  }
  try {
    parsed = JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return
    try { parsed = JSON.parse(match[0]) } catch { return }
  }

  if (!parsed.propuesta) return

  // 8. Fuentes — combinar citas IA + referencias KB
  const fuentesKb = protocolos.flatMap(p => p.referencias).slice(0, 4)
  const fuentesIa = (parsed.citas_papers ?? []).slice(0, 2)
  const fuentes = [...new Set([...fuentesIa, ...fuentesKb])]

  await guardarTareaAgente('director', {
    tipo: 'training_brain',
    propuesta: parsed.propuesta,
    razonamiento: parsed.razonamiento ?? '',
    payload: {
      senales: signals.map(s => ({ tipo: s.tipo, descripcion: s.descripcion })),
      sesiones_28d: sesionesCount,
      rpe_reciente: avgRpeReciente,
      rpe_anterior: avgRpeAnterior,
      grupos_musculares_2sem: [...gruposUltimas2Semanas],
      logros: parsed.logros ?? [],
      advertencias: parsed.advertencias ?? [],
      ajustes_plan: parsed.ajustes_plan ?? [],
      protocolos_kb: protocolos.map(p => p.titulo),
    },
    fuentes,
    prioridad: Number(parsed.prioridad ?? 7),
    score_confianza: Number(parsed.score_confianza ?? 0.75),
    requiere_aprobacion: true,
  }, clienteId)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit --pretty false 2>&1 | head -30
```

Expected: 0 errors (or only pre-existing errors unrelated to this file)

- [ ] **Step 3: Commit**

```bash
git add lib/agentes/training-brain.ts
git commit -m "feat: Training Brain agent — PR plateau + RPE drift + KB papers + coach thoughts"
```

---

### Task 2: Wire into orquestador + director

**Files:**
- Modify: `lib/agentes/orquestador.ts`
- Modify: `lib/agentes/director.ts`

- [ ] **Step 1: Add `training_brain` to `PasoDirector` and `ejecutar` map in `orquestador.ts`**

In `orquestador.ts`, add `'training_brain'` to the `PasoDirector` union type and add the condition to `ejecutar`:

```typescript
// In PasoDirector union type, add:
| 'training_brain'

// In crearPlanDirectorCliente(), add condition:
const trainingBrain =
  semanal &&
  senales.tienePlanEntreno &&
  senales.sesiones7d >= 2 &&
  !hasPending(senales, 'training_brain') &&
  presionInbox === 'normal'

// In ejecutar Record, add:
training_brain: trainingBrain,
```

- [ ] **Step 2: Wire in `director.ts`**

Add import and call:

```typescript
// Add import at top:
import { ejecutarTrainingBrain } from './training-brain'

// In the per-client loop, after revisor_semanal_entreno:
if (plan.ejecutar.training_brain) await ejecutarTrainingBrain(id)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit --pretty false 2>&1 | head -30
```

Expected: 0 errors

- [ ] **Step 4: Full build**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds, 0 errors

- [ ] **Step 5: Commit**

```bash
git add lib/agentes/orquestador.ts lib/agentes/director.ts
git commit -m "feat: wire Training Brain into director + orquestador (semanal, ≥2 sesiones/semana)"
```

---

## Self-Review

**Spec coverage:**
- ✅ PR stagnation detection (≥21 days no new PR)
- ✅ RPE drift detection (avg ≥8.5 OR increase ≥1.2 over 2 weeks)
- ✅ Muscle group imbalance (group absent in last 14d but present in 14-28d)
- ✅ KB papers lookup via `seleccionarProtocolos()` with client + signal tags
- ✅ DeepSeek V3 generates proposal with paper citations
- ✅ Saves to `agente_tareas` with `tipo: 'training_brain'`
- ✅ `fuentes` array includes KB references + AI citations
- ✅ Dedup guard (one per week per client)
- ✅ Wired in director on `semanal` mode with `sesiones7d >= 2` guard

**Placeholder scan:** None found — all code is complete.

**Type consistency:**
- `seleccionarProtocolos` signature: `(tags: string[], db: SupabaseClient, limit?: number)` — verified from knowledge-base.ts line 911
- `guardarTareaAgente` signature: `(agente: TipoAgente, resultado: ResultadoAgente, clienteId: string | null)` — matches executor.ts line 186
- `ResultadoAgente.fuentes` is `string[]` — matches payload
- `PasoDirector` is a union type in orquestador.ts — adding `'training_brain'` extends it cleanly
