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
