# Guía de Repoblación del Recetario con DeepSeek

## Objetivo

Repoblar el recetario de NutriCoach con recetas útiles para el motor IA y atractivas para cliente final, sin gastar tokens de Codex ni depender de OpenAI.

El recetario debe cubrir dos líneas:

- **Chef healthy / adherencia:** pérdida de peso y recomposición. Platos que no parezcan dieta: tacos, burger, wraps, bowls, pasta, postres fit, tiramisú fit, cheesecake, comfort food ligero.
- **Funcional / rendimiento:** deportistas amateur y elite. Platos más simples, digestivos, completos y fáciles de repetir: bowls, arroz, pasta, patata, proteína clara, pre/post entreno.

## Herramientas ya disponibles

- Dashboard coach: `/recetas/cobertura`
- API preview/generación: `POST /api/recetas/generar-lote`
- API importación a revisión: `POST /api/recetas/importar-lote`
- Quality gate: `node scripts/quality-gate-recetas.mjs --todas`
- Auditoría completa: `node scripts/auditar-recetario-completo.mjs --detalle`
- Pipeline calidad: `node scripts/pipeline-calidad.mjs --horas 24`

Las recetas generadas por DeepSeek no se aprueban solas. Deben entrar en estado de revisión y pasar control antes de usarse en planes.

## Arquitectura de Cobertura

Cada receta debe etiquetarse para que el agente pueda recuperarla por:

- `objetivos`: `perdida_grasa`, `recomposicion`, `ganancia_muscular`, `mantenimiento`, `rendimiento`, `salud_general`
- `deportes`: `running`, `hyrox`, `ciclismo`, `triatlon`, `crossfit`, `fuerza`, `endurance`, `general`
- `momentos`: `desayuno`, `media_manana`, `comida`, `merienda`, `cena`, `pre_entreno`, `post_entreno`, `refeed`, `tapering`, `carga_cho`
- `estilos`: `chef_healthy`, `comfort_healthy`, `funcional`, `batch_cooking`, `tupper`, `rapida`, `mediterranea`, `gourmet_simple`, `alto_volumen`

## Prioridades de Producción

### Bloque 1 — Alta Adherencia para Pérdida/Recomposición

Crear primero 30-40 recetas.

Tipos:

- tacos Big Mac fit
- burger bowl
- kebab bowl
- pizza wrap alta proteína
- pasta cremosa ligera
- burrito bowl
- nuggets caseros al horno
- ramen fit
- lasaña ligera
- ensaladas muy saciantes pero atractivas
- tiramisú fit
- cheesecake proteico
- brownie fit
- crepes o tortitas proteicas

Reglas:

- 350-650 kcal por ración en comidas/cenas.
- 25-50 g proteína.
- Ingredientes de supermercado español.
- Cantidades redondeadas y realistas.
- No usar nombres clínicos ni “dieta”.
- Imagen potencialmente apetecible y realista.

### Bloque 2 — Rendimiento Funcional

Crear 25-35 recetas.

Tipos:

- rice bowls post-entreno
- pasta digestiva post-entreno
- patata/arroz + proteína + salsa ligera
- desayunos pre-run digestivos
- tostadas pre-entreno
- smoothies/postres post-entreno
- bowls para Hyrox/CrossFit
- opciones de carga CHO y tapering

Reglas:

- Más simples y repetibles.
- Baja grasa y baja fibra en pre-entreno.
- Más carbohidrato en post-entreno.
- Evitar recetas demasiado pesadas antes de correr.
- Tags claros: `pre_entreno`, `post_entreno`, `running`, `hyrox`, `endurance`.

### Bloque 3 — Batch Cooking Premium

Crear 20-25 recetas.

Tipos:

- tupper de pollo thai ligero
- arroz meloso fit
- chili alto en proteína
- albóndigas saludables
- curry ligero
- pasta al horno fit
- platos que recalientan bien

Reglas:

- Aguantar nevera 3-4 días.
- Salsas separables cuando proceda.
- Indicar conservación y recalentado.
- Servir para clientes con poco tiempo.

## Brief Estándar para DeepSeek

Usar este briefing cuando se delegue por CLI o se copie a `/recetas/cobertura`:

```text
PROYECTO: NutriCoach
TAREA: Generar lote de recetas para recetario IA.

OBJETIVO DEL LOTE:
[perdida_grasa / recomposicion / rendimiento / batch cooking]

MOMENTO:
[desayuno / comida / cena / pre_entreno / post_entreno / merienda]

ESTILO:
[chef_healthy / comfort_healthy / funcional / batch_cooking]

CANTIDAD:
6-8 recetas.

REQUISITOS:
- Recetas atractivas, realistas y con nombre apetecible.
- Ingredientes de supermercado español.
- Cantidades redondeadas: 5g, 10g, 25g, 50g, unidades o cucharadas cuando tenga sentido.
- No usar cantidades absurdas tipo 27g, 107g, 3g salvo especias.
- Macros plausibles por ración.
- Alergenos e intolerancias inferidas.
- Tags de objetivo, momento, deporte y estilo.
- Instrucciones claras y cocinables.
- No inventar productos raros ni ingredientes no comestibles.
- No aprobar automáticamente.

SALIDA:
JSON válido con array `recetas`.
```

## Flujo de Trabajo Recomendado

1. Ir a `/recetas/cobertura`.
2. Revisar huecos por objetivo, momento y deporte.
3. Generar lote pequeño de 6-8 recetas con DeepSeek.
4. Guardar en cola de revisión.
5. Ejecutar:

```bash
node scripts/pipeline-calidad.mjs --horas 24
node scripts/quality-gate-recetas.mjs --json
```

6. Revisar en `/recetas/revisar`.
7. Corregir nombres, ingredientes, fotos y gramajes.
8. Aprobar solo las recetas con:
   - imagen válida
   - ingredientes vinculados
   - macros plausibles
   - tags correctos
   - momento adecuado

## Criterios de Rechazo

Rechazar o corregir si aparece:

- cantidades raras visibles al cliente
- ingrediente ambiguo tipo “paté de pimienta 2g”
- receta de desayuno propuesta como cena principal o al revés
- macros imposibles
- ingredientes sin alimento vinculado
- imagen demasiado IA, oscura o poco real
- recetas que parecen hospitalarias o de dieta restrictiva
- nombre poco apetecible

## Cómo Debe Ayudar al Motor IA

Cada nueva receta debe resolver al menos uno de estos problemas:

- ofrecer alternativas correctas por momento de comida
- aumentar adherencia del cliente
- cubrir macros difíciles sin meter platos aburridos
- mejorar variedad semanal
- servir para intercambios equivalentes
- alimentar preferencias del cliente según elecciones reales
- permitir generar semanas completas de 7-14 días

## Próximos 5 Lotes Sugeridos

1. `street-fit perdida_grasa cena chef_healthy` — tacos, burger, kebab, pizza wrap.
2. `post-entreno rendimiento endurance funcional` — bowls y pasta/arroz digestivo.
3. `postres recomposicion merienda comfort_healthy` — tiramisú, cheesecake, brownie, crepes.
4. `batch-gourmet mantenimiento comida batch_cooking` — tuppers atractivos.
5. `pre-entreno running pre_entreno rapida` — opciones simples y digestivas.

## Nota para Codex

Cuando Carlos quiera avanzar con bajo coste:

- Codex decide el bloque y revisa outputs.
- DeepSeek genera el lote.
- La app importa a revisión.
- Codex solo verifica errores críticos y hace ajustes de pipeline si algo se repite.
