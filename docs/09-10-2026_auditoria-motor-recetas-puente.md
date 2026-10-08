# Auditoría profunda del motor de recetas (puente Content Radar → NutriCoach)

Sesión 08→09-10-2026. Objetivo de Carlos: que la mayor cantidad posible de recetas que entran por el puente salgan **perfectas** (foto, macros, ingredientes, raciones, pasos) para tener un recetario cada vez más completo y estructurado.

## Cómo medir (repetible)
```bash
cd NUTRICION/nutricoach
npx tsx scripts/auditar-recetas-puente.ts [--desde=AAAA-MM-DD]   # solo lectura; escribe salidas/08-10-2026_auditoria-recetas-puente.json
```
Audita todas las recetas con `url_origen` http(s) que no estén descartadas: foto, macros, ingredientes (enlaces sospechosos, cantidades por defecto, estimadas), raciones, pasos, tipo de plato, nombre, duplicados por enlace.
Las recetas nuevas guardan `cantidad_original`/`unidad_display` **solo si la cantidad la dijo el vídeo**; el resto son estimadas (`cantidad_original` nulo).

## Resultado
| | Antes (primera pasada, con falsos positivos) | Después |
|---|---|---|
| Recetas del puente sin ningún fallo grave | 38 % (70 de 182) | **59 % (110 de 188)** |
| `tipo_plato` nulo | 16 | 0 |
| Salsas/aceites marcados como plato completo (entran en planes) | 3 en revisión | 0 en revisión |
| Recetas con <3 pasos numerados | 9 | 3 |
| Condimentos absurdos (sal/glutamato 80 g…) | varios | 0 nuevos (valores por palabra + estimación IA) |
Coste del proceso: DeepSeek ≈ 0,005 $/receta, foto (calidad media) ≈ 0,06 $/receta (medido: 6,53 → 6,47 $), borrador intuido ≈ +0,002 $.

## Fallos encontrados y corregidos en el motor (`Content-Radar/scripts/`)
1. **Foto desde cero (txt2img)** en el paso de reintentos, ignorando la miniatura, con reintento infinito ante `insufficient_quota` → vuelve al acuerdo del 24-05: miniatura del reel retocada (sin texto, marcas, manos ni personas de fondo); sin foto la receta se crea igual y `generate_missing_images.py` la rellena.
2. **Retoque en calidad alta por defecto** (~0,18 $/foto): ahora `quality=medium` + jpeg (~0,06 $).
3. **Claves en inglés** (`ingredients`) donde el extractor devuelve `ingredientes`: siempre 0 ingredientes.
4. **El extractor ignoraba el pie del vídeo** (donde muchos reels cuentan la receta) → `_texto_para_receta`.
5. **Enlace de ingredientes** por «primera palabra + más calórico» (yogur → tortitas sabor yogur, jengibre → galleta de jengibre, aguacate → agua): matcher puntuado (`_buscar_alimento_puntuado`: cobertura, precisión, palabra principal, clases de producto y sabores no pedidos) + `_MATCHES_FORZADOS` por palabras completas con exclusiones (`!palabra`).
6. **Cantidades**: defaults torpes (80 g de sal/azúcar/cacao/cebolla en polvo) → pesos por palabra, `taza`/`unidad`/`hoja` por ingrediente (1 taza de perejil = 25 g, no 200 g), y **estimación razonada con DeepSeek** de las que faltan (una llamada por receta). Trazabilidad `cantidad_original`.
7. **Raciones**: el flujo nuevo había perdido `_auto_fix_porciones`; reincorporado, con objetivo por tipo (salsa/bebida pequeñas).
8. **Tipo de plato/receta** nulo → `receta_calidad.inferir_tipos` (salsa/bebida solo si lo es el propio plato: «Pollo con salsa barbacoa» no es salsa).
9. **Pasos** sin numerar → `normalizar_pasos`.
10. **Duplicados**: dedup por enlace sin parámetros (`url_base`), además del nombre.
11. **Macros contra el vídeo**: si el pie declara kcal (`kcal_aprox`) y el cálculo difiere >30 %, la receta lleva la etiqueta `Revisar macros` y una nota en consejos.
12. **Reels sin receta hablada**: antes se rechazaban o salían con ingredientes inventados («base de brownie»); ahora **borrador intuido** (`receta_borrador.py`): foto retocada + enlace + propuesta de ingredientes/pasos con visión (título, pie, audio, miniatura y 6 fotogramas; transcribe el texto en pantalla). Etiqueta `Borrador`, aviso en la descripción, confianza alta/media/baja; sin pistas no inventa; en borradores no se auto-crean alimentos.
13. **Publicaciones de fotos de Instagram** («No video formats found»): se usan el pie y las diapositivas (`meta_publicacion_fotos`).
14. **Entorno del servicio automático**: launchd no podía abrir logs/`WorkingDirectory` en Escritorio (`spawn failed`, EX_CONFIG) → logs en `~/Library/Logs/ContentRadar/`; bajo launchd no se leen las cookies de Brave → fichero `IG_COOKIES_FILE` solo con instagram.com; elección de navegador por perfil existente; un fallo de cookies ya no cuenta como reintento del reel; `.env` pisaba `MAX_ITEMS_PER_RUN` (ahora 5); jobs guardan su receta (`payload_json._contexto`) para reintentos; no se reintentan jobs sin contexto.
15. **Dependencias**: `yt-dlp` (más de 90 días sin actualizar) → 2026.08.19 en el venv y en brew (había un lanzador antiguo de pip que lo tapaba; copia en `/tmp/yt-dlp.wrapper.bak`).

## Datos ya insertados corregidos (con copia en `Content-Radar/salidas/`)
- `scripts/corregir_recetas_puente.py --apply`: 21 recetas (tipo_plato nulo, 3 salsas en revisión, pasos numerados).
- `scripts/recalcular_cantidades_puente.py --apply`: 10 ingredientes de 2 wraps (de 1.066 a 463 kcal y de 650 a 608).
- Relinks: Tiramisú proteico y Mochi (proteína en polvo ≠ barrita), Donuts doble chocolate (chocolate blanco ≠ negro 92 %), Volcán de manjar blanco (dulce de leche), Tagliatelle de espárragos (≠ sopa instantánea).
- Etiquetado automático (`auto-etiquetar-recetas.ts --todas`, fusiona con las etiquetas existentes).

## Pendiente (siguiente pulido, por impacto)
1. **Decisión de Carlos — duplicados por enlace** (3 pares, ya aprobadas): *Mochi de papel de arroz* ×2 (mismo nombre), *Gel energético natural* ×2, *Mayonesa de camarón/camarones*. No se han tocado.
2. **Cantidades de recetas antiguas** (≈45, anteriores a la trazabilidad): re-estimar con IA las de `en_revision`; las aprobadas con **azúcar 80 g por defecto** (Milojas ×2, Volcán, Brownie cheesecake, Brownie brulé, Cookies) y las cantidades dudosas del Mochi («proteína en polvo 150 g») y Tiramisú («1 g») necesitan revisión de Carlos.
3. **Raciones** de aprobadas con >800 kcal en 1 ración (Tiras de pollo crujiente 840, Poke bowl salmón 916) y de las tandas en revisión (Marinado mayak 1.290, Donas 1.096, Ensalada pepino/atún 1.175).
4. **Fotos**: 2 recetas con foto `txt2img` (Zanahoria baby con feta, Rollitos de verduras); si la miniatura la ocupa una persona el retoque no inventa el plato (el borrador queda para foto a mano).
5. **Enlaces sospechosos restantes** (≈25, la mayoría falsos positivos de formato): revisar a mano los de recetas aprobadas (arroz glutinoso, frutos rojos, rubia gallega…).
6. **Etiquetas** (45 sin ninguna): ampliar `lib/auto-tag.ts`; valorar ejecutar el etiquetado como paso final del servicio automático.
7. **Bandeja de revisión**: filtro visual para `Borrador` y `Revisar macros` (diseño; lo lleva Codex).
8. **Cookies de Instagram** (`ig-cookies.txt`) caducarán: avisar en el heartbeat si fallan varios Instagram seguidos.
