-- ============================================================
-- FIX CATEGORÍAS MASIVO V2
-- ============================================================
-- 1. Eliminar alimentos en Supermercado sin datos nutricionales
-- 2. Re-categorizar alimentos en categorías inválidas (de scraping)
-- 3. Marcar no comestibles productos no alimenticios
-- 4. Aceitunas de Pescados → Condimentos
-- ============================================================

BEGIN;

-- ============================================================
-- BLOQUE 0: ACEITUNAS de Pescados → Condimentos
-- (las aceitunas rellenas de anchoa se colaban por el keyword "anchoa")
-- ============================================================

UPDATE alimentos SET categoria = 'Condimentos'
WHERE categoria = 'Pescados' AND es_comestible IS NOT FALSE
AND (nombre ILIKE '%aceituna%' OR nombre ILIKE '%olivada%');

-- ============================================================
-- BLOQUE 1: MARCAR NO COMESTIBLES (productos NO alimenticios)
-- ============================================================

-- Limpieza / hogar / bazar / menaje
UPDATE alimentos SET es_comestible = false WHERE categoria IN (
    'Bazar',
    'Absorbe olores y antihumedad',
    'Aditivos para el lavado',
    'Antical',
    'Anti hormigas y cucarachicidas',
    'Arenas e higiene',
    'Barbacoa, carbón y encendido',
    'Bolsas de conservación',
    'Botiquín',
    'Cepillos de dientes',
    'Cepillos y esponjas',
    'Cera ',
    'Cera suelos',
    'Complementos higiene',
    'Cubiertos, vajilla y mantel',
    'Cuchilla',
    'Detergente lavado a mano',
    'Encendedores, velas y carbón',
    'Esponjas',
    'Espuma y laca',
    'Herméticos y moldes',
    'Multiusos y otros',
    'Papel y bolsas de conservación',
    'Pañuelos',
    'Pilas',
    'Planchado',
    'Quitamanchas',
    'Rollo cocina',
    'Servilletas',
    'Tratamiento piscina',
    'Activador y antical lavadora',
    'Aerosol spray o pistola',
    'Ambientador eléctrico',
    'Bandas protectoras adhesivas',
    'Algodón'
);

-- Cosmética / cuidado personal / perfumería
UPDATE alimentos SET es_comestible = false WHERE categoria IN (
    'A mano y jabón común',
    'Aseo íntimo',
    'Aseo y cuidado',
    'After shave',
    'Body-lociones',
    'Brillos',
    'Crema de cara',
    'Crema pies',
    'Crema y gel de cara',
    'Cuidado de uñas y complementos',
    'Lotes mujer',
    'Mascarillas',
    'Perfumes y colonias',
    'Retoca raíces y otros',
    'Sérum y otros',
    'Sérum y ampollas',
    'Arreglos'
);

-- Comida de animales
UPDATE alimentos SET es_comestible = false WHERE categoria IN (
    'Alimentación húmeda'
);

-- ============================================================
-- BLOQUE 2: RE-CATEGORIZAR alimentos en categorías inválidas
-- a sus categorías nutricionales correctas
-- ============================================================

-- Aceitunas (encurtidos)
UPDATE alimentos SET categoria = 'Condimentos'
WHERE categoria IN ('Aceitunas con hueso', 'Aceitunas sin hueso', 'Banderillas y cocktails')
AND es_comestible IS NOT FALSE;

-- Dulces y bollería
UPDATE alimentos SET categoria = 'Dulces y bollería'
WHERE categoria IN (
    'Bombones',
    'Tarrinas',
    'Granizados y helados de hielo',
    'Cremas de untar',
    'Cucuruchos',
    'Bollería envasada',
    'Bollería dulce',
    'Bollería rellena y donuts',
    'Bollería salada',
    'Pastelitos surtidos',
    'Pastelitos',
    'Magdalenas',
    'Tartas y bizcochos',
    'Cocas y bizcochos',
    'Barras de helado y barquillos',
    'Barritas y galletas',
    'Galletas surtidas',
    'Con chocolate y rellenas',
    'Chocolate a la taza',
    'Chocolate con leche',
    'Chocolatinas',
    'Berlinas',
    'Bloques, tartas y Nata',
    'Bocadillos y sándwiches',
    'Tortitas',
    'Hojaldres',
    'Cremas de desayuno'
) AND es_comestible IS NOT FALSE;

-- Frutas deshidratadas
UPDATE alimentos SET categoria = 'Frutas deshidratadas'
WHERE categoria IN ('Fruta desecada', 'Frutas en almíbar y en su jugo')
AND es_comestible IS NOT FALSE;

-- Bebidas
UPDATE alimentos SET categoria = 'Bebidas'
WHERE categoria IN (
    'Infusiones',
    'Té',
    'Lima limón',
    'Tónica y bitter',
    'Bitter y ginger ale',
    'Energético',
    'Otros licores',
    'Vino lambrusco y espumoso',
    'Cafés refrigerados',
    'Café Grano',
    'Café Molido descafeinado',
    'Café Molido mezcla',
    'Café Molido natural',
    'Bebidas refrescantes',
    'Agua con gas',
    'Agua con sabores',
    'Bebidas vegetales',
    'Bífidus',
    'Bífidus de sabores',
    'Zumos',
    'Fruta + leche',
    'Fruta variada y otros sabores'
) AND es_comestible IS NOT FALSE;

-- Pescados / Mariscos
UPDATE alimentos SET categoria = 'Pescados'
WHERE categoria IN (
    'Sardinas',
    'Atún y bonito',
    'Base pescado',
    'Pescado',
    'Trucha',
    'Salazones',
    'Berberechos y almejas'
) AND es_comestible IS NOT FALSE;

UPDATE alimentos SET categoria = 'Mariscos'
WHERE categoria IN ('Almejas, berberechos y navajas')
AND es_comestible IS NOT FALSE;

-- Pan y cereales
UPDATE alimentos SET categoria = 'Pan y cereales'
WHERE categoria IN (
    'Pan rebanado',
    'Barra de pan',
    'Pan de bocadillo',
    'Pan tostado',
    'Pan rallado',
    'Picatostes',
    'Galletas saladas',
    'Barritas de cereales'
) AND es_comestible IS NOT FALSE;

-- Platos preparados
UPDATE alimentos SET categoria = 'Platos preparados'
WHERE categoria IN (
    'Caldo liquido',
    'Caldo líquido',
    'Caldo en pastillas',
    'Sopas en sobre',
    'Fideos y sopas',
    'Platos calientes',
    'Pizzas refrigeradas',
    'Platos de cuchara',
    'Base de pizza',
    'Bocadillos y sándwiches',
    'Hummus y otros',
    'Setas y champiñones',
    'Empanados y elaborados',
    'Hamburguesas'
) AND es_comestible IS NOT FALSE;

-- Snacks (aperitivos)
UPDATE alimentos SET categoria = 'Snacks'
WHERE categoria IN (
    'Patatas fritas',
    'Maíz tostado y cocktail',
    'Snacks y otros aperitivos'
) AND es_comestible IS NOT FALSE;

-- Frutas frescas
UPDATE alimentos SET categoria = 'Frutas frescas'
WHERE categoria IN (
    'Otras frutas',
    'Melón y sandía',
    'Piña',
    'Fruta',
    'Tarritos de fruta',
    'Cítricos'
) AND es_comestible IS NOT FALSE;

-- Verduras y hortalizas
UPDATE alimentos SET categoria = 'Verduras y hortalizas'
WHERE categoria IN (
    'Calabacín y pimiento',
    'Cebolla y ajo',
    'Otras verduras y hortalizas',
    'Tomate natural',
    'Conservas verdura',
    'Setas y champiñones'
) AND es_comestible IS NOT FALSE;

-- Carnes
UPDATE alimentos SET categoria = 'Carnes'
WHERE categoria IN (
    'Cerdo',
    'Pavo y otras aves',
    'Aves'
) AND es_comestible IS NOT FALSE;

-- Lácteos
UPDATE alimentos SET categoria = 'Lácteos'
WHERE categoria IN (
    'Leche',
    'Leche desnatada',
    'Leche Infantil',
    'Yogures desnatados',
    'Queso fresco',
    'Queso especialidades',
    'Postres de soja',
    'Otros postres',
    'Fruta + leche',
    'Bífidus',
    'Bífidus de sabores'
) AND es_comestible IS NOT FALSE;

-- Arroces y pastas
UPDATE alimentos SET categoria = 'Arroces y pastas'
WHERE categoria IN (
    'Arroz especial',
    'Arroz',
    'Arroz cocido',
    'Pasta',
    'Pasta fresca',
    'Pasta al huevo',
    'Pasta sin gluten',
    'Pasta ensaladas',
    'Spaghetti y tallarines',
    'Masas'
) AND es_comestible IS NOT FALSE;

-- Condimentos / especias / salsas
UPDATE alimentos SET categoria = 'Condimentos'
WHERE categoria IN (
    'Especias',
    'Otras especias',
    'Ketchup',
    'Mayonesa',
    'Allioli',
    'Mermelada',
    'Salsas',
    'Otras salsas',
    'Salsas frías',
    'Vinagre y aliños',
    'Sazonadores',
    'Azúcar',
    'Edulcorantes',
    'Resto de encurtidos',
    'Levadura y preparado repostería',
    'Salazones',
    'Paté'
) AND es_comestible IS NOT FALSE;

-- Frutos secos y semillas
UPDATE alimentos SET categoria = 'Frutos secos y semillas'
WHERE categoria IN (
    'Nueces',
    'Otros frutos secos',
    'Frutos Secos'
) AND es_comestible IS NOT FALSE;

-- Aceites y grasas
UPDATE alimentos SET categoria = 'Aceites y grasas'
WHERE categoria IN (
    'Aceite de oliva intenso y suave',
    'Aceite de oliva virgen',
    'Aceites y Grasas'
) AND es_comestible IS NOT FALSE;

-- ============================================================
-- BLOQUE 3: Lo que quede en categorías inválidas (sin mapear)
-- marcar como no comestible (es basura de scraping que no se pudo clasificar)
-- ============================================================

UPDATE alimentos SET es_comestible = false
WHERE categoria NOT IN (
    'Carnes','Pescados','Huevos','Lácteos',
    'Verduras','Frutas','Legumbres','Cereales','Tubérculos',
    'Grasas','Frutos secos','Semillas','Condimentos',
    'Bebidas','Suplementos','Otros','Supermercado',
    'Carnes blancas','Carnes rojas','Pescado blanco','Pescado azul',
    'Mariscos','Lácteos enteros','Lácteos semidesnatados','Lácteos desnatados',
    'Verduras y hortalizas','Patatas y tubérculos','Frutos secos y semillas',
    'Aceites y grasas','Salsas y condimentos','Dulces y bollería',
    'Frutas frescas','Frutas deshidratadas','Pan y cereales',
    'Arroces y pastas','Platos preparados','Snacks'
) AND es_comestible IS NOT FALSE;

-- ============================================================
-- BLOQUE 4: SUPERMERCADO - limpiar
-- Alimentos en Supermercado que no tienen datos nutricionales
-- y no se han podido categorizar automáticamente se marcan no comestibles
-- ============================================================

-- Primero: los que tienen nombre reconocible, re-categorizar
UPDATE alimentos SET categoria = 'Bebidas'
WHERE categoria = 'Supermercado' AND es_comestible IS NOT FALSE
AND (nombre ILIKE '%agua%' OR nombre ILIKE '%zumo%' OR nombre ILIKE '%refresco%'
     OR nombre ILIKE '%cerveza%' OR nombre ILIKE '%vino%' OR nombre ILIKE '%leche%'
     OR nombre ILIKE '%cola%' OR nombre ILIKE '%te%' OR nombre ILIKE '%infusión%'
     OR nombre ILIKE '%infusion%');

UPDATE alimentos SET categoria = 'Verduras y hortalizas'
WHERE categoria = 'Supermercado' AND es_comestible IS NOT FALSE
AND (nombre ILIKE '%calabac%' OR nombre ILIKE '%cebolla%' OR nombre ILIKE '%ajo%'
     OR nombre ILIKE '%espárrago%' OR nombre ILIKE '%esparrago%' OR nombre ILIKE '%tomate%'
     OR nombre ILIKE '%lechuga%' OR nombre ILIKE '%zanahoria%' OR nombre ILIKE '%pimiento%'
     OR nombre ILIKE '%brócoli%' OR nombre ILIKE '%brocoli%' OR nombre ILIKE '%espinaca%'
     OR nombre ILIKE '%acelga%' OR nombre ILIKE '%berenjena%' OR nombre ILIKE '%calabaza%');

UPDATE alimentos SET categoria = 'Frutas frescas'
WHERE categoria = 'Supermercado' AND es_comestible IS NOT FALSE
AND (nombre ILIKE '%manzana%' OR nombre ILIKE '%pera%' OR nombre ILIKE '%plátano%'
     OR nombre ILIKE '%platano%' OR nombre ILIKE '%naranja%' OR nombre ILIKE '%fresa%'
     OR nombre ILIKE '%kiwi%' OR nombre ILIKE '%limón%' OR nombre ILIKE '%limon%'
     OR nombre ILIKE '%mango%' OR nombre ILIKE '%aguacate%' OR nombre ILIKE '%uva%'
     OR nombre ILIKE '%melón%' OR nombre ILIKE '%melon%' OR nombre ILIKE '%sandía%'
     OR nombre ILIKE '%sandia%' OR nombre ILIKE '%piña%' OR nombre ILIKE '%pina%');

UPDATE alimentos SET categoria = 'Carnes'
WHERE categoria = 'Supermercado' AND es_comestible IS NOT FALSE
AND (nombre ILIKE '%jamón%' OR nombre ILIKE '%jamon%' OR nombre ILIKE '%pollo%'
     OR nombre ILIKE '%ternera%' OR nombre ILIKE '%cerdo%' OR nombre ILIKE '%pavo%'
     OR nombre ILIKE '%lomo%' OR nombre ILIKE '%filete%' OR nombre ILIKE '%chuleta%');

UPDATE alimentos SET categoria = 'Pescados'
WHERE categoria = 'Supermercado' AND es_comestible IS NOT FALSE
AND (nombre ILIKE '%pescado%' OR nombre ILIKE '%merluza%' OR nombre ILIKE '%bacalao%'
     OR nombre ILIKE '%salmón%' OR nombre ILIKE '%salmon%' OR nombre ILIKE '%atún%'
     OR nombre ILIKE '%atun%');

-- Lo que quede en Supermercado sin calorías → marcar no comestible
UPDATE alimentos SET es_comestible = false
WHERE categoria = 'Supermercado'
AND (calorias IS NULL OR calorias = 0)
AND es_comestible IS NOT FALSE;

COMMIT;
