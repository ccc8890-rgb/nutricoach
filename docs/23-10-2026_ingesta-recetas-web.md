# Ingesta de recetas desde webs (método, 23-10-2026)

Decisión de Carlos: recetas reales de webs de cocina/nutrición (uso privado, texto sin problema); las fotos NO se copian: las pone él con una captura propia. Sin recetas inventadas por IA.

## Flujo (3 pasos)
1. **Leer enlaces** → `node scripts/ingesta-leer-enlaces.mjs <url|archivo.txt> …` vuelca ingredientes, pasos, nutrición de la web, autor y tiempos (JSON-LD schema.org `Recipe`) a `salidas/ingesta/<fecha>_fuentes.json`. Sin JSON-LD no sirve (avisa).
2. **Lote verificado** → Claude escribe `scripts/lotes/<fecha>_web-*.json` enlazando cada ingrediente a un alimento EXACTO de la base (nombre + prefijo de id) con cantidad en gramos, y `origen_web: {url, autor, kcal_web}` por receta. `npx tsx scripts/importar-lote-verificado.ts <lote> [--apply --coach-email ccc8890@gmail.com]` calcula los macros con nuestra base y **rechaza** la receta si la kcal difiere >30 % de la web, si ya existe el nombre o la URL. Entra en `en_revision` con `fuente_tipo='web'`, `url_origen`, `autor_original`, sin foto.
3. **Foto y aprobación** → en `/recetas/revisar` cada receta tiene «Subir foto» (elegir archivo, o clic en el botón y ⌘V con una captura). Queda `imagen_tipo='propia'` y revisada. Después Carlos aprueba.

Roles válidos de ingrediente: carbohidrato_base, proteina_principal, grasa_saludable, verdura_volumen, fruta_complemento, lacteo_complemento, salsa_condimento, especias_aromaticos.

## Fuentes probadas (JSON-LD)
- Diet Doctor ES (completo, con nutrición; sitemap `es/kd_recipe-sitemap1|2.xml`, ~1.270 recetas; **mayoría low-carb/keto**: elegir las equilibradas).
- thecleaneatingcouple (parcial), Cookpad (usuarios, calidad variable). thebalancednutritionist y therealfooddietitians: sin JSON-LD útil en la página probada. HSN: 403. BBC Good Food y EatingWell no accesibles desde aquí.

## Prueba hecha
«Plato vegetariano alto en proteína con edamame y queso feta» (Diet Doctor): 374 kcal / P 29,8 nuestra base vs 379 / 30 de la web. Importada `en_revision` (id 26481acf…).
