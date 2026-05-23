# Recetario Capa 1 — Infraestructura + Filtrado Profesional

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir historial de interacciones receta-cliente y mejorar el filtrado de recetas en generación de planes IA para priorizar calidad y evitar repeticiones.

**Architecture:** 4 tareas independientes en orden: (1) SQL migration añade `receta_id` a `comidas` y crea `receta_interacciones_cliente`; (2) `RecetaCandidata` se extiende y `filtrarRecetasPorSlot` v2 ordena por sort_score compuesto (calidad + objetivo + distancia euclidiana) y excluye recientes/dislikes; (3) `generar-plan-inicial` pasa `clienteId` al filtro y persiste `receta_id` + logs interacciones; (4) script batch audita las 63 recetas sin `score_calidad`.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL + RLS), TypeScript, `@supabase/supabase-js`, `npx tsx` para scripts

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `supabase/migrations/20260523_recetario_capa1.sql` | Crear | `receta_id` en comidas + tabla `receta_interacciones_cliente` |
| `types/index.ts` | Modificar | Extender `RecetaCandidata` + añadir `RecetaInteraccionCliente` |
| `lib/plan-recetas.ts` | Modificar | `filtrarRecetasPorSlot` v2 con sort_score + exclusión recientes/dislikes |
| `app/api/generar-plan-inicial/route.ts` | Modificar | Pasar clienteId + guardar receta_id + log interacciones |
| `scripts/batch-audit-profesional.ts` | Crear | Auditar recetas aprobadas sin score_calidad |

---

## Task 1: SQL Migration

**Files:**
- Create: `supabase/migrations/20260523_recetario_capa1.sql`

- [ ] **Step 1: Crear el archivo de migración**

Crear `/Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach/supabase/migrations/20260523_recetario_capa1.sql` con:

```sql
-- Capa 1: Recetario inteligente
-- Añade receta_id a comidas y crea tabla de interacciones receta-cliente

-- 1. Vincular comida generada a su receta
ALTER TABLE comidas
  ADD COLUMN IF NOT EXISTS receta_id uuid REFERENCES recetas(id) ON DELETE SET NULL;

COMMENT ON COLUMN comidas.receta_id IS
  'Receta asignada a esta comida por el plan IA. NULL si es comida de alimentos sueltos.';

-- 2. Historial de interacciones cliente-receta
CREATE TABLE IF NOT EXISTS receta_interacciones_cliente (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  receta_id    uuid NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  tipo         text NOT NULL CHECK (tipo IN (
                 'asignada_plan',
                 'swap_elegida',
                 'swap_rechazada',
                 'like',
                 'dislike',
                 'favorita'
               )),
  plan_id      uuid REFERENCES planes_nutricion(id) ON DELETE SET NULL,
  comida_slot  text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ric_cliente_receta
  ON receta_interacciones_cliente(cliente_id, receta_id);

CREATE INDEX IF NOT EXISTS idx_ric_cliente_tipo_fecha
  ON receta_interacciones_cliente(cliente_id, tipo, created_at DESC);

-- RLS
ALTER TABLE receta_interacciones_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_full_ric" ON receta_interacciones_cliente
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clientes c
      WHERE c.id = receta_interacciones_cliente.cliente_id
        AND c.coach_id = auth.uid()
    )
  );

-- Service role bypass (para API routes con service key)
CREATE POLICY "service_role_ric" ON receta_interacciones_cliente
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Aplicar la migración en Supabase**

Desde el proyecto Supabase (ID: `hopeqzwzmlrpktoeygxz`), ejecutar el SQL anterior en el SQL Editor, o via CLI:

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx supabase db push --db-url "$SUPABASE_DB_URL"
```

Si no hay CLI configurado, ejecutar el SQL directamente en https://supabase.com/dashboard/project/hopeqzwzmlrpktoeygxz/sql/new

Verificar éxito:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'comidas' AND column_name = 'receta_id';
-- Debe devolver 1 fila

SELECT table_name FROM information_schema.tables
WHERE table_name = 'receta_interacciones_cliente';
-- Debe devolver 1 fila
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260523_recetario_capa1.sql
git commit -m "feat(sql): receta_id en comidas + receta_interacciones_cliente"
```

---

## Task 2: Tipos + `filtrarRecetasPorSlot` v2

**Files:**
- Modify: `types/index.ts:1099-1112` (interfaz `RecetaCandidata`)
- Modify: `lib/plan-recetas.ts:62-118` (función `filtrarRecetasPorSlot`)

- [ ] **Step 1: Extender `RecetaCandidata` en `types/index.ts`**

Localizar la interfaz `RecetaCandidata` (línea ~1099) y reemplazarla:

```ts
// ANTES:
export interface RecetaCandidata {
  id: string
  nombre: string
  kcal: number
  proteinas: number
  carbohidratos: number
  grasas: number
  tiempo_prep_min?: number | null
  tipo_receta?: TipoReceta | null
  imagen_url?: string | null
  url_origen?: string | null
  intolerancias?: string[] | null
  _dist?: number
}

// DESPUÉS:
export interface RecetaCandidata {
  id: string
  nombre: string
  kcal: number
  proteinas: number
  carbohidratos: number
  grasas: number
  tiempo_prep_min?: number | null
  tipo_receta?: TipoReceta | null
  imagen_url?: string | null
  url_origen?: string | null
  intolerancias?: string[] | null
  score_calidad?: number | null
  apta_cliente?: string | null
  _dist?: number
  _sort_score?: number
}
```

- [ ] **Step 2: Añadir tipo `RecetaInteraccionCliente` en `types/index.ts`**

Después de la interfaz `RecetaCandidata`, añadir:

```ts
export interface RecetaInteraccionCliente {
  id: string
  cliente_id: string
  receta_id: string
  tipo: 'asignada_plan' | 'swap_elegida' | 'swap_rechazada' | 'like' | 'dislike' | 'favorita'
  plan_id?: string | null
  comida_slot?: string | null
  created_at: string
}
```

- [ ] **Step 3: Verificar TypeScript compila**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit --pretty false 2>&1 | head -20
```

Esperado: 0 errores nuevos relacionados con `RecetaCandidata`.

- [ ] **Step 4: Reescribir `filtrarRecetasPorSlot` en `lib/plan-recetas.ts`**

Actualizar la firma y el cuerpo de la función. La nueva firma añade `clienteId` y `objetivoCliente` opcionales:

```ts
// Mapeo objetivo → valores apta_cliente aceptados
const OBJETIVO_APTA: Record<string, string[]> = {
  perder_grasa:  ['perdida_grasa', 'general'],
  ganar_musculo: ['ganancia_muscular', 'atleta', 'general'],
  rendimiento:   ['atleta', 'ganancia_muscular', 'general'],
  salud_general: ['general', 'clinica'],
  mantener:      ['mantenimiento', 'general'],
  recomposicion: ['perdida_grasa', 'ganancia_muscular', 'general'],
}

export async function filtrarRecetasPorSlot(
  supabase: SupabaseClient,
  slotNombre: string,
  targetKcal: number,
  targetProt: number,
  filtroCliente: FiltroCliente,
  limit = 6,
  clienteId?: string,
  objetivoCliente?: string
): Promise<RecetaCandidata[]> {
  const categorias = SLOT_CATEGORIAS[slotNombre] ?? SLOT_CATEGORIAS['Comida']
  const tiposPermitidos = SLOT_TIPOS_PERMITIDOS[slotNombre] ?? ['completa']
  const restricciones = filtroCliente.restricciones ?? []
  const tiempoMaximo = filtroCliente.tiempo_cocina_min

  // Cargar recetas usadas y dislikes del cliente (si hay clienteId)
  const recientesIds = new Set<string>()
  const dislikeIds = new Set<string>()

  if (clienteId) {
    const hace2semanas = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: interacciones } = await supabase
      .from('receta_interacciones_cliente')
      .select('receta_id, tipo')
      .eq('cliente_id', clienteId)
      .or(`tipo.eq.asignada_plan,tipo.eq.dislike`)
      .gte('created_at', hace2semanas)

    for (const i of interacciones ?? []) {
      if (i.tipo === 'dislike') dislikeIds.add(i.receta_id)
      else recientesIds.add(i.receta_id)
    }
  }

  let query = supabase
    .from('recetas')
    .select('id, nombre, kcal, proteinas, carbohidratos, grasas, tiempo_prep_min, tipo_receta, imagen_url, url_origen, intolerancias, score_calidad, apta_cliente')
    .eq('estado', 'aprobada')
    .gt('kcal', 0)
    .in('categoria', categorias)
    .or(`tipo_receta.is.null,tipo_receta.in.(${tiposPermitidos.join(',')})`)

  if (tiempoMaximo && tiempoMaximo > 0) {
    query = query.or(`tiempo_prep_min.is.null,tiempo_prep_min.lte.${tiempoMaximo}`)
  }

  const { data: recetas } = await query.limit(80)
  if (!recetas || recetas.length === 0) return []

  // Filtro duro: intolerancias
  let candidatas = recetas.filter(r => {
    if (!restricciones.length) return true
    const recetaIntol: string[] = r.intolerancias ?? []
    return !restricciones.some(intol => recetaIntol.includes(intol))
  })

  // Filtro duro: alimentos a evitar
  const evitarRaw = filtroCliente.alimentos_evitar_extra
  const evitarArr: string[] = Array.isArray(evitarRaw)
    ? evitarRaw
    : typeof evitarRaw === 'string' && evitarRaw.trim()
      ? evitarRaw.split(',').map(s => s.trim()).filter(Boolean)
      : []

  if (evitarArr.length > 0) {
    const evitarLower = evitarArr.map(a => a.toLowerCase())
    candidatas = candidatas.filter(r =>
      !evitarLower.some(term => r.nombre.toLowerCase().includes(term))
    )
  }

  // Filtro duro: dislikes del cliente
  candidatas = candidatas.filter(r => !dislikeIds.has(r.id))

  // Filtro duro: score_calidad < 50 (muy baja calidad)
  // Solo si hay suficientes alternativas (>=3 después del filtro)
  const aptasCalidad = candidatas.filter(r => (r.score_calidad ?? 50) >= 50)
  if (aptasCalidad.length >= 3) candidatas = aptasCalidad

  // Filtro blando: excluir recientes si hay suficientes alternativas
  const sinRecientes = candidatas.filter(r => !recientesIds.has(r.id))
  if (sinRecientes.length >= 3) candidatas = sinRecientes

  // Calcular sort_score para cada candidata
  const aptasObjetivo = objetivoCliente ? (OBJETIVO_APTA[objetivoCliente] ?? ['general']) : ['general']

  const scored = candidatas.map(r => {
    const dist = distanciaEuclidiana(r.kcal, r.proteinas ?? 0, targetKcal, targetProt)
    const distNorm = Math.min(dist, 2) / 2 // Normalizar a 0-1, cap a 2

    const scoreNorm = (r.score_calidad ?? 60) / 100

    const aptaMatch = r.apta_cliente
      ? aptasObjetivo.includes(r.apta_cliente) ? 1.0
        : r.apta_cliente === 'general' ? 0.5
        : 0.0
      : 0.5 // Sin clasificar: neutro

    const sortScore = scoreNorm * 0.40 + aptaMatch * 0.35 + (1 - distNorm) * 0.25

    return { ...r, _dist: dist, _sort_score: sortScore }
  })

  return scored
    .sort((a, b) => (b._sort_score ?? 0) - (a._sort_score ?? 0))
    .slice(0, limit)
    .map(({ _dist: _, _sort_score: __, ...r }) => r)
}
```

- [ ] **Step 5: Verificar TypeScript compila**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit --pretty false 2>&1 | head -30
```

Esperado: 0 errores en `lib/plan-recetas.ts`.

- [ ] **Step 6: Commit**

```bash
git add types/index.ts lib/plan-recetas.ts
git commit -m "feat(recetas): filtrarRecetasPorSlot v2 — sort por calidad+objetivo+dist, excluir recientes/dislikes"
```

---

## Task 3: Integración en `generar-plan-inicial`

**Files:**
- Modify: `app/api/generar-plan-inicial/route.ts`

Los cambios son en 3 puntos concretos del archivo:
1. Llamada a `filtrarRecetasPorSlot` (línea ~391) — añadir `cliente_id` y `onboarding.objetivo`
2. Insert de `comidas` (línea ~776) — añadir `receta_id`
3. Después del insert de `comida_alimentos` — insertar en `receta_interacciones_cliente`

- [ ] **Step 1: Actualizar llamada a `filtrarRecetasPorSlot`**

Localizar el bloque (líneas ~388-393):

```ts
// ANTES:
for (const slot of slots) {
  const { targetKcal, targetProt } = calcularTargetSlot(slot, kcalObjetivo, distribucionProteina.total, numComidas)
  const candidatas = await filtrarRecetasPorSlot(supabase, slot, targetKcal, targetProt, filtroCliente, 6)
  candidatasPorSlot.set(slot, candidatas)
}

// DESPUÉS:
for (const slot of slots) {
  const { targetKcal, targetProt } = calcularTargetSlot(slot, kcalObjetivo, distribucionProteina.total, numComidas)
  const candidatas = await filtrarRecetasPorSlot(
    supabase, slot, targetKcal, targetProt, filtroCliente, 6,
    cliente_id,
    onboarding.objetivo
  )
  candidatasPorSlot.set(slot, candidatas)
}
```

- [ ] **Step 2: Guardar `receta_id` al insertar comida**

Localizar el bloque de insert de `comidas` (líneas ~776-790):

```ts
// ANTES:
const { data: comidaDb, error: comidaError } = await supabase
  .from('comidas')
  .insert({
    plan_id: planDb.id,
    nombre: comida.nombre as string,
    orden: (comida.orden as number) ?? 0,
    hora_sugerida: (comida.hora_sugerida as string) || null,
    alternativas_receta_ids: ((comida.alternativas as string[] | undefined) ?? []).length > 0
      ? (comida.alternativas as string[])
      : null,
    kcal_target: (comida.kcal_target as number) || null,
    proteinas_target: (comida.proteinas_target as number) || null,
    notas_peri_entreno: (comida.notas_peri_entreno as string) || null,
  })
  .select()
  .single()

// DESPUÉS:
const recetaIdPrincipal = (comida.recetas as Array<Record<string, unknown>> | undefined)?.[0]?.receta_id as string | undefined

const { data: comidaDb, error: comidaError } = await supabase
  .from('comidas')
  .insert({
    plan_id: planDb.id,
    nombre: comida.nombre as string,
    orden: (comida.orden as number) ?? 0,
    hora_sugerida: (comida.hora_sugerida as string) || null,
    alternativas_receta_ids: ((comida.alternativas as string[] | undefined) ?? []).length > 0
      ? (comida.alternativas as string[])
      : null,
    kcal_target: (comida.kcal_target as number) || null,
    proteinas_target: (comida.proteinas_target as number) || null,
    notas_peri_entreno: (comida.notas_peri_entreno as string) || null,
    receta_id: recetaIdPrincipal || null,
  })
  .select()
  .single()
```

- [ ] **Step 3: Loguear interacción `asignada_plan` por cada receta persistida**

Localizar el bloque después del insert en `comida_alimentos` (líneas ~889-900), justo después del `if (caError)`:

```ts
// ANTES (final del bloque for de recetas):
        if (caError) {
          console.error('[generar-plan-inicial] Error vinculando alimento a comida:', recetaFull.nombre, caError.message)
        }
      }
    }

// DESPUÉS:
        if (caError) {
          console.error('[generar-plan-inicial] Error vinculando alimento a comida:', recetaFull.nombre, caError.message)
        }

        // Loguear interacción asignada_plan (fire-and-forget)
        supabase.from('receta_interacciones_cliente').insert({
          cliente_id,
          receta_id: recetaFull.id,
          tipo: 'asignada_plan',
          plan_id: planDb.id,
          comida_slot: comida.nombre as string,
        }).then(() => {}).catch(() => {})
      }
    }
```

- [ ] **Step 4: Verificar TypeScript compila**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit --pretty false 2>&1 | grep -E "error TS" | head -20
```

Esperado: 0 errores en `app/api/generar-plan-inicial/route.ts`.

- [ ] **Step 5: Build completo**

```bash
npm run build 2>&1 | tail -20
```

Esperado: `✓ Compiled successfully` sin errores.

- [ ] **Step 6: Commit**

```bash
git add app/api/generar-plan-inicial/route.ts
git commit -m "feat(generar-plan): receta_id en comidas + log interacciones asignada_plan"
```

---

## Task 4: Script batch auditoría recetas sin score

**Files:**
- Create: `scripts/batch-audit-profesional.ts`

- [ ] **Step 1: Crear el script**

Crear `/Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach/scripts/batch-audit-profesional.ts`:

```ts
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { createClient } from '@supabase/supabase-js'
import { auditarRecetaProfesional } from '../lib/recetas/auditoria'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  const DRY = !process.argv.includes('--apply')

  // Paginar: buscar recetas aprobadas sin score_calidad
  const pageSize = 50
  let from = 0
  let total = 0
  let auditadas = 0
  let errores = 0

  console.log(DRY ? '[DRY-RUN] No se aplicarán cambios. Usa --apply para ejecutar.' : '[APPLY] Auditando recetas...')

  while (true) {
    const { data: recetas, error } = await supabase
      .from('recetas')
      .select('id, nombre, score_calidad')
      .eq('estado', 'aprobada')
      .is('score_calidad', null)
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('Error fetching recetas:', error.message)
      break
    }

    if (!recetas || recetas.length === 0) break

    total += recetas.length
    console.log(`\nLote ${from / pageSize + 1}: ${recetas.length} recetas sin score`)

    if (!DRY) {
      for (const r of recetas) {
        try {
          const resultado = await auditarRecetaProfesional(supabase, r.id)
          auditadas++
          process.stdout.write(`  ✓ ${r.nombre} → score ${resultado.score_calidad ?? '?'}\n`)
        } catch (err) {
          errores++
          console.error(`  ✗ ${r.nombre}:`, err instanceof Error ? err.message : err)
        }
      }
    } else {
      for (const r of recetas) {
        console.log(`  · ${r.nombre} (score: null)`)
      }
    }

    if (recetas.length < pageSize) break
    from += pageSize
  }

  console.log(`\n─────────────────────────────`)
  if (DRY) {
    console.log(`Total sin score: ${total}. Ejecuta con --apply para auditar.`)
  } else {
    console.log(`Auditadas: ${auditadas} | Errores: ${errores} | Total: ${total}`)
  }
}

main().catch(console.error)
```

- [ ] **Step 2: Dry-run — ver qué recetas serán auditadas**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsx scripts/batch-audit-profesional.ts
```

Esperado: lista de recetas con `score_calidad: null`, conteo total.

- [ ] **Step 3: Ejecutar auditoría real**

```bash
npx tsx scripts/batch-audit-profesional.ts --apply
```

Esperado:
```
Lote 1: N recetas sin score
  ✓ Nombre Receta → score 72
  ✓ ...
─────────────────────────────
Auditadas: N | Errores: 0 | Total: N
```

- [ ] **Step 4: Verificar en Supabase que se actualizaron**

```sql
SELECT COUNT(*) FROM recetas
WHERE estado = 'aprobada' AND score_calidad IS NULL;
-- Esperado: 0 (o muy pocos si hubo errores)
```

- [ ] **Step 5: Commit**

```bash
git add scripts/batch-audit-profesional.ts
git commit -m "feat(script): batch-audit-profesional — audita recetas sin score_calidad"
```

---

## Task 5: Push y verificación final

- [ ] **Step 1: Verificar build final limpio**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit --pretty false 2>&1 | grep -c "error TS"
# Esperado: 0

npm run build 2>&1 | tail -5
# Esperado: ✓ Compiled successfully
```

- [ ] **Step 2: Push a GitHub → Vercel**

```bash
git push origin main
```

- [ ] **Step 3: Verificar en producción**

Generar un plan nuevo desde la ficha de un cliente en https://nutricoach-delta.vercel.app → comprobar que en Supabase:
```sql
-- La comida debe tener receta_id
SELECT c.nombre, c.receta_id, r.nombre as receta_nombre
FROM comidas c
LEFT JOIN recetas r ON r.id = c.receta_id
ORDER BY c.created_at DESC
LIMIT 10;

-- Las interacciones deben registrarse
SELECT * FROM receta_interacciones_cliente
ORDER BY created_at DESC
LIMIT 10;
```
