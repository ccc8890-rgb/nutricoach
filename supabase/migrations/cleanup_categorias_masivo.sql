-- LIMPIEZA MASIVA DE CATEGORIAS
-- Supermercado, Condimentos, Tuberculos, Salsas y condimentos

BEGIN;

-- ============================================================
-- BLOQUE 1: SUPERMERCADO - marcar NO COMESTIBLES
-- ============================================================

-- Alimento para animales
UPDATE alimentos SET es_comestible = false WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%perro%' OR nombre ILIKE '%gato%' OR nombre ILIKE '%periquito%'
  OR nombre ILIKE '%canario%' OR nombre ILIKE '%hamster%' OR nombre ILIKE '%cobaya%'
  OR nombre ILIKE '%loro%' OR nombre ILIKE '%cotorra%' OR nombre ILIKE '%agaporni%'
  OR nombre ILIKE '%ninfa%' OR nombre ILIKE '%jilguero%' OR nombre ILIKE '%Granzoo%'
  OR nombre ILIKE '%Compy%' OR nombre ILIKE '%Delikuit%' OR nombre ILIKE '%Dentastix%'
  OR nombre ILIKE '%Natura%' OR nombre ILIKE '%Bocabits%'
  OR nombre ILIKE '%Felix%Party%Mix%' OR nombre ILIKE '%Adventuros%Nuggets%'
  OR nombre ILIKE '%Funtastix%' OR nombre ILIKE '%Barritas%Roedores%'
  OR nombre LIKE '%Barrita%Fruta%Canarios%' OR nombre LIKE '%Barrita%Fruta%Periquitos%'
  OR nombre LIKE '%Barrita%Miel%Canarios%' OR nombre LIKE '%Barrita%Miel%Periquitos%'
  OR nombre LIKE '%Barritas%fruta%miel%para%canarios%'
  OR nombre LIKE '%Barritas%fruta%miel%para%periquitos%'
  OR nombre LIKE '%Snack%Cuero%Perro%' OR nombre LIKE '%Snack%Tira%Perros%'
);

-- Productos de limpieza y hogar
UPDATE alimentos SET es_comestible = false WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%Salfumant%' OR nombre ILIKE '%Lavavajillas%'
  OR nombre ILIKE '%Sal%lavavajillas%' OR nombre ILIKE '%Alcohol%Limpieza%'
  OR nombre ILIKE '%Incrementador%pH%' OR nombre ILIKE '%piscina%'
  OR nombre ILIKE '%Alcohol%de%Limpieza%'
);

-- Cosmetica y cuidado personal (Supermercado)
UPDATE alimentos SET es_comestible = false WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%Crema%hidratante%' OR nombre ILIKE '%Gel%ban%'
  OR nombre ILIKE '%Mascarilla%pies%' OR nombre ILIKE '%Perfilador%labios%'
  OR nombre ILIKE '%Coloración%permanente%' OR nombre ILIKE '%Cinta%dental%'
  OR nombre ILIKE '%Seda%dental%'
);

-- ============================================================
-- BLOQUE 1b: SUPERMERCADO - RECATEGORIZAR alimentos reales
-- ============================================================

-- Condimentos/especias
UPDATE alimentos SET categoria = 'Condimentos' WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%ají panca%' OR nombre ILIKE '%chipotles%'
  OR nombre ILIKE '%concentrado%caldo%' OR nombre ILIKE '%pepinillo%'
  OR nombre ILIKE '%vinagre%' OR nombre ILIKE '%mostaza%' OR nombre ILIKE '%curry%'
  OR nombre ILIKE '%pimentón%' OR nombre ILIKE '%orégano%'
);

-- Snacks (aperitivos)
UPDATE alimentos SET categoria = 'Snacks' WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%Aros de maíz%' OR nombre ILIKE '%Aros de maiz%'
  OR nombre ILIKE '%Coctel d%aperitius%' OR nombre ILIKE '%Coctel Mixt%'
  OR nombre ILIKE '%Combinado aperitivos%' OR nombre ILIKE '%Cuetes%'
  OR nombre ILIKE '%Cuquis%' OR nombre ILIKE '%Duplo Pringles%'
  OR nombre ILIKE '%Maíz frito%' OR nombre ILIKE '%Maiz frito%'
  OR nombre ILIKE '%Maíz palomitas%' OR nombre ILIKE '%Maiz palomitas%'
  OR nombre ILIKE '%Snack maiz%' OR nombre ILIKE '%Tiras maiz%'
  OR nombre ILIKE '%Yuquitas%' OR nombre ILIKE '%Malvaviscos%'
  OR nombre ILIKE '%Coctel d%olives%'
);

-- Cereales/ingredientes
UPDATE alimentos SET categoria = 'Cereales' WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%Almidon%Spray%' OR nombre ILIKE '%Almidón%Spray%'
  OR nombre ILIKE '%maicena%' OR nombre ILIKE '%levadura%'
  OR nombre ILIKE '%LEVANOVA%' OR nombre ILIKE '%polvo de hornear%'
  OR nombre ILIKE '%polvo%hornear%' OR nombre ILIKE '%Overnight Oats%'
  OR nombre ILIKE '%psyllium%' OR nombre ILIKE '%ECOBASICS%Psyllium%'
  OR nombre ILIKE '%weetabix%'
);

-- Verduras/Frutas
UPDATE alimentos SET categoria = 'Verduras' WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%Verduras para Cocido%' OR nombre ILIKE '%verduras%cocido%'
);

UPDATE alimentos SET categoria = 'Frutas' WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%lima%' OR nombre ILIKE '%Frutos rojos congelados%'
  OR nombre ILIKE '%puré de açaí%' OR nombre ILIKE '%açaí%'
);

-- Pescados
UPDATE alimentos SET categoria = 'Pescados' WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%ATUNLO%' OR nombre ILIKE '%tonyina%' OR nombre ILIKE '%atún%'
  OR nombre ILIKE '%salmón%' OR nombre ILIKE '%sardina%'
);

-- Arroces y pastas
UPDATE alimentos SET categoria = 'Arroces y pastas' WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%Láminas de lasaña%' OR nombre ILIKE '%Yufka%'
);

-- Dulces y bolleria / Postres
UPDATE alimentos SET categoria = 'Dulces y bollería' WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%Gelatina Neutra%' OR nombre ILIKE '%nutella%'
  OR nombre ILIKE '%Postre%coco%Alpro%' OR nombre ILIKE '%Postre%soja%'
);

-- Lacteos/alternativas
UPDATE alimentos SET categoria = 'Lácteos' WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%Activia%Soja%' OR nombre ILIKE '%Philadelphia%Vegetal%'
  OR nombre ILIKE '%Rallado Vegano%'
);

-- Semillas
UPDATE alimentos SET categoria = 'Semillas' WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%sésamo%' OR nombre ILIKE '%sesamo%'
);

-- Suplementos
UPDATE alimentos SET categoria = 'Suplementos' WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%Plus Fuerza%'
);

-- Carnes
UPDATE alimentos SET categoria = 'Carnes' WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%Rossellona%' OR nombre ILIKE '%Crema de York%'
);

-- Platos preparados
UPDATE alimentos SET categoria = 'Platos preparados' WHERE categoria = 'Supermercado' AND (
  nombre ILIKE '%Seitán%' OR nombre ILIKE '%seitan%'
);

-- Lo que quede en Supermercado sin es_comestible=false -> marcar no comestible
UPDATE alimentos SET es_comestible = false
WHERE categoria = 'Supermercado' AND (es_comestible IS NULL OR es_comestible = true);

-- ============================================================
-- BLOQUE 2: CONDIMENTOS - limpieza de NO COMESTIBLES
-- ============================================================

-- Productos de limpieza/hogar
UPDATE alimentos SET es_comestible = false WHERE categoria = 'Condimentos' AND (
  nombre ILIKE '%Salfumant%' OR nombre ILIKE '%Lavavajillas%'
  OR nombre ILIKE '%Sal%lavavajillas%' OR nombre ILIKE '%Alcohol%Limpieza%'
  OR nombre ILIKE '%Incrementador%pH%' OR nombre ILIKE '%piscina%'
  OR nombre ILIKE '%Cinta%dental%' OR nombre ILIKE '%Seda%dental%'
  OR nombre ILIKE '%Coloración%permanente%' OR nombre ILIKE '%Crema%hidratante%'
  OR nombre ILIKE '%Perfilador%labios%' OR nombre ILIKE '%Mascarilla%pies%'
  OR nombre ILIKE '%Gel%ban%'
);

-- Comida de animales en Condimentos
UPDATE alimentos SET es_comestible = false WHERE categoria = 'Condimentos' AND (
  nombre ILIKE '%perro%' OR nombre ILIKE '%gato%' OR nombre ILIKE '%periquito%'
  OR nombre ILIKE '%canario%' OR nombre ILIKE '%hamster%' OR nombre ILIKE '%cobaya%'
  OR nombre ILIKE '%loro%' OR nombre ILIKE '%cotorra%' OR nombre ILIKE '%agaporni%'
  OR nombre ILIKE '%ninfa%' OR nombre ILIKE '%Dentastix%' OR nombre ILIKE '%Delikuit%'
  OR nombre ILIKE '%Compy%' OR nombre ILIKE '%Dentalife%' OR nombre ILIKE '%Catisfaction%'
  OR nombre ILIKE '%Felix%' OR nombre ILIKE '%Bocaditos%en%salsa%'
  OR nombre ILIKE '%Pocket%Gato%' OR nombre ILIKE '%Snack%Liquido%Gatos%'
);

-- Aceitunas -> Snacks (NO son condimentos, son aperitivos/encurtidos)
UPDATE alimentos SET categoria = 'Snacks'
WHERE categoria = 'Condimentos' AND es_comestible IS NOT FALSE
AND (nombre ILIKE '%aceituna%' OR nombre ILIKE '%olivada%');

-- Pescados en conserva mal categorizados
UPDATE alimentos SET categoria = 'Pescados'
WHERE categoria = 'Condimentos' AND es_comestible IS NOT FALSE
AND (nombre ILIKE '%salmón%' OR nombre ILIKE '%atún%' OR nombre ILIKE '%sardina%'
     OR nombre ILIKE '%caballa%' OR nombre ILIKE '%anchoa%' OR nombre ILIKE '%boquerón%'
     OR nombre ILIKE '%sardinilla%');

-- ============================================================
-- BLOQUE 3: TUBERCULOS - mover platos preparados y snacks
-- ============================================================

-- Tortillas de patata -> Platos preparados
UPDATE alimentos SET categoria = 'Platos preparados'
WHERE categoria = 'Tubérculos'
AND (nombre ILIKE '%tortilla%patata%' OR nombre ILIKE '%tortilla%patatas%'
     OR nombre ILIKE '%Pincho%tortilla%' OR nombre ILIKE '%Media tortilla%');

-- Platos preparados con patata
UPDATE alimentos SET categoria = 'Platos preparados'
WHERE categoria = 'Tubérculos'
AND (nombre ILIKE '%Costillas con Patatas%' OR nombre ILIKE '%Costillas con Patata%'
     OR nombre ILIKE '%Carrillera%Patatas%' OR nombre ILIKE '%Carrillera%Patata%'
     OR nombre ILIKE '%Albóndigas%Patatas%');

-- Preparaciones de patata (bravas, kebab, etc.)
UPDATE alimentos SET categoria = 'Platos preparados'
WHERE categoria = 'Tubérculos'
AND (nombre ILIKE '%Patatas bravas%' OR nombre ILIKE '%Patatas%kebab%'
     OR nombre ILIKE '%Patata%Guarnición%' OR nombre ILIKE '%Patatas%guarnición%'
     OR nombre ILIKE '%Patata%Guarnicion%' OR nombre ILIKE '%Patatas%guarnicion%');

-- Patatas fritas de bolsa -> Snacks
UPDATE alimentos SET categoria = 'Snacks'
WHERE categoria = 'Tubérculos'
AND (nombre ILIKE '%Patatas%Fritas%' OR nombre ILIKE '%Patatas%Chips%'
     OR nombre ILIKE '%Patatas%Lisas%' OR nombre ILIKE '%Patatas%Onduladas%'
     OR nombre ILIKE '%Patatas%Crujientes%' OR nombre ILIKE '%Patatas%Sal al%'
     OR nombre ILIKE '%Patatas%Sin Sal%' OR nombre ILIKE '%Patatas%Flor de Sal%'
     OR nombre ILIKE '%Patatas%Sabor%' OR nombre ILIKE '%Patatas%paja%'
     OR nombre ILIKE '%Patatas%Receta Original%' OR nombre ILIKE '%Patatas%Viruta%');

-- Snacks de patata congelados
UPDATE alimentos SET categoria = 'Snacks'
WHERE categoria = 'Tubérculos'
AND (nombre ILIKE '%Crispy Pops%' OR nombre ILIKE '%Waffle%'
     OR nombre ILIKE '%Patatas%air fryer%');

-- ============================================================
-- BLOQUE 4: SALSAS Y CONDIMENTOS -> fusionar en Condimentos
-- ============================================================

UPDATE alimentos SET categoria = 'Condimentos'
WHERE categoria = 'Salsas y condimentos' AND es_comestible IS NOT FALSE;

COMMIT;
