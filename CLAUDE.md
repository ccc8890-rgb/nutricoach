# Proyecto: NutriCoach (Human Lab)

## Comandos y Scripts Importantes
- **Ejecutar en desarrollo:** `npm run dev` (dentro de `nutricoach/`)
- **Build (verificar errores TS):** `npx next build` (dentro de `nutricoach/`)
- **Migración de esquema antiguo a nuevo de recetas:** `node scripts/migrar-recetas.mjs`
- **Reparar ingredientes en recetas antiguas:** `node scripts/reparar-recetas-ingredientes.mjs`
- **Backfill de recetas (Scrape URL y auto-relleno):** `npx tsx scripts/backfill-recetas.ts`

---

## 📸 Sistema de Imágenes — Flujo completo (verificado 08-05-2026)

### Filosofía
**Queremos la foto REAL de la receta original**, no IA generativa.
Carlos publica recetas de Instagram/TikTok. La foto real del post es la mejor imagen posible — es auténtica, coincide con la receta y parece hecha por un humano. La IA solo es fallback cuando no hay URL fuente.

**Lo que NO se quiere:** imágenes IA que parezcan bonitas pero no coincidan con la receta.
**Lo que SÍ se quiere:** la foto real del post de Instagram/TikTok donde Carlos vio la receta.

### Cómo funciona el script bulk

**Archivo:** `scripts/scrapear-imagenes-recetas.mjs`

Para cada receta, intenta en orden:

1. **Instagram / TikTok** → `yt-dlp --cookies-from-browser chrome` extrae el thumbnail real del post sin descargar el vídeo. Funciona siempre que Carlos esté logueado en Chrome.
2. **Otras URLs web** → `curl` con user-agent móvil extrae `og:image` del HTML.
3. **Fallback (sin URL)** → Flux Pro txt2img con prompt estilo casero. Requiere crédito en Replicate (~$0.05/imagen).

Las imágenes se guardan en `salidas/revision-imagenes/` como `{metodo}--{nombre-receta}.webp`.

### Comandos — flujo en dos pasos

```bash
# Desde dentro de nutricoach/

# PASO 1 — Generar imágenes localmente
node scripts/scrapear-imagenes-recetas.mjs           # solo recetas SIN imagen
node scripts/scrapear-imagenes-recetas.mjs --todas   # todas las recetas (sin borrar URLs)
node scripts/scrapear-imagenes-recetas.mjs --reset   # borra imagen_url en BD y regenera todo
node scripts/scrapear-imagenes-recetas.mjs --rebuild # solo reconstruye panel HTML desde imágenes en disco

# PASO 2 — Subir a Supabase y actualizar imagen_url en BD
node scripts/subir-imagenes-aprobadas.mjs            # sube la mejor imagen por receta
node scripts/subir-imagenes-aprobadas.mjs --dry-run  # simula sin subir nada (para verificar)
```

**Flujo típico para regenerar todas:**
```bash
node scripts/scrapear-imagenes-recetas.mjs --reset
node scripts/subir-imagenes-aprobadas.mjs
```

### Prioridad de métodos (en subida, de mejor a peor)

| Prioridad | Método (nombre del fichero) | Qué es |
|-----------|----------------------------|--------|
| 1 (mejor) | `og_image` | Foto REAL del post de Instagram/TikTok/web vía yt-dlp o curl |
| 2 | `flux_img2img` | Legado — img2img de Flux Pro. Produce artefactos con strength bajo, no usar |
| 3 | `agent_browser` | Legado — agent-browser CDP. Más lento, reemplazado por yt-dlp |
| 4 | `playwright` | Legado |
| 5 | `bing_images` | Legado |
| 6 (peor) | `flux_txt2img` | IA desde cero. Solo para recetas sin URL de fuente |

### ⚠️ Lecciones aprendidas (no repetir estos errores)

**yt-dlp y Chrome cookies:**
- Ruta de yt-dlp: `/Users/carloscasanova/Desktop/Carlos/CLAUDE/Content-Radar/.venv/bin/yt-dlp`
- Usar siempre `--cookies-from-browser chrome` para Instagram (sin esto, rate limit en pocas llamadas)
- Safari da error de permisos: `Operation not permitted` — usar Chrome
- El comando correcto: `yt-dlp --get-thumbnail --no-warnings --no-playlist --cookies-from-browser chrome "URL"`

**Flux img2img con strength muy bajo (≤0.1):**
- Con strength=0.07 o 0.1, Flux Pro genera artefactos graves (imágenes duplicadas, colages)
- Abandonado — la foto real directa (og_image) es mejor que cualquier img2img

**agent-browser:**
- El comando correcto es `agent-browser open <url> && agent-browser eval "..."` (NO `agent-browser accessibility`)
- Reemplazado por yt-dlp para Instagram/TikTok, que es más rápido y fiable

**Replicate / Flux txt2img:**
- Coste: ~$0.05 por imagen
- 133 recetas sin URL = ~$6.65 → asegurarse de tener crédito antes de lanzar batch completo
- Si el crédito se agota, las recetas sin URL quedan sin imagen (no bloquea las de Instagram)
- Recargar en: replicate.com → billing

**Panel HTML (revision.html):**
- Solo visual. Al abrirse con `file://`, el navegador bloquea `fetch()` a archivos locales
- No se puede subir desde el panel — siempre usar `subir-imagenes-aprobadas.mjs`

**--reset flag:**
- Solo borra `imagen_url` en Supabase donde `estado = 'aprobada'`
- NO borra archivos en Storage ni los .webp locales en `salidas/revision-imagenes/`

### Distribución de recetas (a 08-05-2026)

| Tipo URL | Cantidad | Método usado |
|----------|----------|-------------|
| Instagram | 58 | yt-dlp + Chrome cookies |
| TikTok | 2 | yt-dlp + Chrome cookies |
| Web genérica | 1 | curl og:image |
| Sin URL | ~72 | Flux txt2img (fallback) |
| **Total** | **133** | |

### Variables de entorno necesarias

```bash
NEXT_PUBLIC_SUPABASE_URL=...        # .env.local
SUPABASE_SERVICE_ROLE_KEY=...       # .env.local
REPLICATE_API_KEY=...               # .env.local — solo para fallback Flux txt2img
```

### Bucket de Storage

Bucket: `recetas` (público)
Path: `{receta_id}/auto_{timestamp}.webp`

## Estado Actual (08-05-2026 — Sesión 6)
- **0 errores TypeScript** ✅ — build verificado con `npx next build`
- **0 `any` en states** ✅ — todos los `useState<any>` reemplazados por interfaces concretas
- **0 `useParams()` sin generic** ✅ — todas las 7 páginas usan `useParams<{ id: string }>()`
- **22/25 catch blocks con feedback al usuario** ✅ — los 3 restantes redirigen inmediatamente (intencional)
- **20/20 API routes** usan Supabase server-side ✅
- **PWA configurada:** manifest + service worker + appleWebApp metadata
- **Recalculadora de porciones** en editor de dietas
- **Knowledge base:** 48 fichas (18 + 30 estudios científicos con DOI)
- **Base de datos:** Schema v2 recetas ✅, micronutrientes en 267 alimentos ✅
- **Onboarding autónomo de clientes:** ✅ — tabla `invitaciones` + flujo completo (ver abajo)

## 🆕 Onboarding autónomo (06-05-2026)

### Flujo
1. Coach va a `/clientes` → botón **Invitar** → copia URL al portapapeles
2. Coach manda URL por WhatsApp al cliente
3. Cliente abre `/registro/[token]` → rellena nombre/email/contraseña → se registra
4. Cliente queda vinculado al coach con `revisado_por_coach = false`
5. Badge del sidebar muestra clientes pendientes de revisar

### Archivos
- `supabase_onboarding_migration.sql` — SQL ya ejecutado en Supabase ✅
- `app/api/invitaciones/route.ts` — POST genera invitación (auth coach)
- `app/api/invitaciones/[token]/route.ts` — GET verifica token (público)
- `app/api/registro-invitacion/route.ts` — POST crea cuenta cliente (público)
- `app/registro/[token]/page.tsx` — página pública de registro (sin Sidebar)
- `app/clientes/page.tsx` — botón Invitar añadido
- `lib/useNotificaciones.ts` — badge incluye clientes sin revisar

### Bugs corregidos (auditoría 06-05-2026)
- `fetch` sin `Content-Type` → crash 500 al generar invitación (fix: header + body `{}`)
- Race condition en registro → UPDATE atómico con `.eq('usado', false).select('id')`
- Usuario Auth huérfano si falla INSERT cliente → rollback con `deleteUser`
- `req.json()` sin body → `.catch(() => ({}))`
- Badge nunca se limpiaba → `revisado_por_coach = true` en `loadData()` del perfil
- Contraseña sin validación servidor → `password.length < 6` añadido

### ✅ Verificado 08-05-2026
- ✅ Flujo onboarding end-to-end verificado via API (login → invitación → token → registro con contraseña)
- ✅ Creación de cliente con `revisado_por_coach: false` funciona correctamente
- ⏳ Falta probar OAuth Google (requiere navegador real)
- ⏳ Cuestionario inicial post-registro (en vez de "Tu coach te contactará")
- ⏳ Email de bienvenida automático con link al portal

**⚠️ Contraseña coach actualizada:** `Coach2026!` (la anterior expiró)

## 🧠 Lecciones aprendidas (07-05-2026 — Auditoría de bugs)

### 1. `proxy.ts` vs `middleware.ts` en Next.js 16
- **Next.js 16.2.4** soporta `proxy.ts` como middleware nativo. No renombrar a `middleware.ts`.
- Si coexisten ambos archivos, el build falla con: `"Both middleware file and proxy file are detected"`.
- El [`middleware-manifest.json`](.next/server/middleware-manifest.json) con `"middleware": {}` indica que NO hay middleware registrado — verificar siempre después del build.
- **Síntoma de que el middleware no funciona:** caché de sesión no se refresca, redirecciones de auth no ocurren.

### 2. Error `r'use client'` — Siempre sospechar de caché primero
- El error de parsing `r'use client'` en el mensaje de error **no siempre refleja el contenido real del archivo**.
- Next.js/Turbopack puede mostrar errores de una versión anterior del archivo en caché.
- **Solución:** `rm -rf .next && npx next build` antes de asumir que el archivo está corrupto.
- Verificar byte a byte con `hexdump -C` u `od -c` si hay sospecha de caracteres ocultos.

### 3. `next.config.ts` vacío = problemas silenciosos
- Un `next.config.ts` sin configuraciones puede causar:
  - Imágenes de dominios externos rotas (sin `images.remotePatterns`)
  - Sin headers de seguridad (CSP, X-Frame-Options)
  - Sin configuración de compilador
- **Siempre** incluir al mínimo: `images.remotePatterns`, `reactStrictMode`, y security headers.

### 4. Imports no usados no detectados por el build
- TypeScript con `noUnusedLocals: false` (implícito) no falla en imports no usados.
- En [`login/page.tsx`](app/login/page.tsx) se importaba `useRouter` pero se usaba `window.location.href`.
- **Regla:** Si usas `window.location.href` para redirigir, no necesitas `useRouter`/`useNavigate`.

### 5. Patrón de catch blocks
- 22/25 catch blocks muestran feedback al usuario vía `addToast` o `setError`.
- 3 catch blocks solo hacen `console.error` sin feedback — aceptable solo si redirigen inmediatamente.
- **Regla:** Todo catch block debe: (1) loggear el error, (2) mostrar feedback al usuario, (3) no tragar errores silenciosamente.

### 6. Cliente Supabase en cliente vs servidor
- [`lib/supabase.ts`](lib/supabase.ts) usa `createClient` (cliente-side, para el navegador).
- [`lib/supabase-server.ts`](lib/supabase-server.ts) tiene 3 variantes:
  - `createServerSupabase()` — para Server Components (usa `next/headers`)
  - `createApiSupabase(request)` — para API Route Handlers (usa cookies del request)
  - `createServiceSupabase()` — para bypass de RLS (usa `service_role_key`)
- **Error común:** Usar `createServerSupabase()` en API routes → falla porque `next/headers` no está disponible en ese contexto.

## Reglas de IA
- Seguir siempre el tono y guías establecidas en `DESIGN.md` y `PRODUCT.md`.
- Nada de sombras decorativas o estilos MyFitnessPal.
- Ejecutar sin preguntar si no hay bloqueos.
- **LEER `ESTADO.md` al inicio de cada sesión** — contiene el estado detallado, lecciones aprendidas, y guía para la próxima sesión.
- **PRIMERO verificar si hay build errors** antes de empezar a codificar.

---

## 🔀 Trabajo paralelo — Worktrees activos

Este proyecto usa tres carpetas físicas del mismo repositorio git para trabajar en paralelo sin conflictos.

### Estructura

```
nutricoach/          → rama: main                  → tarea activa (recetario, etc.)
nutricoach-ui/       → rama: feature/ui-estetica   → estética, CSS, diseño visual
nutricoach-modulos/  → rama: feature/modulos       → dietas, entrenos, clientes
```

Cada carpeta se abre en una ventana Antigravity separada con su propio Roo Code. Los cambios son independientes hasta que se mergean a main.

### Qué archivos pertenecen a cada worktree — NO cruzar estos límites

| Worktree | Archivos que puede tocar | Archivos PROHIBIDOS |
|----------|--------------------------|---------------------|
| `nutricoach/` (main) | `app/recetas/`, `app/api/recetas/`, `app/api/scrape-receta/`, `scripts/`, SQL de recetas | `app/globals.css`, `app/layout.tsx`, `components/ui/` |
| `nutricoach-ui/` | `app/globals.css`, `app/layout.tsx`, `components/ui/`, `PLAN_ESTETICO.md`, `DESIGN.md` | `app/recetas/`, `app/dietas/`, `app/clientes/`, `app/api/` |
| `nutricoach-modulos/` | `app/dietas/`, `app/entrenos/`, `app/clientes/`, `app/cuestionario/`, `app/conocimiento/`, `components/diet/`, `components/training/`, `components/dashboard/` | `app/globals.css`, `app/layout.tsx`, `app/recetas/` |

Si una tarea requiere tocar un archivo de otro worktree → avisar a Carlos antes de proceder.

---

## ⚡ End Session — Cierre de jornada con worktrees

Cuando Carlos diga "guarda", "guarda todo", "end session", "cierra", "mañana sigo" o similar, ejecutar este flujo **en orden exacto**:

### PASO 1 — Commit en cada worktree que tuvo trabajo hoy

```bash
# Si hubo trabajo en nutricoach-ui/:
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-ui add .
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-ui commit -m "feat: [descripción breve]"

# Si hubo trabajo en nutricoach-modulos/:
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos add .
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos commit -m "feat: [descripción breve]"

# Commit en main (siempre):
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach add .
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach commit -m "feat: [descripción breve]"
```

### PASO 2 — Auditoría de conflictos ANTES de mergear

```bash
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach diff main..feature/ui-estetica --name-only
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach diff main..feature/modulos --name-only
```

**Regla:** Si el mismo archivo aparece en dos ramas → NO mergear automáticamente. Mostrar a Carlos qué archivo está en conflicto y esperar instrucciones.

### PASO 3 — Merge a main (solo si auditoría limpia)

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
git merge feature/ui-estetica --no-ff -m "merge: ui-estetica → main"
git merge feature/modulos --no-ff -m "merge: modulos → main"
```

### PASO 4 — Build de verificación

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx next build 2>&1 | tail -20
```

Sin errores TypeScript → continuar. Con errores → NO hacer push. Mostrar errores a Carlos y resolver antes de cerrar.

### PASO 5 — Push y documentación

```bash
git push origin main
```

Actualizar `ESTADO.md` con qué se hizo en cada worktree, qué quedó pendiente, próximos pasos.

### Si hay conflicto en el merge

Git marca conflictos con `<<<<<<< HEAD` / `>>>>>>> feature/rama`. Pasos:
1. Abrir el archivo conflictivo
2. Decidir qué versión conservar o cómo combinar
3. `git add [archivo]` → `git commit`

La mejor forma de evitar conflictos: respetar la tabla de archivos de cada worktree.
