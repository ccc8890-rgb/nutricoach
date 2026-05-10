# Plan de trabajo — DeepSeek/Roo Code (10-14 mayo 2026)

> Ejecutar con DeepSeek V3 en Roo Code (modo Ejecución).
> Worktree activo: `nutricoach-modulos/` · Rama: `feature/modulos`
> Servidor dev: `npm run dev` dentro de `nutricoach-modulos/`

---

## TAREA 1 — Revisar resultado de Mercadona (cuando termine el scraper)

El scraper de Mercadona se lanzó el 10-05-2026 en background (task `b272yxy3g`).
Se cancelará si no terminó. Relanzar si es necesario:

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos
npx tsx scripts/scrapear-supermercados.ts mercadona
```

**Esperado:** 4.623 productos, 0 errores, precios guardados en `productos_supermercado`.

**Verificar en Supabase (SQL Editor):**
```sql
SELECT COUNT(*) FROM productos_supermercado
WHERE supermercado_id = (SELECT id FROM supermercados WHERE slug='mercadona');

SELECT COUNT(*) FROM precios_actuales
WHERE supermercado_slug = 'mercadona';
```

Si `precios_actuales` devuelve ~800+ filas → OK.

---

## TAREA 2 — Backfill de recetas

Rellena recetas que tienen `url_origen` pero `instrucciones` vacío.
**Ya funciona.** Solo hay que ejecutarlo:

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos
npx tsx scripts/backfill-recetas.ts
```

Si falla por import, mirar `scripts/backfill-recetas.ts` línea 1-10 y quitar `import 'dotenv/config'` si aparece.

---

## TAREA 3 — Arreglar scrapers rotos

Todos los scrapers excepto Mercadona están rotos porque sus APIs cambiaron.
Hay que investigar y reescribir cada uno.

**Archivos a modificar:**
- `lib/scraping/supermercados/consum.ts`
- `lib/scraping/supermercados/carrefour.ts`
- `lib/scraping/supermercados/dia.ts`
- `lib/scraping/supermercados/alcampo.ts`
- `lib/scraping/supermercados/eroski.ts`
- `lib/scraping/supermercados/lidl.ts`

**Arquitectura general de un scraper** (copiar patrón de `mercadona.ts`):
```typescript
export async function scrapearXXX(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}>
```

**Tipo ProductoRaw** (en `lib/scraping/types.ts`):
```typescript
{
    nombre: string
    precio_actual: number       // precio unidad €
    precio_por_kg?: number      // €/kg (si disponible)
    unidad?: string             // 'kg', 'l', 'ud'
    url_producto?: string
    imagen_url?: string
    marca?: string
    cantidad?: string
    disponible?: boolean
    categoria?: string
}
```

### 3a — Consum
- API antigua (`/api/rest/v1/categories`) → eliminada
- Migró a SPA Angular en `aktiosdigitalservices.com`
- **Investigar** con agent-browser:
  ```bash
  agent-browser accessibility https://www.consum.es/catalogo
  ```
- Buscar llamadas XHR en Network tab del navegador para encontrar la nueva API
- Posible URL base: `https://api.aktiosdigitalservices.com/...`

### 3b — Carrefour
- Cloudflare bloquea fetch simple (403)
- **Opción A:** Usar Playwright (ya existe motor en `lib/scraping/motores/motor-playwright.ts`)
- **Opción B:** Buscar API JSON sin Cloudflare
  ```bash
  agent-browser accessibility "https://www.carrefour.es/supermercado/c/alimentacion"
  ```
- Si se usa Playwright, importar `motorPlaywright` del motor existente

### 3c — Día
- Endpoint API cambió
- **Investigar:**
  ```bash
  agent-browser accessibility https://www.dia.es/compra-online/
  ```
- API anterior era `https://www.dia.es/api/...`

### 3d — Alcampo
- Mismo problema que Día
- **Investigar:**
  ```bash
  agent-browser accessibility https://www.alcampo.es/compra-online/
  ```

### 3e — Eroski
- 302 redirect
- **Investigar:**
  ```bash
  agent-browser accessibility https://supermercado.eroski.es/
  ```

### 3f — Lidl
- 404 en endpoint
- Ya tiene motor Playwright en `motor-playwright.ts`
- **Investigar nueva URL:**
  ```bash
  agent-browser accessibility https://www.lidl.es/es/categoria-de-producto
  ```

**Para todos:** el filtro `esNoComestible()` ya está aplicado en `lib/scraping/index.ts` — no hace falta filtrarlo en el scraper individual.

---

## TAREA 4 — Flujo cuestionario → IA → portal cliente

Probar el flujo completo end-to-end:

1. Ir a `/clientes` → abrir perfil de un cliente → ver cuestionario
2. Rellenar cuestionario del cliente (o usar uno existente)
3. En `/dietas` → "Generar con IA" → verificar que DeepSeek genera el plan
4. En portal cliente → verificar que el plan aparece en `/portal/mi-plan`

**Archivos relevantes:**
- `app/api/generar-dieta/route.ts` — endpoint que llama a DeepSeek
- `app/cuestionario/[id]/page.tsx` — formulario del cliente
- `components/PortalCliente/MiPlan.tsx` — vista del plan en portal

Si hay errores, revisar logs de Supabase (Dashboard → Logs → Edge Functions).

---

## TAREA 5 — Añadir Aldi como nuevo scraper

Aldi no tiene scraper implementado todavía.
**Primero:** añadir Aldi a la tabla `supermercados` en Supabase:
```sql
INSERT INTO supermercados (nombre, slug, activo, color)
VALUES ('Aldi', 'aldi', true, '#009FE3')
ON CONFLICT (slug) DO NOTHING;
```

**Luego:** crear `lib/scraping/supermercados/aldi.ts` con el patrón de Mercadona.

**Investigar API:**
```bash
agent-browser accessibility https://www.aldi.es/comprar-online.html
```

**Registrar en el índice** (`lib/scraping/index.ts` línea ~20):
```typescript
import { scrapearAldi } from './supermercados/aldi'
// ...
const SCRAPERS = {
    // ...
    aldi: scrapearAldi,
}
```

---

## ESTADO de la BD tras esta sesión

| Dato | Valor |
|------|-------|
| Alimentos en BD | ~1.026 |
| Con macros (>0 kcal) | ~801 (78%) |
| Supermercados con precios | Mercadona (scraped hoy) |
| Alimentos con precio Mercadona | ~800+ (pendiente verificar tras scraper) |
| No-comestibles en BD | 0 (limpiados) |

---

## Fixes implementados hoy (10-05-2026) — NO volver a hacer

- ✅ `app/api/scrape-receta/route.ts` — limpia HTML antes de mandar a Gemini/DeepSeek
- ✅ `lib/scraping/index.ts` — filtro `esNoComestible()` + fix upsert por url_producto
- ✅ `scripts/eliminar-no-alimentos.mjs` — keywords ampliadas
- ✅ `lib/scraping/index.ts` — `parseIngredienteRaw()` para JSON-LD ingredients

---

## Comandos útiles

```bash
# Scraper manual de un supermercado concreto
npx tsx scripts/scrapear-supermercados.ts mercadona

# Todos los scrapers disponibles
npx tsx scripts/scrapear-supermercados.ts

# Limpiar no-comestibles
node scripts/eliminar-no-alimentos.mjs --dry-run   # revisar primero
node scripts/eliminar-no-alimentos.mjs              # ejecutar

# Verificar TypeScript
npx tsc --noEmit

# Build completo
npx next build
```

---

## Git — commit y push al terminar

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos
git add .
git commit -m "feat: [descripción]"

# Merge a main cuando todo esté estable:
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
git merge feature/modulos --no-ff -m "merge: modulos → main"
git push origin main
```
