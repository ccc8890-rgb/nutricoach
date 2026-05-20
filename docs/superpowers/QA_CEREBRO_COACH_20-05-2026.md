# QA Cerebro del Coach — 20-05-2026

**Objetivo:** validar el flujo diseñado por Claude para el Cerebro del Coach y corregir bloqueos pequeños sin abrir funcionalidades nuevas.

---

## Resultado

Build verificado:

```bash
npm run build
```

Resultado: OK. Next.js compila y genera 105 rutas. La nueva ruta `POST /api/cliente/[codigo]/registrar-acceso` y la nueva pantalla `/clientes/[id]/revisar-rapido` aparecen en el build.

---

## Validaciones realizadas

### 1. Metodología del Coach

Verificado en código:

- Página: `app/coach/metodologia/page.tsx`
- API: `app/api/metodologia-coach/route.ts`
- Uso en generación: `app/api/generar-plan-inicial/route.ts`

Estado:

- La página permite editar proteína por objetivo, límites calóricos, reglas fijas, estilos y filosofía.
- La API usa auth del coach y guarda con `upsert` por `coach_id`.
- `generar-plan-inicial` lee `metodologia_coach` e inyecta el bloque en el prompt.

Pendiente operativo:

- La tabla existe en Supabase, pero estaba vacía al revisarla. Falta que Carlos rellene su metodología desde la UI.

### 2. Auto-trigger tras onboarding profundo

Verificado en:

- `app/api/onboarding/perfil/route.ts`

Estado:

- Guarda `onboarding_perfil_profundo`.
- Marca `onboarding_completado = true`.
- Lanza `POST /api/generar-plan-inicial` en background.

Fix aplicado:

- `autoeficacia` ahora usa `body.autoeficacia ?? null`.
- Antes usaba `body.autoeficacia || null`, lo que convertía el valor válido `0` en `null`.

### 3. Generación inicial de plan

Verificado en:

- `app/api/generar-plan-inicial/route.ts`

Estado:

- Lee cliente, onboarding básico, perfil profundo y metodología.
- Selecciona evidencia científica con `seleccionarProtocolos()`.
- Calcula TDEE y macros.
- Genera prompt con evidencia + metodología + contexto psicológico/logístico.
- Guarda en `registros_ia`.
- Marca cliente como pendiente de revisión.
- Tiene fallback si DeepSeek falla.

Pendiente de QA real:

- Probar con un cliente real después de rellenar metodología.
- Confirmar manualmente que el `prompt` guardado en `registros_ia` contiene el bloque `METODOLOGÍA DEL COACH`.

### 4. Recetas sugeridas en revisión de plan

Verificado en:

- `app/clientes/[id]/revisar-plan/page.tsx`
- `app/api/recetas/sugeridas/route.ts`

Estado:

- `revisar-plan` llama a `/api/recetas/sugeridas` por cada comida.
- Muestra recetas compatibles bajo la distribución de comidas.

Pendiente:

- Validación visual con cliente real.

### 5. AutoCoach: último acceso al portal

Problema detectado:

- `last_portal_access` solo se actualizaba desde `/cliente`, el portal autenticado antiguo.
- El portal real también se usa desde `/cliente/[codigo]`, que no actualizaba acceso.
- Eso hacía que AutoCoach pudiera marcar falsos positivos de `sin_actividad_portal`.

Fix aplicado:

- Nueva ruta:
  - `app/api/cliente/[codigo]/registrar-acceso/route.ts`
- Llamada añadida en:
  - `components/PortalCliente/DashboardCliente.tsx`

Comportamiento:

- Al abrir el portal público con código, se actualiza `clientes.last_portal_access`.
- Usa `codigo_publico` del plan activo para localizar `cliente_id`.

### 6. Revisión express móvil

Implementado en:

- `app/clientes/[id]/revisar-rapido/page.tsx`

Objetivo:

- Dar al coach una pantalla móvil ligera para revisar el estado mínimo de entrega sin entrar en toda la ficha completa.

Incluye:

- Cabecera con nombre, objetivo y estado del cliente.
- Estado de entrega: dieta activa y entreno activo.
- Resumen del último plan IA: kcal, macros y notas coach.
- Comidas del plan IA con recetas compatibles vía `/api/recetas/sugeridas`.
- Alertas coach del plan generado.
- Bottom bar móvil con acciones rápidas.

Decisión conservadora:

- El botón `Aprobar` queda bloqueado si todavía no existe dieta activa.
- Si falta dieta, la acción principal manda a `/clientes/[id]/revisar-plan` para crearla en el flujo completo ya validado.
- `Ajustar` también manda al flujo completo.
- `Regenerar` llama a `/api/generar-plan-inicial` y recarga la pantalla.

Estado:

- Build OK.
- Pendiente de QA visual en navegador con cliente real.

### 7. Clientes TEST para validar flujo

Script creado:

- `scripts/crear-clientes-test-flujo.mjs`

Comando:

```bash
node scripts/crear-clientes-test-flujo.mjs
```

Características:

- Idempotente: si se ejecuta otra vez, actualiza los mismos usuarios TEST.
- Marca clientes y notas con `[TEST_CODEX_FLUJO]`.
- Crea/actualiza Auth user, `profiles`, `clientes`, `onboarding_responses`, `onboarding_perfil_profundo`, `perfil_entreno_cliente`, `registros_ia` y, según caso, dieta/entreno activos.
- Password común de usuarios TEST: `TestNutri2026!`.

Clientes creados:

| Cliente | Caso | Estado |
|---------|------|--------|
| TEST Marta Hipotiroidismo Perdida | hipotiroidismo + perdida grasa + baja autoeficacia | sin dieta / sin entreno |
| TEST Javier Diabetes Recomposicion | diabetes tipo 2 + recomposicion | con dieta / sin entreno |
| TEST Laura Celiaquia Running | celiaquia + running rendimiento | con dieta / con entreno |
| TEST Andres Hyrox Rodilla | Hyrox + molestia rodilla | sin dieta / con entreno |
| TEST Nuria SOP Vegetariana | SOP + vegetariana + perdida grasa | con dieta / con entreno |

Rutas rápidas:

- `/clientes/7bb5502e-65c2-4a06-9513-03f56762b077/revisar-rapido`
- `/clientes/cbf995eb-5f0d-4b81-8e16-73db4c76dda7/revisar-rapido`
- `/clientes/447af7de-40ae-4197-bf5f-0a6addaed620/revisar-rapido`
- `/clientes/2ac317f3-f7d1-4206-b5f2-7e4f58bd788d/revisar-rapido`
- `/clientes/cc6c46db-70eb-4ff7-9534-d01f1ecdefaf/revisar-rapido`

Bug detectado y corregido durante la siembra:

- La BD real no acepta `registros_ia.tipo = 'plan_inicial'`; su constraint actual acepta `dieta`.
- `generar-plan-inicial` ahora guarda el registro como `tipo = 'dieta'`.
- `revisar-plan` y `revisar-rapido` leen ambos tipos: `plan_inicial` y `dieta`.

---

## Archivos modificados

- `app/api/onboarding/perfil/route.ts`
- `app/api/cliente/[codigo]/registrar-acceso/route.ts`
- `app/api/generar-plan-inicial/route.ts`
- `app/clientes/[id]/revisar-rapido/page.tsx`
- `app/clientes/[id]/revisar-plan/page.tsx`
- `components/PortalCliente/DashboardCliente.tsx`
- `scripts/crear-clientes-test-flujo.mjs`
- `docs/superpowers/CONTINUIDAD_CODEX_HASTA_CLAUDE.md`
- `docs/superpowers/QA_CEREBRO_COACH_20-05-2026.md`

---

## Siguiente QA recomendado

1. Carlos entra en `/coach/metodologia` y guarda su metodología.
2. Generar/regenerar plan de un cliente.
3. Confirmar en `registros_ia.prompt` que aparecen:
   - evidencia científica seleccionada
   - `METODOLOGÍA DEL COACH`
   - datos del perfil profundo
4. Abrir `/cliente/[codigo]` y verificar que `clientes.last_portal_access` se actualiza.
5. Revisar plan desde móvil.
6. Abrir `/clientes/[id]/revisar-rapido` con un cliente real y confirmar que dieta, entreno, macros, recetas y acciones rápidas se ven bien.

Si todo eso está OK, el siguiente bloque natural es:

- `Revisión express móvil`, si queremos acelerar entrega de planes.
- `Adherencia semanal Training Pro`, si queremos seguir avanzando en entrenos.
