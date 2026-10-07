# Fallos del motor de dietas y recetas que faltan (prueba con 4 clientes ficticios, 07-10-2026)

Clientes: Natalia (vegana, maratón, anemia), Laura (trail, 5 comidas), Marcos (Hyrox, 3.174 kcal), Andrés (powerlifter, dislipidemia).
Semana regenerada con las reglas nuevas (complementos con sentido, platos habituales, descartes aprendidos).

## Qué funciona
- Sin pescado/carne a la vegana, sin pescado azul a Laura, sin avena suelta, sin base repetida, raciones en medidas reales.
- Las comidas al día salen del cuestionario (Laura: 5). Aviso «Revisar a mano» cuando ningún complemento encaja.
- Los cambios de receta del cliente se anotan (`swap_rechazada`) y bajan esa receta en el ranking.

## Fallos encontrados (por prioridad)
1. **Condiciones de salud sin filtro clínico.** Andrés tiene dislipidemia y le salen «Lazanya de Hígado de Pollo» (2 veces), «Kebaprol», Tacos BigMac, burgers. El motor no limita grasa saturada, colesterol, vísceras ni embutidos por patología (solo por alérgenos/restricciones declaradas). Hay que traducir `condiciones_salud` a reglas (dislipidemia, hipertensión, diabetes, anemia, hipotiroidismo…).
2. **Faltan recetas para completar el objetivo.** Desayuno tiene ~16 candidatas y merienda ~7 para estos clientes. Marcos (3.174 kcal) queda entre 2.932 y 3.524 kcal/día (±11 %) y avisa de que un desayuno se queda 381 kcal corto: faltan desayunos salados/dulces de 700–900 kcal alto en hidratos. Andrés: desayuno de lunes 236 kcal corto.
3. **Poca variedad en desayuno y merienda:** «Tostada con mermelada y plátano» o «Tostadas con requesón, miel y plátano» salen 2–3 veces por semana a la vez en varios clientes; mucho azúcar en desayunos de deportistas.
4. **Meriendas y medias mañanas que no son meriendas:** «Salteado de pollo con salsa de soja y cacahuetes» (tipo `snack_postre`, es un plato), «Bowl de pollo encurtido», «Tostadas de salmón ahumado», «Shakshuka ligera», «Tsukemono». Clasificación del tipo de receta incompleta (pendiente un barrido más amplio de `tipo_receta`).
5. **Veganos:** solo 16 meriendas veganas, 1 apta para rendimiento; el tofu revuelto se repite 3 veces por la preferencia del cuestionario con pool pequeño.
6. **Platos que no son de comida** colados en comida/cena: cremas de 130–260 kcal (se tratan como plato y se completan con 250 g de arroz o pasta) y pan/focaccia (ya reclasificados como guarnición).
7. **Etiquetas de sabor** (dulce/salado) del desayuno deducidas por palabras del nombre de la receta: conviene un campo propio.
8. Ración máxima de arroz 250 g junto a un plato ya potente (jueves de Carlos); revisar topes por franja.

## Recetas a crear (ampliar recetario)
- **Desayunos deportista 700–900 kcal** (≥100 g hidratos): salados (tortilla + pan + fruta, bocadillos completos, huevos con boniato) y dulces (porridge grande, tortitas con yogur y fruta).
- **Meriendas reales** de 200–400 kcal: bocadillo pequeño, yogur con granola y fruta, tostada + fruta, batido + fruta, frutos secos con fruta; también salados.
- **Aptas dislipidemia / colesterol alto:** pescado blanco y azul al horno, legumbres, pollo/pavo sin piel, aceite de oliva en cantidad moderada, sin embutidos ni vísceras (marcar con etiqueta clínica).
- **Veganas:** meriendas, desayunos de más de 500 kcal y cenas con proteína completa.
- **Cenas ligeras** 350–500 kcal para días de descanso y sin lácteo (cremas ya hay; faltan platos completos).
- Guarniciones con nombre propio (puré, verduras salteadas, arroz con verduras) para no depender de 250 g de arroz.

## Siguientes pasos propuestos
1. Reglas clínicas por condición (empezando por dislipidemia, hipertensión, diabetes) en `filtrarRecetasPorSlot`.
2. Barrido de `tipo_receta` (platos mal marcados como snack o postre).
3. Lotes de recetas de la lista de arriba con `importar-lote-verificado.ts`.
4. Etiqueta de sabor y de «mini-comida» en recetas.

## Avance (misma noche)
- **Hecho:** reglas clínicas (`lib/nutricion/reglas-clinicas.ts`: dislipidemia, hipertensión, diabetes, anemia) con exclusión y ajuste de ranking; Andrés ya no recibe hígado, burgers ni kebab (pescado, legumbres y pollo en su lugar).
- **Hecho:** el pool de meriendas y medias mañanas admite recetas `completa` (antes solo `snack_postre`/`desayuno`): 7 → 22 candidatas. Salteado de pollo y shakshuka reclasificados a Comida.
- **Hecho:** topes de guarnición (arroz, pasta, patata, boniato) a 200 g.
- **Recetas nuevas en `en_revision` (34):** `2026-10-07_desayunos-deportista` (11: salados y dulces 640–800 kcal, 3 veganos), `2026-10-07_meriendas-reales` (12: 4 veganas), `2026-10-07_comidas-ligeras` (11: pescado, pollo, legumbres, 5 veganas/vegetarianas; aptas dislipidemia e hipertensión por composición). Generador: `scripts/lotes/_generar-lotes-2026-10-07.py`.
- **Pendiente tuyo:** aprobarlas en `/recetas/revisar` («Aprobar aprobables») y verificar con `verificar-recetas-auto.ts --apply`; sin foto (OpenAI sin saldo).
- **Sigue pendiente:** campo propio de sabor (dulce/salado) y de «mini-comida» (necesita migración), barrido más amplio de `tipo_receta`, ampliar veganas de cena y variedad de desayunos dulces con menos azúcar.

## Segunda tanda de recetas (en `en_revision`, 35)
`scripts/lotes/_generar-lotes-2026-10-07-b.py`: `veganas-comida-cena` (8), `comidas-cenas-variedad` (11: salmón, lubina, atún, rape, pulpo, mejillones, ternera, pavo, pollo, tortilla), `desayunos-menos-azucar` (8, sin mermelada ni miel) y `meriendas-variedad` (8). Alimentos nuevos verificados en el catálogo: tempeh, edamame, tahini, leche de coco, lentejas, pasta/arroz integral, tortilla de maíz, hummus, remolacha, rúcula, piña, higos, pasas, anacardos…
Pendiente: aprobar en `/recetas/revisar` y comprobar que el planificador las verifica; sin fotos.

## Estado final de la noche (08-10-2026)
- Recetario limpio: 43 recetas sin categoría visibles, 19 nombres en castellano, instrucciones ampliadas, 6 duplicados y 17 variantes casi idénticas descartadas (copias en `salidas/`), cremas/sopas como guarnición y 10 platos únicos con ración real (`scripts/mantenimiento-recetario-2026-10-07.mjs`, `corregir-raciones-ligeras-2026-10-07.mjs`, `variantes-recetario-2026-10-07.mjs`; todos con `--revertir` o copia).
- Semanas de Natalia, Laura, Marcos y Andrés regeneradas: días entre −9 % y +6 % del objetivo, sin repetir receta ni proteína el mismo día, sin hígado/embutidos para dislipidemia, todo vegano para Natalia.
- Pendiente: fotos (389 sin foto), 19 recetas con <3 ingredientes, decisión de Mealprep Carne / Kebab / Pollo burger (siguen saliendo en planes), recetas veganas (pocas), campo de sabor y mini-comida (migración), arroz con pollo de salsa de cilantro y lentejas estofadas (datos erróneos).
