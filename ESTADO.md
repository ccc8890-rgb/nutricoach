# ESTADO NutriCoach — 15-05-2026 (Sesión 13 — Pipeline de calidad operativo)

> Leer al inicio de CADA sesión. Documento dinámico actualizado al cerrar (15-05-2026).

---

## 📍 DÓNDE ESTAMOS

**Fase:** Sesión 13 completada. Pipeline de calidad `pipeline-calidad.mjs` ejecutado en producción sin errores. 229 recetas con macros recalculados, 59 intolerancias etiquetadas, 41 matches corregidos. Deploy a Vercel lanzado. Recetario 100% limpio.

---

## ✅ COMPLETADO (15-05-2026) — Sesión 13 — Pipeline automático

### 🔷 Pipeline-calidad.mjs ✅

Ejecutado en producción contra las 229 recetas del recetario:

| Fase | Resultado |
|------|-----------|
| Fix matches | 41 corregidos (chocolate negro 85%, miel) |
| Recalcular macros | 229 recetas actualizadas desde ingredientes |
| Intolerancias | 59 recetas etiquetadas |
| Errores | 0 |

Scripts committeados: `pipeline-calidad.mjs`, `healthify-receta.mjs`, `completar-fotos-faltantes.mjs`

### 🔷 Fix: Replicate→OpenAI en capturar-imagen ✅

`app/api/capturar-imagen-receta/route.ts`: `applyFluxImgToImg` → `applyOpenAIImageEdit` (sin crédito en Replicate)

### 🔷 Versión Fit de recetas ✅ (sesión anterior)

- API: `app/api/recetas/[id]/healthify/route.ts`
- UI: botón "Generar versión fit" en detalle de receta
- FK `receta_original_id` enlaza fit con original

---

## 🔜 PRÓXIMA SESIÓN (prioridades)

1. **Verificar Vercel** — `nutricoach-delta.vercel.app`: versión fit, macros/porción, intolerancias
2. **Revisar fotos** — algunas tienen placeholder "ya", Carlos quiere regenerarlas con mejor estilo
3. **Conectar bridge al pipeline** — `bridge_nutricoach.py` → llamar `node pipeline-calidad.mjs --id <uuid>` al finalizar cada inserción
4. **7 recetas macros altas** — Carlos revisa porciones desde UI

---

## 📐 Comandos de mantenimiento del recetario

```bash
# Pipeline tras importar nuevas recetas
cd NUTRICION/nutricoach-modulos
node scripts/pipeline-calidad.mjs --horas 24

# Versión fit desde CLI (script)
node scripts/healthify-receta.mjs --id <uuid-receta-original> --link-to <uuid-original>

# Quality gate completo
node scripts/quality-gate-recetas.mjs --todas
```

---

## 📊 Estado del recetario (15-05-2026)

| Métrica | Valor |
|---------|-------|
| Recetas aprobadas | 229 |
| Sin foto | 0 ✅ |
| Sin macros | 0 ✅ |
| Sin intolerancias | 0 ✅ |
| Matches sospechosos | 0 ✅ |
| Macros altas (revisar) | 7 🟡 |

---

# ESTADO NutriCoach — 13-05-2026 (Sesión 11 — PWA/Offline + Bugs + Precios básicos COMPLETADO)

> Leer al inicio de CADA sesión. Documento dinámico actualizado al cerrar (13-05-2026).

---

## 📍 DÓNDE ESTAMOS

**Fase:** Sesión 11 completada. SelectorComparativa integrado. PWA/offline activado (SW v2 + manifest standalone). Seed de precios + reconciliación de vinculación creado. **Bug crítico corregido:** `comidas_alimentos` → `comida_alimentos` (10 referencias en 4 API routes). Build verificado ✅.

---

## ✅ COMPLETADO (13-05-2026) — Sesión 11 — PWA/Offline + Bug Fix + Precios

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

## 🔜 PRÓXIMA SESIÓN (prioridades)

1. **Probar el Dashboard de Rentabilidad en vivo** — seleccionar cliente con precios y verificar que los datos se renderizan
2. **Validar que las proyecciones de ahorro funcionan** — probar con Mercadona vs Lidl
3. **Histórico y Tendencias** — Mostrar evolución de precios en el tiempo (si hay datos históricos)
4. **Relanzar lote restante Content Radar** (los ~50 items que quedaron por SSL timeout)
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
