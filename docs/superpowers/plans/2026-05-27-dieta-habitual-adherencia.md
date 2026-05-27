# Dieta Habitual y Adherencia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el onboarding alimentario en una capa persistente de platos habituales que el motor IA debe respetar, adaptar y usar para mejorar adherencia.

**Architecture:** Se añade una tabla `dieta_habitual_cliente`, un parser local barato para extraer platos desde `dia_tipico` y `comidas_favoritas`, y una integración en `generar-plan-inicial` para inyectar esos hábitos en el prompt. La UI de revisión del coach muestra los hábitos detectados antes de aprobar el plan.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres, DeepSeek, Vercel.

---

### Task 1: Persistencia de Dieta Habitual

**Files:**
- Create: `supabase/migrations/20260527_dieta_habitual_cliente.sql`

- [x] Crear tabla `dieta_habitual_cliente` con `cliente_id`, `momento`, `texto_original`, `plato_normalizado`, `frecuencia`, `importancia_adherencia`, `modificable`, `estrategia`, `ingredientes_clave`, `preferencias_detectadas`, `fuente`.
- [x] Activar RLS sin políticas públicas; acceso vía service role desde APIs internas.
- [x] Añadir columnas en `comidas`: `dieta_habitual_id`, `origen_adherencia`, `adaptacion_habitual`.
- [x] Aplicar SQL con `supabase db query --linked -f supabase/migrations/20260527_dieta_habitual_cliente.sql`.

### Task 2: Parser de Onboarding

**Files:**
- Create: `lib/dieta-habitual.ts`

- [x] Extraer platos desde texto libre de `dia_tipico`.
- [x] Extraer favoritos desde `comidas_favoritas`.
- [x] Inferir momento de comida e ingredientes clave.
- [x] Generar estrategia de adherencia: mantener base, ajustar cantidades, crear versión chef healthy cuando proceda.
- [x] Añadir formatter para prompt IA.

### Task 3: Guardado Automático

**Files:**
- Modify: `app/api/onboarding/completo/route.ts`
- Modify: `app/api/onboarding/perfil/route.ts`

- [x] Tras guardar onboarding profundo, recalcular dieta habitual del cliente.
- [x] No bloquear onboarding si la extracción falla; loguear error y continuar.

### Task 4: Integración en Plan Inicial IA

**Files:**
- Modify: `app/api/generar-plan-inicial/route.ts`
- Modify: `lib/deepseek.ts`

- [x] Leer `dieta_habitual_cliente` antes de construir el prompt.
- [x] Backfill automático desde onboarding profundo si no hay registros.
- [x] Inyectar bloque "Platos habituales a respetar y adaptar".
- [x] Exigir a DeepSeek no imponer dieta nueva y marcar slots como `habitual_adaptado` cuando proceda.
- [x] Persistir `origen_adherencia` y `adaptacion_habitual` en `comidas`.

### Task 5: Visibilidad Coach

**Files:**
- Modify: `app/api/clientes/[id]/revisar-data/route.ts`
- Modify: `app/clientes/[id]/revisar-plan/page.tsx`

- [x] Devolver `dietaHabitual` junto a onboarding y registros IA.
- [x] Mostrar tarjeta "Dieta habitual detectada" en revisión del cliente.

### Task 6: Verification

- [x] Ejecutar `npm run build`.
- [x] Verificar columnas con `supabase db query --linked`.
- [x] Probar parser con ejemplo: café con leche, tostadas tomate jamón, arroz pollo, tortilla/sándwich, tacos Big Mac.
- [ ] Probar E2E con cliente nuevo real de test y revisar si DeepSeek respeta hábitos.
