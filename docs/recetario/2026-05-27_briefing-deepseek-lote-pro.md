# Briefing para DeepSeek — lote recetario pro

```text
PROYECTO: NutriCoach
TAREA: Crear un lote de recetas listo para pasar el pipeline escalable.

LEE ANTES:
- docs/recetario/2026-05-27_perfil-deepseek-recetario-v2.md
- docs/recetario/2026-05-27_pipeline-escalable-recetario.md

OBJETIVO DEL LOTE:
Crear 10 recetas nuevas para [OBJETIVO: perdida_grasa / recomposicion / rendimiento / salud_general].

CLIENTE TIPO:
[Describe aquí el cliente: bajada de peso que no quiere sentir dieta, atleta Hyrox, runner, triatleta, recomposición con poco tiempo, perfil clínico, etc.]

DISTRIBUCIÓN:
- 2 desayunos.
- 2 comidas principales.
- 2 cenas.
- 2 meriendas/postres.
- 2 recetas comodín: tupper, pre_entreno, post_entreno o batch cooking.

ESTILO CULINARIO:
Healthy atractivo, no comida de hospital. Reinterpretar platos normales: tacos, bowls, burgers, tostadas completas, wraps, postres fit, platos mediterráneos, cuchara ligera, horno, plancha o airfryer.

REQUISITOS DUROS:
- Devuelve SOLO JSON válido con clave "recetas".
- Cumple exactamente el contrato del perfil v2.
- Ingredientes genéricos de supermercado español.
- Cantidades redondas, realistas y cocinables.
- Macros plausibles por ración.
- No incluyas agua como ingrediente de compra.
- No uses AOVE; escribe "Aceite de oliva virgen extra".
- No uses dientes de ajo; usa "Ajo" en gramos.
- Especias, sal, pimienta, vainilla, levadura, chile o edulcorante: máximo 10g salvo justificación culinaria clara.
- No marques "Sin Gluten" si usas pan, trigo, wrap, tortilla de trigo, avena, harina, pasta, bizcocho o galleta normal.
- No marques "Sin Lactosa" si usas leche, yogur, queso, kefir, mantequilla, nata o whey normal.
- Si quieres una receta Sin Gluten/Sin Lactosa, el ingrediente debe decirlo explícitamente: "Pan sin gluten", "Avena certificada sin gluten", "Yogur sin lactosa", "Queso fresco sin lactosa".
- Categoria y momento deben coincidir: Desayuno→desayuno, Comida→comida, Cena→cena.
- Postre/Merienda no deben etiquetarse como comida/cena principal.
- Cada receta debe incluir imagen_prompt realista y nota_adherencia útil.

ANTES DE ENTREGAR:
1. Revisa que el JSON parsea.
2. Revisa que cada receta tiene al menos 4 ingredientes.
3. Revisa que las kcal encajan con la categoría.
4. Revisa que las intolerancias no contradicen ingredientes.
5. Revisa que hay variedad real de técnicas y formatos.
6. Revisa que nota_adherencia explica por qué ayuda al cliente a cumplir.

ARCHIVO A CREAR:
scripts/lote-[nombre-corto].json

DESPUÉS:
Ejecuta:
npm run recetas:validar -- scripts/lote-[nombre-corto].json

Si falla, corrige el JSON hasta que valide.

OUTPUT FINAL:
- Ruta del archivo creado.
- Resultado del validador.
- Lista breve de recetas creadas con categoría, kcal y proteína.
```
