# ESTADO NutriCoach — 16-05-2026 (Sesión 16 — Auditoría bugs post-reconciliación + Build verificado ✅)

> Leer al inicio de CADA sesión. Documento dinámico actualizado al cerrar (16-05-2026).

---

## 📍 DÓNDE ESTAMOS

**Fase:** Sesión 12 completada. **TODAS las migraciones SQL pendientes ejecutadas y verificadas.** Reconciliación de vinculación scraping→alimentos ejecutada (100% productos vinculados). `match_alimento` mejorada con 6 pasos priorizando seed. Auditoría completa de 29 SQL files contra BD real. Build pendiente para próxima sesión.

---

## ✅ COMPLETADO (16-05-2026) — Sesión 12 — Migraciones BD + Reconciliación

### 🔷 SelectorComparativa ✅
- **`SelectorComparativa.tsx`** creado e integrado en `ListaCompra.tsx`
  - Ranking visual 🥇 más barato → más caro con badges, ahorro potencial
  - Botón "Seleccionar [Supermercado] para todos los alimentos" con aplicación masiva
  - Detección de supermercado más usado como referencia

### 🔷 PWA / Offline ✅
| Componente | Antes | Después |
|-----------|-------|---------|
| `sw.js` | v1 (nunca registrado) | v2 con caching estratégico: static assets, API routes, pages |
| `manifest.json` | `display: "browser"` | `display: "standalone"`, nombre "Casanova Nutrition", iconos maskable |
| `layout.tsx` | Sin registro SW | Script `afterInteractive` registrando `/sw.js` |

Estrategia de caché SW v2:
- **Cache first:** `/recetas`, `/login`, assets estáticos, `/api/recetas`, `/api/alimentos`
- **Network first (fallback cache):** resto de API routes
- **Fallback:** navegación → `/`

### 🔷 Seed Precios + Reconciliación ✅
| Archivo | Propósito |
|---------|-----------|
| `seed_precios_supermercado.sql` | 20+ alimentos básicos (carnes, pescados, huevos, lácteos) con precios realistas en Mercadona, Carrefour, Consum, Lidl, Día, Alcampo, Eroski |
| `supabase_reconciliacion_vinculacion.sql` | Detecta duplicados genéricos creados por scraping, los re-vincula a alimentos semilla con 5-level matching, y elimina huérfanos |

### 🔷 Bug crítico corregido: `comidas_alimentos` → `comida_alimentos` ✅
**Problema:** 4 API routes usaban `comidas_alimentos` (plural) pero la tabla real en Supabase es `comida_alimentos` (singular). Causaba 500 en todas las rutas de precios.

| Archivo | Referencias corregidas |
|---------|----------------------|
| `app/api/precios/ahorro/route.ts` | 2 (`.select()` + property access) |
| `app/api/precios/ahorro/proyeccion/route.ts` | 2 (`.select()` + property access) |
| `app/api/precios/escandallo/route.ts` | 4 (2× `.select()` + 2× property access) |
| `app/api/precios/escandallo/detalle/route.ts` | 2 (`.select()` + property access) |
| **Total** | **10 referencias corregidas en 4 archivos** |

#### Build
- `npx tsc --noEmit` → ✅ exit 0 sin errores
- `grep -r comidas_alimentos --include="*.ts"` → 0 resultados (ninguna referencia residual)

---

## ✅ COMPLETADO (16-05-2026) — Detalle

### 🔷 Migraciones SQL pendientes — Auditoría completa ✅
- **Verificados 29 archivos SQL** contra BD real columna a columna
- **Ejecutados 3 scripts** que estaban pendientes:
  - [`supabase_productos_vs_alimentos.sql`](nutricoach-modulos/supabase_productos_vs_alimentos.sql) — columna `preferido`, índices URL únicos, vistas `mejores_precios_por_alimento`, `top_precios_escandallo`, `precios_actuales` actualizada
  - [`seed_precios_supermercado.sql`](nutricoach-modulos/seed_precios_supermercado.sql) — precios básicos para 20+ alimentos en 7 supermercados
  - [`supabase_fix_rls_alimentos.sql`](nutricoach-modulos/supabase_fix_rls_alimentos.sql) — políticas RLS para lectura pública de alimentos compartidos

### 🔷 Reconciliación de Vinculación (Scraping → Alimentos) ✅
- **Ejecutado [`supabase_reconciliacion_vinculacion.sql`](nutricoach-modulos/supabase_reconciliacion_vinculacion.sql)**
  - ✅ Creada función `reconciliar_alimento()` — matching progresivo 5 niveles
  - ✅ Re-apuntados productos_supermercado a alimentos seed correctos
  - ✅ Eliminados **1.206 duplicados huérfanos** (sin referencias)
  - ✅ **`match_alimento` actualizada** — versión mejorada con 6 pasos:
    1. Exacto (prioriza seed)
    2. Sin acentos (prioriza seed)
    3. Contiene bidireccional (solo seed)
    4. Palabra clave más larga (solo seed)
    5. Fuzzy similarity > 0.3 (solo seed)
    6. Fallback genérico
  - ✅ **Extensión `unaccent` instalada** para matching sin acentos

### 🔷 Estado final BD
| Métrica | Antes | Después |
|---------|-------|---------|
| Productos vinculados | 7.528 | 7.528 (100%) |
| Productos → alimentos sin macros | 4.274 (56.8%) | 4.269 (alimentos legítimos sin macros: sal, especias, agua) |
| Productos → alimentos con macros | 3.254 | 3.259 |
| Duplicados genéricos (es_generico=true) | 2.831 | 1.625 |
| Productos → duplicados scraping | 84 | 84 (requieren re-scrape) |

### 🔷 Verificaciones adicionales
- 43 tablas en schema público ✅
- 114 entries en `knowledge_base` ✅
- 25 categorías IA en `alimento_categorias_ia` ✅
- 11.106 alimentos en cola de enriquecimiento ✅
- 12 supermercados ✅
- `calcular_macros_receta` con columnas correctas (post-fix trigger) ✅

---

## 🐛 Auditoría de Bugs (16-05-2026) ✅
### Build verificado
- `npx tsc --noEmit` (nutricoach): **0 errores** (3 corregidos)
- `npx next build` (nutricoach): **0 errores** ✅
- `npx tsc --noEmit` (nutricoach-modulos): Solo errores en scripts/ de diagnóstico (32, todos one-shot)

### Bugs corregidos
1. **`addToast` con 2 args en lugar de objeto** — [`MiPlan.tsx`](nutricoach/components/PortalCliente/MiPlan.tsx:152)
2. **`total_interacciones` no existe en interfaz** — [`actualizar-perfil.ts`](nutricoach/lib/personalizacion/actualizar-perfil.ts:49)

### Patrón débil detectado
- **21 `.catch(() => {})` silenciosos** sin logging en scrapers, modales y componentes
- Documentado en [`salidas/16-05-2026_AUDITORIA_POST_RECONCILIACION.md`](salidas/16-05-2026_AUDITORIA_POST_RECONCILIACION.md)

## 🔜 PRÓXIMA SESIÓN (prioridades)

1. **Re-scrapear supermercados** para que los nuevos productos usen `match_alimento` mejorado (versión 6 pasos)
2. **Verificar Dashboard de Rentabilidad en vivo** — seleccionar cliente con precios
3. **Validar proyecciones de ahorro** — probar con Mercadona vs Lidl
4. **Build de verificación:** `npx next build`
5. **Despliegue en Vercel**

---


# ESTADO NutriCoach — 10-05-2026 (Sesión 8 — Clausurada)

> Estado anterior. Mantenido como referencia histórica.

---

## 📍 DÓNDE ESTAMOS

**Fase activa:** Tareas técnicas completadas. Pendiente despliegue en Vercel + producto.

---

## ✅ COMPLETADO (10-05-2026) — Sesión 8 (Roo Code)

### 🔷 Tarea 1 — Migración SQL en Supabase ✅
- **Archivo:** [`supabase_lista_compra_migration.sql`](supabase_lista_compra_migration.sql)
- **Ejecución:** `supabase link --project-ref hopeqzwzmlrpktoeygxz` → `supabase db query --linked` ✅
- Tablas creadas: `selecciones_lista_compra`, `dedup_revision`
- Columna añadida: `es_generico` en `alimentos`

### 🔷 Tarea 2 — Backfill de recetas ✅
- **Comando:** `npx tsx scripts/backfill-recetas.ts`
- **Resultado:** 2/2 recetas completadas

### 🔷 Tarea 3 — Scrapers reparados (6 supermercados) ✅
| Scraper | Estrategia | Detalle |
|---------|-----------|---------|
| **Consum** | API REST (Angular SPA) | API real descubierta: `tienda.consum.es/api/rest/V1.0/` — 683 cat. hojas, 8000+ productos |
| **Alcampo** | API REST (Ocado Technology) | API en `compraonline.alcampo.es/api/` — categorías predefinidas + regionId |
| **Carrefour** | Playwright (DOM) | Cloudflare bloquea todo HTTP — navegador headless |
| **Día** | Playwright (DOM) | Access Denied en HTTP — navegador headless |
| **Eroski** | Playwright (DOM) | Apache Tapestry sin REST API — navegador headless |
| **Lidl** | Playwright (DOM) | Ya usaba Playwright — selectores mejorados |

**Fix crítico Consum:** precio en `priceData.prices[0].value.centAmount` (no en `productData.price`). Dividir entre 100.

### 🔷 Tarea 4 — Aldi ⏭️ Saltado
- **Motivo:** aldi.es no tiene e-commerce — solo catálogos semanales (Adobe Experience Manager)

### 🔷 Tarea 5 — Enriquecer 70 alimentos sin macros ✅
- **Comando:** `node scripts/enriquecer-alimentos.mjs --limite=70`
- **Resultado:** 70/70 procesados

### 🔷 Tarea 6 — Merge feature/modulos → main + build ✅
- **Merge:** commit `4973187` — 17 archivos, conflicto CLAUDE.md resuelto con `--theirs`
- **Build:** `npx next build` → **exit 0** ✅
- **Worktrees sincronizados:** nutricoach-modulos + nutricoach-ui fast-forward

### 🔷 Extra — Perfilado DeepSeek 135/135 recetas ✅
- **Comando:** `node scripts/perfilar-recetas-final.mjs --todas`
- **Resultado:** 135/135 con instrucciones ✅ — 0 sin instrucciones, 0 sin kcal
- Problemas corregidos: `🔀orden` ingredientes, `¶párrafo→pasos`, `⚖️cantidades`

---

## 🛠️ Scripts disponibles (resumen)

| Script | Uso |
|--------|-----|
| `node scripts/perfilar-recetas-final.mjs --todas` | Perfilar todas las recetas |
| `node scripts/perfilar-recetas-final.mjs --slug "nombre"` | Perfilar una sola |
| `node scripts/refinar-imagenes-og.mjs --todas` | Refinar fotos reales con GPT-4o (og_image → flux_img2img) |
| `node scripts/refinar-imagenes-og.mjs --slug "nombre"` | Refinar una sola |
| `node scripts/scrapear-imagenes-recetas.mjs --todas` | Scraping fotos reales |
| `node scripts/subir-imagenes-aprobadas.mjs` | Subir mejores fotos a Supabase |
| `node scripts/subir-imagenes-aprobadas.mjs --forzar` | Sobreescribir imágenes existentes |
| `node scripts/regenerar-flux-masivo.mjs --genera` | **NUEVO** — GPT-4o image edit desde flux_txt2img |
| `node scripts/regenerar-flux-masivo.mjs --candidatas` | **NUEVO** — Generar HTML de revisión |
| `node scripts/analizar-urls-pendientes.mjs` | **NUEVO** — Analizar url_origen de recetas pendientes |

---

## 📊 Estado de la BD (imágenes)

- **135 recetas** en Supabase (todas perfiladas ✅)
- **16 imágenes ai_gen** generadas con GPT-4o image edit y subidas a Storage ✅
- **~59 recetas pendientes** de generar (bloqueado por OpenAI billing)
- **37 con url_origen** (34 con og_image en disco) para posible Plan B
- **35 sin url_origen** → seguirán con flux_txt2img como base
