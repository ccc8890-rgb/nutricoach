# Lista de la Compra con Comparativa de Precios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a la lista de la compra semanal de NutriCoach la comparativa de precios por supermercado para cada ingrediente, permitiendo al coach y al cliente elegir dónde comprar cada producto, y guardando esas elecciones para analytics futuros.

**Architecture:** Dos capas: (1) datos — columna `es_generico` en `alimentos`, tabla `selecciones_lista_compra`, script de deduplicación que transfiere precios huérfanos al alimento canónico correcto; (2) UI — rediseño de `ListaCompra.tsx` para mostrar opciones de precio inline por ingrediente, dos APIs nuevas (lista semanal agregada + CRUD selecciones). Todo en el worktree `nutricoach-modulos/` (rama `feature/modulos`). No tocar `app/globals.css`, `app/layout.tsx`, ni `app/recetas/`.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + RLS), TypeScript, Tailwind CSS con CSS variables, `createServiceSupabase()` para lecturas de catálogo, `createApiSupabase(request)` para operaciones con auth.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `supabase_lista_compra_migration.sql` | Crear | Migración SQL: `es_generico`, `selecciones_lista_compra`, RLS, marcar BEDCA |
| `scripts/deduplicar-alimentos.mjs` | Crear | Script que fusiona duplicados y transfiere precios al canónico |
| `lib/scraping/normalizador.ts` | Modificar | Lógica condicional: si hay match → precio al canónico; si no → crear con `es_generico` correcto |
| `types/index.ts` | Modificar | Tipos `IngredienteSemanal`, `SeleccionListaCompra`, `ResumenSemanal` |
| `app/api/lista-compra/semanal/route.ts` | Crear | GET: ingredientes agregados del plan + precios + selecciones actuales |
| `app/api/lista-compra/selecciones/route.ts` | Crear | GET + POST: leer y guardar selecciones del cliente |
| `components/lista-compra/ItemConPrecios.tsx` | Crear | Fila de ingrediente con precios expandibles + selección |
| `components/ListaCompra.tsx` | Modificar | Orquestador: agrega ingredientes, carga precios, renderiza `ItemConPrecios` |

---

## Task 1: SQL Migration

**Files:**
- Create: `supabase_lista_compra_migration.sql`

Este SQL se ejecuta **una sola vez** en el panel de Supabase (SQL Editor → New query → Run).

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase_lista_compra_migration.sql
-- Ejecutar en Supabase SQL Editor. Idempotente (usa IF NOT EXISTS / OR REPLACE).

-- ─────────────────────────────────────────────────────────────
-- 1. Columna es_generico en alimentos
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.alimentos
  ADD COLUMN IF NOT EXISTS es_generico boolean NOT NULL DEFAULT false;

-- Marcar como genéricos los alimentos con macros reales (calorias > 0)
-- que probablemente son BEDCA o curados. Los creados por el scraper
-- con macros = 0 quedan en false hasta que el script los deduplicar.
UPDATE public.alimentos
  SET es_generico = true
  WHERE calorias > 0
    AND es_generico = false;

-- ─────────────────────────────────────────────────────────────
-- 2. Tabla selecciones_lista_compra
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.selecciones_lista_compra (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id      uuid REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  plan_id         uuid REFERENCES public.planes_nutricion(id) ON DELETE CASCADE NOT NULL,
  alimento_id     uuid REFERENCES public.alimentos(id) ON DELETE CASCADE NOT NULL,
  supermercado_id uuid REFERENCES public.supermercados(id) ON DELETE SET NULL,
  producto_nombre text,
  precio_por_kg   numeric(10,4),
  url_producto    text,
  semana_inicio   date NOT NULL,
  seleccionado_por text CHECK (seleccionado_por IN ('coach', 'cliente')) NOT NULL DEFAULT 'cliente',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (cliente_id, plan_id, alimento_id, semana_inicio)
);

ALTER TABLE public.selecciones_lista_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coach puede gestionar selecciones" ON public.selecciones_lista_compra;
CREATE POLICY "Coach puede gestionar selecciones" ON public.selecciones_lista_compra
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.coach_id = auth.uid())
  );

DROP POLICY IF EXISTS "Cliente puede ver y editar sus selecciones" ON public.selecciones_lista_compra;
CREATE POLICY "Cliente puede ver y editar sus selecciones" ON public.selecciones_lista_compra
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.profile_id = auth.uid())
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_selecciones_plan_semana
  ON public.selecciones_lista_compra(plan_id, semana_inicio);
CREATE INDEX IF NOT EXISTS idx_selecciones_cliente
  ON public.selecciones_lista_compra(cliente_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Tabla temporal para revisión de deduplicación ambigua
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dedup_revision (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alimento_a_id   uuid REFERENCES public.alimentos(id),
  alimento_b_id   uuid REFERENCES public.alimentos(id),
  motivo          text,
  resuelto        boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.dedup_revision ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Coach puede gestionar dedup_revision" ON public.dedup_revision;
CREATE POLICY "Coach puede gestionar dedup_revision" ON public.dedup_revision
  FOR ALL USING (auth.uid() IS NOT NULL);
```

- [ ] **Step 2: Ejecutar en Supabase**

Abrir Supabase Dashboard → SQL Editor → pegar el contenido → Run.
Verificar que no hay errores. Comprobar en Table Editor que la columna `es_generico` aparece en `alimentos` y que la tabla `selecciones_lista_compra` existe.

- [ ] **Step 3: Verificar con query**

```sql
-- Debe devolver los alimentos con calorias > 0 marcados como genéricos
SELECT COUNT(*) FROM alimentos WHERE es_generico = true;
-- Esperado: ≥ 77 (los BEDCA + curados con macros)

SELECT COUNT(*) FROM alimentos WHERE es_generico = false;
-- Esperado: los creados por el scraper con macros = 0
```

- [ ] **Step 4: Commit**

```bash
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos add supabase_lista_compra_migration.sql
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos commit -m "feat: SQL migration — es_generico, selecciones_lista_compra, dedup_revision"
```

---

## Task 2: Script de deduplicación

**Files:**
- Create: `scripts/deduplicar-alimentos.mjs`

Este script identifica pares (alimento con macros + alimento con macros=0 y mismo nombre) y transfiere los precios al canónico. Los casos ambiguos se vuelcan a `dedup_revision` para revisión manual.

- [ ] **Step 1: Crear el script**

```javascript
// scripts/deduplicar-alimentos.mjs
// Uso: node scripts/deduplicar-alimentos.mjs [--dry-run]
// Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Cargar .env.local
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const DRY_RUN = process.argv.includes('--dry-run')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function similitud(a, b) {
  const na = a.toLowerCase().trim()
  const nb = b.toLowerCase().trim()
  if (na === nb) return 1.0
  if (na.includes(nb) || nb.includes(na)) return 0.85
  // Palabras en común / total palabras
  const wa = new Set(na.split(/\s+/))
  const wb = new Set(nb.split(/\s+/))
  const comunes = [...wa].filter(w => wb.has(w)).length
  return comunes / Math.max(wa.size, wb.size)
}

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN — sin cambios en BD' : '🔧 MODO REAL — modificando BD')

  // 1. Obtener todos los alimentos
  const { data: alimentos, error } = await supabase
    .from('alimentos')
    .select('id, nombre, calorias, proteinas, carbohidratos, grasas, es_generico')
    .order('nombre')

  if (error) { console.error('Error cargando alimentos:', error.message); process.exit(1) }

  // Separar en canónicos (macros > 0) y huérfanos (macros = 0)
  const canonicos = alimentos.filter(a => a.calorias > 0)
  const huerfanos = alimentos.filter(a => a.calorias === 0)

  console.log(`Canónicos: ${canonicos.length} | Huérfanos (macros=0): ${huerfanos.length}`)

  // 2. Para cada huérfano, buscar el canónico más similar
  let transferidos = 0
  let ambiguos = 0
  let sinMatch = 0

  for (const huerfano of huerfanos) {
    // Buscar si tiene precios
    const { data: precios } = await supabase
      .from('productos_supermercado')
      .select('id, supermercado_id, precio_por_kg, precio_unidad, url_producto')
      .eq('alimento_id', huerfano.id)

    if (!precios || precios.length === 0) {
      // Sin precios: simplemente marcar como no-genérico y continuar
      if (!DRY_RUN) {
        await supabase.from('alimentos').update({ es_generico: false }).eq('id', huerfano.id)
      }
      sinMatch++
      continue
    }

    // Buscar candidatos canónicos por similitud
    const candidatos = canonicos
      .map(c => ({ ...c, sim: similitud(c.nombre, huerfano.nombre) }))
      .filter(c => c.sim >= 0.75)
      .sort((a, b) => b.sim - a.sim)

    if (candidatos.length === 0) {
      // No hay canónico cercano — marcar como es_generico=false (es un producto de marca)
      console.log(`  ⬜ Sin match: "${huerfano.nombre}" (tiene ${precios.length} precio/s)`)
      if (!DRY_RUN) {
        await supabase.from('alimentos').update({ es_generico: false }).eq('id', huerfano.id)
      }
      sinMatch++
      continue
    }

    if (candidatos.length > 1 && candidatos[0].sim < 0.95) {
      // Múltiples candidatos similares — volcar a dedup_revision para revisión manual
      console.log(`  ⚠️  Ambiguo: "${huerfano.nombre}" → candidatos: ${candidatos.slice(0,3).map(c => `"${c.nombre}"(${c.sim.toFixed(2)})`).join(', ')}`)
      if (!DRY_RUN) {
        await supabase.from('dedup_revision').insert({
          alimento_a_id: candidatos[0].id,
          alimento_b_id: huerfano.id,
          motivo: `Similitud ${candidatos[0].sim.toFixed(2)}: "${huerfano.nombre}" → "${candidatos[0].nombre}". Candidatos alternativos: ${candidatos.slice(1,3).map(c=>c.nombre).join(', ')}`,
        })
      }
      ambiguos++
      continue
    }

    // Match claro: transferir precios al canónico
    const canonico = candidatos[0]
    console.log(`  ✅ Match: "${huerfano.nombre}" → "${canonico.nombre}" (sim=${canonico.sim.toFixed(2)}, precios: ${precios.length})`)

    if (!DRY_RUN) {
      for (const precio of precios) {
        // Upsert: si ya hay precio de ese supermercado en el canónico, no sobreescribir
        const { data: existente } = await supabase
          .from('productos_supermercado')
          .select('id')
          .eq('alimento_id', canonico.id)
          .eq('supermercado_id', precio.supermercado_id)
          .maybeSingle()

        if (!existente) {
          await supabase.from('productos_supermercado').insert({
            alimento_id: canonico.id,
            supermercado_id: precio.supermercado_id,
            precio_por_kg: precio.precio_por_kg,
            precio_unidad: precio.precio_unidad,
            url_producto: precio.url_producto,
            fecha_precio: new Date().toISOString().split('T')[0],
          })
        }
      }
      // Borrar el huérfano (sus precios ya fueron transferidos o el canónico ya los tenía)
      await supabase.from('productos_supermercado').delete().eq('alimento_id', huerfano.id)
      await supabase.from('alimentos').delete().eq('id', huerfano.id)
      // Marcar canónico como genérico
      await supabase.from('alimentos').update({ es_generico: true }).eq('id', canonico.id)
    }
    transferidos++
  }

  console.log(`\n📊 Resultado:`)
  console.log(`  ✅ Transferidos: ${transferidos}`)
  console.log(`  ⚠️  Ambiguos (en dedup_revision): ${ambiguos}`)
  console.log(`  ⬜ Sin match / marca: ${sinMatch}`)
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Ejecutar en modo dry-run primero**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos
node scripts/deduplicar-alimentos.mjs --dry-run 2>&1 | head -60
```

Revisar la salida. Los `✅ Match` son correctos. Los `⚠️ Ambiguo` se irán a revisión manual. Los `⬜ Sin match` son productos de marca (correcto que queden como `es_generico=false`).

- [ ] **Step 3: Si la salida parece correcta, ejecutar en modo real**

```bash
node scripts/deduplicar-alimentos.mjs 2>&1 | tee salidas/dedup-$(date +%d-%m-%Y).log
```

- [ ] **Step 4: Verificar resultado**

```bash
# Contar alimentos antes/después (comparar con los 1.026 iniciales)
# El número debe bajar por los duplicados eliminados
```

En Supabase SQL Editor:
```sql
SELECT COUNT(*) FROM alimentos;
SELECT COUNT(*) FROM alimentos WHERE es_generico = true;
SELECT COUNT(*) FROM alimentos WHERE es_generico = false;
SELECT COUNT(*) FROM dedup_revision WHERE resuelto = false;
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos add scripts/deduplicar-alimentos.mjs
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos commit -m "feat: script deduplicación alimentos — transfiere precios al canónico"
```

---

## Task 3: Normalizador mejorado

**Files:**
- Modify: `lib/scraping/normalizador.ts`

Evita que futuros scrapings vuelvan a crear duplicados. Si hay match con un genérico, el precio va al genérico. Si no hay match, crea el alimento con `es_generico` correcto.

- [ ] **Step 1: Reemplazar `crearAlimentoSiNoExiste` con lógica condicional**

En `lib/scraping/normalizador.ts`, reemplazar la función `crearAlimentoSiNoExiste` completa (líneas 92-121) con:

```typescript
/**
 * Crea un alimento si no existe.
 * - esGenerico=true: alimento sin marca clara (fruta, carne, verdura genérica)
 * - esGenerico=false: producto de marca o procesado
 */
export async function crearAlimentoSiNoExiste(
    nombre: string,
    supabase: SupabaseClient,
    categoria?: string,
    esGenerico?: boolean
): Promise<string | null> {
    const nombreLimpio = limpiarNombre(nombre)
    if (!nombreLimpio || nombreLimpio.length < 2) return null

    // Inferir si es genérico por el nombre si no se especifica
    const MARCAS_CONOCIDAS = ['hacendado', 'carrefour', 'milbona', 'bosque verde', 'deliplus', 'lidl', 'aldi', 'dia']
    const nombreLower = nombreLimpio.toLowerCase()
    const tieneMarco = MARCAS_CONOCIDAS.some(m => nombreLower.includes(m))
    const inferidoGenerico = esGenerico ?? !tieneMarco

    const { data, error } = await supabase
        .from('alimentos')
        .insert({
            nombre: nombreLimpio,
            categoria: categoria || 'Supermercado',
            calorias: 0,
            proteinas: 0,
            carbohidratos: 0,
            grasas: 0,
            es_generico: inferidoGenerico,
        })
        .select('id')
        .single()

    if (error) {
        console.error('[Normalizador] Error al crear alimento:', error.message)
        return null
    }

    console.log(`[Normalizador] Alimento creado: "${nombreLimpio}" (genérico: ${inferidoGenerico}, ${data.id})`)
    return data.id
}
```

- [ ] **Step 2: Verificar que el build no tiene errores TypeScript**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos
npx next build 2>&1 | tail -10
```

Esperado: `✓ Compiled successfully` sin errores TypeScript.

- [ ] **Step 3: Commit**

```bash
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos add lib/scraping/normalizador.ts
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos commit -m "feat: normalizador — marca es_generico al crear alimentos desde scraping"
```

---

## Task 4: Tipos TypeScript nuevos

**Files:**
- Modify: `types/index.ts`

Añadir al final del archivo los tipos que necesitan las APIs y componentes nuevos.

- [ ] **Step 1: Añadir tipos al final de `types/index.ts`**

```typescript
// ============================================================
// Tipos para Lista de la Compra Semanal con Precios
// ============================================================

/** Precio de un alimento en un supermercado concreto */
export interface PrecioOpcion {
  supermercado_id: string
  supermercado_nombre: string
  supermercado_slug: string
  supermercado_color?: string
  precio_por_kg: number
  coste_euros: number      // precio_por_kg * (cantidad_gramos / 1000)
  url_producto?: string
  es_mas_barato: boolean
}

/** Un ingrediente de la lista semanal con sus opciones de precio */
export interface IngredienteSemanal {
  alimento_id: string
  alimento_nombre: string
  categoria: string
  es_generico: boolean
  cantidad_gramos_total: number   // suma de todas las recetas de la semana
  recetas_origen: string[]        // nombres de comidas que lo incluyen
  precios: PrecioOpcion[]         // vacío si no hay precios en ningún super
  seleccion: SeleccionListaCompra | null  // null si no ha seleccionado aún
}

/** Selección guardada de un cliente para un ingrediente */
export interface SeleccionListaCompra {
  id?: string
  cliente_id: string
  plan_id: string
  alimento_id: string
  supermercado_id: string | null
  supermercado_nombre?: string
  producto_nombre?: string
  precio_por_kg?: number
  url_producto?: string
  semana_inicio: string           // formato YYYY-MM-DD (lunes)
  seleccionado_por: 'coach' | 'cliente'
}

/** Resumen por supermercado para el bloque final de la lista */
export interface ResumenSupermercado {
  supermercado_id: string
  supermercado_nombre: string
  supermercado_color?: string
  ingredientes: string[]          // nombres de los alimentos asignados
  coste_total: number
}

/** Respuesta completa de GET /api/lista-compra/semanal */
export interface ListaCompraSemanal {
  plan_id: string
  semana_inicio: string
  ingredientes: IngredienteSemanal[]
  resumen_por_supermercado: ResumenSupermercado[]
  coste_total: number
  coste_total_mas_caro: number    // si compraras todo en el super más caro
}
```

- [ ] **Step 2: Verificar build**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos
npx next build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos add types/index.ts
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos commit -m "feat: tipos IngredienteSemanal, SeleccionListaCompra, ListaCompraSemanal"
```

---

## Task 5: API lista semanal

**Files:**
- Create: `app/api/lista-compra/semanal/route.ts`

GET que devuelve los ingredientes del plan agregados por semana, con precios de todos los supermercados y las selecciones actuales del cliente.

- [ ] **Step 1: Crear el directorio y el archivo**

```bash
mkdir -p /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos/app/api/lista-compra/semanal
```

```typescript
// app/api/lista-compra/semanal/route.ts
/**
 * GET /api/lista-compra/semanal?plan_id=&semana_inicio=YYYY-MM-DD
 *
 * Devuelve ingredientes del plan agregados para la semana, con precios
 * de todos los supermercados y selecciones actuales del cliente.
 *
 * semana_inicio es opcional — si se omite, usa el lunes de la semana actual.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import type { IngredienteSemanal, PrecioOpcion, ResumenSupermercado } from '@/types'

function getLunesActual(): string {
    const hoy = new Date()
    const dia = hoy.getDay() // 0=dom, 1=lun, ...
    const diff = dia === 0 ? -6 : 1 - dia
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() + diff)
    return lunes.toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { searchParams } = new URL(request.url)
        const planId = searchParams.get('plan_id')
        const semanaInicio = searchParams.get('semana_inicio') || getLunesActual()

        if (!planId) {
            return NextResponse.json({ error: 'Falta plan_id' }, { status: 400 })
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const srv = createServiceSupabase()

        // 1. Obtener cliente_id del plan
        const { data: plan } = await srv
            .from('planes_nutricion')
            .select('id, cliente_id')
            .eq('id', planId)
            .single()

        if (!plan) {
            return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
        }

        // 2. Obtener todas las comidas del plan con sus alimentos
        const { data: comidas } = await srv
            .from('comidas')
            .select('nombre, comidas_alimentos(cantidad_gramos, alimentos(id, nombre, categoria, es_generico))')
            .eq('plan_id', planId)

        if (!comidas || comidas.length === 0) {
            return NextResponse.json({
                plan_id: planId,
                semana_inicio: semanaInicio,
                ingredientes: [],
                resumen_por_supermercado: [],
                coste_total: 0,
                coste_total_mas_caro: 0,
            })
        }

        // 3. Agregar cantidades por alimento (sumar si aparece en varias comidas)
        const mapaAlimentos = new Map<string, {
            alimento_id: string
            alimento_nombre: string
            categoria: string
            es_generico: boolean
            cantidad_gramos_total: number
            recetas_origen: string[]
        }>()

        for (const comida of comidas) {
            for (const ca of (comida.comidas_alimentos || []) as any[]) {
                const a = ca.alimentos
                if (!a) continue
                const existing = mapaAlimentos.get(a.id)
                if (existing) {
                    existing.cantidad_gramos_total += ca.cantidad_gramos || 0
                    if (!existing.recetas_origen.includes(comida.nombre)) {
                        existing.recetas_origen.push(comida.nombre)
                    }
                } else {
                    mapaAlimentos.set(a.id, {
                        alimento_id: a.id,
                        alimento_nombre: a.nombre,
                        categoria: a.categoria || 'Otros',
                        es_generico: a.es_generico ?? false,
                        cantidad_gramos_total: ca.cantidad_gramos || 0,
                        recetas_origen: [comida.nombre],
                    })
                }
            }
        }

        const alimentoIds = Array.from(mapaAlimentos.keys())

        // 4. Obtener todos los precios para estos alimentos en todos los supers
        const { data: todosPrecios } = await srv
            .from('precios_actuales')
            .select('alimento_id, supermercado_id, supermercado_nombre, supermercado_slug, supermercado_color, precio_por_kg, url_producto')
            .in('alimento_id', alimentoIds)

        // Mapa: alimento_id → [ precios por super ]
        const mapaPrecios = new Map<string, Array<{
            supermercado_id: string
            supermercado_nombre: string
            supermercado_slug: string
            supermercado_color?: string
            precio_por_kg: number
            url_producto?: string
        }>>()

        for (const p of todosPrecios || []) {
            const arr = mapaPrecios.get(p.alimento_id) || []
            arr.push({
                supermercado_id: p.supermercado_id,
                supermercado_nombre: p.supermercado_nombre,
                supermercado_slug: p.supermercado_slug,
                supermercado_color: p.supermercado_color,
                precio_por_kg: p.precio_por_kg,
                url_producto: p.url_producto,
            })
            mapaPrecios.set(p.alimento_id, arr)
        }

        // 5. Obtener selecciones actuales del cliente para este plan/semana
        const { data: selecciones } = await srv
            .from('selecciones_lista_compra')
            .select('*, supermercados(nombre, color)')
            .eq('plan_id', planId)
            .eq('semana_inicio', semanaInicio)

        const mapaSelecciones = new Map<string, any>()
        for (const s of selecciones || []) {
            mapaSelecciones.set(s.alimento_id, s)
        }

        // 6. Construir ingredientes con precios y selección
        const ingredientes: IngredienteSemanal[] = []

        for (const [, item] of mapaAlimentos) {
            const preciosRaw = mapaPrecios.get(item.alimento_id) || []
            const gramos = item.cantidad_gramos_total

            // Ordenar por precio ascendente y marcar el más barato
            const preciosOrdenados = [...preciosRaw].sort((a, b) => a.precio_por_kg - b.precio_por_kg)
            const precioMin = preciosOrdenados[0]?.precio_por_kg ?? null

            const precios: PrecioOpcion[] = preciosOrdenados.map(p => ({
                supermercado_id: p.supermercado_id,
                supermercado_nombre: p.supermercado_nombre,
                supermercado_slug: p.supermercado_slug,
                supermercado_color: p.supermercado_color,
                precio_por_kg: p.precio_por_kg,
                coste_euros: Math.round((gramos / 1000) * p.precio_por_kg * 100) / 100,
                url_producto: p.url_producto,
                es_mas_barato: p.precio_por_kg === precioMin,
            }))

            const selRaw = mapaSelecciones.get(item.alimento_id)
            const seleccion = selRaw ? {
                id: selRaw.id,
                cliente_id: plan.cliente_id,
                plan_id: planId,
                alimento_id: item.alimento_id,
                supermercado_id: selRaw.supermercado_id,
                supermercado_nombre: selRaw.supermercados?.nombre,
                producto_nombre: selRaw.producto_nombre,
                precio_por_kg: selRaw.precio_por_kg,
                url_producto: selRaw.url_producto,
                semana_inicio: semanaInicio,
                seleccionado_por: selRaw.seleccionado_por,
            } : null

            ingredientes.push({ ...item, precios, seleccion })
        }

        // Ordenar por categoría luego nombre
        ingredientes.sort((a, b) =>
            a.categoria.localeCompare(b.categoria) || a.alimento_nombre.localeCompare(b.alimento_nombre)
        )

        // 7. Calcular resumen por supermercado (basado en selecciones o más barato)
        const mapaResumen = new Map<string, { nombre: string; color?: string; ingredientes: string[]; coste: number }>()
        let costeTotal = 0
        let costeTotalMasCaro = 0

        for (const ing of ingredientes) {
            // Determinar qué supermercado aplica: selección del usuario o el más barato
            const precioAplicado = ing.seleccion
                ? ing.precios.find(p => p.supermercado_id === ing.seleccion?.supermercado_id)
                : ing.precios[0] // ya ordenado por precio

            if (precioAplicado) {
                costeTotal += precioAplicado.coste_euros
                const r = mapaResumen.get(precioAplicado.supermercado_id) || {
                    nombre: precioAplicado.supermercado_nombre,
                    color: precioAplicado.supermercado_color,
                    ingredientes: [],
                    coste: 0,
                }
                r.ingredientes.push(ing.alimento_nombre)
                r.coste += precioAplicado.coste_euros
                mapaResumen.set(precioAplicado.supermercado_id, r)
            }

            // Coste en el super más caro (último de la lista ordenada)
            const precioMasCaro = ing.precios[ing.precios.length - 1]
            if (precioMasCaro) costeTotalMasCaro += precioMasCaro.coste_euros
        }

        const resumen: ResumenSupermercado[] = Array.from(mapaResumen.entries()).map(([id, r]) => ({
            supermercado_id: id,
            supermercado_nombre: r.nombre,
            supermercado_color: r.color,
            ingredientes: r.ingredientes,
            coste_total: Math.round(r.coste * 100) / 100,
        })).sort((a, b) => b.coste_total - a.coste_total)

        return NextResponse.json({
            plan_id: planId,
            semana_inicio: semanaInicio,
            ingredientes,
            resumen_por_supermercado: resumen,
            coste_total: Math.round(costeTotal * 100) / 100,
            coste_total_mas_caro: Math.round(costeTotalMasCaro * 100) / 100,
        })

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Lista Semanal]', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
```

- [ ] **Step 2: Probar la API manualmente**

Con el servidor corriendo en http://localhost:3000, abrir en el navegador (autenticado como coach):
```
http://localhost:3000/api/lista-compra/semanal?plan_id=[UUID_DE_UN_PLAN_ACTIVO]
```

Esperado: JSON con `ingredientes[]` (aunque `precios` esté vacío si aún no hay precios vinculados), sin error 500.

- [ ] **Step 3: Build check**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos
npx next build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos add app/api/lista-compra/
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos commit -m "feat: GET /api/lista-compra/semanal — ingredientes agregados con precios y selecciones"
```

---

## Task 6: API selecciones (GET + POST)

**Files:**
- Create: `app/api/lista-compra/selecciones/route.ts`

- [ ] **Step 1: Crear el archivo**

```bash
mkdir -p /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos/app/api/lista-compra/selecciones
```

```typescript
// app/api/lista-compra/selecciones/route.ts
/**
 * GET  /api/lista-compra/selecciones?plan_id=&semana_inicio=
 * POST /api/lista-compra/selecciones
 *
 * Gestiona las selecciones de supermercado por ingrediente del cliente.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const planId = searchParams.get('plan_id')
        const semanaInicio = searchParams.get('semana_inicio')

        if (!planId || !semanaInicio) {
            return NextResponse.json({ error: 'Faltan plan_id o semana_inicio' }, { status: 400 })
        }

        const srv = createServiceSupabase()
        const { data, error } = await srv
            .from('selecciones_lista_compra')
            .select('*, supermercados(nombre, color, slug)')
            .eq('plan_id', planId)
            .eq('semana_inicio', semanaInicio)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ selecciones: data || [] })

    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json().catch(() => null)
        if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

        const {
            cliente_id, plan_id, alimento_id, supermercado_id,
            producto_nombre, precio_por_kg, url_producto, semana_inicio,
            seleccionado_por = 'cliente',
        } = body

        if (!cliente_id || !plan_id || !alimento_id || !semana_inicio) {
            return NextResponse.json({ error: 'Faltan campos requeridos: cliente_id, plan_id, alimento_id, semana_inicio' }, { status: 400 })
        }

        const srv = createServiceSupabase()

        // Upsert: actualiza si ya existe selección para este alimento/plan/semana
        const { data, error } = await srv
            .from('selecciones_lista_compra')
            .upsert({
                cliente_id,
                plan_id,
                alimento_id,
                supermercado_id: supermercado_id || null,
                producto_nombre: producto_nombre || null,
                precio_por_kg: precio_por_kg || null,
                url_producto: url_producto || null,
                semana_inicio,
                seleccionado_por,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'cliente_id,plan_id,alimento_id,semana_inicio',
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ ok: true, seleccion: data })

    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos
npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos add app/api/lista-compra/selecciones/
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos commit -m "feat: GET+POST /api/lista-compra/selecciones"
```

---

## Task 7: Componente ItemConPrecios

**Files:**
- Create: `components/lista-compra/ItemConPrecios.tsx`

Fila individual de la lista con precios expandibles y selector de tienda. Es un componente puro — recibe datos, llama a un callback al seleccionar.

- [ ] **Step 1: Crear directorio y componente**

```bash
mkdir -p /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos/components/lista-compra
```

```typescript
// components/lista-compra/ItemConPrecios.tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Check } from 'lucide-react'
import type { IngredienteSemanal, PrecioOpcion } from '@/types'

const CATEGORIA_EMOJIS: Record<string, string> = {
    'Verduras': '🥦', 'Hortalizas': '🥬', 'Frutas': '🍎', 'Carnes': '🥩',
    'Pescados': '🐟', 'Mariscos': '🦐', 'Huevos': '🥚', 'Lácteos': '🥛',
    'Lacteos': '🥛', 'Legumbres': '🫘', 'Cereales': '🌾', 'Tubérculos': '🥔',
    'Frutos secos': '🥜', 'Semillas': '🌰', 'Aceites': '🫒', 'Grasas': '🫒',
    'Especias': '🌶️', 'Condimentos': '🧂', 'Salsas': '🥫', 'Bebidas': '🧃',
    'Suplementos': '💊', 'Congelados': '❄️', 'Conservas': '🥫',
    'Pan': '🍞', 'Pastas': '🍝', 'Arroces': '🍚', 'Otros': '📦',
}

function formatGramos(g: number): string {
    return g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${Math.round(g)} g`
}

interface ItemConPreciosProps {
    ingrediente: IngredienteSemanal
    onSeleccionar: (alimentoId: string, opcion: PrecioOpcion) => void
    guardando?: boolean
}

export default function ItemConPrecios({ ingrediente, onSeleccionar, guardando }: ItemConPreciosProps) {
    const [expandido, setExpandido] = useState(false)
    const emoji = CATEGORIA_EMOJIS[ingrediente.categoria] ?? '📦'
    const tienePrecios = ingrediente.precios.length > 0
    const seleccion = ingrediente.seleccion
    const precioActivo = seleccion
        ? ingrediente.precios.find(p => p.supermercado_id === seleccion.supermercado_id)
        : ingrediente.precios[0] // más barato por defecto

    return (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            {/* Fila principal */}
            <button
                onClick={() => tienePrecios && setExpandido(v => !v)}
                disabled={!tienePrecios}
                className="w-full flex items-center justify-between p-3 text-left transition-colors"
                style={{ cursor: tienePrecios ? 'pointer' : 'default' }}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-base shrink-0">{emoji}</span>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">{ingrediente.alimento_nombre}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--muted-foreground)' }}>
                                {formatGramos(ingrediente.cantidad_gramos_total)}
                            </span>
                        </div>
                        {precioActivo ? (
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-xs font-medium" style={{ color: '#16a34a' }}>
                                    {precioActivo.supermercado_nombre}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                    {precioActivo.coste_euros.toFixed(2)} €
                                </span>
                                {seleccion && (
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f0fdf4', color: '#15803d' }}>
                                        ✓ elegido
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                                Sin precio disponible
                            </span>
                        )}
                    </div>
                </div>
                {tienePrecios && (
                    expandido
                        ? <ChevronUp className="w-4 h-4 shrink-0 opacity-40" />
                        : <ChevronDown className="w-4 h-4 shrink-0 opacity-40" />
                )}
            </button>

            {/* Panel de precios expandido */}
            {expandido && (
                <div className="px-3 pb-3 space-y-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                    <p className="pt-2 text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                        Elige dónde comprarlo
                    </p>
                    {ingrediente.precios.map(precio => {
                        const estaSeleccionado = seleccion?.supermercado_id === precio.supermercado_id
                        return (
                            <button
                                key={precio.supermercado_id}
                                onClick={() => onSeleccionar(ingrediente.alimento_id, precio)}
                                disabled={guardando}
                                className="w-full flex items-center justify-between py-2 px-3 rounded-lg transition-colors text-left"
                                style={{
                                    background: estaSeleccionado ? '#f0fdf4' : 'var(--surface)',
                                    border: `1px solid ${estaSeleccionado ? '#86efac' : 'transparent'}`,
                                    opacity: guardando ? 0.6 : 1,
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ background: precio.supermercado_color || '#9ca3af' }}
                                    />
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium">{precio.supermercado_nombre}</span>
                                            {precio.es_mas_barato && (
                                                <span className="text-xs px-1 py-0.5 rounded" style={{ background: '#dcfce7', color: '#15803d' }}>
                                                    más barato
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                            {precio.precio_por_kg.toFixed(2)} €/kg
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-sm font-bold">{precio.coste_euros.toFixed(2)} €</span>
                                    {precio.url_producto && (
                                        <a
                                            href={precio.url_producto}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <ExternalLink className="w-3 h-3 opacity-30 hover:opacity-80" />
                                        </a>
                                    )}
                                    {estaSeleccionado && <Check className="w-4 h-4" style={{ color: '#16a34a' }} />}
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos
npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos add components/lista-compra/
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos commit -m "feat: componente ItemConPrecios — fila de ingrediente con precios expandibles"
```

---

## Task 8: Rediseño ListaCompra.tsx

**Files:**
- Modify: `components/ListaCompra.tsx`

Integra la API semanal y el componente `ItemConPrecios`. Reemplaza la lógica de selector-de-supermercado-global por comparativa inline por ingrediente.

- [ ] **Step 1: Reemplazar el contenido completo de `components/ListaCompra.tsx`**

```typescript
// components/ListaCompra.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, Copy, Check, Store, Loader2 } from 'lucide-react'
import ItemConPrecios from './lista-compra/ItemConPrecios'
import type { ListaCompraSemanal, PrecioOpcion, ResumenSupermercado } from '@/types'

interface ListaCompraProps {
    planId: string
    clienteId: string
    semanaInicio?: string   // YYYY-MM-DD, opcional — usa el lunes actual si se omite
    nombrePlan?: string
    /** 'coach' | 'cliente' — determina seleccionado_por al guardar */
    rol?: 'coach' | 'cliente'
}

function getLunesActual(): string {
    const hoy = new Date()
    const dia = hoy.getDay()
    const diff = dia === 0 ? -6 : 1 - dia
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() + diff)
    return lunes.toISOString().split('T')[0]
}

function formatearEuro(n: number) { return `${n.toFixed(2)} €` }

export default function ListaCompra({ planId, clienteId, semanaInicio, nombrePlan, rol = 'cliente' }: ListaCompraProps) {
    const semana = semanaInicio || getLunesActual()
    const [abierto, setAbierto] = useState(false)
    const [datos, setDatos] = useState<ListaCompraSemanal | null>(null)
    const [cargando, setCargando] = useState(false)
    const [guardando, setGuardando] = useState<string | null>(null) // alimento_id en proceso
    const [copiado, setCopiado] = useState(false)
    const [error, setError] = useState('')

    const cargar = useCallback(async () => {
        if (!planId) return
        setCargando(true)
        setError('')
        try {
            const res = await fetch(`/api/lista-compra/semanal?plan_id=${planId}&semana_inicio=${semana}`)
            const json = await res.json()
            if (!res.ok) setError(json.error || 'Error al cargar lista')
            else setDatos(json)
        } catch {
            setError('Error de red')
        } finally {
            setCargando(false)
        }
    }, [planId, semana])

    useEffect(() => {
        if (abierto && !datos) cargar()
    }, [abierto, datos, cargar])

    async function handleSeleccionar(alimentoId: string, opcion: PrecioOpcion) {
        setGuardando(alimentoId)
        try {
            await fetch('/api/lista-compra/selecciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente_id: clienteId,
                    plan_id: planId,
                    alimento_id: alimentoId,
                    supermercado_id: opcion.supermercado_id,
                    precio_por_kg: opcion.precio_por_kg,
                    url_producto: opcion.url_producto,
                    semana_inicio: semana,
                    seleccionado_por: rol,
                }),
            })
            // Actualizar local sin refetch completo
            setDatos(prev => {
                if (!prev) return prev
                const ingredientes = prev.ingredientes.map(ing => {
                    if (ing.alimento_id !== alimentoId) return ing
                    return {
                        ...ing,
                        seleccion: {
                            cliente_id: clienteId,
                            plan_id: planId,
                            alimento_id: alimentoId,
                            supermercado_id: opcion.supermercado_id,
                            producto_nombre: opcion.supermercado_nombre,
                            precio_por_kg: opcion.precio_por_kg,
                            url_producto: opcion.url_producto,
                            semana_inicio: semana,
                            seleccionado_por: rol,
                        },
                    }
                })
                // Recalcular coste total
                let costeTotal = 0
                for (const ing of ingredientes) {
                    const p = ing.seleccion
                        ? ing.precios.find(px => px.supermercado_id === ing.seleccion?.supermercado_id)
                        : ing.precios[0]
                    if (p) costeTotal += p.coste_euros
                }
                return { ...prev, ingredientes, coste_total: Math.round(costeTotal * 100) / 100 }
            })
        } catch {
            // silencioso — la selección fallará en silencio pero la UI sigue funcionando
        } finally {
            setGuardando(null)
        }
    }

    async function copiarLista() {
        if (!datos) return
        const lineas = [`🛒 LISTA DE LA COMPRA${nombrePlan ? ` — ${nombrePlan}` : ''}`]
        for (const ing of datos.ingredientes) {
            const g = ing.cantidad_gramos_total
            const texto = g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${Math.round(g)} g`
            const super_ = ing.seleccion?.supermercado_id
                ? ing.precios.find(p => p.supermercado_id === ing.seleccion?.supermercado_id)
                : ing.precios[0]
            const precio = super_ ? ` — ${super_.coste_euros.toFixed(2)} € (${super_.supermercado_nombre})` : ''
            lineas.push(`  • ${ing.alimento_nombre} — ${texto}${precio}`)
        }
        if (datos.coste_total > 0) lineas.push(`\n💰 Total estimado: ${formatearEuro(datos.coste_total)}`)
        try {
            await navigator.clipboard.writeText(lineas.join('\n'))
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
        } catch { /* fallback silencioso */ }
    }

    const totalItems = datos?.ingredientes.length ?? 0

    return (
        <div className="card overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setAbierto(!abierto)}
                className="w-full flex items-center justify-between p-4 hover:bg-black/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F0FDF4' }}>
                        <ShoppingCart size={20} style={{ color: '#16A34A' }} />
                    </div>
                    <div className="text-left">
                        <p className="font-semibold" style={{ color: 'var(--text)' }}>Lista de la compra</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {totalItems > 0
                                ? `${totalItems} producto${totalItems !== 1 ? 's' : ''}`
                                : 'Cargando...'}
                            {datos && datos.coste_total > 0 && (
                                <span className="ml-2 font-semibold" style={{ color: '#16A34A' }}>
                                    · {formatearEuro(datos.coste_total)}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {datos && (
                        <button
                            onClick={e => { e.stopPropagation(); copiarLista() }}
                            className="p-2 rounded-lg transition-colors"
                            style={{ background: 'var(--surface)' }}
                            title="Copiar lista"
                        >
                            {copiado ? <Check size={16} style={{ color: '#16a34a' }} /> : <Copy size={16} style={{ color: 'var(--muted-foreground)' }} />}
                        </button>
                    )}
                    <span style={{ color: 'var(--muted-foreground)' }}>{abierto ? '▲' : '▼'}</span>
                </div>
            </button>

            {/* Cuerpo */}
            {abierto && (
                <div className="px-4 pb-4 space-y-5" style={{ borderTop: '1px solid var(--border)' }}>

                    {cargando && (
                        <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--muted-foreground)' }}>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm">Cargando ingredientes y precios...</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>
                            ❌ {error}
                        </div>
                    )}

                    {datos && !cargando && (
                        <>
                            {/* Lista de ingredientes */}
                            <div className="pt-3 space-y-2">
                                {datos.ingredientes.length === 0 ? (
                                    <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
                                        Este plan no tiene ingredientes.
                                    </p>
                                ) : (
                                    datos.ingredientes.map(ing => (
                                        <ItemConPrecios
                                            key={ing.alimento_id}
                                            ingrediente={ing}
                                            onSeleccionar={handleSeleccionar}
                                            guardando={guardando === ing.alimento_id}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Resumen por supermercado */}
                            {datos.resumen_por_supermercado.length > 0 && (
                                <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)' }}>
                                    <div className="flex items-center gap-2">
                                        <Store className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                                        <h4 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                                            Resumen por supermercado
                                        </h4>
                                    </div>
                                    <div className="space-y-2">
                                        {datos.resumen_por_supermercado.map((r: ResumenSupermercado) => (
                                            <div key={r.supermercado_id} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ background: r.supermercado_color || '#9ca3af' }}
                                                    />
                                                    <span className="text-sm truncate" style={{ color: 'var(--text)' }}>
                                                        {r.supermercado_nombre}
                                                    </span>
                                                    <span className="text-xs truncate hidden sm:block" style={{ color: 'var(--muted-foreground)' }}>
                                                        ({r.ingredientes.slice(0, 3).join(', ')}{r.ingredientes.length > 3 ? `... +${r.ingredientes.length - 3}` : ''})
                                                    </span>
                                                </div>
                                                <span className="text-sm font-bold shrink-0 ml-2" style={{ color: 'var(--text)' }}>
                                                    {formatearEuro(r.coste_total)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                                        <div className="flex justify-between">
                                            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Total estimado</span>
                                            <span className="text-sm font-bold" style={{ color: '#16a34a' }}>{formatearEuro(datos.coste_total)}</span>
                                        </div>
                                        {datos.coste_total_mas_caro > datos.coste_total && (
                                            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                                Ahorro vs. comprar todo en el super más caro: {formatearEuro(datos.coste_total_mas_caro - datos.coste_total)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Actualizar el uso de ListaCompra donde se renderiza**

Buscar dónde se usa `<ListaCompra` actualmente:

```bash
grep -rn "ListaCompra" /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos/app --include="*.tsx" | grep -v node_modules
```

El componente ahora requiere `planId` y `clienteId` en lugar de `comidas[]`. Actualizar cada uso encontrado para pasar estos props. Ejemplo típico de cambio:

```tsx
// ANTES
<ListaCompra comidas={plan.comidas} nombrePlan={plan.nombre} />

// DESPUÉS
<ListaCompra planId={plan.id} clienteId={plan.cliente_id} nombrePlan={plan.nombre} rol="coach" />
```

- [ ] **Step 3: Build check completo**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos
npx next build 2>&1 | tail -20
```

Sin errores TypeScript. Si los hay, son en los sitios donde se usa `ListaCompra` con los props antiguos — actualizar esos usos.

- [ ] **Step 4: Probar en el navegador**

Con el servidor corriendo: abrir un plan de dieta → sección Lista de la compra → expandir → verificar que:
- [ ] Los ingredientes aparecen con cantidades totales de la semana
- [ ] Los que tienen precio muestran las opciones de supermercado
- [ ] Al hacer clic en una opción, queda marcada (check verde)
- [ ] El resumen final muestra los supers con sus costes

- [ ] **Step 5: Commit final**

```bash
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos add components/ListaCompra.tsx components/lista-compra/
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos commit -m "feat: lista de la compra semanal con precios inline por supermercado y selecciones"
```

---

## Self-Review

### Cobertura del spec

| Requisito spec | Task que lo implementa |
|----------------|------------------------|
| `es_generico` en alimentos | Task 1 |
| Script deduplicación | Task 2 |
| Normalizador mejorado | Task 3 |
| Tabla `selecciones_lista_compra` + RLS | Task 1 |
| API lista semanal agregada | Task 5 |
| API selecciones GET+POST | Task 6 |
| Precios inline por ingrediente | Task 7 (ItemConPrecios) |
| Resumen por supermercado | Task 8 (ListaCompra rediseño) |
| Coach y cliente pueden elegir | Props `rol` en Task 8 |
| `seleccionado_por` guardado | Task 6 POST |

Analytics coach (fase 2) y Admin revisión dups están explícitamente fuera del alcance de este plan.

### Notas de implementación

- La tabla `productos_supermercado` tiene `unique(supermercado_id, alimento_id)` en el SQL original, pero el código usa `preferido` (campo adicional) y permite múltiples productos por alimento/super via URL. Si hay conflicto en el script de deduplicación, usar el `upsert` protegido que ya está en el script (comprueba si existe antes de insertar).
- `precios_actuales` es una vista ya definida que devuelve el precio más reciente por alimento/supermercado. El Task 5 la usa directamente — no necesita lógica de desduplicación de precios.
- El nuevo `ListaCompra.tsx` cambia la firma de props. Verificar todos los usos con el grep del Task 8, Step 2.
