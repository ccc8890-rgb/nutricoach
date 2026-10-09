# Pasada autónoma del recetario — 09-10-2026

Mantiene el recetario revisado sin que Carlos tenga que descubrir fallos por casualidad. Se lanza sola **cada 6 h** con launchd (`com.carlos.nutricoach-auditoria`, plist en `~/Library/LaunchAgents`), ejecutando **con node** `scripts/auditoria-semanal.mjs`. Log: `~/Library/Logs/nutricoach-auditoria.log`. Si algo cambia o falla sale una notificación de macOS.

## Qué hace cada paso (todo idempotente: una segunda pasada no cambia nada)

| # | Script | Escribe en BD | Qué corrige |
|---|--------|---------------|-------------|
| 1 | `auditar-intolerancias-completo.mjs --aplica` | sí | Añade alérgenos que los ingredientes contienen (Huevos, Gluten…), quita «Sin X» falsos y Vegano/Vegetariano con producto animal. Conserva las etiquetas antiguas «Sin X» válidas (las leen el planificador y los filtros). |
| 2 | `auditar-matches-ingredientes.mjs` + `aplicar-correcciones-matches.mjs --aplica` | sí | Reenlaza ingrediente→alimento con las reglas aprobadas (`MAPA` + chocolate genérico «Chocolate negro 75-80%») y recalcula macros. Lo dudoso NO se autocorrige. |
| 3 | `completar-campos-recetas.mts --aplica` | sí | dificultad, cocción, tipo_plato, categoría, tags, descripción de ración, momentos de comida, objetivos, momentos pre/post entreno (con criterio de macros) y desmarca es_pre/es_post sin respaldo. Escribe `salidas/DD-MM-YYYY_avisos-recetario.md`. |
| 4 | `recalcular-recipe-intelligence.ts --apply`, `batch-audit-profesional.ts --apply` | sí | Puntuaciones derivadas. |
| 5 | `verificar-recetas-auto.ts --apply` | sí | Marca `verificacion='auto'` (el planificador solo ve verificadas). Nunca toca las verificadas por el coach. |
| 6 | `auditar-pasos-ingredientes.mjs` | no | Solo avisa: pasos que no nombran un ingrediente, cantidades inventadas, productos elaborados colados como ingrediente. |

Reglas deterministas en `lib/recetas/campos-auto.ts`, calibradas contra recetas ya etiquetadas (cocción 74 %, dificultad 83 %, objetivos F1≈0,66). Tests: `npx tsx scripts/campos-auto.test.ts`, `scripts/equivalencia.test.ts`, `scripts/recetario-taxonomia.test.ts`.

## Herramientas SUPERVISADAS (nunca autónomas)
Generan con IA (DeepSeek `deepseek-chat`, que a veces devuelve JSON mal formado) → validan → propuesta en `salidas/` → **Claude lee** → `--aplica --solo-validas`:
- `ampliar-textos-recetas.mjs` (instrucciones; modo `--auditoria` para pasos que no citan ingredientes, con regla de conservación ≥60 % del texto original).
- `rellenar-campos-ia.mjs --campo=consejos|tiempo|limpiar` (consejos, tiempo de preparación, textos con vocabulario deportivo).
Lección: la IA copia fielmente los errores de datos y, al quitar lo deportivo, rellena con afirmaciones de salud o sustituciones; el validador + lectura humana lo frenan.

## Deshacer
Cada cambio guarda copia antes/después en `salidas/copia-*.json` (`copia-campos`, `copia-matches`, `copia-intolerancias`, `copia-textos`, `copia-consejos`, `copia-tiempo`, `copia-limpiar`, `copia-datos-sospechosos`, `copia-ingredientes-elaborados`, `copia-raciones-duplicado`). `salidas/` está en .gitignore (local). **Fallo conocido corregido:** la primera versión del script de intolerancias sobrescribía su copia en cada ejecución.

## Visualización al coach / cliente
- Equivalencias caseras: `120g (2 huevos)` (`lib/recetas/equivalencia.ts`; guardada en `cantidad_original`/`unidad_display` o deducida del nombre; huevos/yogures en enteros, cucharadas con medias).
- Editor: selector «Tipo de plato» y campos de equivalencia por ingrediente. Momento «Postre» añadido a la taxonomía.

## Límites y pendientes
- No se deducen `rendimiento`/`ganancia_muscular` ni `apto_*` clínicos (la lógica clínica real va en `lib/nutricion/reglas-clinicas.ts`).
- Fotos: 392 recetas activas sin foto (OpenAI sin saldo).
- Recetas nuevas del importador pueden traer vocabulario deportivo en descripciones/consejos: salen en el informe de avisos y se limpian con `rellenar-campos-ia.mjs --campo=limpiar` (supervisado).
- ~13 recetas conservan pasos originales que no nombran algún ingrediente (la IA los reescribía de más). Par «Mochi» duplicado, Donuts proteicos (cacao 100 g dudoso, texto original restaurado). Detalle: `salidas/09-10-2026_datos-sospechosos.md`.

## Lecciones técnicas
1. **launchd + macOS (TCC):** `/bin/bash` sobre scripts de ~/Desktop da «Operation not permitted», y logs en Desktop dan `spawn failed 78`. Usar node y logs en `~/Library/Logs`. Así estaba roto el backup nocturno a GitHub desde junio (arreglado: `_scripts/claude-backup-launcher.mjs`).
2. Backtest de reglas contra datos ya etiquetados antes de automatizar.
3. `nombre_libre` == nombre del alimento oculta los mal enlaces a la auditoría por palabras; hace falta señal «producto elaborado que la receta no menciona».
4. Dos sesiones sobre el mismo repo se pisan (build roto transitorio por cambios ajenos): subir siempre con `git add <rutas concretas>`.
