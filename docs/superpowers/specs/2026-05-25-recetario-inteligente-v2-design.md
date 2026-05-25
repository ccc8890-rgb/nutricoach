# Recetario Inteligente v2 Design

## Objetivo

Convertir el recetario en una base estratégica para agentes de nutrición capaces de generar planes de 7-14 días con receta principal y opciones equivalentes por comida.

## Principio de producto

El recetario no debe parecer una colección de recetas de dieta restrictiva. Debe combinar precisión nutricional con recetas atractivas, actuales y de estilo chef healthy. La arquitectura diferencia recetas funcionales de uso diario, recetas de rendimiento, recetas clínicas y recetas premium/chef para momentos concretos, clientes específicos o adherencia emocional.

## Taxonomía

Cada receta queda clasificada por:

- `objetivos`: pérdida grasa, recomposición, ganancia muscular, mantenimiento, rendimiento, salud general.
- `deportes`: fuerza, running, hyrox, ciclismo, triatlón, crossfit, endurance, general.
- `momentos`: desayuno, media mañana, comida, merienda, cena, pre-entreno, post-entreno, intra-entreno, descanso, refeed, tapering, carga CHO.
- `estilos`: funcional, chef healthy, batch cooking, tupper, mediterránea, alto volumen, comfort healthy, rápida, gourmet simple.
- `densidad_energetica`: baja, media, alta.
- `digestibilidad`: ligera, media, pesada.
- `nivel_elaboracion`: 1-5, de ultrarápida a chef.
- `adherencia_score`: 0-100, estimación de atractivo práctico para cliente.
- `premium_chef`: receta diferencial de marca.
- `uso_personal`: receta que Carlos puede usar o adaptar sin empujarla automáticamente a todos los clientes.

## Motor de agentes

Los agentes deben recuperar recetas por objetivo, deporte, momento, macros y preferencias. La puntuación combina:

- calidad técnica de receta
- adherencia
- match con objetivo
- match con deporte
- match con momento de ingesta
- cercanía a kcal/proteína objetivo
- bonus moderado a recetas chef healthy cuando el contexto lo pide

## Cobertura mínima

Para que el sistema genere semanas completas con 4 comidas/día y 3 opciones por comida, el recetario necesita estos mínimos:

- 50 desayunos
- 30 medias mañanas
- 80 comidas
- 40 meriendas
- 80 cenas
- 25 pre-entreno
- 25 post-entreno
- 90 pérdida grasa
- 90 recomposición
- 70 ganancia muscular
- 90 rendimiento
- 50 running
- 50 hyrox
- 40 ciclismo
- 40 triatlón

## Flujo escalable

1. Auditar cobertura actual.
2. Detectar huecos por slot, objetivo y deporte.
3. Generar/importar recetas por bloques estratégicos.
4. Pasar quality gate: ingredientes, macros, imagen, coste, alérgenos, tags.
5. Clasificar con taxonomía v2.
6. Usar el motor de score para propuestas semanales.
7. Aprender por feedback cliente y decisiones del coach.

## Primera implementación

Esta fase añade columnas, índices, backfill heurístico, módulo de scoring, API de cobertura y mejora la API de recetas sugeridas para usar taxonomía profesional.
