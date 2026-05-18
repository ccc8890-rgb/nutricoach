# BRIEFINGS DEEPSEEK — Cola de tareas mecánicas

> Cuando Claude se queda sin tokens, DeepSeek Aider ejecuta estas tareas en orden.
> Cada briefing es autocontenido: incluye qué hacer, dónde, y cómo verificar.
> Comando de invocación: `~/.claude/scripts/deepseek_aider_ejecutor.sh "..." /ruta/nutricoach`

---

## ESTADO DE LA COLA

| # | Tarea | Estado | Commit |
|---|-------|--------|--------|
| 1 | Gráfico peso portal cliente | ⏳ Pendiente | — |
| 2 | Panel check-ins pendientes en dashboard | ⏳ Pendiente | — |
| 3 | Cron recordatorio email check-in | ⏳ Pendiente | — |
| 4 | Welcome banner portal post-aprobación | ⏳ Pendiente | — |

---

## BRIEFING #1 — Gráfico de progreso de peso en portal cliente

### Objetivo
El portal del cliente (`/cliente`, tab "Progreso") actualmente muestra una lista de check-ins sin ningún gráfico. Añadir un gráfico de líneas con el peso histórico del cliente.

### Arquitectura diseñada por Claude

**Datos disponibles:**
- Tabla `checkins` tiene columnas: `id`, `cliente_id`, `peso_kg`, `fecha`, `nota`, `nota_coach`
- La API del portal usa `codigo` como auth — existe `/api/cliente/[codigo]/checkin` (POST)
- Los datos de check-ins ya se cargan en el portal: ver `app/cliente/page.tsx`, state `historialPeso` + `historialCheckins`

**Librería:** Usar `recharts` — ya está en las dependencias del proyecto. Si no, `npm install recharts`.

**Componente a crear:** `nutricoach/components/PortalCliente/GraficoPeso.tsx`

```tsx
// Props recibidas desde app/cliente/page.tsx
interface GraficoPesoProps {
    datos: Array<{ fecha: string; peso_kg: number; nota?: string }>
    pesoObjetivo?: number  // si existe en el perfil del cliente
}
```

**Diseño:**
- `<LineChart>` de recharts, responsive con `<ResponsiveContainer width="100%" height={200}>`
- Eje X: fechas en formato `DD/MM` (últimas 8 entradas máx, ordenadas ASC)
- Eje Y: peso en kg, dominio `[min-2, max+2]` para que la línea no pegue en los bordes
- Línea color `#0D9488` (teal del design system), dot activo más grande
- Si hay `pesoObjetivo`: línea discontinua gris claro en ese valor con label "Objetivo"
- Tooltip: muestra fecha completa + peso + nota si existe
- Si hay < 2 puntos: mostrar mensaje "Registra más check-ins para ver tu evolución"
- Usar variables CSS (`var(--surface)`, `var(--text)`, `var(--border)`) para dark mode

**Integración en `app/cliente/page.tsx`:**
- Ya existe `historialPeso: SeguimientoPeso[]` en el state con `{ fecha, peso_kg, notas }`
- Importar `GraficoPeso` y añadirlo al principio del tab "progreso" (antes de la lista de check-ins)
- Pasar `datos={historialPeso}` y buscar `pesoObjetivo` en `cliente.peso_objetivo` si existe el campo

### Archivos a crear/editar
- CREAR: `components/PortalCliente/GraficoPeso.tsx`
- EDITAR: `app/cliente/page.tsx` — importar y renderizar `<GraficoPeso>` en tab "progreso"

### Verificación
- `npx tsc --noEmit` sin errores
- En `/cliente` tab Progreso debe aparecer el gráfico si hay ≥2 check-ins
- Con 0-1 check-ins debe aparecer el mensaje de "Registra más check-ins"

---

## BRIEFING #2 — Panel check-ins pendientes de respuesta en dashboard coach

### Objetivo
El dashboard coach (`/`) muestra "Quick Actions" pero no tiene visibilidad de check-ins sin responder. Añadir una card que liste los check-ins de los últimos 7 días donde `nota_coach IS NULL`.

### Arquitectura diseñada por Claude

**Nueva API a crear:** `app/api/checkins/pendientes/route.ts`

```typescript
// GET /api/checkins/pendientes
// Auth: coach autenticado
// Devuelve: checkins de los últimos 7 días donde nota_coach IS NULL
// de clientes que pertenecen al coach

// Query:
// SELECT c.id, c.fecha, c.peso_kg, c.nota, c.energia, c.adherencia,
//        cl.nombre as cliente_nombre, cl.id as cliente_id
// FROM checkins c
// JOIN clientes cl ON cl.id = c.cliente_id
// WHERE cl.coach_id = user.id
//   AND c.nota_coach IS NULL
//   AND c.fecha >= NOW() - INTERVAL '7 days'
// ORDER BY c.fecha DESC
// LIMIT 20

// Auth: createApiSupabase + getUser() → 401 si no autenticado
// DB: createServiceSupabase para el query con join
```

**Componente a crear:** `components/dashboard/CheckinsPendientes.tsx`

- Card con título "Check-ins sin responder" + badge con el conteo
- Si 0 pendientes: estado vacío "Todo al día ✓" en verde
- Lista de filas: nombre cliente + fecha relativa ("hace 2 días") + emoji energía/adherencia
- Cada fila es un link a `/clientes/[cliente_id]?checkin=[checkin_id]` para ir directo al check-in
- Mostrar máx 5 filas, si hay más: link "Ver todos (N)"
- Fetch automático con `useEffect` al montar, sin polling

**Integración en `app/page.tsx` (dashboard):**
- Añadir `<CheckinsPendientes />` debajo del bloque de "Estado reactivo"
- El componente es lazy por defecto (Next.js dynamic import no necesario, es pequeño)

### Archivos a crear/editar
- CREAR: `app/api/checkins/pendientes/route.ts`
- CREAR: `components/dashboard/CheckinsPendientes.tsx`
- EDITAR: `app/page.tsx` — importar y añadir `<CheckinsPendientes />`

### Verificación
- `npx tsc --noEmit` sin errores
- En el dashboard debe aparecer la card
- Si el coach tiene check-ins pendientes, aparecen listados
- Click en una fila navega a la ficha del cliente

---

## BRIEFING #3 — Email recordatorio semanal de check-in

### Objetivo
Los clientes que llevan >7 días sin hacer check-in reciben un email automático recordándoles.

### Arquitectura diseñada por Claude

**Mecanismo:** Vercel Cron Job (ya disponible en el plan). Se ejecuta 1 vez/semana.

**Archivo cron config:** Editar `vercel.json` (o crearlo si no existe en raíz de `nutricoach/`)

```json
{
  "crons": [
    {
      "path": "/api/cron/recordatorio-checkin",
      "schedule": "0 9 * * 1"
    }
  ]
}
```
(Lunes a las 9:00 UTC — 11:00h España)

**Nueva API a crear:** `app/api/cron/recordatorio-checkin/route.ts`

```typescript
// GET /api/cron/recordatorio-checkin
// Auth: header CRON_SECRET (Vercel lo pasa automáticamente)
// Lógica:
// 1. Buscar clientes activos (activo=true) sin check-in en los últimos 8 días
//    SELECT DISTINCT cl.id, cl.nombre, cl.email
//    FROM clientes cl
//    WHERE cl.activo = true
//      AND cl.email IS NOT NULL
//      AND NOT EXISTS (
//        SELECT 1 FROM checkins c
//        WHERE c.cliente_id = cl.id
//          AND c.fecha >= NOW() - INTERVAL '8 days'
//      )
// 2. Para cada cliente: enviar email con Resend
// 3. Devolver { enviados: N, errores: [] }

// Auth check:
// const authHeader = request.headers.get('authorization')
// if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return 401
```

**Template de email:**

Ya existe patrón en `lib/emails/plan-listo.ts`. Crear `lib/emails/recordatorio-checkin.ts`:

```typescript
// Función: sendRecordatorioCheckin(nombre: string, email: string, portalUrl: string)
// Subject: "[nombre], ¿cómo vas esta semana?"
// Body: texto breve animando al check-in, botón "Hacer mi check-in" → link al portal /cliente
// From: usar RESEND_FROM_EMAIL / RESEND_FROM_NAME de env vars
```

**Variable de entorno necesaria en Vercel:** `CRON_SECRET` (generar con `openssl rand -hex 32`)

### Archivos a crear/editar
- CREAR: `app/api/cron/recordatorio-checkin/route.ts`
- CREAR: `lib/emails/recordatorio-checkin.ts`
- EDITAR: `vercel.json` (en raíz de `nutricoach/`) — añadir bloque `"crons"`

### Verificación
- `npx tsc --noEmit` sin errores
- Llamar manualmente al endpoint con el header correcto: `curl -H "Authorization: Bearer TU_CRON_SECRET" https://nutricoach-delta.vercel.app/api/cron/recordatorio-checkin`
- Verificar en Resend dashboard que los emails se enviaron
- En Vercel Dashboard → Settings → Cron Jobs debe aparecer el job

---

## BRIEFING #4 — Welcome banner en portal post-aprobación

### Objetivo
Cuando un cliente es aprobado y entra al portal por primera vez, no hay ningún mensaje de bienvenida. Añadir un banner contextual que desaparezca una vez visto.

### Arquitectura diseñada por Claude

**Trigger:** El portal ya recibe `?onboarding=completo` en la URL cuando viene del onboarding. Usar `localStorage` para no volver a mostrar el banner.

**Lógica en `app/cliente/page.tsx`:**

```typescript
// Al montar, comprobar searchParams y localStorage
const params = new URLSearchParams(window.location.search)
const esNuevo = params.get('onboarding') === 'completo'
const yaVisto = localStorage.getItem('welcome_banner_visto') === 'true'
const [mostrarBanner, setMostrarBanner] = useState(esNuevo && !yaVisto)

function cerrarBanner() {
    localStorage.setItem('welcome_banner_visto', 'true')
    setMostrarBanner(false)
}
```

**UI del banner:** Card destacada encima de los tabs con:
- Fondo teal suave (`#F0FDFA`)
- Icono ✨ o checkmark verde
- Texto: "¡Tu plan está listo! Tu coach [nombre del coach] ha preparado tu dieta y entrenamiento personalizados."
- Botón "Ver mi plan →" que hace scroll al tab dieta
- X para cerrar (llama `cerrarBanner`)

**Nota:** El nombre del coach NO está disponible directamente en el portal (solo viene el `codigo`). Opciones:
1. Añadir `nombre_coach` a la API `/api/cliente/[codigo]/plan` — preferido
2. O mostrar texto genérico sin nombre del coach

La opción 1 requiere añadir un join en la API de plan:
```sql
SELECT pn.*, cl.nombre as cliente_nombre, 
       p.full_name as coach_nombre  -- join a profiles
FROM planes_nutricion pn
JOIN clientes cl ON cl.id = pn.cliente_id
JOIN profiles p ON p.id = cl.coach_id
```

### Archivos a editar
- EDITAR: `app/api/cliente/[codigo]/plan/route.ts` — añadir `coach_nombre` al response
- EDITAR: `app/cliente/page.tsx` — añadir lógica banner + renderizado

### Verificación
- Al entrar con `?onboarding=completo` aparece el banner
- Al cerrar, localStorage queda marcado y no vuelve a aparecer en recargas
- Sin el param, no aparece

---

## NOTAS PARA DEEPSEEK

- Siempre verificar con `npx tsc --noEmit` antes de dar una tarea por terminada
- Build limpio ANTES de empezar cada briefing (por si hay cambios de Claude pendientes)
- Hacer commit individual por cada briefing completado
- Variables CSS del design system: `var(--bg)`, `var(--surface)`, `var(--text)`, `var(--text-muted)`, `var(--border)`. Color teal: `#0D9488`. No hardcodear colores que no sean estos.
- Supabase: para portales públicos usar `createServiceSupabase()`. Para endpoints coach usar `createApiSupabase(request)` + `auth.getUser()`.
- Patrón Next.js params: `{ params }: { params: Promise<{ id: string }> }` + `await params`
