# ESTADO NutriCoach — 09-05-2026 (Sesión 7)

> Leer al inicio de CADA sesión. Documento dinámico actualizado al cerrar.

---

## 📍 DÓNDE ESTAMOS

**Fase activa:** Módulo de escandallo + lista de la compra — construcción completada, pendiente pruebas en UI

---

## ✅ COMPLETADO HOY (09-05-2026) — Sesión 7

### 🧹 Limpieza de BD — no comestibles Mercadona
- **156 no-comestibles eliminados** de la tabla `alimentos` (champús, bastoncillos, cremas, artículos bebé, productos limpieza, etc.)
- Script de auditoría reutilizable: `scripts/auditar-limpiar-mercadona.mjs`
  - Modo solo lectura: `node scripts/auditar-limpiar-mercadona.mjs`
  - Modo borrado: `node scripts/auditar-limpiar-mercadona.mjs --delete`
  - Modo exportar: `node scripts/auditar-limpiar-mercadona.mjs --export`
- BD resultante: **688 alimentos con macros** ✅ + **67 sin macros** (pendiente DeepSeek)
- Exportados a `salidas/2026-05-09_no-comestibles-mercadona.json` y `salidas/2026-05-09_comestibles-sin-macros-mercadona.json`

### 💰 Módulo de escandallo + lista de la compra (NUEVO)

#### API routes creadas
| Ruta | Función |
|------|---------|
| `GET /api/precios/escandallo/receta?id=[id]` | Coste desglosado de una receta por ingrediente con comparativa entre supermercados |
| `GET /api/compra?recetas=...&periodo=semanal` | Genera lista de la compra agrupada por supermercado con costes |

#### Componentes creados
| Archivo | Función |
|---------|---------|
| `components/EscandalloReceta.tsx` | Tab de coste en detalle de receta — comparativa supermercados + precio expandible por ingrediente |
| `app/compra/page.tsx` | Página lista de la compra: selecciona recetas/cliente + período + super → genera lista con costes |

#### Integraciones
- Tab "Coste de la receta" añadido al final de cada página `/recetas/[id]`
- Enlace "Lista de la compra" añadido al sidebar
- `EscandalloReceta` ya estaba en commit anterior; hoy se integró en la receta

---

## ⚠️ CONFLICTOS DE MERGE DETECTADOS

No se ha hecho merge automático porque los siguientes archivos aparecen en múltiples ramas:

| Archivo | main | feature/ui-estetica | feature/modulos |
|---------|------|---------------------|-----------------|
| `CLAUDE.md` | ✅ | ✅ | ✅ |
| `app/api/scrape-receta/route.ts` | — | ✅ | ✅ |
| `app/api/capturar-imagen-receta/route.ts` | ✅ | ✅ | — |

**Acción necesaria mañana:** Resolver manualmente o hacer merge interactivo. Empezar por `feature/ui-estetica → main` (solo 4 archivos).

---

## 🔜 PENDIENTE MAÑANA

1. **Probar en UI** el escandallo de receta (`/recetas/[id]` → sección "Coste")
2. **Probar** la lista de la compra (`/compra`) — seleccionar recetas, generar, verificar costes
3. **Enriquecer 67 alimentos sin macros**: `node scripts/enriquecer-alimentos.mjs --limite=70`
4. **Merge de ramas** con cuidado: resolver conflictos en CLAUDE.md y scrape-receta route
5. Scrapers de otros supermercados (Carrefour, Lidl, Consum) para comparativa real de precios
6. Backfill de recetas: `npx tsx scripts/backfill-recetas.ts`

---

## 🔐 AUDITORÍA DE SEGURIDAD (09-05-2026)
| Check | Estado |
|-------|--------|
| Nuevos endpoints auth-protected | ✅ — `/api/precios/escandallo/receta` y `/api/compra` verifican `auth.getUser()` |
| Sin claves en código | ✅ |
| Service role solo en server-side | ✅ — `createServiceSupabase()` solo en API routes |
| Página `/compra` sin datos sensibles | ✅ — solo agrega cantidades y costes |

---

**Servidor local:** `http://localhost:3000`
**Login coach:** `ccc8890@gmail.com` / `Coach2026!`

---

## ✅ COMPLETADO HOY (09-05-2026) — Sesión 7

### 📸 Sistema de imágenes — flujo completo
- **56 fotos reales** de Instagram/TikTok extraídas con yt-dlp (Chrome cookies)
- **10 imágenes refinadas** con GPT-4o image edit (`flux_img2img--*.webp`):
  - Texto superpuesto eliminado (kcal, títulos, hashtags)
  - Manos/personas eliminadas
  - Luz cálida mediterránea homogeneizada
- **126 recetas** con imagen subida a Supabase Storage
- Flag `--forzar` añadido a `subir-imagenes-aprobadas.mjs` para sobreescribir
- **Decisión**: las `flux_txt2img` (IA desde cero) no gustan — sustituir por fotos reales o dejar sin imagen
- **19 recetas** sin URL de origen → placeholder (añadir URL manualmente cuando se recuerde)

### 🔍 Perfilamiento final de recetas con DeepSeek
- **Nuevo script**: `scripts/perfilar-recetas-final.mjs`
  - Detecta: párrafos sin pasos numerados, duplicados, cantidades raras, orden incorrecto, macros a 0
  - Corrige: pasos numerados (4-8), ingredientes de mayor a menor, elimina duplicados, recalcula macros
  - Prompt actualizado con instrucción explícita: macros POR PORCIÓN + macros/100g
- **91/133 recetas perfiladas** en sesión de hoy — pendiente terminar

---

## ⏳ PENDIENTE PRÓXIMA SESIÓN (en orden de prioridad)

### 1. Terminar perfilamiento de recetas
```bash
cd nutricoach
node scripts/perfilar-recetas-final.mjs --todas
```
Quedan ~42 recetas (91-133). Coste estimado: ~$0.02.

### 2. Segundo pase — macros por porción
Algunas recetas tienen kcal infladas (calculadas para receta entera, no por porción).
Las sospechosas detectadas en sesión de hoy:
- Blondi Almendra (1152 kcal) — posible tarta entera
- Cake Crema Arroz (1205 kcal)
- Burritos Verduras (1077 kcal)
- Donuts Choco (1088 kcal)
- Manzanas con chocolate (1124 kcal) — snack, debería ser ~200 kcal
- Mealprep Carne (1166 kcal)
- Mousse Choco Proteica (827 kcal)
- Fresa requesón donut holes (1062 kcal)
- Lazanya Hígado Pollo (806 kcal) — plausible como plato completo

Relanzar con `--slug "nombre"` para cada una y revisar en la app.

### 3. Terminar refinado de imágenes con GPT-4o
```bash
# Refinar las 46 og_images que quedan sin refinar
node scripts/refinar-imagenes-og.mjs --todas
# Subir todo a Supabase (sobreescribiendo)
node scripts/subir-imagenes-aprobadas.mjs --forzar
```
Coste estimado: ~$1.93 (46 × $0.042).

### 4. Limpiar imágenes flux_txt2img de Supabase
Las 19 recetas sin URL tienen imagen IA fea en Supabase. Borrar su `imagen_url`:
```bash
# Script pendiente de crear: limpiar-imagenes-sin-url.mjs
# O hacerlo directo en Supabase dashboard → tabla recetas → filtrar las 19
```
Recetas afectadas:
Bizcocho Humedo Chocolate, Bizcocho tupper choco, Blondi Almendra, Bowl Carne Boniato,
Brochetas Kebab, Brownie Boniato, CheeseCakeChoco Fit, Donuts choco Zanahoria, Donuts Fit,
Ganache ChocoBonitato, Mini Tacos Carne, Overnight Weetabix, Pancakes Proteico,
Protein Choco pudding, Pudding Choco Nutella, Salmon Boniato, Taco BigMac, Tarta calabaza, Tarta chocoplatano

### 5. Revisar UI macros/100g en detalle de receta
Carlos quiere ver en la ficha de receta:
- Macros por porción (ya existe)
- Macros por 100g (verificar si está implementado o hay que añadirlo)

---

## 🔒 Auditoría de seguridad

- ✅ Sin API keys en código
- ✅ `.env.local` no en git
- ✅ Scripts usan `SUPABASE_SERVICE_ROLE_KEY` solo en server-side
- ✅ Sin endpoints nuevos esta sesión

---

## 📊 Estado de la BD

- **133 recetas** en Supabase
- **91/133** perfiladas con DeepSeek (instrucciones en pasos, macros recalculados)
- **56** con foto real (og_image) en Storage
- **10** con foto refinada GPT-4o (flux_img2img)
- **19** sin imagen (sin URL de origen)
- **473 alimentos** con micronutrientes

---

## 🛠️ Scripts disponibles (resumen)

| Script | Uso |
|--------|-----|
| `node scripts/perfilar-recetas-final.mjs --todas` | Perfilar todas las recetas |
| `node scripts/perfilar-recetas-final.mjs --slug "nombre"` | Perfilar una sola |
| `node scripts/refinar-imagenes-og.mjs --todas` | Refinar fotos reales con GPT-4o |
| `node scripts/refinar-imagenes-og.mjs --slug "nombre"` | Refinar una sola |
| `node scripts/scrapear-imagenes-recetas.mjs --todas` | Scraping fotos reales |
| `node scripts/subir-imagenes-aprobadas.mjs` | Subir mejores fotos a Supabase |
| `node scripts/subir-imagenes-aprobadas.mjs --forzar` | Sobreescribir imágenes existentes |

---

## 🎯 Features pendientes — backlog

### GoalRings — anillos de progreso diario (inspirado en Apple Watch)
**Dónde:** vista de seguimiento diario del cliente (`app/portal-cliente/` o `app/dietas/[id]/seguimiento/`)
**Concepto:** 4 anillos concéntricos SVG animados, uno por macro:
- kcal (amarillo dorado) · prot (verde) · carbs (azul) · grasas (naranja)
- `progress = consumido / objetivo` → rellena el arco
- `< 100%` → color del macro
- `= 100%` → anillo cerrado, pulso de animación
- `> 100%` → exceso en rojo sobre el cierre del anillo
**Base:** extender `components/MacroRing.tsx` o crear `components/GoalRings.tsx`
**Input:** `{ objetivo: { kcal, prot, carbs, grasas }, consumido: { kcal, prot, carbs, grasas } }`
**Prioridad:** alta — es el núcleo visual del seguimiento de dietas

### Sub-app Recetario (PWA independiente)
**Concepto:** versión standalone del recetario para compartir con clientes, amigos o vender
**Distribución sugerida:** PWA primero (€0, días), App Store después si hay tracción ($99/año Apple)
**Base técnica:** mismo Supabase, subdomain diferente, solo módulo recetas
**Monetización posible:** pago único $2.99-4.99, o gratis como lead gen para coaching

### Video en recetas (URL → thumbnail + link)
**Concepto:** guardar url_origen ya existente + mostrar thumbnail con botón "Ver vídeo"
**Coste:** €0 — no self-host, solo link al original
**Extensión futura:** screenshots de pasos clave con ffmpeg + yt-dlp
