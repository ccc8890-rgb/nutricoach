# Plan Fase 1: Unificación Knowledge Base

> Objetivo: Unificar los 2 sistemas de conocimiento (hardcoded + Supabase) en UNO SOLO,
> manteniendo la compatibilidad total con el pipeline de generación de planes.

---

## Estado actual (resumen)

| Sistema | Archivo | ¿Se usa? | Estado |
|---------|---------|----------|--------|
| 18 protocolos hardcodeados | [`lib/knowledge-base.ts:16`](lib/knowledge-base.ts:16) | ✅ SÍ — en [`app/api/generar-plan-inicial/route.ts:179`](app/api/generar-plan-inicial/route.ts:179) | Activo |
| Tabla Supabase `knowledge_base` | [`supabase_knowledge_base.sql:6`](supabase_knowledge_base.sql:6) | ❌ NO — [`lib/knowledge.ts:12`](lib/knowledge.ts:12) existe pero no se llama | Inactivo |
| Script ingesta DOIs | [`scripts/scrape-kb-condiciones.mjs:1`](scripts/scrape-kb-condiciones.mjs:1) | ⚠️ Manual — ya insertó papers en la BD | Poblado parcial |

---

## Arquitectura objetivo

```
                  ┌─────────────────────────────────────┐
                  │      app/api/generar-plan-inicial    │
                  │         /route.ts (SIN CAMBIOS)      │
                  │                                      │
                  │  import { seleccionarProtocolos,     │
                  │           formatearEvidenciaPara... } │
                  │         from '@/lib/knowledge-base'   │
                  └──────────────┬──────────────────────┘
                                 │ llama a
                                 ▼
                  ┌─────────────────────────────────────┐
                  │     lib/knowledge-base.ts (NUEVO)    │
                  │                                      │
                  │  1. detectarTags(perfil)             │
                  │     → Set<string> (sin cambios)      │
                  │                                      │
                  │  2. consultarKnowledgeDB(supabase,   │
                  │       tags, condiciones)             │
                  │     → ProtocoloCientifico[]          │
                  │     (NUEVA: consulta Supabase)       │
                  │                                      │
                  │  3. seleccionarProtocolos(perfil)    │
                  │     → DB primero, fallback si vacío  │
                  │     (MODIFICADA: añade consulta DB)  │
                  │                                      │
                  │  4. BASE_CONOCIMIENTO (18 protocolos)│
                  │     → fallback si DB vacía           │
                  │     (SE MANTIENE como fallback)      │
                  │                                      │
                  │  5. formatearEvidenciaParaPrompt()   │
                  │     → string (sin cambios)           │
                  └─────────────────────────────────────┘
```

---

## Pasos de implementación (orden estricto)

### 📦 Paso 1: Seed SQL — Migrar 18 protocolos a Supabase

**Archivo nuevo:** `supabase_seed_kb_from_hardcoded.sql`

Mapper de campos entre `ProtocoloCientifico` y `knowledge_base`:

| ProtocoloCientifico | knowledge_base | Notas |
|--------------------|----------------|-------|
| `id` | `id` (generado) + nuevo campo `protocolo_id text` | Para identificar protocolos originales |
| `titulo` | `titulo` | Directo |
| `resumen` | `resumen` | Directo (es el bloque entero con protocolo) |
| `referencias[]` | `fuente` | Join con "; " |
| `tags[]` | `tags` | Directo |
| — | `disciplina` | Siempre `'nutricion'` |
| — | `categoria` | Según tags → mapear a `'proteina'`, `'patologia'`, `'composicion_corporal'`, etc. |
| — | `tipo` | `'protocolo'` |
| — | `nivel_evidencia` | Todos `'revision_sistematica'` |
| — | `condiciones` | Extraer de tags: diabetes, hta, dislipemia... |
| — | `verificado` | `true` (son protocolos verificados por el coach) |
| — | `activo` | `true` |
| — | `fuente_tipo` | `'manual'` |

**Después de ejecutar:** Los 18 protocolos estarán en Supabase con los mismos tags y condiciones.

---

### 🛠️ Paso 2: Refactorizar lib/knowledge-base.ts

**Archivo a modificar:** [`lib/knowledge-base.ts`](lib/knowledge-base.ts:1)

Cambios necesarios:

#### 2a. Añadir import de Supabase client

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
```

#### 2b. Añadir función de consulta a DB

```typescript
export async function consultarKnowledgeDB(
  supabase: SupabaseClient,
  tagsCliente: Set<string>,
  condicionesSalud?: string
): Promise<ProtocoloCientifico[]> {
  // 1. Mapear tags a disciplinas (nutricion, fuerza, running...)
  // 2. Mapear tags a condiciones de salud (diabetes→tags incluye 'diabetes')
  // 3. Query a Supabase knowledge_base con:
  //    - activo = true
  //    - coach_id IS NULL
  //    - tags que contengan AL MENOS UNO de los tags del cliente
  //    - O condiciones que contengan las condiciones del cliente
  //    - ORDER BY verificado DESC, created_at DESC
  //    - LIMIT 8
  // 4. Mapear filas KB a ProtocoloCientifico[]
  // 5. Si row.resumen es corto (<50 chars), usar contenido_completo
  // 6. Devolver array (vacío si no hay resultados)
}
```

#### 2c. Modificar seleccionarProtocolos() para que sea async y consulte DB primero

```typescript
export async function seleccionarProtocolos(
  supabase: SupabaseClient | null,  // null = solo fallback
  perfil: PerfilClienteKB,
  limite: number = 5
): Promise<ProtocoloCientifico[]> {
  const tagsCliente = detectarTags(perfil)

  // Intentar DB primero (si hay supabase client)
  if (supabase) {
    const dbProtocolos = await consultarKnowledgeDB(supabase, tagsCliente, perfil.condiciones_salud)
    if (dbProtocolos.length > 0) {
      // Scorring por tags matching (igual que antes)
      return scoreAndFilter(dbProtocolos, tagsCliente, limite)
    }
  }

  // Fallback: hardcoded
  const scored = BASE_CONOCIMIENTO.map(p => ({
    protocolo: p,
    score: p.tags.filter(t => tagsCliente.has(t)).length
  }))

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
    .map(s => s.protocolo)
}
```

#### 2d. Mantener BASE_CONOCIMIENTO como fallback (sin cambios)

Los 18 protocolos se quedan en el archivo. Se usan solo si la DB devuelve vacío.

#### 2e. Mantener formatearEvidenciaParaPrompt() (sin cambios)

El formateo es idéntico venga de DB o de hardcoded.

---

### 🔗 Paso 3: Actualizar app/api/generar-plan-inicial/route.ts

**Archivo a modificar:** [`app/api/generar-plan-inicial/route.ts`](app/api/generar-plan-inicial/route.ts)

Cambio mínimo — pasar `supabase` a `seleccionarProtocolos()`:

```typescript
// Línea 179 — ANTES:
const protocolos = seleccionarProtocolos({
  objetivo: onboarding.objetivo,
  ...
})

// DESPUÉS:
const protocolos = await seleccionarProtocolos(supabase, {
  objetivo: onboarding.objetivo,
  ...
})
```

La función ahora es `async` y acepta `supabase` como primer parámetro.

---

### 🧪 Paso 4: Test de verificación

**Script nuevo/actualizado:** Test end-to-end que verifique:

1. La consulta a Supabase devuelve los 18 protocolos semilla
2. Para un perfil de ejemplo, `seleccionarProtocolos()` devuelve los correctos
3. El formateo genera el bloque de evidencia correctamente
4. La API `/api/generar-plan-inicial` sigue funcionando (petición real)

---

### 🗑️ Paso 5 (opcional): Limpiar lib/knowledge.ts 

[`lib/knowledge.ts`](lib/knowledge.ts:12) queda huérfana después del refactor — su funcionalidad se absorbe en `consultarKnowledgeDB()`. Podemos:
- **Opción A:** Redirigir `fetchKnowledgeContext()` a la nueva función (mantener compatibilidad)
- **Opción B:** Eliminar el archivo y mover la importación a donde se use

Recomiendo Opción A por ahora — mantener el archivo pero que delegue.

---

## Diagrama de flujo completo

```
Paso 1                          Paso 2                        Paso 3
───────                         ───────                        ───────
Supabase SQL                    lib/knowledge-base.ts          api/route.ts

┌─────────────────┐            ┌─────────────────────┐       ┌─────────────────┐
│ INSERT 18       │            │                     │       │                 │
│ protocolos      │            │ detectarTags()      │       │ seleccionar     │
│ desde hardcoded │───────────▶│     │                │       │ Protocolos(     │
│ → knowledge_base│            │     ▼                │◀──────│   supabase,     │
│                 │            │ consultarKnowledgeDB │       │   perfil)       │
└─────────────────┘            │     │                │       └────────┬────────┘
                               │     ▼                │                │
                               │ ┌─ ¿Hay resultados? ─┐               │
                               │ │  Sí │        │ No  │               │
                               │  ─────          ─────                │
                               │   │              │                   │
                               │   ▼              ▼                   │
                               │ usar DB   │  BASE_CONOCIMIENTO       │
                               │           │  (fallback)              │
                               │           │                          │
                               │           ▼                          │
                               │ formatearEvidenciaParaPrompt()       │
                               │     │                                │
                               └─────┼────────────────────────────────┘
                                     ▼
                            ┌─────────────────────┐
                            │  construirPrompt()  │
                            │  en lib/deepseek.ts  │
                            │                     │
                            │  "EVIDENCIA          │
                            │   CIENTÍFICA          │
                            │   APLICABLE..."      │
                            └─────────────────────┘
                                     │
                                     ▼
                            ┌─────────────────────┐
                            │  DeepSeek V3        │
                            │  genera dieta       │
                            │  con evidencia      │
                            └─────────────────────┘
```

---

## Archivos afectados

| Archivo | Acción | Riesgo |
|---------|--------|--------|
| `supabase_seed_kb_from_hardcoded.sql` | **CREAR** | Bajo — es solo INSERT |
| `lib/knowledge-base.ts` | **MODIFICAR** | Medio — añadir consulta DB + hacer async |
| `app/api/generar-plan-inicial/route.ts` | **MODIFICAR** | Bajo — solo await + pasar supabase |
| `lib/knowledge.ts` | **MANTENER** (o redirigir) | Bajo — no se usa |

---

## Tiempo estimado de implementación

Sin estimaciones de tiempo. Pasos ordenados:

1. Seed SQL (archivo .sql listo para ejecutar en Supabase)
2. Refactor knowledge-base.ts (consulta DB + async + fallback)
3. Actualizar route.ts (await + pasar supabase)
4. Test de verificación
5. Push a Vercel y test en producción

---

## ¿Apruebas este plan para pasar a implementación?
