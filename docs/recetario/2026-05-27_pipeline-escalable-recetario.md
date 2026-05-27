# Pipeline escalable de recetario IA

Objetivo: que DeepSeek pueda poblar el recetario desde cero sin que Codex tenga que corregir cada lote a mano. El sistema debe ser barato, estable y apto para multi-coach.

## Flujo estándar

```bash
npm run recetas:pipeline -- scripts/lote-coach.json --coach-email coach@email.com
```

El pipeline hace cuatro pasos:

1. Valida el JSON antes de tocar Supabase.
2. Importa recetas en `estado='en_revision'` y asociadas al coach correcto.
3. Repara el lote importado con scope por archivo y coach: macros originales, prompts, taxonomía, aliases e ingredientes.
4. Ejecuta quality gate para detectar matches raros, macros sospechosas, fotos faltantes o cantidades absurdas.

Si la validación falla, no se importa nada. Se copia el JSON de errores y se devuelve a DeepSeek para que regenere el mismo lote.

## Comandos separados

```bash
npm run recetas:validar -- scripts/lote.json
npm run recetas:importar -- scripts/lote.json --coach-email coach@email.com
npm run recetas:reparar -- scripts/lote.json --coach-email coach@email.com
node scripts/quality-gate-recetas.mjs --json
```

Para pruebas internas de Carlos se puede usar `--coach-id uuid`, pero en producción es más cómodo y menos frágil usar `--coach-email`.

## Reglas de coste

- Generación masiva: `deepseek-chat`.
- `deepseek-reasoner`: solo para diseñar arquitectura del lote, auditoría breve o casos clínicos complejos. No usarlo para escribir 50 recetas completas.
- Lotes recomendados: 8-12 recetas. Más tamaño aumenta errores, repeticiones y coste de revisión.
- OpenAI/GPT-4o: no usar para imágenes por defecto. Las recetas entran con `imagen_estado='sin_imagen'` y `imagen_needs_review=true`.
- Imágenes: generar solo tras aprobación humana o para lotes premium concretos.

## Contrato operativo para vender a otros coaches

- Cada lote entra con `coach_id` propio.
- Cada receta queda en revisión. Nunca se aprueba automáticamente.
- El validador bloquea agua/sal/especias de compra, cantidades absurdas, categorías incoherentes y prompts pobres.
- El reparador trabaja sobre el archivo importado, no sobre todo el recetario.
- El quality gate deja un informe para revisión.

## Prompt corto para DeepSeek

Usar el perfil completo en `docs/recetario/2026-05-27_perfil-deepseek-recetario-v2.md`.

Brief mínimo:

```text
Genera 10 recetas para NutriCoach siguiendo exactamente el contrato JSON del perfil v2.
Objetivo: [perdida_grasa/recomposicion/rendimiento/salud_general].
Momento: [desayuno/comida/cena/merienda/pre_entreno/post_entreno].
Estilo: [chef_healthy/comfort_healthy/funcional/batch_cooking].
Devuelve SOLO JSON válido. Antes de responder revisa cantidades, macros, momentos, tags, imagen_prompt y nota_adherencia.
```

## Criterio de aprobación

Un lote solo pasa a revisión visual si:

- `npm run recetas:pipeline` termina sin error.
- No hay ingredientes críticos sin `alimento_id`.
- No hay agua, sal o especias como compra principal.
- Macros por ración son plausibles.
- Las recetas tienen sentido para el momento del día.

Después Carlos revisa estética, adherencia y calidad culinaria antes de aprobarlas para clientes.
