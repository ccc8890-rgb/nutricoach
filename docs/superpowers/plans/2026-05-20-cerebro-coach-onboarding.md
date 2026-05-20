# Cerebro del Coach + Onboarding Inteligente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar al motor de generación de planes acceso a la metodología personal del coach, integrar recetas reales del recetario en cada plan generado, y añadir señales nuevas al sistema auto-coach (último acceso al portal + días sin entreno).

**Architecture:** Tres piezas independientes que comparten el mismo flujo: (1) `metodologia_coach` tabla BD → inyectada en el prompt de IA como contexto adicional; (2) post-generación del plan, asociar recetas del recetario a cada slot de comida via `/api/recetas/sugeridas`; (3) ampliar `lib/auto-coach.ts` con señales de inactividad de portal y entreno.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL + service_role), TypeScript, DeepSeek (deepseek-chat), CSS variables NutriCoach

---

## File Map

| Acción | Archivo | Responsabilidad |
|--------|---------|-----------------|
| CREATE | `app/api/metodologia-coach/route.ts` | GET + PUT metodología del coach |
| CREATE | `app/coach/metodologia/page.tsx` | UI editable de la metodología |
| MODIFY | `app/api/generar-plan-inicial/route.ts` | Leer metodología + asociar recetas tras generar |
| MODIFY | `lib/auto-coach.ts` | Añadir señales sin_actividad_portal + sin_entreno |
| MODIFY | `types/index.ts` | Tipos MetodologiaCoach + TipoRecomendacion extendido |
| MODIFY | `components/Sidebar.tsx` | Añadir enlace "Mi metodología" en menú |
| MODIFY | `app/cliente/layout.tsx` o `app/cliente/page.tsx` | Registrar last_portal_access |

---

## Task 1: SQL — Tabla metodologia_coach + columna last_portal_access

**Files:**
- Run SQL in Supabase dashboard or via MCP

- [ ] **Step 1.1: Aplicar migración en Supabase**

Ejecutar este SQL en el editor de Supabase (SQL Editor → New query):

```sql
-- Tabla metodología del coach
CREATE TABLE IF NOT EXISTS metodologia_coach (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  proteina_perdida_grasa numeric DEFAULT 2.2,
  proteina_recomposicion numeric DEFAULT 2.0,
  proteina_rendimiento numeric DEFAULT 1.8,
  proteina_ganancia_musculo numeric DEFAULT 2.0,
  proteina_salud_general numeric DEFAULT 1.0,
  reglas_fijas text[] DEFAULT ARRAY[]::text[],
  estilos_dieta text[] DEFAULT ARRAY['mediterraneo','flexible']::text[],
  filosofia_coaching text DEFAULT '',
  num_comidas_default int DEFAULT 4,
  deficit_maximo_kcal int DEFAULT 500,
  superavit_maximo_kcal int DEFAULT 400,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE metodologia_coach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach gestiona su metodología" ON metodologia_coach
  FOR ALL USING (coach_id = auth.uid());

-- Columna last_portal_access en clientes (para señal inactividad)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS last_portal_access timestamptz;
```

- [ ] **Step 1.2: Verificar en Supabase Table Editor**

Confirmar que la tabla `metodologia_coach` aparece con las columnas definidas y RLS activado.

- [ ] **Step 1.3: Commit**

```bash
git add -A && git commit -m "feat: SQL metodologia_coach + last_portal_access en clientes"
```

---

## Task 2: Tipos TypeScript — MetodologiaCoach + señales nuevas

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 2.1: Añadir tipo MetodologiaCoach**

En `types/index.ts`, añadir antes del `export {}` final o al final del archivo:

```typescript
export interface MetodologiaCoach {
  id: string
  coach_id: string
  proteina_perdida_grasa: number
  proteina_recomposicion: number
  proteina_rendimiento: number
  proteina_ganancia_musculo: number
  proteina_salud_general: number
  reglas_fijas: string[]
  estilos_dieta: string[]
  filosofia_coaching: string
  num_comidas_default: number
  deficit_maximo_kcal: number
  superavit_maximo_kcal: number
  updated_at: string
}
```

- [ ] **Step 2.2: Extender TipoRecomendacion**

En `types/index.ts`, buscar el tipo `TipoRecomendacion` y añadir los dos valores nuevos:

```typescript
// Buscar la línea actual que define TipoRecomendacion y añadir los nuevos:
export type TipoRecomendacion =
  | 'ajuste_macros'
  | 'alerta_adherencia'
  | 'alerta_peso_estancado'
  | 'alerta_peso_rapido'
  | 'alerta_sueno'
  | 'alerta_energia'
  | 'checkin_recordatorio'
  | 'feedback_positivo'
  | 'revision_plan'
  | 'sin_actividad_portal'   // ← NUEVO
  | 'sin_entreno'            // ← NUEVO
```

- [ ] **Step 2.3: Verificar tipos**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit 2>&1 | head -20
```

Esperado: 0 errores (o los mismos que había antes).

- [ ] **Step 2.4: Commit**

```bash
git add types/index.ts && git commit -m "feat: tipos MetodologiaCoach + señales auto-coach nuevas"
```

---

## Task 3: API — GET + PUT /api/metodologia-coach

**Files:**
- Create: `app/api/metodologia-coach/route.ts`

- [ ] **Step 3.1: Crear el archivo**

```typescript
// app/api/metodologia-coach/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import type { MetodologiaCoach } from '@/types'

export async function GET(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceSupabase()
  const { data } = await admin
    .from('metodologia_coach')
    .select('*')
    .eq('coach_id', user.id)
    .single()

  return NextResponse.json({ metodologia: data ?? null })
}

export async function PUT(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body: Partial<MetodologiaCoach> = await request.json()

  const admin = createServiceSupabase()
  const { data, error } = await admin
    .from('metodologia_coach')
    .upsert({
      coach_id: user.id,
      proteina_perdida_grasa: body.proteina_perdida_grasa ?? 2.2,
      proteina_recomposicion: body.proteina_recomposicion ?? 2.0,
      proteina_rendimiento: body.proteina_rendimiento ?? 1.8,
      proteina_ganancia_musculo: body.proteina_ganancia_musculo ?? 2.0,
      proteina_salud_general: body.proteina_salud_general ?? 1.0,
      reglas_fijas: body.reglas_fijas ?? [],
      estilos_dieta: body.estilos_dieta ?? ['mediterraneo', 'flexible'],
      filosofia_coaching: body.filosofia_coaching ?? '',
      num_comidas_default: body.num_comidas_default ?? 4,
      deficit_maximo_kcal: body.deficit_maximo_kcal ?? 500,
      superavit_maximo_kcal: body.superavit_maximo_kcal ?? 400,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'coach_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ metodologia: data })
}
```

- [ ] **Step 3.2: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: 0 errores nuevos.

- [ ] **Step 3.3: Commit**

```bash
git add app/api/metodologia-coach/route.ts && git commit -m "feat: API GET+PUT /api/metodologia-coach"
```

---

## Task 4: UI — Página /coach/metodologia

**Files:**
- Create: `app/coach/metodologia/page.tsx`
- Modify: `components/Sidebar.tsx`

- [ ] **Step 4.1: Crear la página**

```typescript
// app/coach/metodologia/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash } from 'lucide-react'
import type { MetodologiaCoach } from '@/types'

const ESTILOS_DISPONIBLES = [
  { value: 'mediterraneo', label: 'Mediterráneo' },
  { value: 'flexible', label: 'Flexible / IIFYM' },
  { value: 'vegano', label: 'Vegano' },
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'sin_gluten', label: 'Sin gluten' },
  { value: 'bajo_carbos', label: 'Bajo en carbos' },
]

const DEFAULT: Omit<MetodologiaCoach, 'id' | 'coach_id' | 'updated_at'> = {
  proteina_perdida_grasa: 2.2,
  proteina_recomposicion: 2.0,
  proteina_rendimiento: 1.8,
  proteina_ganancia_musculo: 2.0,
  proteina_salud_general: 1.0,
  reglas_fijas: [],
  estilos_dieta: ['mediterraneo', 'flexible'],
  filosofia_coaching: '',
  num_comidas_default: 4,
  deficit_maximo_kcal: 500,
  superavit_maximo_kcal: 400,
}

export default function MetodologiaPage() {
  const [form, setForm] = useState(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [nuevaRegla, setNuevaRegla] = useState('')

  useEffect(() => {
    fetch('/api/metodologia-coach')
      .then(r => r.json())
      .then(({ metodologia }) => {
        if (metodologia) setForm({ ...DEFAULT, ...metodologia })
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/metodologia-coach', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggleEstilo(value: string) {
    setForm(f => ({
      ...f,
      estilos_dieta: f.estilos_dieta.includes(value)
        ? f.estilos_dieta.filter(e => e !== value)
        : [...f.estilos_dieta, value],
    }))
  }

  function addRegla() {
    if (!nuevaRegla.trim()) return
    setForm(f => ({ ...f, reglas_fijas: [...f.reglas_fijas, nuevaRegla.trim()] }))
    setNuevaRegla('')
  }

  function removeRegla(i: number) {
    setForm(f => ({ ...f, reglas_fijas: f.reglas_fijas.filter((_, idx) => idx !== i) }))
  }

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Mi metodología</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>La IA usa estas reglas como contexto al generar cada plan</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {/* Proteína por objetivo */}
        <div className="card">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Proteína objetivo (g/kg peso corporal)</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'proteina_perdida_grasa', label: 'Pérdida de grasa' },
              { key: 'proteina_recomposicion', label: 'Recomposición' },
              { key: 'proteina_rendimiento', label: 'Rendimiento' },
              { key: 'proteina_ganancia_musculo', label: 'Ganancia muscular' },
              { key: 'proteina_salud_general', label: 'Salud general' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step={0.1}
                    min={0.5}
                    max={4}
                    value={form[key as keyof typeof form] as number}
                    onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 1 }))}
                    className="input w-24"
                  />
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>g/kg</span>
                </div>
              </div>
            ))}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Nº comidas por defecto</label>
              <input
                type="number"
                min={2}
                max={6}
                value={form.num_comidas_default}
                onChange={e => setForm(f => ({ ...f, num_comidas_default: parseInt(e.target.value) || 4 }))}
                className="input w-24"
              />
            </div>
          </div>
        </div>

        {/* Déficit/superávit */}
        <div className="card">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Límites calóricos</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Déficit máximo (kcal)</label>
              <input type="number" min={100} max={1000} step={50} value={form.deficit_maximo_kcal}
                onChange={e => setForm(f => ({ ...f, deficit_maximo_kcal: parseInt(e.target.value) || 500 }))}
                className="input w-32" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Superávit máximo (kcal)</label>
              <input type="number" min={100} max={800} step={50} value={form.superavit_maximo_kcal}
                onChange={e => setForm(f => ({ ...f, superavit_maximo_kcal: parseInt(e.target.value) || 400 }))}
                className="input w-32" />
            </div>
          </div>
        </div>

        {/* Estilos dieta */}
        <div className="card">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Estilo de alimentación preferido</h2>
          <div className="flex flex-wrap gap-2">
            {ESTILOS_DISPONIBLES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => toggleEstilo(value)}
                className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                style={{
                  background: form.estilos_dieta.includes(value) ? 'rgba(34,197,94,0.2)' : 'var(--surface)',
                  border: `1px solid ${form.estilos_dieta.includes(value) ? 'rgba(34,197,94,0.5)' : 'var(--border)'}`,
                  color: form.estilos_dieta.includes(value) ? 'rgb(34,197,94)' : 'var(--text-muted)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Reglas fijas */}
        <div className="card">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Reglas que siempre aplico</h2>
          <div className="flex flex-col gap-2 mb-3">
            {form.reglas_fijas.map((regla, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm flex-1" style={{ color: 'var(--text)' }}>✓ {regla}</span>
                <button onClick={() => removeRegla(i)} className="p-1 rounded hover:opacity-70">
                  <Trash size={14} style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Añadir regla (ej: Desayuno siempre ≥ 25g proteína)"
              value={nuevaRegla}
              onChange={e => setNuevaRegla(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRegla()}
            />
            <button onClick={addRegla} className="btn-primary">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Filosofía */}
        <div className="card">
          <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Mi filosofía de coaching</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>La IA leerá esto como contexto al generar cada plan</p>
          <textarea
            className="input w-full"
            rows={5}
            placeholder="Describe tu enfoque: qué priorizas, cómo trabajas con clientes difíciles, qué evitas…"
            value={form.filosofia_coaching}
            onChange={e => setForm(f => ({ ...f, filosofia_coaching: e.target.value }))}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4.2: Añadir enlace en el Sidebar**

En `components/Sidebar.tsx`, dentro del grupo de items del coach (sección Herramientas o ajustes), añadir:

```typescript
// Buscar el bloque de navegación del coach y añadir:
{ href: '/coach/metodologia', label: 'Mi metodología', icon: Brain },
// Asegúrate de importar Brain desde lucide-react o el ícono equivalente que uses
```

Si el Sidebar usa Phosphor Icons (`@phosphor-icons/react`), usar `Brain` de Phosphor:
```typescript
import { Brain } from '@phosphor-icons/react'
```

- [ ] **Step 4.3: Verificar build**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4.4: Commit**

```bash
git add app/coach/metodologia/page.tsx components/Sidebar.tsx
git commit -m "feat: página /coach/metodologia — configuración de metodología del coach"
```

---

## Task 5: Inyectar metodología en el prompt de generación de planes

**Files:**
- Modify: `app/api/generar-plan-inicial/route.ts`

- [ ] **Step 5.1: Leer la metodología en el inicio del POST handler**

En `app/api/generar-plan-inicial/route.ts`, justo después de obtener el `cliente` de Supabase (tras el `if (!cliente) return...`), añadir:

```typescript
// Leer metodología del coach (opcional — usa defaults si no existe)
const { data: metodologia } = await supabase
  .from('metodologia_coach')
  .select('*')
  .eq('coach_id', cliente.coach_id)
  .single()
```

- [ ] **Step 5.2: Añadir bloque de metodología al prompt**

En la función que construye el `prompt` (busca la variable `prompt` que se pasa a DeepSeek), añadir al final del prompt ANTES de `Responde SOLO con este JSON`:

```typescript
const metodologiaBlock = metodologia ? `
═══ METODOLOGÍA DEL COACH ═══
- Proteína objetivo para este cliente (${onboarding.objetivo}): ${
  onboarding.objetivo === 'perder_grasa' ? metodologia.proteina_perdida_grasa :
  onboarding.objetivo === 'rendimiento' ? metodologia.proteina_rendimiento :
  onboarding.objetivo === 'ganar_musculo' ? metodologia.proteina_ganancia_musculo :
  onboarding.objetivo === 'mantener' ? metodologia.proteina_recomposicion :
  metodologia.proteina_salud_general
} g/kg (USAR ESTE VALOR, no el estándar)
- Déficit calórico máximo permitido: ${metodologia.deficit_maximo_kcal} kcal (no superar)
- Superávit máximo permitido: ${metodologia.superavit_maximo_kcal} kcal (no superar)
- Nº comidas preferido: ${metodologia.num_comidas_default}
- Estilos de dieta preferidos: ${metodologia.estilos_dieta.join(', ')}
${metodologia.reglas_fijas.length > 0 ? `- Reglas que SIEMPRE aplica el coach:\n${metodologia.reglas_fijas.map(r => `  • ${r}`).join('\n')}` : ''}
${metodologia.filosofia_coaching ? `- Filosofía del coach: ${metodologia.filosofia_coaching}` : ''}
` : ''
```

Luego en el `prompt` string, insertar `${metodologiaBlock}` justo antes de `Responde SOLO con este JSON:`.

- [ ] **Step 5.3: Sobreescribir PROTEINA_OBJETIVO con valor de metodología si existe**

Busca en el route donde se calcula `proteinas` y añadir override:

```typescript
// ANTES: const proteinas = Math.round(pesoObjetivo * (PROTEINA_OBJETIVO[onboarding.objetivo] ?? 2.0) * factorSexo)
// DESPUÉS: usar metodología si está configurada
const factorProteina = metodologia
  ? (
      onboarding.objetivo === 'perder_grasa' ? metodologia.proteina_perdida_grasa :
      onboarding.objetivo === 'rendimiento' ? metodologia.proteina_rendimiento :
      onboarding.objetivo === 'ganar_musculo' ? metodologia.proteina_ganancia_musculo :
      onboarding.objetivo === 'mantener' ? metodologia.proteina_recomposicion :
      metodologia.proteina_salud_general
    )
  : (PROTEINA_OBJETIVO[onboarding.objetivo] ?? 2.0)
const proteinas = Math.round(pesoObjetivo * factorProteina * factorSexo)
```

- [ ] **Step 5.4: Respetar déficit/superávit máximo del coach**

Tras calcular `kcalObjetivo`, añadir:

```typescript
// Respetar límites del coach
if (metodologia) {
  const maxDeficit = metodologia.deficit_maximo_kcal
  const maxSuperavit = metodologia.superavit_maximo_kcal
  const ajuste = OBJETIVO_AJUSTE[onboarding.objetivo] ?? 0
  const ajusteLimitado = ajuste < 0
    ? Math.max(ajuste, -maxDeficit)
    : Math.min(ajuste, maxSuperavit)
  // Recalcular si el ajuste fue modificado
  if (ajusteLimitado !== ajuste) {
    // kcalObjetivo ya fue calculado con el ajuste original — recorregir
    const tdeeCalc = calcularTDEE(
      cliente.peso_inicial ?? 70, cliente.altura ?? 170, cliente.edad ?? 30,
      cliente.sexo ?? 'hombre', onboarding.actividad_base
    )
    Object.assign({ kcalObjetivo: tdeeCalc + ajusteLimitado })
    // Nota: dado que kcalObjetivo es const, declararla con let al inicio del handler
  }
}
```

**Importante:** Si `kcalObjetivo` está declarado con `const`, cambiar a `let` al inicio donde se declara.

- [ ] **Step 5.5: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5.6: Commit**

```bash
git add app/api/generar-plan-inicial/route.ts
git commit -m "feat: inyectar metodología del coach en prompt de generación de plan"
```

---

## Task 6: Asociar recetas reales a cada comida del plan

**Files:**
- Modify: `app/api/generar-plan-inicial/route.ts`

Tras guardar el plan en `registros_ia`, añadir una segunda fase que asocia recetas a cada comida. Usamos `/api/recetas/sugeridas` que ya existe.

- [ ] **Step 6.1: Añadir función helper para sugerir recetas por comida**

Al inicio de `generar-plan-inicial/route.ts`, añadir la función:

```typescript
async function sugerirRecetasParaComida(
  kcal: number,
  proteinas: number,
  baseUrl: string
): Promise<{ id: string; nombre: string; kcal: number; proteinas: number; imagen_url: string | null }[]> {
  try {
    const res = await fetch(
      `${baseUrl}/api/recetas/sugeridas?kcal=${Math.round(kcal)}&proteinas=${Math.round(proteinas)}&limite=3`,
      { headers: { 'Content-Type': 'application/json' } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.recetas ?? []
  } catch {
    return []
  }
}
```

- [ ] **Step 6.2: Después de guardar en registros_ia, asociar recetas**

Tras el bloque `await supabase.from('registros_ia').insert(...)`, añadir:

```typescript
// Asociar recetas sugeridas a cada comida del plan (fire-and-forget si falla)
try {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const distribucion = (planJson.distribucion_comidas ?? []) as Array<{
    nombre: string
    kcal: number
    notas?: string
  }>

  if (distribucion.length > 0) {
    // Guardar en registros_ia un campo extra con recetas sugeridas por comida
    const recetasPorComida: Record<string, unknown[]> = {}
    await Promise.all(
      distribucion.map(async (comida) => {
        // Estimamos proteínas como 30% de las kcal / 4 kcal/g si no hay dato exacto
        const protEst = Math.round((comida.kcal * 0.30) / 4)
        const recetas = await sugerirRecetasParaComida(comida.kcal, protEst, baseUrl)
        recetasPorComida[comida.nombre] = recetas
      })
    )

    // Actualizar el registro IA con las recetas sugeridas
    await supabase
      .from('registros_ia')
      .update({ respuesta_json: { ...planJson, recetas_por_comida: recetasPorComida } })
      .eq('cliente_id', cliente_id)
      .eq('tipo', 'plan_inicial')
      .order('created_at', { ascending: false })
      .limit(1)
  }
} catch {
  // No crítico — el plan funciona sin recetas sugeridas
}
```

- [ ] **Step 6.3: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6.4: Commit**

```bash
git add app/api/generar-plan-inicial/route.ts
git commit -m "feat: sugerir recetas reales por comida al generar plan inicial"
```

---

## Task 7: Mostrar recetas sugeridas en revisar-plan

**Files:**
- Modify: `app/clientes/[id]/revisar-plan/page.tsx`

- [ ] **Step 7.1: Leer recetas_por_comida del registro IA**

En `revisar-plan/page.tsx`, buscar donde se lee `registros_ia` para mostrar el plan. Añadir extracción de recetas:

```typescript
// Tras leer el registro IA, extraer recetas sugeridas:
const recetasPorComida = (planData?.respuesta_json as Record<string, unknown>)?.recetas_por_comida as
  Record<string, Array<{ id: string; nombre: string; kcal: number; imagen_url: string | null }>> | undefined
```

- [ ] **Step 7.2: Mostrar las recetas bajo cada comida**

En el JSX donde se renderiza cada comida del plan, añadir debajo:

```typescript
{recetasPorComida?.[comida.nombre]?.length > 0 && (
  <div className="mt-2 flex gap-2 flex-wrap">
    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Recetas compatibles:</span>
    {recetasPorComida[comida.nombre].map(r => (
      <a
        key={r.id}
        href={`/recetas/${r.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
      >
        {r.nombre} · {r.kcal} kcal
      </a>
    ))}
  </div>
)}
```

- [ ] **Step 7.3: Verificar**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7.4: Commit**

```bash
git add app/clientes/
git commit -m "feat: mostrar recetas sugeridas por comida en revisar-plan"
```

---

## Task 8: Tracking de último acceso al portal del cliente

**Files:**
- Modify: `app/cliente/page.tsx` (o el layout del portal cliente)

- [ ] **Step 8.1: Registrar acceso al abrir el portal**

En `app/cliente/page.tsx` (dashboard del cliente), en el `useEffect` inicial donde se carga el perfil, añadir al final una llamada para registrar el acceso:

```typescript
// Al final del useEffect de carga inicial:
// Registrar último acceso al portal (fire-and-forget)
fetch('/api/cliente/registrar-acceso', { method: 'POST' }).catch(() => {})
```

- [ ] **Step 8.2: Crear endpoint /api/cliente/registrar-acceso**

```typescript
// app/api/cliente/registrar-acceso/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const admin = createServiceSupabase()
  const { data: cliente } = await admin
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!cliente) return NextResponse.json({ ok: false })

  await admin
    .from('clientes')
    .update({ last_portal_access: new Date().toISOString() })
    .eq('id', cliente.id)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 8.3: Verificar**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8.4: Commit**

```bash
git add app/cliente/page.tsx app/api/cliente/registrar-acceso/route.ts
git commit -m "feat: tracking de último acceso al portal del cliente"
```

---

## Task 9: Señales nuevas en auto-coach (sin_actividad_portal + sin_entreno)

**Files:**
- Modify: `lib/auto-coach.ts`

- [ ] **Step 9.1: Añadir señal sin_actividad_portal**

En `lib/auto-coach.ts`, en la función `analizarCliente`, añadir después del bloque `// 6h. Revisión de plan pendiente`:

```typescript
// 6i. Sin actividad en el portal
const { data: clienteData } = await supabase
  .from('clientes')
  .select('last_portal_access')
  .eq('id', clienteId)
  .single()

const lastAccess = clienteData?.last_portal_access
if (lastAccess) {
  const diasSinPortal = diasDesde(lastAccess.split('T')[0])
  if (diasSinPortal >= 5) {
    recomendaciones.push({
      id: generarId(),
      cliente_id: clienteId,
      cliente_nombre: nombre,
      tipo: 'sin_actividad_portal',
      urgencia: diasSinPortal >= 10 ? 'alta' : 'media',
      titulo: diasSinPortal >= 10
        ? `${diasSinPortal} días sin abrir la app`
        : `${diasSinPortal} días sin acceder al portal`,
      descripcion: `${nombre} no ha abierto la app en ${diasSinPortal} días.`,
      detalle_ia: '',
      sugerencia_accion: 'Enviar mensaje de motivación. El cliente puede haberse desconectado del proceso.',
      datos_contexto: { dias_sin_portal: diasSinPortal },
      created_at: ahora,
    })
  }
}
```

- [ ] **Step 9.2: Añadir señal sin_entreno**

En `lib/auto-coach.ts`, en la función `analizarCliente`, añadir a continuación:

```typescript
// 6j. Sin registrar entrenamientos (si tiene plan de entreno activo)
const { data: planEntreno } = await supabase
  .from('planes_entrenamiento')
  .select('id')
  .eq('cliente_id', clienteId)
  .eq('activo', true)
  .limit(1)
  .single()

if (planEntreno) {
  const { data: ultimoSet } = await supabase
    .from('registros_sets')
    .select('fecha')
    .eq('cliente_id', clienteId)
    .order('fecha', { ascending: false })
    .limit(1)
    .single()

  const diasSinEntreno = ultimoSet ? diasDesde(ultimoSet.fecha) : 999
  if (diasSinEntreno >= 7) {
    recomendaciones.push({
      id: generarId(),
      cliente_id: clienteId,
      cliente_nombre: nombre,
      tipo: 'sin_entreno',
      urgencia: diasSinEntreno >= 14 ? 'alta' : 'media',
      titulo: diasSinEntreno >= 999
        ? 'Sin registros de entreno'
        : `${diasSinEntreno} días sin registrar entreno`,
      descripcion: `${nombre} tiene plan de entrenamiento activo pero no registra sesiones desde hace ${diasSinEntreno === 999 ? 'siempre' : `${diasSinEntreno} días`}.`,
      detalle_ia: '',
      sugerencia_accion: 'Verificar si el cliente tiene dificultades con los entrenamientos o necesita ajuste del plan.',
      datos_contexto: { dias_sin_entreno: diasSinEntreno },
      created_at: ahora,
    })
  }
}
```

- [ ] **Step 9.3: Añadir iconos para los nuevos tipos en AutoCoachPanel**

En `components/dashboard/AutoCoachPanel.tsx`, en el objeto `TIPO_META`, añadir:

```typescript
// Añadir después de 'revision_plan':
sin_actividad_portal: { icon: Clock, label: 'Sin actividad' },
sin_entreno: { icon: Lightning, label: 'Sin entreno' },
```

Los iconos `Clock` y `Lightning` ya están importados en ese archivo.

- [ ] **Step 9.4: Verificar**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 9.5: Commit**

```bash
git add lib/auto-coach.ts components/dashboard/AutoCoachPanel.tsx
git commit -m "feat: señales sin_actividad_portal + sin_entreno en auto-coach"
```

---

## Task 10: Build final y push

- [ ] **Step 10.1: Build completo**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx next build 2>&1 | tail -20
```

Esperado: ✓ Build exitoso, 0 errores TypeScript.

- [ ] **Step 10.2: Push a Vercel**

```bash
git push origin main
```

Vercel desplegará automáticamente. Verificar en https://nutricoach-delta.vercel.app que:
- La página `/coach/metodologia` carga correctamente
- El dashboard del coach muestra el AutoCoachPanel
- Un plan nuevo generado tiene `recetas_por_comida` en el JSON del registro IA

---

---

## Task 11: Base de Conocimiento Científica — lib/knowledge-base.ts

**Files:**
- Create: `lib/knowledge-base.ts`

La base de conocimiento es un archivo TypeScript estático con protocolos científicos organizados por etiquetas. Cada protocolo tiene un resumen accionable que se inyecta en el prompt cuando el cliente cumple las condiciones.

No necesita base de datos — empieza como fichero, se puede migrar a tabla Supabase en el futuro cuando Carlos quiera gestionarla desde una UI.

- [ ] **Step 11.1: Crear lib/knowledge-base.ts**

```typescript
// lib/knowledge-base.ts
// ═══════════════════════════════════════════════════════════════
// Base de conocimiento científica de NutriCoach.
// Cada protocolo se inyecta dinámicamente en el prompt de IA
// cuando el perfil del cliente activa sus condiciones.
// ═══════════════════════════════════════════════════════════════

export interface ProtocoloCientifico {
  id: string
  categoria: string
  titulo: string
  // Resumen accionable para el prompt (máx 3-4 frases)
  guia_prompt: string
  // Fuentes bibliográficas breves
  referencias: string[]
  // Tags que activan este protocolo (se matchean con el perfil del cliente)
  tags: string[]
}

export const BASE_CONOCIMIENTO: ProtocoloCientifico[] = [
  // ── PÉRDIDA DE GRASA ──────────────────────────────────────
  {
    id: 'fat_loss_deficit',
    categoria: 'perdida_grasa',
    titulo: 'Déficit calórico óptimo para pérdida de grasa sin pérdida muscular',
    guia_prompt: 'Déficit de 300-500 kcal/día. Déficits >500 kcal aceleran catabolismo muscular. Con proteína ≥2.2 g/kg y entrenamiento de fuerza, se puede llegar a 1% del peso corporal/semana de pérdida sin pérdida muscular significativa. No reducir por debajo de 1.200 kcal (mujeres) o 1.500 kcal (hombres).',
    referencias: ['Trexler et al. 2014 (JISSN)', 'Helms et al. 2014 (EJSN)', 'Hall et al. 2012 (AJCN)'],
    tags: ['perder_grasa', 'perdida_peso', 'deficit'],
  },
  {
    id: 'fat_loss_protein',
    categoria: 'perdida_grasa',
    titulo: 'Proteína elevada en déficit calórico',
    guia_prompt: 'En déficit, mínimo 2.3-3.1 g/kg de masa libre de grasa para preservar músculo (Helms 2014). Distribuir en 4+ tomas de ≥25g. La proteína aumenta saciedad y termogénesis, facilitando el déficit. Priorizar fuentes magras: pechuga, claras, pescado blanco, proteína de suero.',
    referencias: ['Helms et al. 2014', 'Leidy et al. 2015 (AJCN)', 'Paddon-Jones et al. 2015'],
    tags: ['perder_grasa', 'perdida_peso', 'recomposicion'],
  },

  // ── GANANCIA MUSCULAR ─────────────────────────────────────
  {
    id: 'muscle_gain_surplus',
    categoria: 'ganancia_musculo',
    titulo: 'Superávit mínimo efectivo para ganancia muscular',
    guia_prompt: 'Superávit de 200-300 kcal/día para minimizar acumulación de grasa. Tasas de ganancia muscular natural: 1-2 kg/mes (principiantes), 0.5-1 kg/mes (intermedios), 0.25 kg/mes (avanzados). Superávits mayores no aceleran ganancia muscular pero sí acumulación grasa.',
    referencias: ['Barakat et al. 2020 (Strength Cond J)', 'Slater & Phillips 2011 (JSMS)'],
    tags: ['ganar_musculo', 'volumen', 'hipertrofia'],
  },
  {
    id: 'muscle_protein_synthesis',
    categoria: 'ganancia_musculo',
    titulo: 'Síntesis proteica muscular — dosis y timing',
    guia_prompt: 'Dosis óptima por toma: 0.4 g/kg, mínimo 3-4 tomas/día (Morton 2018). Leucina ≥3g por toma activa mTOR. Ventana post-entrenamiento: 40g proteína en las 2h post-sesión maximiza síntesis proteica muscular. Fuentes completas (leucina alta): suero, huevo, carne, salmón.',
    referencias: ['Morton et al. 2018 (BJSM)', 'Witard et al. 2014 (AJCN)', 'Phillips & Van Loon 2011'],
    tags: ['ganar_musculo', 'hipertrofia', 'fuerza', 'gym'],
  },

  // ── RENDIMIENTO DEPORTIVO ─────────────────────────────────
  {
    id: 'endurance_carbs',
    categoria: 'rendimiento',
    titulo: 'Carbohidratos para deportes de resistencia',
    guia_prompt: 'Para sesiones >60 min: 6-10 g/kg/día CHO. Pre-entreno (2-4h antes): 1-4 g/kg CHO de bajo IG. Durante: 30-60 g/h CHO (hasta 90 g/h si sesión >2.5h con mezcla glucosa:fructosa 2:1). Post-entreno inmediato: 1-1.2 g/kg CHO para resíntesis glucógeno. Reducir CHO en días de descanso.',
    referencias: ['Burke et al. 2011 (JSCR)', 'ACSM Joint Position Statement 2016', 'Jeukendrup 2014 (Sports Med)'],
    tags: ['rendimiento', 'running', 'ciclismo', 'triatlon', 'resistencia', 'endurance'],
  },
  {
    id: 'hyrox_crossfit_fueling',
    categoria: 'rendimiento',
    titulo: 'Nutrición para CrossFit / HYROX / deportes funcionales',
    guia_prompt: 'WODs de alta intensidad: requieren CHO rápidamente disponibles pre-sesión (1-2 g/kg 1h antes). Post-WOD: 0.4 g/kg proteína + 0.8 g/kg CHO en 30 min. Múltiples sesiones/día: rellenar glucógeno entre sesiones es prioritario. Creatina monohidrato 3-5 g/día mejora rendimiento en esfuerzos repetidos de alta intensidad.',
    referencias: ['Glassman 2002 (CFJ)', 'ISSN Position Stand 2017', 'Kreider et al. 2017 (JISSN)'],
    tags: ['crossfit', 'hyrox', 'funcional', 'hiit', 'rendimiento'],
  },
  {
    id: 'strength_periodization',
    categoria: 'rendimiento',
    titulo: 'Periodización nutricional para fuerza',
    guia_prompt: 'Ajustar CHO al volumen de entrenamiento: días de alta intensidad/volumen → CHO altos (5-7 g/kg); días ligeros/descanso → CHO reducidos (2-3 g/kg). Proteína constante todo el ciclo (≥1.8 g/kg). La periodización nutricional mejora composición corporal y rendimiento vs. dieta constante.',
    referencias: ['Jeukendrup 2017 (Sports Med)', 'Impey et al. 2018 (Front Physiol)'],
    tags: ['fuerza', 'gym', 'powerlifting', 'rendimiento', 'periodizacion'],
  },

  // ── PATOLOGÍAS METABÓLICAS ────────────────────────────────
  {
    id: 'diabetes_t2_nutrition',
    categoria: 'patologia',
    titulo: 'Diabetes tipo 2 — protocolo nutricional basado en evidencia',
    guia_prompt: 'Reducir CHO refinados, priorizar CHO de bajo índice glucémico (legumbres, avena, verduras). Distribución calórica: CHO 40-45%, Proteína 25-30%, Grasas 25-30%. Timing CHO: mayor cantidad en desayuno y comida, mínimo en cena (cronodieta). El ejercicio post-comida (10-15 min caminata) reduce glucemia prandial un 30%. Evitar picos glucémicos: comer CHO siempre con proteína/grasa/fibra.',
    referencias: ['ADA Standards of Care 2024', 'Evert et al. 2019 (Diabetes Care)', 'EASD 2020 guidelines'],
    tags: ['diabetes', 'diabetes_tipo2', 'resistencia_insulina', 'glucemia'],
  },
  {
    id: 'hypothyroidism_nutrition',
    categoria: 'patologia',
    titulo: 'Hipotiroidismo — adaptaciones nutricionales',
    guia_prompt: 'El hipotiroidismo reduce TDEE un 15-20% — ajustar kcal a la baja vs. calculado por fórmula. Nutrientes clave: selenio (200 mcg/día, de nueces de Brasil), yodo (en dosis correctas — ni exceso ni deficiencia), vitamina D (deficiencia frecuente, suplementar si <30 ng/mL). Evitar sojas y brásicas crudas en exceso (goitrógenos). La proteína alta (1.8-2.0 g/kg) ayuda a mantener masa muscular en contexto de metabolismo reducido.',
    referencias: ['Triggiani et al. 2009 (Thyroid)', 'Winther et al. 2020 (Nutrients)', 'Ventura et al. 2017'],
    tags: ['hipotiroidismo', 'tiroides', 'hashimoto'],
  },
  {
    id: 'pcos_nutrition',
    categoria: 'patologia',
    titulo: 'SOP (PCOS) — manejo nutricional',
    guia_prompt: 'Resistencia a insulina presente en 70% de casos. Dieta baja en IG mejora sensibilidad insulínica y reduce andrógenos. Reducir CHO refinados y azúcares. Inositol (myo-inositol 2-4 g/día + d-chiro-inositol 100 mg/día) mejora ovulación y sensibilidad insulínica. Vitamina D y omega-3 con evidencia moderada de beneficio hormonal. Déficit calórico moderado (300-400 kcal) si sobrepeso — no agresivo.',
    referencias: ['Barrea et al. 2021 (Nutrients)', 'Unfer et al. 2016 (EJOG)', 'AE-PCOS Society 2023'],
    tags: ['sop', 'pcos', 'sindrome_ovario_poliquistico', 'hormonal'],
  },

  // ── POBLACIONES ESPECIALES ────────────────────────────────
  {
    id: 'vegan_protein',
    categoria: 'dieta_especial',
    titulo: 'Vegetariano/Vegano — complementación proteica y micronutrientes críticos',
    guia_prompt: 'Incrementar objetivo proteico un 10-20% vs. omnívoro (menor digestibilidad y perfil de aminoácidos). Combinar fuentes: legumbres + cereales (complementación). B12: suplementación obligatoria (2.4 mcg/día mínimo). Hierro no hemo: consumir con VitC para aumentar absorción; evitar café/té 1h antes/después. Zinc: suplementar o priorizar semillas de calabaza, legumbres. Omega-3: microalgas DHA/EPA si vegano.',
    referencias: ['Rogerson 2017 (JISSN)', 'Craig et al. 2009 (JADA)', 'Pawlak et al. 2013 (Nutr Rev)'],
    tags: ['vegano', 'vegetariano', 'plant_based'],
  },
  {
    id: 'sarcopenia_older',
    categoria: 'poblacion',
    titulo: 'Prevención de sarcopenia — adultos mayores de 60 años',
    guia_prompt: 'Umbral de leucina más alto en mayores: necesitan ≥0.4 g/kg por toma para activar síntesis proteica (vs. 0.3 g/kg en jóvenes). Proteína total: 1.6-2.0 g/kg/día. Vitamina D ≥800 IU/día (deficiencia frecuente y clave para fuerza muscular). Calcio 1200 mg/día (mujeres >50). Distribuir proteína en 4 tomas equitativas — el patrón de distribución importa más que en jóvenes. Ejercicio de fuerza 2-3x/semana es sinérgico con la nutrición.',
    referencias: ['Bauer et al. 2013 (JAMDA)', 'Deutz et al. 2017 (Clin Nutr)', 'PROT-AGE Study Group 2013'],
    tags: ['sarcopenia', 'mayores', 'tercera_edad', 'masa_muscular'],
  },
  {
    id: 'menopause_nutrition',
    categoria: 'poblacion',
    titulo: 'Menopausia — adaptaciones nutricionales',
    guia_prompt: 'TDEE reducido ~200 kcal/día post-menopausia. Mayor tendencia a acumulación de grasa visceral — priorizar déficit moderado y ejercicio de fuerza. Calcio: 1200 mg/día. VitD: 800-2000 IU/día. Fitoestrógenos (soja, lino): evidencia moderada de alivio de sofocos. Proteína alta (1.6-2.0 g/kg) protege masa muscular en contexto de pérdida de estrógenos.',
    referencias: ['Davis et al. 2012 (Maturitas)', 'NAMS Position Statement 2022', 'Messina 2014 (Maturitas)'],
    tags: ['menopausia', 'climaterio', 'postmenopausia', 'mujer_mayor'],
  },
]

// ── Detector de tags desde el perfil del cliente ──────────

interface PerfilCliente {
  objetivo?: string
  tipo_entreno?: string[]
  condiciones_salud?: string
  restricciones?: string[]
  segmento?: string
  edad?: number
  sexo?: string
  nivel_actividad?: string
}

const TAG_NORMALIZER: Record<string, string[]> = {
  perder_grasa: ['perder_grasa', 'perdida_peso', 'deficit'],
  ganar_musculo: ['ganar_musculo', 'volumen', 'hipertrofia'],
  rendimiento: ['rendimiento'],
  mantener: [],
  salud_general: [],
  // Entrenamientos
  running: ['running', 'resistencia', 'endurance'],
  ciclismo: ['ciclismo', 'resistencia', 'endurance'],
  triatlon: ['triatlon', 'resistencia', 'endurance'],
  crossfit: ['crossfit', 'funcional', 'hiit'],
  hyrox: ['hyrox', 'funcional', 'hiit'],
  gym: ['gym', 'fuerza'],
  natacion: ['resistencia', 'endurance'],
  yoga: [],
  // Condiciones (se detectan por keywords en condiciones_salud)
  diabetes: ['diabetes', 'diabetes_tipo2', 'resistencia_insulina'],
  hipotiroidismo: ['hipotiroidismo', 'tiroides', 'hashimoto'],
  sop: ['sop', 'pcos', 'hormonal'],
  // Dieta
  vegano: ['vegano', 'plant_based'],
  vegetariano: ['vegetariano', 'plant_based'],
}

export function seleccionarProtocolos(perfil: PerfilCliente): ProtocoloCientifico[] {
  const tagsActivos = new Set<string>()

  // Por objetivo
  const tagsObjetivo = TAG_NORMALIZER[perfil.objetivo ?? ''] ?? []
  tagsObjetivo.forEach(t => tagsActivos.add(t))

  // Por tipo de entrenamiento
  for (const entreno of perfil.tipo_entreno ?? []) {
    const normalized = entreno.toLowerCase().replace(/\s+/g, '_')
    const tags = TAG_NORMALIZER[normalized] ?? []
    tags.forEach(t => tagsActivos.add(t))
    // También añadir el entreno directamente como tag
    tagsActivos.add(normalized)
  }

  // Por condiciones de salud (keyword detection)
  const condiciones = (perfil.condiciones_salud ?? '').toLowerCase()
  if (condiciones.includes('diabet')) {
    TAG_NORMALIZER['diabetes'].forEach(t => tagsActivos.add(t))
  }
  if (condiciones.includes('hipotiroi') || condiciones.includes('hashimoto') || condiciones.includes('tiroides')) {
    TAG_NORMALIZER['hipotiroidismo'].forEach(t => tagsActivos.add(t))
  }
  if (condiciones.includes('sop') || condiciones.includes('ovario poliquístico') || condiciones.includes('pcos')) {
    TAG_NORMALIZER['sop'].forEach(t => tagsActivos.add(t))
  }
  if (condiciones.includes('sarcopenia') || condiciones.includes('masa muscular') && (perfil.edad ?? 0) >= 60) {
    tagsActivos.add('sarcopenia')
  }

  // Por restricciones dietéticas
  for (const r of perfil.restricciones ?? []) {
    const rl = r.toLowerCase()
    if (rl.includes('vegan')) TAG_NORMALIZER['vegano'].forEach(t => tagsActivos.add(t))
    if (rl.includes('vegetar')) TAG_NORMALIZER['vegetariano'].forEach(t => tagsActivos.add(t))
  }

  // Por edad y sexo
  if ((perfil.edad ?? 0) >= 60) tagsActivos.add('mayores')
  if ((perfil.edad ?? 0) >= 50 && perfil.sexo === 'mujer') tagsActivos.add('menopausia')

  // Seleccionar protocolos que tengan al menos 1 tag activo
  const seleccionados = BASE_CONOCIMIENTO.filter(protocolo =>
    protocolo.tags.some(tag => tagsActivos.has(tag))
  )

  // Limitar a 5 protocolos más relevantes (los que más tags tienen en común)
  return seleccionados
    .map(p => ({
      protocolo: p,
      score: p.tags.filter(t => tagsActivos.has(t)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ protocolo }) => protocolo)
}

export function formatearEvidenciaParaPrompt(protocolos: ProtocoloCientifico[]): string {
  if (protocolos.length === 0) return ''
  return `
═══ EVIDENCIA CIENTÍFICA APLICABLE A ESTE CLIENTE ═══
${protocolos.map(p => `
▸ ${p.titulo}
  ${p.guia_prompt}
  [Fuentes: ${p.referencias.join(', ')}]
`).join('')}
INSTRUCCIÓN: Aplica las guías anteriores cuando sean relevantes para este cliente. Son específicas para su perfil — no son opcionales.
`
}
```

- [ ] **Step 11.2: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 11.3: Commit**

```bash
git add lib/knowledge-base.ts
git commit -m "feat: base de conocimiento científica — 15 protocolos evidencia-based por perfil"
```

---

## Task 12: Inyectar evidencia científica en el prompt de generación

**Files:**
- Modify: `app/api/generar-plan-inicial/route.ts`

- [ ] **Step 12.1: Importar funciones de knowledge-base**

Al inicio de `generar-plan-inicial/route.ts`, añadir el import:

```typescript
import { seleccionarProtocolos, formatearEvidenciaParaPrompt } from '@/lib/knowledge-base'
```

- [ ] **Step 12.2: Construir el perfil del cliente para el selector**

Tras obtener `onboarding` y `perfil` de Supabase, construir el perfil:

```typescript
const perfilParaEvidencia = {
  objetivo: onboarding.objetivo,
  tipo_entreno: onboarding.tipo_entreno ?? [],
  condiciones_salud: perfil?.condiciones_salud ?? '',
  restricciones: onboarding.restricciones ?? [],
  segmento: onboarding.segmento,
  edad: cliente.edad ?? undefined,
  sexo: cliente.sexo ?? undefined,
}

const protocolosSeleccionados = seleccionarProtocolos(perfilParaEvidencia)
const evidenciaBlock = formatearEvidenciaParaPrompt(protocolosSeleccionados)
```

- [ ] **Step 12.3: Insertar evidencia en el prompt**

En el string del `prompt`, insertar `${evidenciaBlock}` justo antes de `${metodologiaBlock}` (o del bloque de flags de personalización si no existe `metodologiaBlock` aún):

```typescript
// El prompt debe quedar así (fragmento del final):
// ...
// ${evidenciaBlock}
// ${metodologiaBlock}
// ═══ FLAGS DE PERSONALIZACIÓN CRÍTICOS ═══
// ...
// Responde SOLO con este JSON...
```

- [ ] **Step 12.4: Verificar**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 12.5: Test manual — verificar que un plan con diabetes aplica el protocolo**

Ejecutar en la consola del navegador (o via curl) un POST a `/api/generar-plan-inicial` con un `cliente_id` de un cliente de prueba que tenga `condiciones_salud` con "diabetes". Luego verificar en Supabase que en `registros_ia.prompt` aparece el bloque "EVIDENCIA CIENTÍFICA APLICABLE".

- [ ] **Step 12.6: Commit**

```bash
git add app/api/generar-plan-inicial/route.ts
git commit -m "feat: inyectar evidencia científica personalizada en prompt de generación de planes"
```

---

## Task 10 (actualizada): Build final y push

- [ ] **Step 10.1: Build completo**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx next build 2>&1 | tail -20
```

Esperado: ✓ Build exitoso, 0 errores TypeScript.

- [ ] **Step 10.2: Push a Vercel**

```bash
git push origin main
```

Vercel desplegará automáticamente.

---

## Resumen de lo que se construye

| Feature | Dónde se ve | Impacto |
|---------|-------------|---------|
| Metodología del coach | `/coach/metodologia` (nueva página) | Cada plan usa las reglas del coach |
| Base de conocimiento científica | `lib/knowledge-base.ts` | 15 protocolos evidence-based por categoría |
| Selector de evidencia por perfil | Automático en generación de plan | El plan aplica protocolos relevantes para ESTE cliente |
| Recetas en el plan | Panel revisar-plan | El coach ve qué recetas encajan por comida |
| Tracking acceso portal | Automático en `app/cliente` | Señal para auto-coach |
| Señales sin_portal + sin_entreno | Dashboard coach (AutoCoachPanel) | Detecta clientes que se "duermen" |
