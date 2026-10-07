# Segunda tanda del 07-10-2026: veganas, variedad de proteínas, desayunos con menos azúcar y meriendas.
# Reutiliza el generador de la primera tanda y amplía el catálogo con alimentos verificados del catálogo de la BD.
import importlib.util, json, os
base = os.path.dirname(__file__)
spec = importlib.util.spec_from_file_location('g', os.path.join(base, '_generar-lotes-2026-10-07.py'))
# El módulo escribe sus lotes al importarse; se evita ejecutándolo solo hasta definir las funciones
src = open(os.path.join(base, '_generar-lotes-2026-10-07.py')).read().split('desayunos = [')[0]
ns = {'__file__': os.path.join(base, '_generar-lotes-2026-10-07.py')}
exec(src, ns)
cat, lote, R = ns['cat'], ns['lote'], ns['R']

def a(nombre, prefijo, rol, alergenos, origen): cat[nombre] = {'nombre': nombre, 'prefijo': prefijo, 'rol': rol, 'alergenos': alergenos, 'origen': origen}
a('Tempeh', 'bca25e6d', 'proteina_principal', ['Soja'], 'vegetal'); a('Edamame', '642cd6e3', 'proteina_principal', ['Soja'], 'vegetal')
a('tahini', '6e801766', 'grasa_saludable', ['Sésamo'], 'vegetal'); a('Semillas de sésamo', '4218ee8b', 'grasa_saludable', ['Sésamo'], 'vegetal')
a('Leche de coco', 'c661ff5c', 'grasa_saludable', [], 'vegetal'); a('Lentejas', 'ff64faff', 'carbohidrato_base', [], 'vegetal')
a('Pasta integral', '08e6f429', 'carbohidrato_base', ['Gluten'], 'vegetal'); a('Arroz integral', 'b5839902', 'carbohidrato_base', [], 'vegetal')
a('Tortilla de maíz', '24eb4d1c', 'carbohidrato_base', [], 'vegetal'); a('Hummus', '2856bf23', 'salsa_condimento', ['Sésamo'], 'vegetal')
a('Cúrcuma', '94ba864e', 'especias_aromaticos', [], 'vegetal'); a('Cilantro', '0e40c366', 'especias_aromaticos', [], 'vegetal')
a('Pimiento verde', '5a2b6b52', 'verdura_volumen', [], 'vegetal'); a('Remolacha', 'ac0c0a04', 'verdura_volumen', [], 'vegetal')
a('Rúcula', 'd23e1bdd', 'verdura_volumen', [], 'vegetal'); a('Lechuga', '7fb4b7ea', 'verdura_volumen', [], 'vegetal')
a('Vinagre', '46e4dee0', 'salsa_condimento', [], 'vegetal'); a('Pollo', '12616b3d', 'proteina_principal', [], 'carne')
a('Pavo', 'd03f44ad', 'proteina_principal', [], 'carne'); a('Salmón fresco', '09a34011', 'proteina_principal', ['Pescado'], 'pescado')
a('Lubina', '2435e7ae', 'proteina_principal', ['Pescado'], 'pescado'); a('Atún fresco', 'f4e5e641', 'proteina_principal', ['Pescado'], 'pescado')
a('Mejillones', '92c4eb12', 'proteina_principal', ['Moluscos'], 'marisco'); a('Rape', 'e28f1cb2', 'proteina_principal', ['Pescado'], 'pescado')
a('Pulpo', 'afd14b81', 'proteina_principal', ['Moluscos'], 'marisco'); a('Clara de huevo', '8f023610', 'proteina_principal', ['Huevos'], 'huevo')
a('Queso fresco', '197f0661', 'lacteo_complemento', ['Lácteos'], 'lacteo'); a('Piña', '8810f4f6', 'fruta_complemento', [], 'vegetal')
a('Pera', '19e6ca0e', 'fruta_complemento', [], 'vegetal'); a('Higos', '9241af66', 'fruta_complemento', [], 'vegetal')
a('Pasas', 'ad30a656', 'fruta_complemento', [], 'vegetal'); a('Anacardos', 'c98f36fc', 'grasa_saludable', ['Frutos Secos'], 'vegetal')
a('Semillas de calabaza', '7cbf0ffb', 'grasa_saludable', [], 'vegetal'); a('Semillas de girasol', 'f7d27312', 'grasa_saludable', [], 'vegetal')
a('Puerro', 'd89cd8d1', 'verdura_volumen', [], 'vegetal'); a('Champiñones', '5b7e9a7d', 'verdura_volumen', [], 'vegetal')

veganas = [
 R('Curry de lentejas con leche de coco y arroz integral', 30, 'Plato vegano especiado, con proteína de legumbre y cereal integral.',
   [('Lentejas', 70), ('Leche de coco', 80), ('Arroz integral', 60), ('Cebolla', 50), ('Tomate triturado', 100), ('Cúrcuma', 2), ('Comino', 2), ('Aceite de oliva virgen extra', 5), ('Cilantro', 5)],
   '1. Sofríe la cebolla con el aceite, la cúrcuma y el comino.\n2. Añade las lentejas lavadas, el tomate y agua que las cubra y cuece 20 minutos.\n3. Incorpora la leche de coco y sirve con el arroz integral cocido y el cilantro.', 'Las lentejas rojas se hacen en 15 minutos si las tienes.'),
 R('Tempeh a la plancha con arroz integral y brócoli', 25, 'Plato vegano de alta proteína con cereal integral y verdura.',
   [('Tempeh', 150), ('Arroz integral', 70), ('Brócoli', 150), ('Salsa de soja', 10), ('Aceite de oliva virgen extra', 8), ('Ajo', 3), ('Semillas de sésamo', 5)],
   '1. Cuece el arroz integral 25 minutos.\n2. Dora el tempeh en lonchas con el ajo y el aceite, y termina con la salsa de soja.\n3. Cuece el brócoli al vapor y sirve todo con el sésamo por encima.', 'Marinar el tempeh 15 minutos en la soja le da más sabor.'),
 R('Bol de edamame, quinoa y aguacate', 20, 'Bol vegano fresco con proteína completa y grasa buena.',
   [('Edamame', 120), ('Quinoa', 70), ('Aguacate', 60), ('Zanahoria', 60), ('Pepino', 60), ('Salsa de soja', 8), ('Limón', 10), ('Semillas de sésamo', 5)],
   '1. Cuece la quinoa 12 minutos y deja enfriar.\n2. Cuece el edamame 4 minutos.\n3. Monta el bol con la quinoa, el edamame, el aguacate, la zanahoria rallada y el pepino, y aliña con soja y limón.', 'Admite edamame congelado sin desgranar.'),
 R('Pasta integral con crema de calabaza y garbanzos', 30, 'Pasta vegana cremosa sin lácteos.',
   [('Pasta integral', 80), ('Calabaza', 200), ('Garbanzos cocidos', 120), ('Aceite de oliva virgen extra', 8), ('Ajo', 3), ('Pimentón dulce', 2)],
   '1. Cuece la calabaza y tritúrala con el ajo y el aceite hasta obtener una crema.\n2. Cuece la pasta integral y escúrrela.\n3. Mezcla con la crema, añade los garbanzos y espolvorea el pimentón.', 'Guarda un poco del agua de la pasta para aligerar la crema.'),
 R('Wrap de tortilla de maíz con hummus y verduras', 10, 'Comida vegana rápida de preparar y fácil de llevar.',
   [('Tortilla de maíz', 100), ('Hummus', 80), ('Garbanzos cocidos', 80), ('Pimiento rojo', 60), ('Lechuga', 30), ('Pepino', 50), ('Aceite de oliva virgen extra', 5)],
   '1. Calienta las tortillas en una sartén seca.\n2. Unta el hummus y reparte los garbanzos, el pimiento, la lechuga y el pepino en tiras.\n3. Enrolla y córtalo por la mitad.', 'Añade unas gotas de limón al relleno.'),
 R('Estofado de alubias con calabaza y espinacas', 30, 'Plato de cuchara vegano, saciante y de bajo coste.',
   [('Alubia cocida roja', 250), ('Calabaza', 150), ('Espinacas', 100), ('Cebolla', 40), ('Aceite de oliva virgen extra', 8), ('Pimentón dulce', 2)],
   '1. Sofríe la cebolla con el aceite y el pimentón.\n2. Añade la calabaza en dados y un vaso de agua y cuece 10 minutos.\n3. Incorpora las alubias y las espinacas y cuece 5 minutos más.', 'Mejora de un día para otro.'),
 R('Arroz integral con tofu al curry y verduras', 30, 'Plato vegano completo con arroz, tofu y verdura.',
   [('Arroz integral', 70), ('Tofu firme', 150), ('Calabacín', 100), ('Pimiento verde', 60), ('Cúrcuma', 2), ('Aceite de oliva virgen extra', 8), ('Cebolla', 40)],
   '1. Cuece el arroz integral.\n2. Dora el tofu en dados con el aceite y la cúrcuma.\n3. Saltea el calabacín, el pimiento y la cebolla, une con el tofu y sirve sobre el arroz.', 'Un chorrito de zumo de lima al final lo aviva.'),
 R('Ensalada templada de lentejas, quinoa y remolacha', 20, 'Ensalada vegana completa con legumbre, cereal y frutos secos.',
   [('Lentejas cocidas', 200), ('Quinoa', 40), ('Remolacha', 100), ('Rúcula', 40), ('Nueces', 15), ('Aceite de oliva virgen extra', 10), ('Vinagre', 10)],
   '1. Cuece la quinoa 12 minutos.\n2. Mezcla las lentejas, la quinoa tibia, la remolacha cocida en dados y la rúcula.\n3. Aliña con el aceite y el vinagre y reparte las nueces troceadas.', 'La remolacha cocida de bote ahorra tiempo.'),
]

variedad = [
 R('Salmón al horno con patata y espárragos', 30, 'Pescado azul al horno con guarnición de patata y verdura.',
   [('Salmón fresco', 140), ('Patata', 250), ('Espárragos', 100), ('Aceite de oliva virgen extra', 4), ('Limón', 10)],
   '1. Corta la patata en rodajas y hornéala 15 minutos a 200 °C.\n2. Añade el salmón y los espárragos con el aceite.\n3. Hornea 12 minutos más y termina con limón.', 'No pases el salmón para que quede jugoso.'),
 R('Pollo al curry suave con arroz integral', 30, 'Plato de ave especiado con cereal integral.',
   [('Pollo', 200), ('Arroz integral', 80), ('Cebolla', 50), ('Leche de coco', 30), ('Calabacín', 80), ('Cúrcuma', 2), ('Aceite de oliva virgen extra', 3)],
   '1. Cuece el arroz integral.\n2. Dora el pollo en dados con la cebolla y la cúrcuma.\n3. Añade el calabacín y la leche de coco y cocina 8 minutos. Sirve con el arroz.', 'Con leche de coco ligera baja la grasa.'),
 R('Lubina al horno con boniato y judías verdes', 30, 'Pescado blanco al horno con hidrato de absorción lenta.',
   [('Lubina', 220), ('Boniato', 200), ('Judías verdes', 120), ('Aceite de oliva virgen extra', 8), ('Limón', 10)],
   '1. Hornea el boniato en rodajas 15 minutos a 200 °C.\n2. Añade la lubina y las judías con el aceite.\n3. Hornea 12 minutos más y sirve con limón.', 'Pide la lubina en lomos sin espinas.'),
 R('Ternera salteada con verduras y arroz integral', 25, 'Salteado de ternera magra con verduras y cereal integral.',
   [('Solomillo de ternera', 150), ('Arroz integral', 70), ('Pimiento verde', 80), ('Cebolla', 40), ('Champiñones', 80), ('Salsa de soja', 10), ('Aceite de oliva virgen extra', 6)],
   '1. Cuece el arroz integral.\n2. Saltea la ternera en tiras a fuego fuerte y retírala.\n3. Saltea las verduras, vuelve a añadir la carne con la soja y sirve con el arroz.', 'Corta la carne a contrafibra para que quede tierna.'),
 R('Pavo estofado con patata y zanahoria', 35, 'Plato de cuchara de ave magra con verduras.',
   [('Pavo', 180), ('Patata', 200), ('Zanahoria', 80), ('Cebolla', 50), ('Guisantes frescos', 80), ('Pimentón', 2), ('Aceite de oliva virgen extra', 8)],
   '1. Sofríe la cebolla con el aceite y el pimentón.\n2. Añade el pavo en dados, la patata y la zanahoria con agua que casi lo cubra.\n3. Cuece 20 minutos y añade los guisantes los últimos 5.', 'Queda mejor si reposa 10 minutos.'),
 R('Atún fresco a la plancha con quinoa y ensalada', 20, 'Plato fresco con pescado azul, cereal y ensalada.',
   [('Atún fresco', 180), ('Quinoa', 70), ('Tomate', 100), ('Pepino', 60), ('Lechuga', 30), ('Aceite de oliva virgen extra', 8), ('Limón', 10)],
   '1. Cuece la quinoa 12 minutos.\n2. Marca el atún a la plancha 2 minutos por lado.\n3. Prepara la ensalada, aliña con aceite y limón y sirve todo junto.', 'Mejor poco hecho por dentro para que no se seque.'),
 R('Tortilla de patata ligera con ensalada', 25, 'Cena ligera con huevo, claras y patata.',
   [('Huevo entero, crudo', 100), ('Clara de huevo', 100), ('Patata', 200), ('Cebolla', 40), ('Lechuga', 40), ('Tomate', 80), ('Aceite de oliva virgen extra', 8)],
   '1. Cuece la patata en láminas en el microondas 6 minutos.\n2. Mezcla con los huevos, las claras y la cebolla pochada y cuaja la tortilla en sartén.\n3. Sirve con la ensalada aliñada.', 'Con sartén antiadherente basta una cucharadita de aceite.'),
 R('Pasta integral con pollo y verduras', 25, 'Plato de pasta integral con proteína magra y verduras.',
   [('Pasta integral', 80), ('Pollo', 150), ('Calabacín', 100), ('Tomate triturado', 100), ('Ajo', 3), ('Aceite de oliva virgen extra', 8)],
   '1. Cuece la pasta integral.\n2. Dora el pollo en dados con el ajo y añade el calabacín.\n3. Agrega el tomate, cocina 8 minutos y mezcla con la pasta.', 'Añade albahaca fresca al servir.'),
 R('Mejillones al vapor con patatas y ensalada', 25, 'Plato ligero de marisco con patata cocida.',
   [('Mejillones', 300), ('Patata', 200), ('Tomate', 100), ('Lechuga', 40), ('Aceite de oliva virgen extra', 8), ('Limón', 10)],
   '1. Cuece la patata en dados.\n2. Abre los mejillones al vapor con un chorrito de agua y limón.\n3. Sirve con las patatas y la ensalada aliñada.', 'Desecha los que no se abran.'),
 R('Rape con verduras salteadas y arroz integral', 25, 'Pescado blanco con verduras salteadas y cereal integral.',
   [('Rape', 220), ('Arroz integral', 60), ('Calabacín', 100), ('Pimiento verde', 60), ('Aceite de oliva virgen extra', 8), ('Ajo', 3)],
   '1. Cuece el arroz integral.\n2. Saltea el rape en trozos con el ajo y retíralo.\n3. Saltea las verduras, une con el pescado y sirve con el arroz.', 'El rape suelta agua: sécalo antes de saltearlo.'),
 R('Pulpo con patata y pimentón', 30, 'Plato ligero de pulpo con patata cocida.',
   [('Pulpo', 200), ('Patata', 250), ('Aceite de oliva virgen extra', 10), ('Pimentón', 2), ('Perejil', 3)],
   '1. Cuece la patata en rodajas.\n2. Calienta el pulpo cocido en láminas.\n3. Monta sobre la patata, aliña con aceite y espolvorea pimentón y perejil.', 'Usa pulpo cocido envasado para ir más rápido.'),
]

desayunos = [
 R('Porridge de avena con manzana, canela y nueces', 8, 'Desayuno dulce sin azúcar añadido, con fibra y grasa buena.',
   [('Avena', 70), ('leche semidesnatada', 250), ('Manzana', 120), ('Nueces', 15), ('Canela molida', 2)],
   '1. Cuece la avena con la leche 5 minutos removiendo.\n2. Añade la manzana en dados y la canela y cuece 2 minutos más.\n3. Sirve con las nueces troceadas.', 'La manzana madura endulza lo suficiente.'),
 R('Tortitas de avena y claras con plátano y yogur', 15, 'Tortitas altas en proteína sin azúcar añadido.',
   [('Harina De Avena', 80), ('Huevo entero, crudo', 60), ('Clara de huevo', 100), ('Plátano', 100), ('Canela molida', 2), ('Frutos rojos congelados', 80), ('Yogur griego natural', 100)],
   '1. Tritura la harina, el huevo, las claras, el plátano y la canela.\n2. Cocina las tortitas en sartén antiadherente por ambos lados.\n3. Sirve con el yogur y los frutos rojos.', 'Un plátano muy maduro sustituye al azúcar.'),
 R('Yogur griego con avena, pera y almendras', 5, 'Desayuno frío y rápido, sin azúcar añadido.',
   [('Yogur griego natural', 200), ('Avena', 50), ('Pera', 120), ('Almendras', 15), ('Canela molida', 2)],
   '1. Mezcla el yogur con la avena y deja reposar 5 minutos.\n2. Añade la pera en dados y las almendras troceadas.\n3. Espolvorea la canela.', 'Si lo prepares la noche anterior, la avena queda más suave.'),
 R('Tostadas de pan integral con requesón, pera y nueces', 7, 'Tostadas dulces con proteína y sin mermelada.',
   [('Pan integral', 100), ('Requesón', 120), ('Pera', 100), ('Nueces', 15), ('Canela molida', 1)],
   '1. Tuesta el pan integral.\n2. Extiende el requesón y reparte la pera en láminas.\n3. Termina con las nueces troceadas y la canela.', 'Se puede cambiar la pera por fresas.'),
 R('Overnight de avena, skyr y frutos rojos', 5, 'Desayuno preparado la noche anterior, alto en proteína.',
   [('Avena', 60), ('Skyr natural', 150), ('leche semidesnatada', 150), ('Frutos rojos congelados', 100), ('Semillas de chía', 10)],
   '1. Mezcla la avena, el skyr, la leche y la chía en un bote.\n2. Añade los frutos rojos y refrigera toda la noche.\n3. Remueve y consume frío.', 'Aguanta 2 días en la nevera.'),
 R('Bol de cottage con piña y semillas de calabaza con pan de centeno', 5, 'Desayuno fresco con proteína y fruta.',
   [('Cottage 0% Materia Grasa', 200), ('Piña', 120), ('Semillas de calabaza', 15), ('Pan de centeno', 80)],
   '1. Pon el cottage en un bol y añade la piña en dados.\n2. Reparte las semillas de calabaza.\n3. Acompaña con el pan de centeno tostado.', 'Con piña natural queda más dulce que la de lata.'),
 R('Tostadas de pan integral con aguacate, queso fresco y tomate', 8, 'Tostadas saladas con grasa buena y proteína.',
   [('Pan integral', 100), ('Aguacate', 60), ('Queso fresco', 80), ('Tomate', 80), ('Aceite de oliva virgen extra', 5)],
   '1. Tuesta el pan.\n2. Aplasta el aguacate y extiéndelo, y reparte el queso fresco.\n3. Añade el tomate en rodajas y un hilo de aceite.', 'Pimienta recién molida por encima.'),
 R('Bocadillo integral de huevo, atún y tomate con zumo', 10, 'Bocadillo completo y saciante para llevar.',
   [('Pan integral', 120), ('Huevo entero, crudo', 100), ('Atún en lata al natural', 60), ('Tomate', 60), ('Aceite de oliva virgen extra', 8), ('Zumo de naranja', 200)],
   '1. Cuece el huevo 10 minutos y pícalo.\n2. Mezcla con el atún escurrido.\n3. Rellena el pan con tomate y la mezcla. Acompaña con el zumo.', 'Añade un poco de mostaza si te gusta.'),
]

meriendas = [
 R('Tostada de hummus y pepino', 5, 'Merienda vegana ligera y fresca.',
   [('Pan integral', 50), ('Hummus', 40), ('Pepino', 40)],
   '1. Tuesta el pan.\n2. Unta el hummus y cubre con el pepino en rodajas.', 'Añade pimentón por encima.'),
 R('Yogur con pera y nueces', 3, 'Merienda cremosa y rápida.',
   [('Yogur natural', 125), ('Pera', 100), ('Nueces', 15)],
   '1. Pon el yogur en un bol.\n2. Añade la pera en dados y las nueces troceadas.', 'Sírvelo frío.'),
 R('Requesón con piña y semillas', 4, 'Merienda con proteína y fruta fresca.',
   [('Requesón', 120), ('Piña', 100), ('Semillas de girasol', 10)],
   '1. Pon el requesón en un bol.\n2. Añade la piña en dados y las semillas.', 'Prueba con melocotón en verano.'),
 R('Verduras con hummus y pan de pita', 8, 'Merienda vegana para picar.',
   [('Zanahoria', 80), ('Pepino', 60), ('Hummus', 60), ('Pan de pita', 30)],
   '1. Corta la zanahoria y el pepino en bastones.\n2. Tuesta el pan de pita y córtalo en triángulos.\n3. Sirve con el hummus para mojar.', 'Pimiento rojo en tiras también va muy bien.'),
 R('Tortilla francesa pequeña con pan y tomate', 8, 'Merienda salada con proteína.',
   [('Huevo entero, crudo', 100), ('Pan integral', 40), ('Tomate', 40), ('Aceite de oliva virgen extra', 4)],
   '1. Haz la tortilla francesa en sartén antiadherente con el aceite.\n2. Tuesta el pan, frota el tomate y coloca la tortilla encima.', 'Con una pizca de orégano.'),
 R('Queso fresco con higos y nueces', 4, 'Merienda dulce y suave con proteína.',
   [('Queso fresco', 100), ('Higos', 60), ('Nueces', 10)],
   '1. Corta el queso fresco y los higos.\n2. Sirve con las nueces troceadas.', 'Con higos secos queda más dulce y calórico.'),
 R('Tortilla de maíz con pavo y queso fresco', 6, 'Merienda salada y ligera, sin gluten.',
   [('Tortilla de maíz', 40), ('Fiambre de Pechuga de Pavo', 40), ('Queso fresco', 50), ('Lechuga', 20)],
   '1. Calienta la tortilla en sartén seca.\n2. Rellena con el pavo, el queso fresco y la lechuga y dóblala.', 'Úntala con mostaza suave.'),
 R('Yogur griego con pasas y anacardos', 3, 'Merienda de proteína y energía rápida.',
   [('Yogur griego natural', 125), ('Pasas', 20), ('Anacardos', 15)],
   '1. Pon el yogur en un bol.\n2. Añade las pasas y los anacardos.', 'Tuesta los anacardos en seco para más sabor.'),
]

salida = [
 ('2026-10-07_veganas-comida-cena.json', lote('veganas-comida-cena-2026-10-07', 'Comida', {'kcal_min': 400, 'kcal_max': 850, 'proteina_pct_min_vegano': 0.13}, veganas, tipo_receta='completa')),
 ('2026-10-07_comidas-cenas-variedad.json', lote('comidas-cenas-variedad-2026-10-07', 'Comida', {'kcal_min': 380, 'kcal_max': 800, 'grasa_pct_max': 0.38}, variedad, tipo_receta='completa')),
 ('2026-10-07_desayunos-menos-azucar.json', lote('desayunos-menos-azucar-2026-10-07', 'Desayuno', {'kcal_min': 420, 'kcal_max': 850}, desayunos)),
 ('2026-10-07_meriendas-variedad.json', lote('meriendas-variedad-2026-10-07', 'Merienda', {'kcal_min': 130, 'kcal_max': 420}, meriendas)),
]
for nombre, d in salida:
    json.dump(d, open(os.path.join(base, nombre), 'w'), ensure_ascii=False, indent=1)
    print(nombre, len(d['recetas']), 'recetas')
