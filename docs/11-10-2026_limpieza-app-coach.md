# Limpieza y optimización de la app coach (11-10-2026)

Objetivo: quitar código y rutas sin uso, y aligerar las pantallas más pesadas, sin cambiar el comportamiento.

## Commits
- `873c556` — 52 archivos sin uso.
- `5625581` — imports sin usar, rutas API y libs huérfanas.
- Commit de optimización — `dietas/[id]`, `clientes/[id]`, `revisar-plan`.
- Commit de cierre — restauración de `lib/recetas/auto-match-ingrediente.ts` + este documento.

Total: ~9.200 líneas menos.

## Qué se borró
- **Páginas:** `/precios/scraping`, `/precios/browser-agent`, `/precios/enriquecer`, `/ia-test`.
- **Componentes (21):** del dashboard antiguo (`AutoCoachPanel`, `BarChart`, `LineChart`, `MiniDonut`, `MiniSparkline`, `KBPanel`, `CostesClientes`, `CheckinsPendientes`), `InformeSemanal`, `PanelScraping`, `PanelEnriquecimiento`, `StepSocial`, `AlternativasModal`, `GenerarComidaModal`, `RecetaIngredienteItem`, `EmptyState`.
- **Libs:** `replicate`, `resend`, `media-utils`, `browser-agent`, `enriquecimiento-nutricional`, `auto-coach`, `actualizar-perfil` (×2), `personalizacion/generador-comidas`, `agentes/memoria`, `entrenos/descanso`, motores de scraping `motor-http` y `motor-playwright`.
- **Rutas API (~30):** `ia-test`, `auto-coach/analizar`, `checkins/pendientes`, `intercambios` y `cliente/[codigo]/intercambios` (+`elegir`), `clientes/[id]/informe-semanal`, `clientes/[id]/tls`, `personalizacion/*`, `dashboard/analytics`, `entrenos/{estado-sesiones,resumen-coach,completar-sesion-rapida}`, `importar-bedca`, `ingesta-papers` (queda la versión cron), `periodizacion/evaluar`, `precios/{plan,historico,escandallo/detalle,browser-agent,enriquecer,scrapear}`, `recetas/[id]/healthify`, `respuestas/[id]/leer`, `alimentos/{deduplicar,enriquecer-micronutrientes,poblar-micronutrientes}`.
- **Basura de raíz:** dos archivos con nombre de frase (`Let me craft…lib/`, `Let me write…app/`) y `tmp/` (3,3 MB de HTML de diagnóstico).
- **Imports sin usar** en 25 archivos (con el compilador de TypeScript).

## Optimización
- `dietas/[id]`: 2.109 → 1.741 líneas. Tipos y componentes puros en `components/diet/dieta-editor-utils.tsx`. `CollapsibleModule` tiene prop `lazy`: monta el contenido la primera vez que se abre. La «Lista de la compra» usa `dynamic()` + `lazy`.
- `clientes/[id]` y `revisar-plan`: `PlantillaEntrenoSelector`, `ChatPanel` y `ClienteEditar` con `dynamic({ ssr:false })`.

## Auditoría de cierre
- `tsc` limpio, `npm run build` OK, `npm run verificar:motor` 42/42.
- ESLint: 0 errores (187 avisos, casi todos `no-explicit-any` y variables sin usar que no son imports).
- Los 10 crons de `vercel.json` apuntan a rutas que existen.
- Sin referencias en `app/components/lib` a rutas borradas. Sin secretos en los diffs.
- **Fallo encontrado y corregido:** el rastreo de huérfanos no veía los `import('../lib/…ts')` dinámicos de `scripts/`. Se había borrado `lib/recetas/auto-match-ingrediente.ts`, que usa `scripts/rematch-ingredientes-auto.ts`. Restaurado.
- **Lección:** antes de borrar un archivo de `lib/`, buscar también su nombre con extensión `.ts` en `scripts/` y en `Content-Radar/scripts`.

## Pendiente / decisiones de Carlos
- Probar en Vercel: lista de la compra en `dietas/[id]`; chat, «Editar» y selector de plantillas en `clientes/[id]`; selector en `revisar-plan`. No se probó en navegador.
- `/agentes` sigue sin enlace en el menú (historial de agentes IA).
- `/cliente/semana` y `/cliente/mes` (portal cliente) sin enlace.
- Tarjeta de comida de `dietas/[id]` (~540 líneas) sin separar: exige pasar ~30 props; hacerlo solo con prueba manual en cada paso.
- `motor-http` y `motor-playwright` se borraron (historial git los conserva).
- `puppeteer`, `apify-client`, `pg` solo los usan scripts: candidatos a `devDependencies`.
- `components/clientes/SemanaDietaPlanner.tsx` tiene cambios de otra sesión sin commitear; no se tocó.

## Añadido (mediodía): planes de dieta antiguos y «Planes activos»
- `/dietas` listaba los 24 `planes_nutricion` del coach, incluidos 17 inactivos (versiones antiguas al regenerar planes de clientes de prueba) y 2 sin cliente (abril). Solo 5 eran reales (1 activo por cliente).
- **Borrados 19 planes** (con sus 94 comidas y 741 alimentos, en cascada; sin dependientes en `comidas_planificadas`, `registro_comidas_dia` ni `piezas_contenido`). **Copia completa** en `salidas/11-10-2026_backup-planes-nutricion-borrados.json` (`salidas/` está en .gitignore, solo local).
- **«Planes activos» quitada del menú** (`components/Sidebar.tsx`) y de las tarjetas de `/nutricion`: cada cliente ya tiene su plan en la ficha → Nutrición. La ruta `/dietas` y `/dietas/[id]` siguen existiendo (los enlaces desde la ficha usan `/dietas/[id]`).
- Restaurar: reinsertar desde el JSON de copia (planes → comidas → comida_alimentos).
- **«Resumen» de Nutrición quitado del menú** (era una página de tarjetas que repetía el propio menú). El botón de la sección Nutrición lleva ahora a Plantillas y `/nutricion` redirige a `/dietas/plantillas`.
- **«Resumen» de Entrenamiento quitado del menú** (lista de clientes repetida con Clientes). La página `/entrenos` se mantiene porque la usan enlaces internos (volver, cancelar, acceso del dashboard). El botón de la sección lleva a Plantillas.

- **Bandeja global «Brain IA» (`/entrenos/brain-ia`, 840 líneas) eliminada.** Las decisiones de IA se revisan en la ficha de cada cliente (Entrenamiento → «Decisiones de IA pendientes»). Los avisos del dashboard enlazan ahora a esa ficha y la tarjeta «Listo para aprobar (IA)» a Clientes. El agente `training-brain` sigue corriendo en el director y creando las tareas. Cuando todo sea automático y solo haya que revisar a gran escala, habría que rehacer una bandeja única con la presentación nueva (`lib/rendimiento/presentacion.ts`).

- **Menú lateral reorganizado (11-10-2026):** arriba Inicio · Clientes · Contenido; secciones **Planes** (plantillas de dieta, plantillas de entreno, ejercicios), **Recetario** (recetas, alimentos, revisión), **Compra y costes** (lista compra, precios) y **Control** (cobertura de recetas, coste de recetas, rentabilidad por cliente). Se quitó «Crear plan» del menú: un plan se crea desde la ficha del cliente (`/entrenos/nueva?cliente=…` sigue existiendo).
