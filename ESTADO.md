# ESTADO NutriCoach — 11-05-2026 (Sesión 8 — Sesión extra de imágenes COMPLETADA)

> Leer al inicio de CADA sesión. Documento dinámico actualizado al cerrar.

---

## 📍 DÓNDE ESTAMOS

**Fase:** Imágenes de recetas completada. **135/135 recetas con imagen_url** en Supabase Storage + BD. Pendiente: despliegue en Vercel.

---

## ✅ COMPLETADO (10-05-2026) — Sesión extra de imágenes

### 🔷 Refinamiento masivo flux_txt2img → ai_gen con GPT-4o ✅

**Problema resuelto:** Crédito OpenAI agotado (no hard limit). Usuario recargó y se completó la generación.

#### Resultados finales
| Fase | Resultado |
|------|-----------|
| `regenerar-flux-masivo.mjs --genera` (59 pendientes) | ✅ **59/59 generadas** (~$2.00, ~3s entre cada una) |
| 2 errores OpenAI 520 temporales | ✅ Recuperados automáticamente |
| Copia a nutricoach-modulos/ | ✅ 62 archivos ai_gen--*.jpg |
| Subida a Supabase Storage + BD | ✅ **63 imágenes** (62 ai_gen + 1 og_image), 135/135 con imagen_url |
| Fix bug acentos en candidatas.html | ✅ Slugs con tildes ahora matchean correctamente |

#### Estado BD imágenes
- **62** archivos `ai_gen--*.jpg` en disco (generados por GPT-4o)
- **56** `og_image--*.webp` (fotos reales Instagram)
- **56** `flux_img2img--*.webp` (refinadas con Replicate)
- **122** `flux_txt2img--*.webp` (originales, reemplazadas por ai_gen)

---

## 🔜 PRÓXIMA SESIÓN (prioridades)

1. **Revisar imágenes en el recetario** (usuario lo hará con calma)
2. **Regenerar 14 recetas que aún tienen flux_txt2img**: ejecutar `node scripts/regenerar-flux-masivo.mjs --genera` (se saltará las existentes)
3. **Despliegue en Vercel** (prioridad máxima — sin esto no hay clientes reales)
4. **Macros por 100g en ficha de receta** — feature solicitada

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
