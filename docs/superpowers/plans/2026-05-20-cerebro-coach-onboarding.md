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

## Resumen de lo que se construye

| Feature | Dónde se ve | Impacto |
|---------|-------------|---------|
| Metodología del coach | `/coach/metodologia` (nueva página) | Cada plan nuevo usa tus reglas reales |
| Recetas en el plan | Panel revisar-plan del coach | El coach ve qué recetas encajan en cada comida |
| Auto-trigger ya existe | — | El plan se genera solo al acabar onboarding |
| Señales sin_portal + sin_entreno | Dashboard coach (AutoCoachPanel) | Detecta clientes que se "duermen" |
