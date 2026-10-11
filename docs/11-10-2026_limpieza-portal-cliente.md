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

## Rutas API huérfanas borradas (11-10-2026)
Se cruzó cada `app/api/cliente/**/route.ts` con sus llamadores (componentes, páginas, otras rutas, scripts). Sin ningún llamador y borradas (≈ 700 líneas):
`[codigo]/chat/leer` (lo usaba el `MensajeCoach` ya eliminado), `[codigo]/completar-sesion`, `[codigo]/dashboard` (lo usaba el portal antiguo), `[codigo]/entreno-estado`, `[codigo]/comidas/[comidaId]/alimentos` (+ `[itemId]`; editar alimentos de una comida desde el portal, ya sin pantalla) y `feedback-comida` (stub marcado «obsoleto»).
Después se revisaron `micronutrientes` y `mis-platos`: `MisPlatos` está montado en la pestaña Recetas del portal activo (se queda) y `MicronutrientesPortal` lo usa el panel del coach (se queda). Solo era huérfana la ruta `[codigo]/micronutrientes` (borrada, y el componente ahora exige `clienteId`).
Verificación: `tsc` limpio, `npm run build` OK, auditoría de patrones sin problemas. Tests: `test-portal-write-auth` (2 fallos) y `test-comidas-authorization` (34) fallaban ya antes de estos borrados; se revisaron después (ver «Tests de autorización arreglados»).
**Volver atrás:** `git revert <sha del commit «chore: borra rutas API huérfanas…»>`.

## Tests de autorización arreglados (11-10-2026)
No eran fallos de seguridad: los simuladores de los tests se habían quedado atrás respecto al código real.
1. **Guard con una sola consulta** (`lib/cliente/autorizar-escritura-plan.ts`, optimización de rendimiento anterior): ahora lee el cliente incrustado en el plan (`plan.cliente`). Los simuladores de `scripts/test-portal-write-auth.ts` y `scripts/test-comidas-authorization.ts` devolvían el plan sin ese campo, así que el guard denegaba siempre y fallaban todos los casos «propietario autorizado» y los que dependían de ellos (36 fallos).
2. **Estados de adherencia** (Fase C): `registrar-comida` solo acepta `hecha`/`saltada`/`cambiada`; el test enviaba `completada` y recibía 400 en vez de llegar a la comprobación de comida ajena (2 fallos).
Resultado: `test-portal-write-auth` 167/0 y `test-comidas-authorization` 110/0. Solo se tocaron los tests, ningún código de la app. Lección: al optimizar un guard, actualizar a la vez el simulador de sus tests.
