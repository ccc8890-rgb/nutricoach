# Plan: Corregir ambigüedad FK en queries Supabase de recetas

## Problema
La migración `20260523000000_plan_generation_portal.sql` añadió `receta_vinculada_id` en `receta_ingredientes`, creando una segunda FK a `recetas(id)`. 
Supabase JS no puede resolver automáticamente el embed y lanza error, dejando el recetario vacío.

## Fix
Añadir `!receta_ingredientes_receta_id_fkey` en todos los `.select()` que usen `receta_ingredientes(...)` como embed.

## Archivos a modificar (prioridad crítica)

### 1. Producción (afectan a usuarios)
| Archivo | Línea | Cambio |
|---------|-------|--------|
| `app/recetas/page.tsx` | 112 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |
| `app/api/recetas/[id]/ingredientes/route.ts` | 31 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |
| `app/api/recetas/[id]/healthify/route.ts` | 129 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |

### 2. Scripts (herramientas internas)
| Archivo | Línea | Cambio |
|---------|-------|--------|
| `scripts/auto-etiquetar-recetas.ts` | 38 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |
| `scripts/etiquetar-alergenos.mjs` | 84 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |
| `scripts/migrar-alergenos-eu.mjs` | 128 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |
| `scripts/healthify-receta.mjs` | 287 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |
| `scripts/pulir-fallback-imagenes.mjs` | 285 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |
| `scripts/completar-fotos-faltantes.mjs` | 156 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |
| `scripts/regenerar-imagenes-malas.mjs` | 308 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |
| `scripts/piloto-codex-imagenes.mjs` | 240 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |
| `scripts/generar-imagenes-nuevas.mjs` | 136 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |
| `scripts/regenerar-decision-v3-imagenes.mjs` | 176 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |
| `scripts/regenerar-flux-masivo.mjs` | 145 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |
| `scripts/piloto-regeneracion-imagenes.mjs` | 426 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |
| `scripts/regenerar-imagenes-malas.mjs` | 362 | `receta_ingredientes(` → `receta_ingredientes!receta_ingredientes_receta_id_fkey(` |

### 3. Opcional pero recomendado
- `scripts/auditar-y-corregir-alergenos.mjs` — ya no usa embed (carga recetas e ingredientes separados), no necesita cambio.

## Verificación
1. `npx tsc --noEmit` para TypeScript
2. `npx next build` para build completo
3. Navegar a `/recetas` — debe mostrar todas las recetas aprobadas
