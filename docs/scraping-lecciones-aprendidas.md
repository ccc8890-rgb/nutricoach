# Lecciones Aprendidas — Scraping de Supermercados

> Documento para que Claude lo revise al inicio de futuras sesiones sobre scraping.
> Creado: 2026-05-10 tras auditoría de 15 archivos y corrección de 8 bugs.
> Actualizado: 2026-05-16 — Añadida lección #11 sobre browser degradation y batch processing.

---

## 🔴 1. Precios en céntimos vs euros

**Problema:** Las APIs de supermercados (especialmente Consum) devuelven precios en `centAmount` (céntimos). Si se guardan directamente, un producto de 2.50€ se almacena como 250€.

**Regla:** Si ves `centAmount`, `centUnitAmount` o cualquier campo que contenga "cent" en un precio:
- **SIEMPRE dividir entre 100** para convertir a euros.
- Verificar también `centUnitAmount` en el mismo objeto `priceData`.

**Ejemplo (Consum):**
```typescript
// ❌ MAL — guarda 250 en vez de 2.50
precioActual = price.value.centAmount

// ✅ BIEN
precioActual = price.value.centAmount / 100
```

**Buscar:** `centAmount`, `centUnitAmount`, `priceData`, `prices[]`, `value.cent`

---

## 🔴 2. Orden de imports en TypeScript

**Problema:** El código de negocio (variables, funciones) NO puede ir entre los bloques de `import`.

**Regla:** TypeScript exige que todos los `import` estén al inicio del archivo, antes de cualquier otro código. Si pones código entre imports, TypeScript lanza error de compilación.

**Ejemplo:**
```typescript
// ❌ MAL
import { scrapearMercadona } from './mercadona'
const CONSTANTE = 'valor'  // ← ESTO ROMPE TypeScript
import { scrapearCarrefour } from './carrefour'

// ✅ BIEN
import { scrapearMercadona } from './mercadona'
import { scrapearCarrefour } from './carrefour'

const CONSTANTE = 'valor'  // ← CÓDIGO DESPUÉS de todos los imports
```

---

## 🟧 3. Upsert sin URL: comprobar existencia previa

**Problema:** Cuando se inserta un producto sin `url_producto`, no hay clave única para upsert automático. Sin una comprobación manual, cada re-ejecución del scraper crea **duplicados** de miles de productos.

**Regla:** Siempre hacer un `select` previo por `(supermercado_id, nombre_original)` antes de insertar, haya o no URL única.

**Patrón correcto (en index.ts):**
```typescript
// 1. Comprobar si existe
const { data: existente } = await supabase
    .from('productos_supermercado')
    .select('id')
    .eq('supermercado_id', supermercadoId)
    .eq('nombre_original', raw.nombre)  // ← Siempre por nombre
    .maybeSingle()

// 2. Update o Insert según resultado
if (existente) {
    await supabase.from('productos_supermercado').update(payload).eq('id', existente.id)
} else {
    await supabase.from('productos_supermercado').insert(payload)
}
```

---

## 🟧 4. Optional chaining en propiedades de API

**Problema:** Los scrapers asumen que campos como `p.url`, `p.image`, `p.name` siempre existen. Si la API cambia o un producto tiene datos incompletos, `p.url.startsWith('http')` crashea con `TypeError: Cannot read properties of undefined`.

**Regla:** Usar `?.` (optional chaining) en TODOS los accesos a propiedades de la API:
```typescript
// ❌ MAL
p.url.startsWith('http')
p.name.toLowerCase()

// ✅ BIEN
p.url?.startsWith('http')
(p.name || '').toLowerCase()
```

**Buscar:** `.startsWith(`, `.includes(`, `.replace(`, `.match(` **sin** `?.` antes del punto.

---

## 🟡 5. Filtro de comestibles: preferir `some()` + `includes()` sobre `Set.has()`

**Problema:** `Set.has()` solo funciona con coincidencias **exactas**. Una categoría "Champú cabello graso" NO coincide con la keyword "champú" del Set. El producto no comestible se filtra incorrectamente.

**Regla:** Usar `Array.some()` + `includes()` para que coincidan substrings:
```typescript
// ❌ MAL — no captura "Champú cabello graso"
const noComestible = new Set(['champú', ...])
return !noComestible.has(categoria)

// ✅ BIEN — captura cualquier variante
const noComestible = ['champú', ...]
return !noComestible.some(kw => categoria.toLowerCase().includes(kw))
```

---

## 🟡 6. Persistir TODOS los campos en upsert

**Problema:** El campo `imagen_url` (url_imagen en BD) se extraía y mapeaba correctamente, pero **nunca se insertaba** en la tabla `productos_supermercado`.

**Regla:** Al añadir un nuevo campo a `ProductoRaw`, asegurarse de que se persiste en **tres sitios**:
1. **Insert** en `productos_supermercado`
2. **Update** en `productos_supermercado`
3. **Histórico** en `precios_historico` (dentro de `metadatos`)

```typescript
payload = {
    ...campos,
    url_imagen: raw.imagen_url || null,  // ← NO OLVIDAR
}
```

---

## 🟢 7. TypeScript: verificar compilación siempre

**Regla:** Después de cualquier cambio en archivos `.ts`, ejecutar:
```bash
npx tsc --noEmit --pretty
```
No esperar a que el IDE marque errores. Algunos errores (como imports mal ordenados) solo aparecen en `tsc`.

---

## 🟢 8. Nombre de campos: `imagen_url` vs `url_imagen`

**Convención del proyecto:**
- En TypeScript (`ProductoRaw`): `imagen_url`
- En Supabase (BD): `url_imagen`
- Mapear explícitamente en cada consulta SQL/insert.

No asumir que el nombre es el mismo en código y BD.

---

## 🟢 9. Rate limiting por supermercado

Cada supermercado tiene restricciones distintas. Documentar en el scraper:

| Supermercado | Delay | Razón |
|-------------|-------|-------|
| Mercadona | 200ms | API pública sin rate limit agresivo |
| Carrefour | 500ms | Rate limiting agresivo (bloquea rápido) |
| Día | 1000ms | Bloquea fetch directo (usa Playwright) |
| Alcampo | 400ms | API REST moderada |
| Consum | 300ms | API REST permisiva |
| Eroski | 800ms | Sin API REST (usa Playwright) |
| Lidl | 600ms | Sin API REST (usa Playwright, domcontentloaded) |

---

## 🟢 10. Duplicación de lógica: archivo .ts vs .mjs

Actualmente hay **dos implementaciones** paralelas de los scrapers:
1. `lib/scraping/supermercados/*.ts` — Usado por el orquestrador vía API Next.js
2. `scripts/ejecutar-scraping.mjs` — Script autónomo ESM con sus propias funciones inline

**Riesgo:** Las implementaciones divergen. Si se arregla un bug en una, la otra sigue rota.

**Recomendación:** A futuro, el script `.mjs` debería importar las funciones `.ts` compiladas, o al menos compartir la lógica de mapeo y upsert.

---

## 🔴 11. Browser degradation en Playwright (Lidl — el caso más grave)

**Problema:** Playwright acumula **memory leak** por cada página cargada en el mismo browser. Con 60 términos de búsqueda en un solo browser:
- Test inicial (primeros términos): ~5-6s por término → 6 min total estimado
- Producción real (todos los términos): degradación progresiva hasta 7.9 horas
- Últimos términos: "page has been closed" o timeout, 0 productos

**Causa raíz:** Playwright retiene referencias a estilos renderizados, imágenes en memoria caché, y objetos JS de páginas anteriores. Cada `page.goto()` con un nuevo DOM→ el browser no libera memoria entre páginas.

**Solución (v3): Batch processing con browser refresh:**
```typescript
// ❌ MAL — 60 términos con 1 browser
const browser = await chromium.launch()
for (const termino of 60Terminos) {
    await page.goto(...)
    // ... browser cada vez más lento
}
await browser.close()  // Solo se cierra al final

// ✅ BIEN — lotes de 15, browser nuevo cada lote
const TERMINOS_POR_LOTE = 15
const lotes = chunk(60Terminos, TERMINOS_POR_LOTE)

for (const lote of lotes) {
    const browser = await chromium.launch()  // ← NUEVO cada lote
    for (const termino of lote) {
        await page.goto(...)
    }
    await browser.close()  // ← SE CIERRA después de 15 términos
    // Libera toda la memoria acumulada
}
```

**Métrica de mejora (Lidl):**
| Estrategia | Tiempo | Factor |
|-----------|--------|--------|
| v2 (1 browser, 60 términos) | 7.9h (28,439s) | 1x |
| v3 (4 lotes × 15, browser refresh) | ~5 min (estimado) | **~95x más rápido** |
| Test diagnóstico (2 lotes × 3 términos) | ~14s/lote, sin degradación | Rendimiento consistente |

**Regla general para scrapers Playwright con múltiples páginas:**
- Si el scraper visita **>20 páginas** en el mismo browser, dividir en lotes con browser refresh.
- El tamaño de lote depende del supermercado: 15-20 términos/páginas por lote es seguro.
- Medir degradación: si el tiempo por página se duplica respecto al inicio, el lote es demasiado grande.
- Usar `domcontentloaded` en vez de `networkidle` para evitar que el browser espere recursos no esenciales.
- Args útiles para reducir footprint: `--disable-dev-shm-usage`, `--disable-gpu`, `--single-process`.

**Archivo de referencia:** [`lidl.ts`](nutricoach-modulos/lib/scraping/supermercados/lidl.ts) — implementa batch processing con comentarios inline y lecciones aprendidas en el header.
