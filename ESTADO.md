# ESTADO NutriCoach — 10-05-2026 (Sesión 8 — Sesión extra de imágenes)

> Leer al inicio de CADA sesión. Documento dinámico actualizado al cerrar.

---

## 📍 DÓNDE ESTAMOS

**Fase activa:** Refinamiento de imágenes flux_txt2img con GPT-4o image edit. Pendiente: completar ~59 recetas restantes (bloqueado por billing de OpenAI), luego subir a Supabase.

---

## ✅ COMPLETADO HOY (10-05-2026) — Sesión extra de imágenes

### 🔷 Refinamiento de imágenes flux_txt2img con GPT-4o

**Objetivo:** Regenerar las 122 imágenes `flux_txt2img--*.webp` que no gustaban (estilo Flux Pro) con GPT-4o.

#### 1er intento — txt2img (desde cero) ❌
- Generadas 58 imágenes con `POST /v1/images/generations` model `gpt-image-1.5`
- El prompt creaba estilo "bodegón de estudio" — **no gustó al usuario**
- Coste: ~$0.034/img → ~$1.97

#### 2o intento — image edit (desde flux_txt2img) ✅ (parcial)
- Cambio a `POST /v1/images/edits` con `input_fidelity: 'high'`
- Toma la imagen `flux_txt2img--*.webp` como base y la refina con prompt minimalista
- **13 generadas** → bloqueo por `billing_hard_limit_reached` de OpenAI
- **3er intento**: 2 más generadas (total 15) → OpenAI seguía bloqueando
- **8 intentos totales**: aumentado límite de ~$10 → $30 → $100, cambio no propagado

#### Subida a Supabase Storage ✅
- **16 imágenes ai_gen** subidas a Supabase Storage con `imagen_url` actualizada en BD
- Script: `node scripts/subir-imagenes-aprobadas.mjs --forzar`

#### Análisis de pendientes 📊
- **72 recetas pendientes** de generar
  - **37 con url_origen** (Instagram) → 34 ya tienen og_image descargada
  - **35 sin url_origen** → seguirán usando flux_txt2img como base
  - **3 sin og_image** (Gofres proteicos, Pollo sees burger, Tarta chocolate 3 ing.)

---

## 🔜 PRÓXIMA SESIÓN (prioridades)

1. **Continuar image edit**: `node scripts/regenerar-flux-masivo.mjs --genera` (cuando OpenAI billing deje de bloquear)
2. **Copiar imágenes y subir**:
   ```bash
   cp -n nutricoach/salidas/revision-imagenes/ai_gen--*.jpg nutricoach-modulos/salidas/revision-imagenes/
   node scripts/subir-imagenes-aprobadas.mjs --forzar
   ```
3. **Si no gusta image edit desde flux_txt2img**: probar image edit desde og_image (como Claude ayer)
4. **Despliegue en Vercel** (prioridad máxima — sin esto no hay clientes reales)
5. **Macros por 100g en ficha de receta** — feature solicitada

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
