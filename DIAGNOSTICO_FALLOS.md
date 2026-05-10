# DIAGNÓSTICO DE FALLOS — NutriCoach

> Documento de trazabilidad de errores, causas raíz y soluciones aplicadas.
> Creado: 2026-05-07 | Última revisión: 2026-05-07

---

## FALLO #1 — Bucle infinito de recarga en Safari

### Síntoma
Safari muestra `"web service contex closed webkit internal 0"` y la página entra en un bucle infinito de recarga sin cargar contenido.

### Causa raíz
1. **Turbopack WebSocket HMR**: Safari tiene un bug conocido con WebSocket en modo desarrollo ([webkit bug #252327](https://bugs.webkit.org/show_bug.cgi?id=252327)). El WebSocket de HMR de Turbopack se reconecta constantemente, causando que Safari intente recargar la página en un bucle.
2. **`display: "standalone"` y `appleWebApp`**: El manifest.json forzaba a Safari a abrir en modo standalone (PWA), donde intentaba cachear recursos con el Service Worker, agravando el bucle.
3. **Client Component con `useEffect` en page.tsx**: La página principal era un Client Component que ejecutaba `supabase.auth.getUser()` en el cliente. Safari no ejecutaba bien el JavaScript y el redirect condicional (`if (!user) redirect('/login')`) causaba recargas constantes.

### Solución aplicada
1. **Convertir [`app/page.tsx`](nutricoach/app/page.tsx) a Server Component**: Ahora verifica la autenticación en el servidor con `createServerSupabase()`. Si hay sesión, redirige con `<meta httpEquiv="refresh">`. Si no, muestra la landing estática sin JavaScript.
2. **Eliminar `appleWebApp`** del metadata en [`app/layout.tsx`](nutricoach/app/layout.tsx).
3. **Simplificar manifest.json**: Cambiar `display: "standalone"` → `"browser"`, `start_url: "/cliente"` → `"/"`.
4. **Deshabilitar Service Worker** temporalmente en layout.

### Archivos afectados
| Archivo | Cambio |
|---------|--------|
| [`app/page.tsx`](nutricoach/app/page.tsx) | Client → Server Component |
| [`app/layout.tsx`](nutricoach/app/layout.tsx:25) | Eliminar appleWebApp |
| [`public/manifest.json`](nutricoach/public/manifest.json) | `display: "browser"` |
| [`public/limpiar-sw.html`](nutricoach/public/limpiar-sw.html) | Página de limpieza SW |

### Cómo evitar en el futuro
- Toda página de aterrizaje debe ser Server Component
- No usar `display: "standalone"` en desarrollo
- Probar siempre en Safari antes de desplegar

---

## FALLO #2 — Login no funciona (no redirige ni muestra datos)

### Síntoma
El usuario hace login correctamente (200 OK), pero al redirigir a `/dashboard` no aparecen clientes ni recetas. La página carga vacía.

### Causa raíz
**Desincronización de sesión entre cliente y servidor**:

1. [`lib/supabase.ts`](nutricoach/lib/supabase.ts) usaba `createClient` de `@supabase/supabase-js`, que almacena la sesión en **localStorage** del navegador.
2. El servidor (proxy.ts, Server Components) usa `createServerClient` de `@supabase/ssr`, que almacena la sesión en **cookies**.
3. Estas dos sesiones son **independientes**. El cliente podía tener sesión en localStorage pero el servidor no veía las cookies, y viceversa.
4. Las páginas como [`app/clientes/page.tsx`](nutricoach/app/clientes/page.tsx) usan `supabase.auth.getUser()` del cliente → obtenían `user` → hacían query → pero RLS usa `auth.uid()` → que depende de la cookie, no de localStorage → **la query devolvía vacío porque RLS no veía al usuario**.

### Solución aplicada
1. **Cambiar [`lib/supabase.ts`](nutricoach/lib/supabase.ts) a `createBrowserClient`** de `@supabase/ssr`: Ahora el cliente también escribe las cookies de sesión, sincronizando con el servidor.
2. **Reescribir [`app/api/auth/callback/route.ts`](nutricoach/app/api/auth/callback/route.ts)**: Ya no usa `createServerSupabase()` (que usa `next/headers`, read-only en Route Handlers). Ahora usa `createServerClient` directamente con `NextResponse.cookies.set()` para escribir cookies reales.
3. **Mejorar [`app/login/page.tsx`](nutricoach/app/login/page.tsx)**: Ahora hace `await` del callback y verifica que devuelva OK antes de redirigir.

### Archivos afectados
| Archivo | Cambio |
|---------|--------|
| [`lib/supabase.ts`](nutricoach/lib/supabase.ts) | `createClient` → `createBrowserClient` |
| [`app/api/auth/callback/route.ts`](nutricoach/app/api/auth/callback/route.ts) | Usa `NextResponse.cookies.set()` |
| [`app/login/page.tsx`](nutricoach/app/login/page.tsx) | `await fetch()` con manejo de error |

### Principio aprendido
> **En Next.js con Supabase SSR, NUNCA uses `createClient` de `@supabase/supabase-js` en el cliente.**
> Siempre usa `createBrowserClient` de `@supabase/ssr` para que la sesión se guarde en cookies y sea visible para el servidor.

---

## FALLO #3 — Route Handler no puede escribir cookies con `next/headers`

### Síntoma
El callback de auth (`POST /api/auth/callback`) devolvía 200 OK pero las cookies nunca se escribían. El usuario hacía login pero al recargar la página no había sesión.

### Causa raíz
En Next.js App Router, los Route Handlers (archivos en `app/api/`) **no pueden usar `next/headers` para modificar cookies**. El `cookies().set()` de `next/headers` es read-only en Route Handlers. Cuando `createServerSupabase()` llamaba a `cookieStore.set()`, el `try/catch` capturaba el error silenciosamente y las cookies nunca se establecían.

### Solución aplicada
Reescribir el callback usando `createServerClient` directamente con `NextResponse`:

```typescript
const response = NextResponse.json({ success: true })
const supabase = createServerClient(url, key, {
  cookies: {
    getAll() { return [] },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, { ...options, ... })
      })
    },
  },
})
await supabase.auth.setSession({ access_token, refresh_token })
return response
```

### Archivos afectados
| Archivo | Cambio |
|---------|--------|
| [`app/api/auth/callback/route.ts`](nutricoach/app/api/auth/callback/route.ts) | Reescribir con `createServerClient` + `NextResponse` |

### Cómo evitar en el futuro
- En Route Handlers, **siempre** usar `NextResponse` para escribir cookies
- No usar `createServerSupabase()` dentro de Route Handlers
- Documentar en [`lib/supabase-server.ts`](nutricoach/lib/supabase-server.ts) que esa función es solo para Server Components

---

## FALLO #4 — Queries sin manejo de errores

### Síntoma
Las páginas de clientes, recetas, dietas y dashboard mostraban "No hay datos" aunque hubiera datos en la BD. No se veía ningún error.

### Causa raíz
Las queries de Supabase en los Client Components no tenían `try/catch` ni logging. Si una query fallaba por RLS, por timeout, o por error de red, el `data` llegaba como `null` y `error` se ignoraba. El usuario veía "No hay datos" sin saber que había un error.

### Solución aplicada
Añadir `try/catch` + logging en todas las queries de:
- [`app/clientes/page.tsx`](nutricoach/app/clientes/page.tsx:51)
- [`app/recetas/page.tsx`](nutricoach/app/recetas/page.tsx:87)
- [`app/dashboard/page.tsx`](nutricoach/app/dashboard/page.tsx:141)
- [`app/dietas/page.tsx`](nutricoach/app/dietas/page.tsx:21)

Cada query ahora:
1. Loggea el usuario autenticado
2. Loggea errores de Supabase con `error.message`, `error.details`, `error.hint`
3. Loggea el número de resultados
4. Captura excepciones inesperadas

### Archivos afectados
| Archivo | Línea |
|---------|-------|
| [`app/clientes/page.tsx`](nutricoach/app/clientes/page.tsx) | 51-64 |
| [`app/recetas/page.tsx`](nutricoach/app/recetas/page.tsx) | 87-101 |
| [`app/dashboard/page.tsx`](nutricoach/app/dashboard/page.tsx) | 141-200 |
| [`app/dietas/page.tsx`](nutricoach/app/dietas/page.tsx) | 21-34 |

### Cómo evitar en el futuro
- Toda query de Supabase debe tener `try/catch` + logging
- Los logs deben tener un prefijo único (`[clientes]`, `[recetas]`, etc.)
- Usar `error.message`, `error.details`, `error.hint` para diagnóstico

---

## FALLO #5 — RLS Policy de recetas puede bloquear al coach

### Síntoma
Las recetas no se muestran aunque el coach esté autenticado.

### Causa raíz
Las políticas RLS de recetas son:
```sql
-- Política original (schema.sql)
"Coach can manage own recetas" → coach_id = auth.uid()

-- Política añadida (recetas_v2_migration.sql)
"Cliente puede ver recetas aprobadas" → estado = 'aprobada' AND cliente existe
```

La política de la migración v2 añade una restricción adicional (`estado = 'aprobada'`) que **también** podría estar afectando al coach si la query pide `estado = 'aprobada'`. Aunque la query ya filtra por `estado = 'aprobada'`, es correcto. Pero si hubiera recetas sin filtrar por estado, el coach no las vería con la política v2.

**Estado**: Potencialmente resuelto. La query en [`app/recetas/page.tsx`](nutricoach/app/recetas/page.tsx:92) ya filtra por `estado = 'aprobada'`.

### Recomendación
Si en el futuro se añaden recetas en estado `'borrador'` o `'en_revision'`, la política debe ser:
```sql
CREATE POLICY "Coach can manage own recetas" ON public.recetas
  FOR ALL USING (coach_id = auth.uid());
```
Esta política (del schema original) ya cubre al coach para TODAS las operaciones. La política de cliente es adicional y solo aplica cuando `auth.uid()` es un cliente.

---

## FALLO #6 — Sin manejo de Service Worker obsoleto

### Síntoma
Después de cambiar de puerto o desplegar una nueva versión, Safari seguía sirviendo el Service Worker antiguo desde la caché.

### Causa raíz
Safari cachea agresivamente los Service Workers. Si el SW cambia de contenido pero el nombre del archivo es el mismo, Safari puede ignorar el nuevo SW y seguir usando el antiguo. Especialmente problemático en combinación con `display: "standalone"`.

### Solución aplicada
1. Crear [`public/limpiar-sw.html`](nutricoach/public/limpiar-sw.html) que limpia todos los SW y caches.
2. Añadir ruta `/clear-sw` en [`proxy.ts`](nutricoach/proxy.ts:27) que envía `Clear-Site-Data` header.

### Cómo evitar en el futuro
- Versionar el Service Worker o usar un nombre único por build
- En desarrollo, no registrar SW
- Probar en Safari después de cada cambio de SW

---

## FALLO #8 — Consum: precio en centAmount sin dividir entre 100

### Síntoma
Precios 100× más altos (ej: 5€ → 500€). El scraper leía `priceData.prices[0].value.centAmount` como precio final sin dividir entre 100.

### Causa raíz
La API de Consum devuelve precios en **céntimos** (`centAmount` = 500 para 5.00€). El scraper original trataba `centAmount` como si fuera el precio en euros.

### Solución aplicada
Dividir `centAmount` entre 100 y `centUnitAmount` entre 100 para precio/unidad:
```typescript
// consum.ts:112,117
precio: p.priceData?.prices?.[0]?.value?.centAmount
    ? p.priceData.prices[0].value.centAmount / 100
    : undefined,
precio_unidad: p.priceData?.prices?.[0]?.unitValue?.centUnitAmount
    ? p.priceData.prices[0].unitValue.centUnitAmount / 100
    : undefined,
```

### Archivos afectados
| Archivo | Cambio |
|---------|--------|
| [`lib/scraping/supermercados/consum.ts`](lib/scraping/supermercados/consum.ts:112) | Dividir centAmount entre 100 |
| [`lib/scraping/supermercados/consum.ts`](lib/scraping/supermercados/consum.ts:117) | Dividir centUnitAmount entre 100 |

---

## FALLO #9 — Código ejecutable entre imports en index.ts

### Síntoma
`ReferenceError: Cannot access 'esNoComestible' before initialization`. La comprobación de funciones auxiliares se ejecutaba antes de que los imports terminaran.

### Causa raíz
En [`lib/scraping/index.ts`](lib/scraping/index.ts:4), la función `esNoComestible()` estaba definida entre `import` statements y antes de otras funciones que también se definían inline.

### Solución aplicada
Mover toda la función `esNoComestible()` y `NO_COMESTIBLE_KEYWORDS` DESPUÉS de todos los imports y antes de las funciones que las usan.

### Archivos afectados
| Archivo | Cambio |
|---------|--------|
| [`lib/scraping/index.ts`](lib/scraping/index.ts:4) | Reordenar: imports → constantes → funciones helper → scrapeo |

---

## FALLO #10 — Duplicados en re-ejecución del scraper (sin URL no había upsert)

### Síntoma
Al re-ejecutar un scraper, algunos productos se insertaban como duplicados en vez de actualizarse. Los que tenían `url_producto` se actualizaban bien (constraint UNIQUE), pero los que no tenían URL se duplicaban.

### Causa raíz
El upsert solo usaba `(supermercado_id, url_producto)` como merge key. Productos sin URL (`url_producto IS NULL`) no tenían match, así que el ON CONFLICT no funcionaba.

### Solución aplicada
Añadir upsert por `(supermercado_id, nombre_original)` además del de URL. Productos sin URL se actualizan por nombre.

### Archivos afectados
| Archivo | Cambio |
|---------|--------|
| [`lib/scraping/index.ts`](lib/scraping/index.ts:152) | Añadir upsert por (supermercado_id, nombre_original) |

---

## FALLO #11 — `url_imagen` nunca se persistía en BD

### Síntoma
Aunque los scrapers extraían `url_imagen` de los productos, este campo nunca se escribía en la BD. Las imágenes de producto aparecían siempre como null.

### Causa raíz
El INSERT/UPDATE en `index.ts` incluía 10 campos pero omitía `url_imagen`.

### Solución aplicada
Añadir `url_imagen` tanto en el INSERT como en el UPDATE params.

### Archivos afectados
| Archivo | Cambio |
|---------|--------|
| [`lib/scraping/index.ts`](lib/scraping/index.ts:171,180) | Añadir campo url_imagen en insert y update |

---

## FALLO #12 — Cloudflare: fetch recibe HTML en vez de JSON (no es error del scraper)


### Síntoma
Carrefour, Día devolvían HTML/403 en vez de JSON. No era que la API hubiera cambiado — era Cloudflare bloqueando el scraper HTTP.

### Diagnóstico
Se creó [`scripts/find-scraper-apis.ts`](scripts/find-scraper-apis.ts) con Playwright para interceptar peticiones reales del navegador:
- **Carrefour:** Todas las API calls responden HTML → solo funcionan con navegador real
- **Día:** Access Denied en fetch directo
- **Eroski:** Apache Tapestry — no tiene REST API en absoluto

### Solución aplicada
Migrar los 3 scrapers (Carrefour, Día, Eroski) + Lidl a Playwright con `chromium.launch()`. El navegador real omite Cloudflare.

### Archivos afectados
| Archivo | Cambio |
|---------|--------|
| [`lib/scraping/supermercados/carrefour.ts`](lib/scraping/supermercados/carrefour.ts) | Rewrite completo a Playwright |
| [`lib/scraping/supermercados/dia.ts`](lib/scraping/supermercados/dia.ts) | Rewrite completo a Playwright |
| [`lib/scraping/supermercados/eroski.ts`](lib/scraping/supermercados/eroski.ts) | Rewrite completo a Playwright |
| [`lib/scraping/supermercados/lidl.ts`](lib/scraping/supermercados/lidl.ts) | Refactor a Playwright + nuevos selectores |

---

## FALLO #13 — Comando rm accidental: todos los ai_gen borrados

### Síntoma
Al ejecutar `find nutricoach/salidas/revision-imagenes/ -name "ai_gen--*.jpg" -exec ...` para borrar solo los archivos generados el 10 de mayo, se borraron **todos los 75 archivos** `ai_gen--*.jpg`, incluyendo 18 que el usuario había aprobado el día anterior (9 de mayo).

### Causa raíz
El comando usaba `stat -f "%Sm"` para obtener la fecha de modificación y comparaba el día del mes con `date "+%d"`. Dado que hoy (10 de mayo) es el mismo día del mes que ayer (9 de mayo) - ambos son "10" en el formato `%d` - la comparación `[ "$day" = "$today" ]` evaluaba como true para TODOS los archivos, no solo los del 10 de mayo.

```bash
# Comando erróneo:
stat -f "%Sm" -t "%d" archivo.jpg  # devuelve "10" tanto para 09-May como 10-May
```

### Solución aplicada
Ninguna — los archivos ya estaban borrados. Se regeneraron 16 nuevos con el image edit.

### Cómo evitar en el futuro
- Usar `%Y` (año completo) + `%j` (día del año) en vez de `%d` (día del mes) para evitar ambigüedad entre meses
- Mejor aún: comparar timestamps Unix con `stat -f "%m"` contra una fecha límite en segundos
- O usar `find -newer` con un archivo temporal creado con `touch -t`
- **Siempre** probar el filtro con `echo` antes de ejecutar `rm`
- Tener un backup o al menos confirmar la lista de archivos a borrar con `-exec echo {} \;` primero

---

## FALLO #14 — OpenAI billing hard limit no propaga cambios

### Síntoma
OpenAI devolvía `billing_hard_limit_reached` (`status: 429` con código `billing_hard_limit_reached`) en todas las llamadas a `POST /v1/images/edits`. Aunque el usuario aumentó manualmente el límite en el dashboard de OpenAI de ~$10 → $30 → $100, el error persistió durante toda la sesión (8 intentos en ~2 horas).

### Diagnóstico
El `billing_hard_limit_reached` es un límite separado del `monthly spending limit`. OpenAI tiene dos mecanismos de limitación:

1. **Monthly spending limit**: controlable desde el dashboard → afecta a cuentas de pago por uso
2. **Billing hard limit**: es un límite duro (hard cap) que OpenAI impone automáticamente cuando se detecta un pico de gasto inusual o cuando se cambia el spending limit recientemente

El mensaje de error exacto es:
```json
{
  "error": {
    "message": "Billing hard limit has been reached",
    "type": "insufficient_quota",
    "code": "billing_hard_limit_reached"
  }
}
```

### Solución aplicada
No se pudo resolver durante la sesión. Se intentaron 8 ejecuciones separadas por ~15 minutos cada una después de que el usuario confirmara haber aumentado el límite en el dashboard. Ninguna funcionó.

### Recomendación
- El hard limit suele propagarse en 5-30 minutos, pero en algunos casos puede tardar varias horas
- Verificar en `https://platform.openai.com/account/billing/limits` que tanto el "Monthly spending limit" como el "Hard limit" estén actualizados
- Si el problema persiste tras >1 hora, contactar con soporte de OpenAI
- Alternativa: usar otro proveedor (Replicate, Stability AI) para las imágenes restantes
- El script `regenerar-flux-masivo.mjs` ya implementa reintentos con backoff exponencial y continuará automáticamente donde se quedó (skip existentes)

---

## FALLO #15 — Directorio de salida incorrecto para subir-imagenes-aprobadas.mjs

### Síntoma
Después de generar imágenes con `regenerar-flux-masivo.mjs`, el script `subir-imagenes-aprobadas.mjs` no encontraba los archivos para subir a Supabase.

### Causa raíz
`regenerar-flux-masivo.mjs` escribe las imágenes en `nutricoach/salidas/revision-imagenes/`, pero `subir-imagenes-aprobadas.mjs` lee de `nutricoach-modulos/salidas/revision-imagenes/`. Son dos directorios diferentes dentro del mismo repositorio (worktrees).

### Solución aplicada
Copiar manualmente los archivos entre directorios:
```bash
cp -n nutricoach/salidas/revision-imagenes/ai_gen--*.jpg nutricoach-modulos/salidas/revision-imagenes/
```

### Cómo evitar en el futuro
- Unificar la constante `SALIDA_DIR` en ambos scripts para que apunten al mismo directorio
- O modificar `subir-imagenes-aprobadas.mjs` para que también busque en `nutricoach/salidas/revision-imagenes/`
- Mejor: que ambos scripts usen una ruta relativa a la raíz del proyecto, no al worktree

---

## CHECKLIST DE VERIFICACIÓN

Antes de cada deploy, verificar:

| # | Verificación | Estado |
|---|-------------|--------|
| 1 | Landing page carga sin JS (Server Component) | ✓ |
| 2 | Login funciona en Safari | ✓ |
| 3 | Dashboard muestra datos reales | ✓ |
| 4 | Clientes se listan correctamente | ✓ |
| 5 | Recetas se listan correctamente | ✓ |
| 6 | Dietas se listan correctamente | ✓ |
| 7 | Sin errores en consola del navegador | ✓ |
| 8 | Sin errores en terminal del servidor | ✓ |
| 9 | Service Worker no interfiere | ✓ |
| 10 | Sesión persiste entre recargas | ✓ |

---

## REFERENCIAS

- [`lib/supabase.ts`](nutricoach/lib/supabase.ts) — Cliente browser con `createBrowserClient`
- [`lib/supabase-server.ts`](nutricoach/lib/supabase-server.ts) — Cliente servidor con `createServerClient`
- [`proxy.ts`](nutricoach/proxy.ts) — Middleware de auth
- [`app/api/auth/callback/route.ts`](nutricoach/app/api/auth/callback/route.ts) — Sincronización de sesión
- [`app/page.tsx`](nutricoach/app/page.tsx) — Landing Server Component
- `supabase_schema.sql` — Políticas RLS originales
- `supabase_recetas_v2_migration.sql` — Políticas RLS v2
