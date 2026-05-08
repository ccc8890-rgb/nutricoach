s# Proyecto: NutriCoach (Human Lab)

## Comandos y Scripts Importantes
- **Ejecutar en desarrollo:** `npm run dev` (dentro de `nutricoach/`)
- **Build (verificar errores TS):** `npx next build` (dentro de `nutricoach/`)
- **Migración de esquema antiguo a nuevo de recetas:** `node scripts/migrar-recetas.mjs`
- **Reparar ingredientes en recetas antiguas:** `node scripts/reparar-recetas-ingredientes.mjs`
- **Backfill de recetas (Scrape URL y auto-relleno):** `npx tsx scripts/backfill-recetas.ts`

---

## 📸 Sistema de Imágenes — Flujo completo (08-05-2026)

### Filosofía
Las imágenes NO deben parecer generadas por IA ni copiadas de otra web.
El objetivo es que parezcan fotos tomadas por Carlos: luz natural, cocina mediterránea,
cámara mirrorless personal (Sony A6700), imperfecciones naturales, variedad entre recetas.

**Lo que NO se quiere:** estilo editorial Ottolenghi, Hasselblad, studio lighting, professional cookbook.
**Lo que SÍ se quiere:** foto casual de blog personal, luz de ventana, mesa de casa, plato simple, honest.

### Flujo automático (al scrape de una receta nueva)

```
Usuario pega URL en /recetas/nueva
  → /api/scrape-receta extrae la receta (JSON-LD o DeepSeek)
  → Si el JSON-LD ya trae imagen → se usa directamente
  → Si NO hay imagen → fire-and-forget a /api/capturar-imagen-receta (background, no bloquea)
       ↓
/api/capturar-imagen-receta:
  1. agent-browser accessibility <url_origen>
     → lee el árbol de accesibilidad de la página fuente
     → extrae URLs de imágenes (.jpg .png .webp) del árbol
     → descarga la más grande (>15KB) — la foto REAL de la receta
  2. Si hay imagen real + REPLICATE_API_KEY configurada:
     → Flux Pro img2img con strength=0.2 (solo cambia el 20%)
     → Prompt: "casual home food photo, Sony mirrorless, Mediterranean afternoon light..."
     → seed aleatorio → cada receta tiene resultado diferente
  3. Sube a Supabase Storage bucket 'recetas-imagenes' → receta_id/auto_timestamp.webp
  4. UPDATE recetas SET imagen_url = <url_publica> WHERE id = receta_id
```

### Script bulk — para rellenar recetas existentes

```bash
# Procesar solo recetas SIN imagen (modo por defecto)
node scripts/scrapear-imagenes-recetas.mjs

# Procesar TODAS las recetas aprobadas (sin borrar las que ya tienen imagen)
node scripts/scrapear-imagenes-recetas.mjs --todas

# BORRAR imagen_url de todas las recetas y regenerar desde cero
node scripts/scrapear-imagenes-recetas.mjs --reset

# Reconstruir panel HTML desde imágenes ya descargadas en disco
node scripts/scrapear-imagenes-recetas.mjs --rebuild
```

### Orden de métodos en el script bulk

| Prioridad | Método | Descripción |
|-----------|--------|-------------|
| 0 (primero) | `agent_browser` | Captura imagen REAL de la página fuente via agent-browser. Si la obtiene, salta Flux. |
| 1 (fallback) | `flux_txt2img` | Genera desde cero con prompt casero si no hay imagen real. strength=0.2, seed random. |
| — (legacy) | `playwright` / `bing_images` | Métodos anteriores, mantenidos como fallback manual en el panel. |

### Resultado del script

Genera `salidas/revision-imagenes/revision.html` — panel HTML interactivo donde:
- Se ven todas las imágenes candidatas por receta
- Se aprueba la mejor con un clic
- Botón "Auto-seleccionar mejores" usa el orden de prioridad de la tabla
- Botón "Subir aprobadas" → llama `/api/subir-imagen-receta` y actualiza Supabase

### Variables de entorno necesarias

```bash
NEXT_PUBLIC_SUPABASE_URL=...        # .env.local
SUPABASE_SERVICE_ROLE_KEY=...       # .env.local
REPLICATE_API_KEY=...               # .env.local — opcional, sin él solo usa imagen real directa
```

### Cuándo ejecutar --reset

Ejecutar `--reset` cuando:
- Las imágenes actuales parecen demasiado IA/estudio y se quieren rehacer
- Se cambió el prompt de estilo y se quiere aplicar a todas
- Hay imágenes copiadas de otras webs y se quiere sustituir por versión propia

El `--reset` solo limpia `imagen_url` en Supabase (pone NULL). No borra archivos de Storage.
Después de `--reset`, el script procesa todas las recetas y genera el panel de revisión.

### Bucket de Storage

Bucket: `recetas-imagenes` (público, debe crearse en Supabase si no existe)
Path: `{receta_id}/auto_{timestamp}.webp`
Para crear el bucket: Supabase Dashboard → Storage → New bucket → "recetas-imagenes" → Public.

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
