-- Fix 1: Instrucciones concatenadas → añadir saltos de línea antes de cada numeración
-- Patrón: " 2. " " 3. " etc. pegados al final del paso anterior
UPDATE recetas
SET instrucciones = regexp_replace(
  regexp_replace(
    instrucciones,
    '\s+(\d{1,2})\.\s+',  -- espacio(s) + número + punto + espacio
    E'\n\\1. ',            -- salto de línea + número + punto + espacio
    'g'
  ),
  '^\n',  -- quitar salto inicial si el primer paso no tenía número
  '',
  'g'
)
WHERE instrucciones IS NOT NULL
  AND instrucciones ~ '\s\d{1,2}\.\s'  -- tiene pasos sin salto previo
  AND instrucciones NOT LIKE E'%\n%';  -- no tiene ya saltos de línea

-- Fix 2: Especias/sal con cantidades absurdas (>= 50g → valores realistas)
UPDATE receta_ingredientes
SET cantidad_gramos = CASE
  WHEN lower(nombre_libre) ~ '\bsal\b'
    THEN 2
  WHEN lower(nombre_libre) ~ '\bpimienta\b|\bpiment[oó]n\b|\bcomino\b|\bcurry\b|\bor[eé]gano\b|\bcanela\b|\bcilantro\b|\bperejil\b|\bjengibre\b|\bcúrcuma\b|\bcurcuma\b|\bchile\b|\bguindilla\b|\blevadura\b|\bedulcorante\b'
    THEN 3
  WHEN lower(nombre_libre) ~ '\bvainilla\b|\besencia\b|\bextracto\b'
    THEN 5
  ELSE 5
END
WHERE cantidad_gramos >= 50
  AND lower(nombre_libre) ~ '\bsal\b|\bpimienta\b|\bpiment[oó]n\b|\bcomino\b|\bcurry\b|\bor[eé]gano\b|\bcanela\b|\bcilantro\b|\bperejil\b|\bjengibre\b|\bcúrcuma\b|\bcurcuma\b|\bchile\b|\bguindilla\b|\blevadura\b|\bedulcorante\b|\bvainilla\b|\besencia\b|\bextracto\b';

-- Fix 3: Dientes de ajo con cantidades absurdas (>30g probablemente vinieron mal)
-- 1 diente = 4g, normalizar cantidades que superan lo razonable (>40g para un solo ajo)
UPDATE receta_ingredientes
SET cantidad_gramos = CASE
  WHEN cantidad_gramos > 100 THEN 12  -- probablemente 3-4 dientes
  WHEN cantidad_gramos > 40  THEN 8   -- probablemente 2 dientes
  ELSE cantidad_gramos
END
WHERE lower(nombre_libre) ~ '\bdiente.? de ajo\b|\bdientes? de ajo\b'
  AND cantidad_gramos > 40;
