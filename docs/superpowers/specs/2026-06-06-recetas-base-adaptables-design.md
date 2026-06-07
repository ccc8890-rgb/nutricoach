# Recetas Base Adaptables v1 Design

## Objetivo

Crear una capa de recetas base adaptables para que la IA no trabaje solo con recetas fijas, sino con estructuras culinarias que pueda ajustar a diferentes clientes, objetivos y disciplinas sin perder control nutricional ni calidad gastronómica.

El objetivo no es generar 300 recetas sueltas. El objetivo es construir una batería inicial de bases robustas que funcionen como "moldes profesionales": una misma base puede convertirse en versión pérdida de grasa, recomposición, ganancia muscular, rendimiento, tupper, rápida, digestiva o peri-entreno.

## Contexto actual

El sistema ya tiene buena parte de la infraestructura:

- Taxonomía v2 en recetas: objetivos, deportes, momentos, estilos, digestibilidad, adherencia y roles.
- Scoring para agentes con `scoreRecetaParaAgente`.
- Recetas sugeridas por objetivo, deporte, momento y macros.
- Cobertura en `/recetas/cobertura`.
- Perfil alimentario del cliente y feedback.
- Quality gate centralizado con `auditarRecetaProfesional`.
- Roles de ingrediente y reglas de scaling en `lib/ingredient-roles.ts`.

La base actual, tras pasar el backfill de auditoría, sacar de aprobadas las recetas bloqueadas, rescatar la primera tanda peri-entreno y sembrar una micro-batería de carga/tapering, tiene 425 recetas aprobadas. De ellas, 316 están marcadas con `portion_scalable` dentro de `planning_roles`, pero todavía falta una capa explícita de "receta base adaptable". Hoy el sistema selecciona recetas fijas y ajusta por cercanía; mañana debe seleccionar una base y aplicar una transformación controlada.

## Diagnóstico

La cobertura actual permite empezar, pero está descompensada:

- Rendimiento: 73 recetas marcadas.
- Deportes específicos: running 70, Hyrox 46, ciclismo 57, triatlón 49 y endurance 55.
- Media mañana: 4 recetas.
- Merienda: 174 recetas.
- Desayuno: 68 recetas.
- Comida: 110 recetas.
- Cena: 68 recetas.
- Pre-entreno: 14 recetas aprobadas.
- Post-entreno: 22 recetas aprobadas.
- Carga CHO: 11 recetas aprobadas.
- Tapering: 5 recetas aprobadas.
- Recetas sin momento: 3, omitidas por no tener tipo claro.
- Recetas aprobadas sin auditoría profesional (`score_calidad = null`): 0.
- Recetas aprobadas con `quality_estado_sugerido = bloqueada`: 0.
- `receta_ingredientes` ya tiene `rol_ingrediente` asignado al 100% tras backfill: 4102/4102.
- Predomina salud general/mantenimiento frente a objetivos deportivos o recomposición.

Esto confirma que antes de producir volumen masivo conviene crear una capa estructural.

## Principio de Producto

La batería v1 tendrá enfoque 70/30:

- 70% adherencia de cliente real: amateurs, pérdida de grasa, recomposición, agenda laboral, poco tiempo, comida mediterránea apetecible.
- 30% rendimiento: running, Hyrox, fuerza, endurance, peri-entreno, carga de carbohidratos, digestibilidad y recuperación.

La IA debe poder adaptar, pero no inventar sin límites. Cada base define qué se puede cambiar, cuánto se puede escalar y qué combinaciones están prohibidas.

## Modelo Conceptual

Una receta base adaptable se compone de:

- `base`: estructura culinaria estable.
- `roles`: proteína, carbohidrato, grasa, verdura/fibra, salsa, crunch, topping.
- `rango_gramajes`: límites seguros por ingrediente o rol.
- `variantes_objetivo`: pérdida grasa, recomposición, ganancia muscular, rendimiento, salud general.
- `variantes_deporte`: general, fuerza, running, Hyrox, endurance.
- `momentos`: desayuno, comida, cena, snack, pre-entreno, post-entreno, carga CHO.
- `restricciones`: alérgenos, digestibilidad, patologías, alimentos no intercambiables.
- `reglas_adaptacion`: cómo subir/bajar kcal, proteína, CHO y grasa.
- `quality_gate`: condiciones mínimas para poder aprobar la variante.

Ejemplo:

```text
Base: Bowl mediterráneo de arroz, pollo, verduras y salsa yogur
Proteína: pollo / pavo / tofu / atún
CHO: arroz / patata / quinoa / pan pita
Grasa: AOVE / aguacate / tahini / frutos secos
Fibra/color: pepino / tomate / espinaca / pimiento
Crunch: semillas / almendra / pan tostado

Pérdida grasa: más verdura, menos CHO, salsa ligera, proteína alta
Rendimiento post-entreno: más arroz/patata, grasa moderada, sodio controlado
Ganancia muscular: más CHO y grasa saludable, proteína distribuida
Tupper: salsa separada, verduras que aguanten, recalentado seguro
```

## Batería Inicial

La v1 tendrá 60 bases adaptables:

- 12 desayunos.
- 8 media mañana/snacks.
- 14 comidas.
- 8 meriendas.
- 14 cenas.
- 4 peri-entreno/carga CHO.

Cada base debe producir al menos 4 variantes útiles:

- versión pérdida grasa/recomposición.
- versión mantenimiento/salud.
- versión ganancia/rendimiento.
- versión rápida/tupper o digestiva.

Esto da una cobertura funcional de unas 240 variantes controladas sin crear 240 recetas manuales independientes.

## Tipos de Base

### Adherencia Cliente Real

Bases prioritarias:

- bowls mediterráneos.
- wraps y pitas.
- tostadas y bocadillos funcionales.
- pasta/arroz comfort healthy.
- hamburguesas/tacos/kebab fit.
- ensaladas completas no tristes.
- cremas con proteína.
- desayunos tipo yogur, avena, pancakes, bizcochos y tostadas.

### Rendimiento

Bases prioritarias:

- bowls post-entreno altos en CHO.
- comidas pre-entreno digestivas.
- opciones de carga CHO.
- desayunos pre-carrera.
- recovery meals con ratio CHO/proteína.
- cenas de tapering.

### Clínico Ligero

La v1 no será un motor clínico profundo, pero sí debe etiquetar:

- apto SOP.
- apto Hashimoto.
- digestivo.
- bajo en grasa pre-entreno.
- alto en fibra/saciedad.
- bajo estímulo digestivo.

## Arquitectura Técnica Propuesta

### Tabla Nueva: `receta_bases_adaptables`

Campos principales:

- `id`
- `nombre`
- `descripcion`
- `slot_principal`
- `objetivos`
- `deportes`
- `momentos`
- `estilos`
- `roles_ingredientes jsonb`
- `rango_gramajes jsonb`
- `reglas_adaptacion jsonb`
- `variantes_predefinidas jsonb`
- `restricciones jsonb`
- `estado`
- `score_base`
- `created_at`
- `updated_at`

### Relación con Recetas Existentes

No se sustituye `recetas`.

El flujo será:

```text
receta_bases_adaptables
  → genera o adapta variante
  → crea/actualiza receta en recetas
  → vincula receta.base_adaptable_id
  → pasa quality gate
  → queda disponible para planes IA
```

### Campos Nuevos en `recetas`

- `base_adaptable_id uuid null`
- `variante_objetivo text null`
- `variante_deporte text null`
- `variante_momento text null`
- `adaptacion_reglas_aplicadas jsonb`

## Motor de Adaptación

Nuevo módulo propuesto: `lib/recetas/adaptables.ts`.

Responsabilidades:

1. Seleccionar base por cliente, objetivo, deporte, momento y restricciones.
2. Calcular variante objetivo.
3. Ajustar gramajes dentro de rangos seguros.
4. Validar macros estimadas.
5. Generar instrucciones culinarias de la variante.
6. Ejecutar quality gate antes de aprobar.

La IA puede redactar nombre, instrucciones y pequeños ajustes culinarios, pero los gramajes y límites salen de reglas estructuradas.

### Prerrequisito: Scaling por Rol en Producción

Ya existe `lib/ingredient-roles.ts` con `SCALING_RULES`, `inferirRolIngrediente` y `calcularGramajeAjustado`, pero la expansión real de recetas en `lib/recetas/aplicar-receta-comida.ts` todavía usa un factor uniforme sobre todos los ingredientes.

Antes de activar bases adaptables, `aplicarRecetaAComida` debe:

- seleccionar `rol_ingrediente` y `es_cantidad_fija` desde `receta_ingredientes`;
- usar `calcularGramajeAjustado()` en vez de multiplicar todo por el mismo factor;
- mantener `factor_ajuste` trazable;
- recalcular macros reales desde los ingredientes ajustados;
- rechazar factores extremos fuera de `0.55-1.6`, salvo lógica explícita de variante.

También hay que ejecutar o rehacer `scripts/inferir-roles-ingredientes.mjs` para dejar los roles poblados antes de depender de esta capa.

## Flujo de Plan IA

El plan inicial pasará de:

```text
cliente → buscar recetas candidatas fijas → IA elige receta_id
```

a:

```text
cliente → buscar recetas fijas aprobadas + bases adaptables compatibles
        → si hay receta exacta buena, usar receta
        → si falta cobertura, generar variante desde base
        → validar quality gate
        → asignar receta_id
```

La generación de variantes será conservadora. En v1 solo se usará para cubrir huecos claros, no para reemplazar recetas aprobadas de alta calidad.

## Quality Gate

Toda variante generada debe pasar:

- ingredientes con alimento vinculado.
- cantidades válidas.
- sin matches semánticos sospechosos.
- macros dentro de rango del slot.
- instrucciones suficientes.
- intolerancias/alérgenos etiquetados.
- score mínimo 75 para aprobación automática.

Si no pasa, queda `en_revision`.

## Producción de la Batería v1

Orden de trabajo:

1. Auditar cobertura actual y huecos.
2. Backfill de auditoría profesional en recetas aprobadas con `score_calidad = null`.
3. Poblar `rol_ingrediente` en recetas existentes. Completado: 4102/4102 ingredientes con rol.
4. Cambiar expansión de recetas a scaling por rol. Completado en `aplicarRecetaAComida`: especias/fijos no escalan, salsas/grasas/estructurales escalan con límites.
5. Clasificar/rehacer momentos de recetas existentes sin momento.
6. Crear una micro-batería peri-entreno controlada antes de usar slots pre/post en planes. Mientras no exista cobertura suficiente, los momentos deportivos son estrictos y no aceptan fallback a recetas genéricas.
7. Crear 60 bases adaptables.
8. Generar variantes de prueba para 10 bases.
9. Pasar quality gate y revisión manual.
10. Activar uso limitado en generación de planes.
11. Medir aceptación con `receta_interacciones_cliente`.

## Criterios de Éxito

La v1 se considera lista cuando:

- Existen 60 bases adaptables en BD.
- Al menos 40 bases tienen 4 variantes probadas.
- Media mañana sube de 4 a mínimo 30 opciones útiles.
- Pre-entreno y post-entreno suben de 0 a mínimo 25 opciones útiles cada uno.
- Carga CHO y tapering tienen al menos 10 opciones controladas cada uno.
- Rendimiento sube de 37 a mínimo 80 opciones.
- Running/Hyrox/endurance suben a mínimo 60 cada uno.
- El plan IA puede cubrir 7 días sin repetir receta para un cliente estándar.
- Las variantes generadas quedan aprobadas solo si pasan quality gate.

## Fuera de Alcance v1

- UI visual compleja para editar bases.
- Generación libre sin reglas.
- Motor clínico avanzado bajo FODMAP, renal, diabetes compleja o trastornos de conducta alimentaria.
- Auto-aprobación masiva sin revisión de los primeros lotes.
- Fotos finales generadas por IA. Las imágenes se tratarán como fase separada.

## Riesgos

- Si los rangos de gramaje son demasiado amplios, la IA puede crear variantes incoherentes.
- Si se generan variantes sin revisar ingredientes vinculados, volverán errores de matching.
- Si se prioriza rendimiento demasiado pronto, el recetario pierde utilidad comercial para clientes amateur.
- Si todo se guarda como receta fija sin relación a la base, se pierde aprendizaje estructural.

## Decisión

Implementar primero la capa de receta base adaptable, no una tanda masiva de recetas sueltas.

Prioridad de producto:

1. Cliente real/adherencia.
2. Pérdida grasa y recomposición.
3. Rendimiento amateur.
4. Rendimiento avanzado/profesional.
