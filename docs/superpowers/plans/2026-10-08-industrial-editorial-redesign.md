# Industrial Editorial Hybrid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el portal cliente en un sistema Industrial Editorial Hybrid claramente distinto, preservando rutas, datos, funciones y arquitectura.

**Architecture:** Añadir una capa de primitivas visuales puras en `components/PortalCliente/editorial/`, gobernada por tokens y clases del portal. Las pantallas existentes seguirán siendo dueñas del estado, peticiones y mutaciones; únicamente delegarán la presentación en esas primitivas. La migración será vertical y desplegable por pantalla: sistema base, Hoy, shell, Dieta, Entreno, Recetas, Ajustes y adaptación clara.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, CSS variables, Framer Motion, Paper Design Shaders, Phosphor/Lucide icons.

**Spec:** `docs/superpowers/specs/2026-10-08-industrial-editorial-redesign-design.md`

## Global Constraints

- No cambiar rutas, APIs, modelos de Supabase, autorización ni forma de cargar datos.
- No instalar paquetes: reutilizar `framer-motion` y `@paper-design/shaders-react`.
- No convertir las primitivas visuales en componentes con fetch, SWR o lógica de negocio.
- No tocar `/cliente/[codigo]` salvo comprobar que su redirección autenticada sigue intacta.
- Mantener cinco destinos principales: Hoy, Dieta, Entreno, Recetas y Ajustes.
- Conservar la cabecera retráctil, el estado visitado de pestañas y la navegación mediante `?tab=`.
- No usar azul como acento decorativo o selección. Verde, ámbar y rojo quedan reservados a estados semánticos reales.
- Mantener áreas táctiles de al menos 44 px, foco visible, `prefers-reduced-motion` y fallback sin WebGL.
- No aplicar un rediseño colateral al panel coach en esta fase.

## Review Focus

- El cambio debe sentirse compositivo, no como un simple cambio de colores.
- Evitar que cada dato vuelva a encerrarse en una tarjeta redondeada.
- Oscuro como identidad principal; claro como traducción fiel, no como tema independiente.
- Verificar que todas las acciones actuales siguen presentes, especialmente registro de comidas, swaps, PDF, sesiones, filtros, contraseña e integraciones.
- Revisar móvil real a 390 × 844 y 430 × 932, sin scroll horizontal ni contenido oculto por el dock.

---

## Task 1: Crear contrato estructural y primitivas editoriales

**Files:**
- Create: `scripts/industrial-editorial-portal.test.ts`
- Create: `components/PortalCliente/editorial/EditorialMasthead.tsx`
- Create: `components/PortalCliente/editorial/TechnicalReadout.tsx`
- Create: `components/PortalCliente/editorial/MetricRail.tsx`
- Create: `components/PortalCliente/editorial/TechnicalRow.tsx`
- Create: `components/PortalCliente/editorial/IndustrialTabs.tsx`
- Create: `components/PortalCliente/editorial/ProgressInstrument.tsx`
- Create: `components/PortalCliente/editorial/TimelineSequence.tsx`
- Create: `components/PortalCliente/editorial/LiquidDock.tsx`
- Create: `components/PortalCliente/editorial/index.ts`
- Modify: `app/cliente/cliente.css`

- [ ] **Step 1: Escribir el test estructural que inicialmente falla**

Crear un script Node/TS que lea los archivos del portal y compruebe:

```ts
assertFile('components/PortalCliente/editorial/EditorialMasthead.tsx')
assertFile('components/PortalCliente/editorial/TechnicalReadout.tsx')
assertFile('components/PortalCliente/editorial/MetricRail.tsx')
assertFile('components/PortalCliente/editorial/TimelineSequence.tsx')
assertFile('components/PortalCliente/editorial/TechnicalRow.tsx')
assertFile('components/PortalCliente/editorial/IndustrialTabs.tsx')
assertFile('components/PortalCliente/editorial/LiquidDock.tsx')
assertIncludes('app/cliente/cliente.css', '--editorial-radius')
assertIncludes('app/cliente/cliente.css', '.editorial-masthead')
assertIncludes('app/cliente/cliente.css', '.technical-row')
assertNotIncludes('components/PortalCliente/editorial/IndustrialTabs.tsx', "var(--semantic-info")
```

Ejecutar: `npx tsx scripts/industrial-editorial-portal.test.ts`

Expected: FAIL porque las primitivas aún no existen.

- [ ] **Step 2: Definir tokens locales y geometría base**

En `.cliente-portal-shell` añadir tokens como:

```css
--editorial-radius: 6px;
--editorial-radius-sm: 3px;
--editorial-rule: color-mix(in srgb, var(--metal-mid) 44%, var(--border));
--editorial-ink: color-mix(in srgb, var(--text) 94%, var(--metal-bright));
--editorial-panel: color-mix(in srgb, var(--surface) 88%, var(--atelier-carbon));
--editorial-field: color-mix(in srgb, var(--bg) 70%, var(--surface-elevated));
```

Añadir clases pequeñas y explícitas para masthead, rail, fila técnica, tabs, timeline, instrumento y dock. Usar bordes/divisores; no recrear una clase de “card” genérica.

- [ ] **Step 3: Implementar primitivas puras y tipadas**

Contratos mínimos:

```ts
type EditorialMastheadProps = {
  index: string
  eyebrow: string
  title: ReactNode
  meta?: ReactNode
  aside?: ReactNode
}

type TechnicalReadoutProps = {
  label: string
  value: ReactNode
  unit?: string
  detail?: ReactNode
}

type IndustrialTab<T extends string> = {
  key: T
  label: string
  icon?: ComponentType<{ size?: number }>
}
```

`IndustrialTabs` debe exponer semántica `role="tablist"`, `role="tab"`, `aria-selected` y controles de 44 px. `LiquidDock` debe recibir `items`, `activeKey` y `onChange`, usar `layoutId` de Motion y `aria-current="page"`. `TimelineSequence` y `TechnicalRow` deben renderizar contenido pasado por props, sin interpretar datos de dominio.

- [ ] **Step 4: Ejecutar contrato, lint y TypeScript**

Run:

```bash
npx tsx scripts/industrial-editorial-portal.test.ts
npx eslint components/PortalCliente/editorial app/cliente/cliente.css scripts/industrial-editorial-portal.test.ts
npx tsc --noEmit
```

Expected: contrato PASS, ESLint sin errores y TypeScript limpio. Si ESLint no procesa CSS, ejecutar solo TS/TSX y registrar esa exclusión en el commit.

- [ ] **Step 5: Commit**

```bash
git add scripts/industrial-editorial-portal.test.ts components/PortalCliente/editorial app/cliente/cliente.css
git commit -m "feat(cliente): crear sistema Industrial Editorial"
```

## Task 2: Rediseñar Hoy como portada, instrumentación y secuencia

**Files:**
- Modify: `app/cliente/page.tsx`
- Modify: `app/cliente/cliente.css`
- Modify: `scripts/industrial-editorial-portal.test.ts`

- [ ] **Step 1: Ampliar el test con el contrato de Hoy**

Comprobar que `page.tsx` usa `EditorialMasthead`, `MetricRail`, `TimelineSequence` y `ProgressInstrument`, y que ya no contiene las clases `cliente-plan-hero`, `cliente-bento` ni `cliente-quick-grid`.

Run: `npx tsx scripts/industrial-editorial-portal.test.ts`

Expected: FAIL antes de migrar la pantalla.

- [ ] **Step 2: Construir la portada editorial con los datos existentes**

Sustituir el hero actual por `EditorialMasthead`:

- índice `01 / TODAY`;
- eyebrow con el plan/fecha;
- título breve con `primerNombre`;
- lectura principal de kcal en el aside;
- sin cambiar `calcMacrosDia()`, `comidasDia`, `sesionesSemana` ni pesos.

- [ ] **Step 3: Convertir estadísticas y macros en instrumentación continua**

Usar `MetricRail` para comidas, entrenos y peso. Reemplazar `MacroPill` por `ProgressInstrument` dentro de una sola zona secundaria compacta. Mantener objetivos, unidades y colores de macro solo como codificación de datos, no como selección de interfaz.

- [ ] **Step 4: Convertir el centro de Hoy en una secuencia operativa**

Usar `TimelineSequence` con los datos ya disponibles para presentar, en orden:

1. alimentación del día;
2. entrenamiento o descanso;
3. recuperación/progreso;
4. check-in semanal.

Cada elemento debe navegar con los mismos `setTab(...)` actuales. Reubicar Check-in, Progreso, Compra y Chat como acciones técnicas secundarias bajo la secuencia, conservando todas las funciones. `TLSGauge` y `NotasCoach` permanecen tras el resumen operativo.

- [ ] **Step 5: Eliminar helpers visuales que hayan quedado huérfanos**

Eliminar de `page.tsx` únicamente `MacroPill`, `StatBadge` o imports que dejen de usarse. No limpiar lógica o componentes ajenos al rediseño.

- [ ] **Step 6: Verificar**

```bash
npx tsx scripts/industrial-editorial-portal.test.ts
npx eslint app/cliente/page.tsx components/PortalCliente/editorial
npx tsc --noEmit
```

Comprobación manual: Hoy debe leerse como una portada seguida de una secuencia, no como un dashboard de tarjetas.

- [ ] **Step 7: Commit**

```bash
git add app/cliente/page.tsx app/cliente/cliente.css scripts/industrial-editorial-portal.test.ts
git commit -m "feat(cliente): convertir Hoy en portada operativa"
```

## Task 3: Migrar shell, cabecera y navegación inferior

**Files:**
- Modify: `app/cliente/page.tsx`
- Modify: `app/cliente/cliente.css`
- Modify: `components/PortalCliente/IndustrialAtmosphere.tsx`
- Modify: `scripts/industrial-editorial-portal.test.ts`

- [ ] **Step 1: Añadir aserciones de accesibilidad y shell**

Comprobar que `page.tsx` renderiza `LiquidDock`, que `LiquidDock.tsx` contiene `aria-current`, y que la cabecera conserva `cliente-header-hidden` y su listener de scroll.

- [ ] **Step 2: Sustituir el JSX inline del bottom nav por `LiquidDock`**

Pasar `TABS`, `tab`, `setTab` y `reduceMotion`. Mantener exactamente los cinco destinos y el `layoutId` animado. No cambiar la sincronización con URL ni el conjunto `visitadas`.

- [ ] **Step 3: Afinar cabecera retráctil como vidrio industrial**

Mantener nombre, fecha, tema y logout. Reducir altura visual y ornamento; usar borde metálico, blur solo en esta superficie y transición existente de 160–220 ms. Confirmar que al bajar desaparece y al subir reaparece.

- [ ] **Step 4: Rebajar la atmósfera WebGL**

Conservar carga dinámica y fallback CSS. Ajustar `IndustrialAtmosphere` para una textura metálica de bajo contraste, sin color azul visible. En `prefers-reduced-motion`, mantener la regla que oculta el shader y usar el gradiente estático de `.cliente-portal-shell::before`.

- [ ] **Step 5: Verificar shell y navegación**

```bash
npx tsx scripts/industrial-editorial-portal.test.ts
npx eslint app/cliente/page.tsx components/PortalCliente/IndustrialAtmosphere.tsx components/PortalCliente/editorial/LiquidDock.tsx
npx tsc --noEmit
```

Manual: tocar cada destino, usar atrás/adelante del navegador, hacer scroll descendente/ascendente y comprobar que el dock no tapa el último control.

- [ ] **Step 6: Commit**

```bash
git add app/cliente/page.tsx app/cliente/cliente.css components/PortalCliente/IndustrialAtmosphere.tsx components/PortalCliente/editorial/LiquidDock.tsx scripts/industrial-editorial-portal.test.ts
git commit -m "feat(cliente): consolidar shell liquid industrial"
```

## Task 4: Convertir Dieta en documento semanal operativo

**Files:**
- Modify: `components/PortalCliente/MiPlan.tsx`
- Modify: `components/PortalCliente/PlanSemanal.tsx`
- Modify: `app/cliente/cliente.css`
- Modify: `scripts/industrial-editorial-portal.test.ts`

- [ ] **Step 1: Añadir el contrato estructural de Dieta**

Comprobar que `MiPlan.tsx` usa `IndustrialTabs`, `TechnicalRow` y `ProgressInstrument`, y que los selectores activos no dependen de `var(--primary)` como relleno completo.

- [ ] **Step 2: Sustituir tabs y selector de día**

Migrar `hoy/semana/compra` a `IndustrialTabs`. Convertir el selector de días en una tira documental con día abreviado, número o estado, divisor de 1 px y selección por inversión plata/grafito. Conservar `vistaActual`, `diaActivo` y todas sus callbacks.

- [ ] **Step 3: Sustituir los cuatro MacroRing por instrumentación lineal**

Usar un único rail de `ProgressInstrument`/`TechnicalReadout` para energía, proteína, carbohidratos y grasas. Conservar el cálculo de porcentaje, delta y objetivos; eliminar solo el componente local `MacroRing` cuando ya no tenga usos.

- [ ] **Step 4: Presentar comidas como capítulos numerados**

Cada comida debe ser un `TechnicalRow` o sección continua con:

- número `01`, `02`, etc.;
- nombre/tipo de comida;
- kcal y macros monoespaciados;
- receta/ingredientes progresivos;
- acciones actuales de registrar, saltar, anotar cambio, elegir alternativa y abrir receta.

No modificar `handleRegistrar`, `handleDeshacerRegistro`, `cargarAlternativas`, `handleSeleccionarAlternativa`, `recetaHref` ni su estructura de datos.

- [ ] **Step 5: Alinear vista semanal y compra**

Aplicar el mismo lenguaje de capítulos/divisores a `PlanSemanal.tsx` y al contenedor de lista de compra, sin cambiar filtros ni generación PDF.

- [ ] **Step 6: Verificar regresiones de Dieta**

```bash
npx tsx scripts/industrial-editorial-portal.test.ts
npx tsx scripts/test-comidas-dia.ts
npx eslint components/PortalCliente/MiPlan.tsx components/PortalCliente/PlanSemanal.tsx
npx tsc --noEmit
```

Manual: registrar/deshacer una comida, expandir ingredientes, cambiar receta, abrir detalle, cambiar día, semana, compra y PDF.

- [ ] **Step 7: Commit**

```bash
git add components/PortalCliente/MiPlan.tsx components/PortalCliente/PlanSemanal.tsx app/cliente/cliente.css scripts/industrial-editorial-portal.test.ts
git commit -m "feat(cliente): convertir Dieta en documento operativo"
```

## Task 5: Convertir Entreno en hoja técnica de sesión

**Files:**
- Modify: `components/training/EntrenoSubTabs.tsx`
- Modify: `components/training/ExpandableExercises.tsx`
- Modify: `components/training/EntrenoKanban.tsx`
- Modify: `app/cliente/sesion/[id]/page.tsx`
- Modify: `app/cliente/cliente.css`
- Modify: `scripts/industrial-editorial-portal.test.ts`

- [ ] **Step 1: Añadir el contrato de Entreno**

Comprobar que `EntrenoSubTabs.tsx` usa `EditorialMasthead`, `IndustrialTabs` y `TechnicalRow`, y que no contiene el fallback violeta `rgba(99,102,241,0.12)`.

- [ ] **Step 2: Crear cabecera técnica de plan/sesión**

Mostrar nombre, bloque, semana, duración y tipo con `EditorialMasthead` y `TechnicalReadout`. Mantener SWR, `cargarDetalle`, detección `sesionHoy` y los estados hoy/semana/mes.

- [ ] **Step 3: Convertir ejercicios y semana en filas numeradas**

En `ExpandableExercises.tsx` y `EntrenoKanban.tsx`, reemplazar tarjetas repetitivas por filas técnicas con orden, nombre, series, repeticiones, carga y descanso en mono. Mantener expansión, estados completada/hoy y enlaces a sesión.

- [ ] **Step 4: Traducir la pantalla de ejecución sin reducir controles**

En `/cliente/sesion/[id]`, aplicar masthead, reglas y readouts al resumen; conservar botones, inputs, registro por set, RPE, finalización y navegación. Los controles táctiles de ejecución siguen midiendo al menos 44 px.

- [ ] **Step 5: Verificar entrenamiento**

```bash
npx tsx scripts/industrial-editorial-portal.test.ts
npx tsx scripts/test-training-workspace.ts
npx tsx scripts/training-os.test.ts
npx eslint components/training/EntrenoSubTabs.tsx components/training/ExpandableExercises.tsx components/training/EntrenoKanban.tsx 'app/cliente/sesion/[id]/page.tsx'
npx tsc --noEmit
```

Manual: Hoy con sesión, Hoy en descanso, Semana, Mes, expansión de ejercicios y registro de una sesión completa.

- [ ] **Step 6: Commit**

```bash
git add components/training/EntrenoSubTabs.tsx components/training/ExpandableExercises.tsx components/training/EntrenoKanban.tsx 'app/cliente/sesion/[id]/page.tsx' app/cliente/cliente.css scripts/industrial-editorial-portal.test.ts
git commit -m "feat(cliente): convertir Entreno en hoja técnica"
```

## Task 6: Convertir Recetas en archivo gastronómico editorial

**Files:**
- Modify: `app/cliente/page.tsx`
- Modify: `components/PortalCliente/RecetarioExplorador.tsx`
- Modify: `components/PortalCliente/MisPlatos.tsx`
- Modify: `app/cliente/receta/[id]/page.tsx`
- Modify: `app/cliente/cliente.css`
- Modify: `scripts/industrial-editorial-portal.test.ts`

- [ ] **Step 1: Añadir el contrato de Recetas**

Comprobar que el selector `En tu plan / Recetario completo` usa `IndustrialTabs`, y que `RecetarioExplorador.tsx` usa una clase `recipe-editorial-list` en vez de una cuadrícula uniforme como contenedor principal.

- [ ] **Step 2: Migrar filtros a controles técnicos compactos**

Mantener búsqueda, debounce, categorías, tags, paginación y fetch. Cambiar únicamente la composición: input con profundidad propia, filtros en rail horizontal, selección plata/grafito y contador/estado textual secundario.

- [ ] **Step 3: Crear ritmo editorial de recetas**

Renderizar una pieza destacada cada bloque y el resto como filas editoriales alternadas. Cada elemento debe conservar imagen, nombre, kcal, proteína y `recetaHref`. La ausencia de imagen mantiene fallback legible.

- [ ] **Step 4: Alinear En tu plan, Mis platos y detalle**

Usar el mismo sistema de índice, reglas, tipografía y métricas en las tres superficies. No cambiar rutas, parámetros `codigo`, `returnTo`, `comida`, acciones de favorito/creación ni lógica del detalle.

- [ ] **Step 5: Verificar recetario**

```bash
npx tsx scripts/industrial-editorial-portal.test.ts
npx tsx scripts/receta-competicion.test.ts
npx eslint app/cliente/page.tsx components/PortalCliente/RecetarioExplorador.tsx components/PortalCliente/MisPlatos.tsx 'app/cliente/receta/[id]/page.tsx'
npx tsc --noEmit
```

Manual: búsqueda, categoría, tag, limpiar filtro, cargar más, abrir receta y volver manteniendo la pestaña.

- [ ] **Step 6: Commit**

```bash
git add app/cliente/page.tsx components/PortalCliente/RecetarioExplorador.tsx components/PortalCliente/MisPlatos.tsx 'app/cliente/receta/[id]/page.tsx' app/cliente/cliente.css scripts/industrial-editorial-portal.test.ts
git commit -m "feat(cliente): convertir Recetas en archivo editorial"
```

## Task 7: Convertir Ajustes en panel continuo de sistema

**Files:**
- Modify: `components/PortalCliente/AjustesTabs.tsx`
- Modify: `components/PortalCliente/IntegracionesPanel.tsx`
- Modify: `app/cliente/cliente.css`
- Modify: `scripts/industrial-editorial-portal.test.ts`

- [ ] **Step 1: Añadir el contrato de Ajustes**

Comprobar que `AjustesTabs.tsx` usa `IndustrialTabs` y `TechnicalRow`, y que los campos usan `editorial-field` para separarse tonalmente del panel.

- [ ] **Step 2: Migrar navegación interna y datos de perfil**

Usar `IndustrialTabs` para Apps/Perfil/Cuenta. Presentar `InfoRow` como filas continuas numeradas o etiquetadas, con un solo contenedor de sección y divisores. Mantener `subTab`, etiquetas de objetivo/nivel y contenido actual.

- [ ] **Step 3: Diferenciar campos y acciones**

Aplicar `editorial-field` a textarea y contraseña: fondo más oscuro/claro que la superficie, borde metálico y foco visible. Mantener guardar restricciones, ver contraseña, actualizar, cambio de tema y sus estados de carga.

- [ ] **Step 4: Alinear integraciones y seguridad**

Convertir integraciones en filas de sistema continuas. Mantener estados conectada/desconectada y callbacks. Conservar rojo semántico únicamente en cerrar sesión; no suavizar confirmaciones existentes.

- [ ] **Step 5: Verificar Ajustes**

```bash
npx tsx scripts/industrial-editorial-portal.test.ts
npx eslint components/PortalCliente/AjustesTabs.tsx components/PortalCliente/IntegracionesPanel.tsx
npx tsc --noEmit
```

Manual: Ajustes aparece seleccionado en dock; tabs internas, tema, restricciones, contraseña, integraciones y logout siguen funcionando.

- [ ] **Step 6: Commit**

```bash
git add components/PortalCliente/AjustesTabs.tsx components/PortalCliente/IntegracionesPanel.tsx app/cliente/cliente.css scripts/industrial-editorial-portal.test.ts
git commit -m "feat(cliente): convertir Ajustes en panel de sistema"
```

## Task 8: Completar modo claro, responsive y reducción de movimiento

**Files:**
- Modify: `app/cliente/cliente.css`
- Modify: `components/PortalCliente/editorial/*.tsx`
- Modify: `scripts/industrial-editorial-portal.test.ts`

- [ ] **Step 1: Añadir aserciones de resiliencia visual**

El test debe comprobar presencia de `prefers-reduced-motion`, `:focus-visible`, `aria-current`, `aria-selected` y reglas responsive para 390/430 px sin anchos fijos superiores al viewport.

- [ ] **Step 2: Ajustar claro como traducción industrial**

Usar los mismos tokens semánticos con fondo mineral, superficies aluminio claro, reglas titanio y texto grafito. No introducir azul decorativo. Revisar especialmente campos, dock, tabs activos, fotografías y overlays.

- [ ] **Step 3: Afinar móvil y safe areas**

Comprobar:

- 390 × 844 y 430 × 932;
- orientación vertical y horizontal estrecha;
- `env(safe-area-inset-top/bottom)`;
- títulos sin cortes;
- filas y rails que envuelven o permiten scroll interno intencional;
- padding inferior suficiente para `LiquidDock`.

- [ ] **Step 4: Verificar reducción de movimiento y fallo de shader**

Con `prefers-reduced-motion: reduce`, desactivar desplazamientos no esenciales y ocultar shader. Deshabilitar WebGL desde DevTools o forzar error del componente y confirmar que el portal continúa legible con el fondo CSS.

- [ ] **Step 5: Verificación técnica completa**

```bash
npx tsx scripts/industrial-editorial-portal.test.ts
npm run lint
npx tsc --noEmit
npm run build
```

Expected: todos los comandos completan sin errores nuevos. Documentar warnings preexistentes sin corregirlos fuera de alcance.

- [ ] **Step 6: Commit**

```bash
git add app/cliente/cliente.css components/PortalCliente/editorial scripts/industrial-editorial-portal.test.ts
git commit -m "fix(cliente): pulir temas y accesibilidad editorial"
```

## Task 9: QA visual autenticada y despliegue controlado

**Files:**
- Create: `docs/superpowers/reports/2026-10-08-industrial-editorial-qa.md`
- Modify if defects are found: only files changed in Tasks 1–8

- [ ] **Step 1: Registrar baseline técnica y tamaño de build**

Guardar en el informe commit base, commit candidato, resultado de lint/TypeScript/build y tamaños que Next muestre para `/cliente`, `/cliente/receta/[id]` y `/cliente/sesion/[id]`. El shader no debe trasladarse a contenido crítico ni bloquear render.

- [ ] **Step 2: Capturar matriz visual**

Con sesión de cliente real o de prueba, capturar:

| Viewport | Tema | Pantallas |
|---|---|---|
| 390 × 844 | oscuro | Hoy, Dieta, Entreno, Recetas, Ajustes |
| 390 × 844 | claro | Hoy, Dieta, Entreno, Recetas, Ajustes |
| 430 × 932 | oscuro | Hoy, Dieta, Entreno, Recetas, Ajustes |

Guardar las rutas de las capturas en el informe; no versionar credenciales ni cookies.

- [ ] **Step 3: Ejecutar checklist funcional**

Verificar y registrar PASS/FAIL:

- navegación de cinco destinos y URL;
- cabecera al bajar/subir;
- comida registrar/deshacer/swap/receta/PDF;
- Entreno hoy/semana/mes y ejecución;
- búsqueda/filtros/paginación de recetas;
- restricciones/tema/contraseña/integraciones;
- navegación atrás/adelante;
- reduced motion y fallback sin shader;
- ausencia de scroll horizontal y de selección azul decorativa.

- [ ] **Step 4: Corregir solo defectos observados y repetir checks afectados**

Cada corrección debe corresponder a un FAIL del informe. No aprovechar QA para añadir funciones o refactors.

- [ ] **Step 5: Revisión final contra criterios del spec**

Confirmar explícitamente los ocho criterios de aceptación del spec, con atención especial a que las cinco secciones no repitan la misma composición.

- [ ] **Step 6: Commit del informe y push**

```bash
git add docs/superpowers/reports/2026-10-08-industrial-editorial-qa.md
git commit -m "docs: registrar QA del rediseño Industrial Editorial"
git pull --rebase origin main
git push origin main
```

Antes de `pull --rebase`, comprobar `git status --short` y no incluir `supabase/.temp/cli-latest` ni otros cambios ajenos.

- [ ] **Step 7: Verificar producción**

Esperar a que Vercel marque el deployment como Ready, abrir `https://nutricoach-delta.vercel.app/cliente` y repetir al menos: carga autenticada, Hoy, un cambio de pestaña, scroll de cabecera y tema. Si producción difiere del build local, no declarar terminado hasta identificar la causa.
