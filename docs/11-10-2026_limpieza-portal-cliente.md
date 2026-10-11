# Limpieza del portal cliente (11-10-2026)

Objetivo de Carlos: quitar la paja de la app antigua y dejar el portal cliente mínimo y fluido.

## Hecho

### 1. Progreso minimalista
Commit de «Progreso del portal cliente minimalista». Progreso = peso actual + cambio desde el inicio, gráfico, botón «Hacer check-in» y fotos.
Se quitó: logros, historial de peso en lista, bloque «Registrar peso» (el peso se registra dentro del check-in).
Archivos: `app/cliente/page.tsx`, `components/PortalCliente/GaleriaFotosProgreso.tsx`.

### 2. Código muerto borrado (nadie lo importaba en toda la app)
Commit «chore: borra componentes muertos del portal cliente…» (≈1.590 líneas):
`MilestonesLogros`, `MensajeCoach`, `MealCard`, `PlanSemanal`, `RecetaDelDia` (components/PortalCliente), `training/SemanaEntrenoCard`, `training/TrainingRoomPanel` y la API `app/api/cliente/[codigo]/logros/route.ts`.
También se vació la referencia a `SemanaEntrenoCard` en `scripts/audit-portal-patterns.mjs`.
**Volver atrás:** `git revert <sha del commit chore>` (o `git checkout <sha>^ -- <ruta>` para un archivo).

## Investigado y NO tocado: el portal antiguo `/cliente/[codigo]`

Componentes que solo usa este portal: `DashboardCliente` (1.172 líneas), `ProgresoCharts` (440), `GarminMiniCard` (450), `RegistrarEntrenoModal` (216). Total ≈ 2.300 líneas.

### Qué hace hoy la ruta
- Cliente con sesión → `redirect('/cliente')` (no renderiza nada del portal antiguo).
- Sin sesión → renderiza `DashboardCliente`, **pero** todas las lecturas `/api/cliente/[codigo]/*` exigen sesión (`autorizarAccesoPlan`, auditoría 02-10-2026). Un visitante anónimo ve un portal sin datos: en la práctica está muerto.
- **Coach con sesión → ve el portal antiguo completo.** Es su «vista previa del portal del cliente».

### Quién genera enlaces a `/cliente/{código}` (esto es lo que se rompería)
| Origen | Archivo | Efecto actual |
|---|---|---|
| Callbacks OAuth Strava, COROS, Terra | `app/api/integraciones/{strava,coros,terra}/callback/route.ts` | Tras conectar redirigen a `/cliente/{código}?connected=…`; el cliente acaba en `/cliente` (se pierde el `?connected`, el portal activo no lo lee) |
| Botones «copiar enlace del portal» | `app/dietas/[id]/page.tsx:523`, `app/clientes/[id]/page.tsx:751` | Enlace que el coach comparte; el cliente con sesión acaba en `/cliente` |
| Vuelta desde una sesión de entreno con `?codigo=` | `app/cliente/sesion/[id]/page.tsx:59` | Solo lo pasa el portal antiguo (vista previa del coach) |
| Script de prueba | `scripts/test-onboarding-dieta-habitual-deepseek.ts:468` | Solo test |
| Guardas del portal antiguo | `scripts/audit-portal-patterns.mjs` (reglas 5 y 6) | Exigen que la ruta exista con su guarda |

Los emails (`plan-listo`, `recordatorio-checkin`) ya apuntan a `/cliente` directamente. El manifest PWA también (`/cliente`).

### Conclusión
Para clientes y anónimos el portal antiguo no sirve. Lo único que se perdería al quitarlo es la **vista previa del coach**. Plan seguro si se decide quitarlo (un solo commit revertible):
1. Callbacks OAuth y botones de copiar enlace → apuntar a `/cliente` (y los callbacks a `/cliente?tab=perfil` para que el cliente vea Apps).
2. `app/cliente/[codigo]/page.tsx` → redirección pura (cliente → `/cliente`, resto → `/login?next=/cliente`).
3. Borrar los 4 componentes, `ClientePublicoPwaGuard` y actualizar las reglas 5/6 de `audit-portal-patterns.mjs`.
4. Verificar: `tsc`, `npm run build`, `node scripts/audit-portal-patterns.mjs`, y probar conectar Strava y abrir un enlace antiguo.
**Volver atrás:** `git revert` de ese commit devuelve los archivos y las rutas tal cual.

### Decisión de Carlos y ejecución (11-10-2026)
Carlos no usa la vista previa: el portal antiguo se elimina y `/cliente` queda como único portal del cliente.
Hecho en un solo commit («chore: elimina el portal antiguo /cliente/[codigo]…»):
- `app/cliente/[codigo]/page.tsx` → solo `redirect('/cliente')` (los enlaces viejos siguen funcionando; sin sesión, `/cliente` manda al login). Borrados su `layout.tsx` y `ClientePublicoPwaGuard.tsx`.
- Borrados `DashboardCliente`, `ProgresoCharts`, `GarminMiniCard`, `RegistrarEntrenoModal` (≈2.300 líneas).
- Callbacks OAuth Strava/COROS/Terra → `/cliente?tab=perfil&connected=…` (ya no consultan `planes_nutricion`).
- Botones «copiar enlace» (`dietas/[id]`, `clientes/[id]`) → `${origin}/cliente`.
- `sesion/[id]`: la vuelta es siempre `/cliente?tab=entreno`.
- `audit-portal-patterns.mjs`: regla 5 reescrita (la ruta solo redirige, nunca monta un portal propio) y regla 6 eliminada.
Verificado: `tsc` limpio, `npm run build` OK, auditoría de patrones sin problemas, `curl /cliente/abc123` → 307 a `/cliente`.
**No se tocó:** `lib/tipos-comida.ts` (lo usan APIs del coach) ni las APIs `/api/cliente/[codigo]/*` (siguen en uso por el portal activo y sus tests). El parámetro `?codigo=` de `/api/cliente/sesion/[id]` queda sin quien lo envíe; limpiarlo en una pasada de APIs huérfanas.
**Volver atrás:** `git revert <sha del commit chore del portal antiguo>` restaura archivos y rutas.
**Futuro (no construido):** si se quiere «ver como cliente» desde la cuenta de coach, hacerlo sobre el portal activo (`/cliente` con el cliente elegido), no resucitando este.

## Siguiente pasada (pendiente)
Auditar las rutas `/api/cliente/[codigo]/*` que ya nadie llama (p. ej. `garmin-resumen`, `micronutrientes`, `mis-platos`) comprobando cada una contra el portal activo y los tests.
