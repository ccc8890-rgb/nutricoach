# AgenteRecetarioPro v1 Design

## Objetivo

Crear un agente operativo para producir, validar y preparar nuevas recetas del recetario NutriCoach de forma controlada. El agente debe cubrir huecos reales de cobertura, generar recetas base adaptables, vincular ingredientes existentes, calcular macros desde datos de alimentos y dejar todo preparado para revision humana.

La v1 funciona en modo conservador:

- Nunca aprueba recetas automaticamente.
- Toda receta nueva entra como `en_revision`.
- No acepta ingredientes sin match fiable en la base de alimentos.
- No acepta macros escritas por IA; siempre recalcula desde ingredientes.
- No autoaprueba imagenes, aunque puede preparar prompt, fuente o candidato visual.
- Aprende mediante logs, reglas y motivos de rechazo, no mediante fine-tuning real.

Esta spec complementa `2026-06-06-recetas-base-adaptables-design.md`. Aquella define la capa de bases adaptables; esta define el agente que la explota para crear recetas nuevas con control profesional.

## Contexto Actual

El recetario ya tiene una base tecnica suficiente para activar un agente conservador:

- 425 recetas aprobadas.
- 0 recetas aprobadas con `score_calidad = null`.
- 0 recetas aprobadas con `quality_estado_sugerido = bloqueada`.
- 4102/4102 ingredientes de receta con `rol_ingrediente` poblado.
- Scaling por rol aplicado en `lib/recetas/aplicar-receta-comida.ts`.
- Momentos deportivos estrictos para `pre_entreno`, `post_entreno`, `carga_cho` y `tapering`.
- Quality gate centralizado en `lib/recetas/profesional.ts`.
- Prompts visuales existentes en `lib/recetas/imagen-prompts.ts`.

La cobertura deportiva sigue siendo mejorable:

- `pre_entreno`: 14 aprobadas.
- `post_entreno`: 22 aprobadas.
- `carga_cho`: 11 aprobadas.
- `tapering`: 5 aprobadas.
- `rendimiento`: 73 aprobadas.
- `running`: 70 aprobadas.
- `ciclismo`: 57 aprobadas.
- `triatlon`: 49 aprobadas.
- `endurance`: 55 aprobadas.

La conclusion es clara: antes de producir volumen masivo, el sistema necesita un agente que detecte huecos concretos y genere tandas pequenas, trazables y revisables.

## Arquitectura

Modulo propuesto:

```text
lib/recetas/agente-recetario/
  coverage.ts
  generator.ts
  validator.ts
  importer.ts
  image.ts
  learning.ts
  types.ts

scripts/agente-recetario-pro.ts
```

El flujo principal es:

```text
objetivo/deporte/momento/cantidad
  -> detectar hueco de cobertura
  -> seleccionar plantilla o base adaptable
  -> generar borrador estructurado
  -> resolver ingredientes contra alimentos existentes
  -> calcular macros reales
  -> auditar con auditarRecetaProfesional
  -> preparar prompt/fuente de imagen
  -> insertar en recetas como en_revision
  -> registrar log de aprendizaje
```

La IA solo puede intervenir en nombre, instrucciones, variantes culinarias y propuesta visual. La seleccion final de ingredientes, cantidades, macros y estado sale de reglas y validadores locales.

## Modulos

### Coverage Engine

Archivo: `lib/recetas/agente-recetario/coverage.ts`.

Responsabilidades:

- Leer cobertura actual por `objetivos`, `deportes`, `momentos`, `tipo_plato`, `estilos` y `digestibilidad`.
- Comparar cobertura contra umbrales minimos configurados.
- Priorizar huecos con impacto real: adherencia amateur, perdida de grasa, recomposicion, rendimiento amateur y peri-entreno.
- Excluir recetas `en_revision` como cobertura valida.
- Excluir recetas bloqueadas o con score bajo.

Salida esperada:

```ts
type RecetaCoverageGap = {
  objetivo: string
  deporte?: string
  momento?: string
  tipoPlato?: string
  actuales: number
  minimo: number
  prioridad: 'alta' | 'media' | 'baja'
  motivo: string
}
```

En v1 los minimos se configuran en codigo, no en UI. Esto evita anadir una pantalla antes de validar que el agente aporta valor.

### Generator

Archivo: `lib/recetas/agente-recetario/generator.ts`.

Responsabilidades:

- Generar una receta candidata a partir de un hueco de cobertura.
- Usar plantillas controladas en vez de generacion libre.
- Adaptar la receta a objetivo, deporte, momento y digestibilidad.
- Proponer cantidades iniciales razonables por rol.
- Evitar defaults peligrosos como 100 g indiscriminados en condimentos, especias o salsas.

Fuentes permitidas:

- Bases adaptables existentes, cuando existan.
- Plantillas deterministas internas para bowls, desayunos, snacks, post-entreno, carga de CHO y tapering.
- Proveedor IA opcional para texto culinario, solo si hay clave y coste aceptable.

Reglas duras:

- No inventar alimentos fuera de la BD.
- No generar recetas con menos de 3 ingredientes estructurales, salvo snacks muy simples.
- No usar cantidades de especias, sal, ajo, salsas o grasas como si fueran ingredientes principales.
- No generar recetas peri-entreno altas en grasa o fibra si el momento exige digestibilidad.
- No generar carga de CHO con alimentos incoherentes para ese objetivo.

### Ingredient Matcher

Puede vivir dentro de `generator.ts` o como helper interno si crece.

Responsabilidades:

- Resolver cada ingrediente propuesto contra `alimentos`.
- Preferir matches exactos y alias conocidos.
- Rechazar matches semanticamente sospechosos.
- Reutilizar mejoras existentes de `lib/recetas/auto-match-ingrediente.ts` y `lib/recetas/profesional.ts`.

Ejemplos de fallos que debe bloquear:

- Mango sticky rice con chips de patata.
- Arroz glutinoso vinculado a cereal chocolateado.
- Nata vinculada a aperitivo de patata.
- Cebolla roja vinculada a cebolla frita crujiente.
- Tortilla/wrap vinculada a huevo.

Si un ingrediente no se resuelve con confianza, la receta no se inserta. El agente registra el fallo para mejorar alias o plantillas.

### Validator

Archivo: `lib/recetas/agente-recetario/validator.ts`.

Responsabilidades:

- Validar estructura minima de la receta.
- Calcular macros reales desde ingredientes.
- Ejecutar `auditarRecetaProfesional`.
- Aplicar reglas especificas por momento deportivo.
- Decidir si la receta puede pasar a `en_revision` o debe descartarse antes de escribir BD.

Reglas v1:

- `score_calidad >= 75` para insertar.
- 0 bloqueantes.
- Todos los ingredientes con `alimento_id`.
- Todos los ingredientes con `rol_ingrediente`.
- Cantidades dentro de limites por rol.
- Instrucciones presentes y coherentes.
- Objetivos/deportes/momentos compatibles con macros y digestibilidad.

Importante: aunque el validador sugiera `aprobada`, el importer fuerza `estado = 'en_revision'`.

### Importer

Archivo: `lib/recetas/agente-recetario/importer.ts`.

Responsabilidades:

- Insertar receta y receta_ingredientes.
- Guardar taxonomia: `objetivos`, `deportes`, `momentos`, `estilos`, `planning_roles`, `digestibilidad`.
- Guardar trazabilidad de generacion.
- Evitar duplicados.

Reglas:

- No modifica recetas aprobadas.
- No promociona recetas.
- Inserta solo si el validador ha pasado.
- Si ya existe una receta equivalente en `en_revision` o `aprobada`, omite e informa.
- Inserta en una transaccion logica: receta, ingredientes, auditoria/log. Si falla una parte, no deja receta incompleta.

Campos de trazabilidad recomendados, usando columnas existentes cuando sea posible:

- `fuente = 'agente_recetario_pro'` si la columna existe.
- `quality_estado_sugerido`.
- `score_calidad`.
- `planning_roles`.
- `adaptacion_reglas_aplicadas` cuando exista la columna de bases adaptables.

Si falta una columna para trazabilidad, v1 usa logs en archivo JSONL antes de anadir migraciones innecesarias.

### Image Preparer

Archivo: `lib/recetas/agente-recetario/image.ts`.

Responsabilidades:

- Preparar prompt visual profesional con `lib/recetas/imagen-prompts.ts`.
- Adjuntar fuente candidata si viene de scraping.
- Marcar la imagen como pendiente de revision.
- No reemplazar imagenes buenas existentes.

Estrategia de imagenes:

1. Si la receta procede de URL externa, intentar extraer imagen candidata (`og:image`, thumbnail o media scrapeada).
2. Si no hay imagen fiable, generar prompt visual para IA.
3. Si hay proveedor de imagen configurado, dejar preparada la solicitud, no autoaprobar el resultado.
4. Si no hay proveedor o credito, dejar `imagen_pendiente` con prompt y motivo.

Reglas:

- No publicar imagen sin revision humana.
- No usar imagen si contradice ingredientes principales.
- No usar imagen oscura, borrosa o generica cuando el plato deba reconocerse.
- Las fotos scrapeadas buenas pueden pasar por el sistema IA de mejora con prompt controlado, pero el resultado sigue pendiente.

### Learning Logger

Archivo: `lib/recetas/agente-recetario/learning.ts`.

Responsabilidades:

- Registrar generaciones, descartes, errores de matching, auditorias, aprobaciones humanas y rechazos.
- Convertir patrones repetidos en sugerencias de regla.
- Alimentar futuros seeds o alias de matching.

Aprendizaje v1:

- No hay fine-tuning real.
- No se entrena un modelo con datos de clientes.
- Se guardan logs estructurados y contadores.
- Las mejoras entran como reglas revisables: alias, bloqueos semanticos, rangos de gramaje, plantillas ganadoras.

Eventos recomendados:

```ts
type AgenteRecetarioEvento =
  | 'coverage_gap_detected'
  | 'recipe_generated'
  | 'recipe_rejected_by_validator'
  | 'recipe_inserted_for_review'
  | 'ingredient_match_failed'
  | 'image_prompt_prepared'
  | 'human_approved'
  | 'human_rejected'
  | 'human_edited'
```

## CLI

Script propuesto: `scripts/agente-recetario-pro.ts`.

Comandos v1:

```bash
npm exec -- tsx scripts/agente-recetario-pro.ts --dry-run --objetivo=rendimiento --momento=tapering --deporte=running --cantidad=5
npm exec -- tsx scripts/agente-recetario-pro.ts --apply --objetivo=rendimiento --momento=tapering --deporte=running --cantidad=5
npm exec -- tsx scripts/agente-recetario-pro.ts --coverage
```

Comportamiento:

- `--dry-run` por defecto. No escribe BD.
- `--apply` escribe solo recetas validadas y siempre en `en_revision`.
- `--cantidad` limita el numero de candidatas insertables.
- `--coverage` imprime huecos y prioridades.
- La salida debe incluir generadas, insertadas, descartadas, duplicadas, fallos de match y prompts de imagen preparados.

Ejemplo de salida:

```text
AgenteRecetarioPro
Objetivo: rendimiento
Deporte: running
Momento: tapering

Hueco detectado: tapering/running tiene 5 recetas, minimo 12.
Generadas: 5
Validas para revision: 4
Descartadas: 1
Insertadas: 0 (dry-run)
Imagenes preparadas: 4 prompts
```

## Datos y Persistencia

V1 debe evitar migraciones si puede funcionar con columnas existentes. Solo se anadira migracion cuando haga falta trazabilidad que no pueda guardarse de forma limpia.

Persistencia recomendada:

- Recetas nuevas en `recetas`.
- Ingredientes en `receta_ingredientes`.
- Auditoria via campos actuales de calidad.
- Logs iniciales en `salidas/agente-recetario-pro/*.jsonl` o tabla existente de auditoria si encaja.

Migracion futura opcional:

```sql
create table agente_recetario_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  modo text not null,
  objetivo text,
  deporte text,
  momento text,
  cantidad_solicitada integer not null,
  generadas integer not null default 0,
  insertadas integer not null default 0,
  descartadas integer not null default 0,
  errores jsonb not null default '[]'::jsonb,
  resumen jsonb not null default '{}'::jsonb
);
```

Esta tabla no es obligatoria para la primera implementacion. Si se anade, debe ir en migracion separada y con RLS coherente.

## Seguridad y Control Profesional

Reglas no negociables:

- Ninguna receta generada por agente pasa a `aprobada` sin accion humana.
- Ninguna imagen generada o scrapeada pasa a final sin revision.
- Ninguna receta usa ingredientes sin alimento vinculado.
- Ninguna receta guarda macros de IA.
- Ningun dato personal de cliente se guarda en logs del agente.
- En caso de duda, el agente descarta o deja pendiente, no fuerza la insercion.

Esto evita repetir el problema original: ingredientes absurdos metidos en recetas aparentemente buenas.

## Metricas de Exito

La v1 se considera util cuando:

- Puede detectar huecos reales sin falsos positivos evidentes.
- Genera tandas pequenas de 3-10 recetas con tasa de descarte explicable.
- El 80% de recetas insertadas en `en_revision` pasan revision humana con cambios menores.
- 0 recetas insertadas tienen ingredientes sin match.
- 0 recetas insertadas tienen condimentos o especias con gramajes absurdos.
- 0 recetas insertadas tienen imagen final autoaprobada.
- Aumenta cobertura en slots deficitarios sin degradar calidad del recetario.

Slots prioritarios iniciales:

- `tapering` running/endurance.
- `carga_cho` running/triatlon/ciclismo.
- `pre_entreno` digestivo.
- `post_entreno` recuperacion.
- `media_manana` y snacks de adherencia.
- Cenas ligeras altas en proteina para perdida de grasa.

## Fuera de Alcance v1

- UI para gestionar el agente.
- Aprobacion automatica.
- Fine-tuning.
- Generacion libre sin plantillas.
- Creacion automatica de nuevos alimentos.
- Scraping masivo sin revision.
- Regeneracion masiva de imagenes.
- Motor clinico avanzado para patologias complejas.

## Fases

### Fase 1: Agente dry-run

Crear tipos, coverage, generator determinista, validator y CLI en modo `--dry-run`. Debe poder imprimir recetas candidatas sin escribir BD.

### Fase 2: Insercion conservadora

Activar `--apply` para insertar recetas validadas en `en_revision`, con logs JSONL y prompts de imagen preparados.

### Fase 3: Aprendizaje por revision

Registrar aprobaciones, rechazos y ediciones humanas. Convertir errores repetidos en nuevas reglas de matching, rangos o plantillas.

### Fase 4: Integracion con bases adaptables

Cuando exista `receta_bases_adaptables`, generar variantes vinculadas a `base_adaptable_id` y guardar reglas aplicadas.

### Fase 5: Imagenes asistidas

Con proveedor configurado y coste aceptado, generar o mejorar imagenes desde prompts, siempre con estado pendiente de revision.

## Decision

Implementar primero el agente en modo dry-run y conservador. El objetivo no es producir muchas recetas rapido; es crear una fabrica controlada donde cada tanda mejore el sistema y reduzca errores de matching, macros e imagenes.
