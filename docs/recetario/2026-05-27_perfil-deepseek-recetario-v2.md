# Perfil DeepSeek Recetario v2

Este perfil se usa para pedir nuevos lotes de recetas a DeepSeek/Roo Code sin repetir los errores detectados en el primer lote.

## Modelo recomendado

- Para generar recetas: `deepseek-chat` si el lote es simple y barato.
- Para diseñar lotes complejos o clínicos: `deepseek-reasoner` solo para planificación breve, no para generar 50 recetas completas.
- Tamaño recomendado: 8-12 recetas por lote. No pedir 30-70 de golpe.

## Regla principal

DeepSeek no debe crear “recetas bonitas” aisladas. Debe crear activos para un motor de nutrición:

- recuperables por objetivo, deporte, momento y estilo;
- fáciles de matchear con alimentos reales;
- útiles para alternativas equivalentes;
- atractivas para adherencia;
- con macros plausibles y cantidades cocinables.

## Fallos que no se pueden repetir

- No usar `AOVE` solo. Escribir `Aceite de oliva virgen extra`.
- No usar “dientes de ajo” como gramos. Usar `Ajo`, 4g por diente.
- No usar especias/sal/pimienta/vainilla/chile con 50-80g.
- No meter `agua` como ingrediente de lista de compra salvo que sea imprescindible para una masa/sopa.
- No poner cantidades raras tipo 27g o 107g salvo caso técnico justificado.
- No dejar ingredientes ambiguos: `pan integral de molde grande`, `pollo cocido desmenuzado`, `wrap integral`, `setas variadas`. Usar nombres genéricos: `Pan integral`, `Pechuga de pollo`, `Tortilla de Trigo`, `Champiñón`.
- No entregar recetas sin `imagen_prompt` ni `nota_adherencia`.
- No crear recetas de desayuno como cena, ni postres como comida principal.
- No marcar `Sin Gluten` si hay pan, trigo, tortilla de trigo, wrap, avena, pasta, harina, bizcocho o galletas salvo que el ingrediente diga literalmente `sin gluten` o `certificado sin gluten`.
- No marcar `Sin Lactosa` si hay leche, yogur, queso, kefir, mantequilla, nata, whey/suero o similares salvo que el ingrediente diga literalmente `sin lactosa` o sea vegetal.
- No usar etiquetas de intolerancias como marketing. Solo se etiquetan cuando la receta completa cumple de verdad.
- No repetir estructuras dentro del mismo lote. Debe haber variedad culinaria real: cuchara, bowl, horno, plancha, wrap, postre, tupper, etc.

## Contrato JSON obligatorio

```json
{
  "recetas": [
    {
      "nombre": "string apetecible",
      "descripcion": "string",
      "categoria": "Desayuno|Almuerzo|Comida|Merienda|Cena|Postre|Snack",
      "porciones": 1,
      "descripcion_porcion": "1 racion clara",
      "tiempo_prep_min": 10,
      "tiempo_coccion_min": 15,
      "kcal": 450,
      "proteinas": 35,
      "carbohidratos": 45,
      "grasas": 14,
      "fibra": 7,
      "ingredientes": [
        { "nombre": "Pechuga de pollo", "cantidad_gramos": 150 }
      ],
      "instrucciones": "1. Paso uno. 2. Paso dos. 3. Paso tres.",
      "consejos": "uso práctico, conservación, ajuste opcional",
      "tags": ["alta_proteina", "saciante", "chef_healthy"],
      "objetivos": ["perdida_grasa", "recomposicion"],
      "deportes": ["general"],
      "momentos": ["cena"],
      "estilos": ["chef_healthy", "comfort_healthy"],
      "premium_chef": true,
      "uso_personal": false,
      "batch_cooking": false,
      "tupper": false,
      "digestibilidad": "media",
      "densidad_energetica": "media",
      "nivel_elaboracion": 2,
      "adherencia_score": 90,
      "coste_estimado_nivel": "medio",
      "intolerancias": [],
      "nota_adherencia": "Reinterpreta un plato habitual atractivo para que el cliente no sienta dieta restrictiva.",
      "imagen_prompt": "Fotografia realista de la receta terminada, luz natural, plato casero premium, ingredientes visibles, sin aspecto IA."
    }
  ]
}
```

## Prompt base para DeepSeek

```text
PROYECTO: NutriCoach
ROL: Chef dietista + nutricionista deportivo. Generas recetas para una app real con base de datos, no texto decorativo.

LOTE:
- Objetivo: [perdida_grasa/recomposicion/rendimiento/etc.]
- Momento: [desayuno/comida/cena/pre_entreno/etc.]
- Estilo: [chef_healthy/funcional/batch_cooking/etc.]
- Cantidad: 8-12 recetas.

REQUISITOS DUROS:
- Devuelve SOLO JSON válido con clave "recetas".
- Cumple exactamente el contrato JSON.
- Ingredientes con nombres genéricos de supermercado español.
- Cantidades redondas y realistas.
- Macros plausibles por ración.
- Cada receta debe tener imagen_prompt y nota_adherencia.
- No uses AOVE; escribe Aceite de oliva virgen extra.
- No uses dientes de ajo; usa Ajo en gramos.
- Especias, sal, pimienta, vainilla, chile, levadura o edulcorante: máximo 10g salvo justificación clara.
- No incluyas agua como ingrediente de compra.
- No inventes productos raros.
- No marques Sin Gluten si usas pan, trigo, wrap, tortilla de trigo, avena, harina, pasta, bizcocho o galleta normal.
- No marques Sin Lactosa si usas leche, yogur, queso, kefir, mantequilla, nata o whey normal.
- Si quieres una receta Sin Gluten/Sin Lactosa, escribe el ingrediente explícito: "Pan sin gluten", "Avena certificada sin gluten", "Yogur sin lactosa", "Queso fresco sin lactosa".
- La categoria y el momento deben coincidir: Desayuno→desayuno, Comida→comida, Cena→cena. Postre/Merienda no deben ser comida o cena principal.
- Incluye una `nota_adherencia` útil: qué deseo/plato habitual resuelve y por qué ayuda al cliente a cumplir.

ANTES DE RESPONDER:
1. Revisa si cada receta tiene mínimo 4 ingredientes.
2. Revisa que las kcal coinciden con el tipo de plato.
3. Revisa que no hay ingredientes ambiguos.
4. Revisa que tags/objetivos/momentos/estilos están completos.
5. Revisa que intolerancias no contradicen ingredientes.
6. Revisa que el resultado es JSON parseable.
```

## Flujo obligatorio tras recibir un lote

```bash
npm run recetas:pipeline -- scripts/NOMBRE_LOTE.json --coach-email coach@email.com
```

Si el primer comando falla, no importar. Devolver a DeepSeek el JSON de errores y pedir una nueva versión del mismo lote.

Comandos separados si se necesita depurar:

```bash
npm run recetas:validar -- scripts/NOMBRE_LOTE.json
npm run recetas:importar -- scripts/NOMBRE_LOTE.json --coach-email coach@email.com
npm run recetas:reparar -- scripts/NOMBRE_LOTE.json --coach-email coach@email.com
node scripts/quality-gate-recetas.mjs --json
```

Ver guía escalable: `docs/recetario/2026-05-27_pipeline-escalable-recetario.md`.
